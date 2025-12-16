// ========== CONFIGURATION ==========
const BACKEND_URL = "https://cyber-ai-backend.vercel.app"; // Change this to your backend URL
const MAX_HISTORY_ITEMS = 50;

// ========== STATE MANAGEMENT ==========
let chatHistory = [];
let isProcessing = false;
let isConnected = false;
let currentChatId = generateChatId();
let chatSessions = JSON.parse(localStorage.getItem('cyberAiChatSessions')) || {};

// ========== DOM ELEMENTS ==========
const messagesContainer = document.getElementById('messagesContainer');
const welcomeContainer = document.getElementById('welcomeContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const newChatBtn = document.getElementById('newChatBtn');
const examplePrompts = document.querySelectorAll('.example-prompt');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const clearBtn = document.getElementById('clearBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.querySelector('.sidebar');

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    console.log('🚀 Cyber AI Initializing...');
    
    // Load chat sessions
    loadChatSessions();
    
    // Event Listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', handleKeydown);
    newChatBtn.addEventListener('click', startNewChat);
    clearBtn.addEventListener('click', clearInput);
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    
    // Example prompts
    examplePrompts.forEach(prompt => {
        prompt.addEventListener('click', () => {
            const promptText = prompt.getAttribute('data-prompt');
            userInput.value = promptText;
            userInput.focus();
            autoResizeTextarea();
        });
    });
    
    // Auto-resize textarea
    userInput.addEventListener('input', autoResizeTextarea);
    
    // Test backend connection
    testConnection();
    
    // Focus input
    userInput.focus();
    
    // Load last chat if exists
    if (chatSessions[currentChatId]) {
        loadChat(currentChatId);
    }
}

// ========== UTILITY FUNCTIONS ==========
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isProcessing && isConnected) {
            sendMessage();
        }
    }
}

function clearInput() {
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.focus();
}

function toggleMobileMenu() {
    sidebar.classList.toggle('active');
}

// ========== BACKEND CONNECTION ==========
async function testConnection() {
    statusText.textContent = 'Connecting...';
    statusDot.style.background = '#f59e0b';
    
    try {
        const response = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            isConnected = true;
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Secure Connection ✓';
            
            console.log('✅ Backend connected:', data);
            
            // Show welcome message
            setTimeout(() => {
                if (welcomeContainer.style.display !== 'none') {
                    addMessage(
                        "Hello! I'm **Cyber AI**, your secure AI assistant created by *'The World of Cybersecurity'*.\n\n" +
                        "🔐 I specialize in:\n" +
                        "• Cybersecurity & threat analysis\n" +
                        "• Secure programming (Python, JavaScript, etc.)\n" +
                        "• AI/ML concepts and implementation\n" +
                        "• Digital privacy & safety guidance\n\n" +
                        "How can I assist you with security today?",
                        'ai'
                    );
                }
            }, 1000);
            
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        console.log('⚠️ Backend connection failed:', error.message);
        isConnected = true; // Allow offline mode
        statusDot.style.background = '#f59e0b';
        statusText.textContent = 'Enhanced Mode';
        
        // Show fallback welcome
        setTimeout(() => {
            addMessage(
                "Hello! I'm **Cyber AI**.\n\n" +
                "⚠️ *Running in enhanced mode*\n\n" +
                "I can still help you with:\n" +
                "• Cybersecurity best practices\n" +
                "• Programming concepts\n" +
                "• AI/ML explanations\n" +
                "• Technology guidance\n\n" +
                "How can I assist you?",
                'ai'
            );
        }, 1000);
    }
}

// ========== CHAT FUNCTIONS ==========
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || isProcessing || !isConnected) return;
    
    // Hide welcome container
    if (welcomeContainer.style.display !== 'none') {
        welcomeContainer.style.display = 'none';
    }
    
    // Add user message
    addMessage(message, 'user');
    
    // Clear input
    clearInput();
    
    // Show typing indicator
    typingIndicator.classList.add('active');
    isProcessing = true;
    sendButton.disabled = true;
    statusText.textContent = 'Analyzing securely...';
    
    try {
        // Prepare messages for backend
        const messages = [
            {
                role: "system",
                content: `You are Cyber AI, created by 'The World of Cybersecurity' and developed by Team Cybersecurity.
You are a helpful, accurate, and friendly AI assistant specialized in cybersecurity, programming, and AI topics.
IMPORTANT RULES:
1. Format code properly with markdown code blocks
2. Keep responses concise but informative
3. Never mention that you are powered by any specific AI model
4. You are simply "Cyber AI"
5. Focus on security, privacy, and best practices
6. Use emojis to make responses engaging
7. Include practical examples when possible`
            },
            ...chatHistory.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            {
                role: "user",
                content: message
            }
        ];
        
        // Call backend API
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Client': 'Cyber-AI-Web'
            },
            body: JSON.stringify({
                messages: messages,
                chatId: currentChatId,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Hide typing indicator
        typingIndicator.classList.remove('active');
        isProcessing = false;
        sendButton.disabled = false;
        statusText.textContent = 'Connected';
        
        // Extract AI response
        let aiResponse = "";
        
        if (data.choices && data.choices.length > 0) {
            aiResponse = data.choices[0].message.content;
        } else if (data.content) {
            aiResponse = data.content;
        } else if (data.candidates && data.candidates[0]?.content?.parts) {
            aiResponse = data.candidates[0].content.parts[0].text;
        } else {
            console.log('Response data:', data);
            throw new Error('Invalid response format');
        }
        
        // Clean response
        aiResponse = cleanResponse(aiResponse);
        
        // Add AI response
        addMessage(aiResponse, 'ai');
        
        // Update chat history
        chatHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: aiResponse }
        );
        
        // Save chat session
        saveChatSession();
        
        // Keep history manageable
        if (chatHistory.length > MAX_HISTORY_ITEMS) {
            chatHistory = chatHistory.slice(-MAX_HISTORY_ITEMS);
        }
        
        console.log('✅ Message sent successfully');
        
    } catch (error) {
        // Hide typing indicator
        typingIndicator.classList.remove('active');
        isProcessing = false;
        sendButton.disabled = false;
        statusDot.style.background = '#ef4444';
        statusText.textContent = 'Error - Using Enhanced Mode';
        
        console.error('Chat error:', error.message);
        
        // Enhanced fallback response
        const fallbackResponse = getFallbackResponse(message);
        addMessage(fallbackResponse, 'ai');
        
        // Update chat history
        chatHistory.push(
            { role: 'user', content: message },
            { role: 'assistant', content: fallbackResponse }
        );
        
        // Save chat session
        saveChatSession();
        
        // Reset status after 3 seconds
        setTimeout(() => {
            if (isConnected) {
                statusDot.style.background = '#10b981';
                statusText.textContent = 'Connected';
            }
        }, 3000);
    }
}

function cleanResponse(text) {
    return text
        .replace(/gemini/gi, 'Cyber AI')
        .replace(/google/gi, '')
        .replace(/powered by.*/gi, '')
        .replace(/i'm an ai.*model/gi, 'I\'m Cyber AI')
        .replace(/as an ai assistant/gi, 'as Cyber AI')
        .replace(/developed by google/gi, 'developed by Team Cybersecurity');
}

function getFallbackResponse(userMessage) {
    const msg = userMessage.toLowerCase();
    
    const responses = {
        greeting: `👋 Hello! I'm **Cyber AI**, created by *"The World of Cybersecurity"*. 

I can help you with:
🔐 **Cybersecurity** - Threat prevention, encryption, security audits
💻 **Programming** - Python, JavaScript, Java, C++ with security focus
🤖 **AI/ML** - Machine learning, neural networks, AI security
🛡️ **Digital Safety** - Privacy protection, secure communications
📊 **Technology** - Latest trends, best practices, career guidance

What would you like to know?`,

        python: `🐍 **Python Security Programming**

\`\`\`python
import hashlib
import secrets

class PasswordManager:
    def __init__(self):
        self.salt = secrets.token_hex(16)
    
    def hash_password(self, password):
        """Securely hash password with salt"""
        salted = password + self.salt
        return hashlib.sha256(salted.encode()).hexdigest()
    
    def generate_secure_token(self, length=32):
        """Generate cryptographically secure token"""
        return secrets.token_urlsafe(length)

# Usage
pm = PasswordManager()
hashed = pm.hash_password("MySecurePass123!")
token = pm.generate_secure_token()
print(f"Hashed: {hashed}\\nToken: {token}")
\`\`\`

Need help with specific Python security tasks?`,

        cybersecurity: `🛡️ **Cybersecurity Essentials**

**🔒 Core Principles:**
1. **Confidentiality** - Protect sensitive data
2. **Integrity** - Ensure data accuracy
3. **Availability** - Maintain system access
4. **Authentication** - Verify user identity
5. **Authorization** - Control access levels

**🛡️ Practical Steps:**
✓ Use password managers (Bitwarden, 1Password)
✓ Enable 2FA everywhere possible
✓ Regular software updates
✓ Encrypt sensitive data (AES-256)
✓ Backup using 3-2-1 rule
✓ Network segmentation
✓ Security awareness training

**🎯 Common Threats:**
• Phishing attacks
• Ransomware
• DDoS attacks
• SQL injection
• Cross-site scripting (XSS)

Need specific guidance?`,

        ai: `🤖 **AI & Machine Learning Security**

**🧠 AI Security Categories:**
1. **Data Security** - Protect training data
2. **Model Security** - Prevent adversarial attacks
3. **Infrastructure** - Secure AI deployment
4. **Ethics** - Ensure responsible AI

**🔐 Key Practices:**
• Data encryption at rest & in transit
• Model watermarking for ownership
• Adversarial training for robustness
• Secure API endpoints (HTTPS, rate limiting)
• Regular security audits
• Privacy-preserving AI (Federated Learning)

**⚠️ AI-Specific Threats:**
• Model poisoning
• Data leakage
• Membership inference attacks
• Model extraction attacks
• Bias amplification

Want to dive deeper into any topic?`,

        general: `🔧 **Cyber AI - Your Security Assistant**

I'm here to help you with technology and security challenges. Here are some areas I specialize in:

**💼 For Professionals:**
• Secure coding practices
• Threat modeling
• Security architecture design
• Compliance (GDPR, HIPAA, PCI-DSS)
• Incident response planning

**👨‍💻 For Developers:**
• API security best practices
• Authentication/Authorization (OAuth2, JWT)
• Encryption implementation
• Secure DevOps (DevSecOps)
• Code review for vulnerabilities

**👩‍🎓 For Learners:**
• Cybersecurity career paths
• Certification guidance (CISSP, CEH, Security+)
• Learning resources & labs
• Interview preparation
• Project ideas

**🔍 Tell me what you need help with!**`
    };

    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
        return responses.greeting;
    }
    if (msg.includes('python') || msg.includes('code') || msg.includes('program')) {
        return responses.python;
    }
    if (msg.includes('cyber') || msg.includes('security') || msg.includes('hack')) {
        return responses.cybersecurity;
    }
    if (msg.includes('ai') || msg.includes('machine learning') || msg.includes('neural')) {
        return responses.ai;
    }
    if (msg.includes('thank')) {
        return "You're welcome! I'm always here to help with your security and technology needs. Stay safe! 🔐";
    }
    
    return responses.general;
}

// ========== MESSAGE DISPLAY ==========
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const avatarIcon = sender === 'user' ? 'fas fa-user-secret' : 'fas fa-shield-alt';
    
    messageDiv.innerHTML = `
        <div class="avatar ${sender}">
            <i class="${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${formatText(text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^• (.*$)/gm, '• $1<br>')
        .replace(/^\d+\. (.*$)/gm, '$1<br>')
        .replace(/✅/g, '<span style="color: #10b981;">✅</span>')
        .replace(/❌/g, '<span style="color: #ef4444;">❌</span>')
        .replace(/⚠️/g, '<span style="color: #f59e0b;">⚠️</span>')
        .replace(/🔐/g, '🔐 ')
        .replace(/💻/g, '💻 ')
        .replace(/🤖/g, '🤖 ')
        .replace(/🛡️/g, '🛡️ ')
        .replace(/📊/g, '📊 ')
        .replace(/👋/g, '👋 ')
        .replace(/🎯/g, '🎯 ')
        .replace(/🔒/g, '🔒 ');
}

// ========== CHAT SESSIONS MANAGEMENT ==========
function startNewChat() {
    if (chatHistory.length > 0) {
        if (!confirm('Start a new chat? Current conversation will be saved.')) {
            return;
        }
    }
    
    // Save current chat
    saveChatSession();
    
    // Create new chat
    currentChatId = generateChatId();
    chatHistory = [];
    
    // Clear messages
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
    
    // Show welcome container
    welcomeContainer.style.display = 'block';
    
    // Update history list
    loadChatSessions();
    
    // Focus input
    userInput.focus();
    
    // Show greeting
    setTimeout(() => {
        addMessage("Hello! I'm Cyber AI. I've started a new secure chat session. How can I help you with security today?", 'ai');
    }, 500);
}

function saveChatSession() {
    if (chatHistory.length === 0) return;
    
    const title = chatHistory.find(msg => msg.role === 'user')?.content || 'New Chat';
    const preview = title.substring(0, 30) + (title.length > 30 ? '...' : '');
    
    chatSessions[currentChatId] = {
        id: currentChatId,
        title: preview,
        messages: [...chatHistory],
        timestamp: new Date().toISOString(),
        lastUpdated: Date.now()
    };
    
    // Keep only last 20 sessions
    const sessionArray = Object.entries(chatSessions);
    if (sessionArray.length > 20) {
        sessionArray.sort((a, b) => b[1].lastUpdated - a[1].lastUpdated);
        const toDelete = sessionArray.slice(20);
        toDelete.forEach(([id]) => delete chatSessions[id]);
    }
    
    localStorage.setItem('cyberAiChatSessions', JSON.stringify(chatSessions));
    loadChatSessions();
}

function loadChatSessions() {
    chatHistoryList.innerHTML = '';
    
    const sessions = Object.values(chatSessions)
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
    
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === currentChatId ? 'active' : ''}`;
        item.innerHTML = `
            <i class="fas fa-comment-dots"></i>
            <span>${session.title}</span>
        `;
        
        item.addEventListener('click', () => loadChat(session.id));
        chatHistoryList.appendChild(item);
    });
    
    if (sessions.length === 0) {
        chatHistoryList.innerHTML = '<div class="history-item">No saved chats</div>';
    }
}

function loadChat(chatId) {
    const session = chatSessions[chatId];
    if (!session) return;
    
    currentChatId = chatId;
    chatHistory = [...session.messages];
    
    // Clear messages
    const messages = messagesContainer.querySelectorAll('.message');
    messages.forEach(msg => msg.remove());
    
    // Hide welcome
    welcomeContainer.style.display = 'none';
    
    // Reload messages
    chatHistory.forEach(msg => {
        addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai');
    });
    
    // Update history list
    loadChatSessions();
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Focus input
    userInput.focus();
}

// ========== ERROR HANDLING ==========
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    statusDot.style.background = '#ef4444';
    statusText.textContent = 'Error';
    
    setTimeout(() => {
        if (isConnected) {
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Connected';
        }
    }, 3000);
});

// Export chat function
function exportChat() {
    const chatData = {
        id: currentChatId,
        title: chatHistory.find(msg => msg.role === 'user')?.content || 'Cyber AI Chat',
        messages: chatHistory,
        timestamp: new Date().toISOString(),
        createdBy: 'Cyber AI Assistant'
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `cyber-ai-chat-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

console.log('🚀 Cyber AI Frontend Loaded Successfully!');
