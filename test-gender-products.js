// Test script for gender-specific product search
import { vectorStorage } from './server/services/vector-storage.js';

async function testGenderSpecificSearch() {
  console.log('🧪 Testing Gender-Specific Product Search\n');
  
  try {
    // Initialize storage
    await vectorStorage.initialize();
    
    // Test queries
    const testQueries = [
      "women watches",
      "men watches",
      "ladies perfume",
      "gentlemen cologne",
      "watches" // non-gender specific for comparison
    ];
    
    for (const query of testQueries) {
      console.log(`\n📋 Testing query: "${query}"`);
      
      const results = await vectorStorage.searchProducts(query, 5);
      
      console.log(`Found ${results.length} results`);
      
      if (results.length > 0) {
        console.log('Top results:');
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.metadata.title} (score: ${result.score.toFixed(2)})`);
        });
      } else {
        console.log('No results found');
      }
    }
    
    console.log('\n✅ Gender-specific product search test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGenderSpecificSearch().catch(console.error);