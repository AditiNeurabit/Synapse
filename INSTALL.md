# Installation Guide

## Quick Start

1. **Download the Extension**
   - Download all files to a folder on your computer
   - Make sure you have these files:
     - `manifest.json`
     - `memoryHandler.js`
     - `chatgptCapture.js`
     - `popup.html`
     - `popup.js`
     - `README.md`

2. **Install in Chrome**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

3. **Test the Extension**
   - Go to [ChatGPT](https://chat.openai.com)
   - Start a conversation
   - Open browser console (F12)
   - You should see "Synapse: ChatGPT Auto-Capture initialized"
   - Type a message and send it
   - Check console for "Synapse: Saved X messages"

## Verification Steps

### Check Extension is Working
1. Go to ChatGPT
2. Open browser console (F12)
3. Look for these messages:
   ```
   Synapse: ChatGPT Auto-Capture initialized
   Synapse: Chat container found, starting observer
   Synapse: Debug functions available at window.synapseDebug
   ```

### Test Message Capture
1. In ChatGPT, send a message
2. Wait for response
3. In console, run: `synapseDebug.getCurrentMessages()`
4. You should see captured messages

### Test Storage
1. In console, run: `synapseDebug.listConversations()`
2. You should see saved conversations
3. Run: `synapseDebug.getStorageInfo()`
4. Check storage usage

## Troubleshooting

### Extension Not Loading
- Make sure all files are in the same folder
- Check that `manifest.json` is valid JSON
- Refresh the extension in `chrome://extensions/`

### Messages Not Capturing
- Refresh ChatGPT page
- Check console for errors
- Try `synapseDebug.toggleCapture(true)` in console
- Make sure you're on `https://chat.openai.com`

### Storage Issues
- Check browser storage limits
- Use `synapseDebug.clearAll()` to clear old data
- Check `chrome://settings/content/all` for storage settings

## Testing Commands

Run these in the browser console on ChatGPT:

```javascript
// Check if extension is loaded
typeof window.synapseMemory !== 'undefined'

// List all conversations
synapseDebug.listConversations()

// Get storage info
synapseDebug.getStorageInfo()

// Toggle capture
synapseDebug.toggleCapture(true)

// Get current messages
synapseDebug.getCurrentMessages()

// Force save
synapseDebug.forceSave()
```

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify all files are present and correct
3. Try refreshing the extension and ChatGPT page
4. Check the README.md for detailed troubleshooting
