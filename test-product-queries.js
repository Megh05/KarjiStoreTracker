import { vectorStorage } from './server/services/vector-storage.js';

function isWatch(r) {
  const t = (r.metadata.title || '').toLowerCase();
  const c = (r.content || '').toLowerCase();
  return /\bwatch|watches|timepiece|chronograph\b/.test(t) || /\bwatch|watches\b/.test(c);
}
function isPerfume(r) {
  const t = (r.metadata.title || '').toLowerCase();
  const c = (r.content || '').toLowerCase();
  return /\bperfume|fragrance|cologne|edp|edt\b/.test(t) || /\bperfume|fragrance|cologne\b/.test(c);
}
function isJewelry(r) {
  const t = (r.metadata.title || '').toLowerCase();
  const c = (r.content || '').toLowerCase();
  return /jewel|jewelry|jewellery|necklace|bracelet|ring|earring/.test(t) || /jewel|necklace|bracelet|ring|earring/.test(c);
}
function isWomen(r) {
  const t = (r.metadata.title || '').toLowerCase();
  const c = (r.content || '').toLowerCase();
  return /women|ladies|female|feminine/.test(t) || /women|ladies|female|feminine/.test(c);
}
function isMen(r) {
  const t = (r.metadata.title || '').toLowerCase();
  const c = (r.content || '').toLowerCase();
  return (/\bmen\b/.test(t) && !/women/.test(t)) || /male|masculine|gentlemen/.test(t) || /\bmen\b|male|masculine|gentlemen/.test(c);
}
function getPrice(r) {
  return typeof r.metadata.price === 'string' ? parseFloat(r.metadata.price) : (r.metadata.price || 0);
}

const tests = [
  { q: 'women watches under 300', expect: { cat: 'watch', gender: 'women', max: 300 } },
  { q: 'men watches under 1000', expect: { cat: 'watch', gender: 'men', max: 1000 } },
  { q: 'perfumes for women less than 200', expect: { cat: 'perfume', gender: 'women', max: 200 } },
  { q: 'men cologne between 150 and 400', expect: { cat: 'perfume', gender: 'men', min: 150, max: 400 } },
  { q: 'elegant jewelry for women', expect: { cat: 'jewelry', gender: 'women' } },
];

function catMatchFn(cat) {
  if (cat === 'watch') return isWatch;
  if (cat === 'perfume') return isPerfume;
  if (cat === 'jewelry') return isJewelry;
  return () => true;
}

async function run() {
  await vectorStorage.initialize();
  let passed = 0;
  for (const t of tests) {
    console.log(`\n=== Query: ${t.q} ===`);
    const res = await vectorStorage.searchProducts(t.q, 5);
    console.log(`Found ${res.length} results`);
    res.forEach((r, i) => {
      console.log(`${i + 1}. ${r.metadata.title} | price=${getPrice(r)} | score=${r.score.toFixed(3)}`);
    });
    const cm = catMatchFn(t.expect.cat);
    const genderOk = t.expect.gender === 'women' ? isWomen : t.expect.gender === 'men' ? isMen : () => true;
    const priceOk = (r) => {
      const p = getPrice(r);
      if (t.expect.min != null && p < t.expect.min) return false;
      if (t.expect.max != null && p > t.expect.max) return false;
      return true;
    };
    const checks = res.map(r => ({ cat: cm(r), gender: genderOk(r), price: priceOk(r) }));
    const okCount = checks.filter(c => c.cat && c.gender && c.price).length;
    const ok = okCount >= Math.min(3, res.length); // require majority of top results to match
    console.log(`Matches in top results: ${okCount}/${res.length}`);
    console.log(ok ? '✅ PASS' : '❌ FAIL');
    if (ok) passed++;
  }
  console.log(`\nSummary: ${passed}/${tests.length} passed`);
}

run().catch(console.error);

