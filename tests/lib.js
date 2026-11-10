// Testharness: åbner prototypen fra disk i en rigtig browser (Playwright/Chromium).
// Siden serveres på https://godtdelt.test/ med skrifter og jsPDF fra lokale kopier, så testene kører uden netadgang.
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = __dirname;
const PAGE = process.env.PAGE_FILE || path.join(ROOT, '..', 'prototype', 'index.html');
const FIX = path.join(ROOT, 'fixtures');
const URL = 'https://godtdelt.test/';
const FONTS = [
  ['Fraunces', 'fraunces', [500, 600]],
  ['Hanken Grotesk', 'hanken-grotesk', [400, 500, 600, 700]],
  ['Caveat', 'caveat', [500, 700]],
  ['IBM Plex Mono', 'ibm-plex-mono', [400, 500]],
];
const fontCss = FONTS.map(([fam, slug, ws]) => ws.map(w =>
  `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;src:url(${URL}webfonts/${slug}/${slug}-latin-${w}-normal.woff2) format("woff2")}`).join('\n')).join('\n');

// Siden i repoet er et helt HTML-dokument. En nøgen side (uden <!doctype>) får samme skelet, som Artifact-værktøjet sætter på.
const SKELETON = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>';
function pageBody(file) {
  const src = fs.readFileSync(file, 'utf8');
  return src.trimStart().toLowerCase().startsWith('<!doctype') ? src : SKELETON + '\n' + src + '\n</body></html>';
}

// node_modules kan ligge i tests/ eller i repoets rod
const nm = (...p) => { for (const base of [ROOT, path.join(ROOT, '..')]) { const f = path.join(base, 'node_modules', ...p); if (fs.existsSync(f)) return f; } return null; };

async function open(opts = {}) {
  const browser = opts.browser || await chromium.launch();
  const ctxOpts = opts.device ? { ...devices[opts.device] } : { viewport: opts.viewport || { width: 1280, height: 860 }, deviceScaleFactor: 1 };
  if (opts.dark) ctxOpts.colorScheme = 'dark';
  if (opts.reducedMotion) ctxOpts.reducedMotion = 'reduce';
  const ctx = await browser.newContext(ctxOpts);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const errors = [];
  const pageFile = opts.file || PAGE;
  await ctx.route('**/*', async route => {
    const u = route.request().url();
    if (u === URL || u.startsWith(URL + '#')) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: pageBody(pageFile) });
    // sidens egne PDF-skrifter (prototype/fonts/hk-400.ttf) ligger ved siden af siden
    if (u.startsWith(URL + 'fonts/')) {
      const p = path.join(path.dirname(pageFile), 'fonts', u.slice((URL + 'fonts/').length));
      return fs.existsSync(p) ? route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(p) }) : route.fulfill({ status: 404, body: '' });
    }
    // webskrifterne, fra de lokale @fontsource-kopier i stedet for Google Fonts
    if (u.startsWith(URL + 'webfonts/')) {
      const [slug, file] = u.slice((URL + 'webfonts/').length).split('/');
      const p = nm('@fontsource', slug, 'files', file);
      if (p) return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(p), headers: { 'access-control-allow-origin': '*' } });
      return route.abort();
    }
    if (u.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: fontCss });
    if (u.includes('jspdf')) { const p = nm('jspdf', 'dist', 'jspdf.umd.min.js'); if (p) return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(p) }); }
    errors.push('BLOCKED ' + u);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL + (opts.hash ? '#' + opts.hash : ''));
  await page.evaluate(() => document.fonts.ready);
  return { browser, ctx, page, errors };
}

// Finder vandret overløb: dokumentet selv eller synlige elementer, der stikker ud af skærmen.
async function overflow(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    if (document.documentElement.scrollWidth > vw + 1) out.push('document scrollWidth ' + document.documentElement.scrollWidth + ' > ' + vw);
    for (const el of document.querySelectorAll('main *, header *, footer *')) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1)) {
        if (el.closest('nav.steps') || el.closest('.tw') || r.left < -5000) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'absolute' && r.left < -1000) continue;
        out.push(el.tagName + '.' + el.className + ' right=' + Math.round(r.right) + ' "' + (el.textContent || '').trim().slice(0, 30) + '"');
      }
    }
    return out.slice(0, 12);
  });
}

module.exports = { open, overflow, URL, ROOT, PAGE, FIX };
