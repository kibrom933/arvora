// Små hjælpere til visningerne. Samme udtryk som prototypen.
import { HC } from './art.js';

export const $ = s => document.querySelector(s);
export const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const lot = i => 'Nr. ' + String(i.no).padStart(3, '0');
export const kr = n => Math.round(n).toLocaleString('da-DK') + ' kr.';
export const og = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' og ' + a[a.length - 1];
export const dato = d => d ? new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long' }) : '';
export const datoKort = d => d ? new Date(d).toLocaleDateString('da-DK') : '';

export function toast(t, long) {
  const el = $('#toast'); if (!el) return;
  el.textContent = t; el.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), long ? 6000 : 2800);
}

/* Knapper, der sletter noget, skal trykkes to gange inden for 4 sekunder. */
let armed = null;
export function arm(key, btn, label) {
  if (armed && armed.key === key) { clearTimeout(armed.t); if (armed.btn.isConnected) armed.btn.textContent = armed.old; armed = null; return true; }
  if (armed) { clearTimeout(armed.t); if (armed.btn.isConnected) armed.btn.textContent = armed.old; }
  const old = btn.textContent; btn.textContent = label;
  armed = { key, btn, old, t: setTimeout(() => { if (btn.isConnected) btn.textContent = old; armed = null; }, 4000) };
  return false;
}

/** Farve og avatar pr. arving ud fra rækkefølgen i boet. */
export const heirColor = (heirs, id) => HC[Math.max(0, heirs.findIndex(h => h.id === id)) % HC.length];
export const av = (heirs, h) => `<span class="av" style="background:${heirColor(heirs, h.id)}" aria-hidden="true">${esc([...h.name][0] || '?')}</span>`;

/** Fejl fra serveren eller databasen, som tekst til brugeren. */
export const msg = e => (e && e.message) || 'Noget gik galt. Prøv igen.';

/** Knap i gang: slår den fra og viser "Arbejder …", indtil løftet er indfriet. */
export async function busy(btn, p, label = 'Arbejder …') {
  if (!btn) return p;
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  try { return await p; } finally { if (btn.isConnected) { btn.disabled = false; btn.textContent = old; } }
}

/** Skalér et billede i browseren før upload: længste side 1600 px, JPEG. Returnerer Blob. */
export function shrink(file, max = 1600, q = 0.85) {
  return new Promise((res, rej) => {
    const im = new Image(); const url = URL.createObjectURL(file);
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Billedet kunne ikke læses')); };
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('blob')), 'image/jpeg', q);
    };
    im.src = url;
  });
}
