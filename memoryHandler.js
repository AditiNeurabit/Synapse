/**
 * Memory Handler for Synapse Auto-Capture
 * Handles storage operations for conversation data
 */

console.log('Synapse: Memory handler script starting to load...');

class MemoryHandler {
  constructor() {
    this.storageKey = 'synapse_conversations';
    this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit
  }

  /**
   * Generate a unique conversation ID based on URL and timestamp
   */
  generateConversationId() {
    const url = window.location.href;
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Extract conversation ID from ChatGPT URL if available
    const urlMatch = url.match(/\/c\/([a-f0-9-]+)/);
    if (urlMatch) {
      return `chatgpt_${urlMatch[1]}`;
    }
    
    // Fallback to timestamp-based ID
    return `chatgpt_${timestamp}_${this.encodeText(url).substring(0, 8)}`;
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(messageText, timestamp) {
    const textHash = this.encodeText(messageText).substring(0, 16);
    return `${timestamp}_${textHash}`;
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
   * Save or update a conversation
   */
  async saveConversation(conversationData) {
    try {
      const conversations = await this.getAllConversations();
      const conversationId = conversationData.conversationId;
      
      // Check if conversation already exists
      if (conversations[conversationId]) {
        // Merge messages, avoiding duplicates
        conversations[conversationId].messages = this.mergeMessages(
          conversations[conversationId].messages,
          conversationData.messages
        );
        conversations[conversationId].lastUpdated = new Date().toISOString();
      } else {
        conversations[conversationId] = {
          ...conversationData,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
      }

      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('Synapse: Chrome storage API not available, using localStorage fallback');
        this.saveToLocalStorage(conversations);
      } else {
        await chrome.storage.local.set({ [this.storageKey]: conversations });
      }
      
      console.log('Synapse: Conversation saved successfully');
      return true;
    } catch (error) {
      console.error('Synapse: Error saving conversation:', error);
      // Fallback to localStorage
      try {
        const conversations = await this.getAllConversations();
        this.saveToLocalStorage(conversations);
        return true;
      } catch (fallbackError) {
        console.error('Synapse: Fallback save also failed:', fallbackError);
        return false;
      }
    }
  }

  /**
   * Merge messages avoiding duplicates
   */
  mergeMessages(existingMessages, newMessages) {
    const messageMap = new Map();
    
    // Add existing messages to map
    existingMessages.forEach(msg => {
      const key = this.generateMessageId(msg.text, msg.timestamp);
      messageMap.set(key, msg);
    });
    
    // Add new messages, avoiding duplicates
    newMessages.forEach(msg => {
      const key = this.generateMessageId(msg.text, msg.timestamp);
      if (!messageMap.has(key)) {
        // Ensure message has proper structure
        const enhancedMessage = this.enhanceMessage(msg);
        messageMap.set(key, enhancedMessage);
      }
    });
    
    return Array.from(messageMap.values()).sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }

  /**
   * Enhance message with additional metadata
   */
  enhanceMessage(message) {
    return {
      ...message,
      messageType: message.role === 'assistant' ? 'chatgpt_response' : 'user_message',
      wordCount: message.text ? message.text.split(' ').length : 0,
      characterCount: message.text ? message.text.length : 0,
      hasCode: message.text ? message.text.includes('```') : false,
      hasMarkdown: message.text ? /[*_`#]/.test(message.text) : false
    };
  }

  /**
   * Get all conversations
   */
  async getAllConversations() {
    try {
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('Synapse: Chrome storage API not available, using localStorage fallback');
        return this.getFromLocalStorage();
      }
      
      const result = await chrome.storage.local.get([this.storageKey]);
      return result[this.storageKey] || {};
    } catch (error) {
      console.error('Synapse: Error retrieving conversations:', error);
      // Fallback to localStorage
      return this.getFromLocalStorage();
    }
  }

  /**
   * Get a specific conversation by ID
   */
  async getConversation(conversationId) {
    try {
      const conversations = await this.getAllConversations();
      return conversations[conversationId] || null;
    } catch (error) {
      console.error('Synapse: Error retrieving conversation:', error);
      return null;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId) {
    try {
      const conversations = await this.getAllConversations();
      delete conversations[conversationId];
      
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        this.saveToLocalStorage(conversations);
      } else {
        await chrome.storage.local.set({ [this.storageKey]: conversations });
      }
      
      console.log('Synapse: Conversation deleted successfully');
      return true;
    } catch (error) {
      console.error('Synapse: Error deleting conversation:', error);
      return false;
    }
  }

  /**
   * Clear all conversations
   */
  async clearAllConversations() {
    try {
      // Check if chrome.storage is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        localStorage.removeItem(this.storageKey);
      } else {
        await chrome.storage.local.remove([this.storageKey]);
      }
      
      console.log('Synapse: All conversations cleared');
      return true;
    } catch (error) {
      console.error('Synapse: Error clearing conversations:', error);
      return false;
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo() {
    try {
      const conversations = await this.getAllConversations();
      const totalSize = JSON.stringify(conversations).length;
      const conversationCount = Object.keys(conversations).length;
      
      return {
        totalSize,
        conversationCount,
        isNearLimit: totalSize > this.maxStorageSize * 0.8
      };
    } catch (error) {
      console.error('Synapse: Error getting storage info:', error);
      return { totalSize: 0, conversationCount: 0, isNearLimit: false };
    }
  }

  /**
   * Debug function to list all conversations
   */
  async listAllConversations() {
    try {
      const conversations = await this.getAllConversations();
      console.log('Synapse: All saved conversations:');
      console.table(conversations);
      return conversations;
    } catch (error) {
      console.error('Synapse: Error listing conversations:', error);
      return {};
    }
  }

  /**
   * Clean up existing conversations by removing UI artifacts
   */
  async cleanupConversations() {
    try {
      const conversations = await this.getAllConversations();
      let cleanedCount = 0;
      
      for (const [conversationId, conversation] of Object.entries(conversations)) {
        let hasChanges = false;
        
        conversation.messages = conversation.messages.map(message => {
          if (message.role === 'assistant' && message.text) {
            const originalText = message.text;
            const cleanedText = this.cleanMessageText(originalText);
            
            if (cleanedText !== originalText) {
              hasChanges = true;
              return {
                ...message,
                text: cleanedText,
                originalText: originalText // Keep original for reference
              };
            }
          }
          return message;
        });
        
        if (hasChanges) {
          conversations[conversationId] = conversation;
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        // Check if chrome.storage is available
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
          this.saveToLocalStorage(conversations);
        } else {
          await chrome.storage.local.set({ [this.storageKey]: conversations });
        }
        console.log(`Synapse: Cleaned up ${cleanedCount} conversations`);
      }
      
      return { cleanedCount, totalConversations: Object.keys(conversations).length };
    } catch (error) {
      console.error('Synapse: Error cleaning up conversations:', error);
      return { error: error.message };
    }
  }

  /**
   * Get data from localStorage as fallback
   */
  getFromLocalStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Synapse: Error reading from localStorage:', error);
      return {};
    }
  }

  /**
   * Save data to localStorage as fallback
   */
  saveToLocalStorage(conversations) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(conversations));
      console.log('Synapse: Data saved to localStorage');
    } catch (error) {
      console.error('Synapse: Error saving to localStorage:', error);
      throw error;
    }
  }

  /**
   * Clean message text (similar to cleanChatGPTResponse but for stored messages)
   */
  cleanMessageText(text) {
    if (!text) return text;
    
    let cleaned = text
      .replace(/^\s*ChatGPT\s*:?\s*/i, '')
      .replace(/^\s*Assistant\s*:?\s*/i, '')
      .replace(/Upgrade to GoChatGPT.*?What's on your mind today\?/gs, '')
      .replace(/Temporary Chat.*?For safety purposes.*?30 days\./gs, '')
      .replace(/window\.__oai_logHTML\?.*?window\.__oai_SSR_TTI.*?Date\.now\(\)\)\)/gs, '')
      .replace(/What's on your mind today\?.*?Temporary Chat.*?30 days\./gs, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '');
    
    if (cleaned.length < 3 || cleaned.match(/^[^\w]*$/)) {
      return '';
    }
    
    return cleaned;
  }
}

// Create global instance
console.log('Synapse: Memory handler script loaded');
window.synapseMemory = new MemoryHandler();
console.log('Synapse: Memory handler initialized');
