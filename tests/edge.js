// Edge cases through the real UI: the things a real family will do that the demo data never does.
const fs = require('fs');
const path = require('path');
const { open, overflow, ROOT, FIX } = require('./lib');
const SH = path.join(ROOT, 'out', 'shots'); fs.mkdirSync(SH, { recursive: true });
const tag = process.env.TAG || 'orig';
const log = []; const ok = (name, cond, extra) => log.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? '  -> ' + String(extra).slice(0, 400) : ''));
const nav = async (page, v) => { await page.evaluate(v => { location.hash = v; }, v); await page.waitForTimeout(150); };
const unlock = async (page, id, pin = '1111') => { await nav(page, 'oensker'); if (await page.locator(`.who-sw button[data-me="${id}"]`).getAttribute('aria-pressed') !== 'true') await page.click(`.who-sw button[data-me="${id}"]`); if (await page.locator('#pin').count()) { await page.fill('#pin', pin); await page.click('#pinForm button'); } await page.waitForTimeout(100); };

(async () => {
  // 1. method toggle
  {
    const { browser, page } = await open({});
    await unlock(page, 'h3');
    ok('1a Anna starts as not submitted', await page.evaluate(() => S.submitted.h3 === false));
    await page.click('button[data-method="kroner"]'); await page.waitForTimeout(100);
    ok('1b switching method does not mark Anna as submitted', await page.evaluate(() => S.submitted.h3 === false), 'submitted=' + await page.evaluate(() => JSON.stringify(S.submitted)));
    await nav(page, 'fordeling');
    ok('1c distribution still waits for Anna after method switch', (await page.locator('h1').textContent()).includes('Venter'), await page.locator('h1').textContent());
    await browser.close();
  }
  // 2. everybody wants the same single thing
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.pts = { h1: { i3: 100 }, h2: { i3: 100 }, h3: { i3: 100 } }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(page, 'oversigt'); await nav(page, 'fordeling'); await page.waitForTimeout(300);
    const b = await page.evaluate(() => [...document.querySelectorAll('.box')].map(b => b.querySelector('.hand').textContent + ' ' + (b.querySelector('.fair b')?.textContent || '') + ' ' + [...b.querySelectorAll('.it .nm')].map(x => x.textContent).join(',')));
    const checks = await page.locator('.chk b').allTextContents();
    log.push('INFO 2 all-want-the-clock: ' + JSON.stringify(b) + ' checks=' + JSON.stringify(checks));
    ok('2a page is honest when two heirs get 0 % (no all-green fairness check)', !checks.includes('Ingen misunder de andre') || (await page.locator('main').textContent()).match(/lodtrækning|uafgjort|lige mange point/i) !== null, checks.join(' / '));
    await page.screenshot({ path: path.join(SH, `edge-${tag}-alle-vil-have-uret.png`), fullPage: true });
    await browser.close();
  }
  // 3. an heir who wants nothing cannot finish
  {
    const { browser, page } = await open({});
    await unlock(page, 'h3');
    await page.evaluate(() => { S.pts.h3 = {}; save(); render(); });
    const dis = await page.locator('#submit').isDisabled(); const txt = await page.locator('main').textContent();
    ok('3 heir who wants nothing (or less than 100 p) can still answer', !dis || /ønsker ikke noget|vil ikke have noget|ingen ønsker/i.test(txt), 'submit disabled=' + dis);
    await browser.close();
  }
  // 4. add an heir by mistake -> can you get rid of them?
  {
    const { browser, page } = await open({});
    await nav(page, 'arvinger'); await page.fill('#hName', 'Jonas'); await page.click('#addHeir button'); await page.waitForTimeout(100);
    const can = await page.evaluate(() => [...document.querySelectorAll('.heirs .heir button')].some(b => /fjern/i.test(b.textContent)));
    ok('4 a wrongly added heir can be removed', can);
    await browser.close();
  }
  // 5. "Afgiv ønsker som X" must land on X
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.submitted = { h1: true, h2: false, h3: true }; save(); });
    await nav(page, 'oversigt'); await nav(page, 'fordeling');
    const btn = await page.locator('main a.btn.go').textContent(); await page.click('main a.btn.go'); await page.waitForTimeout(200);
    const h1 = await page.locator('h1').textContent();
    ok('5 "' + btn + '" lands on that person', h1.includes('Lars'), h1);
    await browser.close();
  }
  // 6. "Mens de lever": wording that still talks about death/heirs
  {
    const { browser, page } = await open({});
    await page.click('button[data-mode="live"]'); await page.waitForTimeout(100);
    await page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    const bad = {};
    for (const v of ['oversigt', 'ting', 'arvinger', 'oensker', 'fordeling', 'underskrift']) {
      await nav(page, v); const t = await page.evaluate(() => document.querySelector('header').innerText + '\n' + document.querySelector('main').innerText);
      const hits = [...new Set((t.match(/[^.\n]*\b(arving\w*|boet efter|dødsfald\w*|arven|arvelod|boopgørelse\w*|testamente\w*)\b[^.\n]*/gi) || []).map(s => s.trim().slice(0, 90)))];
      if (hits.length) bad[v] = hits;
    }
    log.push('INFO 6 live-mode wording: ' + JSON.stringify(bad, null, 1));
    await nav(page, 'underskrift'); await page.click('#copy'); await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    ok('6 copied list does not say "boet efter" while she is alive', !/boet efter/i.test(clip), clip.split('\n')[0]);
    await page.screenshot({ path: path.join(SH, `edge-${tag}-live-oversigt.png`) });
    await browser.close();
  }
  // 7. kroner method end-to-end
  {
    const { browser, page } = await open({});
    await unlock(page, 'h3'); await page.click('button[data-method="kroner"]'); await page.waitForTimeout(100);
    await page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: false }; save(); render(); });
    const inp = page.locator('input[data-bid]').first(); await inp.fill('7000'); await inp.press('Tab'); await page.waitForTimeout(100);
    ok('7a bid is stored', await page.evaluate(() => S.bids.h3.i1 === 7000));
    await page.screenshot({ path: path.join(SH, `edge-${tag}-kroner-oensker.png`) });
    await page.click('#submit'); await page.waitForTimeout(250); await page.click('#reveal'); await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SH, `edge-${tag}-kroner-fordeling.png`), fullPage: true });
    const rows = await page.evaluate(() => [...document.querySelectorAll('table.st tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ')));
    log.push('INFO 7 settlement: ' + JSON.stringify(rows));
    const sum = await page.evaluate(() => solveBids().settle.reduce((a, s) => a + s.diff, 0));
    ok('7b settlement sums to zero', Math.abs(sum) < 1, sum);
    ok('7c no overflow kroner', (await overflow(page)).length === 0, (await overflow(page)).join('|'));
    await browser.close();
  }
  // 8. photos: how many fit before saving silently stops?
  {
    const { browser, page } = await open({});
    const r = await page.evaluate(async () => {
      // realistic phone photo -> same shrink as the page does (520px jpeg .8)
      const c = document.createElement('canvas'); c.width = 520; c.height = 390; const x = c.getContext('2d');
      const im = x.createImageData(520, 390); for (let i = 0; i < im.data.length; i += 4) { const n = (Math.sin(i * 0.0007) * 60 + Math.random() * 90 + 80) | 0; im.data[i] = n; im.data[i + 1] = n * 0.8; im.data[i + 2] = n * 0.6; im.data[i + 3] = 255; } x.putImageData(im, 0, 0);
      const url = c.toDataURL('image/jpeg', .8); let n = 0, failedAt = null;
      for (let k = 0; k < 400; k++) { S.photos['p' + k] = url; try { localStorage.setItem(KEY, JSON.stringify(S)); n++; } catch (e) { failedAt = k; break; } }
      // does the page itself tell the user?
      S.photos['zz'] = url; save(); const told = document.querySelector('#toast').classList.contains('show');
      return { perPhotoKB: Math.round(url.length / 1024), fit: n, failedAt, told };
    });
    log.push('INFO 8 photos: ' + JSON.stringify(r));
    ok('8 user is told when the browser storage is full', r.told, JSON.stringify(r));
    await browser.close();
  }
  // 9. long names / many heirs on a phone
  {
    const { browser, page } = await open({ device: 'iPhone SE' });
    await page.evaluate(() => { S.heirs[0].name = 'Anne-Margrethe Christoffersen'; S.heirs[1].name = 'Abdirahman'; S.items[0].name = 'Arkitekttegnet reolsystem i palisander med tilhørende skrivebord og seks skuffer'; S.bo = 'Ingeborg Margrethe Christoffersen-Rasmussen';
      for (let k = 0; k < 4; k++) { const id = 'x' + k; S.heirs.push({ id, name: 'Barnebarn ' + k, rel: 'Barnebarn', w: .5, sig: '' }); S.pts[id] = { i1: 100 }; S.bids[id] = {}; S.submitted[id] = true; }
      S.submitted.h3 = true; S.revealed = true; save(); });
    for (const v of ['oversigt', 'ting', 'arvinger', 'oensker', 'fordeling', 'underskrift']) { await nav(page, v); await page.waitForTimeout(200); const o = await overflow(page); ok('9 small phone (320px), long names, 7 heirs: no sideways scroll on ' + v, o.length === 0, o.join(' | ')); await page.screenshot({ path: path.join(SH, `edge-${tag}-se-${v}.png`) }); }
    const cols = await page.evaluate(() => S.heirs.map(h => hc(h.id)));
    ok('9b each heir has own colour (7 heirs)', new Set(cols).size === cols.length, cols.join(','));
    await browser.close();
  }
  // 10. changes after everyone has signed must reopen the agreement
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; S.heirs.forEach(h => h.sig = h.name); save(); });
    await nav(page, 'ting'); await page.locator('.grid .tag').nth(1).locator('button[data-del]').click(); await page.waitForTimeout(100);
    ok('10a deleting a thing after signing clears signatures', await page.evaluate(() => S.heirs.every(h => !h.sig) && !S.revealed));
    const used = await page.evaluate(() => S.heirs.map(h => h.name + ':' + used(h.id)));
    ok('10b heirs whose points sat on the deleted thing are asked again', await page.evaluate(() => S.heirs.every(h => used(h.id) === 100 || !S.submitted[h.id])), used.join(' '));
    await browser.close();
  }
  // 11. start forfra wipes without asking
  {
    const { browser, page } = await open({});
    await nav(page, 'ting'); await page.fill('#nName', 'Min egen ting'); await page.click('#addItem button[type=submit]'); await page.waitForTimeout(100);
    await page.click('#reset'); await page.waitForTimeout(200);
    const gone = await page.evaluate(() => !S.items.some(i => i.name === 'Min egen ting'));
    ok('11 "Start forfra" asks before deleting everything', !gone, 'one click wiped the data: ' + gone);
    await browser.close();
  }
  // 12. forgotten code
  {
    const { browser, page } = await open({});
    await unlock(page, 'h3', '4321'); await page.click('#lock'); await page.waitForTimeout(100);
    const t = await page.locator('main').innerText();
    ok('12 there is a way forward if a code is forgotten', /glemt/i.test(t), 'no "glemt kode" on the lock screen');
    await browser.close();
  }
  // 13. anyone can sign for anyone
  {
    const { browser, page } = await open({});
    await page.evaluate(() => { S.pins = { h1: '1111', h2: '2222', h3: '3333' }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    await nav(page, 'underskrift');
    await page.locator('form[data-signform="h2"] button').click(); await page.waitForTimeout(100);
    ok('13 signing as Lars needs Lars\'s code', await page.evaluate(() => !H('h2').sig), 'signed as: ' + await page.evaluate(() => H('h2').sig));
    await browser.close();
  }
  // 14. hostile / odd input
  {
    const { browser, page, errors } = await open({});
    await nav(page, 'ting'); await page.fill('#nName', '<img src=x onerror="window.__x=1"> "Mor\'s" & <b>fed</b>'); await page.fill('#nGroup', '<i>Rum</i>'); await page.click('#addItem button[type=submit]'); await page.waitForTimeout(200);
    await nav(page, 'arvinger'); await page.fill('#hName', '<script>window.__x=2</script>'); await page.click('#addHeir button'); await page.waitForTimeout(200);
    for (const v of ['oversigt', 'ting', 'arvinger', 'oensker', 'fordeling', 'underskrift']) await nav(page, v);
    ok('14a typed HTML is shown as text, never run', await page.evaluate(() => window.__x === undefined) && errors.length === 0, errors.join('|'));
    await page.evaluate(() => { S.heirs[0].name = '😀 Mette'; save(); }); await nav(page, 'arvinger');
    const ini = await page.locator('.heirs .heir .av').first().textContent();
    ok('14b emoji as first letter of a name shows correctly', ini === '😀', JSON.stringify(ini));
    await browser.close();
  }
  // 15. mobile: active step visible in the step bar on step 4 and 5
  {
    const { browser, page } = await open({ device: 'iPhone 13' });
    for (const v of ['fordeling', 'underskrift']) { await nav(page, v); await page.waitForTimeout(400);
      const vis = await page.evaluate(() => { const a = document.querySelector('nav.steps a[aria-current="page"]').getBoundingClientRect(); return a.left >= 0 && a.right <= innerWidth + 1; });
      ok('15 phone: current step is visible in the step bar on ' + v, vis); }
    await page.screenshot({ path: path.join(SH, `edge-${tag}-mobil-trinbar.png`), clip: { x: 0, y: 0, width: 390, height: 120 } });
    await browser.close();
  }
  // 16. AI photo naming with a stand-in for Claude (real one only exists on the published page)
  {
    const init = `window.__calls=0;window.claude={use:async(n)=>{ if(n==='sample')return {limits:async()=>({images:true}),json:async(p,o)=>{window.__calls++; if(window.__mode==='rate'){const e=new Error('x');e.code='rate_limited';throw e} if(window.__mode==='junk')return {name:'<b>x</b>'.repeat(40),room:'Garage',kind:'spaceship',valuable:'yes'}; return {name:'Stålampe i messing',room:'Stue',kind:'thing',valuable:true}}}; return null}};`;
    const { browser, page, errors } = await open({ init });
    await nav(page, 'ting'); await page.waitForTimeout(300);
    ok('16a AI box shows when Claude is available', await page.locator('.aibox').count() === 1);
    await page.locator('#aiPics').setInputFiles([path.join(FIX, 'photo.jpg'), path.join(FIX, 'photo.png')]); await page.waitForTimeout(1200);
    ok('16b two photos -> two new tags with AI names', await page.evaluate(() => S.items.filter(i => i.ai).length === 2 && S.items.filter(i => i.ai).every(i => S.photos[i.id])), await page.evaluate(() => JSON.stringify(S.items.slice(-2))));
    ok('16c valuable things are flagged "Bør vurderes"', await page.locator('.chip.warn:has-text("Bør vurderes")').count() === 2);
    await page.screenshot({ path: path.join(SH, `edge-${tag}-ai.png`), fullPage: false });
    await page.evaluate(() => { window.__mode = 'junk'; }); await page.locator('#aiPics').setInputFiles([path.join(FIX, 'photo.jpg')]); await page.waitForTimeout(800);
    const last = await page.evaluate(() => S.items[S.items.length - 1]);
    ok('16d odd AI answers are cleaned up', last.group === 'Andet' && last.k === 'thing' && last.name.length <= 60 && last.val === true, JSON.stringify(last));
    await page.evaluate(() => { window.__mode = 'rate'; }); await page.locator('#aiPics').setInputFiles([path.join(FIX, 'photo.jpg')]); await page.waitForTimeout(600);
    ok('16e rate limit gives a friendly message', (await page.locator('#toast').textContent()).includes('For mange'), await page.locator('#toast').textContent());
    await page.locator('#aiPics').setInputFiles([path.join(ROOT, 'lib.js')]).catch(() => {}); await page.waitForTimeout(600);
    ok('16f a non-image file gives a message, no crash', errors.length === 0 && (await page.locator('#toast').textContent()).length > 0, errors.join('|') + ' toast=' + await page.locator('#toast').textContent());
    ok('16g page is usable again after errors', await page.evaluate(() => busy === false));
    await browser.close();
  }
  // 17. deleting an heir's only wished-for thing / zero free things
  {
    const { browser, page, errors } = await open({});
    await page.evaluate(() => { S.items = S.items.filter(i => i.will); S.pts = { h1: {}, h2: {}, h3: {} }; S.submitted = { h1: true, h2: true, h3: true }; S.revealed = true; save(); });
    for (const v of ['oversigt', 'ting', 'oensker', 'fordeling', 'underskrift']) await nav(page, v);
    ok('17 only testament things left: pages still render', errors.length === 0, errors.join('|'));
    await page.evaluate(() => { S.items = []; save(); }); for (const v of ['oversigt', 'ting', 'oensker', 'fordeling', 'underskrift']) await nav(page, v);
    ok('17b no things at all: pages still render', errors.length === 0, errors.join('|'));
    await browser.close();
  }
  // 18. reduced motion + reveal still shows bars
  {
    const { browser, page } = await open({ reducedMotion: true });
    await page.evaluate(() => { S.submitted = { h1: true, h2: true, h3: true }; save(); }); await nav(page, 'oversigt'); await nav(page, 'fordeling'); await page.click('#reveal'); await page.waitForTimeout(200);
    ok('18 reduced motion: result shows at once', await page.evaluate(() => [...document.querySelectorAll('.bar2 span')].every(s => s.style.width !== '0px' && s.style.width !== '0') && [...document.querySelectorAll('[data-fly]')].every(e => getComputedStyle(e).opacity === '1')));
    await browser.close();
  }
  console.log(log.join('\n'));
})().catch(e => { console.log(log.join('\n')); console.error('CRASH', e); process.exit(1); });
