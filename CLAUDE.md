# Arvora – noter til Claude

Læs `docs/produkt.md` først. Det er produktbriefen. `docs/beslutninger.md` er de valg, der er truffet, og hvorfor.

## Sprog og tone
- Alt i produktet og i docs er på dansk. Kode og kommentarer må være på dansk eller engelsk; hold én stil pr. fil.
- Tonen i produktet: kort, venlig og rolig. Ingen udråbstegn, intet salgssprog, ingen "Tillykke". Familierne er i sorg.
- Brugerens ord: *ting*, *arving*, *tovholder*, *bo*, *ønsker*, *fordeling*, *underskrift*. Ikke "items", "users", "allocation".
- Arvora giver ikke juridisk rådgivning og må aldrig lyde som om. Boopgørelse, skifteret og bobestyrer ligger uden for produktet.

## Hvad der ligger hvor
- `prototype/index.html` er hele appen: CSS-tokens øverst, derefter illustrationer, data (`DEMO`), motoren (`solvePoints`, `solveBids`), visningerne (`V.oversigt` … `V.underskrift`) og til sidst hændelser. Ingen build, ingen framework. Hold det sådan, indtil den rigtige version bygges.
- Tilstanden hedder `S` og gemmes i `localStorage` under `KEY`. `norm()` kører ved start og gør gammel gemt tilstand gyldig (numre, lod). Udvid `norm()`, når tilstandens form ændres; nulstil aldrig brugerens data bare fordi et felt mangler.
- `site/index.html` er forsiden. Samme skrifter og samme farver som appen (fyrregrøn, hør, rav).
- `tests/` er Playwright. `tests/lib.js` serverer siden fra disk på `https://godtdelt.test/` og erstatter Google Fonts og cdnjs med lokale kopier, så testene kører uden net.

## Motoren (skal du ikke ændre uden at køre `solver.js` og `lod.js`)
- Pointmetoden maksimerer vægtet Nash-velfærd: produktet af hver arvings point-sum, vægtet med arvelod. Grådig start, derefter flyt og byt af enkeltting og hele kasser, 40 forsøg fra forskellige rækkefølger, bedste vinder. Mod en udtømmende søgning i 1.500 tilfældige familier (2–5 arvinger, 3–11 ting) var den bedst mulige fordeling fundet hver gang.
- Uafgjort afgøres af boets lod (`S.lod`, trukket én gang pr. bo). `lodtal(h,i)` giver et fast tal pr. arving og ting ud fra loddet. Samme ønsker og samme lod giver altid samme fordeling. Alt, der kunne være endt anderledes uden tab, vises åbent som "Afgjort ved lodtrækning".
- Kronemetoden: højeste bud vinder, lige bud afgøres af loddet, forskellen udlignes i arven efter arvelod.
- Efter en ændring: `node tests/run-all.js solver dup lod` skal give 0 fejl.

## Udgivelse som Claude-artifact
- Filerne i repoet er hele HTML-dokumenter med præcis det skelet, Artifact-værktøjet selv sætter på (`<!doctype html><html><head>…</head><body>` på én linje). Værktøjet genkender skelettet og pakker ikke siden ind igen. Lad den første linje være, som den er.
- Prototypen: udgiv `prototype/index.html` til https://claude.ai/artifact/MaQ3gr7yC6AqMySFqZkBCw med `files` = `{"fonts/hk-400.ttf": "prototype/fonts/hk-400.ttf", "fonts/hk-700.ttf": "prototype/fonts/hk-700.ttf"}`. Capabilities `downloads` og `sample` (med billeder) er gemt på artifactet og følger med, når `capabilities` udelades.
- Forsiden: udgiv `site/index.html` til https://claude.ai/artifact/V8hggiboRKkxsy73qNZu6X.
- Kør testene, før du udgiver. En udgivelse ses med det samme af alle med linket.

## Test
- `npm test` kører alt (ca. 6 min). Enkelte pakker: `node tests/run-all.js happy\ desktop refine`.
- Nye funktioner får test i den fil, der passer, eller en ny fil, som tilføjes i `tests/run-all.js`. En test siger PASS/FAIL pr. linje; `run-all.js` tæller dem.
- Skærmbilleder i `tests/out/shots/` er den hurtigste måde at se, om noget ser forkert ud på telefon eller i mørkt tema.

## Arbejdsform
- Små, afgrænsede ændringer. Beskriv i commit-beskeden, hvad brugeren oplever anderledes, ikke hvilken funktion der blev rørt.
- Produktvalg, der ændrer, hvad familien oplever (fx hvordan uafgjort afgøres), skrives ind i `docs/beslutninger.md` med dato og begrundelse.
- Det, der kræver en rigtig server (SMS, betaling, hemmelige ønsker på tværs af telefoner, sletning efter 90 dage), står i `docs/naeste-skridt.md`. Prototypen efterligner det kun.
