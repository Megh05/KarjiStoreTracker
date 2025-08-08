// Test script for conversational flow improvements
import { agenticRagService } from './server/services/agentic-rag-service.js';
import { vectorStorage } from './server/services/vector-storage.js';

async function testConversationFlow() {
  console.log('🧪 Testing Conversational Flow Improvements\n');
  
  try {
    // Initialize storage
    await vectorStorage.initialize();
    
    const sessionId = 'test-conversation-' + Date.now();
    console.log(`Using session ID: ${sessionId}\n`);
    
    // Simulate the exact conversation from the logs
    const conversationSteps = [
      {
        query: "recommend me perfume",
        expectedBehavior: "Should ask for preferences and not show products initially"
      },
      {
        query: "floral",
        expectedBehavior: "Should recognize this as a follow-up and show floral perfumes"
      }
    ];
    
    for (let i = 0; i < conversationSteps.length; i++) {
      const { query, expectedBehavior } = conversationSteps[i];
      console.log(`Step ${i + 1}: "${query}"`);
      console.log(`Expected: ${expectedBehavior}`);
      
      const response = await agenticRagService.query(query, sessionId);
      
      console.log(`Response: ${response.answer.substring(0, 100)}...`);
      console.log(`Intent: ${response.intent}`);
      console.log(`Should start product flow: ${response.shouldStartProductFlow}`);
      console.log(`Products found: ${response.products?.length || 0}`);
      
      // Check conversation context
      const context = agenticRagService.getConversationContext(sessionId);
      console.log(`Recent queries: ${context.recentQueries.length}`);
      console.log(`User preferences: ${JSON.stringify(context.userPreferences)}`);
      
      console.log('---\n');
    }
    
    // Test preference extraction
    console.log('Testing preference extraction...');
    const testQueries = [
      "I want a luxury perfume under 500 AED",
      "Something floral for my wife's birthday",
      "Classic style, under 300"
    ];
    
    for (const query of testQueries) {
      const preferences = await agenticRagService['extractPreferencesFromQuery'](query);
      console.log(`Query: "${query}"`);
      console.log(`Extracted preferences: ${JSON.stringify(preferences)}`);
      console.log('---');
    }
    
    console.log('✅ Conversation flow test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConversationFlow().catch(console.error); 