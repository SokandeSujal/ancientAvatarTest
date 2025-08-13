class ChatInterface {
    constructor() {
        this.sessionId = null;
        this.apiUrl = 'https://automation.blocksdna.tech/webhook/07ee8bdd-bd72-4795-93ae-2787ac558a2d/chat';
        this.isLoading = false;
        
        this.initializeElements();
        this.bindEvents();
        this.generateNewSession();
    }

    initializeElements() {
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.newSessionBtn = document.getElementById('newSessionBtn');
        this.sessionDisplay = document.getElementById('sessionDisplay');
        this.chatMessages = document.getElementById('chatMessages');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.errorToast = document.getElementById('errorToast');
        this.errorMessage = document.getElementById('errorMessage');
        this.closeError = document.getElementById('closeError');
        this.charCount = document.getElementById('charCount');
    }

    bindEvents() {
        // Send message events
        this.sendBtn.addEventListener('click', () => this.handleSend());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Input events
        this.messageInput.addEventListener('input', () => this.handleInputChange());
        this.messageInput.addEventListener('input', () => this.autoResize());

        // Session events
        this.newSessionBtn.addEventListener('click', () => this.generateNewSession());

        // Error toast
        this.closeError.addEventListener('click', () => this.hideError());

        // Auto-hide error after 5 seconds
        let errorTimeout;
        const originalShowError = this.showError.bind(this);
        this.showError = (message) => {
            originalShowError(message);
            clearTimeout(errorTimeout);
            errorTimeout = setTimeout(() => this.hideError(), 5000);
        };
    }

    generateNewSession() {
        this.sessionId = this.generateUUID();
        this.sessionDisplay.textContent = this.sessionId.substring(0, 8) + '...';
        this.sessionDisplay.title = this.sessionId;
        this.clearChat();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    clearChat() {
        this.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-comments"></i>
                </div>
                <h2>Welcome to AI Assistant</h2>
                <p>Start a conversation by typing your message below. Your session will be automatically created.</p>
            </div>
        `;
    }

    handleInputChange() {
        const value = this.messageInput.value.trim();
        const charLength = this.messageInput.value.length;
        
        this.sendBtn.disabled = !value || this.isLoading;
        this.charCount.textContent = charLength;
        
        // Color code character count
        if (charLength > 900) {
            this.charCount.style.color = '#dc2626';
        } else if (charLength > 700) {
            this.charCount.style.color = '#f59e0b';
        } else {
            this.charCount.style.color = '#9ca3af';
        }
    }

    autoResize() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    async handleSend() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        // Remove welcome message if it exists
        const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        // Add user message
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.handleInputChange();
        this.autoResize();

        // Show loading
        this.setLoading(true);

        try {
            const response = await this.sendToAPI(message);
            this.addMessage(response.output, 'assistant');
        } catch (error) {
            console.error('Error:', error);
            this.showError('Failed to send message. Please try again.');
            // Add error message to chat
            this.addMessage('Sorry, I encountered an error while processing your request. Please try again.', 'assistant', true);
        } finally {
            this.setLoading(false);
        }
    }

    async sendToAPI(message) {
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sessionId: this.sessionId,
                chatInput: message
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    addMessage(content, sender, isError = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (isError) {
            messageContent.style.background = '#fee2e2';
            messageContent.style.color = '#dc2626';
            messageContent.style.border = '1px solid #fca5a5';
        }

        // Process content for formatting and images
        const processedContent = this.processMessageContent(content);
        messageContent.innerHTML = processedContent;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString();

        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(messageTime);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    processMessageContent(content) {
        // Convert markdown-like formatting to HTML
        let processed = content;
        
        // Convert **bold** to <strong>
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert *italic* to <em>
        processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Convert line breaks to <br> but preserve paragraph structure
        processed = processed.replace(/\n\n/g, '</p><p>');
        processed = processed.replace(/\n/g, '<br>');
        
        // Wrap in paragraphs if not already wrapped
        if (!processed.includes('<p>')) {
            processed = `<p>${processed}</p>`;
        }
        
        // Process bullet points
        processed = processed.replace(/^- (.*?)(?=<br>|$)/gm, '<li>$1</li>');
        processed = processed.replace(/(<li>.*?<\/li>)/gs, '<ul>$1</ul>');
        
        // Process images - look for markdown image syntax or direct image URLs
        processed = processed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
            return this.createImageHTML(url, alt);
        });
        
        // Also catch standalone image URLs
        processed = processed.replace(/(https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg))/gi, (match, url) => {
            return this.createImageHTML(url, 'Image');
        });

        return processed;
    }

    createImageHTML(url, alt = 'Image') {
        const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Create image container with loading state
        setTimeout(() => {
            const img = document.getElementById(imageId);
            if (img) {
                const actualImg = new Image();
                actualImg.onload = () => {
                    img.innerHTML = `<img src="${url}" alt="${alt}" loading="lazy">`;
                };
                actualImg.onerror = () => {
                    img.innerHTML = `<div class="image-error"><i class="fas fa-exclamation-triangle"></i> Failed to load image</div>`;
                };
                actualImg.src = url;
            }
        }, 100);

        return `
            <div class="message-image" id="${imageId}">
                <div class="image-loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading image...
                </div>
            </div>
        `;
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading || !this.messageInput.value.trim();
        
        if (loading) {
            this.loadingIndicator.classList.remove('hidden');
        } else {
            this.loadingIndicator.classList.add('hidden');
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorToast.classList.remove('hidden');
    }

    hideError() {
        this.errorToast.classList.add('hidden');
    }
}

// Initialize the chat interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatInterface();
});