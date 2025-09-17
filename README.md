# Synapse Auto-Capture Chrome Extension

A Chrome extension that automatically captures conversations from supported LLM websites (starting with ChatGPT) and stores them locally using `chrome.storage.local`.

## Features

- **Auto-Capture**: Automatically detects and captures new messages from ChatGPT conversations
- **Local Storage**: All data is stored locally in your browser - no external servers
- **Deduplication**: Prevents duplicate messages from being saved
- **Performance Optimized**: Uses throttling and efficient DOM observation
- **Debug Tools**: Built-in debugging functions for development and troubleshooting
- **Privacy Focused**: No data is sent or shared outside your browser

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension should now appear in your extensions list

## Usage

### Basic Usage

1. Navigate to [ChatGPT](https://chat.openai.com)
2. Start a conversation - the extension will automatically capture messages
3. Click the extension icon in your browser toolbar to view status and controls

### Debug Functions

Open the browser console (F12) on ChatGPT and use these functions:

```javascript
// List all saved conversations
synapseDebug.listConversations()

// Get storage information
synapseDebug.getStorageInfo()

// Clear all conversations
synapseDebug.clearAll()

// Toggle capture on/off
synapseDebug.toggleCapture(true)  // Enable
synapseDebug.toggleCapture(false) // Disable

// Get current messages in memory
synapseDebug.getCurrentMessages()

// Get count of processed messages
synapseDebug.getProcessedCount()

// Force save current messages
synapseDebug.forceSave()
```

## Data Structure

Conversations are stored in the following format:

```json
{
  "conversationId": "chatgpt_2025-01-10_abc12345",
  "timestamp": "2025-01-10T12:34:56Z",
  "messages": [
    {
      "id": "user_2025-01-10T12:34:56Z_abc123",
      "role": "user",
      "text": "What is a neural network?",
      "timestamp": "2025-01-10T12:34:56Z",
      "url": "https://chat.openai.com/..."
    },
    {
      "id": "assistant_2025-01-10T12:35:12Z_def456",
      "role": "assistant", 
      "text": "A neural network is...",
      "timestamp": "2025-01-10T12:35:12Z",
      "url": "https://chat.openai.com/..."
    }
  ],
  "url": "https://chat.openai.com/...",
  "title": "ChatGPT",
  "createdAt": "2025-01-10T12:34:56Z",
  "lastUpdated": "2025-01-10T12:35:12Z"
}
```

## Files Structure

- `manifest.json` - Chrome extension manifest
- `memoryHandler.js` - Storage management and data handling
- `chatgptCapture.js` - Main content script for ChatGPT message detection
- `popup.html` - Extension popup interface
- `popup.js` - Popup functionality and controls

## Technical Details

### Message Detection

The extension uses a `MutationObserver` to watch for DOM changes in the ChatGPT interface. It looks for:

- Message containers with `data-message-author-role` attributes
- Conversation turn elements
- Various fallback selectors for different ChatGPT layouts

### Performance Optimizations

- **Throttling**: DOM mutations are processed with a 1-second throttle
- **RequestIdleCallback**: Heavy operations are deferred to idle time
- **Efficient Selectors**: Uses specific selectors to minimize DOM traversal
- **Memory Management**: Clears processed message cache periodically

### Privacy & Security

- All data is stored locally using `chrome.storage.local`
- No external network requests
- No data sharing or transmission
- Respects browser storage limits (5MB default)

## Troubleshooting

### Extension Not Working

1. Check that you're on `https://chat.openai.com`
2. Refresh the page after installing the extension
3. Check the browser console for error messages
4. Ensure the extension is enabled in `chrome://extensions/`

### Messages Not Being Captured

1. Open browser console and check for error messages
2. Try `synapseDebug.getCurrentMessages()` to see if messages are detected
3. Use `synapseDebug.forceSave()` to manually save current messages
4. Check if capture is enabled with `synapseDebug.toggleCapture(true)`

### Storage Issues

1. Use `synapseDebug.getStorageInfo()` to check storage usage
2. Clear old conversations with `synapseDebug.clearAll()` if needed
3. Check browser storage limits in `chrome://settings/content/all`

## Development

To modify or extend the extension:

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on the extension card
4. Test your changes on ChatGPT

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
