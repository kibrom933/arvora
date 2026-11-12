# Det, kun ejeren kan gøre

*11. november 2026. Rækkefølgen er den, der låser mest op. Alt andet laver Claude.*

## Status 12. november

Arvora er live som lukket test: forsiden på https://kibrom933.github.io/arvora/, appen på …/arvora/app/. Login med mail, oprettelse af bo, ting, arvinger, invitationer på mail og den automatiske udsendelse virker mod den rigtige database (prøvet live). Adgangsreglerne er prøvet mod databasen: 54 af 55 bestod i første kørsel, og den ene fejl (tovholderen fik ikke besked) er rettet. Betaling kan ikke bruges endnu, så brug prøvekoden **PROEVE26** (gratis til 31. marts 2027) som partnerkode, når du opretter et bo til en testfamilie.

## Nu (det, der låser mest op)

| # | Handling | Hvorfor |
|---|---|---|
| 1 | **Stripe-konto i Arvoras navn** (kræver CVR), og send mig en *restricted* nøgle med adgang til Checkout | Uden den kan ingen betale; i dag virker kun prøvekoden |
| 2 | **Køb arvora.dk** | Mails kommer i dag fra arvora@zoonex.dk (din Resend-konto), og adressen er kibrom933.github.io. Med domænet flytter jeg begge |
| 3 | **Anthropic API-nøgle** (console.anthropic.com) | Navneforslag ud fra billeder; uden den skriver tovholderen navnet selv |
| 4 | **GatewayAPI-konto** | SMS til arvinger uden mail og login med mobilnummer |
| 5 | **Jurist** på vilkår og privatlivspolitik | Før rigtige familier i sorg bruger det |
| 6 | Dobbeltklik `C:\Users\mohaa\arvora\kobl-til-github.cmd` | Din mappe på PC'en følger med |

Nøgler kan du sende i chatten; jeg lægger dem i `app_settings` på serveren, aldrig i koden.

## Konti (til udvikling; testnøgler er fint)

| # | Handling | Note |
|---|---|---|
| 6 | **Anthropic API-nøgle** | console.anthropic.com → ny nøgle "arvora-dev". Sæt den som Edge secret `ANTHROPIC_API_KEY` på Arvora dev (Dashboard → Edge Functions → Secrets), eller send den til Claude i chatten. Pris: nogle øre pr. billede. |
| 7 | **GatewayAPI-konto** (gatewayapi.com) | Dansk SMS. Testkredit følger med. Token som `GATEWAYAPI_TOKEN`. Afsender "Arvora" skal godkendes. |
| 8 | **Resend-konto** (resend.com) | Gratis. Domænet arvora.dk skal verificeres, før mails kan sendes fra `@arvora.dk`; indtil da bruges `onboarding@resend.dev` til test. Nøgle som `RESEND_API_KEY`. |
| 9 | **`HOUSEKEEPING_SECRET`** | Claude laver værdien; du sætter den som Edge secret og i Vault (Dashboard → Project Settings → Vault): `housekeeping_url`, `housekeeping_key`. Eller giv Claude lov til at sætte dem. |
| 10 | **Stripe i testtilstand** | Kan være din eksisterende konto i test. `STRIPE_SECRET_KEY` (test), webhook-secret efter Claude har givet URL'en. |
| 10b | **Mail-skabelon i Supabase Auth** (Arvora dev → Authentication → Email Templates → Magic Link): sæt teksten til "Din kode til Arvora er {{ .Token }}. Den gælder i 10 minutter." | Ellers sender Supabase et link, og appen venter på en kode. Claude kan ikke ændre skabeloner gennem MCP. |

## Virksomhed (før produktion)

| # | Handling | Note |
|---|---|---|
| 11 | **CVR** (enkeltmandsvirksomhed) | virk.dk. Gratis. Kræves til Stripe live og fakturaer til partnere. |
| 12 | **Ny Supabase-organisation "Arvora"** + projekt "Arvora prod", eu-central-1, pro plan | Så Arvora og Zoonex aldrig deler database eller faktura. 25 USD/md. |
| 13 | **Stripe-konto i Arvoras navn** (live) | Kræver CVR og bankkonto. |
| 14 | **Netlify**: giv Claude adgang (team-invitation) eller opret to sites selv | `arvora` og `arvora-app` |
| 15 | **Jurist** | Send `legal-review-checklist.md`, `terms-and-conditions-draft.md`, `privacy-policy-draft.md`, `privacy-and-gdpr.md`. Budget 8–15.000 kr. |
| 16 | **Databehandleraftaler**: accepter Supabase, Stripe, Resend, GatewayAPI, Anthropic | Alle online, gratis. Gem PDF'erne i en mappe. |
| 17 | **Bankkonto** til virksomheden | Til Stripe-udbetalinger og partnerfakturaer. |

## Mennesker

| # | Handling | Note |
|---|---|---|
| 18 | **Find 3–5 testfamilier** | Netværk. Ikke familier i akut sorg. Opdigtet bo eller eget indbo. |
| 19 | **Ring til 2 bedemænd** | Spørgsmål i `partner-business-model.md`. 15 minutter hver. |
| 20 | **Beslut prisen** efter testene | 795 kr. er et skøn. |

## Sidst

| # | Handling |
|---|---|
| 21 | Godkend offentliggørelse af forsiden |
| 22 | Godkend første rigtige invitation (du selv som tovholder, familie som arvinger) |
| 23 | Godkend første partnermail |

## Det, du har sagt, Claude ikke må

Købe domænet · CVR · aftaler · betalingskonti · bruge kort · sende eksterne mails · offentliggøre · sende rigtige invitationer · rigtige familiers data i test · ændre fordelingsprincipperne · ændre produktionsdata · juridiske erklæringer. Det holder.
