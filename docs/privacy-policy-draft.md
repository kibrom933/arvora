# Privatlivspolitik · UDKAST

> **Ikke godkendt.** Skrevet af Claude 11. november 2026. Skal gennemgås af en dansk jurist, før den bruges. Grundlaget står i `privacy-and-gdpr.md`. Felter i [klammer] udfyldes af ejeren.

## Hvem er ansvarlig

[Navn], CVR [nummer], [adresse], [mail]. Vi er dataansvarlige for behandlingen i Arvora.

## Hvilke oplysninger vi behandler, og hvorfor

**Om tovholderen:** navn, telefon eller mail, betalingsoplysninger (hos Stripe; vi ser ikke kortnummeret). Bruges til at oprette boet, logge ind, betale og sende kvittering.

**Om arvingerne:** navn, telefon eller mail, relation til afdøde og arvelod, som tovholderen indtaster. Bruges til at sende invitationen, logge ind med engangskode, beregne fordelingen og dokumentere godkendelsen.

**Om boet:** afdødes navn og årstal, billeder og beskrivelser af tingene, hvem der skal have testamenterede ting. Bruges til fordelingen.

**Ønsker:** de point eller bud, hver arving giver. Ønskerne kan kun ses af den arving, de tilhører. Hverken tovholderen, de andre arvinger eller Arvoras medarbejdere kan se dem. Fordelingen beregnes på vores server, og hver arving får kun sin egen forklaring.

**Godkendelse:** navn, tidspunkt, IP-adresse, browser og et fingeraftryk af fordelingslisten, når en arving godkender. Bruges som dokumentation for, at fordelingen er godkendt.

**Teknisk:** hvem der har ændret hvad i boet (uden indholdet af ønsker), beskeder vi har sendt, og engangskoder (kun som hash, i 10 minutter). Bruges til sikkerhed.

Vi behandler ikke CPR-numre, MitID eller bankoplysninger.

## Grundlaget

Tovholderens oplysninger: aftalen med dig (databeskyttelsesforordningen art. 6, stk. 1, litra b). Arvingernes oplysninger: vores og arvingernes legitime interesse i, at boet kan deles (litra f), og aftalen, når arvingen selv bruger tjenesten (litra b). Dokumentation af godkendelser og samtykker: retlig forpligtelse og legitim interesse (litra c og f). Betalingsoplysninger til bogføring: retlig forpligtelse (litra c).

## Billeder og AI

Når tovholderen tager et billede af en ting, kan hun bede om et forslag til navn og rum. Så sendes billedet til Anthropic (USA), som svarer med et forslag. Billedet gemmes ikke hos Anthropic og bruges ikke til at træne modeller. Forslaget kan altid rettes. Vil du ikke bruge AI, lader du være med at trykke på knappen.

## Hvem vi deler med

Vores leverandører behandler oplysninger for os efter databehandleraftaler: Supabase (database, login, billeder; Frankfurt, EU), Stripe (betaling; EU/USA), Resend (mail; USA), GatewayAPI (SMS; Danmark), Anthropic (AI-forslag; USA), Netlify (levering af selve hjemmesiden; USA/EU). Overførsel til USA sker på EU's standardkontrakter og EU-U.S. Data Privacy Framework.

Vi sælger ikke oplysninger og viser ikke annoncer.

## Hvor længe

Boet med alt indhold slettes automatisk [90] dage efter, at det er afsluttet. Tovholderen kan vælge 30–730 dage og kan slette boet før. Logs over ændringer anonymiseres ved sletningen og slettes helt efter 12 måneder. Kvitteringer og bogføring opbevares hos Stripe i 5 år efter bogføringsloven. Engangskoder slettes efter 10 minutter.

## Dine rettigheder

Du kan bede om indsigt, rettelse, sletning, begrænsning og udlevering af dine oplysninger, og du kan gøre indsigelse. Skriv til [mail]. Vi svarer inden en måned. Vi beder dig bekræfte, hvem du er, med en kode til den telefon eller mail, vi har.

Som arving kan du se dine egne ønsker, din forklaring og fordelingen i appen. Du kan ikke se andres ønsker, fordi de ikke er dine oplysninger.

Du kan klage til Datatilsynet, Carl Jacobsens Vej 35, 2500 Valby, www.datatilsynet.dk.

## Cookies

Arvora bruger ingen cookies til sporing eller analyse. Appen gemmer dit login i browseren, så du ikke skal logge ind hver gang. Det er nødvendigt for, at tjenesten virker.

## Sikkerhed

Oplysningerne er krypteret under transport og på disk. Adgangen styres pr. række i databasen, så hver bruger kun kan se det, hun må. Ønsker kan kun læses af deres ejer. Vi fører log over ændringer, begrænser antal forsøg på koder og sletter automatisk.

## Ændringer

Ændrer vi politikken, står den nye version her med dato, og vi giver besked i appen.

*Version [0.1], [dato].*
