import fs from 'fs';
import path from 'path';

// Mock conversational flow test
class ConversationalFlowTest {
  
  constructor() {
    this.conversationState = {
      category: null,
      gender: null,
      style: null,
      budget: null,
      features: []
    };
  }
  
  // Simulate the improved conversational flow
  generateResponse(userQuery, conversationHistory = []) {
    const queryLower = userQuery.toLowerCase();
    
    // Step 1: Initial query analysis
    if (queryLower.includes('watch') && queryLower.includes('women')) {
      this.conversationState.category = 'watch';
      this.conversationState.gender = 'women';
      
      // Good response - asks ONE question
      return {
        response: "Great! I found some women's watches for you. What style are you looking for - classic, modern, or sporty?",
        products: null,
        shouldShowProducts: false
      };
    }
    
    // Step 2: Style preference
    if (queryLower.includes('classic') || queryLower.includes('modern') || queryLower.includes('sporty')) {
      this.conversationState.style = queryLower.includes('classic') ? 'classic' : 
                                   queryLower.includes('modern') ? 'modern' : 'sporty';
      
      // Good response - asks ONE question
      return {
        response: "Perfect! Now what's your budget range?",
        products: null,
        shouldShowProducts: false
      };
    }
    
    // Step 3: Budget preference
    if (queryLower.includes('budget') || queryLower.includes('200') || queryLower.includes('500')) {
      this.conversationState.budget = '200-500';
      
      // Good response - shows products as cards only
      return {
        response: "Here are some elegant watches in your price range:",
        products: [
          {
            title: "Juvenis Women Analog Watch - JV1637W",
            price: 296,
            imageUrl: "watch1.jpg"
          },
          {
            title: "Lencia Leather Women Analog Watch-LC7174B", 
            price: 595,
            imageUrl: "watch2.jpg"
          }
        ],
        shouldShowProducts: true
      };
    }
    
    // Bad response example (what we want to avoid)
    if (queryLower.includes('bad')) {
      return {
        response: "I have many watches. What's your style, budget, features, occasion, and brand preference? Here's a detailed description of each watch with specifications...",
        products: null,
        shouldShowProducts: false
      };
    }
    
    return {
      response: "How can I help you find the perfect product?",
      products: null,
      shouldShowProducts: false
    };
  }
  
  // Test the conversational flow
  testConversationalFlow() {
    console.log('🧪 Testing Improved Conversational Flow...\n');
    
    const testScenarios = [
      {
        query: "show me watches for women",
        expectedResponse: "Great! I found some women's watches for you. What style are you looking for - classic, modern, or sporty?",
        expectedProducts: null,
        description: "Step 1: Initial query - should ask ONE question about style"
      },
      {
        query: "classic",
        expectedResponse: "Perfect! Now what's your budget range?",
        expectedProducts: null,
        description: "Step 2: Style preference - should ask ONE question about budget"
      },
      {
        query: "in budget range 200-500",
        expectedResponse: "Here are some elegant watches in your price range:",
        expectedProducts: 2,
        description: "Step 3: Budget preference - should show products as cards only"
      }
    ];
    
    testScenarios.forEach((scenario, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 TEST ${index + 1}: ${scenario.description}`);
      console.log(`Query: "${scenario.query}"`);
      console.log(`${'='.repeat(60)}`);
      
      const result = this.generateResponse(scenario.query);
      
      console.log(`✅ Response: "${result.response}"`);
      console.log(`✅ Products: ${result.products ? result.products.length : 'None'}`);
      console.log(`✅ Should Show Products: ${result.shouldShowProducts}`);
      
      // Verify response quality
      const responseLength = result.response.length;
      const hasMultipleQuestions = (result.response.match(/\?/g) || []).length > 1;
      const hasProductDescription = result.response.includes('detailed') || result.response.includes('specifications');
      
      console.log(`\n🎯 QUALITY CHECK:`);
      console.log(`   Response length: ${responseLength} characters (should be < 100)`);
      console.log(`   Multiple questions: ${hasMultipleQuestions ? '❌' : '✅'}`);
      console.log(`   Product description in text: ${hasProductDescription ? '❌' : '✅'}`);
      
      if (responseLength < 100 && !hasMultipleQuestions && !hasProductDescription) {
        console.log('✅ SUCCESS: Response follows conversational guidelines!');
      } else {
        console.log('❌ FAIL: Response violates conversational guidelines');
      }
    });
  }
  
  // Test bad response patterns
  testBadResponsePatterns() {
    console.log('\n🧪 Testing Bad Response Patterns (What to Avoid)...\n');
    
    const badResponse = this.generateResponse("bad");
    
    console.log(`❌ BAD RESPONSE EXAMPLE:`);
    console.log(`   "${badResponse.response}"`);
    console.log(`   Problems:`);
    console.log(`   - Multiple questions at once`);
    console.log(`   - Long verbose text`);
    console.log(`   - Product descriptions in text`);
    console.log(`   - Poor conversational flow`);
  }
}

async function testConversationalFlow() {
  try {
    const test = new ConversationalFlowTest();
    
    // Test good conversational flow
    test.testConversationalFlow();
    
    // Test bad response patterns
    test.testBadResponsePatterns();
    
    console.log('\n📋 SUMMARY:');
    console.log('✅ Good responses: Short, one question at a time, products as cards only');
    console.log('❌ Bad responses: Long, multiple questions, product descriptions in text');
    console.log('🎯 Goal: Natural conversational flow with step-by-step preference collection');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testConversationalFlow().catch(console.error); 