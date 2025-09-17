/**
 * Test script to demonstrate Synapse Auto-Capture functionality
 * Run this in the browser console on ChatGPT to test the extension
 */

console.log('Synapse Auto-Capture Test Script');
console.log('================================');

// Test if extension is loaded
if (typeof window.synapseMemory !== 'undefined') {
  console.log('✅ Memory handler loaded');
} else {
  console.log('❌ Memory handler not found');
}

if (typeof window.synapseCapture !== 'undefined') {
  console.log('✅ Capture script loaded');
} else {
  console.log('❌ Capture script not found');
}

if (typeof window.synapseDebug !== 'undefined') {
  console.log('✅ Debug functions available');
} else {
  console.log('❌ Debug functions not found');
}

// Test functions
async function runTests() {
  console.log('\nRunning tests...');
  
  try {
    // Test 1: Get storage info
    console.log('\n1. Testing storage info...');
    const storageInfo = await window.synapseMemory.getStorageInfo();
    console.log('Storage info:', storageInfo);
    
    // Test 2: List conversations
    console.log('\n2. Testing conversation listing...');
    const conversations = await window.synapseMemory.listAllConversations();
    console.log('Conversations:', Object.keys(conversations).length);
    
    // Test 3: Test message processing
    console.log('\n3. Testing message processing...');
    const currentMessages = window.synapseDebug.getCurrentMessages();
    console.log('Current messages in memory:', currentMessages.length);
    
    // Test 4: Test processed count
    console.log('\n4. Testing processed message count...');
    const processedCount = window.synapseDebug.getProcessedCount();
    console.log('Processed messages:', processedCount);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests after a short delay
setTimeout(runTests, 1000);

// Helper function to simulate a conversation save
function simulateConversation() {
  const testConversation = {
    conversationId: 'test_' + Date.now(),
    timestamp: new Date().toISOString(),
    messages: [
      {
        id: 'test_user_' + Date.now(),
        role: 'user',
        text: 'This is a test message from the user',
        timestamp: new Date().toISOString(),
        url: window.location.href
      },
      {
        id: 'test_assistant_' + Date.now(),
        role: 'assistant',
        text: 'This is a test response from the assistant',
        timestamp: new Date().toISOString(),
        url: window.location.href
      }
    ],
    url: window.location.href,
    title: document.title
  };
  
  window.synapseMemory.saveConversation(testConversation)
    .then(success => {
      if (success) {
        console.log('✅ Test conversation saved successfully');
      } else {
        console.log('❌ Failed to save test conversation');
      }
    })
    .catch(error => {
      console.error('❌ Error saving test conversation:', error);
    });
}

console.log('\nAvailable test functions:');
console.log('- runTests() - Run all tests');
console.log('- simulateConversation() - Save a test conversation');
console.log('- window.synapseDebug.* - All debug functions');
