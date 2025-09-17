/**
 * Test script for improved ChatGPT message filtering
 * Run this in the browser console on a ChatGPT page to test the improvements
 */

console.log('🧪 Testing Synapse Auto-Capture improvements...');

// Test the new filtering functions
function testMessageFiltering() {
  console.log('\n📋 Testing message filtering improvements...');
  
  // Test UI element filtering
  const testElements = [
    { text: 'Share', tagName: 'BUTTON', className: 'btn-share', role: 'unknown' },
    { text: 'Copy', tagName: 'A', className: 'copy-link', role: 'unknown' },
    { text: 'Settings', tagName: 'DIV', className: 'nav-item', role: 'unknown' },
    { text: '2+2', tagName: 'DIV', className: 'message-content', role: 'user' },
    { text: '56', tagName: 'DIV', className: 'user-input', role: 'user' },
    { text: 'hey', tagName: 'DIV', className: 'user-message', role: 'user' },
    { text: 'Ready when you are.', tagName: 'DIV', className: 'assistant-message', role: 'assistant' },
    { text: 'Hey Aditi! How are you?', tagName: 'DIV', className: 'chatgpt-response', role: 'assistant' }
  ];
  
  testElements.forEach((testCase, index) => {
    const mockElement = {
      textContent: testCase.text,
      tagName: testCase.tagName,
      className: testCase.className,
      querySelector: () => null,
      matches: () => false,
      closest: () => null,
      getBoundingClientRect: () => ({ width: 100, height: 30 })
    };
    
    // Test UI element detection
    const isUI = window.synapseCapture?.isUIElement(mockElement);
    const isNotReal = window.synapseCapture?.isNotRealMessage(testCase.text, testCase.role);
    
    console.log(`Test ${index + 1}: "${testCase.text}" (${testCase.role})`);
    console.log(`  - Is UI Element: ${isUI}`);
    console.log(`  - Is Not Real Message: ${isNotReal}`);
    console.log(`  - Should be filtered: ${isUI || isNotReal}`);
    console.log(`  - Expected: ${testCase.text === 'Share' || testCase.text === 'Copy' || testCase.text === 'Settings' ? 'FILTERED' : 'ALLOWED'}`);
    console.log('');
  });
}

// Test role detection
function testRoleDetection() {
  console.log('\n🎭 Testing role detection improvements...');
  
  const testMessages = [
    { text: 'Hey', role: 'user' },
    { text: '2+2', role: 'user' },
    { text: 'Ready when you are.', role: 'assistant' },
    { text: 'Hey Aditi! How are you?', role: 'assistant' },
    { text: 'Can you help me with this?', role: 'user' },
    { text: 'I can help you with that.', role: 'assistant' }
  ];
  
  testMessages.forEach((testCase, index) => {
    const mockElement = {
      textContent: testCase.text,
      querySelector: () => null,
      className: testCase.role === 'assistant' ? 'markdown' : 'user-input'
    };
    
    const detectedRole = window.synapseCapture?.analyzeContentPatterns(testCase.text, mockElement);
    const isCorrect = detectedRole === testCase.role;
    
    console.log(`Test ${index + 1}: "${testCase.text}"`);
    console.log(`  - Expected: ${testCase.role}`);
    console.log(`  - Detected: ${detectedRole}`);
    console.log(`  - Correct: ${isCorrect ? '✅' : '❌'}`);
    console.log('');
  });
}

// Test current message detection
function testCurrentDetection() {
  console.log('\n🔍 Testing current message detection...');
  
  if (window.synapseCapture) {
    const stats = window.synapseCapture.getMessageStats();
    console.log('Current message statistics:', stats);
    
    const testResults = window.synapseCapture.testMessageDetection();
    console.log('Message detection test results:', testResults);
    
    // Test conversation turn detection specifically
    const chatContainer = window.synapseCapture.findChatContainer();
    if (chatContainer) {
      const conversationTurns = chatContainer.querySelectorAll('article[data-testid*="conversation-turn"]');
      console.log(`Found ${conversationTurns.length} conversation turn articles`);
      
      conversationTurns.forEach((turn, index) => {
        const testId = turn.getAttribute('data-testid');
        const turnType = turn.getAttribute('data-turn');
        const textContent = turn.textContent?.trim().substring(0, 50) + '...';
        console.log(`Turn ${index + 1}: ${testId} (${turnType}) - "${textContent}"`);
      });
    }
  } else {
    console.log('❌ Synapse capture not available. Make sure you\'re on a ChatGPT page.');
  }
}

// Test specific filtering scenarios
function testSpecificScenarios() {
  console.log('\n🎯 Testing specific filtering scenarios...');
  
  const scenarios = [
    { text: '56', role: 'user', expected: 'ALLOWED' },
    { text: '2+2', role: 'user', expected: 'ALLOWED' },
    { text: 'hey', role: 'user', expected: 'ALLOWED' },
    { text: 'Share', role: 'unknown', expected: 'FILTERED' },
    { text: 'Could you clarify what you mean by "56"?', role: 'assistant', expected: 'ALLOWED' },
    { text: 'Ready when you are.', role: 'assistant', expected: 'ALLOWED' }
  ];
  
  scenarios.forEach((scenario, index) => {
    console.log(`\nScenario ${index + 1}: "${scenario.text}" (${scenario.role})`);
    
    if (window.synapseCapture) {
      const result = window.synapseCapture.testFiltering(scenario.text, scenario.role);
      const actual = result.shouldBeFiltered ? 'FILTERED' : 'ALLOWED';
      const isCorrect = actual === scenario.expected;
      
      console.log(`  - Expected: ${scenario.expected}`);
      console.log(`  - Actual: ${actual}`);
      console.log(`  - Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
    } else {
      console.log('  - ❌ Synapse capture not available');
    }
  });
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all Synapse Auto-Capture tests...\n');
  
  testMessageFiltering();
  testRoleDetection();
  testCurrentDetection();
  testSpecificScenarios();
  
  console.log('✅ All tests completed!');
  console.log('\n💡 To test in real-time:');
  console.log('1. Go to ChatGPT and start a conversation');
  console.log('2. Check the console for "Synapse:" messages');
  console.log('3. Use window.synapseDebug.testMessageDetection() to see current results');
  console.log('4. Use window.synapseDebug.testFiltering("text", "role") to test specific cases');
}

// Auto-run tests if on ChatGPT page
if (window.location.hostname.includes('chatgpt.com') || window.location.hostname.includes('chat.openai.com')) {
  runAllTests();
} else {
  console.log('⚠️  Please run this script on a ChatGPT page to test the improvements.');
  console.log('   Copy and paste this script into the browser console on chatgpt.com');
}
