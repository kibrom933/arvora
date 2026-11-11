# Arvora

**Del tingene – ikke familien.**

Arvora hjælper arvinger med at dele indbo fair. Tovholderen fotograferer tingene, hver arving giver sine ønsker i hemmelighed, og Arvora finder den fordeling, der giver alle mest muligt af det, de ønskede sig. Fordelingen gælder, når alle har skrevet under.

Tidligere arbejdsnavne: Fair Arv → Arvefred → Godt Delt → **Arvora** (10. november 2026).

## Hvad ligger her

| Mappe | Indhold |
|---|---|
| `prototype/` | Den klikbare prototype: hele forløbet fra ting til underskrift med en fungerende fordelingsmotor. Én HTML-fil, ingen build. `fonts/` er PDF-skrifterne. |
| `engine/` | Fordelingsmotoren som modul. Samme kode som prototypen; bruges af serveren. |
| `site/` | Forsiden (arvora.dk). Én HTML-fil. |
| `supabase/` | Den rigtige version: datamodel og adgangsregler (`migrations/`), serverfunktioner (`functions/`), adgangstest (`tests/rls.sql`). Kører på projektet Arvora dev i Frankfurt. |
| `app/` | Den rigtige app mod Supabase (under opbygning). |
| `tests/` | Playwright-test af prototypen, Node-test af motoren: gennemgang på computer og telefon, kanttilfælde, lodtrækning, stresstest af motoren, paritet mellem prototype og modul. |
| `docs/` | Produktbrief, beslutninger, status, arkitektur, datamodel, sikkerhed, GDPR, juridiske udkast, økonomi, plan. Start med `docs/produkt.md` og `docs/complete-project-audit.md`. |
| `tools/` | `make-fonts.py` laver PDF-skrifterne. |

Begge sider er udgivet som Claude-artifacts, så de kan prøves uden at køre noget:

- Prototype: https://claude.ai/artifact/MaQ3gr7yC6AqMySFqZkBCw
- Forside: https://claude.ai/artifact/V8hggiboRKkxsy73qNZu6X

## Kør lokalt

Siderne henter skrifter fra Google Fonts og jsPDF fra cdnjs, så de skal åbnes fra en webserver (ikke `file://`), ellers virker PDF-skrifterne ikke.

```bash
npm install
npm run serve          # http://localhost:8080/prototype/  og  /site/
```

## Test

```bash
npm install
npx playwright install chromium   # første gang
npm test                          # hele pakken, ca. 6 minutter
node tests/run-all.js lod refine  # kun udvalgte
```

Testene kører uden netadgang: skrifter og jsPDF serveres fra `node_modules`. Skærmbilleder og PDF'er lander i `tests/out/` (ignoreret af git).

| Fil | Tester |
|---|---|
| `happy.js` | Hele forløbet som en familie ville gøre det, på computer og iPhone, lyst og mørkt tema |
| `edge.js` | 18 kanttilfælde: metodeskift, alle vil have det samme, slettede ting efter underskrift, fulde billeder, lange navne, 7 arvinger, AI-navne (med en stedfortræder for Claude) |
| `fixes.js` | Rettelserne fra den første test: faste numre, fjern arving, to tryk på Start forfra, kopiér uden udklipsholder, fuld browser |
| `lod.js` | Lodtrækningen: lige chance uanset plads på listen (6.000 træk), samme lod giver samme resultat, alle uafgjorte vises |
| `refine.js` | "Jeg ønsker ikke noget", glemt kode, underskrift med kode, PDF med Ayşe og Łukasz |
| `solver.js` / `dup.js` | Motoren mod den bedst mulige fordeling i 1.500 tilfældige familier; ingen ting i to kasser |

## Udgiv

Prototypen udgives med `prototype/index.html` som side og `prototype/fonts/*.ttf` som filer ved siden af (`fonts/hk-400.ttf`, `fonts/hk-700.ttf`). Forsiden udgives alene. Se `CLAUDE.md`.

## Licens

Privat. Skrifterne Fraunces, Hanken Grotesk, Caveat og IBM Plex Mono er under SIL Open Font License.
