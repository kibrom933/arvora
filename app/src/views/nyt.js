// Opret et bo. Tovholderen bliver medlem med det samme og kan selv være arving.
import { rpc } from '../api.js';
import { $, toast, busy } from '../ui.js';

export function view() {
  return `<div class="eyebrow">nyt bo</div><h1>Hvem er det, der skal deles efter?</h1>
  <p class="lead">Du bliver tovholder. Boet åbnes for ønsker, når det er betalt, og mindst to arvinger er med.</p>
  <form class="card lock" id="nytForm" style="max-width:620px">
    <div class="modes" role="group" aria-label="Situation"><label class="chip"><input type="radio" name="mode" value="doed" checked style="width:auto;margin:0 4px 0 0"> Efter et dødsfald</label><label class="chip"><input type="radio" name="mode" value="live" style="width:auto;margin:0 4px 0 0"> Mens de lever</label></div>
    <label class="f" style="width:100%">Navn<input id="nName" required maxlength="120" placeholder="Fx Inger Marie Jensen"></label>
    <label class="f" style="width:100%">Årstal (valgfrit)<input id="nYears" maxlength="40" placeholder="Fx 1938 – 2026"></label>
    <div class="row" style="width:100%"><label class="f" style="flex:1">Frist for ønsker<input id="nDeadline" type="date"></label><label class="f" style="flex:1">Metode<select id="nMethod"><option value="point">Pointmetoden</option><option value="kroner">Kronemetoden</option></select></label></div>
    <label class="row" style="font-weight:400;font-size:14px"><input type="checkbox" id="meHeir" checked style="width:auto"> Jeg er selv arving</label>
    <div class="row" id="meRow" style="width:100%"><label class="f" style="flex:1">Mit navn<input id="myName" maxlength="80" placeholder="Fx Mette"></label><label class="f" style="flex:1">Relation<input id="myRel" maxlength="60" placeholder="Fx Datter"></label></div>
    <label class="f" style="width:100%">Partnerkode (hvis I har fået en)<input id="nPartner" maxlength="12" style="text-transform:uppercase" placeholder="Fx BEGRAV01"></label>
    <button class="btn go" type="submit">Opret boet</button>
    <p class="soft" style="margin:0;font-size:13.5px">Arvora giver ikke juridisk rådgivning. Boopgørelse og skifteret ligger uden for Arvora.</p>
  </form>`;
}

export function change(e) { if (e.target.id === 'meHeir') $('#meRow').hidden = !e.target.checked; }

export async function submit(e, ctx) {
  if (e.target.id !== 'nytForm') return;
  const btn = e.target.querySelector('button[type=submit]');
  const id = await busy(btn, rpc('create_estate', {
    p_name: $('#nName').value.trim(), p_years: $('#nYears').value.trim() || null,
    p_mode: e.target.mode.value, p_method: $('#nMethod').value, p_deadline: $('#nDeadline').value || null,
    p_partner_code: $('#nPartner').value.trim().toUpperCase() || null,
    p_me_as_heir: $('#meHeir').checked, p_my_name: $('#myName').value.trim() || null, p_my_relation: $('#myRel').value.trim() || null,
  }), 'Opretter …');
  toast('Boet er oprettet'); ctx.nav('/bo/' + id + '/ting', true);
}
