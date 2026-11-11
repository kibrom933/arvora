// Oversigt over de boer, brugeren er med i. Tovholder eller arving.
import { sb } from '../supabase.js';
import { must } from '../api.js';
import { esc } from '../ui.js';

const STATUS = { kladde: 'Ikke åbnet endnu', aaben: 'Åbent for ønsker', laast: 'Fordelingen beregnes', fordelt: 'Fordelt, venter på underskrifter', underskrevet: 'Alle har underskrevet', afsluttet: 'Afsluttet', slettet: 'Slettet' };

export async function view(ctx) {
  const rows = must(await sb.from('estate_overview').select('*').order('created_at', { ascending: false })) ?? [];
  const members = must(await sb.from('estate_members').select('estate_id, role').eq('user_id', ctx.user.id)) ?? [];
  const role = Object.fromEntries(members.map(m => [m.estate_id, m.role]));
  return `<div class="eyebrow">dine boer</div><h1>${rows.length ? 'Hvor vil du hen?' : 'Velkommen'}</h1>
  <p class="lead">${rows.length ? 'Her er de boer, du er med i.' : 'Du er ikke med i noget bo endnu. Er du tovholder, opretter du boet her. Er du arving, skal du bruge linket fra tovholderen.'}</p>
  <div class="heirs">${rows.map(r => `<a class="card heir" href="/bo/${r.id}" style="text-decoration:none"><div><div class="eyebrow" style="font-size:20px">${r.mode === 'live' ? 'mens de lever' : 'boet efter'}</div><h2 style="margin:0">${esc(r.name)}</h2></div>
    <div class="soft" style="font-size:13.5px">${STATUS[r.status] || r.status}${r.deadline ? ' · frist ' + new Date(r.deadline).toLocaleDateString('da-DK') : ''}</div>
    <div class="row" style="gap:6px"><span class="chip">${r.items} ting</span><span class="chip">${r.submitted} af ${r.heirs} har svaret</span><span class="chip">${role[r.id] === 'tovholder' ? 'Tovholder' : 'Arving'}</span></div></a>`).join('')}
  <a class="card heir" href="/nyt" style="border-style:dashed;box-shadow:none;text-decoration:none;align-content:center;justify-items:start"><h3>Opret et bo</h3><span class="soft" style="font-size:13.5px">Du bliver tovholder og inviterer de andre.</span></a></div>`;
}
