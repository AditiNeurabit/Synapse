/**
 * ChatGPT Auto-Capture Content Script - Fixed Version
 * Detects and captures conversation messages from ChatGPT
 */

console.log('Synapse: ChatGPT capture script starting to load...');

class ChatGPTCapture {
  constructor() {
    this.isEnabled = true;
    this.observer = null;
    this.processedMessages = new Set();
    this.lastProcessTime = 0;
    this.throttleDelay = 1000; // 1 second throttle
    this.conversationId = null;
    this.currentMessages = [];
    this.messageSequence = 0; // Add sequence counter for better deduplication
    
    this.init();
  }

  /**
   * Initialize the capture system
   */
  init() {
    console.log('Synapse: ChatGPT Auto-Capture initialized');
    
    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.startCapture());
    } else {
      this.startCapture();
    }

    // Add debug functions to window
    this.addDebugFunctions();
  }

  /**
   * Start capturing messages
   */
  startCapture() {
    if (!this.isEnabled) return;

    // Find the main chat container
    const chatContainer = this.findChatContainer();
    if (!chatContainer) {
      console.log('Synapse: Chat container not found, retrying in 2 seconds...');
      setTimeout(() => this.startCapture(), 2000);
      return;
    }

    console.log('Synapse: Chat container found, starting observer');
    this.setupMutationObserver(chatContainer);
    
    // Process any existing messages
    this.processExistingMessages();
  }

  /**
   * Find the main chat container - Updated for better detection
   */
  findChatContainer() {
    // Try multiple selectors as ChatGPT's DOM structure may change
    const selectors = [
      'main[class*="relative"]', // ChatGPT's main container
      'main',
      '[role="main"]',
      'div[class*="conversation"]',
      'div[class*="flex-1"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Verify it contains conversation content
        const hasMessages = element.querySelector('article') ||
                           element.querySelector('[data-testid*="conversation-turn"]') ||
                           element.querySelector('[data-message-author-role]') ||
                           element.textContent.includes('ChatGPT');
        if (hasMessages) {
          console.log(`Synapse: Found chat container with selector: ${selector}`);
          return element;
        }
      }
    }

    return document.body; // Fallback to body
  }

  /**
   * Setup MutationObserver to watch for new messages
   */
  setupMutationObserver(container) {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      this.throttledProcessMutations(mutations);
    });

    this.observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-testid', 'data-message-author-role']
    });
  }

  /**
   * Throttled processing of mutations
   */
  throttledProcessMutations(mutations) {
    const now = Date.now();
    if (now - this.lastProcessTime < this.throttleDelay) {
      return;
    }
    this.lastProcessTime = now;

    // Use requestIdleCallback for better performance
    if (window.requestIdleCallback) {
      requestIdleCallback(() => this.processMutations(mutations));
    } else {
      setTimeout(() => this.processMutations(mutations), 100);
    }
  }

  /**
   * Process DOM mutations to find new messages
   */
  processMutations(mutations) {
    if (!this.isEnabled) return;

    let hasNewMessages = false;

    try {
      // Check for new conversation turns
      const allTurns = document.querySelectorAll('article');
      const messages = this.extractMessagesFromTurns(allTurns);
      
      if (messages.length > 0) {
        // Filter out already processed messages
        const newMessages = messages.filter(msg => !this.processedMessages.has(msg.id));
        if (newMessages.length > 0) {
          hasNewMessages = true;
          this.currentMessages.push(...newMessages);
          newMessages.forEach(msg => this.processedMessages.add(msg.id));
        }
      }

      if (hasNewMessages) {
        this.saveMessages();
      }
    } catch (error) {
      console.log('Synapse: Error processing mutations:', error);
    }
  }

  /**
   * Process existing messages on page load
   */
  processExistingMessages() {
    const allTurns = document.querySelectorAll('article');
    const messages = this.extractMessagesFromTurns(allTurns);
    
    if (messages.length > 0) {
      this.currentMessages = messages;
      messages.forEach(msg => this.processedMessages.add(msg.id));
      this.saveMessages();
    }
  }

  /**
   * Extract messages from article elements (conversation turns)
   */
  extractMessagesFromTurns(turnElements) {
    const messages = [];
    
    turnElements.forEach((article, index) => {
      const message = this.parseArticleElement(article, index);
      if (message) {
        messages.push(message);
      }
    });
    
    return messages.sort((a, b) => a.sequence - b.sequence);
  }

  /**
   * Parse an article element to extract message data
   */
  parseArticleElement(article, index) {
    try {
      // Skip if this looks like UI noise
      const textContent = article.textContent?.trim() || '';
      if (textContent.length < 2) return null;
      
      // Filter out common UI elements
      if (this.isUIElement(article, textContent)) return null;

      // Determine role based on position and content
      let role = 'unknown';
      
      // Check for explicit role attributes first
      const roleElement = article.querySelector('[data-message-author-role]');
      if (roleElement) {
        role = roleElement.getAttribute('data-message-author-role') === 'user' ? 'user' : 'assistant';
        console.log(`Synapse: Found explicit role from DOM: ${role}`);
      } else {
        // Determine role by analyzing content and structure
        role = this.determineMessageRole(article, textContent, index);
        console.log(`Synapse: Determined role from content: ${role} (index: ${index})`);
      }

      // Skip if we couldn't determine role
      if (role === 'unknown') {
        console.log(`Synapse: Skipping message with unknown role:`, textContent.substring(0, 50));
        return null;
      }

      // Extract clean text content
      let cleanText = this.extractCleanText(article, role);
      if (!cleanText || cleanText.length < 2) {
        console.log(`Synapse: Skipping message with no clean text:`, textContent.substring(0, 50));
        return null;
      }

      // Skip obvious UI text
      if (this.isNotRealMessage(cleanText, role)) {
        console.log(`Synapse: Skipping message as UI text:`, cleanText.substring(0, 50));
        return null;
      }

      // Generate unique ID based on content and position
      const timestamp = new Date().toISOString();
      const sequence = this.messageSequence++;
      const contentHash = this.generateContentHash(cleanText);
      const id = `${role}_${sequence}_${contentHash}`;

      const message = {
        id,
        role,
        text: cleanText,
        timestamp,
        sequence,
        url: window.location.href,
        messageType: role === 'assistant' ? 'chatgpt_response' : 'user_message',
        wordCount: cleanText.split(' ').filter(word => word.length > 0).length,
        characterCount: cleanText.length,
        hasCode: cleanText.includes('```') || cleanText.includes('`'),
        hasMarkdown: /[*_`#\[\]]/.test(cleanText)
      };

      console.log(`Synapse: Parsed ${role} message:`, {
        id: message.id,
        preview: cleanText.substring(0, 50) + (cleanText.length > 50 ? '...' : ''),
        wordCount: message.wordCount,
        originalText: textContent.substring(0, 100)
      });

      return message;

    } catch (error) {
      console.error('Synapse: Error parsing article element:', error);
      return null;
    }
  }

  /**
   * Determine message role based on content and structure
   */
  determineMessageRole(article, textContent, index) {
    // First check for explicit role indicators in the DOM
    const roleFromDOM = this.getRoleFromDOM(article);
    if (roleFromDOM) {
      return roleFromDOM;
    }

    // Check for user patterns
    if (this.looksLikeUserMessage(textContent, article)) {
      return 'user';
    }

    // Check for assistant patterns
    if (this.looksLikeAssistantMessage(textContent, article)) {
      return 'assistant';
    }

    // Use improved alternating pattern based on conversation flow
    return this.determineRoleByPosition(article, textContent, index);
  }

  /**
   * Determine role by position in conversation flow
   */
  determineRoleByPosition(article, textContent, index) {
    // Get all articles to understand the conversation flow
    const allArticles = document.querySelectorAll('article');
    const currentIndex = Array.from(allArticles).indexOf(article);
    
    // Look for patterns in the conversation
    // Typically: user -> assistant -> user -> assistant
    // But ChatGPT might have multiple assistant messages in a row
    
    // Check if this looks like a continuation of previous assistant message
    if (currentIndex > 0) {
      const prevArticle = allArticles[currentIndex - 1];
      const prevText = prevArticle.textContent?.trim() || '';
      
      // If previous message was assistant and this is short, might be continuation
      if (this.looksLikeAssistantMessage(prevText, prevArticle) && 
          textContent.length < 100 && 
          !textContent.includes('?')) {
        return 'assistant';
      }
    }
    
    // Default alternating pattern, but start with user
    return currentIndex % 2 === 0 ? 'user' : 'assistant';
  }

  /**
   * Get role from DOM attributes and structure
   */
  getRoleFromDOM(article) {
    // Check for explicit role attributes
    const roleElement = article.querySelector('[data-message-author-role]');
    if (roleElement) {
      const role = roleElement.getAttribute('data-message-author-role');
      return role === 'user' ? 'user' : 'assistant';
    }

    // Check for other role indicators
    const roleIndicators = [
      '[data-author="user"]',
      '[data-author="assistant"]',
      '.user-message',
      '.assistant-message',
      '[class*="user"]',
      '[class*="assistant"]'
    ];

    for (const selector of roleIndicators) {
      const element = article.querySelector(selector);
      if (element) {
        if (selector.includes('user') || element.className.includes('user')) {
          return 'user';
        } else if (selector.includes('assistant') || element.className.includes('assistant')) {
          return 'assistant';
        }
      }
    }

    // Check for ChatGPT-specific indicators
    const chatgptIndicators = article.querySelectorAll('[class*="chatgpt"], [class*="gpt"], [class*="ai"]');
    if (chatgptIndicators.length > 0) {
      return 'assistant';
    }

    return null;
  }

  /**
   * Check if text looks like a user message
   */
  looksLikeUserMessage(text, element) {
    const lowerText = text.toLowerCase().trim();
    
    // Skip if empty or too short
    if (lowerText.length < 2) return false;
    
    // Check for explicit user indicators in DOM
    if (this.hasUserIndicators(element)) {
      return true;
    }

    // Very short messages are often user inputs (but not too short)
    if (lowerText.length < 50 && lowerText.length > 2 && 
        !lowerText.includes('.') && !lowerText.includes(',') && 
        !lowerText.includes('```') && !lowerText.includes('**')) {
      return true;
    }

    // Check for question patterns
    const questionPatterns = [
      /^(what|how|when|where|why|who|can you|could you|would you|will you)\b/i,
      /\?$/,
      /^(help|tell me|show me|explain|i need|i want|i'm looking for)/i,
      /^(please|can|could|would|will)\s/i,
      /^(i have|i'm having|i got|i received)/i
    ];

    if (questionPatterns.some(pattern => pattern.test(lowerText))) {
      return true;
    }

    // Check for command/request patterns
    const commandPatterns = [
      /^(write|create|make|build|generate|code|program|script)/i,
      /^(fix|solve|debug|error|problem|issue)/i,
      /^(translate|convert|change|modify|update)/i,
      /^(analyze|review|check|examine|look at)/i
    ];

    if (commandPatterns.some(pattern => pattern.test(lowerText))) {
      return true;
    }

    // Check for conversational patterns that are typically user
    const userPatterns = [
      /^(thanks|thank you|thx|appreciate)/i,
      /^(yes|no|ok|okay|sure|alright)/i,
      /^(i think|i believe|i feel|i guess)/i,
      /^(my|mine|i'm|i am|i have|i need)/i
    ];

    return userPatterns.some(pattern => pattern.test(lowerText));
  }

  /**
   * Check for user indicators in DOM structure
   */
  hasUserIndicators(element) {
    // Check for user-specific classes or attributes
    const userSelectors = [
      '[class*="user"]',
      '[class*="human"]',
      '[data-author="user"]',
      '[data-role="user"]',
      '.user-input',
      '.human-message'
    ];

    return userSelectors.some(selector => element.querySelector(selector) !== null);
  }

  /**
   * Check if text looks like an assistant message
   */
  looksLikeAssistantMessage(text, element) {
    const lowerText = text.toLowerCase().trim();
    
    // Skip if empty or too short
    if (lowerText.length < 2) return false;
    
    // Check for explicit assistant indicators in DOM
    if (this.hasAssistantIndicators(element)) {
      return true;
    }

    // Check for common assistant response patterns
    const assistantPatterns = [
      /^(i understand|i can help|here's|let me|based on|i'll|to answer)/i,
      /^(the expression is|it can't be|let me know)/i,
      /^(hey|hi|hello).*(how's it|what's)/i,
      /^(absolutely|sure|of course|i'd be happy)/i,
      /^(i'm|i am) (an ai|a language model|chatgpt)/i,
      /^(as an ai|as a language model)/i,
      /^(i don't have|i cannot|i'm not able)/i,
      /^(here is|here are|this is|these are)/i,
      /^(you can|you should|you might|you could)/i,
      /^(to help you|to assist you|to answer your)/i
    ];

    if (assistantPatterns.some(pattern => pattern.test(lowerText))) {
      return true;
    }

    // Check for markdown or code formatting (common in assistant responses)
    const hasFormatting = element.querySelector('code') || 
                         element.querySelector('pre') ||
                         element.querySelector('.markdown') ||
                         text.includes('**') ||
                         text.includes('```') ||
                         text.includes('`') ||
                         text.includes('*') ||
                         text.includes('#');

    // Long responses with formatting are likely assistant messages
    if (hasFormatting && lowerText.length > 20) {
      return true;
    }

    // Check for structured responses (lists, explanations)
    const hasStructure = text.includes('\n') || 
                        text.includes('1.') || 
                        text.includes('•') || 
                        text.includes('- ') ||
                        text.includes(':');

    if (hasStructure && lowerText.length > 30) {
      return true;
    }

    return false;
  }

  /**
   * Check for assistant indicators in DOM structure
   */
  hasAssistantIndicators(element) {
    // Check for assistant-specific classes or attributes
    const assistantSelectors = [
      '[class*="assistant"]',
      '[class*="ai"]',
      '[class*="chatgpt"]',
      '[class*="gpt"]',
      '[data-author="assistant"]',
      '[data-role="assistant"]',
      '.assistant-message',
      '.ai-message'
    ];

    return assistantSelectors.some(selector => element.querySelector(selector) !== null);
  }

  /**
   * Extract clean text from article element
   */
  extractCleanText(article, role) {
    // Try to find the main content area
    let textElement = article.querySelector('[data-message-content]') ||
                     article.querySelector('.markdown') ||
                     article.querySelector('.prose') ||
                     article;

    let text = textElement.textContent?.trim() || '';

    // Clean up the text based on role
    if (role === 'assistant') {
      text = this.cleanChatGPTResponse(text);
    } else if (role === 'user') {
      text = this.cleanUserMessage(text);
    }

    // Remove multiple spaces and normalize
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Clean up user message text
   */
  cleanUserMessage(text) {
    if (!text) return text;
    
    return text
      .replace(/^\s*You\s*said:\s*/i, '')  // Remove "You said:" prefix
      .replace(/^\s*said:\s*/i, '')         // Remove "said:" prefix
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Generate a content hash for deduplication
   */
  generateContentHash(text) {
    // Simple hash function for content
    let hash = 0;
    const cleanText = text.toLowerCase().trim();
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Check if element is UI noise
   */
  isUIElement(element, textContent) {
    // Filter very short text
    if (textContent.length < 2) return true;

    // Common UI text patterns
    const uiPatterns = [
      /^(copy|edit|share|delete|save|send)$/i,
      /^(new chat|settings|upgrade)$/i,
      /^chatgpt said:?$/i,
      /^you said:?$/i,
      /^\d+\/\d+$/,
      /^loading/i
    ];

    return uiPatterns.some(pattern => pattern.test(textContent.trim()));
  }

  /**
   * Check if text is not a real message
   */
  isNotRealMessage(text, role) {
    const cleanText = text.trim().toLowerCase();
    
    // Skip very short text
    if (cleanText.length < 2) return true;

    // Skip common UI artifacts
    const uiArtifacts = [
      'loading', 'thinking', 'typing',
      'new chat', 'upgrade to', 'temporary chat'
    ];

    // For user messages, be much less restrictive
    if (role === 'user') {
      // Only filter out obvious UI artifacts, not message prefixes
      // "you said:" is actually a legitimate user message prefix
      return uiArtifacts.some(artifact => cleanText.includes(artifact));
    }

    // For assistant messages, filter out message prefixes but be more careful
    const assistantArtifacts = [
      'chatgpt said:', 'said:', 
      'loading', 'thinking', 'typing',
      'new chat', 'upgrade to', 'temporary chat'
    ];
    
    return assistantArtifacts.some(artifact => cleanText.includes(artifact));
  }

  /**
   * Clean up ChatGPT response text
   */
  cleanChatGPTResponse(text) {
    if (!text) return text;
    
    return text
      .replace(/^\s*ChatGPT\s*said:\s*/i, '')
      .replace(/^\s*Assistant\s*:?\s*/i, '')
      .replace(/^\s*said:\s*/i, '')
      .replace(/Upgrade to.*?$/gs, '')
      .replace(/Temporary Chat.*?$/gs, '')
      .replace(/window\.__.*?$/gs, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Save messages to storage
   */
  async saveMessages() {
    if (!this.currentMessages.length) return;

    try {
      // Generate conversation ID if not exists
      if (!this.conversationId) {
        this.conversationId = window.synapseMemory.generateConversationId();
      }

      const conversationData = {
        conversationId: this.conversationId,
        timestamp: new Date().toISOString(),
        messages: [...this.currentMessages],
        url: window.location.href,
        title: document.title
      };

      const success = await window.synapseMemory.saveConversation(conversationData);
      if (success) {
        console.log(`Synapse: Saved ${this.currentMessages.length} messages`);
        
        // Send update to popup
        try {
          chrome.runtime.sendMessage({ action: 'updateStatus' });
        } catch (error) {
          // Ignore if popup is not open
        }
        
        this.currentMessages = []; // Clear after successful save
      }
    } catch (error) {
      console.error('Synapse: Error saving messages:', error);
    }
  }

  /**
   * Enable/disable capture
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (enabled) {
      console.log('Synapse: Auto-capture enabled');
      this.startCapture();
    } else {
      console.log('Synapse: Auto-capture disabled');
      if (this.observer) {
        this.observer.disconnect();
      }
    }
  }

  /**
   * Add debug functions to window object
   */
  addDebugFunctions() {
    window.synapseDebug = {
      listConversations: () => window.synapseMemory?.listAllConversations(),
      getStorageInfo: () => window.synapseMemory?.getStorageInfo(),
      clearAll: () => window.synapseMemory?.clearAllConversations(),
      toggleCapture: (enabled) => this.setEnabled(enabled !== false),
      getCurrentMessages: () => this.currentMessages,
      getProcessedCount: () => this.processedMessages.size,
      forceSave: () => this.saveMessages(),
      testMessageDetection: () => this.testMessageDetection(),
      debugMessageDetection: () => this.debugMessageDetection(),
      findUserMessagesByPattern: () => this.findUserMessagesByPattern(),
      getMessageStats: () => this.getMessageStats(),
      debugCurrentDOM: () => this.debugCurrentDOM()
    };

    console.log('Synapse: Debug functions available at window.synapseDebug');
  }

  /**
   * Test message detection
   */
  testMessageDetection() {
    const allTurns = document.querySelectorAll('article');
    const messages = this.extractMessagesFromTurns(allTurns);
    
    const stats = {
      totalArticles: allTurns.length,
      extractedMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      messages: messages
    };

    console.log('Synapse: Message detection test:', stats);
    
    // Log detailed analysis of each message
    messages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`, {
        role: msg.role,
        preview: msg.text.substring(0, 100) + (msg.text.length > 100 ? '...' : ''),
        wordCount: msg.wordCount,
        hasCode: msg.hasCode,
        hasMarkdown: msg.hasMarkdown
      });
    });
    
    return stats;
  }

  /**
   * Debug current DOM structure and message detection
   */
  debugMessageDetection() {
    const allTurns = document.querySelectorAll('article');
    console.log(`Synapse: Found ${allTurns.length} article elements`);
    
    allTurns.forEach((article, index) => {
      const textContent = article.textContent?.trim() || '';
      const roleFromDOM = this.getRoleFromDOM(article);
      const looksLikeUser = this.looksLikeUserMessage(textContent, article);
      const looksLikeAssistant = this.looksLikeAssistantMessage(textContent, article);
      const finalRole = this.determineMessageRole(article, textContent, index);
      
      console.log(`Article ${index + 1}:`, {
        textLength: textContent.length,
        preview: textContent.substring(0, 50) + '...',
        roleFromDOM,
        looksLikeUser,
        looksLikeAssistant,
        finalRole,
        hasDataRole: !!article.querySelector('[data-message-author-role]'),
        classes: Array.from(article.classList).join(' '),
        innerHTML: article.innerHTML.substring(0, 200) + '...'
      });
    });
  }

  /**
   * Find user messages using ChatGPT-specific patterns
   */
  findUserMessagesByPattern() {
    const userMessages = [];
    
    // Look for common ChatGPT user message patterns
    const userSelectors = [
      // Common ChatGPT user message containers
      '[data-message-author-role="user"]',
      '[class*="user-message"]',
      '[class*="human"]',
      // Look for input areas or user-specific containers
      'div[class*="user"]',
      'div[class*="human"]',
      // Look for messages that don't have ChatGPT-specific indicators
      'article:not([class*="assistant"]):not([class*="ai"]):not([class*="chatgpt"])'
    ];
    
    userSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        const text = element.textContent?.trim();
        if (text && text.length > 2 && !this.isUIElement(element, text)) {
          userMessages.push({
            element,
            text: text.substring(0, 100),
            selector,
            fullText: text
          });
        }
      });
    });
    
    console.log('Synapse: Found potential user messages:', userMessages);
    return userMessages;
  }

  /**
   * Get message statistics
   */
  getMessageStats() {
    return {
      processedCount: this.processedMessages.size,
      currentMessagesCount: this.currentMessages.length,
      isEnabled: this.isEnabled,
      conversationId: this.conversationId,
      messageSequence: this.messageSequence
    };
  }

  /**
   * Debug current DOM structure
   */
  debugCurrentDOM() {
    const articles = document.querySelectorAll('article');
    const articleInfo = Array.from(articles).map((article, index) => ({
      index,
      textLength: article.textContent?.length || 0,
      preview: article.textContent?.substring(0, 100) + '...' || '',
      hasCode: !!article.querySelector('code'),
      hasMarkdown: !!article.querySelector('.markdown')
    }));

    console.log('Synapse: Current DOM articles:', articleInfo);
    return { totalArticles: articles.length, articles: articleInfo };
  }

  /**
   * Handle messages from popup/extension
   */
  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggleCapture':
        this.setEnabled(message.enabled);
        sendResponse({ success: true });
        break;
      case 'getStats':
        sendResponse({ success: true, stats: this.getMessageStats() });
        break;
      case 'testDetection':
        sendResponse({ success: true, results: this.testMessageDetection() });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  /**
   * Cleanup on page unload
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.processedMessages.clear();
  }
}

// Initialize when script loads
console.log('Synapse: ChatGPT capture script loaded');
if (typeof window !== 'undefined') {
  console.log('Synapse: Window object available, initializing capture');
  
  // Wait for memory handler to be available
  const initCapture = () => {
    if (window.synapseMemory) {
      window.synapseCapture = new ChatGPTCapture();
      console.log('Synapse: Capture initialized successfully');
    } else {
      setTimeout(initCapture, 100);
    }
  };
  
  initCapture();
  
  // Listen for messages from popup
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (window.synapseCapture) {
        window.synapseCapture.handleMessage(message, sender, sendResponse);
      }
      return true;
    });
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.synapseCapture) {
      window.synapseCapture.destroy();
    }
  });
}