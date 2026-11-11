# Næste skridt

Rækkefølgen følger planen: test med familier før penge, partnere før annoncer. Den fulde status står i `complete-project-audit.md`, planen i `launch-plan.md`, ejerens liste i `owner-action-list.md`.

## Nu
- [x] **Appen** (`app/`) bygget: login med engangskode, bo, ting med upload og AI-navn, arvinger og invitationer, ønsker, fordeling, underskrift, PDF, slet. Testet mod en efterligning af Supabase (64 trin × 3).
- [ ] **Appen kørt mod Arvora dev** med opdigtet familie. Kræver nøgle i `app/.env` og Auth-OTP slået til.
- [ ] **RLS-testen** kørt (ejeren siger ja i Supabase MCP), migrationer `000900` og `001000` anvendt.
- [ ] Serverfunktionerne prøvet ende til ende fra appen.
- [ ] Prøv AI-navne og PDF på en rigtig telefon i den udgivne prototype.
- [ ] Vis prototypen for 3–5 familier og 2 bedemænd.

## Ejeren (kan ikke gøres herfra)
Se `owner-action-list.md`. De første fem: kør `kobl-til-github.cmd`, stop den parallelle session, sig ja til Supabase, tjek arvora.dk og varemærke, køb domænet.

## Den rigtige version
1. **Datamodel**: bygget og anvendt på Arvora dev 11. nov. `supabase/migrations/2026…`, test i `supabase/tests/rls.sql`. Se `database-schema.md`, `security-and-privacy-audit.md`.
2. **Login uden adgangskode**: engangskode på SMS/mail. Serverfunktioner `invite`, `accept-invite`, `link-invite` bygget. Valg af SMS-vej til Supabase Auth står i `production-deployment.md` pkt. 4.
3. **Billeder** i Supabase Storage, bucket `ting`, privat, slettes med boet. Bygget.
4. **AI-navne** via `ai-name`. Bygget; kræver nøgle.
5. **Betaling**: `stripe-checkout` og `stripe-webhook` bygget; kræver konto.
6. **SMS og mail**: `housekeeping` sender fra køen. Bygget; kræver GatewayAPI og Resend.
7. **PDF på serveren**: `pdf` bygget med pdf-lib.
8. **Sletning**: 90 dage, "slet nu", cron, storage-oprydning. Bygget.
9. **Motoren** i `engine/arvora-engine.js`, kører i `run-distribution`. Bygget og bevist.
10. **Forsiden** på arvora.dk med "Opret bo": afventer appen.

## Senere (V2)
Se `v2-arvora-mens-de-lever.md`. Partnerside med tal pr. måned. Henvisning til auktionshus og rydning fra restlisten. Kommentar pr. ting.
