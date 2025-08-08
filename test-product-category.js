// Test script for product category detection and filtering
import { agenticRagService } from './server/services/agentic-rag-service';
import { vectorStorage } from './server/services/vector-storage';

async function testProductCategoryDetection() {
  console.log('🧪 Testing Product Category Detection\n');
  
  try {
    // Initialize storage
    await vectorStorage.initialize();
    
    // Test queries
    const testQueries = [
      "show me women watches",
      "I'm looking for men's perfumes",
      "Do you have any jewelry for ladies?",
      "I need a gift for my wife"
    ];
    
    for (const query of testQueries) {
      console.log(`\n📋 Testing query: "${query}"`);
      
      const sessionId = `test-session-${Date.now()}`;
      const response = await agenticRagService.query(query, sessionId);
      
      console.log(`Answer: "${response.answer.substring(0, 100)}..."`);
      console.log(`Intent: ${response.intent}`);
      console.log(`Product Category: ${response.debug?.productCategory || 'Not detected'}`);
      console.log(`Products found: ${response.products?.length || 0}`);
      
      if (response.products && response.products.length > 0) {
        console.log('Top products:');
        response.products.slice(0, 3).forEach((product, index) => {
          console.log(`${index + 1}. ${product.title}`);
        });
      }
      
      // Check conversation context
      const context = agenticRagService.getConversationContext(sessionId);
      console.log(`User preferences: ${JSON.stringify(context.userPreferences)}`);
      
      console.log('---');
    }
    
    console.log('\n✅ Product category detection test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testProductCategoryDetection().catch(console.error);