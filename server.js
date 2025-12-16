require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SECURE: Trust proxy
app.set('trust proxy', 1);

// ✅ SECURE: CORS - All origins allowed
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: false
}));

// ✅ SECURE: Security headers
app.use(helmet());

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ✅ SECURE: Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ✅ SECURE: Get API key from environment
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Validate API key
if (!GROQ_API_KEY) {
    console.error('❌ ERROR: GROQ_API_KEY is missing in .env file');
    console.log('Please create .env file with:');
    console.log('GROQ_API_KEY=your_key_here');
    process.exit(1);
}

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Cyber AI',
        backend: 'working',
        timestamp: new Date().toISOString()
    });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array required' });
        }
        
        const userMessages = messages.filter(m => m.role === "user");
        const lastMessage = userMessages[userMessages.length - 1];
        
        if (!lastMessage) {
            return res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: "Hello! I'm Cyber AI. How can I help you with cybersecurity today?"
                    }
                }]
            });
        }
        
        // Quick responses cache
        const quickResponses = {
            'hello': "Hello! 👋 I'm Cyber AI, created by 'The World of Cybersecurity'!",
            'hi': "Hi! I'm Cyber AI! 😊 Need cybersecurity help?",
            'what is your name': "I'm Cyber AI, developed by Team Cybersecurity! 🔐",
            'kya haal hai': "Main theek hoon! 😊 Aap kaise ho? Main Cyber AI hoon!",
            'kya haal hai bhai': "Main theek hoon bhai! 😊 Cybersecurity mein kya help chahiye?",
            'who created you': "Created by 'The World of Cybersecurity', developed by Team Cybersecurity! 🤖",
            'cyber security': "Cybersecurity protects systems from digital attacks. Need specific help?",
            'thank you': "You're welcome! 😊 Stay secure!",
            'bye': "Goodbye! 👋 Stay safe online!"
        };
        
        const userMsg = lastMessage.content.toLowerCase().trim();
        
        if (quickResponses[userMsg]) {
            return res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: quickResponses[userMsg]
                    }
                }]
            });
        }
        
        // Prepare system message
        const systemMessage = {
            role: "system",
            content: `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful AI assistant specialized in cybersecurity.

Rules:
1. Always identify as "Cyber AI"
2. Keep responses concise
3. Focus on security topics
4. Use simple language
5. Add emojis when appropriate`
        };
        
        // Call Groq API
        const response = await axios.post(
            GROQ_URL,
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    systemMessage,
                    ...messages.slice(-5)
                ],
                temperature: 0.7,
                max_tokens: 500
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                timeout: 10000
            }
        );
        
        let aiResponse = response.data.choices?.[0]?.message?.content || 
                        "I'm Cyber AI. How can I help?";
        
        // Ensure branding
        if (!aiResponse.includes('Cyber AI')) {
            aiResponse = `I'm Cyber AI. ${aiResponse}`;
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
        console.error('Chat error:', error.message);
        
        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: "Hello! I'm Cyber AI. I'm here to help with cybersecurity! 🔐 What would you like to know?"
                }
            }]
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    const keyPreview = GROQ_API_KEY ? 
        `${GROQ_API_KEY.substring(0, 3)}...${GROQ_API_KEY.substring(GROQ_API_KEY.length - 3)}` : 
        'Not set';
    
    console.log(`
    🚀 CYBER AI BACKEND
    ====================
    ✅ Local: http://localhost:${PORT}
    ✅ Port: ${PORT}
    ✅ API Key: ${keyPreview}
    ✅ Status: WORKING
    ====================
    `);
});
