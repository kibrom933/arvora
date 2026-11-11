# Samlet projektstatus og plan

*11. november 2026. Skrevet efter den første gennemgang af hele projektet mod masterbriefen. Opdateres, når noget ændrer status.*

## Kort

Arvora har en færdig, testet prototype (344 testtrin), en forside, en fordelingsmotor, der er bevist korrekt, og nu en komplet backend på Supabase (datamodel, adgangsregler, serverfunktioner) i et udviklingsprojekt i Frankfurt. Det, der mangler, før rigtige familier kan bruge det, er selve appen mod backenden, kørsel af adgangstesten, nøgler og konti fra ejeren, og en jurists gennemgang af vilkårene.

## Hvad fungerer

| Del | Status | Bevis |
|---|---|---|
| Prototype (`prototype/index.html`) | Færdig. Hele forløbet: ting, billeder, AI-navne (stedfortræder), arvinger, koder, point/kroner, fordeling, forklaring, underskrift, PDF, restliste. Lyst/mørkt, telefon/computer. | 344 testtrin, 0 fejl (`docs/testrapport.md`) |
| Fordelingsmotor (`engine/arvora-engine.js`) | Færdig som modul. Identisk med prototypen. | Paritet 1.500/1.500 familier; 26 egenskabstest; 600 + 300 familier mod udtømmende søgning; lodtrækning jævn (χ²) |
| Forside (`site/index.html`) | Færdig i hæftelayout, udgivet som privat artifact. | Skærmbilleder i tre bredder, lyst/mørkt |
| Datamodel (Supabase) | 23 tabeller, enums, triggere, auditlog. Anvendt på Arvora dev. | 8 migrationer anvendt; sikkerhedslinter ren |
| Adgangsregler (RLS) | Policies på alle tabeller, kolonnerettigheder, ingen anon-adgang. | `supabase/tests/rls.sql` (47 regler) skrevet, **ikke kørt endnu** |
| RPC'er | 20 funktioner for alt, klienter må ændre. Status, lod, fordeling og underskrift sættes kun af serveren. | Kodegennemgang; test i `rls.sql` |
| Serverfunktioner | 10 Deno-funktioner deployet: invite, accept-invite, link-invite, run-distribution, sign, ai-name, housekeeping, stripe-checkout, stripe-webhook, pdf. | Deployet (version 1). **Ikke kørt ende til ende**; sandkassen kan ikke nå Supabase |
| Automatik | Sletning kl. 03:15 dagligt; housekeeping (beskeder, påmindelser, oprydning) hvert 15. minut. | pg_cron-jobs oprettet; housekeeping kræver Vault-hemmeligheder |

## Hvad er ufuldstændigt

- **Den rigtige app (`app/`)** findes ikke endnu. Prototypen kører alene i browseren. Appen skal bruge samme visninger mod Supabase: login med engangskode, bo-oversigt, ting med upload, arvinger og invitationer, ønsker gennem `set_wishes`/`lock_wishes`, fordeling gennem `run-distribution`, underskrift gennem `sign`, PDF gennem `pdf`.
- **Serverfunktionerne er deployet, men ikke prøvet** mod rigtige kald. Fejl i fx `pdf`-funktionen (skriftindlæsning fra app-URL) eller Stripe-webhook (signaturkontrol) opdages først ved første kald.
- **RLS-testen er skrevet, men ikke kørt.** Indtil den har givet 0 FAIL, er adgangsreglerne ikke bevist.
- **Beskeder**: teksterne til SMS og mail ligger i `housekeeping`, men ingen udbyder er sat op (GatewayAPI, Resend). Kræver konti og nøgler.
- **Betaling**: Stripe Checkout og webhook er skrevet, men der er ingen Stripe-konto i Arvoras navn, og prisen 795 kr. er et skøn.
- **Partnerportal**: tabellerne findes (`partners`, `partner_members`, `partner_referrals`), men ingen visning. Partnerkoden kan gives ved oprettelse af bo.
- **Forsiden** har ingen rigtig "Opret bo"-knap, fordi der ingen app er. Den peger på prototypen som demo.
- **Analyse og cookiesamtykke**: ikke bygget. Anbefaling: ingen cookies ud over de nødvendige, ingen tredjepartsanalyse i V1.

## Hvad er teknisk usikkert

1. **Supabase Auth til arvinger uden konto.** Modellen er: invitationslink → `accept-invite` sender engangskode til arvingens telefon/mail → Supabase opretter en bruger ved første login → `link-invite` kobler brugeren til arvingen, hvis telefon/mail stemmer. Det kræver, at Supabase Auth er sat op med SMS-udbyder (Twilio/MessageBird/Vonage er de indbyggede; GatewayAPI er ikke) **eller** at vi sender koden selv og bruger `verifyOtp` med egen kode. Skal afprøves i første version af appen. Fald tilbage: mail-engangslink for alle, SMS kun til invitationen.
2. **pg_net fra Vault**: `call_housekeeping()` læser URL og nøgle fra Vault. Vault-hemmelighederne er ikke sat endnu; indtil da kører cron-jobbet, men kalder intet (fejler stille).
3. **PDF-skrifter**: funktionen henter Hanken Grotesk fra `${ARVORA_APP_URL}/fonts/`. Indtil appen er hostet, falder den tilbage til Helvetica (uden æøå-problemer, men uden udvidet latin).
4. **AI-navne**: `ai-name` kalder Anthropic Messages API med billedet. Billedet sendes fra browseren til funktionen (ikke fra storage), så det aldrig gemmes før tovholderen har sagt ja til navnet. Modelnavn og pris skal bekræftes, når nøglen findes.
5. **Supabase-projekt i en Zoonex-organisation.** Arvora dev ligger i ejerens eksisterende organisation. Produktion skal have egen organisation eller eget projekt med egen fakturering, så persondata fra Arvora og Zoonex aldrig ligger samme sted.

## Hvad mangler til produktion

| Kræver | Hvem |
|---|---|
| Appen (`app/`) bygget og testet mod Arvora dev | Claude |
| RLS-test kørt med 0 FAIL | Claude (ejeren godkender kørslen) |
| Ende-til-ende-test med testfamilie på Arvora dev (opdigtede data) | Claude + ejer |
| Produktionsprojekt i Supabase, EU | Ejer opretter; Claude migrerer |
| Domæne arvora.dk, DNS, hosting (Netlify) | Ejer |
| Stripe-konto, nøgler, webhook-URL | Ejer |
| SMS-udbyder (GatewayAPI) og mail (Resend) med afsender "Arvora" | Ejer |
| Anthropic API-nøgle til AI-navne | Ejer |
| Handelsbetingelser og privatlivspolitik gennemgået af dansk jurist | Ejer + jurist |
| Databehandleraftaler: Supabase, Stripe, Resend, GatewayAPI, Anthropic | Ejer (standardaftaler findes hos alle fem) |
| Overvågning (Sentry eller Supabase-logs) og backup-tjek | Claude sætter op, når projektet findes |

## Risici

| Risiko | Sandsynlighed | Konsekvens | Modtræk |
|---|---|---|---|
| Ønsker lækker (den alvorligste) | Lav | Familiekonflikt, tab af tillid, GDPR-sag | RLS uden policy for andre end arvingen selv; input kun på serveren; RLS-test; linter; auditlog |
| Arving får andens link | Mellem | Falsk ønske eller underskrift | Token bindes til telefon/mail ved login; OTP ved underskrift; audit |
| Familien er ikke enige efter fordelingen | Høj (det er livet) | Produktet "virker ikke" | Model B: ny runde kræver alles ja; tydelig tekst om bobestyrer |
| Ingen betaler 795 kr. | Mellem | Ingen forretning | Test med 3–5 familier før markedsføring |
| Parallel Claude-session ændrer skema | Sket én gang | Modstridende migrationer | Regel i CLAUDE.md: én session ad gangen på backend |
| Supabase-projekt pauses (gratis plan) | Lav (pro plan) | Nedetid | Pro plan; overvågning |
| AI opfinder værdi eller ægthed | Lav | Vildledning | Prompten forbyder det; "antik/ægte/original" fjernes; forslag kan altid rettes |

## Hvad kan Claude gøre automatisk

- Bygge appen, teste mod Arvora dev med opdigtede data.
- Køre RLS-test og sikkerhedslinter efter hver skemaændring.
- Skrive alle dokumenter, inkl. udkast til juridiske tekster (markeret ikke-godkendt).
- Sætte Sentry/overvågning op, når projekterne findes.
- Deploye til Netlify, når ejeren har givet adgang.

## Hvad kræver ejerens godkendelse

Fra briefen, uændret: købe domænet · registrere CVR · oprette eller acceptere bindende aftaler · oprette betalingskonti · bruge betalingskort · sende eksterne mails til kunder eller partnere · offentliggøre produktet · sende rigtige invitationer · behandle rigtige familiers oplysninger i test · ændre de centrale fordelingsprincipper · ændre produktionsdata · juridiske erklæringer. Listen med konkrete punkter: `docs/owner-action-list.md`.

## Plan, prioriteret

1. **Appen** mod Arvora dev (login, bo, ting, arvinger, ønsker, fordeling, underskrift, PDF). Samme design som prototypen. Mål: en opdigtet familie kan gennemføre hele forløbet.
2. **RLS-test** kørt, fejl rettet.
3. **Ende-til-ende-test** af serverfunktionerne fra appen; rettelser.
4. **Beskeder** sat op (kræver nøgler): invitation, påmindelse, fordeling klar, alle har underskrevet.
5. **Betaling** i testtilstand (kræver Stripe-konto).
6. **Staging** på Netlify med Arvora dev som backend; test med 3–5 familier på opdigtede eller egne data efter aftale.
7. **Produktion**: nyt Supabase-projekt, migrationer, hemmeligheder, domæne, overvågning, backup-tjek.
8. **Jurist**, derefter offentliggørelse.
