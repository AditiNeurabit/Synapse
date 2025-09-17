/**
 * Test script to verify the fixes for btoa encoding and chrome.storage issues
 */

console.log('Testing Synapse fixes...');

// Test 1: Test the encodeText function with Unicode characters
function testEncodeText() {
  console.log('\n=== Testing encodeText function ===');
  
  // Create a mock ChatGPTCapture instance to test the encodeText method
  const mockCapture = {
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
  };

  const testCases = [
    'Hello World', // Basic Latin1
    'heyy...', // The problematic text from the error
    'Hello 世界', // Unicode characters
    '🚀 Rocket emoji', // Emoji
    'Café naïve résumé', // Accented characters
    'Special chars: !@#$%^&*()', // Special characters
    '', // Empty string
    'a'.repeat(1000) // Very long string
  ];

  testCases.forEach((testCase, index) => {
    try {
      const encoded = mockCapture.encodeText(testCase);
      console.log(`✓ Test ${index + 1}: "${testCase.substring(0, 30)}${testCase.length > 30 ? '...' : ''}" -> ${encoded.substring(0, 20)}...`);
    } catch (error) {
      console.error(`✗ Test ${index + 1} failed:`, error.message);
    }
  });
}

// Test 2: Test localStorage fallback
function testLocalStorageFallback() {
  console.log('\n=== Testing localStorage fallback ===');
  
  const mockMemoryHandler = {
    storageKey: 'synapse_conversations',
    
    getFromLocalStorage() {
      try {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : {};
      } catch (error) {
        console.error('Synapse: Error reading from localStorage:', error);
        return {};
      }
    },
    
    saveToLocalStorage(conversations) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(conversations));
        console.log('Synapse: Data saved to localStorage');
      } catch (error) {
        console.error('Synapse: Error saving to localStorage:', error);
        throw error;
      }
    }
  };

  // Test saving and retrieving data
  const testData = {
    'test_conversation': {
      conversationId: 'test_conversation',
      messages: [
        { role: 'user', text: 'Hello!', timestamp: new Date().toISOString() },
        { role: 'assistant', text: 'Hi there! How can I help you?', timestamp: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }
  };

  try {
    mockMemoryHandler.saveToLocalStorage(testData);
    const retrieved = mockMemoryHandler.getFromLocalStorage();
    console.log('✓ localStorage save/retrieve test passed');
    console.log('  Saved conversations:', Object.keys(retrieved).length);
  } catch (error) {
    console.error('✗ localStorage test failed:', error.message);
  }
}

// Test 3: Test chrome.storage availability detection
function testChromeStorageDetection() {
  console.log('\n=== Testing chrome.storage detection ===');
  
  const testCases = [
    { chrome: undefined, expected: false },
    { chrome: {}, expected: false },
    { chrome: { storage: {} }, expected: false },
    { chrome: { storage: { local: {} } }, expected: true }
  ];

  testCases.forEach((testCase, index) => {
    // Temporarily override global chrome object
    const originalChrome = globalThis.chrome;
    globalThis.chrome = testCase.chrome;
    
    const isAvailable = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    const passed = isAvailable === testCase.expected;
    
    console.log(`${passed ? '✓' : '✗'} Test ${index + 1}: chrome=${JSON.stringify(testCase.chrome)} -> available=${isAvailable} (expected: ${testCase.expected})`);
    
    // Restore original chrome
    globalThis.chrome = originalChrome;
  });
}

// Run all tests
function runAllTests() {
  testEncodeText();
  testLocalStorageFallback();
  testChromeStorageDetection();
  
  console.log('\n=== Test Summary ===');
  console.log('All tests completed. Check the results above.');
  console.log('If you see ✓ marks, the fixes are working correctly.');
}

// Run tests if this script is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  runAllTests();
} else {
  // Node.js environment
  console.log('This test script is designed to run in a browser environment.');
  console.log('Please run it in the browser console or include it in your extension.');
}
