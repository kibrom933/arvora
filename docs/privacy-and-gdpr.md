# Privatliv og GDPR

*11. november 2026. Dette er den tekniske og organisatoriske beskrivelse, som privatlivspolitikken og juristens gennemgang bygger på. Det er ikke juridisk rådgivning.*

## Roller

- **Dataansvarlig:** Arvora (ejerens enkeltmandsvirksomhed, CVR mangler). Arvora bestemmer formål og midler.
- **Databehandlere:** Supabase (database, login, filer; Frankfurt), Stripe (betaling), Resend (mail), GatewayAPI (SMS, dansk), Anthropic (navneforslag ud fra billeder), Netlify (hosting af statiske filer, ingen persondata ud over adgangslogs).
- **Tovholderen** indtaster oplysninger om andre (arvingerne). Det sker som led i boets afvikling; Arvora er stadig dataansvarlig for behandlingen i tjenesten.

## Hvilke oplysninger, hvorfor, hvor længe

| Oplysning | Om hvem | Formål | Hjemmel (forslag til juristen) | Slettes |
|---|---|---|---|---|
| Navn, telefon, mail, relation, arvelod | Arvinger og tovholder | Invitation, login, fordeling, underskrift | Kontrakt (tovholder); legitim interesse (arvinger: nødvendig for den tjeneste, de inviteres til) | Med boet |
| Afdødes navn og årstal | Afdøde | Overskrift på boet | Ikke persondata om levende; nævnes alligevel | Med boet |
| Billeder og beskrivelser af ting | Afdødes hjem | Fordelingen | Kontrakt | Med boet |
| Ønsker (point/bud) | Arvinger | Fordelingen | Kontrakt/legitim interesse | Med boet |
| Fordeling, forklaringer, lodtrækninger | Arvinger | Resultatet, dokumentation | Kontrakt | Med boet |
| Underskrift: navn, tidspunkt, IP, browser, dokumenthash | Arvinger | Bevis for, at fordelingen er godkendt | Kontrakt / legitim interesse | Med boet |
| Samtykker (vilkår, privatliv, fuldmagt, ny runde, kode) | Alle | Dokumentation | Retlig forpligtelse (dokumentation af samtykke) | Med boet |
| Betaling: beløb, Stripe-id, kvitteringslink | Tovholder | Betaling, bogføring | Kontrakt; bogføringsloven (5 år) for selve fakturaen hos Stripe | Betalingsrækken med boet; bogføringsdata hos Stripe i 5 år |
| Auditlog (hvem ændrede hvad, uden indhold) | Alle | Sikkerhed, dokumentation | Legitim interesse | Anonymiseres med boet, slettes efter 12 mdr. |
| Beskeder (modtager, type, status) | Alle | Levering | Kontrakt | Med boet |
| Engangskoder (hash) | Alle | Login og underskrift | Kontrakt | 10 minutter |
| Partnerens navn, mail, kode | Partner | Henvisning og afregning | Kontrakt | Ved ophør + 5 år for fakturaer |

**Standardopbevaring:** 90 dage efter boet er afsluttet. Tovholderen kan vælge 30–730 dage og kan slette før. Boer, der aldrig afsluttes, skal også slettes: *forslag* 12 måneder uden aktivitet (ikke implementeret; kræver et felt og en regel i `purge_expired_estates`).

## Følsomme oplysninger

Ingen særlige kategorier indsamles. Men: et hjem fortæller om religion (en bibel, en bedemåtte), helbred (hjælpemidler) og mere. Billederne behandles derfor som personoplysninger med høj beskyttelse: privat bucket, adgang kun for boets medlemmer, slettes med boet, sendes til AI kun for at foreslå et navn og gemmes ikke dér.

Ønsker er ikke en særlig kategori, men de er det, familierne frygter mest at få lækket. De behandles som om de var.

## Registreredes rettigheder

| Ret | Hvordan |
|---|---|
| Indsigt | Tovholder: alt i sit bo kan ses i appen; PDF'en er den samlede udskrift. Arving: ser sine egne ønsker, sin forklaring, fordelingen. Resten (andres ønsker) er ikke hendes oplysninger. Henvendelse til mailen i politikken for en samlet udskrift. |
| Berigtigelse | Tovholderen retter navne og kontaktoplysninger, mens boet er åbent. Efter underskrift kan navne ikke ændres uden ny runde. |
| Sletning | Tovholderen: "Slet boet nu". Arvingen: kan bede om at blive fjernet fra boet, mens det er åbent (tovholderen fjerner); efter underskrift er hendes navn del af et dokument, de andre har underskrevet, og sletning sker med boet. *Juristen skal vurdere balancen.* |
| Dataportabilitet | PDF og kopiér-tekst. |
| Indsigelse | Mail. En arving, der ikke vil være med, kan lade være med at svare; tovholderen kan markere "ønsker ikke noget" kun med hendes samtykke (fuldmagt). |

Svarfrist: 1 måned. Henvendelser skal kunne verificeres (engangskode til den telefon/mail, vi har).

## Sikkerhed (art. 32)

Se `security-and-privacy-audit.md`. Kort: kryptering i transit (TLS) og i hvile (Supabase-disk), adgang pr. række i databasen, ønsker kun læsbare af ejeren, serverens nøgle kun på serveren, auditlog, rate limit, automatisk sletning, backup hos Supabase.

## Brud

Ved mistanke om læk: (1) luk adgangen (sæt boet til `slettet` eller pausér projektet), (2) find omfanget i auditloggen, (3) Datatilsynet inden 72 timer, hvis der er risiko for de berørte, (4) besked til familien. Kontaktperson: ejeren. *Skriv en kort procedure med telefonnumre, når virksomheden findes.*

## Databehandleraftaler

Alle fem leverandører tilbyder standard-DPA'er, der accepteres online. Overførsel uden for EU: Supabase (Frankfurt, ingen), Stripe (USA, SCC + DPF), Resend (USA, SCC + DPF), GatewayAPI (Danmark), Anthropic (USA, SCC + DPF; bekræft "zero data retention" eller at API-input ikke bruges til træning). Netlify (USA/CDN; kun statiske filer og adgangslogs).

## Cookies og sporing

Appen og forsiden bruger ingen cookies ud over Supabase' login-token i `localStorage`. Ingen analyse i V1. Skal der måles, bruges en cookie-fri måling (fx Plausible, EU-hostet) uden samtykkebanner. Beslutning: ingen samtykkebanner, fordi der intet er at samtykke til.

## Registrering (art. 30)

Dette dokument plus `database-schema.md` udgør fortegnelsen. Opdateres ved hver ny behandling.

## Konsekvensanalyse (DPIA)

Formentlig ikke lovpligtig (ingen særlige kategorier i stort omfang, ingen systematisk overvågning), men behandlingen er følsom for familierne. Dette dokument og sikkerhedsgennemgangen udgør en frivillig, let DPIA. Juristen afgør, om en formel skal laves.
