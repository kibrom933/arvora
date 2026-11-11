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
| Adgangsregler | `supabase/tests/rls.sql`, 47 regler | **Ikke kørt** | Afventer ejerens ja i Supabase MCP |
| Serverfunktioner | Deployet. Ingen test endnu. | – | **Ikke testet** |
| Appen | Findes ikke endnu | – | – |

## Seneste testkørsel

*Udfyldes af kørslen 11. nov.; se nederst.*

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

## Kendte mangler før udgivelse

- RLS-test ikke kørt.
- Serverfunktioner ikke prøvet mod rigtige kald: `pdf` (skrifter fra app-URL), `stripe-webhook` (signatur), `accept-invite` (Supabase Auth-OTP via SMS kræver udbyder), `housekeeping` (Vault-hemmeligheder).
- Ingen app.
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
