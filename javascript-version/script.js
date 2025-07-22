// Chatbot Application - Plain JavaScript Implementation
// Replicates all functionality from the React version

class ChatbotApp {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.messages = [];
    this.currentStep = 'welcome';
    this.isLoading = false;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.initializeLucideIcons();
    this.showWelcomeMessage();
    this.autoResizeTextarea();
  }

  // Initialize Lucide icons
  initializeLucideIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Generate unique session ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Bind event listeners
  bindEvents() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const modal = document.getElementById('orderModal');

    // Send message events
    sendBtn.addEventListener('click', () => this.handleSendMessage());
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Input validation and character count
    messageInput.addEventListener('input', () => {
      this.updateCharacterCount();
      this.toggleSendButton();
    });

    // Reload conversation
    reloadBtn.addEventListener('click', () => this.reloadConversation());

    // Modal close events
    closeModalBtn.addEventListener('click', () => this.hideModal());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.hideModal();
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('show')) {
        this.hideModal();
      }
    });
  }

  // Auto-resize textarea
  autoResizeTextarea() {
    const textarea = document.getElementById('messageInput');
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  }

  // Update character count display
  updateCharacterCount() {
    const messageInput = document.getElementById('messageInput');
    const charCount = document.querySelector('.char-count');
    const length = messageInput.value.length;
    charCount.textContent = `${length}/500`;
    
    if (length > 450) {
      charCount.style.color = 'hsl(var(--destructive))';
    } else if (length > 400) {
      charCount.style.color = 'hsl(var(--warning))';
    } else {
      charCount.style.color = 'hsl(var(--muted-foreground))';
    }
  }

  // Toggle send button based on input
  toggleSendButton() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const hasContent = messageInput.value.trim().length > 0;
    
    sendBtn.disabled = !hasContent || this.isLoading;
  }

  // Show welcome message with service options
  showWelcomeMessage() {
    const welcomeContent = `
      <div class="service-options">
        <div class="service-option" data-service="track-order">
          <i data-lucide="package-search" class="icon"></i>
          <div class="service-option-content">
            <h3>Track My Order</h3>
            <p>Check your order status and delivery information</p>
          </div>
        </div>
        <div class="service-option" data-service="returns">
          <i data-lucide="undo-2" class="icon"></i>
          <div class="service-option-content">
            <h3>Returns & Refunds</h3>
            <p>Start a return or check refund status</p>
          </div>
        </div>
        <div class="service-option" data-service="account">
          <i data-lucide="user-circle" class="icon"></i>
          <div class="service-option-content">
            <h3>Account Support</h3>
            <p>Password reset, profile updates, and account issues</p>
          </div>
        </div>
        <div class="service-option" data-service="general">
          <i data-lucide="help-circle" class="icon"></i>
          <div class="service-option-content">
            <h3>General Support</h3>
            <p>Product questions, shipping info, and other inquiries</p>
          </div>
        </div>
      </div>
    `;

    this.addMessage('bot', 'Hi! I\'m your KarjiStore assistant. How can I help you today?', welcomeContent);
    this.bindServiceOptions();
  }

  // Bind service option click events
  bindServiceOptions() {
    setTimeout(() => {
      const serviceOptions = document.querySelectorAll('.service-option');
      serviceOptions.forEach(option => {
        option.addEventListener('click', () => {
          const service = option.dataset.service;
          this.handleServiceSelection(service);
        });
      });
      this.initializeLucideIcons(); // Re-initialize icons for dynamically added content
    }, 100);
  }

  // Handle service selection
  handleServiceSelection(service) {
    const serviceMap = {
      'track-order': 'I\'d like to track my order',
      'returns': 'I need help with a return',
      'account': 'I need account support', 
      'general': 'I have a general question'
    };

    const userMessage = serviceMap[service];
    this.addMessage('user', userMessage);
    
    setTimeout(() => {
      switch (service) {
        case 'track-order':
          this.showOrderTrackingForm();
          break;
        case 'returns':
          this.addMessage('bot', 'I\'d be happy to help with your return. Please provide your order number and reason for return, and I\'ll guide you through the process.');
          break;
        case 'account':
          this.addMessage('bot', 'I can help with account issues. What specifically do you need assistance with? (password reset, profile updates, billing, etc.)');
          break;
        case 'general':
          this.addMessage('bot', 'I\'m here to help with any questions you have about KarjiStore. What would you like to know?');
          break;
      }
    }, 500);
  }

  // Show order tracking form
  showOrderTrackingForm() {
    const formContent = `
      <div class="order-form">
        <p>Please provide your order details to track your package:</p>
        <div class="form-group">
          <label for="trackEmail">Email Address</label>
          <input type="email" id="trackEmail" placeholder="Enter the email used for your order" required>
        </div>
        <div class="form-group">
          <label for="trackOrderId">Order ID</label>
          <input type="text" id="trackOrderId" placeholder="Enter your order number (e.g., ORD-2024-001)" required>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="chatApp.reloadConversation()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="chatApp.submitOrderTracking()">Track Order</button>
        </div>
      </div>
    `;

    this.addMessage('bot', 'Let me help you track your order.', formContent);
    this.currentStep = 'order-tracking';
    
    // Focus on first input
    setTimeout(() => {
      const firstInput = document.getElementById('trackEmail');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  // Submit order tracking request
  async submitOrderTracking() {
    const email = document.getElementById('trackEmail')?.value.trim();
    const orderId = document.getElementById('trackOrderId')?.value.trim();

    // Validation
    if (!email || !orderId) {
      this.showError('Please fill in both email and order ID fields.');
      return;
    }

    if (!this.isValidEmail(email)) {
      this.showError('Please enter a valid email address.');
      return;
    }

    this.setLoading(true);
    
    try {
      const response = await this.trackOrder(email, orderId);
      
      if (response.error) {
        this.showOrderNotFoundError(response.message, email, orderId);
      } else {
        this.showOrderSuccess(response);
      }
    } catch (error) {
      console.error('Order tracking error:', error);
      this.showError('Unable to track your order right now. Please try again in a few moments.');
    } finally {
      this.setLoading(false);
    }
  }

  // Track order API call
  async trackOrder(email, orderId) {
    const response = await fetch('/api/track-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, orderId }),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  // Show order tracking success
  showOrderSuccess(data) {
    const { order, timeline } = data;
    const orderDate = new Date(order.orderDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });

    const successContent = `
      <div class="order-details">
        <p><strong>Great news!</strong> I found your order. Here are the details:</p>
        <div style="margin: 16px 0; padding: 16px; background: hsl(var(--success) / 0.1); border-left: 4px solid hsl(var(--success)); border-radius: var(--radius);">
          <p><strong>Order:</strong> ${order.orderNumber}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Order Date:</strong> ${orderDate}</p>
          <p><strong>Customer:</strong> ${order.customer.name}</p>
        </div>
        <div style="margin-top: 16px;">
          <button type="button" class="btn btn-primary" onclick="chatApp.showOrderModal('${JSON.stringify(data).replace(/'/g, "\\'")}')">
            <i data-lucide="eye" class="icon"></i>
            View Progress Timeline
          </button>
        </div>
      </div>
    `;

    this.addMessage('bot', '', successContent);
    this.currentStep = 'order-found';
  }

  // Show order not found error
  showOrderNotFoundError(message, email, orderId) {
    const errorContent = `
      <div class="error-message">
        <p><strong>Order Not Found</strong></p>
        <p>${message}</p>
        <div class="error-actions">
          <button type="button" class="btn btn-secondary" onclick="chatApp.retryOrderTracking('${email}', '${orderId}')">
            <i data-lucide="refresh-cw" class="icon"></i>
            Try Again
          </button>
          <button type="button" class="btn btn-primary" onclick="chatApp.contactSupport()">
            <i data-lucide="mail" class="icon"></i>
            Contact Support
          </button>
        </div>
      </div>
    `;

    this.addMessage('bot', '', errorContent);
  }

  // Retry order tracking
  retryOrderTracking(email = '', orderId = '') {
    this.showOrderTrackingForm();
    
    // Pre-fill values if provided
    setTimeout(() => {
      if (email) {
        const emailInput = document.getElementById('trackEmail');
        if (emailInput) emailInput.value = email;
      }
      if (orderId) {
        const orderIdInput = document.getElementById('trackOrderId');
        if (orderIdInput) orderIdInput.value = orderId;
      }
    }, 100);
  }

  // Contact support
  contactSupport() {
    this.addMessage('bot', 'I\'ll connect you with our support team. You can reach us at:\n\n📧 support@karjistore.com\n📞 1-800-KARJI-STORE\n💬 Live chat available 24/7\n\nIs there anything else I can help you with in the meantime?');
  }

  // Show order modal with timeline
  showOrderModal(dataStr) {
    try {
      const data = JSON.parse(dataStr);
      const { order, timeline } = data;
      
      const orderDate = new Date(order.orderDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const modalContent = `
        <div class="order-details">
          <div class="order-summary">
            <div class="order-info">
              <h3>Order Information</h3>
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Order Date:</strong> ${orderDate}</p>
            </div>
            <div class="order-info">
              <h3>Customer Details</h3>
              <p><strong>Name:</strong> ${order.customer.name}</p>
              <p><strong>Email:</strong> ${order.customer.email}</p>
            </div>
          </div>

          <div class="timeline-header">
            <i data-lucide="clock" class="icon"></i>
            <h3>Order Progress</h3>
          </div>
          
          <div class="timeline">
            ${timeline.map((item, index) => `
              <div class="timeline-item ${item.isLatest ? 'latest' : ''}">
                <div class="timeline-content">
                  <div class="timeline-status">${item.status}</div>
                  <div class="timeline-date">${new Date(item.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('modalBody').innerHTML = modalContent;
      document.getElementById('orderModal').classList.add('show');
      this.initializeLucideIcons();
      
    } catch (error) {
      console.error('Error showing order modal:', error);
      this.showError('Unable to display order details. Please try again.');
    }
  }

  // Hide modal
  hideModal() {
    document.getElementById('orderModal').classList.remove('show');
  }

  // Handle send message
  async handleSendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message || this.isLoading) return;

    // Add user message
    this.addMessage('user', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';
    this.updateCharacterCount();
    this.toggleSendButton();

    // Simulate typing delay
    this.setLoading(true);
    
    setTimeout(() => {
      // Simple response logic based on message content
      this.generateBotResponse(message);
      this.setLoading(false);
    }, 1000);
  }

  // Generate bot response based on user message
  generateBotResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('track') || lowerMessage.includes('order')) {
      this.showOrderTrackingForm();
    } else if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
      this.addMessage('bot', 'I\'d be happy to help with your return. Please provide your order number and reason for return, and I\'ll guide you through the process.');
    } else if (lowerMessage.includes('account') || lowerMessage.includes('password')) {
      this.addMessage('bot', 'I can help with account issues. What specifically do you need assistance with? (password reset, profile updates, billing, etc.)');
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      this.addMessage('bot', 'Hello! How can I assist you today? I can help with order tracking, returns, account support, or general questions.');
    } else {
      this.addMessage('bot', 'Thank you for your message. I\'m here to help with order tracking, returns, account issues, and general support. What would you like assistance with?');
    }
  }

  // Add message to chat
  addMessage(sender, text, htmlContent = '') {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageId = 'msg_' + Date.now();
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}`;
    messageElement.id = messageId;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'bot' ? '<i data-lucide="bot" class="icon"></i>' : '<i data-lucide="user" class="icon"></i>';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    if (text) {
      const textLines = text.split('\n').map(line => line.trim()).filter(line => line);
      textLines.forEach((line, index) => {
        if (index > 0) content.appendChild(document.createElement('br'));
        content.appendChild(document.createTextNode(line));
      });
    }
    
    if (htmlContent) {
      const htmlDiv = document.createElement('div');
      htmlDiv.innerHTML = htmlContent;
      content.appendChild(htmlDiv);
    }
    
    messageElement.appendChild(avatar);
    messageElement.appendChild(content);
    messagesContainer.appendChild(messageElement);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Initialize Lucide icons for new content
    this.initializeLucideIcons();
    
    // Store message
    this.messages.push({
      id: messageId,
      sender,
      text,
      htmlContent,
      timestamp: new Date()
    });
  }

  // Set loading state
  setLoading(loading) {
    this.isLoading = loading;
    const sendBtn = document.getElementById('sendBtn');
    
    if (loading) {
      this.addMessage('bot', '', '<div class="loading"><div class="spinner"></div>Typing...</div>');
      sendBtn.disabled = true;
    } else {
      // Remove loading message
      const loadingMessages = document.querySelectorAll('.loading');
      loadingMessages.forEach(loading => {
        const messageElement = loading.closest('.message');
        if (messageElement) messageElement.remove();
      });
    }
    
    this.toggleSendButton();
  }

  // Show error message
  showError(message) {
    const errorContent = `
      <div class="error-message">
        <p>${message}</p>
      </div>
    `;
    this.addMessage('bot', '', errorContent);
  }

  // Reload conversation
  reloadConversation() {
    const confirmed = confirm('Are you sure you want to start a new conversation? This will clear all messages.');
    
    if (confirmed) {
      this.sessionId = this.generateSessionId();
      this.messages = [];
      this.currentStep = 'welcome';
      
      // Clear messages container
      const messagesContainer = document.getElementById('messagesContainer');
      messagesContainer.innerHTML = '';
      
      // Clear input
      const messageInput = document.getElementById('messageInput');
      messageInput.value = '';
      messageInput.style.height = 'auto';
      this.updateCharacterCount();
      this.toggleSendButton();
      
      // Hide modal if open
      this.hideModal();
      
      // Show welcome message again
      setTimeout(() => {
        this.showWelcomeMessage();
      }, 100);
    }
  }

  // Email validation helper
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.chatApp = new ChatbotApp();
});

// Global functions for onclick handlers
window.chatApp = null;