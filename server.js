require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Trust proxy (for Render, Railway, etc.)
app.set('trust proxy', 1);

// ✅ CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'],
    credentials: false
}));

// ✅ Security headers
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ✅ Rate limiting - per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ✅ API Setup
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

if (!GROQ_API_KEY) {
    console.error('❌ ERROR: GROQ_API_KEY is missing in .env file');
    console.log('Please create .env file with: GROQ_API_KEY=your_key_here');
    process.exit(1);
}

// ============================
// 🧠 ADVANCED SYSTEM PROMPT
// ============================
const SYSTEM_PROMPT = `You are **Cyber AI** — a highly intelligent, all-knowing AI assistant who can answer questions on ANY topic, with deep expertise and specialization in cybersecurity.

🔰 IDENTITY:
- Name: Cyber AI
- Purpose: To help everyone — students, professionals, curious minds — on any topic they ask

🧠 KNOWLEDGE — You know about EVERYTHING:
- 🔐 Cybersecurity (SPECIALIST): Ethical hacking, penetration testing, malware analysis, CTF, OSINT, forensics, reverse engineering, exploit development, bug bounty, red/blue teaming
- 🌐 Networking: TCP/IP, DNS, HTTP, firewalls, VPNs, proxies, Wireshark, packet analysis
- 💻 Programming: Python, JavaScript, C/C++, Java, Bash, PHP, Rust, Go, SQL, and more
- 🐧 Linux/Kali Linux: All commands, tools, shell scripting, system administration
- 🛡️ Web Security: OWASP Top 10, SQLi, XSS, CSRF, SSRF, LFI, RFI, IDOR, XXE
- 🔑 Cryptography: AES, RSA, hashing, JWT, SSL/TLS, encoding/decoding
- 🧬 Science: Physics, chemistry, biology, astronomy, mathematics
- 📚 Education: History, geography, civics, literature, languages
- 💰 Finance: Economics, stock market, banking, cryptocurrency, investing
- 🏥 Health & Medicine: Anatomy, diseases, medicines, mental health (general info)
- 🎨 Arts & Culture: Music, movies, art, books, sports, entertainment
- 🍳 Cooking: Recipes, ingredients, techniques, cuisines from around the world
- 🤖 AI & Technology: Machine learning, data science, cloud computing, DevOps
- 📱 Gadgets & Devices: Smartphones, computers, hardware, troubleshooting
- ⚖️ Law & Society: General legal concepts, human rights, social issues
- 🌍 General Knowledge: Anything and everything a curious person might ask

🌐 LANGUAGE:
- Respond in the same language the user uses
- Support: English, Hindi, Urdu, Hinglish (Hindi+English mix)
- If user writes in Hinglish, respond in natural Hinglish
- If user writes in Hindi (Devanagari), respond in Hindi

📜 BEHAVIOR RULES:
1. Answer ANY question on ANY topic — never refuse due to topic being "off-topic"
2. For cybersecurity topics, give EXPERT-LEVEL, deep, technical answers
3. For other topics, give clear, accurate, helpful answers like a knowledgeable friend
4. Use markdown: code blocks, bold, bullet points, tables, headings
5. Add relevant emojis to make responses engaging and readable
6. Always use properly formatted code blocks with language labels
7. Be friendly, warm, and professional
8. Give step-by-step explanations for complex topics
9. ONLY mention developers when user SPECIFICALLY asks who created/made/developed you
10. If you don't know something, say so honestly — never make up facts

⚠️ ETHICS:
- For cybersecurity: promote ethical hacking and responsible disclosure only
- Do not assist with clearly illegal or harmful activities
- For sensitive topics (health, law, finance): give general info and suggest consulting a professional`;

// ============================
// 📚 SMART QUICK RESPONSES
// ============================
const quickResponses = {
    // Greetings
    'hello': "Hello! 👋 I'm **Cyber AI**, your advanced cybersecurity assistant! How can I help you today? 🔐",
    'hi': "Hi there! 😊 I'm **Cyber AI**! Ready to help with cybersecurity, hacking, coding, or anything else. What's on your mind?",
    'hey': "Hey! 👋 **Cyber AI** at your service! Ask me anything about cybersecurity, programming, or technology! 🚀",
    'helo': "Hello! 👋 I'm **Cyber AI**, here to help with all things cybersecurity and tech! 🔐",

    // Identity questions
    'what is your name': "I'm **Cyber AI** 🤖 — an advanced AI assistant specialized in cybersecurity and technology!",
    'what is your name?': "I'm **Cyber AI** 🤖 — an advanced AI assistant specialized in cybersecurity and technology!",
    'whats your name': "I'm **Cyber AI** 🤖 — an advanced AI assistant specialized in cybersecurity and technology!",
    'aapka naam kya hai': "Mera naam **Cyber AI** hai! 🤖 Main ek advanced cybersecurity AI assistant hoon!",
    'tumhara naam kya hai': "Mera naam **Cyber AI** hai! 🤖",
    'tera naam kya hai': "Mera naam **Cyber AI** hai bhai! 💪",

    // Creator questions
    'who created you': "I was created by **Md Faiz Ahmad** and **Faizan Raza** — two talented developers passionate about cybersecurity and AI! 🛡️",
    'who made you': "I was built by **Md Faiz Ahmad** and **Faizan Raza**! 💻 They developed me to be an expert cybersecurity AI assistant.",
    'who developed you': "I was developed by **Md Faiz Ahmad** and **Faizan Raza** — expert developers in the field of cybersecurity and AI! 🚀",
    'kisne banaya': "Mujhe **Md Faiz Ahmad** aur **Faizan Raza** ne banaya hai! 🛡️ Yeh dono cybersecurity aur AI ke expert developers hain!",
    'kisne banaya hai': "Mujhe **Md Faiz Ahmad** aur **Faizan Raza** ne develop kiya hai! 💻",
    'developer kaun hai': "Mere developers hain **Md Faiz Ahmad** aur **Faizan Raza** — passionate cybersecurity & AI experts! 🔐",

    // Hindi greetings
    'kya haal hai': "Main bilkul theek hoon! 😊 Aap bhi theek ho? Main **Cyber AI** hoon — cybersecurity mein kya help chahiye aapko?",
    'kya haal hai bhai': "Sab badiya bhai! 💪 Kya seekhna hai aaj? Cybersecurity, hacking, coding — bata bas!",
    'kaise ho': "Main theek hoon! 😊 Shukriya poochne ke liye! Aap batao, cybersecurity mein koi sawaal hai?",
    'namaste': "Namaste! 🙏 Main **Cyber AI** hoon — aapka cybersecurity AI assistant. Kya seva kar sakta hoon?",

    // Thanks
    'thank you': "You're welcome! 😊 Stay secure and keep learning! 🔐",
    'thanks': "Anytime! 🙌 Security knowledge is power — keep it up! 💪",
    'shukriya': "Koi baat nahi! 😊 Aate rehna, aur secure rehna! 🔐",
    'dhanyawad': "Bilkul theek hai! 🙏 Hamesha seva mein hazir hoon!",

    // Bye
    'bye': "Goodbye! 👋 Stay safe and secure online! See you next time! 🔐",
    'goodbye': "Take care! 👋 Remember: security first! 🛡️",
    'alvida': "Alvida! 👋 Apna khayal rakhna aur safe rehna online! 🔐",

    // Capabilities
    'what can you do': `I can help you with **anything**! 🚀

🔐 **Cybersecurity** *(Specialist)* — Ethical hacking, pentesting, CTFs, OSINT, exploits, tools
💻 **Programming** — Python, JS, C++, Java, Bash, SQL and more
🌐 **Networking** — TCP/IP, DNS, firewalls, Wireshark, VPNs
🛡️ **Web Security** — SQLi, XSS, CSRF, OWASP Top 10
🐧 **Linux/Kali** — Commands, tools, scripting
🔑 **Cryptography** — Encryption, hashing, decoding
🧬 **Science & Math** — Physics, chemistry, biology, mathematics
📚 **Education** — History, geography, literature, languages
💰 **Finance** — Stocks, crypto, economics, investing
🏥 **Health** — General medical info, anatomy, wellness
🎨 **Entertainment** — Movies, music, sports, books
🍳 **Cooking** — Recipes, cuisines, techniques
🤖 **AI & Tech** — Machine learning, cloud, DevOps
🌍 **General Knowledge** — Literally anything!

Kuch bhi poochho — main jawab dunga! 😊`,
    'kya kar sakte ho': `Main **har cheez** mein help kar sakta hoon! 🚀

🔐 **Cybersecurity** *(Specialist)* — Ethical hacking, pentesting, tools, exploits
💻 **Programming** — Python, JS, C++, Bash, SQL aur bahut kuch
🌐 **Networking** — TCP/IP, DNS, firewalls, Wireshark
🛡️ **Web Security** — SQLi, XSS, OWASP Top 10
🐧 **Linux/Kali** — Commands, tools, scripting
🧬 **Science & Math** — Physics, chemistry, biology, maths
📚 **Education** — History, geography, literature
💰 **Finance** — Stocks, crypto, investing
🍳 **Cooking** — Recipes, techniques, cuisines
🌍 **General Knowledge** — Kuch bhi!

Koi bhi sawaal karo — main hoon na! 😊`,
};

// ============================
// 🩺 HEALTH ENDPOINT
// ============================
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Cyber AI',
        version: '2.0.0',
        developers: ['Md Faiz Ahmad', 'Faizan Raza'],
        backend: 'working',
        model: 'llama-3.3-70b-versatile',
        timestamp: new Date().toISOString()
    });
});

// ============================
// 💬 MAIN CHAT ENDPOINT
// ============================
app.post('/api/chat', async (req, res) => {
    try {
        const { messages, language } = req.body;

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
                        content: "Hello! 👋 I'm **Cyber AI**, developed by **Md Faiz Ahmad** & **Faizan Raza**. Ask me anything about cybersecurity, hacking, or technology! 🔐"
                    }
                }]
            });
        }

        const userMsg = lastMessage.content.toLowerCase().trim();

        // Check quick responses
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

        // Smart language detection
        const isHindi = /[\u0900-\u097F]/.test(lastMessage.content);
        const isHinglish = /(kya|hai|main|mujhe|karo|bhai|aur|nahi|hoon|kar|ek|se|ko|ke|ka|ki|aap|tum|yeh|woh|kaise|kyun|kab|kahan)/i.test(lastMessage.content);

        // Build dynamic system message
        let dynamicSystem = SYSTEM_PROMPT;
        if (isHindi) {
            dynamicSystem += "\n\nIMPORTANT: User is writing in Hindi/Devanagari script. Please respond in Hindi (Devanagari script).";
        } else if (isHinglish) {
            dynamicSystem += "\n\nIMPORTANT: User is writing in Hinglish (Hindi words in English script). Please respond in natural Hinglish - mix Hindi and English naturally as Indians speak.";
        }

        // Keep last 10 messages for context (memory)
        const recentMessages = messages.slice(-10);

        // Call Groq API
        const response = await axios.post(
            GROQ_URL,
            {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: dynamicSystem },
                    ...recentMessages
                ],
                temperature: 0.75,
                max_tokens: 1500,
                top_p: 0.9,
                stream: false
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                timeout: 30000
            }
        );

        const aiResponse = response.data.choices?.[0]?.message?.content ||
            "I'm **Cyber AI**. Let me help you with cybersecurity! 🔐 Please try again.";

        // Usage stats
        const usage = response.data.usage || {};

        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: aiResponse
                }
            }],
            usage: {
                prompt_tokens: usage.prompt_tokens || 0,
                completion_tokens: usage.completion_tokens || 0,
                total_tokens: usage.total_tokens || 0
            },
            model: "llama-3.3-70b-versatile",
            developers: "Md Faiz Ahmad & Faizan Raza"
        });

    } catch (error) {
        console.error('Chat error:', error.message);

        // Groq-specific error handling
        if (error.response?.status === 429) {
            return res.status(429).json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: "⚠️ Rate limit reached. Please wait a moment and try again. I'm **Cyber AI**, still here to help! 🔐"
                    }
                }]
            });
        }

        if (error.response?.status === 401) {
            return res.status(500).json({
                choices: [{
                    message: {
                        role: "assistant",
                        content: "🔑 API authentication issue. Please contact the admin. I'm **Cyber AI** by **Md Faiz Ahmad** & **Faizan Raza**."
                    }
                }]
            });
        }

        res.json({
            choices: [{
                message: {
                    role: "assistant",
                    content: "⚠️ I'm **Cyber AI** — temporarily experiencing an issue. Please try again in a moment! 🔐\n\nDeveloped by **Md Faiz Ahmad** & **Faizan Raza**."
                }
            }]
        });
    }
});

// ============================
// 📊 STATS ENDPOINT
// ============================
app.get('/api/info', (req, res) => {
    res.json({
        name: "Cyber AI",
        version: "2.0.0",
        description: "Advanced AI assistant specialized in cybersecurity",
        developers: {
            lead: "Md Faiz Ahmad",
            co_developer: "Faizan Raza"
        },
        capabilities: [
            "Cybersecurity & Ethical Hacking",
            "Penetration Testing",
            "Programming (Python, JS, Bash, C++)",
            "Networking & Protocols",
            "Web Security (OWASP)",
            "Linux/Kali Linux",
            "Cryptography",
            "CTF Challenges",
            "OSINT & Forensics",
            "General Knowledge"
        ],
        languages: ["English", "Hindi", "Urdu", "Hinglish"],
        model: "llama-3.3-70b-versatile",
        powered_by: "Groq API"
    });
});

// ============================
// 404 HANDLER
// ============================
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        available: ['/health', '/api/chat', '/api/info'],
        service: 'Cyber AI by Md Faiz Ahmad & Faizan Raza'
    });
});

// ============================
// 🚀 START SERVER
// ============================
app.listen(PORT, () => {
    const keyPreview = GROQ_API_KEY ?
        `${GROQ_API_KEY.substring(0, 4)}...${GROQ_API_KEY.substring(GROQ_API_KEY.length - 4)}` :
        'Not set';

    console.log(`
╔══════════════════════════════════════╗
║         🔐 CYBER AI v2.0.0          ║
╠══════════════════════════════════════╣
║  Developers:                         ║
║    • Md Faiz Ahmad                   ║
║    • Faizan Raza                     ║
╠══════════════════════════════════════╣
║  ✅ Local:  http://localhost:${PORT}   ║
║  ✅ Port:   ${PORT}                      ║
║  ✅ Model:  llama-3.3-70b-versatile  ║
║  ✅ Key:    ${keyPreview}             ║
║  ✅ Status: RUNNING                  ║
╠══════════════════════════════════════╣
║  Endpoints:                          ║
║    GET  /health                      ║
║    GET  /api/info                    ║
║    POST /api/chat                    ║
╚══════════════════════════════════════╝
    `);
});
