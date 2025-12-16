require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS for Netlify frontend
app.use(cors({
    origin: [
        'https://cyberchatbot.netlify.app',
        'https://cyber-ai-frontend.onrender.com',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'http://localhost:3000',
        'http://localhost:8000',
        '*'
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: true
}));

app.use(helmet());
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

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Cyber AI Backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        geminiStatus: GEMINI_API_KEY ? 'configured' : 'not_configured'
    });
});

// Chat endpoint - FIXED
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

        // ✅ FIXED: Better system prompt
        const systemPrompt = `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful, accurate, and friendly AI assistant specialized in cybersecurity, programming, and AI topics.

IMPORTANT INSTRUCTIONS:
1. You are simply "Cyber AI" - never mention any other AI models
2. Respond naturally to greetings, questions, and casual conversation
3. Format code with markdown when needed
4. Keep responses helpful but concise
5. Use emojis occasionally to make it friendly
6. Be conversational - like a human assistant

User's message: "${lastMessage.content}"
Respond naturally as Cyber AI:`;

        // Prepare Gemini request
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: systemPrompt
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 1000,
                topP: 0.9,
                topK: 40
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
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
                timeout: 25000
            }
        );

        const geminiResponse = response.data;
        
        // ✅ FIXED: Handle all response formats
        let aiResponse = "";
        
        if (geminiResponse.candidates && geminiResponse.candidates[0]?.content?.parts) {
            aiResponse = geminiResponse.candidates[0].content.parts[0].text;
        } else if (geminiResponse.choices && geminiResponse.choices[0]?.message?.content) {
            aiResponse = geminiResponse.choices[0].message.content;
        } else {
            console.log('Unexpected Gemini response:', JSON.stringify(geminiResponse, null, 2));
            throw new Error('Unexpected response format from Gemini');
        }

        // Clean response
        aiResponse = aiResponse
            .replace(/gemini/gi, 'Cyber AI')
            .replace(/google/gi, '')
            .replace(/powered by.*/gi, '')
            .replace(/i'm an ai.*model/gi, 'I\'m Cyber AI')
            .replace(/as an ai assistant/gi, 'as Cyber AI')
            .replace(/language model/gi, 'assistant')
            .trim();

        // ✅ FIXED: Return proper OpenAI format
        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: aiResponse
                }
            }]
        });

    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        // ✅ FIXED: Better fallback responses
        const userMessage = req.body?.messages?.find(m => m.role === "user")?.content || "";
        
        let fallbackResponse = "";
        if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
            fallbackResponse = "Hello! 👋 I'm Cyber AI, your security and programming assistant. How can I help you today?";
        } else if (userMessage.toLowerCase().includes('name')) {
            fallbackResponse = "I'm Cyber AI, created by Team Cybersecurity! Nice to meet you! 😊";
        } else {
            fallbackResponse = `Hello! I'm Cyber AI. 

I can help you with:
• 🔐 Cybersecurity & online safety
• 💻 Programming (Python, JavaScript, etc.)
• 🤖 AI & technology concepts
• 🛡️ Digital privacy tips

What would you like to know?`;
        }

        res.json({
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
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.path} does not exist.`,
        availableEndpoints: ['GET /health', 'POST /api/chat']
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
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
    🌐 CORS: Netlify + All origins
    ⏰ Started: ${new Date().toISOString()}
    ============================
    `);
});
