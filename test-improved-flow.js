// Test script for improved product recommendation flow with price filtering
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SESSION_ID = `test_price_filter_${Date.now()}`;
const MESSAGES = [
  "I'm looking for perfumes",
  "Show me men's perfumes under 200 dollars",
  "Show me some classic men's perfumes between 50 and 150"
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
    console.log(`${colors.green}Response: "${data.message}"${colors.reset}`);
    
    // Check if we have products
    if (data.products && data.products.length > 0) {
      console.log(`${colors.cyan}Received ${data.products.length} products:${colors.reset}`);
      
      // Extract budget constraints from the message if present
      let budgetMax = Infinity;
      const underMatch = content.match(/under\s+(\d+)/i);
      const lessThanMatch = content.match(/less\s+than\s+(\d+)/i);
      const betweenMatch = content.match(/between\s+(\d+)\s+and\s+(\d+)/i);
      
      if (underMatch || lessThanMatch) {
        const match = underMatch || lessThanMatch;
        budgetMax = parseInt(match[1], 10);
      } else if (betweenMatch) {
        budgetMax = parseInt(betweenMatch[2], 10);
      }
      
      data.products.forEach((product, index) => {
        const price = parseFloat(product.price);
        const inBudget = price <= budgetMax;
        const priceColor = inBudget ? colors.green : colors.red;
        
        console.log(`  ${index + 1}. ${product.title} - ${priceColor}$${price}${colors.reset} ${inBudget ? '✓' : '✗'}`);
      });
    } else {
      console.log(`${colors.yellow}No products received${colors.reset}`);
    }
    
    // Check shouldStartProductFlow flag
    console.log(`${colors.yellow}shouldStartProductFlow: ${data.shouldStartProductFlow ? 'true' : 'false'}${colors.reset}`);
    
    return sessionId;
  } catch (error) {
    console.error(`${colors.red}Error sending message:${colors.reset}`, error);
    return sessionId;
  }
}

async function runTest() {
  console.log(`${colors.bright}${colors.green}=== Starting Improved Product Flow Test ===${colors.reset}`);
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