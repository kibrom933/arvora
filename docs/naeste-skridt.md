# Næste skridt

Rækkefølgen følger planen: test med familier før penge, partnere før annoncer.

## Nu (prototypen)
- [ ] Prøv AI-navne og PDF på en rigtig telefon i den udgivne prototype.
- [ ] Tovholder kan afgive ønsker for en arving, der har givet lov (står i V1).
- [ ] Beslut, hvad der sker med ønskerne efter første fordeling (låses, eller ny runde kræver alles ja). Se `beslutninger.md`.
- [ ] Vis prototypen for 3–5 familier og 2 bedemænd. Testguide og spørgsmål ligger i startpakken (9. nov.).

## Ejeren (kan ikke gøres herfra)
- [ ] Tjek arvora.dk og varemærke "Arvora" (Patent- og Varemærkestyrelsen, TMview). Køb domænet.
- [ ] CVR, ny Stripe-konto, nyt Supabase-projekt i EU, Netlify-adgang.
- [ ] Advokat gennemgår handelsbetingelser og privatlivspolitik (udkast i startpakken; navnet skal rettes til Arvora).

## Den rigtige version (når de første familier har sagt ja)
1. **Datamodel i Supabase**: bo → arvinger → ting → ønsker → fordeling → underskrifter, med adgangsregler, så en arving kun kan læse egne ønsker, før fordelingen er låst. Skemaet fra 9. nov. tilpasses til faste numre, lod pr. bo og koder pr. arving.
2. **Login uden adgangskode**: personligt engangslink på SMS/mail pr. arving. Koden fra prototypen afløses af linket; underskrift bekræftes med et nyt engangslink.
3. **Billeder** i Supabase Storage (EU), skaleret i browseren før upload, slettet med boet.
4. **AI-navne** via serverfunktion, så nøglen ikke ligger i browseren. Billedet bruges kun til navnet.
5. **Betaling** med Stripe Checkout før boet oprettes. 14 dages fortrydelsesret, indtil fordelingen vises.
6. **SMS og mail**: invitation, påmindelse 3 dage før frist, "alle har svaret" til tovholder, "fordelingen er klar" til arvinger, "alle har underskrevet" med PDF. Teksterne ligger i startpakken.
7. **PDF på serveren** ved afslutning, sendt til alle.
8. **Sletning** 90 dage efter afslutning, og "slet nu" for tovholderen.
9. **Motoren** flyttes uændret fra `prototype/index.html` (`solvePoints`, `solveBids`, `lodtal`) og kører stadig i browseren; loddet trækkes på serveren ved oprettelse.
10. **Forsiden** på arvora.dk med betaling og "Opret bo".

## Senere (V2)
- Arvora mens de lever · henvisning til auktionshus og rydning · partnerkoder med månedlig status · kommentar pr. ting.
