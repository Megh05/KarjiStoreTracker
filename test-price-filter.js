// Test script for price filtering in the agent system
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SESSION_ID = `test_price_filter_${Date.now()}`;
const TEST_CASES = [
  {
    query: "show me perfumes under 200 aed",
    expectedMaxPrice: 200
  },
  {
    query: "show me watches between 500 and 1000 aed",
    expectedMinPrice: 500,
    expectedMaxPrice: 1000
  }
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
    
    // Check if we have products
    if (data.products && data.products.length > 0) {
      console.log(`${colors.magenta}Received ${data.products.length} products:${colors.reset}`);
      
      let allProductsWithinRange = true;
      let productsOutsideRange = [];
      
      data.products.forEach((product, index) => {
        const price = product.price;
        const title = product.title;
        
        // Check if the product price is within expected range
        let isWithinRange = true;
        let rangeInfo = "";
        
        if (TEST_CASES[0].expectedMaxPrice && price > TEST_CASES[0].expectedMaxPrice) {
          isWithinRange = false;
          rangeInfo = `exceeds max ${TEST_CASES[0].expectedMaxPrice}`;
        }
        
        if (TEST_CASES[0].expectedMinPrice && price < TEST_CASES[0].expectedMinPrice) {
          isWithinRange = false;
          rangeInfo = `below min ${TEST_CASES[0].expectedMinPrice}`;
        }
        
        if (!isWithinRange) {
          allProductsWithinRange = false;
          productsOutsideRange.push({ title, price, issue: rangeInfo });
        }
        
        // Display product with price check indicator
        console.log(`  ${index + 1}. ${title} - ${price} AED ${isWithinRange ? '✓' : '✗'}`);
      });
      
      // Report on price filtering accuracy
      if (allProductsWithinRange) {
        console.log(`${colors.green}✓ All products are within the specified price range${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Some products are outside the specified price range:${colors.reset}`);
        productsOutsideRange.forEach(product => {
          console.log(`  - ${product.title}: ${product.price} AED (${product.issue})`);
        });
      }
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
  console.log(`${colors.bright}${colors.green}=== Starting Price Filter Test ===${colors.reset}`);
  console.log(`${colors.bright}Using session ID: ${SESSION_ID}${colors.reset}`);
  
  let currentSessionId = SESSION_ID;
  
  // Send test messages in sequence
  for (const testCase of TEST_CASES) {
    console.log(`\n${colors.cyan}Testing: ${testCase.query}${colors.reset}`);
    console.log(`${colors.cyan}Expected price range: ${testCase.expectedMinPrice || 0} - ${testCase.expectedMaxPrice || 'unlimited'} AED${colors.reset}`);
    
    currentSessionId = await sendMessage(testCase.query, currentSessionId);
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between messages
  }
  
  console.log(`${colors.bright}${colors.green}=== Test Complete ===${colors.reset}`);
}

// Run the test
runTest();