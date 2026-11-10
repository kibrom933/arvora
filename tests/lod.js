// Lottery tests: equal chance whatever the place on the list, same lot = same result, honest display.
const fs = require('fs');
const path = require('path');
const { open, overflow, ROOT, FIX } = require('./lib');
const SH = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SH, { recursive: true });
const log = []; const ok = (name, cond, extra) => log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  -> ' + String(extra).slice(0, 500) : ''));
const nav = async (page, v) => { await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(150); };

(async () => {
  // ---------- 1-5: the engine, inside the real page ----------
  {
    const { browser, page, errors } = await open({});
    const r = await page.evaluate(() => {
      let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      const lot32 = () => ((rnd() * 65536) << 16 | (rnd() * 65536)) >>> 0 || 1;
      const heirs3 = (ids) => ids.map((id, k) => ({ id, name: 'P' + (k + 1), rel: '', w: 1, sig: '' }));
      const out = {};
      const chi = c => { const n = c.reduce((a, b) => a + b, 0), e = n / c.length; return +c.reduce((a, x) => a + (x - e) * (x - e) / e, 0).toFixed(2); };
      // 1. everyone gives 100 p to one thing: who wins, by place on the list?
      for (const [label, ids] of [['plain ids', ['h1', 'h2', 'h3']], ['real ids', ['h1794220000001', 'h1794220000777', 'h1794221234567']], ['four heirs', ['h1', 'h2', 'h3', 'h4']]]) {
        const c = ids.map(() => 0);
        for (let t = 0; t < 6000; t++) { S.lod = lot32(); S.heirs = heirs3(ids); S.items = [{ id: 'i' + (t % 7 + 1), name: 'Ur', group: 'Stue', k: 'clock', will: '', no: 1 }]; S.pts = {}; ids.forEach(id => S.pts[id] = { [S.items[0].id]: 100 }); S.method = 'point';
          const res = solvePoints(); c[S.heirs.findIndex(h => res.out[h.id].length)]++; }
        out['point ' + label] = { wins: c, chi2: chi(c) };
      }
      // same, kroner
      { const ids = ['h1', 'h2', 'h3']; const c = [0, 0, 0];
        for (let t = 0; t < 6000; t++) { S.lod = lot32(); S.heirs = heirs3(ids); S.items = [{ id: 'i3', name: 'Ur', group: 'Stue', k: 'clock', will: '', no: 1 }]; S.bids = { h1: { i3: 3000 }, h2: { i3: 3000 }, h3: { i3: 3000 } }; S.method = 'kroner';
          const res = solveBids(); c[S.heirs.findIndex(h => res.out[h.id].length)]++; }
        out['kroner'] = { wins: c, chi2: chi(c) }; }
      // 2. identical wish lists over 6 things: who gets the best box (40 p)?
      { const ids = ['h1', 'h2', 'h3']; const c = [0, 0, 0]; let noSentence = 0; S.method = 'point';
        for (let t = 0; t < 3000; t++) { S.lod = lot32(); S.heirs = heirs3(ids); S.items = Array.from({ length: 6 }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '', no: k + 1 }));
          const p = { i1: 40, i2: 25, i3: 15, i4: 10, i5: 5, i6: 5 }; S.pts = { h1: { ...p }, h2: { ...p }, h3: { ...p } };
          const res = solvePoints(); c[S.heirs.findIndex(h => res.score(h) === 40)]++; if (!res.lod.length) noSentence++; }
        out['identical lists'] = { bestBox: c, chi2: chi(c), casesWithoutLotteryNote: noSentence }; }
      // 3. same lot => same result, also when the list order changes
      { let diff = 0, orderDiff = 0;
        for (let t = 0; t < 300; t++) { S.lod = lot32(); S.method = 'point'; S.heirs = heirs3(['h1', 'h2', 'h3']); S.items = Array.from({ length: 5 }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '', no: k + 1 }));
          S.pts = { h1: { i1: 50, i2: 50 }, h2: { i1: 50, i2: 50 }, h3: { i1: 100 } };
          const sig = () => { const res = solvePoints(); return ['h1', 'h2', 'h3'].map(id => id + ':' + res.out[id].map(x => x.i.id).sort().join(',')).join(' '); };
          const a = sig(), b = sig(); if (a !== b) diff++;
          S.heirs = [S.heirs[2], S.heirs[0], S.heirs[1]]; if (sig() !== a) orderDiff++; }
        out['repeat'] = { differentOnRepeat: diff, differentWhenListReordered: orderDiff }; }
      // 4. random families: still the best split, nothing lost, and every lottery note is true
      { const res = { cases: 0, subopt: 0, dup: 0, ef: 0, wrongNote: 0, notes: 0, notWinnerByLot: 0 };
        const val = (c, h, i) => (c.pts[h.id] || {})[i.id] || 0;
        for (let t = 0; t < 1200; t++) {
          const n = 2 + Math.floor(rnd() * 3), m = 3 + Math.floor(rnd() * (n > 3 ? 6 : 8)); S.lod = lot32(); S.method = 'point';
          const heirs = Array.from({ length: n }, (_, k) => ({ id: 'h' + (k + 1), name: 'H' + (k + 1), rel: '', w: t % 5 === 4 ? [1, .5, 2][Math.floor(rnd() * 3)] : 1, sig: '' }));
          const items = Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '', no: k + 1 }));
          const pts = {}; for (const h of heirs) { const p = {}; let left = 20; const coarse = t % 3 === 0; while (left > 0) { const it = items[Math.floor(rnd() * (coarse ? Math.min(3, m) : m))]; const c = Math.min(left, coarse ? 10 : 1 + Math.floor(rnd() * 6)); p[it.id] = (p[it.id] || 0) + c * 5; left -= c; } pts[h.id] = p; }
          S.heirs = heirs; S.items = items; S.pts = pts; const c = { heirs, items, pts };
          const r = solvePoints(); res.cases++;
          const cnt = {}; heirs.forEach(h => r.out[h.id].forEach(x => cnt[x.i.id] = (cnt[x.i.id] || 0) + 1)); if (Object.values(cnt).some(x => x > 1) || items.some(i => heirs.some(h => val(c, h, i)) && !cnt[i.id])) res.dup++;
          if (r.ef.length) res.ef++;
          const assign = items.map(i => heirs.findIndex(h => r.out[h.id].some(x => x.i === i)));
          const objOf = a => { const U = heirs.map(() => 0); a.forEach((hi, ii) => { if (hi >= 0) U[hi] += val(c, heirs[hi], items[ii]); }); let p = 0, s = 0; U.forEach((u, k) => { if (u > 0) { p++; s += heirs[k].w * Math.log(u); } }); return p * 1e6 + s; };
          const got = objOf(assign); let best = -Infinity; const a = new Array(m).fill(0), total = Math.pow(n, m);
          for (let x = 0; x < total; x++) { let y = x; for (let k = 0; k < m; k++) { a[k] = y % n; y = Math.floor(y / n); } const o = objOf(a); if (o > best) best = o; }
          if (best > got + 1e-6) res.subopt++;
          // every item marked "lod" must really have an equally good alternative owner or swap; and the owner must hold the highest lot number among single-move ties
          res.notes += r.lod.length;
          for (let ii = 0; ii < m; ii++) { if (assign[ii] < 0) continue; const tiedWith = []; for (let hb = 0; hb < n; hb++) { if (hb === assign[ii] || !val(c, heirs[hb], items[ii])) continue; const a2 = assign.slice(); a2[ii] = hb; if (Math.abs(objOf(a2) - got) <= 1e-9) tiedWith.push(hb); }
            if (tiedWith.length) { if (!r.lodIds.has(items[ii].id)) res.wrongNote++; if (tiedWith.some(hb => lodtal(heirs[hb], items[ii]) > lodtal(heirs[assign[ii]], items[ii]))) res.notWinnerByLot++; } }
        }
        out['random families'] = res; }
      // 5. speed with the lottery checks on
      { out.speed = []; for (const [n, m] of [[3, 16], [4, 60], [6, 150], [8, 300]]) { S.lod = lot32(); const heirs = Array.from({ length: n }, (_, k) => ({ id: 'h' + (k + 1), name: 'H' + (k + 1), rel: '', w: 1, sig: '' })); const items = Array.from({ length: m }, (_, k) => ({ id: 'i' + (k + 1), name: 'T' + (k + 1), group: 'Stue', k: 'thing', will: '', no: k + 1 }));
          const pts = {}; for (const h of heirs) { const p = {}; let left = 20; while (left > 0) { const it = items[Math.floor(rnd() * m)]; const c = Math.min(left, 1 + Math.floor(rnd() * 6)); p[it.id] = (p[it.id] || 0) + c * 5; left -= c; } pts[h.id] = p; }
          S.heirs = heirs; S.items = items; S.pts = pts; const t0 = performance.now(); solvePoints(); out.speed.push(n + 'x' + m + ': ' + Math.round(performance.now() - t0) + ' ms'); } }
      return out;
    });
    log.push('INFO engine: ' + JSON.stringify(r, null, 1));
    const lim = 13.8; // chi-square, 2 d.f., p = 0.001 (16.3 for 3 d.f.)
    ok('1a point: three heirs win equally often whatever their place on the list', r['point plain ids'].chi2 < lim, JSON.stringify(r['point plain ids']));
    ok('1b point: same with realistic ids', r['point real ids'].chi2 < lim, JSON.stringify(r['point real ids']));
    ok('1c point: four heirs', r['point four heirs'].chi2 < 16.3, JSON.stringify(r['point four heirs']));
    ok('1d kroner: equal chance at equal bids', r['kroner'].chi2 < lim, JSON.stringify(r['kroner']));
    ok('2a identical lists: the best box goes to each equally often', r['identical lists'].chi2 < lim, JSON.stringify(r['identical lists']));
    ok('2b identical lists: always disclosed as lottery', r['identical lists'].casesWithoutLotteryNote === 0);
    ok('3a same lot, same result every time', r.repeat.differentOnRepeat === 0);
    ok('3b same lot, same result when the list order changes', r.repeat.differentWhenListReordered === 0, r.repeat.differentWhenListReordered + ' of 300');
    const f = r['random families'];
    ok('4a 1,200 families: always the best possible split', f.subopt === 0, f.subopt);
    ok('4b nothing doubled or lost', f.dup === 0, f.dup);
    ok('4c every real tie is disclosed', f.wrongNote === 0, f.wrongNote + ' undisclosed; ' + f.notes + ' notes in total');
    ok('4d the winner of a tie is always the one with the highest lot number', f.notWinnerByLot === 0, f.notWinnerByLot);
    ok('engine: no page errors', errors.length === 0, errors.join('|'));
    await browser.close();
  }
  // ---------- 6: what the family sees, point method ----------
  {
    const init = `window.__saved=[];window.claude={use:async(n)=>n==='downloads'?{save:async(o)=>{const b=await o.data.arrayBuffer();window.__saved.push(Array.from(new Uint8Array(b)))}}:null};`;
    const { browser, page, errors } = await open({ init });
    await page.evaluate(() => { S.pts = { h1: { i3: 100 }, h2: { i3: 100 }, h3: { i3: 100 } }; S.submitted = { h1: true, h2: true, h3: true }; save(); });
    await nav(page, 'oversigt'); await nav(page, 'fordeling');
    ok('6a before dealing: the page says a lot decides ties and cannot be redrawn', /afgør et lod det/.test(await page.locator('main').innerText()));
    await page.screenshot({ path: path.join(SH, 'lod-foer.png') });
    await page.click('#reveal'); await page.waitForTimeout(1500);
    const txt = await page.locator('main').innerText();
    const winner = await page.evaluate(() => S.heirs.find(h => solvePoints().out[h.id].some(x => x.i.id === 'i3')).name);
    ok('6b result: lottery card names all three and the winner', txt.includes('Afgjort ved lodtrækning') && txt.includes('Bornholmerur: Mette, Lars og Anna gav alle 100 p. Loddet faldt på ' + winner + '.'), (txt.match(/Bornholmerur: [^\n]*/) || [''])[0]);
    ok('6c result: no green "Ingen misunder de andre"', !txt.includes('Ingen misunder de andre'));
    const losers = ['Mette', 'Lars', 'Anna'].filter(n => n !== winner);
    ok('6d result: says plainly who got none of their wishes', txt.includes(losers.join(' og ') + ' fik ingen af deres ønsker'), (txt.match(/[^\n]*fik ingen af[^\n]*/) || [''])[0]);
    ok('6e result: lead no longer claims nobody is overlooked', !txt.includes('uden at nogen bliver overset'));
    ok('6f box row marked "lod"', /100 p · lod/.test(txt));
    await page.locator('details.why summary').nth(1).click();
    ok('6g "Hvorfor" explains it was the lottery', (await page.locator('details.why').nth(1).innerText()).includes('(lodtrækning)'));
    await page.waitForTimeout(2500); await page.screenshot({ path: path.join(SH, 'lod-resultat.png'), fullPage: true });
    ok('6h no sideways scroll', (await overflow(page)).length === 0, (await overflow(page)).join('|'));
    // no re-roll: change nothing, deal again, reload
    await page.evaluate(() => { S.submitted.h2 = false; invalidate(); S.submitted.h2 = true; S.revealed = true; save(); render(); });
    const again = await page.evaluate(() => S.heirs.find(h => solvePoints().out[h.id].some(x => x.i.id === 'i3')).name);
    await page.reload(); await page.waitForTimeout(200);
    const afterReload = await page.evaluate(() => S.heirs.find(h => solvePoints().out[h.id].some(x => x.i.id === 'i3')).name);
    ok('6i dealing again or reloading gives the same winner', again === winner && afterReload === winner, [winner, again, afterReload].join(','));
    // signed document, copy and PDF
    await page.evaluate(() => { S.heirs.forEach(h => h.sig = h.name); save(); }); await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.waitForTimeout(300);
    ok('6j signed list has a lottery section', (await page.locator('.doc').innerText()).includes('Afgjort ved lodtrækning'));
    await page.click('#copy'); await page.waitForTimeout(150); const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok('6k copied list has it too', clip.includes('Afgjort ved lodtrækning:') && clip.includes('Loddet faldt på ' + winner), clip.split('\n').slice(-3).join(' / '));
    await page.click('#pdf'); await page.waitForTimeout(800); const pdf = await page.evaluate(() => window.__saved[0]); if (pdf) fs.writeFileSync(path.join(ROOT, 'out', 'out-lod.pdf'), Buffer.from(pdf));
    ok('6l PDF made', !!pdf);
    await page.screenshot({ path: path.join(SH, 'lod-underskrift.png'), fullPage: true });
    ok('6 no page errors', errors.length === 0, errors.join('|'));
    await browser.close();
    // phone
    const m = await open({ device: 'iPhone 13' });
    await m.page.evaluate(() => { S.pts = { h1: { i3: 100 }, h2: { i3: 100 }, h3: { i3: 100 } }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(m.page, 'oversigt'); await nav(m.page, 'fordeling'); await m.page.waitForTimeout(400);
    ok('6m phone: no sideways scroll on the result', (await overflow(m.page)).length === 0, (await overflow(m.page)).join('|'));
    await m.page.locator('.chk.lod').scrollIntoViewIfNeeded(); await m.page.evaluate(() => scrollBy(0, -140)); await m.page.waitForTimeout(200);
    await m.page.screenshot({ path: path.join(SH, 'lod-mobil.png') });
    await m.browser.close();
    const d = await open({ dark: true });
    await d.page.evaluate(() => { S.pts = { h1: { i3: 100 }, h2: { i3: 100 }, h3: { i3: 100 } }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(d.page, 'oversigt'); await nav(d.page, 'fordeling'); await d.page.waitForTimeout(400); await d.page.screenshot({ path: path.join(SH, 'lod-moerk.png') });
    await d.browser.close();
  }
  // ---------- 7: two-person swap tie, and the example family ----------
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.pts = { h1: { i1: 50, i3: 50 }, h2: { i1: 50, i3: 50 }, h3: { i5: 100 } }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(page, 'oversigt'); await nav(page, 'fordeling'); await page.waitForTimeout(300);
    const t = await page.locator('.chk.lod').innerText().catch(() => '');
    ok('7a two heirs, same two things at 50/50: disclosed as a lottery between them', /Mette og Lars stod lige om/.test(t), t.replace(/\n/g, ' | '));
    ok('7b nobody got 0 %, so no warning card', !(await page.locator('main').innerText()).includes('fik ingen af'));
    await browser.close();
    const e = await open({});
    const demo = await e.page.evaluate(() => { const seen = new Set(); let notes = 0; for (let k = 1; k <= 200; k++) { S.lod = k * 2654435761 >>> 0; const r = solvePoints(); notes += r.lod.length; seen.add(S.heirs.map(h => r.out[h.id].map(x => x.i.id).sort().join(',')).join(' | ')); } return { differentResults: seen.size, notes, result: [...seen][0] }; });
    ok('7c the example family (Mette, Lars, Anna) has no ties: same result for every lot, all green as before', demo.differentResults === 1 && demo.notes === 0, JSON.stringify(demo));
    await e.page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); }); await nav(e.page, 'oversigt'); await nav(e.page, 'fordeling');
    ok('7d example still shows "Ingen misunder de andre"', (await e.page.locator('main').innerText()).includes('Ingen misunder de andre'));
    await e.browser.close();
  }
  // ---------- 8: kroner ----------
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.method = 'kroner'; S.bids.h1.i3 = 4500; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(page, 'oversigt'); await nav(page, 'fordeling'); await page.waitForTimeout(300);
    const t = await page.locator('main').innerText(); const w = await page.evaluate(() => S.heirs.find(h => solveBids().out[h.id].some(x => x.i.id === 'i3')).name);
    ok('8a kroner: equal top bids are decided by lot and shown', t.includes('Bornholmerur: Mette og Lars bød begge 4.500 kr. Loddet faldt på ' + w + '.'), (t.match(/Bornholmerur: [^\n]*/) || [''])[0]);
    ok('8b kroner: settlement still sums to zero', Math.abs(await page.evaluate(() => solveBids().settle.reduce((a, s) => a + s.diff, 0))) < 1);
    await page.screenshot({ path: path.join(SH, 'lod-kroner.png'), fullPage: true });
    await browser.close();
  }
  // ---------- 9: the lot itself ----------
  {
    const { browser, page } = await open({});
    const a = await page.evaluate(() => S.lod); await page.reload(); const b = await page.evaluate(() => S.lod);
    ok('9a a lot is drawn on first visit and kept on reload', a > 0 && a === b, a + ' / ' + b);
    await page.click('#reset'); await page.click('#reset'); await page.waitForTimeout(200);
    const c = await page.evaluate(() => S.lod);
    ok('9b "Start forfra" draws a new lot for the new estate', c > 0 && c !== a, c);
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('arvora-v1')); delete s.lod; localStorage.setItem('arvora-v1', JSON.stringify(s)); }); await page.reload();
    const d1 = await page.evaluate(() => S.lod); await page.reload(); const d2 = await page.evaluate(() => S.lod);
    ok('9c state saved before the lottery existed gets a lot once, then keeps it', d1 > 0 && d1 === d2, d1 + ' / ' + d2);
    await browser.close();
  }
  console.log(log.join('\n'));
})().catch(e => { console.log(log.join('\n')); console.error('CRASH', e); process.exit(1); });
