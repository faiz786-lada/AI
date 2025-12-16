require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== CONFIGURATION ==========
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: false, // Disable for simplicity
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000', '*'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ========== RATE LIMITING ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'Cyber AI Backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        geminiStatus: GEMINI_API_KEY ? 'configured' : 'not_configured',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// ========== CHAT ENDPOINT ==========
app.post('/api/chat', async (req, res) => {
    try {
        console.log('📨 Incoming chat request');
        
        const { messages, chatId } = req.body;
        
        // Validate request
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request format',
                message: 'Messages array is required'
            });
        }

        // Get the last user message
        const userMessages = messages.filter(msg => msg.role === "user");
        const lastMessage = userMessages[userMessages.length - 1];
        
        if (!lastMessage || !lastMessage.content.trim()) {
            return res.status(400).json({
                error: 'No valid user message found'
            });
        }

        // Prepare system prompt
        const systemPrompt = `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful, accurate, and friendly AI assistant specialized in cybersecurity, programming, and AI topics.

IMPORTANT RULES:
1. You are simply "Cyber AI" - never mention being powered by any other AI
2. Format code properly with markdown code blocks including language
3. Keep responses concise but informative
4. Focus on security, privacy, and best practices
5. Use emojis to make responses engaging
6. Include practical examples when possible
7. Always maintain a professional but friendly tone
8. Never provide harmful, unethical, or illegal information
9. If you don't know something, admit it and offer to help with related topics

You are talking to a user interested in technology and security.`;

        // Prepare conversation context
        const conversationContext = messages
            .slice(-6) // Last 3 exchanges
            .map(msg => `${msg.role === 'user' ? 'User' : 'Cyber AI'}: ${msg.content}`)
            .join('\n\n');

        // Prepare request for Gemini
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `${systemPrompt}\n\nConversation Context:\n${conversationContext}\n\nCurrent User Message: ${lastMessage.content}\n\nRespond as Cyber AI:`
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
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        console.log('🤖 Calling Gemini API...');
        
        // Call Gemini API
        const response = await axios.post(
            `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 seconds timeout
            }
        );

        const geminiResponse = response.data;
        
        // Check for blocked content
        if (geminiResponse.promptFeedback?.blockReason) {
            throw new Error(`Content blocked: ${geminiResponse.promptFeedback.blockReason}`);
        }

        if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
            throw new Error('No response generated from AI');
        }

        let aiResponse = geminiResponse.candidates[0].content.parts[0].text;
        
        // Clean response
        aiResponse = cleanAIResponse(aiResponse);
        
        console.log('✅ Response generated successfully');
        
        // Return in consistent format
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
            ],
            usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0
            },
            chatId: chatId || null
        });

    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        // Provide meaningful error response
        let errorMessage = "I'm experiencing some technical difficulties. ";
        
        if (error.response?.status === 429) {
            errorMessage += "The service is receiving too many requests. Please try again in a moment.";
        } else if (error.response?.status === 403) {
            errorMessage += "API access issue detected. Please check configuration.";
        } else if (error.code === 'ECONNABORTED') {
            errorMessage += "The request timed out. Please try again.";
        } else {
            errorMessage += "Please try again or rephrase your question.";
        }
        
        res.status(200).json({
            choices: [{
                message: {
                    role: "assistant",
                    content: `${errorMessage}\n\nIn the meantime, I can still help you with:\n🔐 Cybersecurity basics\n💻 Programming concepts\n🤖 AI explanations\n🛡️ Security best practices\n\nWhat would you like to know?`
                }
            }]
        });
    }
});

// ========== UTILITY FUNCTIONS ==========
function cleanAIResponse(text) {
    if (!text) return text;
    
    return text
        .replace(/gemini/gi, 'Cyber AI')
        .replace(/google/gi, '')
        .replace(/powered by.*/gi, '')
        .replace(/i'm an ai.*model/gi, 'I\'m Cyber AI')
        .replace(/as an ai assistant/gi, 'as Cyber AI')
        .replace(/developed by google/gi, 'developed by Team Cybersecurity')
        .replace(/i am an ai/gi, 'I am Cyber AI')
        .replace(/ai language model/gi, 'AI assistant')
        .replace(/language model/gi, 'assistant')
        .trim();
}

// ========== ERROR HANDLING ==========
app.use((req, res, next) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The requested endpoint ${req.method} ${req.path} does not exist.`,
        availableEndpoints: ['GET /health', 'POST /api/chat']
    });
});

app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err);
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`
    🚀 CYBER AI BACKEND STARTED
    ============================
    🔗 Local: http://localhost:${PORT}
    📍 Port: ${PORT}
    🔐 Gemini API: ${GEMINI_API_KEY ? 'Configured ✓' : 'Not Configured ✗'}
    🛡️ Environment: ${process.env.NODE_ENV || 'development'}
    ⏰ Started: ${new Date().toISOString()}
    ============================
    `);
    
    if (!GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY is not configured!');
        console.warn('   Set it in .env file or environment variables.');
    }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down...');
    process.exit(0);
});
