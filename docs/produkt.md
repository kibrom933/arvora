# Arvora – produktbrief

*Samlet 10. november 2026 fra plan-, produkt- og startpakke-dokumenterne (9. november) og fra det, prototypen har vist under test. Tal er skøn, hvor det står.*

## Hvad Arvora er

Arvora hjælper arvinger med at dele indbo fair, uden at de skal sidde om bordet og forhandle. Tovholderen fotograferer tingene, hver arving giver sine ønsker i hemmelighed, og en anerkendt metode til fair fordeling laver en fordeling, som alle kan skrive under på. Slogan: *Del tingene – ikke familien.*

Den egentlige konkurrent er køkkenbordet: søskende, der skiftes til at vælge. Dér vinder den, der taler højest, og den konfliktsky går hjem med det, ingen andre ville have. Arvora skal være lettere og mindre pinligt end det.

## Hvem

- **Tovholderen** (køberen): typisk et voksent barn på 40–65 år, der er tovholder for søskende, har travlt, er i sorg og frygter konflikt. Bruger 2–4 timer, mest på billeder.
- **Arvingerne**: 2–6 personer, også ældre uden smartphone. Får et link på SMS, ingen konto, ingen app. Bruger 15–30 minutter.
- **Partnere**: bedemænd, advokater og bobestyrere, der møder familien, når det sker.

## Forløbet

1. **Ting.** Tovholderen går gennem hjemmet med mobilen. Hver ting får en mærkeseddel med et fast nummer (Nr. 001 …), og AI foreslår navn og rum ud fra billedet. Ting kan samles i grupper ("Musselmalet stel, 48 dele"). Ting i testamentet markeres og låses til den rette arving. Værdifulde ting markeres "Bør vurderes".
2. **Arvinger.** Navn, telefon, relation og arvelod (hel, halv, kvart, dobbelt andel). Hver får et personligt link.
3. **Ønsker, i hemmelighed.** Pointmetoden: 100 point fordeles på det, der betyder mest. Kronemetoden: bud i kroner til værdifulde ting. Hver arving har sin egen kode. Man kan også sige "Jeg ønsker ikke noget". Ingen kan se andres ønsker, før alle har svaret.
4. **Fordeling.** Når alle har svaret, trykker tovholderen "Del tingene", gerne mens familien er samlet. Resultatet vises som kasser med hver arvings ting, "Fik af sine ønsker" i procent, en forklaring pr. arving ("Hvorfor fik Anna netop det her?") og fire tjek: ingen misunder, ingen bytning gør det bedre, testamentet er fulgt, og hvad loddet afgjorde. Ting, ingen ønskede, kommer på en restliste til salg, genbrug eller rydning.
5. **Underskrift.** Alle skriver under med deres egen kode. Først da gælder fordelingen. Fordelingslisten kan kopieres eller hentes som PDF til boopgørelsen. Ændres noget bagefter, falder underskrifterne, og der deles igen.

## Fordelingsmotoren

**Pointmetoden** (standard) finder den fordeling, der maksimerer produktet af alle arvingers point-sum (*Maximum Nash Welfare*), vægtet efter arvelod. Produktet straffer fordelinger, hvor én får meget og en anden næsten intet. Motoren lægger først tingene grådigt ud, flytter og bytter derefter enkeltting og hele kasser, så længe det bliver bedre, og prøver 40 forskellige startrækkefølger. I 1.500 tilfældige familier fandt den altid den bedst mulige fordeling.

Bagefter tjekkes, at ingen arving foretrækker en andens kasse, når man fjerner én ting fra den (*EF1*, standardmålet for fair deling af ting, der ikke kan deles). Fejler tjekket, foreslår appen kronemetoden.

**Kronemetoden**: højeste bud vinder tingen til buddets pris. Summen af vindende bud er værdien af det fordelte; hver arving har ret til sin andel efter arvelod, og forskellen udlignes i arven.

**Uafgjort**: står to eller flere helt lige, afgør et lod det. Loddet trækkes én gang pr. bo og gemmes, så det kan ikke trækkes om, og det står åbent i fordelingen og på fordelingslisten, hvem der vandt det. Alle har lige chance uanset plads på listen (målt over 6.000 træk).

**Begrænsning**: motoren kan ikke tvinge en fordeling igennem. Kan arvingerne ikke blive enige, må boet til bobestyrer. Det skal stå tydeligt.

## Hvad der er med, og hvad der ikke er

**Version 1 (lancering):** opret bo med betaling · inviter på SMS/mail med personligt link · arvelod · tovholder kan afgive ønsker for en arving, der har givet lov · billeder, flere ad gangen, AI-navne · faste numre · grupper og rum · testamente · point- og kronemetode · status og påmindelser · fordeling med forklaring og tjek · restliste · underskrift med kode · PDF · automatisk sletning 90 dage efter afslutning.

**Version 2 (4–6 måneder efter):** *Arvora mens de lever* (forældre fotograferer selv, børnene giver ønsker, resultatet kan blive et indbotestamente) · henvisning til auktionshus og rydningsfirma fra restlisten · partnerkoder med månedlig status · kommentar pr. ting ("derfor betyder den noget for mig").

**Version 3 (kun hvis tallene er gode):** mindebog · flytning og skilsmisse · app i butikkerne.

**Fravalgt:** boopgørelse og regnskab (eDødsbo findes) · juridisk rådgivning · officiel vurdering · chat mellem arvingerne.

## Teknik (planlagt til den rigtige version)

Webapp i mobilens browser, kan lægges på hjemskærmen. Ikke App Store. Netlify til hosting, Supabase i EU til database, login og billeder, Stripe (ny konto i Arvoras navn) til betaling, Resend til mail, en dansk udbyder til SMS, en AI-model til at navngive billeder. Fordelingen beregnes i browseren. Ønskerne er hemmelige i selve databasen med adgangsregler, ikke kun i appen. Ingen CPR, intet MitID, ingen bankoplysninger. Alt slettes 90 dage efter afslutning; tovholderen kan slette før.

Prototypen i dette repo kører alene i browseren og gemmer alt lokalt. Den efterligner SMS, betaling og deling mellem telefoner.

## Forretning

| | |
|---|---|
| Pris pr. bo | 795 kr. inkl. moms (op til 6 arvinger, 300 ting). +195 kr. for flere arvinger |
| Mens de lever | 395 kr. (2027) |
| Partner | 495 kr. pr. bo, der bliver brugt. Gratis de første 3 måneder |
| Omkostning pr. bo | ca. 20–25 kr. (AI, Stripe, SMS) |
| Faste udgifter år 1 | ca. 5.000–10.000 kr. + markedsføring |
| Marked | skøn: 15.000–25.000 boer om året med flere arvinger, der skal dele indbo |
| Realistisk mål | 300–500 boer om året ≈ 240.000–400.000 kr. |

Salget sker, hvor familien er, når det sker: bedemænd og advokater først (mål: 10 partnere på 3 måneder), derefter indhold og søgning, annoncer kun som test.

**Beslutningspunkter:** Efter test med 3–5 familier: fandt de fordelingen fair, og ville mindst halvdelen af tovholderne betale 795 kr.? Hvis nej, laves produkt eller pris om før markedsføring. Efter 3 måneder: under 30 solgte boer betyder ny salgskanal eller stop.

## Det, kun ejeren kan gøre

Opret enkeltmandsvirksomhed (virk.dk) · tjek og køb arvora.dk (og tjek varemærker hos Patent- og Varemærkestyrelsen; det blev tjekket for "Godt Delt", ikke for "Arvora") · ny Stripe-konto · nyt Supabase-projekt i EU · Netlify-adgang · find 3–5 testfamilier og ring til 2 bedemænd · advokatgennemgang af handelsbetingelser og privatlivspolitik (udkast ligger i startpakken fra 9. november).
