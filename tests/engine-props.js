// Egenskabstest af motoren som modul (uden browser). Invarianter, kanttilfælde, uafhængig reference (udtømmende
// søgning), determinisme, lodtrækningens fairness, ugyldige input. Alle linjer siger PASS/FAIL.
const path = require('path');
(async () => {
  const eng = await import(path.join(__dirname, '..', 'engine', 'arvora-engine.js'));
  const { solvePoints, solveBids, validatePoints, validateBids, lodtal, drawLod } = eng;
  let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const say = (ok, t) => console.log((ok ? 'PASS ' : 'FAIL ') + t);
  const mkHeirs = (n, w) => Array.from({ length: n }, (_, k) => ({ id: 'h' + (k + 1), name: 'A' + (k + 1), w: w ? w[k] : 1 }));
  const mkItems = (m, will) => Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), will: will ? will(k) : '' }));
  const spread = (items, chip) => { const p = {}; let left = 100; const free = items.filter(i => !i.will); if (!free.length) return p; while (left > 0) { const it = free[Math.floor(rnd() * free.length)]; const c = Math.min(left, chip * (1 + Math.floor(rnd() * 4))); p[it.id] = (p[it.id] || 0) + c; left -= c; } return p; };
  const v = (pts, h, i) => (pts[h] || {})[i] || 0;

  // --- 1. Invarianter over 3.000 tilfældige familier, 2–6 arvinger, 1–30 ting
  let inv = { cases: 0, dup: 0, lost: 0, zeroHolder: 0, willWrong: 0, restWrong: 0, ef1Mismatch: 0, lodClaimWrong: 0 };
  for (let t = 0; t < 3000; t++) {
    const n = 2 + Math.floor(rnd() * 5), m = 1 + Math.floor(rnd() * 30);
    const heirs = mkHeirs(n, t % 4 === 3 ? Array.from({ length: n }, () => [1, 0.5, 2, 0.25][Math.floor(rnd() * 4)]) : null);
    const items = mkItems(m, k => (t % 5 === 4 && rnd() < 0.25) ? 'h' + (1 + Math.floor(rnd() * n)) : '');
    const pts = {}; heirs.forEach(h => pts[h.id] = rnd() < 0.1 ? {} : spread(items, [1, 5, 10, 25][t % 4]));
    const lod = Math.floor(rnd() * 4294967295) + 1;
    const r = solvePoints({ heirs, items, pts, lod }); inv.cases++;
    const cnt = {}; heirs.forEach(h => r.out[h.id].forEach(x => cnt[x.itemId] = (cnt[x.itemId] || 0) + 1));
    if (Object.values(cnt).some(c => c > 1)) inv.dup++;
    const wanted = items.filter(i => !i.will && heirs.some(h => v(pts, h.id, i.id) > 0));
    if (wanted.some(i => cnt[i.id] !== 1)) inv.lost++;
    heirs.forEach(h => r.out[h.id].forEach(x => { if (!x.will && !v(pts, h.id, x.itemId)) inv.zeroHolder++; }));
    items.filter(i => i.will).forEach(i => { if (!r.out[i.will].some(x => x.itemId === i.id && x.will) || cnt[i.id] !== 1) inv.willWrong++; });
    const restExp = items.filter(i => !i.will && !heirs.some(h => v(pts, h.id, i.id) > 0)).map(i => i.id).sort().join();
    if (restExp !== [...r.rest].sort().join()) inv.restWrong++;
    // EF1 uafhængigt
    const U = {}; heirs.forEach(h => U[h.id] = r.out[h.id].filter(x => !x.will).reduce((s, x) => s + v(pts, h.id, x.itemId), 0));
    let ef1 = true; for (const a of heirs) for (const b of heirs) { if (a === b) continue; const vs = r.out[b.id].filter(x => !x.will).map(x => v(pts, a.id, x.itemId)); const ub = vs.reduce((s, x) => s + x, 0) - (vs.length ? Math.max(...vs) : 0); if (U[a.id] / a.w + 1e-9 < ub / b.w) ef1 = false; }
    if (ef1 !== (r.ef.length === 0)) inv.ef1Mismatch++;
    // lod-påstand: alt, der er markeret som lod, skal have mindst to arvinger med point > 0 (ellers var der intet at trække om)
    r.ties.forEach(tie => { if (tie.kind === 'item' && heirs.filter(h => v(pts, h.id, tie.itemId) > 0).length < 2) inv.lodClaimWrong++; });
  }
  say(inv.dup === 0, `ingen ting i to kasser (${inv.cases} familier)`);
  say(inv.lost === 0, 'alle ønskede ting fordelt præcis én gang');
  say(inv.zeroHolder === 0, 'ingen får en ting, de gav 0 point');
  say(inv.willWrong === 0, 'testamenteret gods går altid til den rette og kun dér');
  say(inv.restWrong === 0, 'restlisten er præcis de frie ting, ingen gav point');
  say(inv.ef1Mismatch === 0, 'EF1-flaget stemmer med en uafhængig beregning');
  say(inv.lodClaimWrong === 0, 'lod-markeringer peger kun på ting, mindst to ønskede');

  // --- 2. Uafhængig reference: udtømmende søgning, 2–4 arvinger, 2–8 ting (inkl. arvelod)
  let ref = { cases: 0, subopt: 0, weightedCases: 0 };
  const objOf = (heirs, items, pts, assign) => { const U = heirs.map(() => 0); assign.forEach((hi, ii) => { if (hi >= 0) U[hi] += v(pts, heirs[hi].id, items[ii].id); }); let p = 0, s = 0; U.forEach((u, k) => { if (u > 0) { p++; s += heirs[k].w * Math.log(u); } }); return p * 1e6 + s; };
  for (let t = 0; t < 600; t++) {
    const n = 2 + Math.floor(rnd() * 3), m = 2 + Math.floor(rnd() * 7);
    const heirs = mkHeirs(n, t % 2 ? Array.from({ length: n }, () => [1, 0.5, 2][Math.floor(rnd() * 3)]) : null); if (t % 2) ref.weightedCases++;
    const items = mkItems(m); const pts = {}; heirs.forEach(h => pts[h.id] = spread(items, [5, 10, 25][t % 3]));
    const r = solvePoints({ heirs, items, pts, lod: 7 + t }); ref.cases++;
    const assign = items.map(i => heirs.findIndex(h => r.out[h.id].some(x => x.itemId === i.id)));
    const got = objOf(heirs, items, pts, assign);
    let best = -Infinity; const a = new Array(m).fill(0); const total = Math.pow(n, m);
    for (let x = 0; x < total; x++) { let y = x; for (let k = 0; k < m; k++) { a[k] = y % n; y = Math.floor(y / n); } const o = objOf(heirs, items, pts, a); if (o > best) best = o; }
    if (best > got + 1e-6) ref.subopt++;
  }
  say(ref.subopt === 0, `bedste vægtede Nash-velfærd fundet hver gang mod udtømmende søgning (${ref.cases} familier, ${ref.weightedCases} med ulige arvelod)`);

  // --- 3. Determinisme: samme ønsker + samme lod = samme fordeling, uanset rækkefølge af arvinger og ting
  let det = 0;
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(rnd() * 4), m = 2 + Math.floor(rnd() * 10);
    const heirs = mkHeirs(n), items = mkItems(m); const pts = {}; heirs.forEach(h => pts[h.id] = spread(items, 25));
    const lod = 1 + Math.floor(rnd() * 1e9);
    const key = r => heirs.map(h => h.id + ':' + r.out[h.id].map(x => x.itemId).sort().join(',')).sort().join('|');
    const a = key(solvePoints({ heirs, items, pts, lod }));
    const shuf = x => [...x].sort(() => rnd() - 0.5);
    const b = key(solvePoints({ heirs: shuf(heirs), items: shuf(items), pts, lod }));
    if (a !== b) det++;
  }
  say(det === 0, 'samme lod og samme ønsker giver samme fordeling, også i ny rækkefølge (300 familier)');
  // og et andet lod kan give et andet resultat ved lige ønsker
  { const heirs = mkHeirs(3), items = mkItems(1); const pts = { h1: { i1: 100 }, h2: { i1: 100 }, h3: { i1: 100 } };
    const winners = new Set(); for (let l = 1; l < 50; l++) { const r = solvePoints({ heirs, items, pts, lod: l * 7919 }); winners.add(heirs.find(h => r.out[h.id].length).id); }
    say(winners.size === 3, 'ved helt lige ønsker afgør loddet, og alle tre kan vinde'); }

  // --- 4. Lodtrækningens fairness: 6.000 lod, 3 arvinger om samme ting, vindere jævnt fordelt (chi²)
  { const heirs = mkHeirs(3), items = mkItems(1); const pts = { h1: { i1: 100 }, h2: { i1: 100 }, h3: { i1: 100 } }; const c = { h1: 0, h2: 0, h3: 0 };
    for (let l = 0; l < 6000; l++) { const r = solvePoints({ heirs, items, pts, lod: drawLod(require('crypto').webcrypto) }); c[heirs.find(h => r.out[h.id].length).id]++; }
    const chi = Object.values(c).reduce((s, x) => s + (x - 2000) ** 2 / 2000, 0);
    say(chi < 9.21, `lodtrækning jævn over 6.000 træk: ${c.h1}/${c.h2}/${c.h3} (chi² ${chi.toFixed(2)} < 9,21)`); }
  // Kronemetoden: lige bud afgøres af loddet, jævnt
  { const heirs = mkHeirs(3), items = mkItems(1); const bids = { h1: { i1: 1000 }, h2: { i1: 1000 }, h3: { i1: 1000 } }; const c = { h1: 0, h2: 0, h3: 0 };
    for (let l = 0; l < 6000; l++) { const r = solveBids({ heirs, items, bids, lod: drawLod(require('crypto').webcrypto) }); c[heirs.find(h => r.out[h.id].length).id]++; }
    const chi = Object.values(c).reduce((s, x) => s + (x - 2000) ** 2 / 2000, 0);
    say(chi < 9.21, `kronemetoden, lige bud: ${c.h1}/${c.h2}/${c.h3} (chi² ${chi.toFixed(2)})`); }

  // --- 5. Kanttilfælde
  { const heirs = mkHeirs(6), items = mkItems(1); const pts = {}; heirs.forEach(h => pts[h.id] = { i1: 100 });
    const r = solvePoints({ heirs, items, pts, lod: 42 }); const got = heirs.filter(h => r.out[h.id].length);
    say(got.length === 1 && r.ties.length === 1 && r.ties[0].heirIds.length === 6 && r.zero.length === 5, 'alle seks vil have den samme ene ting: én får den ved lod, fem får ingen af deres ønsker, og det siges'); }
  { const heirs = mkHeirs(2), items = mkItems(10); const pts = { h1: {}, h2: {} }; items.forEach(i => pts.h1[i.id] = 10);
    const r = solvePoints({ heirs, items, pts, lod: 1 });
    say(r.out.h1.length === 10 && r.out.h2.length === 0 && r.zero.length === 0 && r.ef.length === 0, 'kun én ønsker noget: hun får det hele, den anden misunder ikke (ønskede intet)'); }
  { const heirs = mkHeirs(3), items = mkItems(4); const pts = { h1: { i1: 97, i2: 1, i3: 1, i4: 1 }, h2: { i1: 97, i2: 1, i3: 1, i4: 1 }, h3: { i2: 34, i3: 33, i4: 33 } };
    const r = solvePoints({ heirs, items, pts, lod: 5 }); const U = h => r.score[h];
    say(U('h3') > 0 && (U('h1') > 0 || U('h2') > 0), 'ekstremt skæve point: produktet beskytter mod, at nogen står uden alt, når det kan undgås'); }
  { const heirs = mkHeirs(2), items = mkItems(3, k => k === 0 ? 'h2' : ''); const pts = { h1: { i1: 50, i2: 50 }, h2: { i2: 100 } };
    const p = validatePoints(heirs, items, pts); const r = solvePoints({ heirs, items, pts, lod: 3 });
    say(p.length === 1 && p[0].heirId === 'h1' && p[0].used === 50, 'point på en testamenteret ting tæller ikke, og valideringen siger, at der mangler point');
    say(r.out.h2.some(x => x.itemId === 'i1' && x.will) && !r.out.h1.some(x => x.itemId === 'i1'), 'testamenteret ting går til arvingen i testamentet uanset point'); }
  { const heirs = mkHeirs(3), items = mkItems(3); const pts = { h1: { i1: 100 }, h2: {}, h3: { i2: 50, i3: 50 } };
    say(validatePoints(heirs, items, pts).length === 0, '"jeg ønsker ikke noget" (0 point) er gyldigt');
    say(validatePoints(heirs, items, { h1: { i1: 101 }, h2: {}, h3: { i2: 50, i3: 50 } }).length > 0, '101 point afvises');
    say(validatePoints(heirs, items, { h1: { i1: 60.5, i2: 39.5 }, h2: {}, h3: {} }).length > 0, 'halve point afvises');
    say(validateBids(heirs, items, { h1: { i1: -5 } }).length === 1 && validateBids(heirs, items, { h1: { i1: 2e9 } }).length === 1 && validateBids(heirs, items, { h1: { i1: 1200 } }).length === 0, 'negative og urealistisk høje bud afvises, almindelige bud godkendes'); }
  { const heirs = mkHeirs(3, [1, 0.5, 0.5]), items = mkItems(2); const bids = { h1: { i1: 10000 }, h2: { i2: 2000 }, h3: {} };
    const r = solveBids({ heirs, items, bids, lod: 9 }); const s = Object.fromEntries(r.settle.map(x => [x.heirId, Math.round(x.diff)]));
    say(r.total === 12000 && s.h1 === 4000 && s.h2 === -1000 && s.h3 === -3000, 'kronemetoden: udligning efter arvelod (1 : ½ : ½ af 12.000 = 6.000/3.000/3.000)'); }
  { const heirs = mkHeirs(2), items = mkItems(40); const pts = {}; heirs.forEach(h => pts[h.id] = spread(items, 1)); const t0 = Date.now();
    solvePoints({ heirs, items, pts, lod: 11 }); say(Date.now() - t0 < 4000, `40 ting, 2 arvinger, 1-points-spredning på ${Date.now() - t0} ms`); }
  { const heirs = mkHeirs(6), items = mkItems(120); const pts = {}; heirs.forEach(h => pts[h.id] = spread(items, 1)); const t0 = Date.now();
    const r = solvePoints({ heirs, items, pts, lod: 12 }); const dt = Date.now() - t0; const cnt = {}; heirs.forEach(h => r.out[h.id].forEach(x => cnt[x.itemId] = (cnt[x.itemId] || 0) + 1));
    say(dt < 15000 && !Object.values(cnt).some(c => c > 1), `6 arvinger, 120 ting på ${dt} ms, intet dobbelt`); }
  // lodtal er stabilt og i [0,1)
  { let ok = true; for (let k = 0; k < 1000; k++) { const x = lodtal(123456, 'h' + k, 'i' + (k * 7)); if (!(x >= 0 && x < 1) || x !== lodtal(123456, 'h' + k, 'i' + (k * 7))) ok = false; } say(ok, 'lodtal er stabilt og ligger i [0,1)'); }
  say(drawLod(require('crypto').webcrypto) > 0, 'drawLod giver et lod > 0 fra crypto');
})();
