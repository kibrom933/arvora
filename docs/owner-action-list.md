# Det, kun ejeren kan gøre

*11. november 2026. Rækkefølgen er den, der låser mest op. Alt andet laver Claude.*

## Nu

| # | Handling | Hvorfor | Hvordan |
|---|---|---|---|
| 1 | **Dobbeltklik `C:\Users\mohaa\arvora\kobl-til-github.cmd`** | Din mappe på PC'en bliver koblet til github.com/kibrom933/arvora, så `git pull` virker | Scriptet ligger i mappen. Det sletter intet. |
| 2 | **Stop den anden Claude-session**, der arbejder på repoet (Fable 5.2), eller giv den besked om kun at røre `prototype/` og `site/` | Den har én gang pushet et konkurrerende skema | Luk den, eller skriv til den |
| 3 | **Sig "ja" til Supabase**, når MCP spørger om lov til at køre `rls.sql` og migrationerne `000900` og `001000` | Adgangsreglerne er ikke bevist, før testen er kørt | Spørgsmålet vises i chatten |
| 4 | **Tjek arvora.dk og varemærket** | Navnet er valgt, men ikke sikret | dk-hostmaster.dk → søg; dkpto.dk → varemærkesøgning; tmdn.org/tmview |
| 5 | **Køb arvora.dk**, hvis frit | | Hos en dansk registrator (fx Simply, One.com, GratisDNS). Ca. 60–100 kr./år. Peg ikke DNS endnu. |

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
