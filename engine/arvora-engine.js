// Arvoras fordelingsmotor som et selvstændigt modul uden afhængigheder.
// Samme algoritme som i prototype/index.html (solvePoints, solveBids, lodtal), men med
// alle input som argumenter og alle output som rene data (id'er, ikke objekter), så den
// kan køre i browseren, i Node og i en Deno edge function og gemmes i databasen.
//
// tests/engine-parity.js kontrollerer, at modulet giver præcis samme fordeling som prototypen.
// docs/fairness-and-algorithm-validation.md beskriver matematikken.
//
// Input:
//   heirs: [{id, name, w}]            w = arvelod (1 = hel andel, 0.5 = halv, 2 = dobbelt)
//   items: [{id, name, will}]         will = id på den arving, tingen er testamenteret til, ellers ''/null
//   pts:   {heirId: {itemId: point}}  pointmetoden (0–100 pr. arving)
//   bids:  {heirId: {itemId: kroner}} kronemetoden
//   lod:   heltal 1..2^32-1, trukket én gang pr. bo (drawLod)

const E = 1e-9;

/** Fast tal i [0,1) pr. arving og ting ud fra boets lod. Samme lod, samme tal. */
export function lodtal(lod, heirId, itemId) {
  let x = (lod >>> 0) || 1;
  const s = heirId + '|' + itemId;
  for (let k = 0; k < s.length; k++) { x = Math.imul(x ^ s.charCodeAt(k), 2654435761) >>> 0; x ^= x >>> 15; }
  x = Math.imul(x ^ (x >>> 16), 2246822507) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Trækker et nyt lod med kryptografisk tilfældighed. Kaldes én gang, når boet oprettes. */
export function drawLod(cryptoImpl) {
  const c = cryptoImpl || (typeof globalThis !== 'undefined' && globalThis.crypto);
  if (!c || !c.getRandomValues) throw new Error('crypto.getRandomValues mangler');
  let v = 0;
  while (!v) v = c.getRandomValues(new Uint32Array(1))[0];
  return v;
}

export const og = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1];
export const kr = n => Math.round(n).toLocaleString('da-DK') + ' kr.';

const freeItems = items => items.filter(i => !i.will);

/** Point, en arving har givet til ting, der ikke er testamenteret. */
export function pointsUsed(heirId, items, pts) {
  const p = pts[heirId] || {};
  const free = new Set(freeItems(items).map(i => i.id));
  return Object.entries(p).filter(([k]) => free.has(k)).reduce((a, [, v]) => a + v, 0);
}

/**
 * Pointmetoden: maksimerer vægtet Nash-velfærd, sum af w_h * ln(u_h) over arvinger med u_h > 0,
 * med antallet af arvinger med u_h > 0 som første kriterium. Se docs/fairness-and-algorithm-validation.md.
 */
export function solvePoints({ heirs, items, pts, lod }) {
  const HS = heirs, F = freeItems(items);
  const v = (h, i) => (pts[h.id] || {})[i.id] || 0;
  const wanted = F.filter(i => HS.some(h => v(h, i) > 0)), rest = F.filter(i => !HS.some(h => v(h, i) > 0));
  let A;
  const U = h => A[h.id].reduce((a, i) => a + v(h, i), 0);
  const obj = () => { let p = 0, s = 0; for (const h of HS) { const u = U(h); if (u > 0) { p++; s += h.w * Math.log(u); } } return p * 1e6 + s; };
  // Held: summen af lodtal for den fordeling, der ligger nu. Tæller kun mellem fordelinger, der er præcis lige gode.
  const luck = () => { let s = 0; for (const h of HS) for (const i of A[h.id]) s += lodtal(lod, h.id, i.id); return s; };
  const better = (n, l, cn, cl) => n > cn + E || (n > cn - E && l > cl + 1e-12);
  const top = i => Math.max(...HS.map(h => v(h, i)));
  // Ét forsøg: læg tingene ud i den givne rækkefølge, og flyt og byt derefter, så længe det bliver bedre.
  const attempt = (its, hs) => {
    A = {}; HS.forEach(h => A[h.id] = []);
    its.forEach(i => { let best = null, bs = -Infinity; for (const h of hs) { if (!v(h, i)) continue; const u = U(h); const s = (Math.log(u + v(h, i)) - Math.log(u + 1e-9)) * h.w; if (s > bs) { bs = s; best = h; } } A[best.id].push(i); });
    let imp = true, g = 0;
    while (imp && g++ < 300) {
      imp = false; let cur = obj(), cl = luck();
      // break: en ting, der er flyttet, må ikke prøves hos flere, ellers ender den i to kasser
      for (const a of hs) for (const i of [...A[a.id]]) for (const b of hs) {
        if (a === b || !v(b, i)) continue;
        A[a.id] = A[a.id].filter(x => x !== i); A[b.id].push(i);
        const n = obj(), l = luck();
        if (better(n, l, cur, cl)) { cur = n; cl = l; imp = true; break; } else { A[b.id].pop(); A[a.id].push(i); }
      }
      sw: for (const a of hs) for (const b of hs) {
        if (a.id >= b.id) continue;
        for (const i of [...A[a.id]]) for (const j of [...A[b.id]]) {
          const s1 = () => { A[a.id] = A[a.id].map(x => x === i ? j : x); A[b.id] = A[b.id].map(x => x === j ? i : x); };
          const s2 = () => { A[a.id] = A[a.id].map(x => x === j ? i : x); A[b.id] = A[b.id].map(x => x === i ? j : x); };
          s1(); const n = obj(), l = luck();
          if (better(n, l, cur, cl)) { cur = n; cl = l; imp = true; break sw; } else s2();
        }
        // to arvinger kan også bytte hele kassen
        const ta = A[a.id]; A[a.id] = A[b.id]; A[b.id] = ta;
        const n = obj(), l = luck();
        if (better(n, l, cur, cl)) { cur = n; cl = l; imp = true; break sw; } else { A[b.id] = A[a.id]; A[a.id] = ta; }
      }
    }
    return [obj(), luck()];
  };
  // Første forsøg går frem i loddets rækkefølge. De næste prøver andre rækkefølger. Bedste vinder;
  // ved præcis lige gode fordelinger vinder den med mest held i lodtrækningen.
  const draw = [...HS].sort((a, b) => lodtal(lod, b.id, '*') - lodtal(lod, a.id, '*'));
  let [bestV, bestL] = attempt([...wanted].sort((a, b) => top(b) - top(a)), draw), bestA = A;
  let seed = (lod | 0) || 20261109;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const mix = a => { a = [...a]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const tries = HS.length < 2 || wanted.length < 2 ? 0 : wanted.length * HS.length > 1500 ? 6 : 40;
  for (let t = 0; t < tries; t++) { const [val, l] = attempt(mix(wanted), mix(HS)); if (better(val, l, bestV, bestL)) { bestV = val; bestL = l; bestA = A; } }
  A = bestA;
  // Hvad blev afgjort af loddet? Alt, der kunne være endt anderledes, uden at fordelingen blev dårligere.
  const keep = A, base = obj(), lodNotes = [], lodIds = new Set(), met = new Set(), ties = [];
  const key = (a, b) => a.id < b.id ? a.id + '|' + b.id : b.id + '|' + a.id;
  const alt = fn => { const B = {}; HS.forEach(h => B[h.id] = [...keep[h.id]]); A = B; fn(B); const t = Math.abs(obj() - base) <= E; A = keep; return t; };
  for (const a of HS) for (const i of keep[a.id]) {
    const oth = HS.filter(b => b !== a && v(b, i) > 0 && alt(B => { B[a.id] = B[a.id].filter(x => x !== i); B[b.id].push(i); }));
    if (!oth.length) continue;
    const grp = [a, ...oth].sort((x, y) => HS.indexOf(x) - HS.indexOf(y)), p = v(a, i), eq = grp.every(h => v(h, i) === p);
    lodIds.add(i.id); oth.forEach(b => met.add(key(a, b)));
    lodNotes.push(`${i.name}: ${og(grp.map(h => h.name))} ${eq ? `gav ${grp.length > 2 ? 'alle' : 'begge'} ${p} p` : 'stod lige'}. Loddet faldt på ${a.name}.`);
    ties.push({ kind: 'item', itemId: i.id, heirIds: grp.map(h => h.id), winnerId: a.id });
  }
  if (wanted.length <= 60) for (const a of HS) for (const b of HS) {
    if (a.id >= b.id) continue;
    for (const i of keep[a.id]) for (const j of keep[b.id]) {
      if (lodIds.has(i.id) || lodIds.has(j.id)) continue;
      if (alt(B => { B[a.id] = B[a.id].map(x => x === i ? j : x); B[b.id] = B[b.id].map(x => x === j ? i : x); })) {
        lodIds.add(i.id); lodIds.add(j.id); met.add(key(a, b));
        lodNotes.push(`${og([a.name, b.name])} stod lige om ${i.name} og ${j.name}. Loddet gav ${a.name} ${i.name}.`);
        ties.push({ kind: 'swap', itemIds: [i.id, j.id], heirIds: [a.id, b.id], winnerId: a.id });
      }
    }
    if (!met.has(key(a, b)) && keep[a.id].length + keep[b.id].length > 0 && alt(B => { const t = B[a.id]; B[a.id] = B[b.id]; B[b.id] = t; })) {
      lodNotes.push(`${og([a.name, b.name])} stod helt lige. Loddet afgjorde, hvem der fik hvilken kasse.`);
      ties.push({ kind: 'box', heirIds: [a.id, b.id], winnerId: a.id });
    }
  }
  // EF1 (misundelsesfri på nær én ting), vægtet med arvelod
  const ef = [];
  for (const a of HS) for (const b of HS) {
    if (a === b) continue;
    const ua = U(a); const vs = A[b.id].map(i => v(a, i)); const ub = vs.reduce((s, x) => s + x, 0) - (vs.length ? Math.max(...vs) : 0);
    if (ua / a.w + E < ub / b.w) ef.push([a.id, b.id]);
  }
  const out = {};
  HS.forEach(h => out[h.id] = A[h.id].map(i => ({ itemId: i.id, points: v(h, i), lod: lodIds.has(i.id), will: false })));
  items.filter(i => i.will && out[i.will]).forEach(i => out[i.will].push({ itemId: i.id, points: 0, lod: false, will: true }));
  const score = {}, of = {};
  HS.forEach(h => { score[h.id] = U(h); of[h.id] = pointsUsed(h.id, items, pts); });
  return {
    method: 'point', out, rest: rest.map(i => i.id), ef, lod: lodNotes, lodIds: [...lodIds], ties,
    zero: HS.filter(h => of[h.id] > 0 && score[h.id] === 0).map(h => h.id), score, of,
    welfare: Number.isFinite(base) ? base : null,
  };
}

/** Kronemetoden: højeste bud vinder, lige bud afgøres af loddet, forskellen udlignes i arven efter arvelod. */
export function solveBids({ heirs, items, bids, lod }) {
  const HS = heirs; const b = (h, i) => (bids[h.id] || {})[i.id] || 0;
  const out = {}; HS.forEach(h => out[h.id] = []);
  const rest = [], lodNotes = [], lodIds = new Set(), ties = []; let V = 0; const price = {};
  for (const i of freeItems(items)) {
    const top = Math.max(0, ...HS.map(h => b(h, i)));
    if (!top) { rest.push(i); continue; }
    const tied = HS.filter(h => b(h, i) === top), best = tied.length > 1 ? [...tied].sort((x, y) => lodtal(lod, y.id, i.id) - lodtal(lod, x.id, i.id))[0] : tied[0];
    if (tied.length > 1) {
      lodIds.add(i.id);
      lodNotes.push(`${i.name}: ${og(tied.map(h => h.name))} bød ${tied.length > 2 ? 'alle' : 'begge'} ${kr(top)} Loddet faldt på ${best.name}.`);
      ties.push({ kind: 'item', itemId: i.id, heirIds: tied.map(h => h.id), winnerId: best.id });
    }
    price[i.id] = top; V += top; out[best.id].push({ itemId: i.id, price: top, lod: tied.length > 1, will: false });
  }
  items.filter(i => i.will && out[i.will]).forEach(i => out[i.will].push({ itemId: i.id, price: 0, lod: false, will: true }));
  const W = HS.reduce((a, h) => a + h.w, 0);
  const settle = HS.map(h => { const got = out[h.id].filter(x => !x.will).reduce((a, x) => a + price[x.itemId], 0); const share = V * h.w / W; return { heirId: h.id, got, share, diff: got - share }; });
  return { method: 'kroner', out, rest: rest.map(i => i.id), price, total: V, settle, lod: lodNotes, lodIds: [...lodIds], ties, ef: [], zero: [] };
}

/** Tjek før fordeling: hver arving, der har svaret, har brugt præcis 100 point på frie ting, eller intet. */
export function validatePoints(heirs, items, pts) {
  const problems = [];
  for (const h of heirs) {
    const used = pointsUsed(h.id, items, pts);
    if (used !== 0 && used !== 100) problems.push({ heirId: h.id, used });
    for (const [k, p] of Object.entries(pts[h.id] || {})) if (!Number.isInteger(p) || p < 0 || p > 100) problems.push({ heirId: h.id, itemId: k, bad: p });
  }
  return problems;
}

/** Tjek før fordeling: bud er hele, ikke-negative kroner på frie ting. */
export function validateBids(heirs, items, bids) {
  const problems = [];
  const free = new Set(freeItems(items).map(i => i.id));
  for (const h of heirs) for (const [k, b] of Object.entries(bids[h.id] || {})) {
    if (!free.has(k)) problems.push({ heirId: h.id, itemId: k, bad: 'testamente' });
    else if (!Number.isFinite(b) || b < 0 || b > 1e9 || Math.round(b) !== b) problems.push({ heirId: h.id, itemId: k, bad: b });
  }
  return problems;
}
