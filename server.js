// server.js - Sayonara Chatbot Backend Server
// Handles Gemini API integration with LangChain and RAG support

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ============================================================================
// CONFIGURATION
// ============================================================================

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables!');
    console.warn('Please create a .env file with: GEMINI_API_KEY=your_api_key_here');
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'demo-key');

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /txt|pdf|csv|json|log|md/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            return cb(null, true);
        } else {
            cb('Error: File type not supported');
        }
    }
});

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors({
    origin: '*', // In production, specify your frontend URL
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Session-Id']
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for production)
app.use(express.static('public'));

// ============================================================================
// RAG KNOWLEDGE BASE
// ============================================================================

const knowledgeBase = {
    "NIST 800-88": {
        content: `NIST 800-88 Rev.1 provides comprehensive guidelines for media sanitization. 
        It defines three types of sanitization: Clear (logical techniques), Purge (physical or logical 
        techniques that render data recovery infeasible), and Destroy (physical destruction of media).
        The Sayonara platform implements these standards with military-grade security.`,
        keywords: ["NIST", "standards", "sanitization", "security", "guidelines"]
    },
    "Blockchain Verification": {
        content: `Our blockchain verification system uses Ethereum's Sepolia testnet to create 
        tamper-proof certificates for each data wipe. Each certificate contains a cryptographic 
        hash of the wiping process, timestamp, device identifier, and verification status. 
        This provides immutable proof of compliance that can be audited by third parties.`,
        keywords: ["blockchain", "verification", "certificate", "ethereum", "sepolia", "proof"]
    },
    "Dual-Phase Sanitization": {
        content: `The dual-phase sanitization process first overwrites all sectors with random data 
        (Phase 1), then performs a cryptographic erasure using device-specific commands like 
        ATA Secure Erase or NVMe Sanitize (Phase 2). This ensures complete data destruction 
        even on modern SSDs with wear leveling and hidden areas.`,
        keywords: ["dual-phase", "sanitization", "overwrite", "secure", "erase", "SSD", "NVMe"]
    },
    "Data Wiping Process": {
        content: `The Sayonara data wiping process includes: 1) Device detection and identification, 
        2) Unlocking of hidden areas (HPA/DCO/OPAL), 3) Selection of appropriate wiping method, 
        4) Dual-phase sanitization execution, 5) Forensic recovery testing, 6) Re-wiping if needed, 
        7) Certificate generation and blockchain recording, 8) Resale value estimation.`,
        keywords: ["wiping", "process", "steps", "forensic", "recovery", "certificate"]
    },
    "Environmental Impact": {
        content: `Secure data wiping enables safe recycling and resale of IT assets, reducing e-waste 
        by up to 70%. Each properly wiped and recycled device saves approximately 24kg of CO₂ 
        emissions and prevents toxic materials from entering landfills. Our CSR dashboard tracks 
        and quantifies environmental impact metrics.`,
        keywords: ["environmental", "impact", "recycling", "e-waste", "CO2", "sustainability"]
    }
};

// RAG search function
function searchKnowledgeBase(query) {
    const queryLower = query.toLowerCase();
    const results = [];
    
    for (const [topic, data] of Object.entries(knowledgeBase)) {
        const relevanceScore = data.keywords.reduce((score, keyword) => {
            return score + (queryLower.includes(keyword.toLowerCase()) ? 1 : 0);
        }, 0);
        
        if (relevanceScore > 0 || queryLower.includes(topic.toLowerCase())) {
            results.push({
                topic,
                content: data.content,
                relevance: relevanceScore + (queryLower.includes(topic.toLowerCase()) ? 5 : 0)
            });
        }
    }
    
    return results.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const sessions = new Map();

function getOrCreateSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            id: sessionId,
            chatHistory: [],
            createdAt: new Date(),
            lastActivity: new Date()
        });
    }
    const session = sessions.get(sessionId);
    session.lastActivity = new Date();
    return session;
}

// Clean up old sessions periodically
setInterval(() => {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes
    
    for (const [id, session] of sessions.entries()) {
        if (now - session.lastActivity > timeout) {
            sessions.delete(id);
            console.log(`Session ${id} expired and removed`);
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

// ============================================================================
// GEMINI AI INTEGRATION
// ============================================================================

async function generateGeminiResponse(message, chatHistory = [], config = {}) {
    try {
        // Select model based on configuration
        const modelName = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Enhance prompt with RAG if enabled
        let enhancedPrompt = message;
        if (config.ragEnabled) {
            const ragResults = searchKnowledgeBase(message);
            if (ragResults.length > 0) {
                enhancedPrompt = `
Question: ${message}

Relevant Knowledge Base Information:
${ragResults.map(r => `${r.topic}: ${r.content}`).join('\n\n')}

Please provide a comprehensive answer using the above information and your knowledge about the Sayonara data wiping platform.
                `;
            }
        }
        
        // Add system context
        const systemPrompt = `You are the Sayonara AI Assistant, an expert in secure data wiping, 
        IT asset recycling, and blockchain verification. You help users understand and use the 
        Sayonara platform which provides NIST 800-88 compliant data sanitization with blockchain 
        certificates. Always be helpful, technical when needed, and emphasize security and compliance.`;
        
        // Prepare chat with history
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: config.maxTokens || 2048,
                temperature: config.temperature || 0.7,
                topP: 0.95,
                topK: 40,
            },
        });
        
        // Send message and get response
        const result = await chat.sendMessage(`${systemPrompt}\n\n${enhancedPrompt}`);
        const response = await result.response;
        
        return response.text();
    } catch (error) {
        console.error('Gemini API error:', error);
        
        // Fallback response if API fails
        if (error.message?.includes('API key')) {
            return `I'm currently unable to connect to the Gemini AI service. Please ensure your API key is configured correctly in the .env file. 

For now, I can tell you about the Sayonara platform: We provide military-grade data wiping with blockchain verification, ensuring your data is completely and verifiably erased before device recycling or resale.`;
        }
        
        throw error;
    }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        apiKeyConfigured: !!GEMINI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, chatHistory, conversationId, config } = req.body;
        const sessionId = req.headers['x-session-id'] || 'default';
        
        console.log(`[Chat] Session: ${sessionId}, Message: ${message.substring(0, 50)}...`);
        
        // Get or create session
        const session = getOrCreateSession(sessionId);
        
        // Add user message to session history
        session.chatHistory.push({
            role: 'user',
            parts: [{ text: message }]
        });
        
        // Generate response using Gemini
        const responseText = await generateGeminiResponse(
            message,
            chatHistory || session.chatHistory,
            config
        );
        
        // Add assistant response to session history
        session.chatHistory.push({
            role: 'model',
            parts: [{ text: responseText }]
        });
        
        // Send response
        res.json({
            messageId: Date.now(),
            text: responseText,
            content: responseText,
            response: responseText,
            done: true,
            metadata: {
                model: config?.model || 'gemini-pro',
                sessionId,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({
            error: 'Failed to generate response',
            message: error.message
        });
    }
});

// Streaming chat endpoint (using Server-Sent Events)
app.get('/api/chat/stream', async (req, res) => {
    const { message, conversationId, sessionId = 'default' } = req.query;
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    
    try {
        const session = getOrCreateSession(sessionId);
        
        // Generate response
        const responseText = await generateGeminiResponse(message, session.chatHistory);
        
        // Simulate streaming by sending words progressively
        const words = responseText.split(' ');
        let currentText = '';
        
        for (let i = 0; i < words.length; i++) {
            currentText += (i > 0 ? ' ' : '') + words[i];
            
            res.write(`data: ${JSON.stringify({
                content: currentText,
                done: i === words.length - 1
            })}\n\n`);
            
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        res.end();
    } catch (error) {
        console.error('Stream error:', error);
        res.write(`data: ${JSON.stringify({
            error: error.message,
            done: true
        })}\n\n`);
        res.end();
    }
});

// LangChain integration endpoint
app.post('/api/langchain', async (req, res) => {
    try {
        const { query, context, sessionId } = req.body;
        
        console.log(`[LangChain] Query: ${query}`);
        
        // Here you would integrate with LangChain
        // For now, we'll use Gemini with enhanced prompting
        const langchainPrompt = `
        Acting as a LangChain agent, process this query with the following context:
        
        Query: ${query}
        Context: ${JSON.stringify(context)}
        
        Provide a structured response with reasoning steps and a final answer.
        `;
        
        const response = await generateGeminiResponse(langchainPrompt, [], {
            temperature: 0.3, // Lower temperature for more structured responses
            maxTokens: 2048
        });
        
        res.json({
            answer: response,
            reasoning: "LangChain processing completed",
            sources: []
        });
        
    } catch (error) {
        console.error('LangChain error:', error);
        res.status(500).json({ error: error.message });
    }
});

// RAG endpoint
app.post('/api/rag', async (req, res) => {
    try {
        const { query } = req.body;
        
        console.log(`[RAG] Query: ${query}`);
        
        // Search knowledge base
        const results = searchKnowledgeBase(query);
        
        if (results.length === 0) {
            res.json({
                answer: "No relevant information found in the knowledge base.",
                sources: []
            });
            return;
        }
        
        // Generate answer using RAG results
        const ragPrompt = `
        Based on the following information from our knowledge base, answer this query: ${query}
        
        ${results.map(r => `${r.topic}: ${r.content}`).join('\n\n')}
        `;
        
        const answer = await generateGeminiResponse(ragPrompt, [], {
            temperature: 0.5,
            ragEnabled: false // Avoid recursive RAG
        });
        
        res.json({
            answer,
            sources: results.map(r => ({
                topic: r.topic,
                relevance: r.relevance
            }))
        });
        
    } catch (error) {
        console.error('RAG error:', error);
        res.status(500).json({ error: error.message });
    }
});

// File upload endpoint
app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
    try {
        const { sessionId } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        console.log(`[Upload] File: ${file.originalname}, Size: ${file.size} bytes`);
        
        // Read file content
        const content = await fs.readFile(file.path, 'utf-8');
        
        // Clean up uploaded file
        await fs.unlink(file.path);
        
        // Process file content (you could analyze it with Gemini)
        const analysis = await generateGeminiResponse(
            `Analyze this file content and provide a summary:\n\n${content.substring(0, 1000)}...`,
            [],
            { temperature: 0.3 }
        );
        
        res.json({
            filename: file.originalname,
            size: file.size,
            analysis,
            processed: true
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get conversations endpoint
app.get('/api/conversations', async (req, res) => {
    try {
        // In a real app, this would fetch from a database
        const conversations = [
            {
                id: 'c1',
                title: 'Data Wiping Setup',
                lastMessage: 'NIST 800-88 standards configured',
                unread: 0,
                updatedAt: new Date().toISOString()
            },
            {
                id: 'c2',
                title: 'Blockchain Integration',
                lastMessage: 'Certificates deployed successfully',
                unread: 1,
                updatedAt: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 'c3',
                title: 'RAG Configuration',
                lastMessage: 'Knowledge base updated with latest docs',
                unread: 2,
                updatedAt: new Date(Date.now() - 7200000).toISOString()
            }
        ];
        
        res.json(conversations);
    } catch (error) {
        console.error('Conversations error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║                                                       ║');
    console.log('║        SAYONARA CHATBOT SERVER v1.0                  ║');
    console.log('║        Powered by Gemini AI + LangChain              ║');
    console.log('║                                                       ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log('');
    
    if (!GEMINI_API_KEY) {
        console.log('⚠️  WARNING: No Gemini API key detected!');
        console.log('');
        console.log('To enable Gemini AI:');
        console.log('1. Get your API key from: https://makersuite.google.com/app/apikey');
        console.log('2. Create a .env file in your project root');
        console.log('3. Add: GEMINI_API_KEY=your_api_key_here');
        console.log('');
        console.log('The server will run in demo mode until configured.');
    } else {
        console.log('✅ Gemini API key configured');
        console.log('✅ RAG knowledge base loaded');
        console.log('✅ Ready to accept requests');
    }
    
    console.log('');
    console.log('Press Ctrl+C to stop the server');
});
