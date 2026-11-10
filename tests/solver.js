// Stress test of the distribution engine, run inside the real page so the exact shipped code is tested.
const { open } = require('./lib');

(async () => {
  const { browser, page, errors } = await open({});
  const res = await page.evaluate(() => {
    // deterministic RNG
    let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const mk = (n, m, weights) => {
      const heirs = Array.from({ length: n }, (_, k) => ({ id: 'h' + (k + 1), name: 'H' + (k + 1), rel: '', w: weights ? weights[k] : 1, sig: '' }));
      const items = Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '' }));
      const pts = {};
      for (const h of heirs) { const p = {}; let left = 20; // 20 chips of 5 points
        while (left > 0) { const it = items[Math.floor(rnd() * m)]; const c = Math.min(left, 1 + Math.floor(rnd() * 6)); p[it.id] = (p[it.id] || 0) + c * 5; left -= c; }
        pts[h.id] = p; }
      return { heirs, items, pts };
    };
    const setS = (c) => { S.heirs = c.heirs; S.items = c.items; S.pts = c.pts; S.bids = {}; S.method = 'point'; S.submitted = {}; c.heirs.forEach(h => S.submitted[h.id] = true); };
    const val = (c, h, i) => (c.pts[h.id] || {})[i.id] || 0;
    const objOf = (c, assign) => { // assign: item index -> heir index or -1
      const U = c.heirs.map(() => 0); assign.forEach((hi, ii) => { if (hi >= 0) U[hi] += val(c, c.heirs[hi], c.items[ii]); });
      let p = 0, s = 0; U.forEach((u, k) => { if (u > 0) { p++; s += c.heirs[k].w * Math.log(u); } }); return { key: p * 1e6 + s, U };
    };
    const brute = (c) => { // exhaustive best Nash welfare (same objective as the page)
      const n = c.heirs.length, m = c.items.length; let best = -Infinity, bestU = null; const a = new Array(m).fill(0);
      const total = Math.pow(n, m);
      for (let x = 0; x < total; x++) { let y = x; for (let k = 0; k < m; k++) { a[k] = y % n; y = Math.floor(y / n); }
        const o = objOf(c, a); if (o.key > best + 1e-12) { best = o.key; bestU = o.U.slice(); } }
      return { best, bestU };
    };
    const out = { cases: 0, subopt: 0, worstGapPct: 0, ef1Fail: 0, efFlagMismatch: 0, paretoMoveSwap: 0, zeroPointHolder: 0, itemsLost: 0, zeroGetters: 0, examples: [] };
    for (let t = 0; t < 400; t++) {
      const n = 2 + Math.floor(rnd() * 3), m = 3 + Math.floor(rnd() * 6);
      const weights = t % 4 === 3 ? Array.from({ length: n }, () => [1, 0.5, 2, 1][Math.floor(rnd() * 4)]) : null;
      const c = mk(n, m, weights); setS(c);
      const r = solvePoints(); out.cases++;
      // each wanted item placed once
      const placed = {}; c.heirs.forEach(h => r.out[h.id].forEach(x => placed[x.i.id] = (placed[x.i.id] || 0) + 1));
      const wanted = c.items.filter(i => c.heirs.some(h => val(c, h, i) > 0));
      if (wanted.some(i => placed[i.id] !== 1) || r.rest.some(i => placed[i.id])) out.itemsLost++;
      c.heirs.forEach(h => r.out[h.id].forEach(x => { if (!val(c, h, x.i)) out.zeroPointHolder++; }));
      const assign = c.items.map(i => c.heirs.findIndex(h => r.out[h.id].some(x => x.i === i)));
      const got = objOf(c, assign); const b = brute(c);
      if (got.U.some(u => u === 0)) out.zeroGetters++;
      if (b.best > got.key + 1e-6) { out.subopt++;
        // gap measured as the worst-off heir's loss vs the optimum
        const minGot = Math.min(...got.U), minBest = Math.min(...b.bestU); const gap = minBest ? 100 * (minBest - minGot) / minBest : 0; if (gap > out.worstGapPct) out.worstGapPct = gap;
        if (out.examples.length < 3) out.examples.push({ n, m, got: got.U, best: b.bestU, w: c.heirs.map(h => h.w) }); }
      // independent weighted EF1
      let ef1 = true; for (const a of c.heirs) for (const bb of c.heirs) { if (a === bb) continue; const ua = r.out[a.id].reduce((s, x) => s + val(c, a, x.i), 0); const vs = r.out[bb.id].map(x => val(c, a, x.i)); const ub = vs.reduce((s, x) => s + x, 0) - (vs.length ? Math.max(...vs) : 0); if (ua / a.w + 1e-9 < ub / bb.w) ef1 = false; }
      if (!ef1) out.ef1Fail++; if (ef1 !== (r.ef.length === 0)) out.efFlagMismatch++;
      // is there a single move or pairwise swap that makes someone happier and nobody less happy? (the page always claims there is none)
      const U0 = got.U; let pareto = false;
      for (let ii = 0; ii < m && !pareto; ii++) { if (assign[ii] < 0) continue; for (let hb = 0; hb < n; hb++) { if (hb === assign[ii]) continue; const a2 = assign.slice(); a2[ii] = hb; const U1 = objOf(c, a2).U; if (U1.every((u, k) => u >= U0[k]) && U1.some((u, k) => u > U0[k])) pareto = true; } }
      for (let ii = 0; ii < m && !pareto; ii++) for (let jj = ii + 1; jj < m; jj++) { if (assign[ii] < 0 || assign[jj] < 0 || assign[ii] === assign[jj]) continue; const a2 = assign.slice(); a2[ii] = assign[jj]; a2[jj] = assign[ii]; const U1 = objOf(c, a2).U; if (U1.every((u, k) => u >= U0[k]) && U1.some((u, k) => u > U0[k])) { pareto = true; break; } }
      if (pareto) out.paretoMoveSwap++;
    }
    // ---- ties: everyone gives the same points. Who wins, by position in the list?
    const tie = {};
    for (const order of [['A', 'B', 'C'], ['C', 'A', 'B'], ['B', 'C', 'A']]) {
      const heirs = order.map((nm, k) => ({ id: 'h' + nm, name: nm, rel: '', w: 1, sig: '' }));
      const items = [{ id: 'i1', name: 'Ur', group: 'Stue', k: 'clock', will: '' }];
      const pts = {}; heirs.forEach(h => pts[h.id] = { i1: 100 }); setS({ heirs, items, pts });
      const r = solvePoints(); const w = heirs.find(h => r.out[h.id].length); tie[order.join('')] = { winner: w.name, ef: r.ef.length, pos: order.indexOf(w.name) + 1 };
    }
    out.tieOneItem = tie;
    // identical lists across 3 heirs, 6 items
    { const heirs = ['A', 'B', 'C'].map(nm => ({ id: 'h' + nm, name: nm, rel: '', w: 1, sig: '' })); const items = Array.from({ length: 6 }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '' }));
      const p = { i1: 40, i2: 25, i3: 15, i4: 10, i5: 5, i6: 5 }; const pts = { hA: { ...p }, hB: { ...p }, hC: { ...p } }; setS({ heirs, items, pts }); const r = solvePoints();
      out.identical = heirs.map(h => h.name + ': ' + r.out[h.id].map(x => x.i.name + '(' + p[x.i.id] + ')').join('+') + ' = ' + r.score(h)); out.identicalEf = r.ef.map(([a, b]) => a.name + '>' + b.name); }
    // kroner ties
    { const heirs = ['A', 'B', 'C'].map(nm => ({ id: 'h' + nm, name: nm, rel: '', w: 1, sig: '' })); const items = [{ id: 'i1', name: 'Ur', group: 'Stue', k: 'clock', will: '' }];
      S.heirs = heirs; S.items = items; S.bids = { hA: { i1: 3000 }, hB: { i1: 3000 }, hC: { i1: 3000 } }; S.method = 'kroner'; const r = solveBids(); out.kronerTie = heirs.find(h => r.out[h.id].length).name;
      S.heirs = [heirs[2], heirs[0], heirs[1]]; const r2 = solveBids(); out.kronerTieReordered = S.heirs.find(h => r2.out[h.id].length).name; }
    // kroner: settlement sums to zero, incl. weights
    { const c = mk(4, 12, [1, 1, 0.5, 0.5]); S.heirs = c.heirs; S.items = c.items; S.method = 'kroner'; S.bids = {}; c.heirs.forEach(h => { S.bids[h.id] = {}; c.items.forEach(i => { if (rnd() < 0.6) S.bids[h.id][i.id] = 100 * Math.floor(1 + rnd() * 60); }); });
      const r = solveBids(); out.kronerSettleSum = r.settle.reduce((a, s) => a + s.diff, 0); out.kronerShares = r.settle.map(s => Math.round(s.share)); out.kronerV = r.V; }
    // ---- speed
    out.speed = [];
    for (const [n, m] of [[3, 16], [4, 60], [6, 150], [8, 300]]) { const c = mk(n, m); setS(c); const t0 = performance.now(); const r = solvePoints(); const ms = performance.now() - t0; out.speed.push({ heirs: n, items: m, ms: Math.round(ms), ef: r.ef.length }); }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  console.log('errors', errors);
  await browser.close();
})().catch(e => { console.error('CRASH', e); process.exit(1); });
