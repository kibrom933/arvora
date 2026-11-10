# Testrapport for prototypen

*9.–10. november 2026. Alle test ligger i `tests/` og kan køres igen med `npm test`.*

## Resultat

| Pakke | Hvad | Resultat |
|---|---|---|
| Gennemgang (happy) | Hele forløbet som en familie: ting, billede, omdøb, filter, arvinger, kode, point, lås/giv videre, afgiv, del, forklaring, underskrift med kode, kopiér, PDF. Computer og iPhone 13, lyst og mørkt tema. | 49 trin × 4 varianter, alle består |
| Kanttilfælde (edge) | Metodeskift, alle vil have samme ting, arving uden ønsker, fjern arving, "Afgiv ønsker som Lars", ordvalg i "Mens de lever", kronemetoden ende til ende, fuld browser, iPhone SE med lange navne og 7 arvinger, ændringer efter underskrift, Start forfra, glemt kode, underskrift for andre, HTML i navne, emoji, trinlinje på telefon, AI-navne (stedfortræder for Claude), kun testamenteret gods, ingen ting, reduceret bevægelse | 38 består |
| Rettelser (fixes) | Gammel gemt tilstand loader, fjern arving (to tryk, udløber efter 4 s, frigiver testamente), Start forfra to tryk, kopiér uden udklipsholder, fuld browser ved billede, omdøb-felt, slettet ting med point, numre efter sletning og genindlæsning, metodeskift bevarer underskrifter, PDF med ikke-danske navne | 30 består |
| Lodtrækning (lod) | 6.000 træk med 3 arvinger om samme ting: vandt 1.986 / 2.024 / 1.990 gange (χ² 0,4). Kronemetoden 1.994 / 1.959 / 2.047. Fire arvinger jævnt. Ens ønskelister: bedste kasse jævnt fordelt. Samme lod → samme resultat, også ved ny rækkefølge på listen. 1.200 familier: stadig bedste fordeling, intet dobbelt, alle uafgjorte vist, vinderen har altid højeste lodtal. Eksempelfamilien har ingen uafgjorte. Besked før og efter, kopi og PDF, telefon, mørkt tema. | 36 består |
| Forfinelser (refine) | "Jeg ønsker ikke noget" (knap kun ved 0 point, resultat, forklaring, kopi, metodeskift, fortryd), glemt kode (tre veje), underskrift med kode (fejl, forkert, rigtig, vælg kode, kode virker bagefter, telefon), PDF (Ayşe, Łukasz, Nguyễn Đặng, İzmir, Ščepán intakte; arabisk → besked; skrifter mangler → Helvetica + besked) | 42 består |
| Motor (solver, dup) | 1.500 tilfældige familier (2–5 arvinger, 3–11 ting, også ulige arvelod) mod udtømmende søgning: 0 ikke-optimale, 0 EF1-brud, 0 ting i to kasser, 0 tabte ting. 2.000 familier: 0 dubletter. 8 arvinger × 300 ting på ca. 0,3 s. | består |

**I alt 344 testtrin, 0 fejl.**

## Fundet og rettet undervejs

1. **Motoren lagde samme ting i to kasser** i 154 af 1.500 familier og var ikke optimal i 256. Årsag: en flytning, der lykkedes, blev ikke stoppet, så tingen gik videre til næste arving. Rettet med `break`, flere startrækkefølger og bytning af hele kasser.
2. **Numre skiftede**, når en ting blev fjernet. Nu faste.
3. **Metodeskift** markerede en arving som "afgivet" uden at have svaret.
4. **Slettet ting med point** efterlod arvingen med under 100 point uden besked.
5. **"Afgiv ønsker som Lars"** åbnede den, der sidst havde telefonen.
6. **Fjern arving** fandtes ikke; en fejltilføjet arving blokerede alt.
7. **Start forfra** slettede alt med ét tryk.
8. **Fuld browser** holdt op med at gemme uden besked (ca. 45 billeder).
9. **Telefon**: underskriftsfelt ud over skærmen, trinlinje rullede ikke med, stempel gav et sideværts hop, navne svære at læse i mørkt tema.
10. **Uafgjort** gik altid til den første på listen, og siden påstod "Ingen misunder". Nu lod og ærlig besked.
11. **Arving uden ønsker** kunne ikke svare. Nu "Jeg ønsker ikke noget".
12. **Glemt kode** kunne ikke nulstilles. Nu via tovholderen.
13. **Underskrift** krævede ingen kode. Nu egen kode.
14. **PDF** skrev Ayşe som "Ay_e". Nu udvidet latin.

## Ikke testet herfra
- AI-navne fra rigtige billeder (kun med stedfortræder) og PDF-download i den rigtige artifact-visning. Prøv med to-tre billeder på telefonen.
- Rigtige familier. Det er næste skridt, før der bruges penge.
