import { vectorStorage } from './server/services/vector-storage.js';

async function testFixes() {
  console.log('🧪 Testing Both Fixes...\n');
  
  try {
    // Initialize vector storage
    await vectorStorage.initialize();
    
    // Test 1: Watch search should return watches
    console.log('📋 Test 1: Watch Search Fix');
    const watchResults = await vectorStorage.searchProducts("show me women watches", 5);
    
    console.log(`✅ Found ${watchResults.length} products for watch search`);
    
    if (watchResults.length > 0) {
      const watchProducts = watchResults.filter(r => 
        r.metadata.title.toLowerCase().includes('watch')
      );
      
      console.log(`✅ Watch products found: ${watchProducts.length}/${watchResults.length}`);
      
      if (watchProducts.length > 0) {
        console.log('🎉 SUCCESS: Watch search is working!');
        console.log('📋 Sample watch product:', watchProducts[0].metadata.title);
      } else {
        console.log('❌ FAIL: No watch products found');
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Conversation context
    console.log('📋 Test 2: Conversation Context Fix');
    const sessionId = "test_session_context";
    
    // Save some test messages
    await vectorStorage.saveChatMessage(sessionId, {
      content: "show me women watches",
      isBot: false
    });
    
    await vectorStorage.saveChatMessage(sessionId, {
      content: "I'm looking for classic watches for women",
      isBot: true
    });
    
    await vectorStorage.saveChatMessage(sessionId, {
      content: "classic",
      isBot: false
    });
    
    // Retrieve conversation history
    const history = await vectorStorage.getChatHistory(sessionId);
    
    console.log(`✅ Conversation history length: ${history.length}`);
    console.log('✅ Messages in history:');
    history.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.isBot ? 'Bot' : 'User'}: ${msg.content.substring(0, 50)}...`);
    });
    
    if (history.length >= 3) {
      console.log('🎉 SUCCESS: Conversation context is working!');
    } else {
      console.log('❌ FAIL: Conversation context not working');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testFixes().catch(console.error); 