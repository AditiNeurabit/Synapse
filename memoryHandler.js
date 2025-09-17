/**
 * Memory Handler for Synapse Auto-Capture - Fixed Version
 * Handles storage operations for conversation data
 */

console.log('Synapse: Memory handler script starting to load...');

class MemoryHandler {
  constructor() {
    this.storageKey = 'synapse_conversations';
    this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit
    this.isReady = false;
    this.init();
  }

  /**
   * Initialize the memory handler
   */
  async init() {
    try {
      // Test if chrome.storage is available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        this.storageType = 'chrome';
        console.log('Synapse: Using Chrome storage API');
      } else {
        this.storageType = 'localStorage';
        console.log('Synapse: Using localStorage fallback');
      }
      
      this.isReady = true;
      console.log('Synapse: Memory handler initialized successfully');
    } catch (error) {
      console.error('Synapse: Error initializing memory handler:', error);
      this.storageType = 'localStorage';
      this.isReady = true;
    }
  }

  /**
   * Wait for handler to be ready
   */
  async waitForReady() {
    while (!this.isReady) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
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
    const urlHash = this.generateHash(url).substring(0, 8);
    return `chatgpt_${timestamp}_${urlHash}`;
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(messageText, timestamp, sequence) {
    const textHash = this.generateHash(messageText).substring(0, 8);
    return `${timestamp}_${sequence}_${textHash}`;
  }

  /**
   * Generate a simple hash from text
   */
  generateHash(text) {
    let hash = 0;
    const cleanText = text.toLowerCase().trim();
    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Save or update a conversation
   */
  async saveConversation(conversationData) {
    await this.waitForReady();
    
    try {
      const conversations = await this.getAllConversations();
      const conversationId = conversationData.conversationId;
      
      console.log(`Synapse: Saving conversation ${conversationId} with ${conversationData.messages.length} messages`);
      
      // Check if conversation already exists
      if (conversations[conversationId]) {
        // Merge messages, avoiding duplicates
        const existingMessages = conversations[conversationId].messages || [];
        const mergedMessages = this.mergeMessages(existingMessages, conversationData.messages);
        
        conversations[conversationId] = {
          ...conversations[conversationId],
          messages: mergedMessages,
          lastUpdated: new Date().toISOString(),
          url: conversationData.url,
          title: conversationData.title
        };
        
        console.log(`Synapse: Updated existing conversation with ${mergedMessages.length} total messages`);
      } else {
        // Create new conversation
        conversations[conversationId] = {
          ...conversationData,
          messages: conversationData.messages.map(msg => this.enhanceMessage(msg)),
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        console.log(`Synapse: Created new conversation with ${conversationData.messages.length} messages`);
      }

      // Save to storage
      const success = await this.saveToStorage(conversations);
      if (success) {
        console.log('Synapse: Conversation saved successfully');
        return true;
      } else {
        console.error('Synapse: Failed to save conversation');
        return false;
      }
      
    } catch (error) {
      console.error('Synapse: Error saving conversation:', error);
      return false;
    }
  }

  /**
   * Merge messages avoiding duplicates - Improved version
   */
  mergeMessages(existingMessages, newMessages) {
    // Create a map for existing messages using content hash for better deduplication
    const messageMap = new Map();
    
    // Add existing messages to map
    existingMessages.forEach(msg => {
      const key = this.createMessageKey(msg);
      messageMap.set(key, msg);
    });
    
    // Add new messages, avoiding duplicates
    newMessages.forEach(msg => {
      const key = this.createMessageKey(msg);
      if (!messageMap.has(key)) {
        const enhancedMessage = this.enhanceMessage(msg);
        messageMap.set(key, enhancedMessage);
      }
    });
    
    // Convert back to array and sort by sequence/timestamp
    const mergedMessages = Array.from(messageMap.values());
    
    return mergedMessages.sort((a, b) => {
      // First sort by sequence if available
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      // Fallback to timestamp
      return new Date(a.timestamp) - new Date(b.timestamp);
    });
  }

  /**
   * Create a unique key for a message to detect duplicates
   */
  createMessageKey(message) {
    // Use role, text content hash, and approximate timestamp for uniqueness
    const textHash = this.generateHash(message.text || '').substring(0, 8);
    const timeKey = message.timestamp ? message.timestamp.substring(0, 16) : 'unknown'; // Date and hour
    return `${message.role}_${textHash}_${timeKey}`;
  }

  /**
   * Enhance message with additional metadata
   */
  enhanceMessage(message) {
    if (!message.text) {
      console.warn('Synapse: Message has no text content:', message);
      return message;
    }

    return {
      ...message,
      messageType: message.messageType || (message.role === 'assistant' ? 'chatgpt_response' : 'user_message'),
      wordCount: message.wordCount || message.text.split(/\s+/).filter(word => word.length > 0).length,
      characterCount: message.characterCount || message.text.length,
      hasCode: message.hasCode !== undefined ? message.hasCode : (message.text.includes('```') || message.text.includes('`')),
      hasMarkdown: message.hasMarkdown !== undefined ? message.hasMarkdown : /[*_`#\[\]]/.test(message.text),
      enhancedAt: new Date().toISOString()
    };
  }

  /**
   * Save data to storage (Chrome storage or localStorage)
   */
  async saveToStorage(conversations) {
    try {
      if (this.storageType === 'chrome') {
        await chrome.storage.local.set({ [this.storageKey]: conversations });
      } else {
        const dataString = JSON.stringify(conversations);
        
        // Check storage size
        if (dataString.length > this.maxStorageSize) {
          console.warn('Synapse: Data exceeds storage limit, cleaning up...');
          const cleanedConversations = await this.cleanupOldConversations(conversations);
          localStorage.setItem(this.storageKey, JSON.stringify(cleanedConversations));
        } else {
          localStorage.setItem(this.storageKey, dataString);
        }
      }
      return true;
    } catch (error) {
      console.error('Synapse: Error saving to storage:', error);
      return false;
    }
  }

  /**
   * Get all conversations from storage
   */
  async getAllConversations() {
    await this.waitForReady();
    
    try {
      if (this.storageType === 'chrome') {
        const result = await chrome.storage.local.get([this.storageKey]);
        return result[this.storageKey] || {};
      } else {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {};
      }
    } catch (error) {
      console.error('Synapse: Error retrieving conversations:', error);
      return {};
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
      
      const success = await this.saveToStorage(conversations);
      if (success) {
        console.log(`Synapse: Conversation ${conversationId} deleted successfully`);
        return true;
      } else {
        console.error('Synapse: Failed to delete conversation');
        return false;
      }
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
      if (this.storageType === 'chrome') {
        await chrome.storage.local.remove([this.storageKey]);
      } else {
        localStorage.removeItem(this.storageKey);
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
      const dataString = JSON.stringify(conversations);
      const totalSize = dataString.length;
      const conversationCount = Object.keys(conversations).length;
      
      let totalMessages = 0;
      for (const conversation of Object.values(conversations)) {
        totalMessages += conversation.messages ? conversation.messages.length : 0;
      }
      
      return {
        totalSize,
        conversationCount,
        totalMessages,
        isNearLimit: totalSize > this.maxStorageSize * 0.8,
        formattedSize: this.formatBytes(totalSize),
        storageType: this.storageType
      };
    } catch (error) {
      console.error('Synapse: Error getting storage info:', error);
      return { 
        totalSize: 0, 
        conversationCount: 0, 
        totalMessages: 0, 
        isNearLimit: false,
        formattedSize: '0 B',
        storageType: this.storageType,
        error: error.message
      };
    }
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Clean up old conversations when storage is full
   */
  async cleanupOldConversations(conversations) {
    // Sort conversations by last updated date
    const sortedConversations = Object.entries(conversations).sort((a, b) => {
      const dateA = new Date(a[1].lastUpdated || a[1].createdAt || 0);
      const dateB = new Date(b[1].lastUpdated || b[1].createdAt || 0);
      return dateB - dateA; // Newest first
    });

    // Keep only the most recent conversations (limit to 70% of max size)
    const targetSize = this.maxStorageSize * 0.7;
    const cleanedConversations = {};
    let currentSize = 0;

    for (const [id, conversation] of sortedConversations) {
      const conversationSize = JSON.stringify(conversation).length;
      if (currentSize + conversationSize < targetSize) {
        cleanedConversations[id] = conversation;
        currentSize += conversationSize;
      } else {
        console.log(`Synapse: Removing old conversation ${id} due to size limit`);
      }
    }

    return cleanedConversations;
  }

  /**
   * Debug function to list all conversations
   */
  async listAllConversations() {
    try {
      const conversations = await this.getAllConversations();
      const summary = Object.entries(conversations).map(([id, conv]) => ({
        id,
        messageCount: conv.messages ? conv.messages.length : 0,
        createdAt: conv.createdAt,
        lastUpdated: conv.lastUpdated,
        url: conv.url,
        title: conv.title
      }));

      console.log('Synapse: All saved conversations:');
      console.table(summary);
      
      // Also log detailed info
      console.log('Synapse: Detailed conversation data:', conversations);
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
        
        if (conversation.messages) {
          const originalCount = conversation.messages.length;
          
          // Clean and filter messages
          conversation.messages = conversation.messages
            .map(message => {
              if (message.text) {
                const originalText = message.text;
                const cleanedText = this.cleanMessageText(originalText);
                
                if (cleanedText !== originalText && cleanedText.length > 0) {
                  hasChanges = true;
                  return {
                    ...message,
                    text: cleanedText,
                    originalText: originalText // Keep original for reference
                  };
                } else if (cleanedText.length === 0) {
                  // Mark for removal
                  return null;
                }
              }
              return message;
            })
            .filter(message => message !== null); // Remove null messages

          if (conversation.messages.length !== originalCount) {
            hasChanges = true;
            console.log(`Synapse: Removed ${originalCount - conversation.messages.length} empty messages from ${conversationId}`);
          }
        }
        
        if (hasChanges) {
          conversations[conversationId] = conversation;
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        const success = await this.saveToStorage(conversations);
        if (success) {
          console.log(`Synapse: Cleaned up ${cleanedCount} conversations`);
        }
      }
      
      return { 
        cleanedCount, 
        totalConversations: Object.keys(conversations).length,
        success: cleanedCount === 0 || await this.saveToStorage(conversations)
      };
    } catch (error) {
      console.error('Synapse: Error cleaning up conversations:', error);
      return { error: error.message, cleanedCount: 0, totalConversations: 0, success: false };
    }
  }

  /**
   * Clean message text (remove UI artifacts and noise)
   */
  cleanMessageText(text) {
    if (!text) return '';
    
    let cleaned = text
      .replace(/^\s*ChatGPT\s*said:\s*/i, '')
      .replace(/^\s*You\s*said:\s*/i, '')
      .replace(/^\s*Assistant\s*:?\s*/i, '')
      .replace(/^\s*said:\s*/i, '')
      .replace(/Upgrade to.*?$/gis, '')
      .replace(/Temporary Chat.*?$/gis, '')
      .replace(/window\.__.*?$/gis, '')
      .replace(/What's on your mind.*?$/gis, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove empty lines and normalize
    cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '').trim();

    // Return empty string if no meaningful content remains
    if (cleaned.length < 2 || cleaned.match(/^[^\w]*$/)) {
      return '';
    }

    return cleaned;
  }

  /**
   * Export conversations as JSON
   */
  async exportConversations() {
    try {
      const conversations = await this.getAllConversations();
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        totalConversations: Object.keys(conversations).length,
        conversations
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Synapse: Error exporting conversations:', error);
      return null;
    }
  }

  /**
   * Import conversations from JSON
   */
  async importConversations(jsonData) {
    try {
      const importData = JSON.parse(jsonData);
      const conversations = await this.getAllConversations();
      
      let importedCount = 0;
      
      if (importData.conversations) {
        for (const [id, conversation] of Object.entries(importData.conversations)) {
          if (!conversations[id]) {
            conversations[id] = conversation;
            importedCount++;
          }
        }
      }

      if (importedCount > 0) {
        const success = await this.saveToStorage(conversations);
        if (success) {
          console.log(`Synapse: Imported ${importedCount} conversations`);
          return { success: true, importedCount };
        }
      }

      return { success: false, importedCount: 0, error: 'No new conversations to import' };
    } catch (error) {
      console.error('Synapse: Error importing conversations:', error);
      return { success: false, importedCount: 0, error: error.message };
    }
  }
}

// Create global instance
console.log('Synapse: Memory handler script loaded');
if (typeof window !== 'undefined') {
  window.synapseMemory = new MemoryHandler();
  console.log('Synapse: Memory handler initialized and available at window.synapseMemory');
} else {
  console.warn('Synapse: Window object not available');
}