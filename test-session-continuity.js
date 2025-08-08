// Test script to verify session continuity in the chat system
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SESSION_ID = `test_session_${Date.now()}`;
console.log(`Using test session ID: ${SESSION_ID}`);
const MESSAGES = [
  "Hello",
  "Tell me about your perfumes",
  "Do you have any floral scents?",
  "What about for men?"
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

async function sendMessage(content, sessionId) {
  console.log(`${colors.blue}Sending message: "${content}" with sessionId: ${sessionId}${colors.reset}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      body: JSON.stringify({
        content,
        sessionId,
        isBot: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`${colors.green}Response received: "${data.message?.substring(0, 50)}..."${colors.reset}`);
    
    // Check if session ID is maintained
    if (data.sessionId && data.sessionId !== sessionId) {
      console.log(`${colors.yellow}Warning: Session ID changed from ${sessionId} to ${data.sessionId}${colors.reset}`);
      return data.sessionId;
    }
    
    return sessionId;
  } catch (error) {
    console.error(`${colors.red}Error sending message: ${error.message}${colors.reset}`);
    return sessionId;
  }
}

async function getChatHistory(sessionId) {
  console.log(`${colors.blue}Getting chat history for sessionId: ${sessionId}${colors.reset}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/chat/history/${sessionId}`, {
      headers: {
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`${colors.green}Retrieved ${data.length} messages from history${colors.reset}`);
    
    // Print the messages
    data.forEach((msg, index) => {
      const role = msg.isBot ? 'Bot' : 'User';
      const color = msg.isBot ? colors.cyan : colors.yellow;
      console.log(`${color}[${index + 1}] ${role}: "${msg.content.substring(0, 50)}..."${colors.reset}`);
    });
    
    return data.length;
  } catch (error) {
    console.error(`${colors.red}Error getting chat history: ${error.message}${colors.reset}`);
    return 0;
  }
}

async function runTest() {
  console.log(`${colors.bright}${colors.green}=== Starting Session Continuity Test ===${colors.reset}`);
  console.log(`${colors.bright}Using session ID: ${SESSION_ID}${colors.reset}`);
  
  let currentSessionId = SESSION_ID;
  
  // Send messages in sequence
  for (const message of MESSAGES) {
    currentSessionId = await sendMessage(message, currentSessionId);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between messages
  }
  
  // Wait a bit longer to ensure all file operations are complete
  console.log(`${colors.yellow}Waiting 3 seconds for file operations to complete...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Get chat history to verify all messages were saved under the same session
  const messageCount = await getChatHistory(currentSessionId);
  
  // Verify test results
  console.log(`${colors.bright}${colors.green}=== Test Results ===${colors.reset}`);
  console.log(`${colors.bright}Messages sent: ${MESSAGES.length}${colors.reset}`);
  console.log(`${colors.bright}Messages in history: ${messageCount}${colors.reset}`);
  console.log(`${colors.bright}Final session ID: ${currentSessionId}${colors.reset}`);
  
  if (messageCount >= MESSAGES.length) {
    console.log(`${colors.bright}${colors.green}✓ Test PASSED: All messages were stored in the session${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}✗ Test FAILED: Some messages were not stored correctly${colors.reset}`);
  }
}

runTest().catch(error => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
});