# Arkitektur

*11. november 2026.*

## Overblik

```
Tovholder / arving (telefonens browser)
        │
        ▼
app/ (statisk, Netlify)  ──── supabase-js ────▶  Supabase, EU (Frankfurt)
   samme design som                                 ├─ Postgres: tabeller, RLS, RPC'er, triggere, auditlog
   prototypen                                       ├─ Auth: engangskode på SMS/mail
                                                    ├─ Storage: bucket "ting" (privat, billeder)
                                                    ├─ Edge Functions (Deno): invite, accept-invite, link-invite,
                                                    │    run-distribution, sign, ai-name, housekeeping,
                                                    │    stripe-checkout, stripe-webhook, pdf
                                                    └─ pg_cron: sletning kl. 03:15, housekeeping hvert 15. min
                                                            │
                                        ┌───────────────────┼───────────────────┐
                                        ▼                   ▼                   ▼
                                   Stripe (betaling)   GatewayAPI (SMS)    Anthropic (AI-navne)
                                                       Resend (mail)
```

Tre principper bærer det hele:

1. **Ønsker forlader aldrig arvingens egen adgang.** Databasen har ingen regel, der lader andre læse `wishes`. Fordelingen beregnes på serveren (`run-distribution`), som er det eneste sted, alle ønsker mødes. Browseren ser aldrig andres ønsker, kun resultatet og sin egen forklaring.
2. **Klienter kan kun ændre det, en bruger må ændre.** Alt andet (status, lod, betaling, fordeling, underskrift) sker gennem RPC'er med `security definer` eller gennem serverfunktioner med service role. Triggere afviser skrivning til beskyttede kolonner, når `is_server()` er falsk.
3. **Samme motor overalt.** `engine/arvora-engine.js` er sandheden. Prototypen har samme kode indlejret, og serveren har en kopi. Pariteten bevises i test.

## Mapper

| Sti | Hvad |
|---|---|
| `prototype/index.html` | Hele prototypen. Vanilla JS, én fil, `localStorage`. Demo og reference. |
| `engine/arvora-engine.js` | Motoren som ESM-modul: `solvePoints`, `solveBids`, `lodtal`, `drawLod`, `validatePoints`, `validateBids`. |
| `site/index.html` | Forsiden (arvora.dk). Statisk. |
| `app/` | Den rigtige app. Statisk, ingen framework, moduler i ESM. Bygges med Vite kun for at bundle og hashe filer. |
| `supabase/migrations/` | Skema, RLS, RPC'er, storage, cron, hærdning. Nummereret `YYYYMMDDHHMMSS_navn.sql`. |
| `supabase/functions/` | Edge Functions. `_shared/common.ts` (klienter, rate limit, hash, maskering) og `_shared/engine.js` (kopi af motoren). |
| `supabase/tests/rls.sql` | Adgangstest. Køres som postgres i SQL-editoren. |
| `tests/` | Playwright mod prototypen, Node-test af motoren, `run-all.js` tæller PASS/FAIL. |
| `docs/` | Alt skriftligt. |

## Forløbet i den rigtige version

1. **Opret bo.** Tovholderen logger ind med engangskode (Supabase Auth, mail eller SMS). `create_estate` opretter boet, trækker loddet i databasen og gør brugeren til tovholder (og evt. arving). Med partnerkode registreres henvisningen; ellers `stripe-checkout` → Stripe → `stripe-webhook` sætter `paid_at`.
2. **Ting.** Tovholderen indsætter rækker i `items` (kolonneliste), uploader billeder til bucket `ting/<estate>/<item>/…` og registrerer dem i `item_images`. `ai-name` giver forslag til navn og rum ud fra billedet; forslaget kan altid rettes, og `ai_suggested` markerer det.
3. **Arvinger.** Rækker i `heirs`. `invite` laver et token (256 bit, kun hash gemmes), udløb 14 dage, og lægger beskeden i `notifications`; `housekeeping` sender den.
4. **Arvingen åbner linket.** `accept-invite` (uden login) tjekker token, sender engangskode til samme telefon/mail som invitationen. Efter login kobler `link-invite` brugeren til arvingen, hvis telefon/mail stemmer med `sent_to`. Rækken i `estate_members` får `heir_id`.
5. **Ønsker.** `set_wishes` skriver arvingens egne ønsker; `lock_wishes` kræver 100 point (eller 0 med "ønsker ikke noget") og sætter `submitted_at`. `unlock_my_wishes` fortryder, mens boet er åbent. Tovholderen kan afgive for en arving med `proxy_set_wishes`, som kræver et samtykke i `consent_records`.
6. **Fordeling.** `start_distribution` låser boet (`laast`). `run-distribution` (server) læser alle ønsker, kører motoren med boets lod, gemmer kørslen (`distribution_runs`, resultat + `document_hash`), input (server-only), forklaring pr. arving, lodtrækninger, og frigiver (`released_at`, status `fordelt`). Fejler noget, kaldes `abort_distribution`.
7. **Underskrift.** `sign` sender engangskode (6 cifre, 10 min, 5 forsøg) → registrerer `underskrift_otp`-samtykke → `sign_run` indsætter underskriften bundet til kørslens version og dokumenthash. Når alle har underskrevet: status `underskrevet`, besked med PDF.
8. **Ny runde.** `request_reopen` + `consent_reopen` fra alle → kørslen markeres `superseded_at`, boet tilbage til `aaben`, underskrifterne falder (model B, se `beslutninger.md`).
9. **Afslutning og sletning.** `close_estate` sætter `retention_until` (90 dage som standard). `purge_expired_estates` sletter boet; `purge_queue` + `housekeeping` sletter filer i storage. `delete_estate_now` for tovholderen.

## Auth

- **Tovholder**: Supabase Auth med engangskode (mail eller SMS). Ingen adgangskode.
- **Arving**: samme, men kun via invitationslink. Linket giver ikke adgang i sig selv; det peger på, hvem koden må sendes til. En arving, der allerede er logget ind på en anden telefon, kan ikke bruge en andens link (`link-invite` kræver match på `sent_to`).
- **Partner**: Supabase Auth; rækker i `partner_members`.
- JWT'en bærer `sub`. Alle helpers (`is_member`, `my_heir_id` …) slår op i `estate_members`.

## Serverfunktioner

| Funktion | JWT | Gør |
|---|---|---|
| `invite` | ja | Tovholder: opret invitation, læg besked i kø. Rate limit pr. bo. |
| `accept-invite` | nej | Token → send engangskode til `sent_to`. Rate limit pr. IP og token. Returnerer maskeret adresse. |
| `link-invite` | ja | Kobl bruger til arving, hvis JWT'ens telefon/mail = `sent_to`. |
| `run-distribution` | ja (tovholder) | Kør motoren, gem kørsel, frigiv. |
| `sign` | ja (arving) | `request`: send kode. `verify`: tjek kode, registrér samtykke, kald `sign_run`. |
| `ai-name` | ja | Billede → navn/rum-forslag fra Anthropic. Fjerner "antik/ægte/original". |
| `housekeeping` | nej (egen nøgle) | Send beskeder i kø (SMS/mail), påmindelser 3 dage før frist, slet filer fra `purge_queue`, slet udløbne koder. |
| `stripe-checkout` | ja (tovholder) | Opret Checkout Session. |
| `stripe-webhook` | nej (Stripe-signatur) | Betalt → `payments`, `estates.paid_at`; refunderet → status. |
| `pdf` | ja | Fordelingslisten som PDF (pdf-lib, Hanken Grotesk). |

## Motoren på serveren

`run-distribution` importerer `_shared/engine.js`. `ENGINE_VERSION` gemmes på kørslen, så en senere motor aldrig ændrer en gammel fordeling. Input hashes (`input_hash`), så det kan bevises, at samme ønsker og lod gav samme resultat. Alt tilfældigt kommer fra boets lod, så kørslen kan gentages og efterprøves.

## Hvad der bevidst ikke er med

Ingen realtime, ingen chat, ingen push-beskeder, ingen app-butik, ingen framework i browseren. Alt, der kan være statisk, er statisk. Hvis produktet får succes, er det Supabase, der skalerer, ikke appen.
