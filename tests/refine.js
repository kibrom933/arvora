// The four refinements: wants nothing, forgotten code, signing with code, PDF with extended Latin.
const fs = require('fs');
const path = require('path');
const { open, overflow, ROOT, FIX } = require('./lib');
const SH = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SH, { recursive: true });
const log = []; const ok = (name, cond, extra) => log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra !== undefined ? '  -> ' + String(extra).slice(0, 400) : ''));
const nav = async (page, v) => { await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(150); };
const unlock = async (page, id, pin = '1111') => { await nav(page, 'oensker'); if (await page.locator(`.who-sw button[data-me="${id}"]`).getAttribute('aria-pressed') !== 'true') { await page.click(`.who-sw button[data-me="${id}"]`); await page.waitForTimeout(100); } if (await page.locator('#pin').count()) { await page.fill('#pin', pin); await page.click('#pinForm button'); } await page.waitForTimeout(120); };
const DL = `window.__saved=[];window.claude={use:async(n)=>n==='downloads'?{save:async(o)=>{const b=await o.data.arrayBuffer();window.__saved.push(Array.from(new Uint8Array(b)))}}:null};`;

(async () => {
  // ---------- 1. wants nothing ----------
  {
    const { browser, page, errors } = await open({});
    await unlock(page, 'h3', '1234');
    ok('1a Anna has points placed, so no "ønsker ikke noget" button yet', await page.locator('#nothing').count() === 0);
    await page.evaluate(() => { S.pts.h3 = {}; save(); render(); });
    ok('1b with 0 points placed the button appears, submit still disabled', await page.locator('#nothing').count() === 1 && await page.locator('#submit').isDisabled());
    await page.screenshot({ path: path.join(SH, 'ref-intet.png') });
    await page.click('#nothing'); await page.waitForTimeout(250);
    ok('1c Anna is marked as answered and we land on fordeling', await page.evaluate(() => S.submitted.h3 === true && Object.keys(S.pts.h3).length === 0) && page.url().endsWith('#fordeling'), page.url());
    await page.click('#reveal'); await page.waitForTimeout(3500);
    const txt = await page.locator('main').innerText();
    ok('1d her box says she wanted nothing, no percentage, no "Hvorfor"', txt.includes('Ønskede ikke noget af tingene') && !txt.includes('Hvorfor fik Anna') && (txt.match(/Fik af sine ønsker/g) || []).length === 2);
    ok('1e no red "fik ingen af sine ønsker" for her, green check still shown', !txt.includes('fik ingen af') && txt.includes('Ingen misunder de andre'));
    ok('1f testament ring still in her box', await page.evaluate(() => solvePoints().out.h3.some(x => x.i.id === 'i6')));
    await page.screenshot({ path: path.join(SH, 'ref-intet-fordeling.png'), fullPage: true });
    await nav(page, 'oensker'); await page.click('.who-sw button[data-me="h3"]').catch(() => {}); await page.fill('#pin', '1234').catch(() => {}); await page.click('#pinForm button').catch(() => {}); await page.waitForTimeout(150);
    const purse = await page.locator('.purse').innerText();
    ok('1g her wishes page says so and offers "Ret mine ønsker"', purse.includes('ønsker ikke noget af tingene') && await page.locator('#unsubmit').count() === 1, purse.replace(/\n/g, ' | '));
    await page.click('button[data-method="kroner"]'); await page.waitForTimeout(100); await page.click('button[data-method="point"]'); await page.waitForTimeout(100);
    ok('1h switching method and back keeps her as answered', await page.evaluate(() => S.submitted.h3 === true));
    await page.click('#unsubmit'); await page.waitForTimeout(100); await page.locator('button[data-inc]:not([disabled])').first().click(); await page.waitForTimeout(100);
    ok('1i she can change her mind and place points again', await page.locator('#nothing').count() === 0 && await page.evaluate(() => used('h3') === 5));
    await page.evaluate(() => { S.pts.h3 = {}; S.items.find(i => i.id === 'i6').will = ''; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.waitForTimeout(200);
    ok('1j signed list and copy text say "ønskede ikke noget"', (await page.locator('.doc').innerText()).includes('Ønskede ikke noget') && (await page.evaluate(() => listText())).includes('(ønskede ikke noget)'));
    ok('1 no errors', errors.length === 0, errors.join('|'));
    await browser.close();
  }
  // ---------- 2. forgotten code ----------
  {
    const { browser, page, errors } = await open({});
    await unlock(page, 'h3', '1234'); await page.click('#lock'); await page.waitForTimeout(100);
    ok('2a lock screen has "Glemt koden?"', await page.locator('.forgot summary').count() === 1);
    await page.locator('.forgot summary').click(); await page.waitForTimeout(100);
    const t1 = await page.locator('.forgot').innerText();
    ok('2b tovholder has no code yet: explains and allows direct reset', /Mette er tovholder/.test(t1) && /ikke selv valgt en kode/.test(t1) && await page.locator('button[data-resetpin="h3"]').count() === 1, t1.replace(/\n/g, ' | '));
    await page.screenshot({ path: path.join(SH, 'ref-glemt.png') });
    const before = await page.evaluate(() => JSON.stringify(S.pts.h3));
    await page.click('button[data-resetpin="h3"]'); await page.waitForTimeout(100);
    ok('2c first tap only asks', await page.evaluate(() => S.pins.h3 === '1234') && (await page.locator('button[data-resetpin="h3"]').textContent()).includes('Tryk igen'));
    await page.click('button[data-resetpin="h3"]'); await page.waitForTimeout(150);
    ok('2d second tap resets: Anna now chooses a new code, wishes kept', await page.evaluate(() => !S.pins.h3) && (await page.locator('.lock h2').textContent()).includes('Vælg en kode') && await page.evaluate(() => JSON.stringify(S.pts.h3)) === before);
    await page.fill('#pin', '5678'); await page.click('#pinForm button'); await page.waitForTimeout(100);
    ok('2e new code works', await page.evaluate(() => unlocked === 'h3' && S.pins.h3 === '5678'));
    // tovholder gets a code; then Anna's reset must go through it
    await unlock(page, 'h1', '1111'); await page.click('#lock'); await page.waitForTimeout(100);
    await page.click('.who-sw button[data-me="h3"]'); await page.waitForTimeout(100); await page.locator('.forgot summary').click(); await page.waitForTimeout(100);
    ok('2f with a tovholder code the reset asks for it', await page.locator('#resetForm').count() === 1 && await page.locator('button[data-resetpin]').count() === 0);
    await page.fill('#tovpin', '9999'); await page.click('#resetForm button'); await page.waitForTimeout(100);
    ok('2g wrong tovholder code refused', await page.evaluate(() => S.pins.h3 === '5678') && (await page.locator('#resetMsg').textContent()).includes('ikke Mettes kode'));
    await page.fill('#tovpin', '1111'); await page.click('#resetForm button'); await page.waitForTimeout(150);
    ok('2h right tovholder code resets', await page.evaluate(() => !S.pins.h3) && (await page.locator('.lock h2').textContent()).includes('Vælg en kode'));
    // tovholder forgot her own
    await page.click('.who-sw button[data-me="h1"]'); await page.waitForTimeout(100); await page.locator('.forgot summary').click(); await page.waitForTimeout(100);
    ok('2i tovholder herself: "ny kode på SMS" two-tap', (await page.locator('.forgot').innerText()).includes('ny kode på SMS') && await page.locator('button[data-resetpin="h1"]').count() === 1);
    await page.click('button[data-resetpin="h1"]'); await page.click('button[data-resetpin="h1"]'); await page.waitForTimeout(150);
    ok('2j tovholder reset works', await page.evaluate(() => !S.pins.h1));
    ok('2 no errors', errors.length === 0, errors.join('|'));
    await browser.close();
  }
  // ---------- 3. signing with code ----------
  {
    const { browser, page, errors } = await open({});
    await page.evaluate(() => { S.pins = { h3: '1234' }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.waitForTimeout(200);
    const fAnna = page.locator('form[data-signform="h3"]'), fMette = page.locator('form[data-signform="h1"]');
    ok('3a lead explains codes; Anna\'s field says "Kode", Mette\'s "Vælg kode"', (await page.locator('.lead').innerText()).includes('egen kode') && await fAnna.locator('input.pin').getAttribute('placeholder') === 'Kode' && await fMette.locator('input.pin').getAttribute('placeholder') === 'Vælg kode');
    await fAnna.locator('button').click(); await page.waitForTimeout(100);
    ok('3b no code: not signed, message shown', await page.evaluate(() => !H('h3').sig) && (await fAnna.locator('[data-signmsg]').textContent()).includes('4 cifre'));
    await fAnna.locator('input.pin').fill('0000'); await fAnna.locator('button').click(); await page.waitForTimeout(100);
    ok('3c wrong code: not signed, says only Anna can sign', await page.evaluate(() => !H('h3').sig) && (await fAnna.locator('[data-signmsg]').textContent()).includes('Kun Anna'));
    await page.screenshot({ path: path.join(SH, 'ref-underskrift-fejl.png') });
    await fAnna.locator('input:not(.pin)').fill('Anna Jensen'); await fAnna.locator('input.pin').fill('1234'); await fAnna.locator('button').click(); await page.waitForTimeout(150);
    ok('3d right code signs with the typed name', await page.evaluate(() => H('h3').sig === 'Anna Jensen'));
    await fMette.locator('button').click(); await page.waitForTimeout(100);
    ok('3e Mette without a code is asked to choose one', await page.evaluate(() => !H('h1').sig) && (await fMette.locator('[data-signmsg]').textContent()).includes('Vælg først en kode'));
    await fMette.locator('input.pin').fill('2222'); await fMette.locator('button').click(); await page.waitForTimeout(150);
    ok('3f choosing a code signs (name defaults to Mette) and stores the code', await page.evaluate(() => H('h1').sig === 'Mette' && S.pins.h1 === '2222'));
    await page.locator('form[data-signform="h2"] input.pin').fill('3333'); await page.locator('form[data-signform="h2"] button').click(); await page.waitForTimeout(200);
    ok('3g all signed, stamp shown', await page.locator('.stamp').count() === 1);
    await page.screenshot({ path: path.join(SH, 'ref-underskrift.png'), fullPage: true });
    ok('3h desktop: no overflow', (await overflow(page)).length === 0, (await overflow(page)).join('|'));
    // Mette's new code now also opens her wishes
    await page.evaluate(() => { S.heirs.forEach(h => h.sig = ''); save(); });
    await unlock(page, 'h1', '2222');
    ok('3i the code chosen at signing opens her wishes later', await page.evaluate(() => unlocked === 'h1'));
    ok('3 no errors', errors.length === 0, errors.join('|'));
    await browser.close();
    for (const dev of ['iPhone 13', 'iPhone SE']) {
      const m = await open({ device: dev });
      await m.page.evaluate(() => { S.heirs[0].name = 'Anne-Margrethe'; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
      await nav(m.page, 'oversigt'); await nav(m.page, 'underskrift'); await m.page.waitForTimeout(300);
      ok('3j ' + dev + ': sign forms fit, no sideways scroll', (await overflow(m.page)).length === 0, (await overflow(m.page)).join('|'));
      const w = await m.page.evaluate(() => { const i = document.querySelector('form[data-signform] input:not(.pin)'); return i.getBoundingClientRect().width; });
      ok('3k ' + dev + ': name field is usable (' + Math.round(w) + 'px)', w >= 90, w);
      if (dev === 'iPhone 13') await m.page.screenshot({ path: path.join(SH, 'ref-underskrift-mobil.png') });
      await m.browser.close();
    }
  }
  // ---------- 4. PDF ----------
  {
    const { browser, page, errors } = await open({ init: DL });
    await page.evaluate(() => { S.heirs[0].name = 'Ayşe'; S.heirs[1].name = 'Łukasz'; S.heirs[2].name = 'Nguyễn Đặng'; S.items[0].name = 'Tæppe fra İzmir'; S.items[1].name = 'Ščepáns krus'; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.waitForTimeout(300);
    const t0 = Date.now(); await page.click('#pdf'); await page.waitForFunction(() => window.__saved.length === 1, null, { timeout: 15000 }); const ms = Date.now() - t0;
    const pdf = await page.evaluate(() => window.__saved[0]); fs.writeFileSync(path.join(ROOT, 'out', 'out-ref-names.pdf'), Buffer.from(pdf));
    const text = require('child_process').execSync(`pdftotext -layout ${path.join(ROOT, 'out', 'out-ref-names.pdf')} -`).toString();
    ok('4a PDF text has Ayşe, Łukasz, Nguyễn Đặng, İzmir, Ščepán intact', ['Ayşe', 'Łukasz', 'Nguyễn Đặng', 'İzmir', 'Ščepáns'].every(s => text.includes(s)), text.split('\n').filter(l => /Ay|uka|Nguy|zmir|epán/.test(l)).join(' / '));
    ok('4b toast says "PDF gemt" without a warning (' + ms + ' ms)', (await page.locator('#toast').textContent()) === 'PDF gemt', await page.locator('#toast').textContent());
    ok('4c PDF under 200 KB', pdf.length < 200 * 1024, pdf.length);
    await page.evaluate(() => { S.heirs[2].name = 'محمد'; S.heirs[2].sig = 'محمد'; save(); render(); }); await page.click('#pdf'); await page.waitForFunction(() => window.__saved.length === 2, null, { timeout: 15000 });
    ok('4d Arabic name: PDF still made, toast warns and points to Kopiér', /kan ikke skrive "محمد"/.test(await page.locator('#toast').textContent()) && /Kopiér/.test(await page.locator('#toast').textContent()), await page.locator('#toast').textContent());
    ok('4 no errors', errors.length === 0, errors.join('|'));
    await browser.close();
    // fonts missing -> fallback
    const b = await open({ init: DL + `const _f=window.fetch;window.fetch=(u,...a)=>String(u).includes('fonts/hk-')?Promise.resolve(new Response('',{status:404})):_f(u,...a);` });
    await b.page.evaluate(() => { S.heirs[0].name = 'Ayşe'; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(b.page, 'oversigt'); await nav(b.page, 'underskrift'); await b.page.waitForTimeout(300); await b.page.click('#pdf'); await b.page.waitForFunction(() => window.__saved.length === 1, null, { timeout: 15000 });
    ok('4e fonts unavailable: PDF still made with Helvetica and the toast warns about Ayşe', b.page && /Ayşe/.test(await b.page.locator('#toast').textContent()) && b.errors.length === 0, (await b.page.locator('#toast').textContent()) + ' ' + b.errors.join('|'));
    await b.browser.close();
  }
  console.log(log.join('\n'));
})().catch(e => { console.log(log.join('\n')); console.error('CRASH', e); process.exit(1); });
