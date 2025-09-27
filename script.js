const API_URL = "http://localhost:3000/api/chat";

const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `p-4 rounded-xl max-w-[80%] break-words ${isUser ? 'chat-message-user ml-auto' : 'chat-message-bot mr-auto'}`;
    messageDiv.innerHTML = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = '';
    userInput.disabled = true;
    sendButton.disabled = true;

    const loadingMessage = document.createElement('div');
    loadingMessage.className = `p-4 rounded-xl max-w-[80%] break-words chat-message-bot mr-auto`;
    loadingMessage.innerHTML = `<div class="flex space-x-1">
        <span class="w-2 h-2 bg-gray-500 rounded-full loading-dot"></span>
        <span class="w-2 h-2 bg-gray-500 rounded-full loading-dot"></span>
        <span class="w-2 h-2 bg-gray-500 rounded-full loading-dot"></span>
    </div>`;
    chatContainer.appendChild(loadingMessage);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const result = await response.json();
        const botResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from the model.';

        loadingMessage.innerHTML = botResponse;

    } catch (error) {
        console.error('Error:', error);
        loadingMessage.innerText = 'An error occurred. Please try again.';
    } finally {
        userInput.disabled = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        sendMessage();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    addMessage("Hello! I am the Sayonara AI Assistant. The app is now set up with a secure backend. What would you like to know about the 'Sayonara' project?");
});
