# Beslutninger

Produktvalg, der ændrer, hvad familien oplever. Nyeste øverst. Skriv dato, valget og hvorfor.

## 2026-11-10 · Navnet er Arvora
Ejerens valg. Afløser Godt Delt (9. nov.), som afløste Arvefred og Fair Arv. Domæne og varemærke for Arvora er ikke tjekket endnu.

## 2026-11-10 · Eget udtryk: blomme, hvidt papir og messing
Ejerens anden app (Zoonex) bruger grøn brandfarve på cremefarvet baggrund, og Arvora lignede den for meget. Nu: hvidt papir (#FFFFFF, mørkt tema #15111B) med lyse stenfarvede bånd, dyb blomme som blæk (#4B2D5E), messing til numre, segl og det, øjet skal finde (#C19A4B), og en serif til overskrifterne (Fraunces) i stedet for en grotesk. Logoet er en cirkel delt i tre lige dele. Forsiden viser produktet som det, familien ender med: en fordelingsliste, alle har skrevet under på, i stedet for flyttekasser på snor. Arvingernes farver i fordelingen: blomme, teglrød, blå, okker, grøn, brun, petrol, mørk rosa. Rummenes illustrationsfarver fulgte med (stue i blomme, køkken i messing).

Afløste samme dag "fyrregrøn, hør og rav", som kun levede få timer.

## 2026-11-10 · En arving kan sige "Jeg ønsker ikke noget"
Før skulle alle 100 point bruges, så en arving, der ikke ønskede noget, kunne ikke svare og blokerede hele familien. Nu er der en knap, når ingen point er brugt. Resultatet viser "Ønskede ikke noget af tingene" uden procent, og personen tæller ikke som "fik ingen af sine ønsker". Testamenteret gods går stadig til personen.

## 2026-11-10 · Glemt kode nulstilles af tovholderen
Tovholderen nulstiller en arvings kode med sin egen kode. Har tovholderen ingen kode endnu, kan det ske direkte med to tryk (kun i prototypen). Tovholderen selv får "ny kode på SMS" (efterlignet). Ønskerne bevares. I den rigtige version bekræftes det med engangslink på SMS.

## 2026-11-10 · Underskrift kræver ens egen kode
Før kunne alle skrive under for alle. Nu skal koden fra ønskerne skrives ved underskrift. Den, der ikke har en kode (fx fordi tovholderen afgav ønsker for dem), vælger en ved underskriften. Navnet på underskriften er valgfrit og bruger arvingens navn som standard.

## 2026-11-10 · PDF'en bruger Hanken Grotesk med udvidet latin
jsPDF's indbyggede Helvetica kunne kun vesteuropæiske bogstaver (Ayşe blev "Ay_e"). To statiske snit (400/700) af Hanken Grotesk, skåret ned til latin + udvidet latin (ca. 38 KB hver), hentes fra `fonts/` første gang. Arabisk, kyrillisk m.m. kan stadig ikke skrives; PDF'en laves, og en besked siger hvilke ord og peger på Kopiér.

## 2026-11-09 · Uafgjort afgøres af et lod, der ikke kan trækkes om
Før vandt den første på listen (tovholderen) ved helt lige ønsker, og siden viste grønt "Ingen misunder". Nu trækkes ét lod pr. bo ved oprettelsen; ud fra det får hver arving et fast tal pr. ting, og højeste tal vinder ved lige. Samme ønsker + samme lod = samme fordeling, også efter genindlæsning. Alt, der kunne være endt anderledes uden tab, vises åbent ("Afgjort ved lodtrækning") i resultat, fordelingsliste, kopi og PDF. Får nogen ingen af deres ønsker, siges det i et rødt kort i stedet for det grønne. Loddet ligger i browseren i prototypen; i den rigtige version trækkes og gemmes det på serveren.

## 2026-11-09 · Motoren prøver flere rækkefølger og må ikke lægge en ting i to kasser
Den første motor flyttede en ting videre til næste arving uden at stoppe, når flytningen lykkedes, så tingen kunne ende to steder (154 af 1.500 familier) og var ikke altid optimal (256 af 1.500). Nu stopper søgningen efter hver forbedring, prøver 40 startrækkefølger og bytter også hele kasser. 0 fejl af 1.500 mod udtømmende søgning.

## 2026-11-09 · Mærkesedler beholder deres nummer
Numrene fulgte pladsen på listen og skiftede, når en ting blev fjernet. Nu får hver ting sit nummer én gang for alle (`no`), og et fjernet nummer genbruges ikke.

## 2026-11-09 · Fjernes en ting, nogen har givet point, skal de fordele igen
Deres point-sum er nu under 100. De markeres som "har ikke svaret", og tovholderen får besked om hvem. I kronemetoden står bud på andre ting ved magt.

## 2026-11-09 · Alt, der sletter, kræver to tryk
"Start forfra" og "Fjern arving" bekræftes med et andet tryk inden for 4 sekunder. Dialogbokse virker ikke i artifact-visningen.

## 2026-11-09 · Besked, når browseren er fuld
Billeder gemmes som JPEG på 520 px i localStorage (ca. 40–60 KB hver, ca. 45 billeder i Chrome). Når der ikke er plads, fjernes billedet igen, resten gemmes, og en besked siger det. Den rigtige version gemmer billeder på serveren.

## 2026-11-09 · Webapp, ikke app i butikkerne
Arvingerne skal kunne komme i gang med ét tryk på et link, også en 80-årig onkel. Kan pakkes som app senere uden ombygning.

## 2026-11-09 · Pointmetoden som standard, kronemetoden som tilvalg
Point til ting med følelser i, ingen penge involveret. Kroner til værdifulde ting, hvor forskellen udlignes i arven.

## Åbne spørgsmål
- Efter første fordeling kan alle se hinandens point i forklaringerne og rette egne ønsker, før der deles igen. Skal en ny runde kræve, at alle siger ja, eller at ønskerne låses efter første visning?
- Skal tovholderen kunne afgive ønsker for en arving uden smartphone i prototypen (står i V1-listen, ikke bygget)?
- Pris: 795 kr. er et skøn. Testes med familierne.
