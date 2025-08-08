// Direct test script for price filtering in the agent system
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:5000';
const SESSION_ID = `test_direct_${Date.now()}`;

// Test cases
const TEST_CASES = [
  {
    name: "Perfumes under 200 AED",
    query: "show me perfumes under 200 aed",
    expectedMaxPrice: 200
  },
  {
    name: "Watches between 500 and 1000 AED",
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

async function testQuery(testCase) {
  console.log(`\n${colors.cyan}===== Testing: ${testCase.name} =====`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Expected price range: ${testCase.expectedMinPrice || 0} - ${testCase.expectedMaxPrice || 'unlimited'} AED${colors.reset}`);
  
  try {
    // Send request directly to the agent API
    const response = await fetch(`${BASE_URL}/api/agent/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': SESSION_ID
      },
      body: JSON.stringify({
        content: testCase.query,
        sessionId: SESSION_ID
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
        
        if (testCase.expectedMaxPrice && price > testCase.expectedMaxPrice) {
          isWithinRange = false;
          rangeInfo = `exceeds max ${testCase.expectedMaxPrice}`;
        }
        
        if (testCase.expectedMinPrice && price < testCase.expectedMinPrice) {
          isWithinRange = false;
          rangeInfo = `below min ${testCase.expectedMinPrice}`;
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
      
      return allProductsWithinRange;
    } else {
      console.log(`${colors.yellow}No products received${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.error(`${colors.red}Error testing query:${colors.reset}`, error);
    return false;
  }
}

async function runAllTests() {
  console.log(`${colors.bright}${colors.green}=== Starting Direct Price Filter Tests ===${colors.reset}`);
  console.log(`${colors.bright}Using session ID: ${SESSION_ID}${colors.reset}`);
  
  let allTestsPassed = true;
  
  for (const testCase of TEST_CASES) {
    const testPassed = await testQuery(testCase);
    allTestsPassed = allTestsPassed && testPassed;
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`\n${colors.bright}${colors.green}=== Test Results ===${colors.reset}`);
  if (allTestsPassed) {
    console.log(`${colors.green}✓ All tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Some tests failed${colors.reset}`);
  }
}

// Run all tests
runAllTests();