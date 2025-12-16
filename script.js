const BACKEND_URL = "https://ai-sqcn.onrender.com";

let isProcessing = false;
let isConnected = false;

// DOM Elements
const messagesContainer = document.getElementById('messagesContainer');
const welcomeContainer = document.getElementById('welcomeContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const typingIndicator = document.getElementById('typingIndicator');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Cyber AI Frontend Starting...');
    console.log('Backend URL:', BACKEND_URL);
    console.log('Frontend URL:', window.location.origin);
    
    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // Test connection
    testConnection();
    
    // Auto-focus input
    setTimeout(() => {
        userInput.focus();
    }, 500);
});

// Test backend connection
async function testConnection() {
    console.log('🔄 Testing backend connection...');
    statusText.textContent = 'Connecting...';
    statusDot.style.background = '#f59e0b';
    
    try {
        const response = await fetch(`${BACKEND_URL}/health`, {
            method: 'GET',
            mode: 'cors',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Backend connected:', data);
            
            isConnected = true;
            statusDot.style.background = '#10b981';
            statusText.textContent = 'Connected ✓';
            
            // Show welcome message
            setTimeout(() => {
                if (messagesContainer.children.length === 1) { // Only welcome container
                    addMessage(
                        "Hello! I'm **Cyber AI**, your secure AI assistant created by *'The World of Cybersecurity'*.\n\n" +
                        "🔐 I specialize in:\n• Cybersecurity & threat analysis\n• Secure programming\n• AI/ML concepts\n• Digital privacy\n\n" +
                        "How can I assist you with security today?",
                        'ai'
                    );
                }
            }, 1000);
            
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Connection failed:', error);
        isConnected = false;
        statusDot.style.background = '#ef4444';
        statusText.textContent = 'Disconnected ✗';
        
        // Show error message
        addMessage(
            `⚠️ **Connection Error**\n\nCannot connect to backend at:\n${BACKEND_URL}\n\n` +
            `Error: ${error.message}\n\n` +
            "Please check:\n1. Backend is running\n2. Network connection\n3. Console for details",
            'ai'
        );
    }
}

// Send message function
async function sendMessage() {
    const message = userInput.value.trim();
    
    // Validations
    if (!message) {
        return;
    }
    
    if (!isConnected) {
        addMessage("⚠️ Not connected to backend. Trying to reconnect...", 'ai');
        testConnection();
        return;
    }
    
    if (isProcessing) {
        addMessage("⏳ Please wait, processing previous message...", 'ai');
        return;
    }
    
    // Hide welcome container
    if (welcomeContainer && welcomeContainer.style.display !== 'none') {
        welcomeContainer.style.display = 'none';
    }
    
    // Add user message
    addMessage(message, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Show typing indicator
    typingIndicator.classList.add('active');
    isProcessing = true;
    sendButton.disabled = true;
    statusText.textContent = 'AI thinking...';
    
    try {
        console.log('📤 Sending message to backend...');
        
        // Prepare request
        const requestBody = {
            messages: [
                {
                    role: "system",
                    content: "You are Cyber AI, a helpful cybersecurity assistant."
                },
                {
                    role: "user",
                    content: message
                }
            ]
        };
        
        console.log('Request body:', requestBody);
        
        // Send request
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Client': 'Cyber-AI-Frontend'
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Response data:', data);
        
        // Hide typing indicator
        typingIndicator.classList.remove('active');
        isProcessing = false;
        sendButton.disabled = false;
        statusText.textContent = 'Connected';
        
        // Get AI response
        let aiResponse = data.choices?.[0]?.message?.content || 
                        data.content || 
                        "I'm Cyber AI. How can I help you?";
        
        console.log('AI Response:', aiResponse);
        
        // Add AI response
        addMessage(aiResponse, 'ai');
        
    } catch (error) {
        console.error('❌ Error sending message:', error);
        
        // Hide typing indicator
        typingIndicator.classList.remove('active');
        isProcessing = false;
        sendButton.disabled = false;
        statusDot.style.background = '#ef4444';
        statusText.textContent = 'Error';
        
        // Show error to user
        addMessage(
            `⚠️ **Error Processing Request**\n\n` +
            `Message: ${error.message}\n\n` +
            "I'm Cyber AI. How can I help you with cybersecurity today?",
            'ai'
        );
        
        // Try to reconnect
        setTimeout(() => {
            if (!isConnected) {
                testConnection();
            }
        }, 3000);
    }
}

// Add message to chat UI
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const time = new Date().toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const avatarIcon = sender === 'user' ? 'fas fa-user' : 'fas fa-robot';
    
    messageDiv.innerHTML = `
        <div class="avatar ${sender}">
            <i class="${avatarIcon}"></i>
        </div>
        <div class="message-content">
            <div class="message-text">${formatMessage(text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Format message text
function formatMessage(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/🔐/g, '🔐 ')
        .replace(/⚠️/g, '⚠️ ')
        .replace(/✅/g, '✅ ')
        .replace(/❌/g, '❌ ');
}

// Quick test button (temporary)
function addTestButton() {
    const testBtn = document.createElement('button');
    testBtn.innerHTML = '🧪 Test Connection';
    testBtn.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        background: #667eea;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 10px;
        cursor: pointer;
        z-index: 1000;
        font-size: 12px;
    `;
    
    testBtn.onclick = async function() {
        console.log('🧪 Manual test started...');
        await testConnection();
    };
    
    document.body.appendChild(testBtn);
}

// Add test button for debugging
addTestButton();
