/**
 * Debug script for Synapse Auto-Capture save issues
 * Run this in the browser console on a ChatGPT page to diagnose problems
 */

console.log('🔍 Synapse Auto-Capture Debug Tool');
console.log('=====================================');

// Check if extension is loaded
function checkExtensionLoaded() {
  console.log('\n📋 1. Checking if extension is loaded...');
  
  const checks = {
    'window.synapseMemory exists': typeof window.synapseMemory !== 'undefined',
    'window.synapseCapture exists': typeof window.synapseCapture !== 'undefined',
    'window.synapseDebug exists': typeof window.synapseDebug !== 'undefined',
    'Chrome storage API available': typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined'
  };
  
  Object.entries(checks).forEach(([check, result]) => {
    console.log(`  ${result ? '✅' : '❌'} ${check}: ${result}`);
  });
  
  return Object.values(checks).every(Boolean);
}

// Test Chrome storage permissions
async function testChromeStorage() {
  console.log('\n💾 2. Testing Chrome storage...');
  
  try {
    // Test reading from storage
    const result = await chrome.storage.local.get(['synapse_conversations']);
    console.log('  ✅ Chrome storage read: OK');
    console.log('  📊 Current conversations:', Object.keys(result.synapse_conversations || {}).length);
    
    // Test writing to storage
    const testData = { test: 'data', timestamp: Date.now() };
    await chrome.storage.local.set({ synapse_test: testData });
    console.log('  ✅ Chrome storage write: OK');
    
    // Clean up test data
    await chrome.storage.local.remove(['synapse_test']);
    console.log('  ✅ Chrome storage cleanup: OK');
    
    return true;
  } catch (error) {
    console.error('  ❌ Chrome storage error:', error);
    return false;
  }
}

// Test memory handler functionality
async function testMemoryHandler() {
  console.log('\n🧠 3. Testing memory handler...');
  
  if (!window.synapseMemory) {
    console.log('  ❌ Memory handler not available');
    return false;
  }
  
  try {
    // Test conversation ID generation
    const conversationId = window.synapseMemory.generateConversationId();
    console.log('  ✅ Conversation ID generation: OK');
    console.log('  📝 Generated ID:', conversationId);
    
    // Test message enhancement
    const testMessage = {
      id: 'test_123',
      role: 'user',
      text: 'test message',
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    const enhancedMessage = window.synapseMemory.enhanceMessage(testMessage);
    console.log('  ✅ Message enhancement: OK');
    console.log('  📝 Enhanced message:', enhancedMessage);
    
    // Test storage info
    const storageInfo = await window.synapseMemory.getStorageInfo();
    console.log('  ✅ Storage info retrieval: OK');
    console.log('  📊 Storage info:', storageInfo);
    
    return true;
  } catch (error) {
    console.error('  ❌ Memory handler error:', error);
    return false;
  }
}

// Test capture functionality
function testCaptureFunctionality() {
  console.log('\n🎯 4. Testing capture functionality...');
  
  if (!window.synapseCapture) {
    console.log('  ❌ Capture handler not available');
    return false;
  }
  
  try {
    // Test chat container detection
    const chatContainer = window.synapseCapture.findChatContainer();
    console.log('  ✅ Chat container detection:', chatContainer ? 'Found' : 'Not found');
    
    if (chatContainer) {
      // Test conversation turn detection
      const conversationTurns = chatContainer.querySelectorAll('article[data-testid*="conversation-turn"]');
      console.log('  ✅ Conversation turns found:', conversationTurns.length);
      
      // Test message extraction
      const messages = window.synapseCapture.extractMessagesFromElement(chatContainer);
      console.log('  ✅ Message extraction:', messages.length, 'messages');
      
      // Test message stats
      const stats = window.synapseCapture.getMessageStats();
      console.log('  ✅ Message stats:', stats);
    }
    
    return true;
  } catch (error) {
    console.error('  ❌ Capture functionality error:', error);
    return false;
  }
}

// Test actual save process
async function testSaveProcess() {
  console.log('\n💾 5. Testing save process...');
  
  if (!window.synapseMemory || !window.synapseCapture) {
    console.log('  ❌ Required handlers not available');
    return false;
  }
  
  try {
    // Create test conversation data
    const testConversation = {
      conversationId: 'test_' + Date.now(),
      messages: [{
        id: 'test_msg_' + Date.now(),
        role: 'user',
        text: 'Test message for debugging',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        messageType: 'user_message',
        wordCount: 4,
        characterCount: 25,
        hasCode: false,
        hasMarkdown: false
      }]
    };
    
    console.log('  📝 Test conversation data:', testConversation);
    
    // Test save
    const saveResult = await window.synapseMemory.saveConversation(testConversation);
    console.log('  ✅ Save result:', saveResult);
    
    if (saveResult) {
      // Verify save by reading back
      const conversations = await window.synapseMemory.getAllConversations();
      const savedConversation = conversations[testConversation.conversationId];
      
      if (savedConversation) {
        console.log('  ✅ Save verification: SUCCESS');
        console.log('  📊 Saved conversation:', savedConversation);
        
        // Clean up test data
        await window.synapseMemory.deleteConversation(testConversation.conversationId);
        console.log('  ✅ Test data cleaned up');
        
        return true;
      } else {
        console.log('  ❌ Save verification: FAILED - conversation not found in storage');
        return false;
      }
    } else {
      console.log('  ❌ Save process failed');
      return false;
    }
  } catch (error) {
    console.error('  ❌ Save process error:', error);
    return false;
  }
}

// Check for common issues
function checkCommonIssues() {
  console.log('\n⚠️  6. Checking for common issues...');
  
  const issues = [];
  
  // Check if we're on ChatGPT
  if (!window.location.hostname.includes('chatgpt.com') && !window.location.hostname.includes('chat.openai.com')) {
    issues.push('Not on ChatGPT domain');
  }
  
  // Check if extension is enabled
  if (window.synapseCapture && !window.synapseCapture.isEnabled) {
    issues.push('Extension capture is disabled');
  }
  
  // Check for console errors
  const originalError = console.error;
  let errorCount = 0;
  console.error = function(...args) {
    errorCount++;
    originalError.apply(console, args);
  };
  
  // Check if there are any obvious DOM issues
  const chatContainer = document.querySelector('main[role="main"]');
  if (!chatContainer) {
    issues.push('Chat container not found in DOM');
  }
  
  if (issues.length === 0) {
    console.log('  ✅ No common issues detected');
  } else {
    console.log('  ⚠️  Issues detected:');
    issues.forEach(issue => console.log(`    - ${issue}`));
  }
  
  return issues.length === 0;
}

// Main debug function
async function runFullDebug() {
  console.log('🚀 Starting full debug process...\n');
  
  const results = {
    extensionLoaded: checkExtensionLoaded(),
    chromeStorage: await testChromeStorage(),
    memoryHandler: await testMemoryHandler(),
    captureFunctionality: testCaptureFunctionality(),
    saveProcess: await testSaveProcess(),
    noCommonIssues: checkCommonIssues()
  };
  
  console.log('\n📊 DEBUG SUMMARY');
  console.log('==================');
  
  Object.entries(results).forEach(([test, result]) => {
    console.log(`${result ? '✅' : '❌'} ${test}: ${result ? 'PASS' : 'FAIL'}`);
  });
  
  const allPassed = Object.values(results).every(Boolean);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Extension should be working correctly.');
    console.log('💡 If messages still aren\'t saving, try:');
    console.log('   1. Refresh the ChatGPT page');
    console.log('   2. Start a new conversation');
    console.log('   3. Check browser console for any error messages');
  } else {
    console.log('\n❌ Some tests failed. Check the issues above.');
    console.log('💡 Try reloading the extension or refreshing the page.');
  }
  
  return results;
}

// Auto-run if on ChatGPT
if (window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('chat.openai.com')) {
  console.log('🎯 Detected ChatGPT page - running debug automatically...');
  runFullDebug();
} else {
  console.log('⚠️  Please run this script on a ChatGPT page.');
  console.log('   Copy and paste this script into the browser console on chatgpt.com');
}

// Export functions for manual testing
window.synapseDebugTool = {
  runFullDebug,
  checkExtensionLoaded,
  testChromeStorage,
  testMemoryHandler,
  testCaptureFunctionality,
  testSaveProcess,
  checkCommonIssues
};
