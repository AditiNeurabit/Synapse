/**
 * Popup script for Synapse Auto-Capture extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const conversationCount = document.getElementById('conversationCount');
  const storageSize = document.getElementById('storageSize');
  const toggleBtn = document.getElementById('toggleBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const listBtn = document.getElementById('listBtn');
  const clearBtn = document.getElementById('clearBtn');

  let isEnabled = true;

  // Load initial state
  await updateStatus();

  // Toggle capture functionality
  toggleBtn.addEventListener('click', async () => {
    isEnabled = !isEnabled;
    
    // Send message to content script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url.includes('chat.openai.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleCapture',
          enabled: isEnabled
        });
      }
    } catch (error) {
      console.error('Error toggling capture:', error);
    }
    
    await updateStatus();
  });

  // Refresh stats
  refreshBtn.addEventListener('click', async () => {
    await updateStatus();
  });

  // List all conversations
  listBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url.includes('chat.openai.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'listConversations'
        });
      }
    } catch (error) {
      console.error('Error listing conversations:', error);
    }
  });

  // Clear all conversations
  clearBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all conversations? This cannot be undone.')) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url.includes('chat.openai.com')) {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'clearAll'
          });
        }
        await updateStatus();
      } catch (error) {
        console.error('Error clearing conversations:', error);
      }
    }
  });

  // Update status display
  async function updateStatus() {
    try {
      // Get storage info
      const result = await chrome.storage.local.get(['synapse_conversations']);
      const conversations = result.synapse_conversations || {};
      
      const conversationCountValue = Object.keys(conversations).length;
      const storageSizeValue = JSON.stringify(conversations).length;
      
      // Update UI
      conversationCount.textContent = conversationCountValue;
      storageSize.textContent = formatBytes(storageSizeValue);
      
      // Update status indicator
      if (isEnabled) {
        statusDot.className = 'indicator-dot active';
        statusText.textContent = 'Active';
        toggleBtn.textContent = 'Disable';
        toggleBtn.className = 'btn-primary';
      } else {
        statusDot.className = 'indicator-dot inactive';
        statusText.textContent = 'Inactive';
        toggleBtn.textContent = 'Enable';
        toggleBtn.className = 'btn-secondary';
      }
      
    } catch (error) {
      console.error('Error updating status:', error);
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

  // Listen for messages from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateStatus') {
      updateStatus();
    }
  });
});
