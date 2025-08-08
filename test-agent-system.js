// Test script for the new agent-based system
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SESSION_ID = `test_agent_${Date.now()}`;
const MESSAGES = [
  "I'm looking for a perfume",
  "I prefer something floral for women",
  "Do you have anything under 200 dollars?",
  "Show me some options"
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

async function sendMessage(content, sessionId) {
  console.log(`${colors.blue}Sending message to agent: "${content}" with sessionId: ${sessionId}${colors.reset}`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/agent/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      body: JSON.stringify({
        content,
        sessionId
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log(`${colors.green}Agent response: "${data.message}"${colors.reset}`);
    
    // Log agent thinking if available
    if (data.debug && data.debug.thinking) {
      console.log(`${colors.yellow}Agent thinking: ${data.debug.thinking}${colors.reset}`);
    }
    
    // Log agent actions if available
    if (data.debug && data.debug.actions) {
      console.log(`${colors.cyan}Agent actions:${colors.reset}`);
      console.log(JSON.stringify(data.debug.actions, null, 2));
    }
    
    // Check if we have products
    if (data.products && data.products.length > 0) {
      console.log(`${colors.magenta}Received ${data.products.length} products:${colors.reset}`);
      data.products.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.title} - $${product.price}`);
      });
    } else {
      console.log(`${colors.yellow}No products received${colors.reset}`);
    }
    
    return sessionId;
  } catch (error) {
    console.error(`${colors.red}Error sending message:${colors.reset}`, error);
    return sessionId;
  }
}

async function runTest() {
  console.log(`${colors.bright}${colors.green}=== Starting Agent System Test ===${colors.reset}`);
  console.log(`${colors.bright}Using session ID: ${SESSION_ID}${colors.reset}`);
  
  let currentSessionId = SESSION_ID;
  
  // Send messages in sequence
  for (const message of MESSAGES) {
    currentSessionId = await sendMessage(message, currentSessionId);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between messages
  }
  
  console.log(`${colors.bright}${colors.green}=== Test Complete ===${colors.reset}`);
}

// Run the test
runTest();