// Test af den rigtige app (app/) i en browser mod en efterligning af Supabase (fake-supabase.mjs).
// Hele forløbet som en familie på tre: opret bo, ting med AI-navn, arvinger med links, ønsker fra tre telefoner,
// betaling, fordeling, underskrift med kode, PDF, ny runde. Plus skærmbilleder og overløb på telefon.
//   node tests/app.mjs            computer
//   node tests/app.mjs mobile     iPhone 13
//   node tests/app.mjs mobile dark
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';
import { createFake } from './fake-supabase.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url)), APP = path.join(ROOT, '..', 'app'), DIST = path.join(ROOT, 'out', 'app-dist'), FIX = path.join(ROOT, 'fixtures');
const SB = 'https://jqulxozrejhrinqxyffr.supabase.co', URL = 'https://app.arvora.test';
const args = process.argv.slice(2), mobile = args.includes('mobile'), dark = args.includes('dark'), TAG = (process.env.TAG || '') + (mobile ? 'mobile' : 'desktop') + (dark ? '-dark' : '');
const log = []; const ok = (name, cond, extra) => log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  -> ' + String(extra).slice(0, 400) : ''));
const SHOTS = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SHOTS, { recursive: true });

// Byg appen mod den efterlignede adresse
const b = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { cwd: APP, encoding: 'utf8', env: { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: 'test' } });
if (b.status !== 0) { console.log('FAIL build\n' + b.stdout + b.stderr); process.exit(1); }

const FONTS = [['Fraunces', 'fraunces', [500, 600]], ['Hanken Grotesk', 'hanken-grotesk', [400, 500, 600, 700]], ['Caveat', 'caveat', [500, 700]], ['IBM Plex Mono', 'ibm-plex-mono', [400, 500]]];
const nm = (...p) => { for (const base of [ROOT, path.join(ROOT, '..')]) { const f = path.join(base, 'node_modules', ...p); if (fs.existsSync(f)) return f; } return null; };
const fontCss = FONTS.map(([fam, slug, ws]) => ws.map(w => `@font-face{font-family:"${fam}";font-weight:${w};src:url(${URL}/webfonts/${slug}/${slug}-latin-${w}-normal.woff2) format("woff2")}`).join('\n')).join('\n');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.txt': 'text/plain', '.svg': 'image/svg+xml' };

const browser = await chromium.launch();
const fake = createFake({ url: SB });
const contexts = [];
async function openAs(label) {
  const o = mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 };
  if (dark) o.colorScheme = 'dark';
  const ctx = await browser.newContext(o); contexts.push(ctx);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const errors = [];
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u.startsWith(SB)) return fake.route(route);
    if (u.startsWith(URL)) {
      const p = new globalThis.URL(u).pathname;
      if (p.startsWith('/webfonts/')) { const [slug, file] = p.slice(10).split('/'); const f = nm('@fontsource', slug, 'files', file); return f ? route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(f) }) : route.abort(); }
      let f = path.join(DIST, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
      return route.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: fontCss });
    errors.push('BLOCKED ' + u); return route.abort();
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*status of 4\d\d/.test(m.text())) errors.push(label + ' console: ' + m.text()); });
  page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
  return { page, errors, label };
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `app-${TAG}-${name}.png`), fullPage: !mobile });
async function overflow(page) {
  return page.evaluate(() => { const vw = document.documentElement.clientWidth, out = []; if (document.documentElement.scrollWidth > vw + 1) out.push('document ' + document.documentElement.scrollWidth + '>' + vw);
    for (const el of document.querySelectorAll('main *, header *, footer *')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1)) { if (el.closest('nav.steps') || el.closest('.tw') || r.left < -5000) continue; out.push(el.tagName + '.' + el.className + ' right=' + Math.round(r.right) + ' "' + (el.textContent || '').trim().slice(0, 30) + '"'); } } return out.slice(0, 8); });
}
const settle = p => p.waitForTimeout(250);
async function login(page, who) {
  await page.goto(URL + '/'); await page.fill('#who', who); await page.check('#ok'); await page.click('#loginForm button[type=submit]');
  await page.waitForSelector('#codeForm'); await page.fill('#code', '123456'); await page.click('#codeForm button[type=submit]'); await page.waitForSelector('.heirs, .eyebrow'); await settle(page);
}
async function give(page, itemNo, clicks) { const btn = page.locator(`.tag:has(.lot:text-is("Nr. ${String(itemNo).padStart(3, '0')}")) [data-inc]`); for (let k = 0; k < clicks; k++) { await btn.click(); await page.waitForTimeout(40); } }

try {
  /* ---------- Tovholderen Mette ---------- */
  const M = await openAs('Mette');
  await login(M.page, 'mette@mail.dk');
  ok('login: kommer til oversigten over boer', await M.page.locator('h1').textContent() === 'Velkommen');
  await M.page.click('a[href="/nyt"]'); await M.page.waitForSelector('#nytForm');
  await M.page.fill('#nName', 'Inger Marie Jensen'); await M.page.fill('#nYears', '1938 – 2026'); await M.page.fill('#myName', 'Mette'); await M.page.fill('#myRel', 'Datter');
  await M.page.click('#nytForm button[type=submit]'); await M.page.waitForSelector('#addItem');
  ok('opret bo: lander på Ting', M.page.url().endsWith('/ting'));
  ok('opret bo: hedder Inger Marie Jensen i toppen', (await M.page.locator('#boName').textContent()).includes('Inger Marie Jensen'));
  for (const [n, r] of [['Spisebord i eg med 6 stole', 'Stue'], ['Musselmalet stel, 48 dele', 'Køkken'], ['Bornholmerur', 'Stue'], ['Mormors symaskine', 'Værelse'], ['Fotoalbum 1960–1990', 'Værelse']]) { await M.page.fill('#nName', n); await M.page.fill('#nGroup', r); await M.page.click('#addItem button[type=submit]'); await M.page.waitForFunction(x => [...document.querySelectorAll('.tag .name')].some(e => e.textContent === x), n); }
  ok('ting: 5 mærkesedler med faste numre', (await M.page.locator('.tag .lot').allTextContents()).join(',') === 'Nr. 001,Nr. 002,Nr. 003,Nr. 004,Nr. 005');
  await M.page.locator('#aiPics').setInputFiles([path.join(FIX, 'photo.jpg')]); await M.page.waitForFunction(() => [...document.querySelectorAll('.tag .name')].some(e => e.textContent === 'Spisebord i eg'), null, { timeout: 15000 });
  ok('ting: AI-navn fra billede', await M.page.locator('.tag:has(.name:text-is("Spisebord i eg")) .chip').first().textContent() === 'Navn fra AI');
  ok('ting: billedet vises', await M.page.locator('.tag:has(.name:text-is("Spisebord i eg")) img').count() === 1);
  await M.page.click('.tag:has(.name:text-is("Spisebord i eg")) [data-edit]'); await M.page.fill('[data-rename]', 'Sofabord i eg'); await M.page.keyboard.press('Enter'); await M.page.waitForFunction(() => [...document.querySelectorAll('.tag .name')].some(e => e.textContent === 'Sofabord i eg'));
  ok('ting: omdøbt, AI-mærket væk', await M.page.locator('.tag:has(.name:text-is("Sofabord i eg")) .chip:text-is("Navn fra AI")').count() === 0);
  await M.page.selectOption('.tag:has(.lot:text-is("Nr. 002")) [data-roomof]', 'Kælder'); await settle(M.page);
  ok('ting: rum ændret', fake.T.items.find(i => i.no === 2).room === 'Kælder');
  await M.page.click('.tag:has(.lot:text-is("Nr. 006")) [data-del]'); await M.page.click('.tag:has(.lot:text-is("Nr. 006")) [data-del]'); await M.page.waitForFunction(() => document.querySelectorAll('.tag').length === 5);
  ok('ting: fjern kræver to tryk og nummeret genbruges ikke', (await M.page.locator('.tag .lot').allTextContents()).join(',') === 'Nr. 001,Nr. 002,Nr. 003,Nr. 004,Nr. 005');
  await shot(M.page, 'ting'); ok('ting: intet overløb', (await overflow(M.page)).length === 0, (await overflow(M.page)).join(' | '));

  // Arvinger
  await M.page.click('nav.steps a[data-v=arvinger]'); await M.page.waitForSelector('#addHeir');
  ok('arvinger: Mette er selv med som arving', (await M.page.locator('.heir .nm').first().textContent()).includes('Mette'));
  await M.page.fill('#hName', 'Lars'); await M.page.fill('#hTel', '20 30 40 50'); await M.page.fill('#hRel', 'Søn'); await M.page.click('#addHeir button[type=submit]'); await M.page.waitForFunction(() => document.querySelectorAll('.heir .nm').length === 2);
  await M.page.fill('#hName', 'Anna'); await M.page.fill('#hMail', 'anna@mail.dk'); await M.page.fill('#hRel', 'Datter'); await M.page.click('#addHeir button[type=submit]'); await M.page.waitForFunction(() => document.querySelectorAll('.heir .nm').length === 3);
  ok('arvinger: links sendt på SMS og mail', fake.sent.filter(s => s.kind === 'invitation').map(s => s.to).join(',') === '+4520304050,anna@mail.dk', JSON.stringify(fake.sent));
  ok('arvinger: status "Link sendt"', (await M.page.locator('.heir .chip.warn').allTextContents()).every(t => t.startsWith('Link sendt')));
  await M.page.selectOption('[data-w]:nth-of-type(1)', '0.5').catch(() => {}); await settle(M.page);
  await shot(M.page, 'arvinger'); ok('arvinger: intet overløb', (await overflow(M.page)).length === 0, (await overflow(M.page)).join(' | '));

  // Testamente på Nr. 004 til Anna
  await M.page.click('nav.steps a[data-v=ting]'); await M.page.waitForSelector('[data-willof]');
  const anna = fake.T.heirs.find(h => h.name === 'Anna'); await M.page.selectOption('.tag:has(.lot:text-is("Nr. 004")) [data-willof]', anna.id); await M.page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('testamentet'));
  ok('ting: symaskinen er testamenteret til Anna', fake.T.items.find(i => i.no === 4).will_heir_id === anna.id);

  // Betaling og åbning
  await M.page.click('nav.steps a[data-v=oversigt]'); await M.page.waitForSelector('#pay');
  ok('oversigt: boet er ikke åbnet, betal-knap', await M.page.locator('#pay').count() === 1);
  await M.page.click('#pay'); await M.page.waitForSelector('#open'); ok('oversigt: efter betaling kan boet åbnes', M.page.url().includes('betaling=ok'));
  await M.page.click('#open'); await M.page.waitForFunction(() => !document.querySelector('#open'));
  ok('oversigt: boet er åbent', fake.T.estates[0].status === 'aaben');
  await shot(M.page, 'oversigt');
  ok('oversigt: intet overløb', (await overflow(M.page)).length === 0, (await overflow(M.page)).join(' | '));

  /* ---------- Lars åbner sit link på sin telefon ---------- */
  const L = await openAs('Lars');
  const lars = fake.T.heirs.find(h => h.name === 'Lars');
  await L.page.goto(URL + '/i/' + fake.inviteTokens[lars.id]); await L.page.waitForSelector('#inviteCode');
  ok('invitation: Lars ser sit navn og boets navn', (await L.page.locator('h1').textContent()) === 'Hej Lars' && (await L.page.locator('.lead').textContent()).includes('Inger Marie Jensen'));
  ok('invitation: koden sendes til nummeret fra invitationen', fake.sent.filter(s => s.kind === 'otp').pop().to === '+4520304050');
  await L.page.fill('#icode', '111111'); await L.page.check('#iok'); await L.page.click('#inviteCode button[type=submit]'); await L.page.waitForFunction(() => document.querySelector('#iMsg')?.textContent.length > 0);
  ok('invitation: forkert kode afvises', (await L.page.locator('#iMsg').textContent()).includes('passer ikke'));
  await L.page.fill('#icode', '123456'); await L.page.click('#inviteCode button[type=submit]'); await L.page.waitForSelector('.purse', { timeout: 15000 });
  ok('invitation: Lars lander på Ønsker', L.page.url().endsWith('/oensker') && lars.user_id);
  ok('invitation: Lars ser ikke tovholderens knapper', await L.page.locator('.method').count() === 0 && await L.page.locator('#pill').textContent() === 'Arving');
  ok('ønsker: testamenteret ting vises ikke', await L.page.locator('.tag').count() === 4);
  await give(L.page, 1, 10); await give(L.page, 3, 6); await give(L.page, 2, 4);
  await L.page.waitForFunction(() => document.querySelector('.purse b')?.textContent.startsWith('0 point'));
  ok('ønsker: 100 point brugt', (await L.page.locator('.purse b').textContent()).startsWith('0 point'));
  await L.page.waitForTimeout(900); ok('ønsker: gemt løbende på serveren', fake.T.wishes.filter(w => w.heir_id === lars.id).reduce((a, w) => a + w.points, 0) === 100);
  await shot(L.page, 'oensker'); ok('ønsker: intet overløb', (await overflow(L.page)).length === 0, (await overflow(L.page)).join(' | '));
  await L.page.click('#submit'); await L.page.waitForSelector('#unsubmit');
  ok('ønsker: Lars har afgivet', !!lars.submitted_at);
  await L.page.click('#unsubmit'); await L.page.waitForSelector('#submit'); ok('ønsker: kan fortryde', !lars.submitted_at);
  await L.page.click('#submit'); await L.page.waitForSelector('#unsubmit');

  /* ---------- Anna på mail ---------- */
  const A = await openAs('Anna');
  await A.page.goto(URL + '/i/' + fake.inviteTokens[anna.id]); await A.page.waitForSelector('#inviteCode');
  await A.page.fill('#icode', '123456'); await A.page.check('#iok'); await A.page.click('#inviteCode button[type=submit]'); await A.page.waitForSelector('.purse', { timeout: 15000 });
  await give(A.page, 2, 12); await give(A.page, 5, 8); await A.page.waitForFunction(() => document.querySelector('.purse b')?.textContent.startsWith('0 point'));
  await A.page.waitForTimeout(900); await A.page.click('#submit'); await A.page.waitForSelector('#unsubmit');
  ok('ønsker: Anna har afgivet', !!anna.submitted_at);

  /* ---------- Lars kan ikke læse andres ønsker ---------- */
  const leak = await L.page.evaluate(async (sb) => { const s = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.startsWith('sb-')))); const r = await fetch(sb + '/rest/v1/wishes?select=*', { headers: { apikey: 'test', Authorization: 'Bearer ' + s.access_token } }); return r.json(); }, SB);
  ok('hemmelighed: Lars får kun sine egne ønsker fra databasen', Array.isArray(leak) && leak.every(w => w.heir_id === lars.id) && leak.length === 3, JSON.stringify(leak).slice(0, 200));

  /* ---------- Mette giver ønsker og deler ---------- */
  await M.page.click('nav.steps a[data-v=oensker]'); await M.page.waitForSelector('.purse');
  ok('ønsker: tovholderen ser, hvem der mangler', (await M.page.locator('.card.rest h2').textContent()).startsWith('2 af 3 har svaret'));
  ok('ønsker: metoden kan ikke skiftes, når nogen har svaret', await M.page.locator('[data-method=kroner][disabled]').count() === 1);
  ok('ønsker: Afgiv er slået fra, før alle point er brugt', await M.page.locator('#submit[disabled]').count() === 1);
  await give(M.page, 1, 8); await give(M.page, 5, 12); await M.page.waitForFunction(() => !document.querySelector('#submit[disabled]'));
  await M.page.waitForTimeout(900); await M.page.click('#submit'); await M.page.waitForSelector('#reveal', { timeout: 15000 });
  ok('ønsker: når alle har svaret, går tovholderen til fordelingen', M.page.url().endsWith('/fordeling'));
  await M.page.click('#reveal'); await M.page.waitForSelector('.boxes', { timeout: 20000 }); await M.page.waitForTimeout(mobile ? 2500 : 3000);
  const run = fake.T.distribution_runs[0];
  ok('fordeling: serveren har gemt en kørsel med version 1 og dokumenthash', run && run.version === 1 && run.result.document_hash.length === 64);
  ok('fordeling: tre kasser', await M.page.locator('.box').count() === 3);
  ok('fordeling: symaskinen står hos Anna som testamente', (await M.page.locator('.box:has(.hand:text-is("Anna"))').textContent()).includes('Mormors symaskine') && (await M.page.locator('.box:has(.hand:text-is("Anna")) .chip.will').count()) === 1);
  ok('fordeling: Mette kan se sin egen forklaring', await M.page.locator('.box:has(.hand:text-is("Mette")) details.why').count() === 1);
  ok('fordeling: men ikke de andres', await M.page.locator('.box details.why').count() === 1);
  ok('fordeling: procent vises', (await M.page.locator('.fair b.num').allTextContents()).every(t => /\d+ %/.test(t)));
  ok('fordeling: ingen testamenteret ting har point', !Object.values(run.result.out).flat().some(x => x.will && x.points));
  ok('fordeling: besked om fordeling klar til alle tre', fake.sent.filter(s => s.kind === 'fordeling_klar').length === 3);
  await shot(M.page, 'fordeling'); ok('fordeling: intet overløb', (await overflow(M.page)).length === 0, (await overflow(M.page)).join(' | '));

  /* ---------- Underskrift ---------- */
  await M.page.click('a[href$="/underskrift"]'); await M.page.waitForSelector('[data-request]');
  ok('underskrift: Mette kan kun bede om kode til sig selv', await M.page.locator('[data-request]').count() === 1);
  await M.page.click('[data-request] button'); await M.page.waitForSelector('[data-verify]');
  ok('underskrift: koden sendes til Mettes mail', fake.sent.filter(s => s.kind === 'underskrift_kode').pop().to === 'mette@mail.dk');
  await M.page.fill('#sgcode', '000000'); await M.page.click('[data-verify] button[type=submit]'); await M.page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('passer ikke'));
  ok('underskrift: forkert kode afvises', (await M.page.locator('#toast').textContent()).includes('passer ikke'));
  await M.page.fill('#sgname', 'Mette Jensen'); await M.page.fill('#sgcode', '654321'); await M.page.click('[data-verify] button[type=submit]'); await M.page.waitForFunction(() => document.querySelector('.sig .line')?.textContent === 'Mette Jensen');
  ok('underskrift: Mette Jensen står på linjen', fake.T.signatures.length === 1 && fake.T.signatures[0].signed_name === 'Mette Jensen');
  for (const P of [L, A]) { await P.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/underskrift'); await P.page.waitForSelector('[data-request]'); await P.page.click('[data-request] button'); await P.page.waitForSelector('[data-verify]'); await P.page.fill('#sgcode', '654321'); await P.page.click('[data-verify] button[type=submit]'); await P.page.waitForFunction(() => !document.querySelector('[data-verify]')); }
  ok('underskrift: alle tre har skrevet under, boet er underskrevet', fake.T.signatures.length === 3 && fake.T.estates[0].status === 'underskrevet');
  ok('underskrift: underskriften er bundet til dokumentets hash', fake.T.signatures.every(s => s.document_hash === run.result.document_hash));
  await A.page.waitForSelector('.stamp'); ok('underskrift: stemplet "Alle enige" hos Anna', (await A.page.locator('.stamp').textContent()) === 'Alle enige');
  const [dl] = await Promise.all([A.page.waitForEvent('download', { timeout: 10000 }).catch(() => null), A.page.click('#pdf')]);
  ok('underskrift: PDF hentes', !!dl && dl.suggestedFilename().startsWith('fordelingsliste-inger'), dl && dl.suggestedFilename());
  await A.page.click('#copy'); await A.page.waitForFunction(() => document.querySelector('#copied')?.textContent.length > 0);
  const clip = await A.page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok('underskrift: kopieret liste har alle tre og symaskinen som testamente', clip.includes('Lars') && clip.includes('[testamente]'), clip.slice(0, 120));
  await shot(A.page, 'underskrift'); ok('underskrift: intet overløb', (await overflow(A.page)).length === 0, (await overflow(A.page)).join(' | '));

  /* ---------- Ny runde: alle skal sige ja ---------- */
  await M.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/fordeling'); await M.page.waitForSelector('details.why summary'); await M.page.click('main > details.why summary'); await M.page.waitForSelector('#reopenForm');
  await M.page.fill('#reopenReason', 'Vi glemte stuebordet'); await M.page.click('#reopenForm button'); await M.page.waitForSelector('#reopenYes, .chip.good', { timeout: 10000 });
  ok('ny runde: tovholderen har bedt, boet er stadig fordelt', fake.T.estates[0].status === 'underskrevet');
  await L.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/fordeling'); await L.page.waitForSelector('#reopenYes');
  ok('ny runde: Lars ser begrundelsen', (await L.page.locator('.card.rest').last().textContent()).includes('Vi glemte stuebordet'));
  await L.page.click('#reopenYes'); await L.page.waitForFunction(() => !document.querySelector('#reopenYes'));
  ok('ny runde: to af tre har sagt ja, stadig låst', fake.T.estates[0].status === 'underskrevet');
  await A.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/fordeling'); await A.page.waitForSelector('#reopenYes'); await A.page.click('#reopenYes'); await A.page.waitForFunction(() => !document.querySelector('#reopenYes'), null, { timeout: 10000 }); await A.page.waitForTimeout(300);
  ok('ny runde: alle sagde ja, boet er åbent, ønsker låst op, kørslen afløst', fake.T.estates[0].status === 'aaben' && fake.T.heirs.every(h => !h.submitted_at) && !!run.superseded_at);
  await M.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/underskrift'); await M.page.waitForSelector('h1');
  ok('ny runde: intet at underskrive længere', (await M.page.locator('h1').textContent()).startsWith('Intet at'));

  /* ---------- Slet nu ---------- */
  await M.page.goto(URL + '/bo/' + fake.T.estates[0].id + '/oversigt'); await M.page.waitForSelector('#delnow');
  await M.page.click('#delnow'); await M.page.click('#delnow'); await M.page.waitForURL(URL + '/'); await M.page.waitForSelector('h1');
  ok('slet nu: to tryk, boet og billederne er væk', fake.T.estates.length === 0 && fake.T.wishes.length === 0 && Object.keys(fake.storage).length === 0);

  for (const P of [M, L, A]) ok(`ingen fejl i konsollen (${P.label})`, P.errors.length === 0, P.errors.slice(0, 3).join(' | '));
} catch (e) { ok('crash', false, e.stack || e.message); }
finally { for (const c of contexts) await c.close().catch(() => {}); await browser.close(); }
console.log(log.join('\n'));
process.exit(log.some(l => l.startsWith('FAIL')) ? 1 : 0);
