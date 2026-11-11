// Tingene. Tovholderen sætter mærkesedler på, tager billeder og lader AI foreslå navne. Arvingerne kigger.
import { sb } from '../supabase.js';
import { must, fn } from '../api.js';
import { canEdit, heirById, T } from '../bo.js';
import { art, bg, ROOMS, ART } from '../art.js';
import { $, esc, lot, toast, arm, shrink, msg } from '../ui.js';

let roomFilter = 'Alle', editing = null, working = false, progress = '';

export function view(ctx) {
  const B = ctx.B, edit = B.isTov && canEdit(B);
  const rooms = ['Alle', ...new Set(B.items.map(i => i.room))];
  const list = B.items.filter(i => roomFilter === 'Alle' || i.room === roomFilter);
  const head = edit ? `<div class="eyebrow">trin 1 af 5</div><h1>Gå en tur gennem hjemmet</h1><p class="lead">Tag et billede af hver ting, rum for rum. Hver ting får sin egen mærkeseddel med et nummer, så alle taler om det samme.</p>`
    : `<div class="eyebrow">tingene</div><h1>${B.items.length} ting${B.items.length ? ' i ' + new Set(B.items.map(i => i.room)).size + ' rum' : ''}</h1><p class="lead">${B.isTov ? 'Tingene kan ikke ændres, når fordelingen er i gang. Vil I rette noget, skal alle sige ja til en ny runde.' : 'Det her er tingene, der skal deles. Dine ønsker giver du under Ønsker.'}</p>`;
  const aibox = edit ? `<div class="card aibox"><div class="grow"><b>Fotografér, og lad AI skrive navnene</b><div class="soft">Vælg op til 10 billeder ad gangen. AI foreslår navn og rum, og du retter bagefter. Billedet bruges kun til at finde navnet; AI sætter aldrig en pris.</div></div><label class="btn ochre" for="aiPics">${working ? progress || 'Arbejder …' : 'Vælg billeder'}</label><input id="aiPics" type="file" accept="image/*" multiple hidden ${working ? 'disabled' : ''}></div>` : '';
  const form = edit ? `<form class="card addbar" id="addItem"><label class="f wide">Hvad er det?<input id="nName" required maxlength="120" placeholder="Fx Kaffestel med blå blomster"></label>
    <label class="f">Rum<input id="nGroup" list="roomlist" maxlength="40" placeholder="Fx Køkken"><datalist id="roomlist">${[...new Set([...ROOMS, ...rooms.slice(1)])].map(r => `<option value="${esc(r)}">`).join('')}</datalist></label>
    <label class="f">Testamenteret til<select id="nWill"><option value="">Ingen</option>${B.heirs.map(h => `<option value="${h.id}">${esc(h.name)}</option>`).join('')}</select></label>
    <button class="btn go" type="submit">Sæt mærkeseddel på</button></form>` : '';
  return `${head}${aibox}${form}
  <div class="filters" role="group" aria-label="Filtrér efter rum">${rooms.map(r => `<button type="button" class="chip" data-room="${esc(r)}" aria-pressed="${r === roomFilter}">${esc(r)}${r === 'Alle' ? ` · ${B.items.length}` : ''}</button>`).join('')}</div>
  <div class="grid">${list.map(i => card(B, i, edit)).join('') || `<p class="soft">Ingen ting endnu.</p>`}</div>`;
}

function card(B, i, edit) {
  const img = B.images[i.id];
  return `<article class="tag" data-item="${i.id}"><span class="lot">${lot(i)}</span>
  <div class="pic" style="${bg(i.room)}">${img ? `<img src="${esc(img.url)}" alt="${esc(i.name)}" loading="lazy">` : art(i.kind, i.room)}</div>
  <div class="txt">${editing === i.id ? `<label class="f" for="rn-${i.id}">Navn<input class="nmedit" id="rn-${i.id}" data-rename="${i.id}" value="${esc(i.name)}" maxlength="120"></label>` : `<div class="name">${esc(i.name)}</div>`}
   ${edit ? `<select data-roomof="${i.id}" aria-label="Rum" style="padding:4px 8px;font-size:12.5px;width:auto">${[...new Set([...ROOMS, i.room])].map(r => `<option ${r === i.room ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>` : `<div class="room">${esc(i.room)}</div>`}
   ${i.description ? `<div class="soft" style="font-size:12.5px">${esc(i.description)}</div>` : ''}
   ${i.ai_suggested || i.valuable ? `<div class="row" style="gap:6px">${i.ai_suggested ? '<span class="chip">Navn fra AI</span>' : ''}${i.valuable ? '<span class="chip warn">Bør vurderes</span>' : ''}</div>` : ''}
   ${edit ? `<label class="f" style="margin-top:4px">Testamenteret til<select data-willof="${i.id}" style="padding:4px 8px;font-size:12.5px"><option value="">Ingen</option>${B.heirs.map(h => `<option value="${h.id}" ${h.id === i.will_heir_id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></label>` : i.will_heir_id ? `<div><span class="chip will">Testamenteret til ${esc(heirById(B, i.will_heir_id)?.name || '?')}</span></div>` : ''}
   ${edit ? `<div class="acts"><label class="btn sm" for="ph-${i.id}">${img ? 'Nyt billede' : 'Tag billede'}</label><input id="ph-${i.id}" type="file" accept="image/*" capture="environment" data-photo="${i.id}" hidden>
   <button class="btn sm" type="button" data-edit="${i.id}">Ret navn</button><button class="btn sm" type="button" data-del="${i.id}">Fjern</button></div>` : ''}
  </div></article>`;
}

/* ---------- Skrivning ---------- */
async function upload(B, item, file) {
  const blob = await shrink(file);
  const path = `${B.id}/${item.id}/${crypto.randomUUID()}.jpg`;
  must(await sb.storage.from('ting').upload(path, blob, { contentType: 'image/jpeg', upsert: false }));
  must(await sb.from('item_images').insert({ estate_id: B.id, item_id: item.id, path, bytes: blob.size }));
  // Ét billede pr. ting: det gamle fjernes.
  const old = B.images[item.id];
  if (old) { await sb.from('item_images').delete().eq('path', old.path); await sb.storage.from('ting').remove([old.path]); }
  return path;
}
async function insertItem(B, fields) {
  return must(await sb.from('items').insert({ estate_id: B.id, name: 'Ny ting', room: 'Andet', ...fields }).select('*').single());
}

export async function change(e, ctx) {
  const B = ctx.B, t = e.target, d = t.dataset;
  if (t.id === 'aiPics' && t.files.length && !working) {
    working = true; let n = 0, fail = 0; const files = [...t.files].slice(0, 10);
    for (let k = 0; k < files.length; k++) {
      progress = `Billede ${k + 1} af ${files.length} …`; ctx.render();
      try {
        const item = await insertItem(B, {});
        B.items.push(item);
        const path = await upload(B, item, files[k]);
        const existing = B.items.filter(x => x.id !== item.id).map(x => ({ no: x.no, name: x.name }));
        let fields = {};
        try {
          const r = await fn('ai-name', { estate_id: B.id, path, existing });
          if (r.ok) fields = { name: r.name, room: r.room, kind: r.kind, valuable: r.valuable, description: r.description || null, ai_suggested: true };
        } catch (err) { if (err.status === 503) toast('AI-navne er ikke sat op endnu. Skriv navnet selv.', true); else toast(msg(err), true); }
        if (Object.keys(fields).length) must(await sb.from('items').update(fields).eq('id', item.id));
        n++;
      } catch (err) { fail++; toast(msg(err), true); }
    }
    working = false; progress = ''; await ctx.reload();
    if (n) toast(`${n} ting tilføjet. Ret navnene, hvis de ikke passer.` + (fail ? ` ${fail} billeder kunne ikke læses.` : ''), true);
    return;
  }
  if (d.rename) { await closeEdit(ctx, t, true); return; }
  if (d.roomof) { must(await sb.from('items').update({ room: t.value }).eq('id', d.roomof)); const it = B.items.find(i => i.id === d.roomof); if (it) it.room = t.value; ctx.render(); return; }
  if (d.willof) { must(await sb.from('items').update({ will_heir_id: t.value || null }).eq('id', d.willof)); await ctx.reload(); toast(t.value ? 'Tingen går efter testamentet og tæller ikke med i pointene' : 'Testamente fjernet'); return; }
  if (d.photo && t.files[0]) {
    const it = B.items.find(i => i.id === d.photo); if (!it) return;
    toast('Gemmer billedet …');
    await upload(B, it, t.files[0]); await ctx.reload(); toast('Billedet er gemt'); return;
  }
}

async function closeEdit(ctx, t, keep) {
  const B = ctx.B, it = B.items.find(i => i.id === t.dataset.rename); if (!it || editing !== it.id) return; editing = null;
  const v = t.value.trim().slice(0, 120);
  if (keep && v && v !== it.name) { must(await sb.from('items').update({ name: v, ai_suggested: false }).eq('id', it.id)); it.name = v; it.ai_suggested = false; }
  ctx.render();
}

export async function click(e, ctx) {
  const B = ctx.B, b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.room) { roomFilter = d.room; ctx.render(); return; }
  if (d.edit) { editing = d.edit; ctx.render(); const el = document.getElementById('rn-' + d.edit); if (el) { el.focus(); el.select(); } return; }
  if (d.del) {
    const it = B.items.find(i => i.id === d.del); if (!it) return;
    if (!arm('del' + it.id, b, 'Fjern? Tryk igen')) return;
    must(await sb.from('items').update({ deleted_at: new Date().toISOString() }).eq('id', it.id));
    await ctx.reload(); toast('Tingen er fjernet' + (B.status === 'aaben' ? '. Arvinger med point på den skal fordele igen.' : '')); return;
  }
}
export async function submit(e, ctx) {
  const B = ctx.B;
  if (e.target.id === 'addItem') {
    const name = $('#nName').value.trim(); if (!name) return;
    const kind = guessKind(name);
    await insertItem(B, { name, room: $('#nGroup').value.trim() || 'Andet', will_heir_id: $('#nWill').value || null, kind });
    await ctx.reload(); toast('Mærkeseddel sat på');
  }
}
export function keydown(e, ctx) { const t = e.target; if (!t.dataset?.rename) return; if (e.key === 'Enter') { e.preventDefault(); closeEdit(ctx, t, true); } else if (e.key === 'Escape') closeEdit(ctx, t, false); }
export function focusout(e, ctx) { const t = e.target; if (t.dataset?.rename) closeEdit(ctx, t, true); }

/* Et gæt på tegningen ud fra navnet, når der ikke er et billede. */
function guessKind(n) {
  n = n.toLowerCase();
  const m = [['bord', 'table'], ['stel', 'plates'], ['ur', 'clock'], ['symask', 'sewing'], ['maleri', 'painting'], ['ring', 'ring'], ['stol', 'armchair'], ['gryde', 'pots'], ['kasse', 'box'], ['album', 'album'], ['radio', 'radio'], ['kommode', 'dresser'], ['have', 'garden'], ['værktøj', 'tools'], ['platte', 'plate'], ['tæppe', 'blanket']];
  for (const [k, v] of m) if (n.includes(k) && ART[v]) return v;
  return 'thing';
}
