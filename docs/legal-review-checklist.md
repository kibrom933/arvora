# Tjekliste til juristens gennemgang

*11. november 2026. Punkter, en dansk jurist skal tage stilling til, før Arvora offentliggøres. Udkastene i `terms-and-conditions-draft.md` og `privacy-policy-draft.md` er ikke godkendt og må ikke bruges, før det er sket.*

## Produktet og arveretten

1. **Hvad fordelingen er.** Arvora laver et forslag, som arvingerne godkender. Er det korrekt at beskrive det som en privat aftale mellem arvingerne om fordeling af indbo (privat skifte), og hvilke forbehold skal stå i produktet og vilkårene?
2. **Bobestyrer og skifteret.** Hvordan skal det formuleres, at Arvora ikke erstatter skifterettens behandling, og at en fordeling i Arvora ikke binder et bo under bobestyrer uden dennes accept?
3. **Testamente.** Tovholderen markerer ting som testamenteret. Arvora kontrollerer ikke testamentet. Er ansvarsfraskrivelsen tilstrækkelig, og skal der stå, at fordelingen ikke ændrer testamentets gyldighed?
4. **Kronemetoden.** "Forskellen udlignes i arven" er en beregning, ikke en pengeoverførsel. Skal det stå, at udligningen skal indgå i boopgørelsen, og at Arvora ikke er part i den?
5. **Ting, ingen ønskede** (restlisten). Står det klart, at det er arvingernes ansvar, hvad der sker med dem?
6. **Arvinger, der ikke svarer.** Fordelingen kan ikke køre, før alle har svaret eller er markeret "ønsker ikke noget" med fuldmagt. Er fuldmagt pr. engangskode nok, eller skal det være skriftligt?
7. **Umyndige arvinger** og arvinger under værgemål: skal produktet afvise dem, eller skal værgen handle? Anbefaling: en tekst, der siger, at værgen svarer på vegne af.

## Underskriften

8. Underskrift med engangskode på SMS/mail: Hvad er dens bevisværdi i en tvist mellem arvinger? Vi gemmer navn, tidspunkt, IP, browser, hash af dokumentet, koden bekræftet. Det kaldes **ikke** kvalificeret elektronisk signatur (eIDAS) nogen steder. Skal der tilbydes MitID-underskrift som tilvalg senere?
9. Skal fordelingslisten (PDF) have en bestemt ordlyd for at fungere som dokumentation ved privat skifte?

## Aftalen

10. **Hvem er kunden?** Tovholderen betaler. Arvingerne accepterer vilkår, når de åbner linket. Er det tilstrækkeligt, at arvingerne accepterer ved første login (afkrydsning + log), og at tovholderen oplyser dem?
11. **Forbrugeraftaleloven.** Tovholderen er forbruger. 14 dages fortrydelsesret ved digitalt indhold: vi beder om samtykke til at begynde levering straks og oplyser om tab af fortrydelsesret, når fordelingen er vist. Er formuleringen i vilkårene korrekt?
12. **Pris og moms.** 795 kr. inkl. moms. Faktura via Stripe. Er det rigtigt, at der ikke er krav om særlig fakturatekst ud over Stripes?
13. **Partnere** (bedemænd, advokater): 495 kr. pr. bo, der bruges. Er der regler om henvisningshonorar for advokater (god advokatskik), som gør, at advokater ikke må modtage eller betale for henvisning? Bedemænd: ingen kendt begrænsning.
14. **Ansvarsbegrænsning.** Arvora er ansvarlig for, at tjenesten virker, ikke for familiens aftale. Max ansvar = betalt beløb. Er det gyldigt over for forbrugere i Danmark?
15. **Nedlukning.** Hvis Arvora lukker: 90 dages varsel, mulighed for PDF. Er det nok?

## Persondata

16. Hjemmel for arvingernes oplysninger indtastet af tovholderen (legitim interesse vs. kontrakt).
17. Opbevaring: 90 dage efter afslutning, 30–730 valgbart; auditlog 12 måneder anonymiseret; betalingsdata hos Stripe 5 år. Er det proportionalt?
18. IP-adresse ved underskrift: nødvendig?
19. AI (Anthropic, USA) ser billeder af hjemmet. Er SCC + DPF nok, og skal brugeren kunne fravælge AI-navne? (Det kan hun: forslag er valgfrit.)
20. SMS via GatewayAPI (DK), mail via Resend (USA). Overførselsgrundlag.
21. Er en DPIA påkrævet?
22. Privatlivspolitikkens sprog og placering (link ved login, i invitationens SMS?).

## Markedsføring

23. Må forsiden sige "fair" og "anerkendt metode"? Vi henviser til Maximum Nash Welfare og EF1 (Caragiannis m.fl. 2016). Er det vildledende over for forbrugere?
24. "Ingen misunder" i resultatet: det er et matematisk tjek (EF1), ikke et løfte om familiens følelser. Skal ordet ændres?
25. Varemærke "Arvora": tjek hos Patent- og Varemærkestyrelsen og EUIPO. Domæne arvora.dk.
26. Partnerside: bedemænd, der anbefaler Arvora, skal de oplyse, at de får honorar? (Markedsføringsloven § om skjult reklame.)

## Virksomheden

27. Enkeltmandsvirksomhed vs. ApS: ansvar og persondata-ansvar.
28. Erhvervsforsikring / professionel ansvarsforsikring: relevant?
29. Bogføring af Stripe-udbetalinger.

## Det, der er sikkert nok til at sige allerede nu

- Arvora giver ikke juridisk rådgivning. Det står på forsiden, i appen og i vilkårene.
- Godkendelsen med engangskode kaldes "underskrift" i produktet, men beskrives i vilkårene som "elektronisk godkendelse". Den kaldes aldrig kvalificeret elektronisk signatur.
- Boopgørelse, skifteret og bobestyrer ligger uden for produktet.
