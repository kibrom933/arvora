# QA- og udgivelsesrapport

*11. november 2026. Status for test af alle dele. Opdateres før hver udgivelse. Prototypens egen rapport fra 9.–10. nov. står i `testrapport.md`.*

## Hvad er testet, og hvordan

| Del | Metode | Seneste kørsel | Resultat |
|---|---|---|---|
| Prototype, hele forløbet | Playwright, `tests/happy.js`, computer + iPhone 13, lyst + mørkt | 10. nov. | 49 × 4 PASS |
| Prototype, kanttilfælde | `edge.js`, `fixes.js`, `refine.js`, `lod.js` | 11. nov. (se nedenfor) | PASS |
| Motor, korrekthed | `solver.js` (1.500 familier mod udtømmende søgning, i browseren), `dup.js` | 11. nov. | PASS |
| Motor som modul | `engine-props.js` (26 egenskaber: optimalitet 600 + 300 vægtede familier, EF1, ingen dubletter, determinisme, lod-jævnhed χ², validering), `engine-parity.js` (1.500 familier prototype vs. modul) | 11. nov. | 26 PASS; 1.500/1.500 |
| Forside | Skærmbilleder 390/860/1280 px, lyst + mørkt; manuel gennemgang | 10. nov. | OK |
| Datamodel | 8 migrationer anvendt på Arvora dev uden fejl; sikkerhedslinter | 11. nov. | Linter: 0 fejl ud over tilsigtede "no policy" |
| Adgangsregler | `supabase/tests/rls.sql`, 55 regler, kørt mod Arvora dev | 12. nov. | 54 PASS, 1 FAIL (besked til tovholderen, når alle har svaret; tovholder-arvingen manglede adresse). Rettet i migration `20261112000300` |
| Live-prøve | Login med kode på mail, opret bo, ting, arving, invitation, cron-udsendelse, link i mailen. Mod Arvora dev fra GitHub Pages | 12. nov. | Virker. Fandt og rettede: oversigten manglede `created_at`; underskriftskoden ventede op til 15 min i køen |
| Serverfunktioner | Deployet. Ingen test endnu. | – | **Ikke testet** |
| Appen | `tests/app.mjs`: hele forløbet med tre personer i tre browsere mod `fake-supabase.mjs` (login, opret bo, 5 ting + AI-navn fra billede, omdøb, rum, fjern, testamente, 2 arvinger med links på SMS og mail, betaling, åbning, invitation med forkert og rigtig kode, point, løbende gemning, afgiv/fortryd, hemmelighed, tovholderens overblik, fordeling med kasser/procent/forklaring/testamente, underskrift med forkert og rigtig kode, PDF-download, kopi, ny runde med alles ja, slet nu, ingen konsolfejl, intet overløb). Computer, iPhone 13, iPhone 13 mørk. | 11. nov. | 64 × 3 PASS |

## Seneste testkørsel (11. nov.)

```
ok    edge                  38 pass  0 fail  31.2s
ok    fixes                 30 pass  0 fail  18.9s
ok    lod                   36 pass  0 fail  28.6s
ok    refine                42 pass  0 fail  18.0s
ok    solver                 0 pass  0 fail   2.4s   (JSON-tal: 0 ikke-optimale, 0 dubletter)
ok    engine parity          1 pass  0 fail   8.6s   (1.500/1.500 familier ens)
ok    engine props          26 pass  0 fail  37.4s
ok    app desktop           64 pass  0 fail
ok    app mobile            64 pass  0 fail
ok    app mobile dark       64 pass  0 fail
```
`happy` (4 × 49) og `dup` blev kørt 10. nov. uden fejl og er ikke rørt siden.

## Fundet og rettet i denne periode

1. **`gen_random_bytes` fandtes ikke** i `public` (pgcrypto ligger i `extensions`). `draw_lod()` kalder nu `extensions.gen_random_bytes`.
2. **Audit- og items-triggere brugte `NEW` ved sletning** og fejlede. Skrevet om med jsonb og `tg_op`.
3. **Kolonnerettigheder virkede ikke**, fordi tabelrettigheder stadig dækkede alt. Nu trækkes tabelrettigheden tilbage, og kolonner gives enkeltvis.
4. **RPC'er kunne kaldes af anon** (Postgres' standard `PUBLIC`-grant på funktioner). Nu `revoke … from public, anon` og eksplicit `grant … to authenticated`.
5. **Mutable `search_path`** i flere funktioner (linter). Sat fast overalt.
6. **`citext` og `pg_net` i `public`** (linter). Flyttet til `extensions`.
7. **Auditlog overlevede sletning af bo** med navne og aktør. Nu anonymisering ved sletning og sletning efter 12 måneder (migration `000900`, ikke anvendt endnu).
8. **Parallel session pushede et konkurrerende skema** (`0001_grundmodel.sql`, pglite-test). Flettet, deres filer fjernet, ét skema. Regel i CLAUDE.md.
9. **Playwright-version** gled ved `npm install` af en skrift; pinnet til den forudinstallerede browser.
10. **Arvinger kunne ikke se, at der var bedt om en ny runde** (policy på `consent_records` gav kun egne samtykker). Fundet af app-testen. Rettet i migration `001000` (ikke anvendt endnu) og to nye regler i `rls.sql`.
11. **Appen viste gamle tal efter navigation** (boet blev kun hentet én gang). Nu hentes boet igen ved hver navigation, ikke ved hver tegning.

## Kendte mangler før udgivelse

- RLS-test ikke kørt.
- Serverfunktioner ikke prøvet mod rigtige kald: `pdf` (skrifter fra app-URL), `stripe-webhook` (signatur), `accept-invite` (Supabase Auth-OTP via SMS kræver udbyder), `housekeeping` (Vault-hemmeligheder).
- Appen er kun testet mod efterligningen, ikke mod Arvora dev.
- Ingen ende-til-ende-test med opdigtet familie på Arvora dev.
- Ingen test af, hvad der sker ved 300 ting og 6 arvinger på serveren (motoren klarer 8 × 300 på 0,3 s lokalt; Edge Function-grænsen er 150 s CPU, så det rækker).

## Udgivelseskriterier (før rigtige familier)

1. `npm test` 0 FAIL.
2. `rls.sql` 0 FAIL på det projekt, der skal bruges.
3. Sikkerhedslinter: kun tilsigtede "no policy".
4. Ende-til-ende på staging: opret bo → betaling (test) → 3 ting med billede og AI-navn → 3 arvinger inviteret på SMS til ejerens egne numre → ønsker → fordeling → underskrift × 3 → PDF → slet nu → storage tom.
5. Vilkår og politik godkendt af jurist og linket ved login.
6. Sentry modtager fejl. Uptime-tjek aktivt.
7. Ejerens ja.
