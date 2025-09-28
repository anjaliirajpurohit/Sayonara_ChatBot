// Sayonara Chatbot - Main Application Script
// This file contains all React components and Gemini/LangChain integration

const { useState, useEffect, useRef, useCallback, createContext, useContext } = React;

// Get configuration from window object
const CONFIG = window.CHATBOT_CONFIG || {};

// ============================================================================
// API SERVICE - Gemini + LangChain Integration
// ============================================================================

class ChatbotAPI {
    constructor(config) {
        this.config = config;
        this.chatHistory = [];
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Main method to send message to Gemini via your backend
    async sendMessage(conversationId, message, chatHistory = []) {
        try {
            const response = await fetch(this.config.API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Include API key in header if needed (for backend authentication)
                    'X-API-Key': this.config.GEMINI_API_KEY,
                    'X-Session-Id': this.sessionId
                },
                body: JSON.stringify({
                    conversationId,
                    message,
                    chatHistory,
                    config: {
                        model: this.config.MODEL,
                        maxTokens: this.config.MAX_TOKENS,
                        temperature: this.config.TEMPERATURE,
                        ragEnabled: this.config.RAG_ENABLED
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            return {
                messageId: data.messageId || Date.now(),
                content: data.text || data.content || data.response,
                done: true,
                metadata: data.metadata || {}
            };
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }

    // Stream message using Server-Sent Events or WebSocket
    async streamMessage(conversationId, message, chatHistory, onChunk, onError) {
        if (!this.config.ENABLE_STREAMING) {
            // Fallback to non-streaming
            const response = await this.sendMessage(conversationId, message, chatHistory);
            onChunk(response.content, true);
            return () => {};
        }

        try {
            // Using EventSource for Server-Sent Events
            const eventSource = new EventSource(
                `${this.config.API_ENDPOINT}/stream?` + new URLSearchParams({
                    conversationId,
                    message,
                    sessionId: this.sessionId
                })
            );

            eventSource.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.done) {
                    eventSource.close();
                    onChunk(data.content, true);
                } else {
                    onChunk(data.content, false);
                }
            };

            eventSource.onerror = (error) => {
                console.error('Stream error:', error);
                eventSource.close();
                if (onError) onError(error);
                
                // Fallback to demo streaming if real streaming fails
                this.demoStream(message, onChunk);
            };

            return () => eventSource.close();
        } catch (error) {
            console.error('Streaming not available, falling back:', error);
            // Fallback demo streaming
            return this.demoStream(message, onChunk);
        }
    }

    // Demo streaming for when backend is not available
    demoStream(message, onChunk) {
        const responses = {
            'wiping': 'The Sayonara platform uses military-grade NIST 800-88 compliant data sanitization. Our dual-phase process ensures complete erasure with blockchain verification.',
            'blockchain': 'Each data wipe generates a tamper-proof certificate stored on the Ethereum Sepolia testnet. This provides immutable proof of compliance.',
            'rag': 'Our RAG (Retrieval Augmented Generation) system enhances responses with real-time data from our knowledge base about secure data wiping procedures.',
            'default': 'I understand your query about the Sayonara data wiping solution. Our platform offers comprehensive secure erasure with AI guidance and blockchain verification.'
        };

        let response = responses.default;
        const lower = message.toLowerCase();
        if (lower.includes('wip')) response = responses.wiping;
        else if (lower.includes('blockchain')) response = responses.blockchain;
        else if (lower.includes('rag')) response = responses.rag;

        const words = response.split(' ');
        let index = 0;
        
        const interval = setInterval(() => {
            if (index < words.length) {
                onChunk(words.slice(0, index + 1).join(' '), false);
                index++;
            } else {
                clearInterval(interval);
                onChunk(response, true);
            }
        }, 100);

        return () => clearInterval(interval);
    }

    // LangChain integration for enhanced responses
    async queryLangChain(query, context = {}) {
        try {
            const response = await fetch(this.config.LANGCHAIN_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.config.GEMINI_API_KEY
                },
                body: JSON.stringify({
                    query,
                    context,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) throw new Error('LangChain query failed');
            return await response.json();
        } catch (error) {
            console.error('LangChain error:', error);
            return null;
        }
    }

    // RAG query for knowledge base
    async queryRAG(query) {
        if (!this.config.RAG_ENABLED) return null;

        try {
            const response = await fetch(this.config.RAG_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            if (!response.ok) throw new Error('RAG query failed');
            return await response.json();
        } catch (error) {
            console.error('RAG error:', error);
            return null;
        }
    }

    // Get conversations (mock for now)
    async getConversations() {
        // This would normally fetch from your backend
        await new Promise(resolve => setTimeout(resolve, 300));
        return [
            { 
                id: 'c1', 
                title: 'Data Wiping Setup', 
                lastMessage: 'NIST 800-88 standards configured', 
                unread: 2, 
                updatedAt: new Date().toISOString() 
            },
            { 
                id: 'c2', 
                title: 'Blockchain Integration', 
                lastMessage: 'Certificates deployed on Sepolia', 
                unread: 0, 
                updatedAt: new Date().toISOString() 
            },
            { 
                id: 'c3', 
                title: 'RAG Configuration', 
                lastMessage: 'Knowledge base updated', 
                unread: 1, 
                updatedAt: new Date().toISOString() 
            },
        ];
    }

    // File upload handler
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', this.sessionId);

        try {
            const response = await fetch(`${this.config.API_ENDPOINT}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('File upload failed');
            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }
}

// Create API instance
const api = new ChatbotAPI(CONFIG);

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Markdown parser (simple version)
const parseMarkdown = (text) => {
    if (!CONFIG.ENABLE_MARKDOWN) return text;
    
    let html = text;
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold
    html = html.replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*)\*/g, '<em>$1</em>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-400 hover:underline">$1</a>');
    
    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Lists
    html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
};

// ============================================================================
// REACT CONTEXTS
// ============================================================================

// Theme Context
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved === 'dark' || saved === null;
    });
    
    const toggleTheme = () => {
        const newTheme = !isDark;
        setIsDark(newTheme);
        localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    };
    
    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Chat Context for managing global chat state
const ChatContext = createContext();

const ChatProvider = ({ children }) => {
    const [chatHistory, setChatHistory] = useState([]);
    const [isConnected, setIsConnected] = useState(true);
    
    const addMessage = (message) => {
        setChatHistory(prev => [...prev, message]);
    };
    
    return (
        <ChatContext.Provider value={{ chatHistory, addMessage, isConnected, setIsConnected }}>
            {children}
        </ChatContext.Provider>
    );
};

// ============================================================================
// REACT COMPONENTS
// ============================================================================

// Icons Component
const Icon = ({ name, className = "" }) => {
    const icons = {
        send: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>,
        moon: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
        sun: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
        plus: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
        search: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
        copy: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
        menu: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
        close: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
        attachment: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>,
        emoji: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
        settings: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
        refresh: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
        download: <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>,
    };
    return icons[name] || null;
};

// Typing Indicator Component
const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-4 glass rounded-2xl max-w-[100px]">
        <div className="w-2 h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full typing-dot"></div>
        <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full typing-dot"></div>
    </div>
);

// Error Component
const ErrorMessage = ({ message, onRetry }) => (
    <div className="error-message rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
            <span className="text-sm">{message}</span>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="ml-2 px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 rounded transition-colors"
                >
                    Retry
                </button>
            )}
        </div>
    </div>
);

// Message Component
const Message = ({ message, isUser }) => {
    const [copied, setCopied] = useState(false);
    const [reaction, setReaction] = useState(null);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const handleReaction = (emoji) => {
        setReaction(emoji);
    };
    
    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} message-enter group`}>
            <div className={`relative max-w-[85%] lg:max-w-[70%] ${isUser ? 'order-1' : ''}`}>
                <div className={`rounded-2xl px-4 py-3 ${
                    isUser 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg glow-hover' 
                        : 'glass-dark text-gray-100'
                }`}>
                    {CONFIG.ENABLE_MARKDOWN ? (
                        <div 
                            className="markdown-content text-sm md:text-base leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                        />
                    ) : (
                        <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
                    )}
                    
                    {CONFIG.SHOW_TIMESTAMPS && message.timestamp && (
                        <p className="text-xs opacity-70 mt-1">
                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>
                
                {/* Action buttons */}
                <div className={`absolute ${isUser ? 'left-0' : 'right-0'} -bottom-6 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2`}>
                    <button 
                        onClick={handleCopy}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Copy message"
                    >
                        {copied ? '✓' : <Icon name="copy" className="w-4 h-4" />}
                    </button>
                    <div className="flex space-x-1">
                        {['❤️', '👍', '😂'].map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => handleReaction(emoji)}
                                className={`text-sm hover:scale-125 transition-transform ${
                                    reaction === emoji ? 'scale-125' : ''
                                }`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
                
                {reaction && (
                    <div className="absolute -bottom-2 -right-2 bg-gray-800 rounded-full px-2 py-1 text-xs">
                        {reaction}
                    </div>
                )}
            </div>
        </div>
    );
};

// Quick Reply Component
const QuickReplies = ({ replies, onSelect }) => (
    <div className="flex flex-wrap gap-2 px-4 py-2">
        {replies.map((reply, index) => (
            <button
                key={index}
                onClick={() => onSelect(reply)}
                className="px-4 py-2 rounded-full glass hover:bg-white/10 text-white text-sm transition-all hover:scale-105 border border-white/20"
            >
                {reply}
            </button>
        ))}
    </div>
);

// Sidebar Component
const Sidebar = ({ conversations, onSelectConversation, selectedId, isOpen, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    
    const filteredConversations = conversations.filter(conv => 
        conv.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return (
        <div className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:relative inset-y-0 left-0 w-80 glass-dark z-40 transition-transform duration-300`}>
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Conversations</h2>
                        <button
                            onClick={onClose}
                            className="lg:hidden text-white/60 hover:text-white"
                        >
                            <Icon name="close" className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {/* Search */}
                    <div className="relative">
                        <Icon name="search" className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search conversations..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg glass bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                    
                    {/* New Chat Button */}
                    <button className="w-full mt-3 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all hover:scale-105 flex items-center justify-center space-x-2 glow">
                        <Icon name="plus" className="w-5 h-5" />
                        <span>New Chat</span>
                    </button>
                </div>
                
                {/* Conversations List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredConversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => {
                                onSelectConversation(conv.id);
                                if (window.innerWidth < 1024) onClose();
                            }}
                            className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 ${
                                selectedId === conv.id ? 'bg-white/10 border-l-4 border-purple-500' : ''
                            }`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <h3 className="font-semibold text-white">{conv.title}</h3>
                                {conv.unread > 0 && (
                                    <span className="px-2 py-1 text-xs rounded-full bg-purple-600 text-white pulse">
                                        {conv.unread}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 truncate">{conv.lastMessage}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Right Panel Component
const RightPanel = ({ isOpen, onClose }) => {
    const { isDark, toggleTheme } = useContext(ThemeContext);
    const { isConnected } = useContext(ChatContext);
    
    return (
        <div className={`${isOpen ? 'translate-x-0' : 'translate-x-full'} fixed lg:relative inset-y-0 right-0 w-80 h-full glass-dark z-40 transition-transform duration-300 lg:translate-x-0`}>
            <div className="h-full flex flex-col p-4 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="lg:hidden text-white/60 hover:text-white"
                    >
                        <Icon name="close" className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Connection Status */}
                <div className="mb-6 p-4 rounded-lg glass">
                    <div className="flex items-center justify-between">
                        <span className="text-white font-medium">API Status</span>
                        <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-xs text-gray-400">
                                {isConnected ? 'Connected' : 'Disconnected'}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Theme Toggle */}
                <div className="mb-6">
                    <div className="flex items-center justify-between p-4 rounded-lg glass">
                        <span className="text-white font-medium">Dark Mode</span>
                        <button
                            onClick={toggleTheme}
                            className="relative w-14 h-7 rounded-full bg-gray-700 transition-colors"
                        >
                            <div className={`absolute top-1 ${isDark ? 'left-8' : 'left-1'} w-5 h-5 bg-white rounded-full transition-all`}></div>
                        </button>
                    </div>
                </div>
                
                {/* Model Info */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">AI Configuration</h3>
                    <div className="p-4 rounded-lg glass space-y-3">
                        <div>
                            <div className="flex items-center space-x-2 mb-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-white font-medium">{CONFIG.MODEL || 'Gemini Pro'}</span>
                            </div>
                            <p className="text-xs text-gray-400">LangChain + RAG Enhanced</p>
                        </div>
                        <div className="text-xs space-y-1">
                            <div className="flex justify-between text-gray-400">
                                <span>Temperature:</span>
                                <span>{CONFIG.TEMPERATURE || 0.7}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>Max Tokens:</span>
                                <span>{CONFIG.MAX_TOKENS || 2048}</span>
                            </div>
                            <div className="flex justify-between text-gray-400">
                                <span>RAG:</span>
                                <span>{CONFIG.RAG_ENABLED ? 'Enabled' : 'Disabled'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Features */}
                <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Features</h3>
                    <div className="space-y-2">
                        <div className="p-3 rounded-lg glass">
                            <p className="text-sm text-white">✨ Gemini AI Integration</p>
                        </div>
                        <div className="p-3 rounded-lg glass">
                            <p className="text-sm text-white">🔗 LangChain Processing</p>
                        </div>
                        <div className="p-3 rounded-lg glass">
                            <p className="text-sm text-white">📚 RAG Knowledge Base</p>
                        </div>
                        <div className="p-3 rounded-lg glass">
                            <p className="text-sm text-white">⛓️ Blockchain Verification</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Composer Component
const Composer = ({ onSend, disabled }) => {
    const [message, setMessage] = useState('');
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    
    const slashCommands = [
        { command: '/summarize', description: 'Get a summary of the conversation' },
        { command: '/wipe', description: 'Start data wiping process' },
        { command: '/verify', description: 'Verify wiping completion' },
        { command: '/blockchain', description: 'Check blockchain status' },
        { command: '/rag', description: 'Query knowledge base' },
        { command: '/clear', description: 'Clear conversation' },
    ];
    
    useEffect(() => {
        if (message.startsWith('/')) {
            setShowSlashMenu(true);
        } else {
            setShowSlashMenu(false);
        }
    }, [message]);
    
    const handleSend = async () => {
        if (message.trim() && !disabled && !isLoading) {
            setIsLoading(true);
            
            // Include file if selected
            const messageData = {
                text: message.trim(),
                file: selectedFile
            };
            
            await onSend(messageData);
            
            setMessage('');
            setSelectedFile(null);
            setShowSlashMenu(false);
            setIsLoading(false);
        }
    };
    
    const handleKeyDown = (e) => {
        // Press Enter to send message.
        // Use Shift+Enter to insert a newline.
        if (e.key === 'Enter') {
            // allow Shift+Enter to create a newline
            if (e.shiftKey) {
                return;
            }
            e.preventDefault();
            // guard against disabled/loading state
            if (!disabled && !isLoading) {
                handleSend();
            }
        }
    };
    
    const handleCommandSelect = (command) => {
        setMessage(command + ' ');
        setShowSlashMenu(false);
        textareaRef.current?.focus();
    };
    
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (file && CONFIG.ENABLE_FILE_UPLOAD) {
            setSelectedFile(file);
            if (CONFIG.DEBUG) {
                console.log('File selected:', file.name, file.type, file.size);
            }
        }
    };
    
    return (
        <div className="relative">
            {/* Slash Commands Menu */}
            {showSlashMenu && (
                <div className="absolute bottom-full mb-2 left-0 right-0 mx-4 glass-dark rounded-lg overflow-hidden">
                    {slashCommands
                        .filter(cmd => cmd.command.includes(message.toLowerCase()))
                        .map((cmd, index) => (
                            <button
                                key={index}
                                onClick={() => handleCommandSelect(cmd.command)}
                                className="w-full text-left px-4 py-3 hover:bg-white/10 transition-colors flex justify-between items-center"
                            >
                                <span className="text-purple-400 font-mono">{cmd.command}</span>
                                <span className="text-gray-400 text-sm">{cmd.description}</span>
                            </button>
                        ))}
                </div>
            )}
            
            {/* Selected File Preview */}
            {selectedFile && (
                <div className="mx-4 mb-2 p-2 glass rounded-lg flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate">
                        📎 {selectedFile.name}
                    </span>
                    <button
                        onClick={() => setSelectedFile(null)}
                        className="text-gray-400 hover:text-white ml-2"
                    >
                        <Icon name="close" className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            <div className="flex items-center space-x-2 p-4">
                {/* Attachment Button */}
                {CONFIG.ENABLE_FILE_UPLOAD && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                            accept=".txt,.pdf,.csv,.json,.log"
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="h-12 w-12 flex items-center justify-center rounded-lg glass hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            title="Attach file"
                        >
                            <Icon name="attachment" className="w-5 h-5" />
                        </button>
                    </>
                )}
                
                {/* Message Input */}
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message... (Use / for commands, Ctrl+Enter to send)"
                        className="w-full px-4 py-2 rounded-lg glass bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none min-h-[48px] max-h-[120px]"
                        rows="1"
                        style={{ minHeight: '48px', maxHeight: '120px' }}
                        disabled={disabled || isLoading}
                    />
                </div>
                
                {/* Emoji Button */}
                <button className="h-12 w-12 flex items-center justify-center rounded-lg glass hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                    <Icon name="emoji" className="w-5 h-5" />
                </button>
                
                {/* Send Button */}
                <button
                    onClick={handleSend}
                    disabled={!message.trim() || disabled || isLoading}
                    className={`h-12 w-12 flex items-center justify-center rounded-lg transition-all ${
                        message.trim() && !disabled && !isLoading
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 glow'
                            : 'glass text-gray-500'
                    }`}
                >
                    {isLoading ? (
                        <div className="spinner"></div>
                    ) : (
                        <Icon name="send" className="w-5 h-5" />
                    )}
                </button>
            </div>
        </div>
    );
};

// Main Chat Window Component
const ChatWindow = ({ conversationId }) => {
    const [messages, setMessages] = useState([
        { 
            id: 1, 
            content: `Welcome to Sayonara AI! 🚀 
            
I'm your intelligent assistant powered by **Gemini AI** with **LangChain** and **RAG** integration. I'm here to help you with secure data wiping and IT asset recycling.

Available commands:
- \`/wipe\` - Start data wiping process
- \`/verify\` - Verify wiping completion
- \`/blockchain\` - Check blockchain status
- \`/rag\` - Query knowledge base

How can I assist you today?`, 
            isUser: false, 
            timestamp: new Date().toISOString() 
        }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [error, setError] = useState(null);
    const [quickReplies] = useState([
        "Tell me about NIST 800-88 standards",
        "How does blockchain verification work?",
        "Start data wiping process",
        "Check RAG knowledge base"
    ]);
    const messagesEndRef = useRef(null);
    const { addMessage } = useContext(ChatContext);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    
    useEffect(scrollToBottom, [messages]);
    
    const handleSendMessage = async (messageData) => {
        const content = typeof messageData === 'string' ? messageData : messageData.text;
        
        // Add user message
        const userMessage = {
            id: Date.now(),
            content,
            isUser: true,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        addMessage(userMessage);
        
        // Clear any previous errors
        setError(null);
        
        // Handle slash commands
        if (content.startsWith('/')) {
            const command = content.split(' ')[0];
            switch(command) {
                case '/clear':
                    setMessages([messages[0]]);
                    return;
                case '/rag':
                    // Query RAG system
                    setIsTyping(true);
                    try {
                        const ragResponse = await api.queryRAG(content.substring(5));
                        setMessages(prev => [...prev, {
                            id: Date.now(),
                            content: ragResponse?.answer || 'RAG query completed.',
                            isUser: false,
                            timestamp: new Date().toISOString()
                        }]);
                    } catch (err) {
                        setError('RAG query failed. Please check your connection.');
                    }
                    setIsTyping(false);
                    return;
            }
        }
        
        // Show typing indicator
        setIsTyping(true);
        
        try {
            // Build chat history for context
            const chatHistory = messages.map(m => ({
                role: m.isUser ? "user" : "model",
                parts: [{ text: m.content }]
            }));
            
            // Stream the response
            const tempId = Date.now() + 1;
            let streamedContent = '';
            
            const cleanup = await api.streamMessage(
                conversationId, 
                content, 
                chatHistory,
                (chunk, done) => {
                    streamedContent = chunk;
                    if (!done) {
                        setMessages(prev => {
                            const existing = prev.find(m => m.id === tempId);
                            if (existing) {
                                return prev.map(m => m.id === tempId ? { ...m, content: chunk } : m);
                            } else {
                                return [...prev, { 
                                    id: tempId, 
                                    content: chunk, 
                                    isUser: false, 
                                    timestamp: new Date().toISOString() 
                                }];
                            }
                        });
                    } else {
                        setIsTyping(false);
                        const finalMessage = {
                            id: tempId,
                            content: chunk,
                            isUser: false,
                            timestamp: new Date().toISOString()
                        };
                        addMessage(finalMessage);
                    }
                },
                (error) => {
                    console.error('Stream error:', error);
                    setError('Failed to get response. Please check your API configuration.');
                    setIsTyping(false);
                }
            );
            
            // Store cleanup function if needed
            return cleanup;
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please check your connection and API configuration.');
            setIsTyping(false);
        }
    };
    
    const handleRetry = () => {
        const lastUserMessage = messages.filter(m => m.isUser).pop();
        if (lastUserMessage) {
            handleSendMessage(lastUserMessage.content);
        }
    };
    
    return (
        <div className="flex-1 flex flex-col h-full">
            {/* Header */}
            <div className="p-4 glass-dark border-b border-white/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            S
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Sayonara AI Assistant</h3>
                            <p className="text-xs text-gray-400 flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                Gemini + LangChain • RAG Enabled
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="p-2 rounded-lg glass hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <Icon name="refresh" className="w-5 h-5" />
                    </button>
                </div>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {messages.map(message => (
                    <Message key={message.id} message={message} isUser={message.isUser} />
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <TypingIndicator />
                    </div>
                )}
                {error && (
                    <ErrorMessage message={error} onRetry={handleRetry} />
                )}
                <div ref={messagesEndRef} />
            </div>
            
            {/* Quick Replies */}
            {messages.length === 1 && !error && (
                <QuickReplies replies={quickReplies} onSelect={handleSendMessage} />
            )}
            
            {/* Composer */}
            <Composer onSend={handleSendMessage} disabled={isTyping} />
        </div>
    );
};

// Main App Component
const App = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState('c1');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    
    useEffect(() => {
        // Load conversations
        api.getConversations().then(setConversations).catch(err => {
            console.error('Failed to load conversations:', err);
        });
        
        // Log configuration on mount
        if (CONFIG.DEBUG) {
            console.log('Sayonara Chatbot initialized');
            console.log('API Endpoint:', CONFIG.API_ENDPOINT);
            console.log('Model:', CONFIG.MODEL);
            console.log('Features:', {
                streaming: CONFIG.ENABLE_STREAMING,
                rag: CONFIG.RAG_ENABLED,
                fileUpload: CONFIG.ENABLE_FILE_UPLOAD
            });
        }
        
        // Keyboard shortcuts
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.querySelector('input[type="text"]')?.focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                // Create new chat
                const newConv = {
                    id: 'c' + Date.now(),
                    title: 'New Conversation',
                    lastMessage: '',
                    unread: 0,
                    updatedAt: new Date().toISOString()
                };
                setConversations(prev => [newConv, ...prev]);
                setSelectedConversation(newConv.id);
            }
            if (e.key === 'Escape') {
                setSidebarOpen(false);
                setRightPanelOpen(false);
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
    
    return (
        <ThemeProvider>
            <ChatProvider>
                <div className="h-screen flex relative">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass text-white"
                    >
                        <Icon name="menu" className="w-6 h-6" />
                    </button>
                    
                    {/* Settings Button */}
                    <button
                        onClick={() => setRightPanelOpen(!rightPanelOpen)}
                        className="fixed top-4 right-4 z-50 p-2 rounded-lg glass text-white lg:hidden"
                    >
                        <Icon name="settings" className="w-6 h-6" />
                    </button>
                    
                    {/* Sidebar */}
                    <Sidebar
                        conversations={conversations}
                        selectedId={selectedConversation}
                        onSelectConversation={setSelectedConversation}
                        isOpen={sidebarOpen}
                        onClose={() => setSidebarOpen(false)}
                    />
                    
                    {/* Main Chat Area */}
                    <div className="flex-1 flex">
                        <ChatWindow conversationId={selectedConversation} />
                    </div>
                    
                    {/* Right Panel */}
                    <RightPanel
                        isOpen={rightPanelOpen}
                        onClose={() => setRightPanelOpen(false)}
                    />
                    
                    {/* Overlay for mobile */}
                    {sidebarOpen && (
                        <div
                            className="lg:hidden fixed inset-0 bg-black/50 z-30"
                            onClick={() => {
                                setSidebarOpen(false);
                            }}
                        />
                    )}
                </div>
            </ChatProvider>
        </ThemeProvider>
    );
};

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));
