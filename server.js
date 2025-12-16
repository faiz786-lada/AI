require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
    message: { error: 'Rate limit exceeded' }
});
app.use('/api/', limiter);

// ✅ SECURE: API key from environment variable
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Cyber AI Backend',
        timestamp: new Date().toISOString(),
        api: 'Groq (Secure)'
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        const lastUserMessage = messages.filter(m => m.role === "user").pop();
        
        if (!lastUserMessage) {
            return res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: "Hello! I'm Cyber AI. How can I help you?"
                    }
                }]
            });
        }

        const userMsg = lastUserMessage.content.toLowerCase().trim();
        
        // Cache for common questions
        const cache = {
            'hello': "Hello! 👋 I'm Cyber AI!",
            'hi': "Hi! I'm Cyber AI! 😊",
            'what is your name': "I'm Cyber AI!",
            'kya haal hai': "Main theek hoon! 😊 Aap kaise ho?",
            'phishing kya hota hai': "Phishing ek cyber attack hai. Fake emails se bachna important hai! 🔐"
        };

        if (cache[userMsg]) {
            return res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: cache[userMsg]
                    }
                }]
            });
        }

        // Check if API key is available
        if (!GROQ_API_KEY) {
            throw new Error('API key not configured');
        }

        const response = await axios.post(
            GROQ_URL,
            {
                model: "mixtral-8x7b-32768",
                messages: [
                    {
                        role: "system",
                        content: "You are Cyber AI, a helpful assistant."
                    },
                    {
                        role: "user",
                        content: lastUserMessage.content
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                timeout: 15000
            }
        );

        let aiResponse = "Hello! I'm Cyber AI.";
        
        if (response.data.choices?.[0]?.message?.content) {
            aiResponse = response.data.choices[0].message.content;
        }

        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: aiResponse
                }
            }]
        });

    } catch (error) {
        console.error('Error:', error.message);
        
        const userMsg = req.body?.messages?.find(m => m.role === "user")?.content?.toLowerCase() || "";
        
        let fallback = "I'm Cyber AI! How can I help?";
        if (userMsg.includes('hello') || userMsg.includes('hi')) fallback = "Hello! 👋";
        if (userMsg.includes('name')) fallback = "I'm Cyber AI! 😊";
        if (userMsg.includes('kya')) fallback = "Main Cyber AI hoon! 🤖";

        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: fallback
                }
            }]
        });
    }
});

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
    console.log(`
    🚀 CYBER AI BACKEND STARTED
    ============================
    🔗 Local: http://localhost:${PORT}
    📍 Port: ${PORT}
    🔐 API Key: ${GROQ_API_KEY ? 'Secure ✓' : 'Missing ✗'}
    ⏰ Started: ${new Date().toISOString()}
    ============================
    `);
});
