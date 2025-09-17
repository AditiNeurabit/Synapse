/**
 * ChatGPT Auto-Capture Content Script
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
   * Find the main chat container
   */
  findChatContainer() {
    // Try multiple selectors as ChatGPT's DOM structure may change
    const selectors = [
      'main[role="main"]', // Main chat container
      '[role="main"]',
      '.conversation-container',
      '#__next main',
      'div[class*="flex"][class*="flex-col"]' // ChatGPT's main flex container
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Verify it contains conversation turns
        const hasConversationTurns = element.querySelector('[data-testid*="conversation-turn"]') ||
                                   element.querySelector('[data-message-author-role]');
        if (hasConversationTurns) {
          return element;
        }
      }
    }

    // Fallback: look for elements containing messages
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    if (messageElements.length > 0) {
      return messageElements[0].closest('main') || messageElements[0].closest('div');
    }

    return null;
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
      attributes: false
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
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              try {
                const messages = this.extractMessagesFromElement(node);
                if (messages.length > 0) {
                  hasNewMessages = true;
                  this.currentMessages.push(...messages);
                }
              } catch (error) {
                console.log('Synapse: Error processing node:', error);
              }
            }
          });
        }
      });

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
    const chatContainer = this.findChatContainer();
    if (!chatContainer) return;

    const messages = this.extractMessagesFromElement(chatContainer);
    if (messages.length > 0) {
      this.currentMessages = messages;
      this.saveMessages();
    }
  }

  /**
   * Extract messages from a DOM element
   */
  extractMessagesFromElement(element) {
    const messages = [];
    
    // First, try to find conversation turn articles (ChatGPT's main structure)
    const conversationTurns = element.querySelectorAll('article[data-testid*="conversation-turn"]');
    
    if (conversationTurns.length > 0) {
      console.log(`Synapse: Found ${conversationTurns.length} conversation turns`);
      
      conversationTurns.forEach(turnElement => {
        const message = this.parseConversationTurn(turnElement);
        if (message && !this.processedMessages.has(message.id)) {
          messages.push(message);
          this.processedMessages.add(message.id);
        }
      });
      
      return messages;
    }
    
    // Fallback: Look for message elements with various selectors
    const messageSelectors = [
      '[data-message-author-role]',
      '[data-testid*="conversation-turn"]',
      '.group\\/conversation-turn',
      '[role="presentation"]',
      'div[class*="group"]', // ChatGPT groups messages
      'div[class*="conversation"]', // Conversation containers
      'div[class*="message"]', // Message containers
      'div[class*="w-full"]', // ChatGPT full-width containers
      'div[class*="text-base"]', // Text containers
      'div[class*="markdown"]' // Markdown containers
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      const elements = element.querySelectorAll(selector);
      if (elements.length > 0) {
        messageElements = elements;
        break;
      }
    }

    messageElements.forEach(msgElement => {
      const message = this.parseMessageElement(msgElement);
      if (message && !this.processedMessages.has(message.id)) {
        messages.push(message);
        this.processedMessages.add(message.id);
      }
    });

    return messages;
  }

  /**
   * Parse a ChatGPT conversation turn article element
   */
  parseConversationTurn(turnElement) {
    try {
      const testId = turnElement.getAttribute('data-testid') || '';
      const turnType = turnElement.getAttribute('data-turn') || '';
      
      // Determine role based on testid and turn type
      let role = 'unknown';
      if (testId.includes('conversation-turn-1') || testId.includes('conversation-turn-3') || turnType === 'user') {
        role = 'user';
      } else if (testId.includes('conversation-turn-2') || testId.includes('conversation-turn-4') || turnType === 'assistant') {
        role = 'assistant';
      }
      
      // Find the message content within the turn
      let text = '';
      let messageElement = null;
      
      // Look for the actual message content
      const messageSelectors = [
        '[data-message-author-role]',
        '.whitespace-pre-wrap',
        '.markdown',
        '.prose',
        'div[class*="text-message"]',
        'div[class*="markdown"]'
      ];
      
      for (const selector of messageSelectors) {
        const element = turnElement.querySelector(selector);
        if (element) {
          messageElement = element;
          text = element.textContent?.trim() || '';
          if (text && text.length > 3) {
            break;
          }
        }
      }
      
      // If no specific content found, try the turn element itself
      if (!text) {
        text = turnElement.textContent?.trim() || '';
      }
      
      // Clean up the text
      if (role === 'assistant' && text) {
        text = this.cleanChatGPTResponse(text);
      }
      
      // Skip if no meaningful content
      if (!text || text.length < 2) {
        return null;
      }
      
      // Additional validation
      if (this.isNotRealMessage(text, role)) {
        return null;
      }
      
      // Generate message ID
      const timestamp = new Date().toISOString();
      const id = `${role}_${timestamp}_${this.encodeText(text.substring(0, 50))}`;
      
      console.log(`Synapse: Parsed conversation turn - Role: ${role}, Text: "${text.substring(0, 50)}..."`);
      
      return {
        id,
        role,
        text,
        timestamp,
        url: window.location.href,
        messageType: role === 'assistant' ? 'chatgpt_response' : 'user_message',
        wordCount: text.split(' ').length,
        characterCount: text.length,
        hasCode: text.includes('```'),
        hasMarkdown: /[*_`#]/.test(text)
      };
      
    } catch (error) {
      console.error('Synapse: Error parsing conversation turn:', error);
      return null;
    }
  }

  /**
   * Parse a message element to extract text and role
   */
  parseMessageElement(element) {
    try {
      // First, check if this element should be filtered out as UI noise
      if (this.isUIElement(element)) {
        return null;
      }

      // Extract role
      let role = 'unknown';
      const roleAttr = element.getAttribute('data-message-author-role');
      if (roleAttr) {
        role = roleAttr === 'user' ? 'user' : 'assistant';
      } else {
        // Enhanced role detection for ChatGPT responses
        const textContent = element.textContent || '';
        
        // Enhanced role detection with better accuracy
        const isUserMessage = this.detectUserMessage(element, textContent);
        const isAssistantMessage = this.detectAssistantMessage(element, textContent);
        
        if (isUserMessage) {
          role = 'user';
        } else if (isAssistantMessage) {
          role = 'assistant';
        } else {
          // Fallback: analyze content patterns
          role = this.analyzeContentPatterns(textContent, element);
        }
      }

      // Extract text content with enhanced selectors for ChatGPT responses
      let text = '';
      const textSelectors = [
        '[data-message-content]',
        '.markdown',
        '.prose',
        'div[role="presentation"]',
        '.whitespace-pre-wrap',
        '.markdown-body'
      ];

      // Try specific selectors first for better content extraction
      for (const selector of textSelectors) {
        const textElement = element.querySelector(selector);
        if (textElement) {
          text = textElement.textContent?.trim() || '';
          if (text && text.length > 10) { // Ensure we have substantial content
            break;
          }
        }
      }

      // If no specific content found, try broader selectors but be more selective
      if (!text) {
        const broadSelectors = ['p', 'div'];
        for (const selector of broadSelectors) {
          const textElement = element.querySelector(selector);
          if (textElement) {
            const candidateText = textElement.textContent?.trim() || '';
            // Only use if it looks like actual message content
            if (candidateText && 
                candidateText.length > 10 && 
                !candidateText.includes('Upgrade to') &&
                !candidateText.includes('Temporary Chat') &&
                !candidateText.includes('window.__oai')) {
              text = candidateText;
              break;
            }
          }
        }
      }

      // Final fallback to element's text content
      if (!text) {
        text = element.textContent?.trim() || '';
      }

      // Clean up text for ChatGPT responses
      if (role === 'assistant' && text) {
        text = this.cleanChatGPTResponse(text);
      }

      // Skip empty messages, system messages, or messages that are too short
      if (!text || text.length < 3) {
        return null;
      }

      // Additional validation: skip messages that are likely not real conversation content
      if (this.isNotRealMessage(text, role)) {
        return null;
      }

      // Generate message ID for deduplication
      const timestamp = new Date().toISOString();
      const id = `${role}_${timestamp}_${this.encodeText(text.substring(0, 50))}`;

      return {
        id,
        role,
        text,
        timestamp,
        url: window.location.href
      };
    } catch (error) {
      console.error('Synapse: Error parsing message element:', error);
      return null;
    }
  }

  /**
   * Check if an element is a UI element that should be filtered out
   */
  isUIElement(element) {
    const textContent = element.textContent?.trim() || '';
    
    // Filter out very short text that's likely UI elements (but allow user inputs)
    if (textContent.length < 2) {
      return true;
    }
    
    // Filter out common UI button text
    const uiButtonTexts = [
      'Share', 'Copy', 'Edit', 'Delete', 'Save', 'Cancel', 'Submit', 'Send',
      'New Chat', 'Settings', 'Profile', 'Logout', 'Login', 'Sign Up',
      'Upgrade', 'Subscribe', 'Download', 'Upload', 'Refresh', 'Reload',
      'Back', 'Forward', 'Next', 'Previous', 'Close', 'Open', 'Menu',
      'Search', 'Filter', 'Sort', 'Export', 'Import', 'Help', 'About',
      'Feedback', 'Report', 'Flag', 'Like', 'Dislike', 'Rate', 'Review'
    ];
    
    if (uiButtonTexts.includes(textContent)) {
      return true;
    }
    
    // Filter out elements that are clearly UI components
    const uiSelectors = [
      'button', 'input', 'select', 'textarea', 'nav', 'header', 'footer',
      '[role="button"]', '[role="navigation"]', '[role="menuitem"]',
      '[data-testid*="button"]', '[data-testid*="menu"]', '[data-testid*="nav"]',
      'a[href]', '.button', '.btn', '.nav', '.menu', '.toolbar', '.header', '.footer'
    ];
    
    for (const selector of uiSelectors) {
      if (element.matches(selector) || element.closest(selector)) {
        return true;
      }
    }
    
    // Filter out elements with UI-like classes
    const className = element.className || '';
    const uiClassPatterns = [
      /button/i, /btn/i, /nav/i, /menu/i, /toolbar/i, /header/i, /footer/i,
      /sidebar/i, /panel/i, /modal/i, /popup/i, /dropdown/i, /tab/i,
      /icon/i, /logo/i, /brand/i, /link/i, /anchor/i
    ];
    
    if (uiClassPatterns.some(pattern => pattern.test(className))) {
      return true;
    }
    
    // Filter out elements that are likely navigation or controls
    if (element.tagName === 'A' || element.tagName === 'BUTTON' || 
        element.tagName === 'INPUT' || element.tagName === 'SELECT') {
      return true;
    }
    
    // Filter out elements with very specific UI text patterns
    const uiTextPatterns = [
      /^\d+$/, // Just numbers
      /^[A-Z\s]+$/, // All caps (likely labels)
      /^(Share|Copy|Edit|Delete|Save|Cancel|Submit|Send)$/i,
      /^(New Chat|Settings|Profile|Logout|Login|Sign Up)$/i,
      /^(Upgrade|Subscribe|Download|Upload|Refresh|Reload)$/i,
      /^(Back|Forward|Next|Previous|Close|Open|Menu)$/i,
      /^(Search|Filter|Sort|Export|Import|Help|About)$/i,
      /^(Feedback|Report|Flag|Like|Dislike|Rate|Review)$/i
    ];
    
    if (uiTextPatterns.some(pattern => pattern.test(textContent))) {
      return true;
    }
    
    // Filter out elements that are too small to be meaningful messages
    const rect = element.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 20) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if text content is likely not a real message
   */
  isNotRealMessage(text, role) {
    const cleanText = text.trim().toLowerCase();
    
    // Skip very short text that's likely UI noise (but allow short user inputs)
    if (cleanText.length < 2) {
      return true;
    }
    
    // Skip common UI text patterns
    const uiTextPatterns = [
      /^(share|copy|edit|delete|save|cancel|submit|send)$/i,
      /^(new chat|settings|profile|logout|login|sign up)$/i,
      /^(upgrade|subscribe|download|upload|refresh|reload)$/i,
      /^(back|forward|next|previous|close|open|menu)$/i,
      /^(search|filter|sort|export|import|help|about)$/i,
      /^(feedback|report|flag|like|dislike|rate|review)$/i,
      /^(loading|please wait|processing)$/i,
      /^(error|warning|success|info)$/i,
      /^(click|tap|press|enter)$/i,
      /^(yes|no|ok|cancel|confirm)$/i
    ];
    
    if (uiTextPatterns.some(pattern => pattern.test(cleanText))) {
      return true;
    }
    
    // Skip text that's mostly punctuation or symbols
    if (cleanText.match(/^[^\w\s]*$/)) {
      return true;
    }
    
    // Skip text that looks like system messages or metadata
    if (cleanText.includes('window.__') || 
        cleanText.includes('temporary chat') ||
        cleanText.includes('upgrade to') ||
        cleanText.includes('what\'s on your mind')) {
      return true;
    }
    
    // For user messages, be more permissive - allow short inputs, numbers, etc.
    if (role === 'user') {
      // Only filter out obvious UI elements, allow everything else
      return false;
    }
    
    // For assistant messages, be more strict about what constitutes a real response
    if (role === 'assistant') {
      // Skip if it's too short to be a meaningful response
      if (cleanText.length < 8) {
        return true;
      }
      
      // Skip if it doesn't contain actual conversational content
      const conversationalPatterns = [
        /\b(i|you|we|they|it|this|that|here|there|how|what|when|where|why|who)\b/i,
        /\b(can|could|would|should|will|shall|may|might)\b/i,
        /\b(help|assist|answer|explain|describe|tell|show|give)\b/i,
        /\b(thanks|thank you|please|sorry|excuse me)\b/i
      ];
      
      // If it's an assistant message but doesn't seem conversational, skip it
      if (!conversationalPatterns.some(pattern => pattern.test(cleanText))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detect if an element is a user message
   */
  detectUserMessage(element, textContent) {
    // Check for explicit user message indicators
    if (element.querySelector('[data-testid*="user"]') ||
        element.querySelector('[data-testid*="conversation-turn-1"]') ||
        element.querySelector('[data-testid*="conversation-turn-3"]')) {
      return true;
    }
    
    // Check for user input patterns
    if (element.querySelector('input') || element.querySelector('textarea')) {
      return true;
    }
    
    // Check for user message text patterns
    const userPatterns = [
      /^you\s/i, // Starts with "You"
      /^(hi|hello|hey|good morning|good afternoon|good evening)$/i,
      /^(thanks|thank you|please|sorry)$/i,
      /^(can you|could you|would you|will you)$/i,
      /^(what|how|when|where|why|who)\s/i,
      /^(i need|i want|i'm looking for|help me)$/i
    ];
    
    return userPatterns.some(pattern => pattern.test(textContent));
  }

  /**
   * Detect if an element is an assistant message
   */
  detectAssistantMessage(element, textContent) {
    // Check for explicit assistant message indicators
    if (element.querySelector('[data-testid*="assistant"]') ||
        element.querySelector('[data-testid*="conversation-turn-2"]') ||
        element.querySelector('[data-testid*="conversation-turn-4"]') ||
        element.querySelector('.markdown') ||
        element.querySelector('.prose') ||
        element.querySelector('[role="presentation"]') ||
        element.querySelector('div[class*="markdown"]') ||
        element.querySelector('div[class*="text-base"]') ||
        element.querySelector('div[class*="w-full"]')) {
      return true;
    }
    
    // Check for ChatGPT response patterns
    const assistantPatterns = [
      /^(i understand|i can help|here's|let me|based on|i'll|to answer|the answer)$/i,
      /^(in summary|to summarize|hey|hi|hello|great question|that's a good)$/i,
      /^(i'm doing|just hanging|what are you|how about|thanks for|you're welcome)$/i,
      /^(absolutely|sure thing|of course|i'd be happy|i'd be glad)$/i,
      /^(i can|i will|i would|i should|i could|i might|i may)$/i,
      /^(let's|we can|we'll|we should|we could)$/i
    ];
    
    return assistantPatterns.some(pattern => pattern.test(textContent)) || 
           this.isChatGPTResponse(element);
  }

  /**
   * Analyze content patterns to determine role
   */
  analyzeContentPatterns(textContent, element) {
    const cleanText = textContent.toLowerCase().trim();
    
    // If it's very short and doesn't contain conversational elements, likely user input
    // Be more permissive for user messages - allow short inputs, numbers, etc.
    if (cleanText.length < 30 && !cleanText.includes(' ')) {
      return 'user';
    }
    
    // If it's a very short message without complex structure, likely user input
    if (cleanText.length < 15 && !cleanText.includes('.') && !cleanText.includes(',')) {
      return 'user';
    }
    
    // Check for conversational markers
    const conversationalMarkers = {
      user: [
        /\b(you|your|yours)\b/i,
        /\b(can you|could you|would you|will you)\b/i,
        /\b(help me|tell me|show me|explain to me)\b/i,
        /\b(what|how|when|where|why|who)\s/i,
        /\b(i need|i want|i'm looking for|i'm trying)\b/i
      ],
      assistant: [
        /\b(i can|i will|i would|i should|i could|i might|i may)\b/i,
        /\b(here's|let me|based on|to answer|the answer is)\b/i,
        /\b(in summary|to summarize|in conclusion)\b/i,
        /\b(you can|you should|you could|you might)\b/i,
        /\b(we can|we'll|we should|we could)\b/i
      ]
    };
    
    const userScore = conversationalMarkers.user.reduce((score, pattern) => 
      score + (pattern.test(cleanText) ? 1 : 0), 0);
    const assistantScore = conversationalMarkers.assistant.reduce((score, pattern) => 
      score + (pattern.test(cleanText) ? 1 : 0), 0);
    
    if (userScore > assistantScore) {
      return 'user';
    } else if (assistantScore > userScore) {
      return 'assistant';
    }
    
    // Default fallback based on content length and structure
    if (cleanText.length > 50 && cleanText.includes('.')) {
      return 'assistant';
    } else {
      return 'user';
    }
  }

  /**
   * Check if an element is likely a ChatGPT response
   */
  isChatGPTResponse(element) {
    // Check for common ChatGPT response patterns
    const textContent = element.textContent || '';
    
    // Look for common ChatGPT response indicators
    const chatGPTIndicators = [
      'I understand',
      'I can help',
      'Here\'s',
      'Let me',
      'Based on',
      'I\'ll',
      'To answer',
      'The answer',
      'In summary',
      'To summarize',
      'Hey',
      'Hi',
      'Hello',
      'Great question',
      'That\'s a good',
      'I\'m doing',
      'Just hanging',
      'What are you',
      'How about',
      'Thanks for',
      'You\'re welcome',
      'Absolutely',
      'Sure thing',
      'Of course',
      'I\'d be happy'
    ];
    
    // Check if text starts with common ChatGPT patterns
    const startsWithPattern = chatGPTIndicators.some(pattern => 
      textContent.toLowerCase().startsWith(pattern.toLowerCase())
    );
    
    // Check for markdown formatting (common in ChatGPT responses)
    const hasMarkdown = element.querySelector('.markdown') || 
                       element.querySelector('.prose') ||
                       textContent.includes('**') ||
                       textContent.includes('*') ||
                       textContent.includes('```');
    
    // Check for code blocks or formatted content
    const hasCodeBlock = element.querySelector('pre') || 
                        element.querySelector('code') ||
                        textContent.includes('```');
    
    // Check for emoji usage (common in ChatGPT responses)
    const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(textContent);
    
    // Check for conversational patterns
    const hasConversationalPattern = /(I'm|I'll|I'd|I've|I can|I will|I would|I should|I could|I might|I may)/i.test(textContent);
    
    // Check if it's likely a response (not user input)
    const isLikelyResponse = !element.querySelector('input') && 
                           !element.querySelector('textarea') && 
                           !element.querySelector('button[type="submit"]') &&
                           textContent.length > 10;
    
    return startsWithPattern || hasMarkdown || hasCodeBlock || (hasEmoji && hasConversationalPattern) || isLikelyResponse;
  }

  /**
   * Safely encode text for use in IDs, handling Unicode characters
   */
  encodeText(text) {
    try {
      // First try btoa for Latin1 characters
      return btoa(text);
    } catch (error) {
      // If btoa fails due to Unicode characters, use a safer encoding
      try {
        // Convert to base64 using TextEncoder
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const binaryString = Array.from(data, byte => String.fromCharCode(byte)).join('');
        return btoa(binaryString);
      } catch (fallbackError) {
        // Ultimate fallback: create a simple hash
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          const char = text.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
      }
    }
  }

  /**
   * Clean up ChatGPT response text
   */
  cleanChatGPTResponse(text) {
    if (!text) return text;
    
    // Remove common UI artifacts and unwanted content
    let cleaned = text
      .replace(/^\s*ChatGPT\s*:?\s*/i, '') // Remove "ChatGPT:" prefix
      .replace(/^\s*Assistant\s*:?\s*/i, '') // Remove "Assistant:" prefix
      .replace(/Upgrade to GoChatGPT.*?What's on your mind today\?/gs, '') // Remove upgrade prompts
      .replace(/Temporary Chat.*?For safety purposes.*?30 days\./gs, '') // Remove temporary chat notices
      .replace(/window\.__oai_logHTML\?.*?window\.__oai_SSR_TTI.*?Date\.now\(\)\)\)/gs, '') // Remove JavaScript artifacts
      .replace(/What's on your mind today\?.*?Temporary Chat.*?30 days\./gs, '') // Remove repeated UI text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Remove empty lines at the beginning and end
    cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '');
    
    // Remove very short or meaningless content
    if (cleaned.length < 3 || cleaned.match(/^[^\w]*$/)) {
      return '';
    }
    
    return cleaned;
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
    console.log('Synapse: Setting up debug functions...');
    console.log('Synapse: synapseMemory available:', typeof window.synapseMemory !== 'undefined');
    
    window.synapseDebug = {
      listConversations: () => window.synapseMemory.listAllConversations(),
      getStorageInfo: () => window.synapseMemory.getStorageInfo(),
      clearAll: () => window.synapseMemory.clearAllConversations(),
      cleanupConversations: () => window.synapseMemory.cleanupConversations(),
      toggleCapture: (enabled) => this.setEnabled(enabled !== false),
      getCurrentMessages: () => this.currentMessages,
      getProcessedCount: () => this.processedMessages.size,
      forceSave: () => this.saveMessages(),
      testMessageDetection: () => this.testMessageDetection(),
      inspectDOMStructure: () => this.inspectDOMStructure(),
      getMessageStats: () => this.getMessageStats(),
      debugMessageParsing: (element) => this.debugMessageParsing(element),
      testFiltering: (text, role) => this.testFiltering(text, role),
      debugCurrentDOM: () => this.debugCurrentDOM()
    };

    console.log('Synapse: Debug functions available at window.synapseDebug');
    console.log('Synapse: synapseDebug object:', window.synapseDebug);
  }

  /**
   * Handle messages from popup
   */
  handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'toggleCapture':
        this.setEnabled(message.enabled);
        sendResponse({ success: true });
        break;
      case 'listConversations':
        window.synapseMemory.listAllConversations();
        sendResponse({ success: true });
        break;
      case 'clearAll':
        window.synapseMemory.clearAllConversations();
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  /**
   * Test message detection on current page
   */
  testMessageDetection() {
    console.log('Synapse: Testing message detection...');
    const chatContainer = this.findChatContainer();
    if (!chatContainer) {
      console.log('Synapse: No chat container found for testing');
      return { error: 'No chat container found' };
    }

    const messages = this.extractMessagesFromElement(chatContainer);
    const stats = {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      unknownMessages: messages.filter(m => m.role === 'unknown').length,
      messages: messages
    };

    console.log('Synapse: Message detection test results:', stats);
    return stats;
  }

  /**
   * Debug function to inspect DOM structure
   */
  inspectDOMStructure() {
    console.log('Synapse: Inspecting DOM structure...');
    const chatContainer = this.findChatContainer();
    if (!chatContainer) {
      console.log('Synapse: No chat container found');
      return { error: 'No chat container found' };
    }

    const allDivs = chatContainer.querySelectorAll('div');
    const potentialMessages = [];
    
    allDivs.forEach((div, index) => {
      const text = div.textContent?.trim();
      if (text && text.length > 5) {
        potentialMessages.push({
          index,
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          classes: div.className,
          attributes: Array.from(div.attributes).map(attr => `${attr.name}="${attr.value}"`),
          hasMarkdown: !!div.querySelector('.markdown'),
          hasProse: !!div.querySelector('.prose'),
          hasRole: div.getAttribute('role'),
          hasDataRole: div.getAttribute('data-message-author-role')
        });
      }
    });

    console.log('Synapse: Found potential message elements:', potentialMessages);
    return { chatContainer: chatContainer.tagName, potentialMessages };
  }

  /**
   * Get statistics about captured messages
   */
  getMessageStats() {
    const stats = {
      processedCount: this.processedMessages.size,
      currentMessagesCount: this.currentMessages.length,
      currentUserMessages: this.currentMessages.filter(m => m.role === 'user').length,
      currentAssistantMessages: this.currentMessages.filter(m => m.role === 'assistant').length,
      isEnabled: this.isEnabled,
      conversationId: this.conversationId
    };

    console.log('Synapse: Message statistics:', stats);
    return stats;
  }

  /**
   * Debug function to test message parsing on a specific element
   */
  debugMessageParsing(element) {
    console.log('Synapse: Debug parsing element:', element);
    
    const result = {
      element: element.tagName,
      textContent: element.textContent?.trim(),
      className: element.className,
      isUIElement: this.isUIElement(element),
      parsedMessage: this.parseMessageElement(element)
    };
    
    console.log('Synapse: Debug parsing result:', result);
    return result;
  }

  /**
   * Debug function to test filtering logic
   */
  testFiltering(text, role) {
    console.log(`Synapse: Testing filtering for "${text}" as ${role}`);
    
    const result = {
      text,
      role,
      isUIElement: this.isUIElement({ textContent: text }),
      isNotRealMessage: this.isNotRealMessage(text, role),
      shouldBeFiltered: this.isUIElement({ textContent: text }) || this.isNotRealMessage(text, role)
    };
    
    console.log('Synapse: Filtering test result:', result);
    return result;
  }

  /**
   * Debug function to inspect current ChatGPT DOM structure
   */
  debugCurrentDOM() {
    console.log('Synapse: Debugging current ChatGPT DOM structure...');
    
    const chatContainer = this.findChatContainer();
    if (!chatContainer) {
      console.log('Synapse: No chat container found');
      return { error: 'No chat container found' };
    }

    // Find all potential message elements
    const allElements = chatContainer.querySelectorAll('*');
    const potentialMessages = [];
    
    allElements.forEach((element, index) => {
      const text = element.textContent?.trim();
      if (text && text.length > 5 && text.length < 500) {
        // Check if this looks like a message
        const hasMessageIndicators = 
          element.querySelector('[data-message-author-role]') ||
          element.querySelector('.markdown') ||
          element.querySelector('.prose') ||
          element.querySelector('[data-testid*="conversation-turn"]') ||
          element.className.includes('message') ||
          element.className.includes('conversation') ||
          element.className.includes('markdown');
        
        if (hasMessageIndicators || text.includes('Heyyy') || text.includes('All good here')) {
          potentialMessages.push({
            index,
            tagName: element.tagName,
            className: element.className,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            hasDataRole: element.getAttribute('data-message-author-role'),
            hasTestId: element.getAttribute('data-testid'),
            hasTurn: element.getAttribute('data-turn'),
            hasMarkdown: !!element.querySelector('.markdown'),
            hasProse: !!element.querySelector('.prose'),
            parsedMessage: this.parseConversationTurn(element) || this.parseMessageElement(element)
          });
        }
      }
    });

    console.log('Synapse: Found potential message elements:', potentialMessages);
    return { 
      chatContainer: chatContainer.tagName, 
      potentialMessages,
      totalElements: allElements.length
    };
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
  window.synapseCapture = new ChatGPTCapture();
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (window.synapseCapture) {
      window.synapseCapture.handleMessage(message, sender, sendResponse);
    }
    return true; // Keep message channel open for async response
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (window.synapseCapture) {
      window.synapseCapture.destroy();
    }
  });
  
  // Fallback: Create debug functions if they don't exist
  setTimeout(() => {
    if (typeof window.synapseDebug === 'undefined' && window.synapseCapture) {
      console.log('Synapse: Creating fallback debug functions...');
      window.synapseDebug = {
        listConversations: () => window.synapseMemory.listAllConversations(),
        getStorageInfo: () => window.synapseMemory.getStorageInfo(),
        clearAll: () => window.synapseMemory.clearAllConversations(),
        cleanupConversations: () => window.synapseMemory.cleanupConversations(),
        toggleCapture: (enabled) => window.synapseCapture.setEnabled(enabled !== false),
        getCurrentMessages: () => window.synapseCapture.currentMessages,
        getProcessedCount: () => window.synapseCapture.processedMessages.size,
        forceSave: () => window.synapseCapture.saveMessages(),
        testMessageDetection: () => window.synapseCapture.testMessageDetection(),
        inspectDOMStructure: () => window.synapseCapture.inspectDOMStructure(),
        getMessageStats: () => window.synapseCapture.getMessageStats()
      };
      console.log('Synapse: Fallback debug functions created');
    }
  }, 2000);
}
