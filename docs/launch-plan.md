# Lanceringsplan

*11. november 2026. Test med familier før penge, partnere før annoncer. Ingen offentliggørelse uden ejerens ja.*

## Fase 0 · Nu (uge 46–47)

- [ ] Appen bygget mod Arvora dev. En opdigtet familie kan gennemføre hele forløbet på telefon.
- [ ] RLS-test 0 FAIL. Serverfunktioner prøvet ende til ende.
- [ ] Ejeren: `kobl-til-github.cmd`, tjek arvora.dk og varemærke, CVR.
- [ ] Ejeren: nøgler til Arvora dev (Anthropic, GatewayAPI test, Resend test). Stripe i testtilstand.

## Fase 1 · Test med familier (uge 48–50)

- [ ] Staging på Netlify (`arvora-dev.netlify.app` eller `test.arvora.dk`) mod Arvora dev. Lukket: kun dem, der får linket.
- [ ] 3–5 familier, fundet gennem ejerens netværk. **Opdigtede eller egne data efter aftale; ingen rigtige dødsboer uden ejerens udtrykkelige ja og underskrevne vilkår.**
- [ ] Testguide (findes i startpakken fra 9. nov.): de bruger det selv, vi ser på. Spørgsmål: Var fordelingen fair? Forstod du forklaringen? Ville du betale 795 kr.? Hvad manglede?
- [ ] 2 bedemænd interviewet (guide i `partner-business-model.md`).
- [ ] Rettelser. Prisen besluttes.

**Stopregel:** under halvdelen ville betale → produkt eller pris laves om, før der bruges penge.

## Fase 2 · Klar til produktion (uge 51–2)

- [ ] Jurist har gennemgået vilkår og politik. Rettelser lagt ind.
- [ ] Produktionsprojekt i Supabase (egen org), migrationer, hemmeligheder, Vault, cron. `production-deployment.md`.
- [ ] arvora.dk og app.arvora.dk på Netlify. Headers, CSP.
- [ ] Stripe live. Webhook. Testkøb med rigtigt kort (ejeren), refunderet.
- [ ] SMS-afsender "Arvora" godkendt hos GatewayAPI. Mail-domæne verificeret hos Resend (SPF, DKIM, DMARC).
- [ ] Overvågning: Sentry på app og funktioner; Supabase-alarm på fejl; uptime-tjek af forsiden og `app.arvora.dk`.
- [ ] Backup gendannet én gang på dev som øvelse.
- [ ] `qa-and-release-report.md` opdateret med den sidste testkørsel.
- [ ] Databehandleraftaler accepteret (5 stk.).

## Fase 3 · Stille start (uge 3–6)

- [ ] Forsiden offentlig. "Opret bo" virker. Ingen annoncer.
- [ ] Partnere: de 2 interviewede bedemænd får koder først. Mål 10 partnere på 3 måneder.
- [ ] Hver uge: antal boer oprettet, åbnet, fordelt, underskrevet; fejl i Sentry; SMS-leveringsrate. Ét tal pr. linje i en note.
- [ ] Første 10 boer: ejeren ringer til tovholderen bagefter (med samtykke). Det er den bedste research, der findes.

## Fase 4 · Vækst (måned 3–6)

- [ ] Indhold: 5 sider om det, folk søger på ("hvordan deler man indbo", "arvinger uenige om indbo", "indbo testamente"). Rolig tone, ingen salgssprog.
- [ ] Google Ads som test: 3.000 kr., 2 uger, kun søgeord med købshensigt. Mål: pris pr. bo under 300 kr. Ellers stop.
- [ ] Partnerside i appen (tal pr. måned).
- [ ] Beslut V2 (`v2-arvora-mens-de-lever.md`) efter tallene.

## Det, der aldrig sker uden ejerens ja

Offentliggørelse, første rigtige invitation, første mail til en partner, køb af domæne eller annoncer, aftaler.
