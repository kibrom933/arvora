# Opsætning af produktion

*11. november 2026. Trin for trin. Det meste kan Claude gøre, når ejeren har oprettet konti og givet nøgler. Produktion må ikke bruges til eksperimenter; alt prøves på Arvora dev først.*

## Miljøer

| | Arvora dev | Arvora prod |
|---|---|---|
| Supabase | `jqulxozrejhrinqxyffr`, eu-central-1, org "Zoonex – ID til kæledyr" | Nyt projekt i **egen organisation "Arvora"**, eu-central-1. Ejeren opretter. |
| App | `arvora-dev.netlify.app` | `app.arvora.dk` |
| Forside | artifact (privat) | `arvora.dk` |
| Stripe | testtilstand | live |
| SMS/mail | testkonti, kun til ejerens egne numre | live, afsender "Arvora" |

## 1. Supabase-projekt

1. Ejeren opretter organisationen "Arvora" og projektet "Arvora prod" i eu-central-1 (Frankfurt), pro plan (daglig backup, ingen pause).
2. Claude anvender migrationerne i rækkefølge: `supabase/migrations/2026…*.sql` (MCP `apply_migration` eller `supabase db push`).
3. Kør `supabase/tests/rls.sql` som postgres. 0 FAIL.
4. Kør sikkerhedslinter. Kun "RLS enabled no policy" på `distribution_inputs`, `rate_limits`, `purge_queue`, `otp_codes` må stå tilbage.
5. Auth: slå e-mail-OTP til (ikke magic link; vi bruger kode), SMS-udbyder (se pkt. 4), site URL `https://app.arvora.dk`, redirect `https://app.arvora.dk/*`. Slå signup fra for alt andet end OTP. Rate limits i Auth: 10 OTP pr. time pr. adresse.
6. Storage: bucket `ting` oprettes af migrationen. Tjek, at den er privat.
7. Vault: `housekeeping_url` = `https://<ref>.supabase.co/functions/v1/housekeeping`, `housekeeping_key` = samme værdi som `HOUSEKEEPING_SECRET`.
8. pg_cron: tjek at `arvora-purge` (03:15) og `arvora-housekeeping` (*/15) findes: `select jobname, schedule from cron.job`.

## 2. Edge Functions

Deploy alle ti med `_shared/` ved siden af (MCP `deploy_edge_function` eller `supabase functions deploy --project-ref <ref>`):

| Funktion | verify_jwt |
|---|---|
| invite, link-invite, run-distribution, sign, ai-name, stripe-checkout, pdf | true |
| accept-invite, housekeeping, stripe-webhook | **false** (egen kontrol) |

Hemmeligheder (`supabase secrets set` eller dashboard → Edge Functions → Secrets):

| Navn | Fra |
|---|---|
| `ARVORA_APP_URL` | `https://app.arvora.dk` |
| `ARVORA_ALLOWED_ORIGIN` | `https://app.arvora.dk` |
| `ARVORA_FROM_EMAIL` | `Arvora <hej@arvora.dk>` |
| `ARVORA_PRICE_ORE` | `79500` |
| `ANTHROPIC_API_KEY` | console.anthropic.com, egen nøgle til Arvora prod |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` (eller nyere Haiku) |
| `STRIPE_SECRET_KEY` | Stripe live, restricted key: kun Checkout Sessions write, Refunds read |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → endpoint `https://<ref>.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed`, `charge.refunded` |
| `STRIPE_AUTOMATIC_TAX` | `false` (dansk moms, én sats; sæt `true`, hvis Stripe Tax slås til) |
| `GATEWAYAPI_TOKEN` | gatewayapi.com, afsender "Arvora" (alfanumerisk, max 11 tegn) |
| `RESEND_API_KEY` | resend.com, domæne arvora.dk verificeret |
| `HOUSEKEEPING_SECRET` | 32 tilfældige bytes, base64. Samme i Vault. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` sættes af Supabase selv.

## 3. Netlify

1. Site `arvora` → `arvora.dk` (forsiden, mappen `site/`). Site `arvora-app` → `app.arvora.dk` (mappen `app/dist`, build `npm run build` i `app/`).
2. Miljøvariabler i app-build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (aldrig service role).
3. `_headers`: `Content-Security-Policy` (self + `https://<ref>.supabase.co` + fonts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self)`.
4. `_redirects`: `/* /index.html 200` for appen (SPA).
5. DNS: `arvora.dk` A/ALIAS → Netlify, `app` CNAME → Netlify, Resend's MX/TXT for mail.

## 4. SMS

Supabase Auth's indbyggede SMS-udbydere er Twilio, MessageBird, Vonage, Textlocal. GatewayAPI er ikke blandt dem. To veje:

- **A (anbefalet):** Auth-OTP via mail for alle, der har mail; SMS kun til invitation, påmindelse og underskriftskode (dem sender vi selv via GatewayAPI). Arvinger uden mail: Auth-OTP via SMS med MessageBird (dansk afsender-id understøttes) som Auth-udbyder.
- **B:** Egen OTP til login (vi sender koden, verificerer selv, og udsteder session via `auth.admin.generateLink`). Mere kode, mindre afhængighed.

Besluttes, når appen bygges. Indtil da bruger `accept-invite` Supabase' `signInWithOtp`.

## 5. Stripe

Ejeren opretter konto i Arvoras navn (CVR kræves). Produkt "Arvora · ét bo", 795 kr. inkl. moms. Checkout bruger beløbet fra `ARVORA_PRICE_ORE`, ikke et Price-id, så prisen kan testes uden at ændre Stripe. Kvittering: Stripe sender selv (slå til i Stripe → Emails). Webhook-endpoint oprettes efter deploy.

## 6. Overvågning

- Sentry-projekt "arvora-app" (browser) og "arvora-functions" (Deno). DSN'er i Netlify-env og Edge secrets. Alarm: ny fejl → mail til ejeren.
- Supabase → Reports: API-fejlrate, databaseforbindelser. Alarm ved > 1 % 5xx.
- Uptime: Netlify's eller en gratis tjeneste på `arvora.dk` og `app.arvora.dk/health.txt`. 5 min.
- Ugentlig: `select count(*) from notifications where status = 'fejl'`; `select * from audit_events where action = 'slettet' order by created_at desc limit 20`.

## 7. Backup og gendannelse

Supabase pro: daglig backup, 7 dages opbevaring. Point-in-time recovery er tilkøb (ca. 100 USD/md); ikke nødvendigt ved start. **Øvelse før lancering:** gendan dev-backuppen til et nyt projekt, tjek at et testbo er der, slet projektet. Storage-filer er ikke med i databasebackup; de kan ikke gendannes, hvis de slettes. Det er acceptabelt, fordi boer slettes alligevel efter 90 dage; skriv det i vilkårene ("hent PDF'en").

## 8. Tjekliste på dagen

- [ ] Migrationer, RLS-test, linter
- [ ] Alle secrets sat; `housekeeping` svarer 200 på et manuelt kald
- [ ] Stripe-testkøb i live med rigtigt kort, refunderet
- [ ] SMS til ejerens egen telefon via et testbo; mail til ejerens egen adresse
- [ ] AI-navn på ét billede
- [ ] PDF hentet
- [ ] Slet testboet med "Slet nu"; tjek at storage er tom
- [ ] Sentry modtager en bevidst testfejl
- [ ] Forsiden og appen svarer på https med gyldigt certifikat
- [ ] Vilkår og politik (godkendte versioner) linket ved login

## Rollback

Appen: Netlify → forrige deploy (ét klik). Funktioner: `supabase functions deploy` af forrige commit. Databasen: migrationer er fremadrettede; en fejl rettes med en ny migration, ikke ved at rulle tilbage. Skulle en migration ødelægge data: gendan backup til nyt projekt, kopiér boer over.
