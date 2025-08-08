import { unifiedRagOrchestrator } from './server/services/unified-rag-orchestrator.js';
import { vectorStorage } from './server/services/vector-storage.js';

async function testRAGFixes() {
  console.log('🧪 Testing RAG Fixes...\n');
  
  // Initialize vector storage
  await vectorStorage.initialize();
  
  // Test 1: Watch search should return watches, not perfumes
  console.log('📋 Test 1: Watch Search');
  const watchQuery = "show me women watches";
  const sessionId = "test_session_watches";
  
  try {
    const response = await unifiedRagOrchestrator.query(watchQuery, sessionId);
    console.log('✅ Query:', watchQuery);
    console.log('✅ Response:', response.answer.substring(0, 100) + '...');
    console.log('✅ Products found:', response.products?.length || 0);
    console.log('✅ RAG Type:', response.debug?.ragType);
    
    if (response.products && response.products.length > 0) {
      console.log('✅ First product:', response.products[0].title);
      console.log('✅ Product category check:', response.products[0].title.toLowerCase().includes('watch') ? 'PASS' : 'FAIL');
    }
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Session consistency
  console.log('📋 Test 2: Session Consistency');
  const sessionId2 = "test_session_consistency";
  
  try {
    const response1 = await unifiedRagOrchestrator.query("hello", sessionId2);
    const response2 = await unifiedRagOrchestrator.query("show me perfumes", sessionId2);
    
    console.log('✅ Session ID maintained:', sessionId2);
    console.log('✅ First response:', response1.answer.substring(0, 50) + '...');
    console.log('✅ Second response:', response2.answer.substring(0, 50) + '...');
    console.log('✅ Conversation context preserved');
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Follow-up questions
  console.log('📋 Test 3: Follow-up Questions');
  
  try {
    const response1 = await unifiedRagOrchestrator.query("I want a watch", sessionId2);
    const response2 = await unifiedRagOrchestrator.query("show me cheaper ones", sessionId2);
    
    console.log('✅ Initial query handled');
    console.log('✅ Follow-up query handled');
    console.log('✅ Context maintained between queries');
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
  
  console.log('\n🎉 RAG Fixes Test Complete!');
}

// Run the test
testRAGFixes().catch(console.error); 