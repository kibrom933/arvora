# Datamodel

*11. november 2026. Skemaet ligger i `supabase/migrations/`. Dette er læsevejledningen; SQL'en er sandheden.*

## Typer

| Enum | Værdier |
|---|---|
| `estate_status` | `kladde` → `aaben` → `laast` → `fordelt` → `underskrevet` → `afsluttet` (→ `slettet`) |
| `estate_mode` | `doed` (dødsbo), `live` (mens de lever) |
| `wish_method` | `point`, `kroner` |
| `member_role` | `tovholder`, `arving` |
| `invite_channel` | `sms`, `email`, `papir` |
| `notify_status` | `koe`, `sendt`, `fejl`, `fravalgt` |

## Tabeller

### Boet

**`estates`** – ét bo. `lod` (bigint 1–2³²−1) trækkes af `draw_lod()` ved oprettelsen og kan ikke ændres (trigger `protect_estate_columns`). `status` sættes kun af RPC'er. `paid_at` sættes af Stripe-webhooken. `retention_days` (30–730, standard 90) og `retention_until` styrer sletning. Klienter må opdatere: `name, years, mode, method, deadline, retention_days`.

**`estate_members`** – hvem (auth-bruger) er med i hvilket bo, med rolle og evt. `heir_id`. Skrives kun af serveren. Alle adgangshelpers bygger på denne tabel.

**`heirs`** – arvingerne. `share` (0–10, standard 1) er arvelodden. `phone` (E.164) og `email` er citext. `user_id`, `submitted_at`, `no_wish`, `proxy_by`, `proxy_consent_id` sættes kun af serveren (trigger `protect_heir_columns`). Klienter må skrive: `name, relation, phone, email, share, sort`.

**`invitations`** – `token_hash` (sha256 af et 256-bit token; selve tokenet findes kun i linket), `channel`, `sent_to`, `expires_at` (14 dage), `used_at`, `revoked_at`, `attempts`. Tovholderen kan se og tilbagekalde, aldrig læse tokenet.

### Tingene

**`items`** – `no` er mærkesedlens nummer, tildelt af trigger `items_assign_no` (højeste + 1, genbruges aldrig), unikt pr. bo. `kind` (`thing`/`group`), `group_name`, `valuable` ("bør vurderes"), `will_heir_id` + `will_note` + `will_unclear` (testamente), `ai_suggested`, `rest_decision` (`ny_runde, faelles, udenfor, salg, genbrug, rydning`), `deleted_at` (blød sletning). Trigger `items_guard` afviser ændringer uden for `kladde`/`aaben` og låser op for arvinger, der har givet point til en ting, der fjernes eller testamenteres.

**`item_images`** – `path` i bucket `ting` (`<estate_id>/<item_id>/<fil>`), `bytes`.

### Ønsker

**`wishes`** – én række pr. (arving, ting). `points` 0–100, `bid` 0–1 mia. øre. **Kan kun læses af arvingen selv.** Ingen policy for tovholder eller andre, hverken før eller efter fordelingen. Auditloggen gemmer aldrig værdier.

### Fordeling

**`distribution_runs`** – én pr. kørsel, `version` tæller op pr. bo. `method`, `lod` (kopi), `input_hash`, `result` (jsonb fra motoren), `ef1_ok`, `engine_version`, `released_at` (synlig for familien først da), `superseded_at` (ny runde). Læses kun når frigivet.

**`distribution_inputs`** – hele inputtet (alle ønsker) til efterprøvning. **Ingen policy; kun serveren.**

**`distribution_explanations`** – forklaringen pr. arving ("hvad gav du point, hvem fik det"). Læses kun af den arving, rækken tilhører.

**`tie_break_records`** – hvad loddet afgjorde: `kind` (`item`/`swap`/`box`), `item_ids`, `heir_ids`, `winner_heir_id`, `note`. Læses af alle i boet, når kørslen er frigivet.

### Underskrift og samtykke

**`signatures`** – én pr. (kørsel, arving). `signed_name`, `method` (`otp_sms`/`otp_email`/`papir`), `document_hash` (hash af fordelingslisten, som den så ud), `ip`, `user_agent`. Indsættes kun af `sign_run`.

**`consent_records`** – `kind`: `vilkaar`, `privatliv`, `proxy_oensker` (arvingen lader tovholderen afgive), `proxy_bekraeftet`, `ny_runde`, `underskrift_otp` (koden er bekræftet). `run_id`, `channel`, `note`, `given_at`.

**`otp_codes`** – hash af 6-cifret kode, formål, udløb (10 min), forsøg (max 5). Kun serveren.

### Drift

**`audit_events`** – `estate_id`, `actor`, `action` (`insert`/`update`/`delete`), `table_name`, `row_id`, `meta` (ændrede kolonnenavne, aldrig ønskeværdier). Tovholderen kan læse sit bos log.

**`notifications`** – beskedkø: `channel`, `kind` (`invitation`, `paamindelse`, `alle_har_svaret`, `fordeling_klar`, `alle_har_underskrevet`, `underskrift_kode` …), `to_address`, `payload`, `status`, `scheduled_for`, `sent_at`, `error`.

**`payments`** – `checkout_session_id`, `payment_intent_id`, `amount_ore`, `status` (`oprettet, betalt, fejlet, refunderet, partner`), `receipt_url`, `raw`.

**`partners`**, **`partner_members`**, **`partner_referrals`** – partner (bedemand/advokat/bobestyrer), kode `^[A-Z0-9]{4,12}$`, `price_ore` (49500), `free_until`; hvem arbejder der; hvilket bo kom fra hvilken kode, `billable`, `invoiced_at`.

**`rate_limits`** – tæller pr. nøgle og vindue. **`purge_queue`** – filstier, der skal slettes fra storage, når et bo slettes.

## Triggere

| Trigger | Tabel | Gør |
|---|---|---|
| `set_updated_at` | estates, heirs, items, wishes | `updated_at = now()` |
| `protect_estate_columns` | estates | `lod` og `created_by` kan aldrig ændres; `status`, `paid_at`, `retention_until`, `closed_at` kun af serveren |
| `protect_heir_columns` | heirs | serverkolonner kun af serveren |
| `items_guard` | items | kun i kladde/aaben; låser arvinger op ved fjernelse/testamente |
| `items_assign_no` | items | fast nummer |
| `audit_row` | de fleste | log uden ønskeværdier |
| `queue_estate_files` | estates (delete) | filstier til `purge_queue` |

## RPC'er (kaldes af klienter med `supabase.rpc`)

`create_estate`, `open_estate`, `set_wishes`, `lock_wishes`, `unlock_my_wishes`, `record_consent`, `proxy_set_wishes`, `start_distribution`, `sign_run`, `request_reopen`, `consent_reopen`, `check_reopen`, `close_estate`, `delete_estate_now`. Kun serveren: `abort_distribution`, `purge_expired_estates`, `enqueue_notification`, `rate_limit`.

Alle er `security definer` med fast `search_path`, tjekker selv rolle og status, og er kun givet til `authenticated` (ikke `anon`, ikke `public`).

## Visning

`estate_overview` – boet med antal ting, antal arvinger, antal der har svaret, og om alle har underskrevet. Til oversigten i appen, så den ikke skal hente alt.

## Storage

Bucket `ting`: privat, max 8 MB pr. fil, `image/jpeg`, `image/png`, `image/webp`. Policies: læs for medlemmer af boet (første mappeled = `estate_id`), skriv og slet for tovholderen, mens boet er kladde/aaben. Billeder skaleres i browseren før upload (ca. 1.600 px, JPEG).

## Sletning

Et bo slettes, når `retention_until` er passeret (cron `arvora-purge` kl. 03:15), eller når tovholderen kalder `delete_estate_now`. `on delete cascade` tager alt med; filstierne lægges i `purge_queue`, og `housekeeping` sletter dem fra storage. Auditrækker for boet beholdes uden indhold i 12 måneder (`estate_id` sat til null ved sletning) til at kunne svare på "blev mit bo slettet, og hvornår". *Det sidste er et valg, juristen skal bekræfte.*
