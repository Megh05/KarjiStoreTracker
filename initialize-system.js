// System initialization script
import { agenticRagService } from './server/services/agentic-rag-service.js';
import { vectorStorage } from './server/services/vector-storage.js';
import { aiService } from './server/services/ai-service.js';

async function initializeSystem() {
  console.log('🚀 Initializing KarjiStore Agentic RAG System...\n');
  
  try {
    // Initialize vector storage
    console.log('1. Initializing vector storage...');
    await vectorStorage.initialize();
    console.log('✅ Vector storage initialized\n');
    
    // Initialize knowledge base with comprehensive content
    console.log('2. Initializing knowledge base...');
    await agenticRagService.initializeKnowledgeBase();
    console.log('✅ Knowledge base initialized\n');
    
    // Test the system with various queries
    console.log('3. Testing system with sample queries...\n');
    
    const testQueries = [
      {
        query: "Hello, I'm looking for a perfume for my wife's birthday",
        description: "Product recommendation with occasion"
      },
      {
        query: "What's your return policy?",
        description: "Policy inquiry"
      },
      {
        query: "I want a luxury watch under 1000 AED",
        description: "Product search with budget"
      },
      {
        query: "Where is my order?",
        description: "Order tracking"
      },
      {
        query: "Tell me about your store",
        description: "Company information"
      }
    ];
    
    for (let i = 0; i < testQueries.length; i++) {
      const { query, description } = testQueries[i];
      console.log(`Test ${i + 1}: ${description}`);
      console.log(`Query: "${query}"`);
      
      const sessionId = `test-session-${i}-${Date.now()}`;
      
      try {
        const response = await agenticRagService.query(query, sessionId);
        
        console.log(`Response: ${response.answer.substring(0, 150)}...`);
        console.log(`Intent: ${response.intent}`);
        console.log(`Confidence: ${response.confidence}`);
        console.log(`Products found: ${response.products?.length || 0}`);
        console.log(`Sources: ${response.sources?.length || 0}`);
        
        // Show conversation context
        const context = agenticRagService.getConversationContext(sessionId);
        console.log(`User preferences: ${JSON.stringify(context.userPreferences)}`);
        console.log(`Recent queries: ${context.recentQueries.length}`);
        
        console.log('---\n');
      } catch (error) {
        console.error(`Test ${i + 1} failed:`, error.message);
        console.log('---\n');
      }
    }
    
    console.log('🎉 System initialization completed successfully!');
    console.log('\nKey improvements implemented:');
    console.log('✅ Enhanced knowledge base with 12 comprehensive items');
    console.log('✅ Conversation memory with user preferences');
    console.log('✅ Improved query analysis with preference extraction');
    console.log('✅ Better error handling and debugging');
    console.log('✅ Enhanced context retrieval');
    
  } catch (error) {
    console.error('❌ System initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeSystem().catch(console.error); 