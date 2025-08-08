// Test script for full conversational flow with gender-specific queries
import { agenticRagService } from './server/services/agentic-rag-service.js';
import { vectorStorage } from './server/services/vector-storage.js';

async function testFullConversation() {
  console.log('🧪 Testing Full Conversational Flow with Gender-Specific Queries\n');
  
  try {
    // Initialize storage
    await vectorStorage.initialize();
    
    // Test conversations
    const conversations = [
      {
        name: "Women's Watch Conversation",
        sessionId: 'test-women-watch-' + Date.now(),
        messages: [
          "Hi, I'm looking for a watch",
          "For women please",
          "Something elegant"
        ]
      },
      {
        name: "Men's Perfume Conversation",
        sessionId: 'test-men-perfume-' + Date.now(),
        messages: [
          "Do you have any perfumes",
          "For men",
          "Something woody"
        ]
      }
    ];
    
    for (const conversation of conversations) {
      console.log(`\n📱 Testing conversation: ${conversation.name}`);
      console.log(`Session ID: ${conversation.sessionId}\n`);
      
      for (let i = 0; i < conversation.messages.length; i++) {
        const message = conversation.messages[i];
        console.log(`User: "${message}"`);
        
        const response = await agenticRagService.query(message, conversation.sessionId);
        
        console.log(`Bot: "${response.answer.substring(0, 100)}..."`);
        console.log(`Intent: ${response.intent}`);
        console.log(`Should start product flow: ${response.shouldStartProductFlow}`);
        console.log(`Products found: ${response.products?.length || 0}`);
        
        // Check conversation context
        const context = agenticRagService.getConversationContext(conversation.sessionId);
        console.log(`Recent queries: ${context.recentQueries.length}`);
        console.log(`User preferences: ${JSON.stringify(context.userPreferences)}`);
        
        console.log('---');
      }
      
      // Final check of the conversation memory
      const finalContext = agenticRagService.getConversationContext(conversation.sessionId);
      console.log(`\nFinal conversation state for ${conversation.name}:`);
      console.log(`Recent queries: ${finalContext.recentQueries.join(', ')}`);
      console.log(`User preferences: ${JSON.stringify(finalContext.userPreferences)}`);
      console.log(`Conversation flow: ${JSON.stringify(finalContext.conversationFlow)}`);
    }
    
    console.log('\n✅ Full conversation test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFullConversation().catch(console.error);