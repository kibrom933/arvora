// Arvora, den rigtige app. Ingen framework: en lille router, visninger som funktioner, hændelser delegeret fra document.
import './style.css';
import { sb } from './supabase.js';
import { loadBo, T, allIn, revealed, allSigned } from './bo.js';
import { $, esc, toast, msg } from './ui.js';
import * as login from './views/login.js';
import * as boer from './views/boer.js';
import * as nyt from './views/nyt.js';
import * as invite from './views/invite.js';
import * as oversigt from './views/oversigt.js';
import * as ting from './views/ting.js';
import * as arvinger from './views/arvinger.js';
import * as oensker from './views/oensker.js';
import * as fordeling from './views/fordeling.js';
import * as underskrift from './views/underskrift.js';
import * as tekst from './views/tekst.js';

const STEPS = { oversigt, ting, arvinger, oensker, fordeling, underskrift };
const ctx = { user: null, B: null, step: 'oversigt', view: null, params: {}, nav, reload, render, busy: false };

/* ---------- Routing ---------- */
function route() {
  const p = location.pathname.replace(/\/+$/, '') || '/';
  let m;
  if (p === '/') return { name: 'home' };
  if (p === '/log-ind') return { name: 'login' };
  if (p === '/nyt') return { name: 'nyt' };
  if (p === '/vilkaar' || p === '/privatliv') return { name: 'tekst', page: p.slice(1) };
  if ((m = p.match(/^\/i\/([A-Za-z0-9_-]{20,100})$/))) return { name: 'invite', token: m[1] };
  if ((m = p.match(/^\/bo\/([0-9a-f-]{36})(?:\/([a-z]+))?$/))) return { name: 'bo', id: m[1], step: m[2] && STEPS[m[2]] ? m[2] : 'oversigt' };
  return { name: 'missing' };
}
let stale = true; // boet hentes igen ved hver navigation, ikke ved hver tegning
export function nav(path, replace) { history[replace ? 'replaceState' : 'pushState']({}, '', path); stale = true; render(); scrollTo(0, 0); }
addEventListener('popstate', () => { stale = true; render(); });
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
  e.preventDefault(); nav(href);
});

/* ---------- Render ---------- */
let loadedId = null;
async function render() {
  const r = route(); ctx.params = r;
  const { data: { session } } = await sb.auth.getSession();
  ctx.user = session?.user ?? null;
  $('#logout').hidden = !ctx.user;
  const steps = $('#steps'); steps.hidden = true; $('#boName').textContent = ''; $('#pill').hidden = true;

  try {
    if (r.name === 'home') { ctx.view = ctx.user ? boer : login; ctx.B = null; }
    else if (r.name === 'login') { ctx.view = login; }
    else if (r.name === 'nyt') { if (!ctx.user) return nav('/log-ind?next=/nyt', true); ctx.view = nyt; }
    else if (r.name === 'invite') { ctx.view = invite; }
    else if (r.name === 'tekst') { ctx.view = tekst; }
    else if (r.name === 'bo') {
      if (!ctx.user) return nav('/log-ind?next=' + encodeURIComponent(location.pathname), true);
      if (stale || !ctx.B || ctx.B.id !== r.id || loadedId !== r.id) { if (!ctx.B || ctx.B.id !== r.id) $('#view').innerHTML = '<p class="soft" style="padding:40px 0">Henter boet …</p>'; ctx.B = await loadBo(r.id, ctx.user.id); loadedId = r.id; stale = false; }
      ctx.step = r.step; ctx.view = STEPS[r.step];
      $('#boName').textContent = T(ctx.B, 'Boet efter ' + ctx.B.name, ctx.B.name + ' · mens de lever');
      const pill = $('#pill'); pill.hidden = false; pill.textContent = ctx.B.isTov ? 'Tovholder' : 'Arving';
      drawSteps();
    }
    else { ctx.view = null; $('#view').innerHTML = '<h1>Siden findes ikke</h1><p class="lead"><a href="/">Til forsiden</a></p>'; return; }
    $('#view').innerHTML = await ctx.view.view(ctx);
    ctx.view.after?.(ctx);
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<h1>Det gik ikke</h1><p class="lead">${esc(msg(e))}</p><p><a class="btn" href="/">Til oversigten</a></p>`;
  }
}
function drawSteps() {
  const B = ctx.B, s = $('#steps');
  const all = [['oversigt', '⌂', 'Oversigt'], ['ting', '1', 'Ting'], ['arvinger', '2', T(B, 'Arvinger', 'Børn')], ['oensker', '3', 'Ønsker'], ['fordeling', '4', 'Fordeling'], ['underskrift', '5', T(B, 'Underskrift', 'Godkendelse')]];
  const done = { ting: B.items.length > 0, arvinger: B.heirs.length > 1, oensker: allIn(B), fordeling: revealed(B), underskrift: allSigned(B) };
  s.innerHTML = all.map(([k, n, t]) => `<a href="/bo/${B.id}/${k}" data-v="${k}" ${k === ctx.step ? 'aria-current="page"' : ''} class="${done[k] && k !== ctx.step ? 'done' : ''}"><span class="n">${n}</span>${t}</a>`).join('');
  s.hidden = false;
  const cur = s.querySelector('[aria-current]'); if (cur) s.scrollLeft += cur.getBoundingClientRect().left - s.getBoundingClientRect().left - (s.clientWidth - cur.offsetWidth) / 2;
}
async function reload() { stale = true; await render(); }

/* ---------- Hændelser ---------- */
for (const type of ['click', 'change', 'submit', 'input', 'keydown', 'focusout']) {
  document.addEventListener(type, async e => {
    if (type === 'submit') e.preventDefault();
    if (type === 'click' && e.target.closest('#logout')) { await sb.auth.signOut(); ctx.B = null; loadedId = null; nav('/'); return; }
    const h = ctx.view?.[type]; if (!h) return;
    try { await h(e, ctx); } catch (err) { if (!(err.status >= 400 && err.status < 500)) console.error(err); toast(msg(err), true); }
  });
}
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { ctx.B = null; loadedId = null; } });

render();
