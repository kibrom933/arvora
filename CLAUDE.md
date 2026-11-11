# Arvora – noter til Claude

Læs `docs/produkt.md` først. Det er produktbriefen. `docs/beslutninger.md` er de valg, der er truffet, og hvorfor. `docs/complete-project-audit.md` er status og plan. **Kun én session ad gangen bør ændre backend og skema**; tjek `git log origin/main`, før du begynder, og flet frem for at bygge parallelt.

## Sprog og tone
- Alt i produktet og i docs er på dansk. Kode og kommentarer må være på dansk eller engelsk; hold én stil pr. fil. Database og API er på engelsk (tabelnavne, kolonner), tekster til brugeren på dansk.
- Tonen i produktet: kort, venlig og rolig. Ingen udråbstegn, intet salgssprog, ingen "Tillykke". Familierne er i sorg.
- Brugerens ord: *ting*, *arving*, *tovholder*, *bo*, *ønsker*, *fordeling*, *underskrift*. Ikke "items", "users", "allocation" i det, brugeren ser.
- Arvora giver ikke juridisk rådgivning og må aldrig lyde som om. Boopgørelse, skifteret og bobestyrer ligger uden for produktet. Godkendelsen med engangskode må aldrig kaldes en kvalificeret elektronisk signatur.

## Arkitektur (se `docs/architecture.md`)
- `prototype/index.html`: hele prototypen i én fil, kører alene i browseren med `localStorage`. Bevares som demo og som reference for motoren. Ingen build, ingen framework.
- `engine/arvora-engine.js`: fordelingsmotoren som rent modul (ESM). Samme adfærd som prototypen, bevist i `tests/engine-parity.js`. Bruges af serveren (`supabase/functions/_shared/engine.js` er en kopi; hold dem ens).
- `supabase/migrations/2026…sql`: datamodel, RLS, RPC'er, storage, cron. Anvendt på projektet **Arvora dev** (`jqulxozrejhrinqxyffr`, eu-central-1, Frankfurt) i organisationen "Zoonex – ID til kæledyr". Produktion får sit eget projekt, når ejeren opretter det.
- `supabase/functions/*`: serverfunktioner (Deno). `_shared/common.ts` har klienter, rate limit, hash. Deployet på Arvora dev.
- `supabase/tests/rls.sql`: 49 adgangsregler, køres som postgres mod projektet (SQL editor eller MCP). Skal give 0 FAIL efter hver skemaændring.
- `site/index.html`: forsiden. Samme skrifter og farver som appen: hvidt papir, dyb blomme som blæk, messing til numre og segl, Fraunces til overskrifter, Hanken Grotesk til brødtekst, Caveat til det håndskrevne. Ikke grønt, ikke cremefarvet: det er ejerens anden app (Zoonex).
- `app/`: den rigtige app mod Supabase. Vite + vanilla ESM, ingen framework. `src/main.js` er router og hændelser, `src/bo.js` henter ét bo til en model, `src/views/*.js` er visningerne (login, boer, nyt, invite, oversigt, ting, arvinger, oensker, fordeling, underskrift, tekst). Samme CSS som prototypen (`src/style.css`) plus et lille tillæg. Bygges med `npm run app:build`; nøgler i `app/.env` (se `.env.example`), aldrig service role.
- `tests/`: Playwright mod prototypen og appen, Node-test af motoren. `tests/lib.js` serverer prototypen fra disk på `https://godtdelt.test/` uden net. `tests/app.mjs` bygger appen og kører hele forløbet mod `tests/fake-supabase.mjs`, en efterligning af Supabase i hukommelsen (auth, rest, rpc, storage, functions, de vigtigste adgangsregler; motoren er den rigtige). Ændres en RPC eller serverfunktion, skal efterligningen følge med.

## Sikkerhedsregler (se `docs/security-and-privacy-audit.md`)
- Hemmelige ønsker (`wishes`) må kun kunne læses af arvingen selv. Ingen policy giver tovholderen eller andre adgang, hverken før eller efter fordelingen. Forklaringer ligger i `distribution_explanations` pr. arving; det samlede input i `distribution_inputs` kan kun serveren læse.
- Klienter skriver kun gennem RPC'er og kolonnelister. Status, betaling, lod, `submitted_at`, `user_id` og alt om fordeling og underskrift sættes kun af serveren. `is_server()` skelner i triggere.
- Service role-nøglen findes kun i serverfunktioner. Aldrig i browseren, aldrig i repoet.
- Loddet (`estates.lod`) trækkes af databasen ved oprettelsen og kan ikke ændres (trigger). Alt tilfældigt i motoren udledes af loddet.
- Alt, der ændrer rækker, logges i `audit_events` uden indhold af ønsker. Tovholderen kan læse loggen for sit bo.
- Nye tabeller: slå RLS til, skriv policies, tilføj regler i `rls.sql`, kør Supabase' sikkerhedslinter (`get_advisors security`) og ret alt undtagen "RLS enabled no policy" på serverens egne tabeller.

## Motoren (skal du ikke ændre uden at køre `engine parity`, `engine props`, `solver.js` og `lod.js`)
- Pointmetoden maksimerer vægtet Nash-velfærd: produktet af hver arvings point-sum, vægtet med arvelod, med flest arvinger over nul som første kriterium. Grådig start, derefter flyt og byt af enkeltting og hele kasser, 40 forsøg fra forskellige rækkefølger, bedste vinder. Mod udtømmende søgning i 2.100 tilfældige familier var den bedst mulige fordeling fundet hver gang.
- Uafgjort afgøres af boets lod. `lodtal(lod,h,i)` giver et fast tal pr. arving og ting. Samme ønsker og samme lod giver altid samme fordeling. Alt, der kunne være endt anderledes uden tab, vises åbent som "Afgjort ved lodtrækning".
- Kronemetoden: højeste bud vinder, lige bud afgøres af loddet, forskellen udlignes i arven efter arvelod.
- Ændres motoren, ændres `engine/arvora-engine.js`, kopien i `supabase/functions/_shared/engine.js` og prototypen sammen, og `ENGINE_VERSION` i `run-distribution` tælles op. Matematikken står i `docs/fairness-and-algorithm-validation.md`.

## Udgivelse
- **Artifacts:** Prototypen udgives fra `prototype/index.html` til https://claude.ai/artifact/MaQ3gr7yC6AqMySFqZkBCw med `files` = `{"fonts/hk-400.ttf": "prototype/fonts/hk-400.ttf", "fonts/hk-700.ttf": "prototype/fonts/hk-700.ttf"}`; capabilities `downloads` og `sample` følger med. Forsiden fra `site/index.html` til https://claude.ai/artifact/V8hggiboRKkxsy73qNZu6X. Filerne har Artifact-skelettet på linje 1; lad den være. Kør testene, før du udgiver.
- **Database:** nye migrationer hedder `supabase/migrations/YYYYMMDDHHMMSS_navn.sql` og anvendes med Supabase MCP `apply_migration` (eller `supabase db push`) på Arvora dev. Kør `rls.sql` bagefter.
- **Serverfunktioner:** deployes med MCP `deploy_edge_function` (importer `./_shared/…`, læg `_shared/common.ts` og evt. `engine.js` med) eller `supabase functions deploy`. `verify_jwt` er false kun for `accept-invite`, `housekeeping` og `stripe-webhook`, som har egen kontrol.
- Hemmeligheder sættes som Edge Function secrets i Supabase (se `docs/production-deployment.md`): `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GATEWAYAPI_TOKEN`, `RESEND_API_KEY`, `HOUSEKEEPING_SECRET`, `ARVORA_APP_URL`.

## Test
- `npm test` kører alt (ca. 10 min). Enkelte pakker: `node tests/run-all.js "engine props" refine "app desktop"`. `npm run test:quick` er det hurtige udvalg.
- Appen alene: `node tests/app.mjs` (computer), `node tests/app.mjs mobile dark`. Skærmbilleder i `tests/out/shots/app-*.png`.
- Motoren alene: `node tests/engine-props.js` (Node, uden browser) og `node tests/run-all.js "engine parity"` (mod prototypen).
- Nye funktioner får test i den fil, der passer, eller en ny fil, som tilføjes i `tests/run-all.js`. En test siger PASS/FAIL pr. linje; `run-all.js` tæller dem.
- Skærmbilleder i `tests/out/shots/` er den hurtigste måde at se, om noget ser forkert ud på telefon eller i mørkt tema.

## Arbejdsform
- Små, afgrænsede ændringer. Beskriv i commit-beskeden, hvad brugeren oplever anderledes, ikke hvilken funktion der blev rørt.
- Produktvalg, der ændrer, hvad familien oplever, skrives ind i `docs/beslutninger.md` med dato og begrundelse.
- Det, kun ejeren kan gøre (domæne, CVR, konti, nøgler, aftaler), står i `docs/owner-action-list.md`. Spørg ikke om lov til tekniske valg inden for rammerne; dokumentér dem.
