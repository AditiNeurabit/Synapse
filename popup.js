/**
 * Popup script for Synapse Auto-Capture extension - Fixed Version
 */

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Synapse: Popup loaded');

  // Get DOM elements
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const conversationCount = document.getElementById('conversationCount');
  const storageSize = document.getElementById('storageSize');
  const messageCount = document.getElementById('messageCount');
  const toggleBtn = document.getElementById('toggleBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const listBtn = document.getElementById('listBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');

  let isEnabled = true;
  let currentTab = null;

  // Initialize popup
  await init();

  async function init() {
    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];

      // Check if we're on a ChatGPT page
      const isChatGPT = currentTab.url.includes('chatgpt.com') || currentTab.url.includes('chat.openai.com');
      
      if (!isChatGPT) {
        showNotOnChatGPT();
        return;
      }

      // Load initial state
      await updateStatus();
      
      // Set up event listeners
      setupEventListeners();
      
    } catch (error) {
      console.error('Synapse: Error initializing popup:', error);
      showError('Failed to initialize extension');
    }
  }

  function setupEventListeners() {
    // Toggle capture functionality
    toggleBtn.addEventListener('click', async () => {
      try {
        isEnabled = !isEnabled;
        await sendMessageToContentScript('toggleCapture', { enabled: isEnabled });
        await updateStatus();
      } catch (error) {
        console.error('Synapse: Error toggling capture:', error);
        showError('Failed to toggle capture');
      }
    });

    // Refresh stats
    refreshBtn.addEventListener('click', async () => {
      try {
        await updateStatus();
        showSuccess('Stats refreshed');
      } catch (error) {
        console.error('Synapse: Error refreshing:', error);
        showError('Failed to refresh stats');
      }
    });

    // List all conversations (opens console)
    listBtn.addEventListener('click', async () => {
      try {
        await sendMessageToContentScript('listConversations');
        showSuccess('Check browser console for conversation list');
      } catch (error) {
        console.error('Synapse: Error listing conversations:', error);
        showError('Failed to list conversations');
      }
    });

    // Clear all conversations
    clearBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
        try {
          await sendMessageToContentScript('clearAll');
          await updateStatus();
          showSuccess('All conversations cleared');
        } catch (error) {
          console.error('Synapse: Error clearing conversations:', error);
          showError('Failed to clear conversations');
        }
      }
    });

    // Export conversations (if export button exists)
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        try {
          const result = await sendMessageToContentScript('exportConversations');
          if (result && result.data) {
            downloadJSON(result.data, `synapse-conversations-${new Date().toISOString().split('T')[0]}.json`);
            showSuccess('Conversations exported');
          } else {
            showError('No conversations to export');
          }
        } catch (error) {
          console.error('Synapse: Error exporting conversations:', error);
          showError('Failed to export conversations');
        }
      });
    }
  }

  // Send message to content script
  async function sendMessageToContentScript(action, data = {}) {
    try {
      if (!currentTab || !currentTab.id) {
        throw new Error('No active tab found');
      }

      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action,
        ...data
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : 'Unknown error');
      }

      return response;
    } catch (error) {
      console.error('Synapse: Error sending message to content script:', error);
      
      // If content script isn't loaded, try to inject it
      if (error.message.includes('Could not establish connection')) {
        try {
          await injectContentScript();
          // Retry after injection
          return await chrome.tabs.sendMessage(currentTab.id, { action, ...data });
        } catch (injectionError) {
          console.error('Synapse: Failed to inject content script:', injectionError);
          throw new Error('Content script not available. Please refresh the ChatGPT page.');
        }
      }
      
      throw error;
    }
  }

  // Inject content script if not already loaded
  async function injectContentScript() {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['memory.js', 'content.js']
      });
      
      // Wait a moment for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Synapse: Error injecting content script:', error);
      throw error;
    }
  }

  // Update status display
  async function updateStatus() {
    try {
      // Get storage info directly from Chrome storage
      const storageInfo = await getStorageInfo();
      
      // Update UI elements
      if (conversationCount) {
        conversationCount.textContent = storageInfo.conversationCount || 0;
      }
      
      if (storageSize) {
        storageSize.textContent = storageInfo.formattedSize || '0 B';
      }
      
      if (messageCount) {
        messageCount.textContent = storageInfo.totalMessages || 0;
      }

      // Update status indicator
      updateStatusIndicator();
      
    } catch (error) {
      console.error('Synapse: Error updating status:', error);
      
      // Show fallback values
      if (conversationCount) conversationCount.textContent = '?';
      if (storageSize) storageSize.textContent = '?';
      if (messageCount) messageCount.textContent = '?';
    }
  }

  // Get storage info directly from Chrome storage
  async function getStorageInfo() {
    try {
      const result = await chrome.storage.local.get(['synapse_conversations']);
      const conversations = result.synapse_conversations || {};
      
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
        formattedSize: formatBytes(totalSize)
      };
    } catch (error) {
      console.error('Synapse: Error getting storage info:', error);
      return {
        totalSize: 0,
        conversationCount: 0,
        totalMessages: 0,
        formattedSize: '0 B'
      };
    }
  }

  // Update status indicator
  function updateStatusIndicator() {
    if (statusDot && statusText && toggleBtn) {
      if (isEnabled) {
        statusDot.className = 'indicator-dot active';
        statusText.textContent = 'Active';
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'btn btn-primary';
      } else {
        statusDot.className = 'indicator-dot inactive';
        statusText.textContent = 'Inactive';
        toggleBtn.textContent = 'Enable';
        toggleBtn.className = 'btn btn-secondary';
      }
    }
  }

  // Show when not on ChatGPT page
  function showNotOnChatGPT() {
    const container = document.querySelector('.popup-container');
    if (container) {
      container.innerHTML = `
        <div class="not-chatgpt">
          <h3>Synapse Auto-Capture</h3>
          <p>This extension only works on ChatGPT pages.</p>
          <p>Please navigate to <a href="https://chatgpt.com" target="_blank">chatgpt.com</a> to use this extension.</p>
        </div>
      `;
    }
  }

  // Show error message
  function showError(message) {
    showMessage(message, 'error');
  }

  // Show success message
  function showSuccess(message) {
    showMessage(message, 'success');
  }

  // Show message with styling
  function showMessage(message, type = 'info') {
    // Remove existing messages
    const existing = document.querySelector('.message');
    if (existing) {
      existing.remove();
    }

    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;

    // Add to popup
    const container = document.querySelector('.popup-container');
    if (container) {
      container.appendChild(messageEl);
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 3000);
    }
  }

  // Format bytes to human readable format
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Download JSON data as file
  function downloadJSON(data, filename) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
      updateStatus();
    }
  });

  // Auto-refresh status every 5 seconds
  setInterval(updateStatus, 5000);
});