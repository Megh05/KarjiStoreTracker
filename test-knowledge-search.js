import { vectorStorage } from './server/services/vector-storage.js';

async function runQuery(q, limit = 5) {
  console.log(`\n=== Knowledge Query: "${q}" ===`);
  const results = await vectorStorage.searchKnowledge(q, limit);
  console.log(`Found ${results.length} results`);
  results.forEach((r, i) => {
    const title = (r.metadata.title || '');
    const type = (r.metadata.type || '');
    console.log(`${i + 1}. [${type}] ${title} | score=${r.score.toFixed(3)}`);
  });
  return results;
}

async function main() {
  await vectorStorage.initialize();

  const queries = [
    'what is your shipping policy',
    'how do I return a product',
    'where is my order',
    'what payment options do you accept',
    'are your products authentic',
    'perfume selection guide',
    'watch selection guide'
  ];

  for (const q of queries) {
    await runQuery(q, 5);
  }
}

main().catch(console.error);

