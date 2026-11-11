// Paritet: engine/arvora-engine.js skal give præcis samme fordeling som motoren i prototype/index.html.
// Prototypen køres i den rigtige side (Playwright); modulet køres i Node. 1.500 tilfældige familier,
// både point- og kronemetoden, med arvelod, testamente, ting ingen ønsker og mange lige ønsker.
const { open } = require('./lib');
const path = require('path');

(async () => {
  const eng = await import(path.join(__dirname, '..', 'engine', 'arvora-engine.js'));
  const { browser, page } = await open({});
  let seed = 424242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cases = [];
  for (let t = 0; t < 1500; t++) {
    const n = 2 + Math.floor(rnd() * 5), m = 1 + Math.floor(rnd() * 14);
    const heirs = Array.from({ length: n }, (_, k) => ({ id: 'h' + (k + 1), name: 'Arving ' + (k + 1), rel: '', w: t % 5 === 4 ? [1, 0.5, 2, 0.25][Math.floor(rnd() * 4)] : 1, sig: '' }));
    const items = Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'Ting ' + (k + 1), group: 'Stue', k: 'thing', will: t % 7 === 6 && rnd() < 0.3 ? heirs[Math.floor(rnd() * n)].id : '' }));
    const pts = {}, bids = {};
    for (const h of heirs) {
      const p = {}, b = {};
      if (rnd() < 0.08) { pts[h.id] = {}; bids[h.id] = {}; continue; } // ønsker ikke noget
      let left = 100; const chip = t % 3 === 0 ? 5 : t % 3 === 1 ? 10 : 25; // grove point giver mange lige ønsker
      while (left > 0) { const it = items[Math.floor(rnd() * m)]; if (it.will) { if (items.every(x => x.will)) break; continue; } const c = Math.min(left, chip * (1 + Math.floor(rnd() * 4))); p[it.id] = (p[it.id] || 0) + c; left -= c; }
      pts[h.id] = p;
      for (const it of items) if (!it.will && rnd() < 0.6) b[it.id] = [500, 1000, 1500, 2000, 5000][Math.floor(rnd() * 5)];
      bids[h.id] = b;
    }
    const lod = Math.floor(rnd() * 4294967295) + 1;
    cases.push({ heirs, items, pts, bids, lod });
  }
  // prototypen
  const proto = await page.evaluate((cases) => cases.map(c => {
    S.heirs = c.heirs; S.items = c.items; S.pts = c.pts; S.bids = c.bids; S.lod = c.lod; S.submitted = {}; c.heirs.forEach(h => S.submitted[h.id] = true);
    const norm = r => ({
      out: Object.fromEntries(c.heirs.map(h => [h.id, r.out[h.id].map(x => x.i.id + (x.will ? '!' : '') + (x.lod ? '*' : ''))])),
      rest: r.rest.map(i => i.id), lod: r.lod, lodIds: [...r.lodIds].sort(), ef: (r.ef || []).map(([a, b]) => a.id + '>' + b.id), zero: (r.zero || []).map(h => h.id),
      settle: r.settle ? r.settle.map(s => [s.h.id, Math.round(s.diff * 100)]) : null,
    });
    S.method = 'point'; const p = norm(solvePoints()); S.method = 'kroner'; const k = norm(solveBids()); return { p, k };
  }), cases);
  let pass = 0, fail = 0;
  const norm = (c, r) => ({
    out: Object.fromEntries(c.heirs.map(h => [h.id, r.out[h.id].map(x => x.itemId + (x.will ? '!' : '') + (x.lod ? '*' : ''))])),
    rest: r.rest, lod: r.lod, lodIds: [...r.lodIds].sort(), ef: r.ef.map(([a, b]) => a + '>' + b), zero: r.zero,
    settle: r.settle ? r.settle.map(s => [s.heirId, Math.round(s.diff * 100)]) : null,
  });
  cases.forEach((c, k) => {
    const mp = norm(c, eng.solvePoints(c)), mk = norm(c, eng.solveBids(c));
    const okP = JSON.stringify(mp) === JSON.stringify(proto[k].p), okK = JSON.stringify(mk) === JSON.stringify(proto[k].k);
    if (okP && okK) pass++; else { fail++; if (fail <= 3) console.log('FAIL familie', k, okP ? 'kroner' : 'point', JSON.stringify({ modul: okP ? mk : mp, proto: okP ? proto[k].k : proto[k].p }).slice(0, 600)); }
  });
  console.log(`${fail ? 'FAIL' : 'PASS'} paritet prototype vs modul: ${pass} af ${cases.length} familier ens (point og kroner)`);
  await browser.close();
})();
