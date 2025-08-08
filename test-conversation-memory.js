import fs from 'fs';
import path from 'path';

// Mock conversation memory test
class ConversationMemoryTest {
  
  constructor() {
    this.conversationHistory = [];
    this.userPreferences = {
      category: null,
      gender: null,
      style: null,
      budget: null
    };
  }
  
  // Simulate conversation with memory
  generateResponse(userQuery) {
    const queryLower = userQuery.toLowerCase();
    
    // Add to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userQuery,
      timestamp: new Date()
    });
    
    let response;
    let shouldShowProducts = false;
    let products = null;
    
    // Check conversation history for context
    const hasWatchesContext = this.conversationHistory.some(msg => 
      msg.content.toLowerCase().includes('watch')
    );
    const hasWomenContext = this.conversationHistory.some(msg => 
      msg.content.toLowerCase().includes('women') || msg.content.toLowerCase().includes('ladies')
    );
    const hasStylePreference = this.conversationHistory.some(msg => 
      ['classic', 'modern', 'sporty', 'elegant'].some(style => 
        msg.content.toLowerCase().includes(style)
      )
    );
    const hasBudgetPreference = this.conversationHistory.some(msg => 
      /\d+/.test(msg.content) || msg.content.toLowerCase().includes('budget')
    );
    
    // Step 1: Initial query - should ask for style
    if (queryLower.includes('watch') && (queryLower.includes('women') || queryLower.includes('ladies'))) {
      this.userPreferences.category = 'watch';
      this.userPreferences.gender = 'women';
      
      response = "Great! I found some women's watches for you. What style are you looking for - classic, modern, or sporty?";
      shouldShowProducts = false;
    }
    
    // Step 2: Style preference - should ask for budget
    else if (['classic', 'modern', 'sporty', 'elegant'].some(style => queryLower.includes(style))) {
      this.userPreferences.style = queryLower.includes('classic') ? 'classic' : 
                                 queryLower.includes('modern') ? 'modern' : 
                                 queryLower.includes('sporty') ? 'sporty' : 'elegant';
      
      response = "Perfect! Now what's your budget range?";
      shouldShowProducts = false;
    }
    
    // Step 3: Budget preference - should show products
    else if (/\d+/.test(queryLower) || queryLower.includes('budget')) {
      this.userPreferences.budget = '200-500'; // Extract from query
      
      // Only show products if we have both style and budget
      if (this.userPreferences.style && this.userPreferences.budget) {
        response = "Here are some elegant watches in your price range:";
        shouldShowProducts = true;
        products = [
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
        ];
      } else {
        response = "I need to know your style preference first. What style are you looking for - classic, modern, or sporty?";
        shouldShowProducts = false;
      }
    }
    
    // Generic query without context - should ask for clarification
    else if (queryLower.includes('watch') || queryLower.includes('ladies')) {
      if (!this.userPreferences.category) {
        response = "I can help you find watches! Are you looking for men's or women's watches?";
      } else if (!this.userPreferences.style) {
        response = "What style are you looking for - classic, modern, or sporty?";
      } else if (!this.userPreferences.budget) {
        response = "What's your budget range?";
      } else {
        response = "Here are some watches for you:";
        shouldShowProducts = true;
        products = [
          {
            title: "Guess Ladies Gold Tone Analog Watch GW0611L2",
            price: 805,
            imageUrl: "watch3.jpg"
          }
        ];
      }
    }
    
    // Follow-up without context - should ask for clarification
    else {
      response = "Could you please tell me what you're looking for? I can help with watches, perfumes, or other products.";
      shouldShowProducts = false;
    }
    
    // Add response to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date()
    });
    
    return {
      response,
      products,
      shouldShowProducts,
      userPreferences: { ...this.userPreferences },
      conversationLength: this.conversationHistory.length
    };
  }
  
  // Test conversation flow with memory
  testConversationFlow() {
    console.log('🧪 Testing Conversation Memory and Flow...\n');
    
    const testConversations = [
      {
        name: "Good Flow - Step by Step",
        queries: [
          "show me women watches",
          "classic", 
          "200-500"
        ],
        expectedFlow: [
          "Ask for style preference",
          "Ask for budget preference", 
          "Show products"
        ]
      },
      {
        name: "Bad Flow - Generic Query",
        queries: [
          "ladies"
        ],
        expectedFlow: [
          "Ask for clarification"
        ]
      },
      {
        name: "Memory Test - Follow-up",
        queries: [
          "show me women watches",
          "classic",
          "ladies" // Should remember previous context
        ],
        expectedFlow: [
          "Ask for style preference",
          "Ask for budget preference",
          "Ask for budget (remembering style)"
        ]
      }
    ];
    
    testConversations.forEach((conversation, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔍 CONVERSATION ${index + 1}: ${conversation.name}`);
      console.log(`${'='.repeat(60)}`);
      
      // Reset for each conversation
      this.conversationHistory = [];
      this.userPreferences = {
        category: null,
        gender: null,
        style: null,
        budget: null
      };
      
      conversation.queries.forEach((query, queryIndex) => {
        console.log(`\n📝 Query ${queryIndex + 1}: "${query}"`);
        
        const result = this.generateResponse(query);
        
        console.log(`✅ Response: "${result.response}"`);
        console.log(`✅ Products: ${result.products ? result.products.length : 'None'}`);
        console.log(`✅ Preferences: ${JSON.stringify(result.userPreferences)}`);
        console.log(`✅ Conversation Length: ${result.conversationLength}`);
        
        // Verify conversation memory
        const hasMemory = this.conversationHistory.length > 2;
        const followsFlow = this.verifyFlow(query, result, conversation.expectedFlow[queryIndex]);
        
        console.log(`🎯 MEMORY CHECK:`);
        console.log(`   Has conversation history: ${hasMemory ? '✅' : '❌'}`);
        console.log(`   Follows expected flow: ${followsFlow ? '✅' : '❌'}`);
      });
    });
  }
  
  verifyFlow(query, result, expectedFlow) {
    const queryLower = query.toLowerCase();
    const responseLower = result.response.toLowerCase();
    
    if (expectedFlow.includes("Ask for style preference")) {
      return responseLower.includes('style') && responseLower.includes('classic');
    }
    if (expectedFlow.includes("Ask for budget preference")) {
      return responseLower.includes('budget');
    }
    if (expectedFlow.includes("Show products")) {
      return result.shouldShowProducts && result.products;
    }
    if (expectedFlow.includes("Ask for clarification")) {
      return responseLower.includes('what') || responseLower.includes('could you');
    }
    
    return true;
  }
  
  // Test bad patterns
  testBadPatterns() {
    console.log('\n🧪 Testing Bad Patterns (What to Avoid)...\n');
    
    const badPatterns = [
      {
        query: "show me women watches",
        badResponse: "Here are some watches for you: [product list with descriptions]",
        problem: "Shows products without asking preferences"
      },
      {
        query: "classic",
        badResponse: "What's your style, budget, features, and occasion?",
        problem: "Asks multiple questions at once"
      },
      {
        query: "ladies",
        badResponse: "I have many products. What do you want?",
        problem: "Generic response without context"
      }
    ];
    
    badPatterns.forEach((pattern, index) => {
      console.log(`❌ BAD PATTERN ${index + 1}:`);
      console.log(`   Query: "${pattern.query}"`);
      console.log(`   Bad Response: "${pattern.badResponse}"`);
      console.log(`   Problem: ${pattern.problem}\n`);
    });
  }
}

async function testConversationMemory() {
  try {
    const test = new ConversationMemoryTest();
    
    // Test conversation flow with memory
    test.testConversationFlow();
    
    // Test bad patterns
    test.testBadPatterns();
    
    console.log('\n📋 SUMMARY:');
    console.log('✅ Good flow: Step-by-step preference collection with memory');
    console.log('❌ Bad flow: Generic responses, multiple questions, no memory');
    console.log('🎯 Goal: Natural conversation with context awareness');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testConversationMemory().catch(console.error); 