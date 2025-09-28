# 🚀 Sayonara AI Chatbot - Gemini + LangChain Integration

A modern, feature-rich chatbot frontend with Gemini AI and LangChain integration for the Sayonara data wiping platform.

![Sayonara Chatbot](https://img.shields.io/badge/Powered%20by-Gemini%20AI-blue)
![LangChain](https://img.shields.io/badge/Enhanced%20with-LangChain-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- **🤖 Gemini AI Integration** - Powered by Google's Gemini Pro model
- **🔗 LangChain Support** - Enhanced reasoning and chain-of-thought processing  
- **📚 RAG System** - Retrieval Augmented Generation with knowledge base
- **⚡ Real-time Streaming** - Server-sent events for streaming responses
- **🎨 Beautiful UI** - Glassmorphism effects, gradients, and animations
- **🌓 Dark/Light Mode** - Persistent theme switching
- **📱 Responsive Design** - Mobile-first with desktop optimization
- **⌨️ Keyboard Shortcuts** - Ctrl+K search, Ctrl+Enter send, etc.
- **💬 Slash Commands** - `/wipe`, `/verify`, `/blockchain`, `/rag`
- **📎 File Upload** - Support for documents and logs
- **🔐 Session Management** - Persistent chat history

## 📋 Prerequisites

- Node.js 14+ and npm
- Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))
- Modern web browser (Chrome, Firefox, Edge, Safari)

## 🛠️ Installation

### 1. Clone or Download the Project

```bash
# If you have the files, navigate to the directory
cd [directory]
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy the example env file
copy .env.example .env

# Edit .env file and add your Gemini API key
notepad .env
```

Add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### 4. Start the Backend Server

```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║        SAYONARA CHATBOT SERVER v1.0                  ║
║        Powered by Gemini AI + LangChain              ║
╚═══════════════════════════════════════════════════════╝

🚀 Server running on http://localhost:3001
✅ Gemini API key configured
✅ RAG knowledge base loaded
✅ Ready to accept requests
```

## 🎮 Usage

### Slash Commands

- `/wipe` - Start data wiping process
- `/verify` - Verify wiping completion  
- `/blockchain` - Check blockchain status
- `/rag` - Query knowledge base
- `/clear` - Clear conversation
- `/summarize` - Get conversation summary

### Keyboard Shortcuts

- `Ctrl + K` - Focus search
- `Ctrl + Enter` - Send message
- `Ctrl + N` - New chat
- `Esc` - Close panels

### API Endpoints

- `POST /api/chat` - Send message and get response
- `GET /api/chat/stream` - Stream response using SSE
- `POST /api/langchain` - LangChain processing
- `POST /api/rag` - RAG knowledge base query
- `POST /api/chat/upload` - File upload
- `GET /api/conversations` - Get conversation list
- `GET /health` - Health check

## 🐛 Troubleshooting

### Server won't start
- Check if port 3001 is available
- Ensure Node.js is installed: `node --version`
- Verify dependencies: `npm install`

### No AI responses
- Check your Gemini API key in `.env`
- Verify server is running: `http://localhost:3001/health`
- Check browser console for errors (F12)

### CORS errors
- Make sure server is running before opening frontend
- Use `http://localhost:3001` instead of file:// for production

### Streaming not working
- Check if your browser supports Server-Sent Events
- Fallback to regular requests will activate automatically

## 🚀 Deployment

### Local Network Access
```bash
# Find your IP address
ipconfig

# Access from other devices
http://YOUR_IP:3001
```

### Production Deployment
1. Set `DEBUG=false` in `.env`
2. Configure proper CORS origins
3. Use environment variables for sensitive data
4. Set up HTTPS with SSL certificates
5. Use PM2 or similar for process management

## 📚 Knowledge Base Topics

The RAG system includes information about:
- NIST 800-88 Standards
- Blockchain Verification
- Dual-Phase Sanitization
- Data Wiping Process
- Environmental Impact

## 🤝 Contributing

Feel free to enhance the chatbot with:
- Additional slash commands
- More knowledge base entries
- Custom UI themes
- Voice input/output
- Multi-language support

## 📄 License

MIT License - Team Sayonara

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs in the console
3. Enable DEBUG mode for detailed logging
4. Contact Team Sayonara

---

**Happy Chatting! 🎉**

Built with ❤️ for Smart India Hackathon 2025
