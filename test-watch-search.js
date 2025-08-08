import { vectorStorage } from './server/services/vector-storage.js';

async function testWatchSearch() {
  console.log('🧪 Testing Watch Search Fix...\n');
  
  try {
    // Initialize vector storage
    await vectorStorage.initialize();
    
    // Test watch search
    console.log('📋 Testing: "show me women watches under 300"');
    const results = await vectorStorage.searchProducts("show me women watches under 300", 5);
    
    console.log(`✅ Found ${results.length} products`);
    
    if (results.length > 0) {
      console.log('\n📋 Top 3 Results:');
      results.slice(0, 3).forEach((result, index) => {
        console.log(`${index + 1}. ${result.metadata.title}`);
        console.log(`   Score: ${result.score.toFixed(3)}`);
        console.log(`   Search Type: ${result.searchType}`);
        console.log(`   Is Watch: ${result.metadata.title.toLowerCase().includes('watch') ? 'YES' : 'NO'}`);
        console.log('');
      });
      
      // Check if we have watch products
      const watchProducts = results.filter(r => r.metadata.title.toLowerCase().includes('watch'));
      const womenProducts = results.filter(r => (r.content || '').toLowerCase().includes('women') || r.metadata.title.toLowerCase().includes('women') || r.metadata.title.toLowerCase().includes('ladies'));
      const withinBudget = results.filter(r => {
        const price = typeof r.metadata.price === 'string' ? parseFloat(r.metadata.price) : (r.metadata.price || 0);
        return price <= 300;
      });
      
      console.log(`✅ Watch products found: ${watchProducts.length}/${results.length}`);
      console.log(`✅ Women products found: ${womenProducts.length}/${results.length}`);
      console.log(`✅ <=300 AED products found: ${withinBudget.length}/${results.length}`);
      
      if (watchProducts.length > 0 && womenProducts.length > 0 && withinBudget.length > 0) {
        console.log('🎉 SUCCESS: Watch search (women + budget) is working correctly!');
      } else {
        console.log('❌ FAIL: Missing category/gender/budget alignment');
      }
    } else {
      console.log('❌ FAIL: No products found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testWatchSearch().catch(console.error); 