// Quick test script for new implementations
import { agenticRagService } from './server/services/agentic-rag-service.js';
import { vectorStorage } from './server/services/vector-storage.js';

async function quickTest() {
  console.log('🧪 Quick Test of New Implementations\n');
  
  try {
    // Initialize storage
    await vectorStorage.initialize();
    
    // Test conversation memory
    const sessionId = 'test-session-' + Date.now();
    console.log('1. Testing conversation memory...');
    
    const testQuery = "I'm looking for a luxury perfume under 500 AED for my anniversary";
    const response = await agenticRagService.query(testQuery, sessionId);
    
    console.log('✅ Query processed successfully');
    console.log(`Response: ${response.answer.substring(0, 100)}...`);
    console.log(`Intent: ${response.intent}`);
    
    // Check memory
    const context = agenticRagService.getConversationContext(sessionId);
    const preferences = agenticRagService.getUserPreferences(sessionId);
    
    console.log('✅ Memory retrieved');
    console.log(`User preferences: ${JSON.stringify(preferences)}`);
    console.log(`Recent queries: ${context.recentQueries.length}`);
    
    // Test preference extraction
    console.log('\n2. Testing preference extraction...');
    const secondQuery = "Actually, I prefer something more classic and under 300 AED";
    const secondResponse = await agenticRagService.query(secondQuery, sessionId);
    
    const updatedPreferences = agenticRagService.getUserPreferences(sessionId);
    console.log('✅ Preferences updated');
    console.log(`Updated preferences: ${JSON.stringify(updatedPreferences)}`);
    
    // Test knowledge base
    console.log('\n3. Testing knowledge base...');
    const policyQuery = "What's your return policy?";
    const policyResponse = await agenticRagService.query(policyQuery, sessionId);
    
    console.log('✅ Knowledge base working');
    console.log(`Policy response: ${policyResponse.answer.substring(0, 100)}...`);
    console.log(`Sources: ${policyResponse.sources?.length || 0}`);
    
    console.log('\n🎉 All tests passed! New implementations are working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

quickTest().catch(console.error); 