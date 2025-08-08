// Test script for Agentic RAG improvements
import { agenticRagService } from './server/services/agentic-rag-service.js';
import { aiService } from './server/services/ai-service.js';
import { vectorStorage } from './server/services/vector-storage.js';

async function testAgenticRAG() {
  console.log('Testing Agentic RAG improvements...\n');
  
  // Initialize services
  await vectorStorage.initialize();
  
  // Test 1: Basic query analysis
  console.log('Test 1: Query Analysis');
  const testQuery = "show me perfumes under 200";
  const sessionId = "test-session-" + Date.now();
  
  try {
    const response = await agenticRagService.query(testQuery, sessionId);
    console.log('Response:', {
      answer: response.answer.substring(0, 100) + '...',
      intent: response.intent,
      shouldStartProductFlow: response.shouldStartProductFlow,
      confidence: response.confidence,
      debug: response.debug
    });
  } catch (error) {
    console.error('Test 1 failed:', error);
  }
  
  // Test 2: Product-specific query
  console.log('\nTest 2: Product Query');
  const productQuery = "I want a luxury watch for my husband's birthday";
  
  try {
    const response = await agenticRagService.query(productQuery, sessionId);
    console.log('Response:', {
      answer: response.answer.substring(0, 100) + '...',
      intent: response.intent,
      shouldStartProductFlow: response.shouldStartProductFlow,
      confidence: response.confidence,
      productsFound: response.products?.length || 0
    });
  } catch (error) {
    console.error('Test 2 failed:', error);
  }
  
  // Test 3: Order tracking query
  console.log('\nTest 3: Order Tracking Query');
  const orderQuery = "where is my order?";
  
  try {
    const response = await agenticRagService.query(orderQuery, sessionId);
    console.log('Response:', {
      answer: response.answer.substring(0, 100) + '...',
      intent: response.intent,
      shouldStartProductFlow: response.shouldStartProductFlow,
      confidence: response.confidence
    });
  } catch (error) {
    console.error('Test 3 failed:', error);
  }
  
  console.log('\nAgentic RAG test completed!');
}

// Run the test
testAgenticRAG().catch(console.error); 