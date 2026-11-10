// Finds the smallest concrete family where the engine hands the same thing to two people.
const { open } = require('./lib');
(async () => {
  const { browser, page } = await open({});
  const res = await page.evaluate(() => {
    let seed = 777; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    let dups = 0, total = 0, example = null, demoLike = 0;
    for (let t = 0; t < 2000; t++) {
      const n = 3, m = 3 + Math.floor(rnd() * 5);
      const heirs = ['Mette', 'Lars', 'Anna'].map((nm, k) => ({ id: 'h' + (k + 1), name: nm, rel: '', w: 1, sig: '' }));
      const items = Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'Ting ' + (k + 1), group: 'Stue', k: 'thing', will: '' }));
      const pts = {}; for (const h of heirs) { const p = {}; let left = 20; while (left > 0) { const it = items[Math.floor(rnd() * m)]; const c = Math.min(left, 1 + Math.floor(rnd() * 8)); p[it.id] = (p[it.id] || 0) + c * 5; left -= c; } pts[h.id] = p; }
      S.heirs = heirs; S.items = items; S.pts = pts; S.method = 'point';
      const r = solvePoints(); total++;
      const cnt = {}; heirs.forEach(h => r.out[h.id].forEach(x => cnt[x.i.id] = (cnt[x.i.id] || 0) + 1));
      const d = Object.entries(cnt).filter(([, c]) => c > 1);
      if (d.length) { dups++; if (!example || m < example.m) example = { m, pts, out: Object.fromEntries(heirs.map(h => [h.name, r.out[h.id].map(x => x.i.name + ' [' + x.val + ']')])), dup: d.map(([id]) => items.find(i => i.id === id).name) }; }
    }
    return { total, dups, example };
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
