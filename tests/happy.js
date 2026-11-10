// Happy path: walk every step like a family would, on desktop and phone.
const fs = require('fs');
const path = require('path');
const { open, overflow, ROOT, FIX } = require('./lib');

const label = process.argv[2] || 'desktop';
const device = label === 'mobile' ? 'iPhone 13' : null;
const dark = process.argv.includes('dark');
const SH = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SH, { recursive: true });
const log = [];
const ok = (name, cond, extra) => { log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + extra : '')); };

(async () => {
  const saved = [];
  const init = `window.__saved=[];window.claude={use:async(n)=>{
    if(n==='downloads')return {save:async(o)=>{const b=await o.data.arrayBuffer();window.__saved.push({filename:o.filename,bytes:Array.from(new Uint8Array(b))});}};
    return null}};`;
  const { browser, page, errors } = await open({ device, dark, init });
  const shot = async n => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(SH, `${process.env.TAG||''}${label}${dark ? '-dark' : ''}-${n}.png`), fullPage: false }); };
  const full = async n => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(SH, `${process.env.TAG||''}${label}${dark ? '-dark' : ''}-${n}-full.png`), fullPage: true }); };
  const ov = async n => { const o = await overflow(page); ok('no horizontal overflow: ' + n, o.length === 0, o.join(' | ')); };
  const toast = () => page.locator('#toast').textContent();

  // --- Oversigt
  ok('overview renders estate name', (await page.locator('h1').textContent()).includes('Inger Marie Jensen'));
  ok('overview: 2 of 3 submitted', (await page.locator('.track').textContent()).includes('2 af 3'));
  await shot('01-oversigt'); await full('01-oversigt'); await ov('oversigt');
  await page.click('button[data-remind]');
  ok('reminder toast names Anna', (await toast()).includes('Anna'), await toast());

  // --- Ting
  await page.click('nav.steps a[data-v="ting"]'); await page.waitForTimeout(200);
  ok('ting: 16 items', await page.locator('.grid .tag').count() === 16);
  await shot('02-ting'); await ov('ting');
  await page.fill('#nName', 'Kaffestel med blå blomster');
  await page.fill('#nGroup', 'Køkken');
  await page.click('#addItem button[type=submit]');
  ok('ting: item added -> 17', await page.locator('.grid .tag').count() === 17);
  ok('ting: new item gets Nr. 017', (await page.locator('.grid .tag').last().textContent()).includes('Nr. 017'));
  // filter
  await page.click('button[data-room="Køkken"]');
  ok('ting: filter Køkken shows 3', await page.locator('.grid .tag').count() === 3, String(await page.locator('.grid .tag').count()));
  await page.click('button[data-room="Alle"]');
  // rename
  await page.locator('.grid .tag').last().locator('button[data-edit]').click();
  const rn = page.locator('input[data-rename]');
  await rn.fill('Kaffestel, 12 dele'); await rn.press('Enter');
  ok('ting: rename via Enter', (await page.locator('.grid .tag').last().locator('.name').textContent().catch(() => '')) === 'Kaffestel, 12 dele');
  // rename without change -> does input close?
  await page.locator('.grid .tag').first().locator('button[data-edit]').click();
  await page.locator('input[data-rename]').press('Enter');
  ok('ting: Enter without change closes the edit field', await page.locator('input[data-rename]').count() === 0);
  await page.locator('input[data-rename]').press('Escape').catch(() => {});
  ok('ting: Escape closes the edit field', await page.locator('input[data-rename]').count() === 0);
  await page.locator('h1').click();
  ok('ting: clicking away closes the edit field', await page.locator('input[data-rename]').count() === 0);
  // photo upload
  const png = path.join(FIX, 'photo.png');
  await page.locator('.grid .tag').first().locator('input[data-photo]').setInputFiles(png);
  await page.waitForTimeout(500);
  ok('ting: photo shows on tag', await page.locator('.grid .tag').first().locator('.pic img').count() === 1);
  await shot('03-ting-efter');
  // delete item 3 and see whether numbers of later items shift
  const before = await page.locator('.grid .tag').nth(8).textContent();
  await page.locator('.grid .tag').nth(7).locator('button[data-del]').click();
  const after = await page.locator('.grid .tag').nth(7).textContent();
  ok('ting: numbers stay fixed after a delete', before.slice(0, 8) === after.slice(0, 8), `before "${before.slice(0, 8)}" after "${after.slice(0, 8)}"`);

  // --- reload: state persists?
  await page.reload(); await page.evaluate(() => document.fonts.ready);
  ok('persist: items survive reload', await page.locator('.grid .tag').count() === 16, String(await page.locator('.grid .tag').count()));
  ok('persist: photo survives reload', await page.locator('.grid .tag').first().locator('.pic img').count() === 1);

  // --- Arvinger
  await page.click('nav.steps a[data-v="arvinger"]'); await page.waitForTimeout(200);
  await shot('04-arvinger'); await ov('arvinger');
  ok('arvinger: 3 heirs + form', await page.locator('.heirs > .heir').count() === 4);
  ok('arvinger: can remove an heir', await page.locator('[data-delheir], [data-rmheir], button:has-text("Fjern")').count() > 0);

  // --- Ønsker (Anna)
  await page.click('nav.steps a[data-v="oensker"]'); await page.waitForTimeout(200);
  ok('ønsker: asks Anna for code', (await page.locator('h1').textContent()).includes('Anna'));
  await shot('05-kode'); await ov('kode');
  await page.fill('#pin', '12'); await page.click('#pinForm button');
  ok('ønsker: short code rejected', (await page.locator('#pinMsg').textContent()).includes('4 cifre'));
  await page.fill('#pin', '1234'); await page.click('#pinForm button');
  ok('ønsker: unlocked for Anna', (await page.locator('h1').textContent()).includes('betyder mest'));
  await shot('06-oensker'); await full('06-oensker'); await ov('ønsker');
  // Bornholmerur was deleted (nr 3) – Anna had no points there. Anna had 100 used: check purse
  const purse = async () => (await page.locator('.purse').textContent()).trim();
  ok('ønsker: Anna has 0 left', (await purse()).startsWith('0 point'), await purse());
  ok('ønsker: submit enabled at 0 left', await page.locator('#submit').isEnabled());
  // take 5 off, submit disabled; put back
  await page.locator('button[data-dec]:not([disabled])').first().click();
  ok('ønsker: 5 left after minus', (await purse()).startsWith('5 point'), await purse());
  ok('ønsker: submit disabled until all used', await page.locator('#submit').isDisabled());
  // scroll down: is the sticky purse still visible and not covering the header?
  await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(200);
  const st = await page.evaluate(() => { const p = document.querySelector('.purse').getBoundingClientRect(), h = document.querySelector('header.top').getBoundingClientRect(); return { purseTop: p.top, headerBottom: h.bottom, purseH: p.height, vh: innerHeight }; });
  ok('ønsker: sticky purse sits right under header', Math.abs(st.purseTop - st.headerBottom) < 14 && st.purseTop >= st.headerBottom - 1, JSON.stringify(st));
  await shot('07-oensker-scrollet');
  await page.locator('button[data-inc]:not([disabled])').first().click();
  // lock and wrong code
  await page.evaluate(() => scrollTo(0, 0));
  await page.click('#lock');
  await page.fill('#pin', '9999'); await page.click('#pinForm button');
  ok('ønsker: wrong code rejected', (await page.locator('#pinMsg').textContent()).includes('Forkert'));
  await page.fill('#pin', '1234'); await page.click('#pinForm button');
  // other heirs' wishes hidden?
  await page.click('.who-sw button[data-me="h1"]');
  ok('ønsker: switching to Mette locks again', (await page.locator('h1').textContent()).includes('Mette'));
  await page.click('.who-sw button[data-me="h3"]');
  await page.fill('#pin', '1234'); await page.click('#pinForm button');
  await page.click('#submit');
  await page.waitForTimeout(300);
  ok('ønsker: after last submit lands on fordeling', page.url().endsWith('#fordeling'), page.url()); await page.waitForTimeout(200);

  // --- Fordeling
  ok('fordeling: ready to reveal', (await page.locator('h1').textContent()).includes('Alle har svaret'));
  await shot('08-klar'); await ov('klar');
  await page.click('#reveal');
  await page.waitForTimeout(600); await shot('09-animation');
  await page.waitForTimeout(3200);
  await shot('10-fordeling'); await full('10-fordeling'); await ov('fordeling');
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.box')].map(b => ({ who: b.querySelector('.hand').textContent, pct: b.querySelector('.fair b')?.textContent, items: [...b.querySelectorAll('.it')].map(i => i.querySelector('.nm').textContent + ' [' + i.querySelector('.p').textContent + ']') })));
  log.push('BOXES ' + JSON.stringify(boxes, null, 1));
  const total = boxes.reduce((a, b) => a + b.items.length, 0);
  const restN = await page.locator('.rest .row').first().locator('.chip').count().catch(() => 0);
  ok('fordeling: every item is placed exactly once', total + restN === 16, `${total} in boxes + ${restN} rest`);
  ok('fordeling: testament ring went to Anna', boxes.find(b => b.who === 'Anna').items.some(i => i.includes('Guldring') && i.includes('Testamente')));
  log.push('CHECKS ' + JSON.stringify(await page.locator('.chk b').allTextContents()));
  await page.locator('details.why summary').first().click(); await shot('11-hvorfor');
  await page.click('button[data-partner="vurdering"]').catch(() => {});

  // --- Underskrift
  await page.click('a[href="#underskrift"].btn'); await page.waitForTimeout(200);
  await shot('12-underskrift'); await ov('underskrift');
  const forms = page.locator('form[data-signform]');
  ok('underskrift: 3 to sign', await forms.count() === 3);
  // Mette and Lars have no code yet: they choose one when signing. Anna signs with the code she chose for her wishes.
  await forms.first().locator('input:not(.pin)').fill('Mette Jensen'); await forms.first().locator('input.pin').fill('2222'); await forms.first().locator('button').click(); await page.waitForTimeout(150);
  await page.locator('form[data-signform]').first().locator('input.pin').fill('3333'); await page.locator('form[data-signform]').first().locator('button').click(); await page.waitForTimeout(150); // Lars, empty name
  ok('underskrift: empty name field signs with the heir name', (await page.locator('.sig .line').nth(1).textContent()) === 'Lars');
  await page.locator('form[data-signform]').first().locator('button').click(); await page.waitForTimeout(100);
  ok('underskrift: Anna cannot sign without her code', await page.evaluate(() => !H('h3').sig));
  await page.locator('form[data-signform]').first().locator('input:not(.pin)').fill('Anna'); await page.locator('form[data-signform]').first().locator('input.pin').fill('1234'); await page.locator('form[data-signform]').first().locator('button').click(); await page.waitForTimeout(150);
  ok('underskrift: stamp appears', await page.locator('.stamp').count() === 1);
  await shot('13-underskrevet'); await full('13-underskrevet'); await ov('underskrevet');
  await page.click('#copy'); await page.waitForTimeout(200);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
  ok('underskrift: list copied', clip.includes('FORDELINGSLISTE') && clip.includes('Mette Jensen'), clip.slice(0, 80));
  log.push('CLIP\n' + clip);
  ok('underskrift: PDF button shown', await page.locator('#pdf').count() === 1);
  await page.click('#pdf'); await page.waitForTimeout(800);
  const pdf = await page.evaluate(() => window.__saved[0]);
  ok('underskrift: PDF produced', !!pdf && pdf.bytes.length > 1000, pdf && pdf.filename);
  if (pdf) fs.writeFileSync(path.join(ROOT, 'out', `out-${process.env.TAG||''}${label}.pdf`), Buffer.from(pdf.bytes));
  // overview at the end
  await page.click('nav.steps a[data-v="oversigt"]'); await page.waitForTimeout(200);
  await shot('14-oversigt-slut');
  ok('overview: all five steps done', await page.locator('.trk.done').count() === 5, String(await page.locator('.trk.done').count()));

  ok('no console/page errors', errors.length === 0, errors.join(' | '));
  console.log(log.join('\n'));
  await browser.close();
})().catch(e => { console.log(log.join('\n')); console.error('CRASH', e); process.exit(1); });
