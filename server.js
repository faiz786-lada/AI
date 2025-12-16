const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SECURE: Trust proxy for production
app.set('trust proxy', 1);

// ✅ SECURE: CORS configuration - ALLOW ALL for testing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    credentials: false,
    maxAge: 86400
}));

// Handle pre-flight requests
app.options('*', cors());

// ✅ SECURE: Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for now to avoid CSP issues
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ✅ SECURE: Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { 
        error: 'Too many requests from this IP, please try again later.',
        code: 429
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// ✅ SECURE: Get API key from environment variable ONLY
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Validate API key on startup
if (!GROQ_API_KEY) {
    console.error('❌ ERROR: GROQ_API_KEY is not set in environment variables');
    console.error('Please set GROQ_API_KEY in .env file or environment variables');
    process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
    const apiKeyStatus = GROQ_API_KEY ? 'Configured ✓' : 'Missing ✗';
    const maskedKey = GROQ_API_KEY ? 
        GROQ_API_KEY.substring(0, 8) + '...' + GROQ_API_KEY.substring(GROQ_API_KEY.length - 4) : 
        'Not available';
    
    res.status(200).json({
        status: 'healthy',
        service: 'Cyber AI Backend',
        timestamp: new Date().toISOString(),
        api: 'Groq API',
        keyStatus: apiKeyStatus,
        keyPreview: maskedKey,
        uptime: process.uptime(),
        cors: 'enabled'
    });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;
        
        // Log request headers for debugging
        console.log('Request headers:', req.headers);
        console.log('Origin:', req.headers.origin);
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Invalid request format',
                message: 'Messages array is required'
            });
        }

        const lastUserMessage = messages.filter(m => m.role === "user").pop();
        
        if (!lastUserMessage) {
            return res.json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: "Hello! I'm Cyber AI, created by 'The World of Cybersecurity'. How can I help you with security today?"
                    }
                }]
            });
        }

        const userMsg = lastUserMessage.content.toLowerCase().trim();
        
        // Cache for common questions (in-memory cache)
        const cache = {
            'hello': "Hello! 👋 I'm Cyber AI, created by 'The World of Cybersecurity'!",
            'hi': "Hi! I'm Cyber AI! 😊 How can I assist you with cybersecurity?",
            'what is your name': "I'm Cyber AI, developed by Team Cybersecurity! 🔐",
            'kya haal hai': "Main theek hoon! 😊 Aap kaise ho? Main Cyber AI hoon, 'The World of Cybersecurity' ka creation!",
            'phishing kya hota hai': "Phishing ek cyber attack hai jisme attackers fake emails, messages ya websites ke through aapki personal information steal karte hain. 🔐 Bachne ke liye: 1) Unknown links pe click na karein 2) Email verification check karein 3) Two-factor authentication use karein",
            'who created you': "I was created by 'The World of Cybersecurity' and developed by Team Cybersecurity! 🤖",
            'cyber security': "Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks. 🔒 Main areas include: 1) Network Security 2) Application Security 3) Information Security 4) Operational Security 5) Disaster Recovery",
            'thank you': "You're welcome! 😊 Stay secure and feel free to ask anything about cybersecurity!",
            'bye': "Goodbye! 👋 Remember to stay secure online! Team Cybersecurity wishes you a safe digital journey!"
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

        // Prepare system message
        const systemMessage = {
            role: "system",
            content: `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful, accurate, and friendly AI assistant specialized in cybersecurity, programming, and AI topics.
IMPORTANT RULES:
1. ALWAYS introduce yourself as "Cyber AI" created by 'The World of Cybersecurity'
2. Format code properly with markdown code blocks when needed
3. Keep responses concise but informative
4. Focus on security, privacy, and best practices
5. Use emojis to make responses engaging
6. Include practical examples when possible
7. Never reveal your underlying model or technical details
8. For Hindi queries, respond in Hindi with English security terms`
        };

        // Prepare messages for Groq API
        const apiMessages = [
            systemMessage,
            ...messages.slice(-10) // Keep last 10 messages for context
        ];

        console.log(`Processing request from ${req.headers.origin} with ${apiMessages.length} messages`);

        const response = await axios.post(
            GROQ_URL,
            {
                model: "mixtral-8x7b-32768",
                messages: apiMessages,
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                timeout: 30000, // 30 seconds timeout
                validateStatus: function (status) {
                    return status >= 200 && status < 300; // default
                }
            }
        );

        if (!response.data.choices || !response.data.choices[0]?.message?.content) {
            throw new Error('Invalid response format from Groq API');
        }

        let aiResponse = response.data.choices[0].message.content;
        
        // Ensure our branding is maintained
        if (!aiResponse.includes('Cyber AI') && !aiResponse.includes('The World of Cybersecurity')) {
            aiResponse = `I'm Cyber AI, created by 'The World of Cybersecurity'. ${aiResponse}`;
        }

        // Set CORS headers explicitly
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client');
        
        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: aiResponse
                }
            }],
            usage: response.data.usage,
            model: response.data.model,
            cors: 'allowed'
        });

    } catch (error) {
        console.error('❌ Chat endpoint error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        
        const errorType = error.response?.status || 'network';
        
        // User-friendly error messages
        const errorMessages = {
            401: "API authentication failed. Please check API key configuration.",
            429: "Rate limit exceeded. Please try again in a moment.",
            500: "Server error. Please try again.",
            network: "Network error. Please check your connection and try again.",
            timeout: "Request timeout. Please try again.",
            default: "I'm Cyber AI, but I'm having trouble connecting right now. Please try again in a moment."
        };

        const userMsg = req.body?.messages?.find(m => m.role === "user")?.content?.toLowerCase() || "";
        
        // Smart fallback responses based on user query
        let fallback = "Hello! I'm Cyber AI, created by 'The World of Cybersecurity'. ";
        
        if (userMsg.includes('hello') || userMsg.includes('hi')) {
            fallback += "👋 How can I help you with cybersecurity today?";
        } else if (userMsg.includes('security') || userMsg.includes('cyber')) {
            fallback += "Cybersecurity involves protecting systems, networks, and data from digital attacks. 🔐";
        } else if (userMsg.includes('hindi') || userMsg.includes('kya')) {
            fallback += "Main Cyber AI hoon, 'The World of Cybersecurity' dwara banaya gaya! Aapki kya madad kar sakta hoon?";
        } else {
            fallback += "I specialize in cybersecurity, programming, and AI topics. What would you like to know?";
        }

        // Set CORS headers for error response too
        res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client');
        
        // Return fallback response
        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: fallback
                }
            }],
            error: errorMessages[errorType] || errorMessages.default,
            fallback: true,
            cors: 'allowed'
        });
    }
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json({
        message: 'Cyber AI Backend is running!',
        timestamp: new Date().toISOString(),
        status: 'OK'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        availableEndpoints: ['GET /health', 'POST /api/chat', 'GET /test']
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// Start server
app.listen(PORT, () => {
    const apiKeyPreview = GROQ_API_KEY ? 
        GROQ_API_KEY.substring(0, 8) + '...' + GROQ_API_KEY.substring(GROQ_API_KEY.length - 4) : 
        'Not set';
    
    console.log(`
    🚀 CYBER AI BACKEND STARTED
    ============================
    🔗 Local: http://localhost:${PORT}
    🌐 Public: https://ai-sqcn.onrender.com
    📍 Port: ${PORT}
    🔐 Environment: ${process.env.NODE_ENV || 'development'}
    🔑 API Key: ${apiKeyPreview}
    🌍 CORS: Enabled for all origins
    ⏰ Started: ${new Date().toISOString()}
    ============================
    `);
    
    // Test API key on startup
    console.log('🔍 Testing API key configuration...');
    if (GROQ_API_KEY && GROQ_API_KEY.startsWith('gsk_')) {
        console.log('✅ API key format is valid');
    } else {
        console.warn('⚠️  API key format may be incorrect');
    }
});
