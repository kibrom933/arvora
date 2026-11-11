// Vilkår og privatliv. Udkast, indtil en jurist har gennemgået dem (docs/terms-and-conditions-draft.md, privacy-policy-draft.md).
export function view(ctx) {
  const p = ctx.params.page;
  if (p === 'vilkaar') return `<div class="eyebrow">udkast</div><h1>Vilkår</h1>
  <p class="lead">Arvora er et værktøj til jeres egen aftale om at dele indbo. Arvora giver ikke juridisk rådgivning, laver ikke boopgørelse og træffer ingen afgørelser. Skifteret, bobestyrer og advokat erstattes ikke.</p>
  <div class="card" style="padding:22px;max-width:720px;display:grid;gap:12px;font-size:15px">
  <p><b>Hvad I får.</b> Tovholderen registrerer tingene, hver arving giver ønsker i hemmelighed, Arvora foreslår en fordeling efter en kendt metode (Maximum Nash Welfare), og alle godkender med en engangskode. Fordelingslisten kan hentes som PDF.</p>
  <p><b>Pris.</b> Ét bo koster 795 kr. inkl. moms (op til 6 arvinger og 300 ting). Betaling før boet åbnes. 14 dages fortrydelsesret, som bortfalder, når fordelingen er vist første gang.</p>
  <p><b>Godkendelsen</b> med kode er en elektronisk godkendelse, ikke en kvalificeret elektronisk signatur. Vi gemmer navn, tidspunkt, IP, browser og et fingeraftryk af dokumentet som dokumentation.</p>
  <p><b>Ingen ser jeres ønsker.</b> Heller ikke tovholderen eller Arvora. Fordelingen beregnes på vores server.</p>
  <p><b>Sletning.</b> Boet slettes automatisk 90 dage efter afslutning; tovholderen kan vælge 30–730 dage og kan slette før. Hent PDF'en inden.</p>
  <p><b>Ansvar.</b> Vi er ansvarlige for, at tjenesten virker, ikke for jeres aftale, tingenes værdi eller boets juridiske behandling. Vores ansvar kan ikke overstige det betalte beløb, hvor dansk ret tillader det.</p>
  <p class="soft" style="font-size:13px">Dette er et udkast. De endelige vilkår offentliggøres, når en dansk jurist har gennemgået dem.</p></div>`;
  return `<div class="eyebrow">udkast</div><h1>Privatliv</h1>
  <p class="lead">Vi behandler kun det, der skal til for at dele tingene: navne, telefon eller mail, billeder og beskrivelser af tingene, ønsker, fordeling og godkendelser.</p>
  <div class="card" style="padding:22px;max-width:720px;display:grid;gap:12px;font-size:15px">
  <p><b>Ønsker</b> kan kun ses af den arving, de tilhører. Hverken tovholderen, de andre arvinger eller Arvoras medarbejdere kan se dem.</p>
  <p><b>Billeder og AI.</b> Beder du om et navneforslag, sendes billedet til Anthropic (USA), som svarer med et navn og et rum. Billedet gemmes ikke dér og bruges ikke til træning. Forslaget kan altid rettes.</p>
  <p><b>Leverandører:</b> Supabase (database, login, billeder; Frankfurt), Stripe (betaling), Resend (mail), GatewayAPI (SMS, Danmark), Anthropic (AI-forslag), Netlify (hjemmesiden). Vi sælger ikke oplysninger og viser ikke annoncer.</p>
  <p><b>Hvor længe.</b> Boet slettes 90 dage efter afslutning (eller den frist, tovholderen vælger). Logs anonymiseres ved sletningen og slettes efter 12 måneder. Engangskoder slettes efter 10 minutter.</p>
  <p><b>Dine rettigheder.</b> Indsigt, rettelse, sletning, indsigelse: skriv til os. Du kan klage til Datatilsynet.</p>
  <p><b>Cookies.</b> Ingen, ud over at dit login gemmes i browseren.</p>
  <p class="soft" style="font-size:13px">Dette er et udkast. Den endelige politik offentliggøres, når en dansk jurist har gennemgået den.</p></div>`;
}
