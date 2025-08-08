import { vectorStorage } from './server/services/vector-storage.js';

async function runQuery(q, limit = 5) {
  console.log(`\n=== Query: "${q}" ===`);
  const results = await vectorStorage.searchProducts(q, limit);
  console.log(`Found ${results.length} results`);
  results.slice(0, 5).forEach((r, i) => {
    const title = (r.metadata.title || '').toLowerCase();
    const content = (r.content || '').toLowerCase();
    const price = typeof r.metadata.price === 'string' ? parseFloat(r.metadata.price) : (r.metadata.price || 0);
    const isWatch = /watch|watches/.test(title) || /watch|watches/.test(content);
    const isPerfume = /perfume|fragrance|cologne|edp|edt/.test(title) || /perfume|fragrance|cologne/.test(content);
    const isJewelry = /jewel|jewelry|jewellery|necklace|bracelet|ring|earring/.test(title) || /jewel|necklace|bracelet|ring|earring/.test(content);
    console.log(`${i + 1}. ${r.metadata.title} | ${price} | score=${r.score.toFixed(3)} | watch=${isWatch} | perfume=${isPerfume} | jewelry=${isJewelry}`);
  });
  return results;
}

async function main() {
  await vectorStorage.initialize();

  const queries = [
    'show me women watches under 300',
    'men watches under 1000',
    'perfumes for women less than 200',
    'men cologne between 150 and 400',
    'elegant jewelry for women',
  ];

  for (const q of queries) {
    await runQuery(q, 5);
  }
}

main().catch(console.error);

