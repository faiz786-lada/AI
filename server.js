require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ IMPORTANT: CORS fix for Netlify
app.use(cors({
    origin: [
        'https://cyberchatbot.netlify.app',
        'https://cyber-ai-frontend.onrender.com',
        'http://localhost:5500',
        'http://127.0.0.1:5500', 
        'http://localhost:3000',
        'http://localhost:8000'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: true
}));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests', retryAfter: '15 minutes' }
});

app.use('/api/', limiter);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Cyber AI Backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        geminiStatus: GEMINI_API_KEY ? 'configured' : 'not_configured',
        cors: 'netlify-enabled'
    });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        // Get last user message
        const userMessages = messages.filter(msg => msg.role === "user");
        const lastMessage = userMessages[userMessages.length - 1];
        
        if (!lastMessage || !lastMessage.content.trim()) {
            return res.status(400).json({ error: 'No valid user message found' });
        }

        // Prepare system prompt
        const systemPrompt = `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful, accurate, and friendly AI assistant specialized in cybersecurity, programming, and AI topics.

IMPORTANT RULES:
1. You are simply "Cyber AI" - never mention being powered by any other AI
2. Format code properly with markdown code blocks
3. Keep responses concise but informative
4. Focus on security, privacy, and best practices
5. Use emojis to make responses engaging
6. Include practical examples when possible`;

        // Prepare request for Gemini
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `${systemPrompt}\n\nUser Message: ${lastMessage.content}\n\nRespond as Cyber AI:`
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
                topP: 0.8,
                topK: 40
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        // Call Gemini API
        const response = await axios.post(
            `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
            requestBody,
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        const geminiResponse = response.data;
        
        if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
            throw new Error('No response generated from AI');
        }

        let aiResponse = geminiResponse.candidates[0].content.parts[0].text;
        
        // Clean response
        aiResponse = aiResponse
            .replace(/gemini/gi, 'Cyber AI')
            .replace(/google/gi, '')
            .replace(/powered by.*/gi, '')
            .replace(/i'm an ai.*model/gi, 'I\'m Cyber AI')
            .trim();

        // Return response
        res.json({
            id: `chat_${Date.now()}`,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: "gemini-2.0-flash",
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: aiResponse
                    },
                    finish_reason: "stop"
                }
            ]
        });

    } catch (error) {
        console.error('API Error:', error.message);
        
        // Fallback response
        const fallbackResponse = `I'm Cyber AI, created by "The World of Cybersecurity". 

I specialize in:
• 🔐 Cybersecurity & threat prevention
• 💻 Programming (Python, JavaScript, Java)
• 🤖 AI & Machine Learning concepts
• 🛡️ Digital safety practices
• 📊 Technology guidance

How can I assist you today?`;

        res.status(200).json({
            choices: [{
                message: {
                    role: "assistant",
                    content: fallbackResponse
                }
            }]
        });
    }
});

// 404 handler
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.path} does not exist.`,
        availableEndpoints: ['GET /health', 'POST /api/chat']
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 CYBER AI BACKEND STARTED
    ============================
    🔗 Local: http://localhost:${PORT}
    📍 Port: ${PORT}
    🔐 Gemini API: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not Configured ✗'}
    🌐 CORS: Netlify Enabled
    ⏰ Started: ${new Date().toISOString()}
    ============================
    `);
});
