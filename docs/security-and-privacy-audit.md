# Sikkerheds- og privatlivsgennemgang

*11. november 2026. Gennemgang af den backend, der ligger på Arvora dev. Opdateres efter hver skemaændring og efter RLS-testen.*

## Trusler, vi beskytter mod

| # | Trussel | Hvorfor den betyder noget |
|---|---|---|
| T1 | En arving (eller tovholderen) læser andres ønsker | Hele produktets løfte. Ét læk ødelægger en familie. |
| T2 | En arving ændrer andres ønsker eller skriver under for andre | Fordelingen bliver ugyldig og kan ikke stoles på |
| T3 | En udefrakommende får adgang gennem et invitationslink | Links sendes på SMS og kan videresendes |
| T4 | Tovholderen "retter" fordelingen eller loddet | Fordelingen skal være uafhængig af, hvem der har adgang til hvad |
| T5 | Serverens nøgle lækker | Fuld adgang til alt |
| T6 | Data ligger for længe eller hos for mange | GDPR, og familiernes forventning |
| T7 | AI'en ser mere, end den skal | Billeder af et hjem er personoplysninger |
| T8 | Misbrug af dyre eller følsomme kald (SMS, AI, kode-forsøg) | Omkostninger og brute force |

## Hvad der er gjort

### T1 · Ønsker
- `wishes` har præcis fire policies, alle med `heir_id = my_heir_id(estate_id)`. Ingen policy for tovholderen. Ingen `select` for medlemmer af boet.
- `distribution_inputs` (hele inputtet) har ingen policy. Kun service role og `security definer`-RPC'er, der ikke returnerer det, kan læse.
- `distribution_explanations` har policy pr. arving (`heir_id in (select heir_id from estate_members where user_id = auth.uid())`) og kun når kørslen er frigivet.
- Auditloggen logger for `wishes` kun `heir_id`, aldrig `points`/`bid`/`item_id`.
- `run-distribution` returnerer resultatet (hvem fik hvad) og hver arvings egen forklaring; den samlede liste over ønsker forlader aldrig funktionen.
- Resultatet (`distribution_runs.result`) indeholder point pr. tildelt ting (det, prototypen viser som "fik af sine ønsker"). **Åbent punkt:** om `points` pr. ting i resultatet skal fjernes fra det, alle kan se, så kun procenten vises. Prototypen viser det i forklaringen; i den rigtige version anbefales: resultatet viser kun ting og procent, forklaringen viser egne point. *Besluttes før appen bygger resultatvisningen.*
- `rls.sql` tester: tovholder kan ikke læse ønsker (3 regler), anden arving kan ikke (2), kan ikke efter fordeling (1), kan ikke læse inputs (2).
- `consent_records`: egne samtykker, tovholderens alle, og `ny_runde` for alle i boet (så man kan se, hvem der har sagt ja). Migration `001000`.

### T2 · Ændringer for andre
- `set_wishes`, `lock_wishes`, `unlock_my_wishes` finder arvingen via `auth.uid()`, aldrig via parameter.
- `proxy_set_wishes` kræver tovholder, et `proxy_oensker`-samtykke for arvingen, og boet åbent; arvingen markeres `proxy_by`, så det står i PDF'en, at tovholderen afgav for hende.
- `sign_run` kræver et `underskrift_otp`-samtykke < 10 min for netop den arving og kørsel; koden sendes til arvingens egen telefon/mail.
- `heirs`-kolonnerne `user_id`, `submitted_at`, `no_wish`, `proxy_by` kan kun sættes af serveren (trigger).
- Kolonnerettigheder: `authenticated` kan kun skrive de kolonner, listen i `20261111000200_rls.sql` nævner.

### T3 · Invitationslinks
- Token: 32 bytes tilfældigt, base64url, kun sha256-hash i databasen. 14 dages udløb. Kan tilbagekaldes.
- Linket giver ikke adgang. `accept-invite` sender en engangskode til **den telefon/mail, invitationen blev sendt til**, aldrig til en adresse fra kaldet. Videresendes linket, lander koden stadig hos den rette.
- `link-invite` kobler kun, hvis JWT'ens `phone`/`email` er lig `sent_to`.
- Rate limit: 10 forsøg pr. token pr. time, 30 pr. IP pr. time. `attempts` tælles op.
- Svaret maskerer adressen (`+45 •• •• 12 34`, `k•••@gmail.com`).

### T4 · Fordeling og lod
- `estates.lod` sættes af `draw_lod()` (`gen_random_bytes`) ved insert og kan ikke ændres (trigger kaster fejl, også for serveren).
- `start_distribution` låser boet; derefter kan ingen ændre ønsker, ting eller arvinger (RLS + `items_guard`).
- Motoren er deterministisk ud fra (ønsker, lod). `input_hash` og `document_hash` gemmes. Kørslen kan gentages og sammenlignes.
- `engine_version` på kørslen, så en senere motor ikke ændrer en gammel fordeling.
- Ny runde (model B) kræver alles samtykke i `consent_records` (`ny_runde`).

### T5 · Nøgler
- Service role bruges kun i Edge Functions via `Deno.env`. Ikke i repoet, ikke i browseren, ikke i `app/`.
- Browseren får kun publishable key + JWT.
- `housekeeping` kræver `x-housekeeping-key`; `stripe-webhook` kræver gyldig Stripe-signatur; begge har `verify_jwt = false`, fordi de kaldes af maskiner.
- Alle RPC'er er trukket tilbage fra `public` og `anon`, givet til `authenticated` enkeltvis.
- Supabase' sikkerhedslinter: 0 fejl ud over "RLS enabled no policy" på serverens egne tabeller (`distribution_inputs`, `rate_limits`, `purge_queue`, `otp_codes`), hvilket er hensigten.

### T6 · Opbevaring
- Standard 90 dage efter afslutning, tovholderen kan vælge 30–730. "Slet nu" for tovholderen.
- Sletning er `cascade` i databasen; filer slettes fra storage via `purge_queue`.
- Auditlog anonymiseres ved sletning (aktør og navne fjernes) og slettes efter 12 måneder (`20261111000900`).
- Engangskoder slettes efter udløb. Rate limit-tællere efter en dag.
- Ingen CPR, ingen MitID, ingen adresser på arvingerne. Telefon og mail er det eneste, der identificerer.

### T7 · AI
- Billedet sendes fra browseren direkte til `ai-name` og videre til Anthropic; det gemmes ikke hos Arvora, før tovholderen har godkendt tingen. Anthropic gemmer ikke input til træning under API-vilkår (skal bekræftes i databehandleraftalen).
- Prompten forbyder værdi, ægthed, alder og mærke. Svar med "antik", "ægte", "original" renses. Forslaget er altid redigerbart og markeres `ai_suggested`.
- AI ser aldrig ønsker, arvinger eller fordeling.

### T8 · Misbrug
- `rate_limit(key, max, window)` i databasen, brugt af `invite` (pr. bo), `accept-invite` (pr. token og IP), `sign` (pr. arving), `ai-name` (pr. bruger og time).
- OTP: 6 cifre, 10 min, 5 forsøg, hash i databasen.
- Alle tekstkolonner har længdebegrænsning. Billeder max 8 MB, kun jpeg/png/webp.

## Det, der ikke er gjort endnu

| | Status |
|---|---|
| RLS-testen kørt | **Nej.** 49 regler skrevet. Skal give 0 FAIL. |
| Penetrationstest af Edge Functions (forkerte JWT'er, andres bo-id, replay) | Nej. Laves som Node-test mod Arvora dev, når appen findes. |
| CSP og sikkerhedsheaders på Netlify | Nej. `_headers` skrives sammen med appen. |
| Overvågning af fejl og mærkelig trafik | Nej. Sentry eller Supabase-logs, når projektet findes. |
| Backup | Supabase pro: daglig backup, 7 dage. Point-in-time kræver tilkøb. Afprøv gendannelse én gang før lancering. |
| Databehandleraftaler | Ejeren. Supabase, Stripe, Resend, GatewayAPI, Anthropic har alle standard-DPA. |
| Logning af IP ved underskrift | Gemmes i `signatures.ip`. Juristen skal bekræfte, at det er nødvendigt og proportionalt (det er dokumentation for underskriften). |

## Principper for fremtidige ændringer

1. Ny tabel: RLS til, policies, kolonneliste, regel i `rls.sql`, linter.
2. Ny kolonne, der kun serveren må sætte: tilføj til `protect_*`-triggeren.
3. Nyt, der kan læse ønsker: nej. Det er svaret.
4. Ny serverfunktion: rate limit, JWT-tjek først, aldrig returnere mere end kalderen må se.
