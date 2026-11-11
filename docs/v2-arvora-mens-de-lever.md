# V2 · Arvora mens de lever

*11. november 2026. Idé og afgrænsning. Bygges 4–6 måneder efter lancering, kun hvis tallene fra V1 er gode.*

## Idéen

Forældre (typisk 70+) fotograferer selv deres ting, mens de lever. Børnene giver ønsker. Resultatet er en fordeling, alle kender, og som kan skrives ind i et indbotestamente, så den dag det sker, er det meste allerede på plads. Det tager konflikten ud, mens der stadig er tid til at tale om den.

Slogan: *Tal om tingene, mens I kan.*

## Hvad der er anderledes end dødsboet

| | Dødsbo (V1) | Mens de lever (V2) |
|---|---|---|
| Tovholder | Et voksent barn | Forælderen (eller et barn, der hjælper) |
| Tone | Sorg, hastværk | Ro, tid. Ingen "afdøde", ingen "bo". Ordene er "jeres hjem", "jeres ting", "jeres børn". |
| Ønsker | Hemmelige | Hemmelige, men forælderen kan vælge at se resultatet med børnene |
| Fordeling | Bindende, når alle skriver under | Et forslag, der kan gemmes og laves om. Bliver bindende, når det står i et testamente (uden for Arvora) |
| Testamente | Tovholderen markerer, hvad der er testamenteret | Forælderen kan "give" en ting til et barn nu; det vises som gave og indgår ikke i fordelingen |
| Afslutning | Underskrift, PDF, slettes efter 90 dage | Ingen underskrift. Gemmes, så længe forælderen vil (årligt "vil du beholde det?"). PDF som bilag til indbotestamente |
| Pris | 795 kr. | 395 kr. |

## Hvad der allerede er bygget til det

- `estates.mode = 'live'`. Prototypen skifter ordvalg (testet i `edge.js`: "Mens de lever").
- Datamodellen er den samme. Ingen nye tabeller.
- Motoren er den samme.

## Hvad der skal bygges

1. **Ordvalg** i appen for `live`: "Opret jeres hjem", "Inviter jeres børn", "Se forslaget". Ingen "arving", måske "børn" eller "dem, der skal dele".
2. **Gaver nu**: en ting kan markeres "givet til X i dag" og tages ud af fordelingen. Juridisk: en gave er en gave; Arvora registrerer kun.
3. **Ingen underskrift, men "vi har set det"**: hver deltager trykker "set", så forælderen ved, at alle kender fordelingen.
4. **Gem og lav om**: ønsker kan ændres igen og igen; hver fordeling gemmes med dato, så familien kan se, hvad der ændrede sig.
5. **Opbevaring**: ingen automatisk sletning; årlig mail "vil du beholde det?"; slettes 6 måneder efter ubesvaret. Når forælderen dør, kan et barn konvertere til dødsbo (status `doed`) og køre det som V1 med underskrift.
6. **PDF**: "Oversigt over ønsket fordeling af indbo" med dato og forælderens navn, formuleret som bilag, ikke som testamente. Juristen skal se teksten.
7. **Forsiden**: egen side, egen tone. Målgruppe: forældre 65–80, der har oplevet et svært skifte selv, og deres børn, der køber det til dem.

## Hvad der ikke er med

Ikke juridisk testamente (henvis til advokat eller notar). Ikke værdiansættelse. Ikke arveafgift. Ikke chat.

## Risici

- Forældre, der ikke vil tale om døden. Modtræk: tonen. Produktet handler om tingene, ikke om døden.
- Børn, der bliver sårede over et forslag, mens forælderen lever. Modtræk: forælderen vælger, om resultatet vises, og kan "give" ting uden om fordelingen.
- Lang opbevaring = længere GDPR-ansvar. Modtræk: årlig bekræftelse, sletning ved tavshed.

## Beslutningspunkt

Bygges, hvis V1 efter 6 måneder har > 150 boer, og mindst 5 tovholdere uopfordret har spurgt "kunne mine forældre have brugt det her?". Ellers vent.
