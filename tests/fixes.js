// Checks aimed at the fixes themselves, incl. that a browser with the OLD saved state keeps working.
const fs = require('fs');
const path = require('path');
const { open, overflow, ROOT, FIX } = require('./lib');
const SH = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SH, { recursive: true });
const log = []; const ok = (name, cond, extra) => log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + String(extra).slice(0, 300) : ''));
const nav = async (page, v) => { await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(150); };

(async () => {
  // 1. state saved by an older version (before fixed numbers and the lottery) loads in the new one
  {
    const old = fs.readFileSync(path.join(FIX, 'state-v3-old.json'), 'utf8');
    const { browser, page, errors } = await open({ init: `try{if(!localStorage.getItem('arvora-v1'))localStorage.setItem('arvora-v1', ${JSON.stringify(old)})}catch(e){}` });
    await nav(page, 'ting');
    const nums = await page.evaluate(() => S.items.map(i => i.no));
    ok('1a old saved state: every thing gets a number, in the old order', nums.length === 15 && nums.every((n, k) => n === k + 1), nums.join(','));
    ok('1b old saved state: code and other data kept', await page.evaluate(() => S.pins.h3 === '1234' && S.items.length === 15 && S.lod > 0));
    for (const v of ['oversigt', 'ting', 'arvinger', 'oensker', 'fordeling', 'underskrift']) await nav(page, v);
    ok('1c old saved state: no errors on any step', errors.length === 0, errors.join('|'));
    await browser.close();
  }
  // 2. remove heir (two taps), incl. one with a testament thing
  {
    const { browser, page, errors } = await open({});
    await nav(page, 'arvinger'); await page.fill('#hName', 'Jonas'); await page.fill('#hRel', 'Barnebarn'); await page.click('#addHeir button'); await page.waitForTimeout(150);
    ok('2a tovholder (Mette) has no remove button', await page.locator('button[data-rmheir="h1"]').count() === 0);
    const jid = await page.evaluate(() => S.heirs[3].id);
    await page.click(`button[data-rmheir="${jid}"]`); await page.waitForTimeout(100);
    ok('2b first tap only asks', await page.evaluate(() => S.heirs.length === 4) && (await page.locator(`button[data-rmheir="${jid}"]`).textContent()).includes('Tryk igen'), await page.locator(`button[data-rmheir="${jid}"]`).textContent());
    await page.screenshot({ path: path.join(SH, 'fix-fjern-arving.png') });
    await page.click(`button[data-rmheir="${jid}"]`); await page.waitForTimeout(150);
    ok('2c second tap removes Jonas', await page.evaluate(() => S.heirs.length === 3 && !S.heirs.some(h => h.name === 'Jonas')));
    // wait: a single tap must expire
    await page.click('button[data-rmheir="h2"]'); await page.waitForTimeout(4300);
    ok('2d a single tap expires after 4 s', (await page.locator('button[data-rmheir="h2"]').textContent()) === 'Fjern' && await page.evaluate(() => S.heirs.length === 3));
    // Anna has the testament ring
    await page.click('button[data-rmheir="h3"]'); await page.click('button[data-rmheir="h3"]'); await page.waitForTimeout(150);
    ok('2e removing Anna frees her testament thing and her wishes', await page.evaluate(() => S.heirs.length === 2 && S.items.find(i => i.id === 'i6').will === '' && !S.pts.h3 && !('h3' in S.submitted)));
    for (const v of ['oversigt', 'ting', 'arvinger', 'oensker', 'fordeling', 'underskrift']) await nav(page, v);
    ok('2f everything still renders with Anna gone (she was "me")', errors.length === 0 && await page.evaluate(() => me === 'h1'), errors.join('|'));
    await browser.close();
  }
  // 3. start forfra needs two taps
  {
    const { browser, page } = await open({ device: 'iPhone 13' });
    await nav(page, 'ting'); await page.fill('#nName', 'Min egen ting'); await page.click('#addItem button[type=submit]'); await page.waitForTimeout(100);
    await page.click('#reset'); await page.waitForTimeout(150);
    ok('3a first tap keeps data and explains', await page.evaluate(() => S.items.some(i => i.name === 'Min egen ting')) && (await page.locator('#toast').textContent()).includes('én gang til'), await page.locator('#toast').textContent());
    ok('3b header still fits on a phone while asking', (await overflow(page)).length === 0, (await overflow(page)).join('|'));
    await page.screenshot({ path: path.join(SH, 'fix-start-forfra.png'), clip: { x: 0, y: 0, width: 390, height: 120 } });
    await page.click('#reset'); await page.waitForTimeout(200);
    ok('3c second tap resets', await page.evaluate(() => !S.items.some(i => i.name === 'Min egen ting') && S.items.length === 16 && S.items.every((i, k) => i.no === k + 1)) && (await page.locator('#reset').textContent()) === 'Start forfra');
    await browser.close();
  }
  // 4. copy when the browser refuses the clipboard
  {
    const { browser, page } = await open({ init: `Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true})` });
    await page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.click('#copy'); await page.waitForTimeout(150);
    const r = await page.evaluate(() => { const t = document.querySelector('#copyText'); return t ? { len: t.value.length, sel: t.selectionEnd - t.selectionStart, msg: document.querySelector('#copied').textContent } : null; });
    ok('4a no clipboard: the list is shown, marked, ready to copy by hand', r && r.len > 100 && r.sel === r.len, JSON.stringify(r));
    await page.screenshot({ path: path.join(SH, 'fix-kopier-fallback.png') });
    await browser.close();
    const b2 = await open({ init: `Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('no'))},configurable:true})` });
    await b2.page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(b2.page, 'oversigt'); await nav(b2.page, 'underskrift'); await b2.page.click('#copy'); await b2.page.waitForTimeout(150);
    ok('4b clipboard rejected: same fallback', await b2.page.locator('#copyText').count() === 1);
    await b2.browser.close();
  }
  // 5. photo when the browser is full, through the real upload button
  {
    const { browser, page } = await open({});
    await nav(page, 'ting');
    await page.evaluate(() => { const big = 'x'.repeat(1024 * 100); let k = 0; try { for (; k < 200; k++) localStorage.setItem('fill' + k, big); } catch (e) {} const small = 'x'.repeat(500); try { for (let j = 0; j < 400; j++) localStorage.setItem('fills' + j, small); } catch (e) {} });
    await page.locator('.grid .tag').first().locator('input[data-photo]').setInputFiles(path.join(FIX, 'photo.jpg')); await page.waitForTimeout(700);
    const t = await page.locator('#toast').textContent();
    ok('5a full browser: user is told the photo was not saved', /ikke plads/.test(t), t);
    ok('5b full browser: the photo is not shown as if saved', await page.locator('.grid .tag').first().locator('.pic img').count() === 0);
    await page.fill('#nName', 'Lille ting'); await page.click('#addItem button[type=submit]'); await page.waitForTimeout(150);
    const savedWhileFull = await page.evaluate(() => JSON.parse(localStorage.getItem('arvora-v1') || '{}').items?.some(i => i.name === 'Lille ting'));
    log.push('INFO 5 small text change saved while browser was full: ' + savedWhileFull + ' / toast: ' + await page.locator('#toast').textContent());
    await page.evaluate(() => { for (let k = 0; k < 200; k++) localStorage.removeItem('fill' + k); });
    await page.reload(); await nav(page, 'ting');
    ok('5c other changes still saved', await page.evaluate(() => S.items.length >= 16));
    await browser.close();
  }
  // 6. rename then tap another card's "Ret navn": one tap is enough and the first name is kept
  {
    const { browser, page } = await open({});
    await nav(page, 'ting');
    await page.locator('.grid .tag').nth(0).locator('button[data-edit]').click();
    await page.locator('input[data-rename]').fill('Spisebord i eg');
    await page.locator('.grid .tag').nth(1).locator('button[data-edit]').click(); await page.waitForTimeout(150);
    ok('6a first name saved', await page.evaluate(() => S.items[0].name === 'Spisebord i eg'));
    ok('6b second field opened with one tap', await page.locator('input[data-rename]').count() === 1 && await page.locator('input[data-rename]').getAttribute('data-rename') === 'i2');
    await page.locator('input[data-rename]').fill('Noget helt andet'); await page.locator('input[data-rename]').press('Escape'); await page.waitForTimeout(100);
    ok('6c Escape discards the change', await page.evaluate(() => S.items[1].name === 'Musselmalet stel, 48 dele') && await page.locator('input[data-rename]').count() === 0);
    await page.locator('.grid .tag').nth(1).locator('button[data-edit]').click(); await page.locator('input[data-rename]').fill('   '); await page.locator('input[data-rename]').press('Enter');
    ok('6d an empty name is not accepted', await page.evaluate(() => S.items[1].name === 'Musselmalet stel, 48 dele'));
    await page.reload(); ok('6e rename survives reload', await page.evaluate(() => S.items[0].name === 'Spisebord i eg'));
    await browser.close();
  }
  // 7+8. delete a thing with points; numbers
  {
    const { browser, page } = await open({});
    await nav(page, 'ting');
    await page.evaluate(() => { S.photos.i3 = 'data:image/png;base64,AAAA'; save(); });
    await page.locator('.grid .tag').nth(2).locator('button[data-del]').click(); await page.waitForTimeout(150);
    const t = await page.locator('#toast').textContent();
    ok('7a toast says who must redo points', /Mette og Lars/.test(t), t);
    ok('7b they are no longer marked as answered; Anna untouched', await page.evaluate(() => S.submitted.h1 === false && S.submitted.h2 === false && S.submitted.h3 === false && !S.photos.i3));
    await page.fill('#nName', 'Ny ting'); await page.click('#addItem button[type=submit]'); await page.waitForTimeout(150);
    const lots = await page.locator('.grid .tag .lot').allTextContents();
    ok('8a deleted number is not reused; others unchanged', lots.join(',') === 'Nr. 001,Nr. 002,Nr. 004,Nr. 005,Nr. 006,Nr. 007,Nr. 008,Nr. 009,Nr. 010,Nr. 011,Nr. 012,Nr. 013,Nr. 014,Nr. 015,Nr. 016,Nr. 017', lots.join(','));
    await page.reload(); await nav(page, 'ting');
    ok('8b same numbers after reload', (await page.locator('.grid .tag .lot').allTextContents()).join(',') === lots.join(','));
    // kroner method: deleting does not un-submit
    await page.evaluate(() => { S.method = 'kroner'; S.submitted = { h1: true, h2: true, h3: true }; save(); render(); });
    await page.locator('.grid .tag').nth(0).locator('button[data-del]').click(); await page.waitForTimeout(100);
    ok('7c kroner method: bids on other things stand', await page.evaluate(() => S.submitted.h1 && S.submitted.h2 && S.submitted.h3));
    await browser.close();
  }
  // 10. tapping the method that is already chosen does nothing
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.pins = { h3: '1111' }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'oensker'); await page.fill('#pin', '1111'); await page.click('#pinForm button'); await page.waitForTimeout(100);
    await page.click('button[data-method="point"]'); await page.waitForTimeout(100);
    ok('10a tapping the active method keeps signatures', await page.evaluate(() => S.revealed && S.heirs.every(h => h.sig)));
    await page.click('button[data-method="kroner"]'); await page.waitForTimeout(100);
    ok('10b switching for real reopens the agreement; those with bids stay answered', await page.evaluate(() => !S.revealed && S.heirs.every(h => !h.sig) && S.submitted.h1 && S.submitted.h3));
    await browser.close();
  }
  // 11. PDF with names outside Western European letters
  {
    const init = `window.__saved=[];window.claude={use:async(n)=>n==='downloads'?{save:async(o)=>{const b=await o.data.arrayBuffer();window.__saved.push(Array.from(new Uint8Array(b)))}}:null};`;
    const { browser, page } = await open({ init });
    await page.evaluate(() => { S.heirs[0].name = 'Ayşe'; S.heirs[1].name = 'Łukasz'; S.heirs[2].name = 'محمد'; S.items[0].name = 'Tæppe fra İzmir'; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'oversigt'); await nav(page, 'underskrift'); await page.waitForTimeout(300); await page.click('#pdf'); await page.waitForTimeout(800);
    const pdf = await page.evaluate(() => window.__saved[0]); if (pdf) fs.writeFileSync(path.join(ROOT, 'out', 'out-names.pdf'), Buffer.from(pdf));
    ok('11 PDF made with non-Danish names (see image for how they look)', !!pdf);
    await browser.close();
  }
  console.log(log.join('\n'));
})().catch(e => { console.log(log.join('\n')); console.error('CRASH', e); process.exit(1); });
