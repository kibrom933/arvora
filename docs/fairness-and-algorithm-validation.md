# Fordelingsmotoren: matematik, egenskaber og validering

*11. november 2026. Gælder `engine/arvora-engine.js`, som er identisk i adfærd med motoren i `prototype/index.html` (bevist i `tests/engine-parity.js`, 1.500 familier, 0 afvigelser).*

## 1. Modellen

**Arvinger** $H$ med arvelod $w_h > 0$ (hel andel 1, halv 0,5, kvart 0,25, dobbelt 2).
**Ting** $I$. Ting med testamente ($\text{will}(i) = h$) tages ud af puljen først og går til $h$. De frie ting kaldes $F$.

### Pointmetoden

Hver arving fordeler præcis 100 point på frie ting, eller 0 point ("jeg ønsker ikke noget"). Point er hele tal 0–100. $p_h(i)$ er arvingens point på ting $i$.

**Nytte** er additiv: $u_h(A) = \sum_{i \in A_h} p_h(i)$, hvor $A_h$ er den kasse, $h$ får. Antagelsen om additivitet er en forenkling: en arving kan i virkeligheden værdsætte to ting mere sammen end hver for sig (et stel og dets kande). Grupper ("Musselmalet stel, 48 dele") er den måde, familien håndterer det på: de registrerer tingene som én ting.

**Mål:** maksimér den vægtede Nash-velfærd

$$\max_A \; \sum_{h \in H,\; u_h(A) > 0} w_h \ln u_h(A)$$

med et leksikografisk første kriterium: **flest mulige arvinger med $u_h > 0$**. (I koden: `obj = antal·10⁶ + sum`.) Uden første kriterium ville produktet være 0, så snart én arving intet fik, og alle sådanne fordelinger ville være lige dårlige; første kriterium sikrer, at motoren altid hellere giver alle noget, hvis det er muligt.

Hvorfor produktet og ikke summen? Summen af point belønner fordelinger, hvor én får alt. Produktet (logaritmesummen) straffer skæve fordelinger: at gå fra 10 til 20 point tæller lige så meget som at gå fra 40 til 80. Det er den matematiske udgave af "alle skal have mest muligt af det, der betyder mest for dem".

Vægtene $w_h$ gør, at en arving med dobbelt arvelod "må" ende med proportionalt mere. Formelt er det vægtet Nash-velfærd (Chakraborty, Igarashi, Suksompong & Zick, 2021).

**Kun ting, nogen har givet point, fordeles.** Ting med 0 point fra alle kommer på restlisten. En arving kan aldrig få en ting, hun gav 0 point (den grådige start og alle flytninger tillader det ikke, bevist i `engine-props.js`).

### Kronemetoden

Hver arving byder hele kroner $b_h(i) \ge 0$ på frie ting. Højeste bud vinder tingen til prisen $b^*(i) = \max_h b_h(i)$. Den samlede værdi $V = \sum b^*(i)$ fordeles efter arvelod: arving $h$ har ret til $V \cdot w_h / \sum w$. Forskellen mellem det, hun fik for, og hendes andel udlignes i arven (vist som "får x kr. mere/mindre"). Lige bud afgøres af loddet. Ting uden bud kommer på restlisten.

Kronemetoden er en simpel førsteprisauktion med udligning. Den er *ikke* strategisikker (man kan have gavn af at byde under sin sande værdi), og den forudsætter, at der er en arv at udligne i. Det står i produktet som "forskellen udlignes i arven". Point- og kronemetoden kan ikke blandes i samme bo.

## 2. Algoritmen

At finde maksimal Nash-velfærd for udelelige ting er NP-svært i almindelighed. Motoren er en lokal søgning med garanteret gyldigt resultat og empirisk optimalitet i de størrelser, Arvora bruger:

1. **Grådig start.** Tingene tages i rækkefølge efter højeste point; hver ting gives til den arving, hvis vægtede logaritmiske gevinst er størst. Første forsøg går gennem arvingerne i loddets rækkefølge (ikke listens), så listens rækkefølge ikke betyder noget.
2. **Forbedringer**, indtil intet bliver bedre: flyt én ting til en anden, der gav den point · byt to ting mellem to arvinger · byt to arvingers hele kasser. En flytning accepteres, hvis målet stiger, eller hvis målet er præcis lige og fordelingens "held" (sum af lodtal, se nedenfor) stiger.
3. **40 forsøg** fra forskellige startrækkefølger (6 forsøg, når ting·arvinger > 1.500). Den tilfældige rækkefølge udledes af boets lod, så den er den samme hver gang. Bedste resultat vinder; ved præcis lige resultater vinder det med størst held.

**Garanteret:** hver ønsket ting fordeles præcis én gang; ingen får ting, de gav 0 point; testamente følges; restlisten er præcis de ting, ingen ønskede; samme input giver samme output.

**Empirisk:** i 1.500 tilfældige familier (2–5 arvinger, 3–11 ting, med og uden arvelod) i `tests/solver.js` og 600 familier i `tests/engine-props.js` (udtømmende søgning som uafhængig reference) blev den optimale velfærd fundet hver gang. For 6 arvinger og 120 ting tager en fordeling ca. 4 s i Node. Over 60 ønskede ting springes den dyre byttetest for lod over (se 4).

## 3. Lodtrækning

**Ét lod pr. bo.** Et 32-bit tal trækkes med `crypto.getRandomValues` én gang, når boet oprettes, og gemmes i databasen (`estates.lod`). Det kan ikke trækkes om: kolonnen er skrivebeskyttet efter oprettelse (trigger). Alle brugere kan se loddet, når fordelingen er frigivet, og kan genberegne fordelingen selv med motoren og de låste ønsker.

**Lodtal.** Ud fra loddet får hvert par (arving, ting) et fast tal i $[0,1)$: `lodtal(lod, heirId, itemId)` er en hash (multiplikativ xorshift-blanding). Samme lod og samme id'er giver samme tal. Tallet er ikke kryptografisk, men det behøver det ikke være: loddet er hemmeligt, indtil boet er oprettet, og kan ikke ændres bagefter, så ingen kan vælge et lod, der passer dem.

**Hvornår bruges loddet?** Kun mellem fordelinger med præcis samme velfærd. Det kan ikke gøre en fordeling dårligere for nogen; det afgør kun, hvem der får hvad, når matematikken ikke kan skelne.

**Hvad vises?** Efter fordelingen testes hver placering: kunne tingen være gået til en anden, der ønskede den, uden at velfærden faldt? Kunne to ting være byttet? Kunne to hele kasser være byttet? Alt, der kunne, markeres "afgjort ved lodtrækning" med en sætning i klar tekst og gemmes som `ties` (type, ting, arvinger, vinder) i `distribution_runs` og `tie_break_records`.

**Fairness målt.** 6.000 lod med tre arvinger om samme ting: 1.989 / 1.951 / 2.060 (χ² 3,06, grænse 9,21 ved p = 0,01). Kronemetoden, lige bud: 1.990 / 2.003 / 2.007. Fire arvinger og ens ønskelister er testet i `tests/lod.js`.

**Begrænsning.** Loddet er ensartet *pr. afgørelse*, men ikke nødvendigvis ensartet over *alle* optimale fordelinger i en familie, hvor mange ting står lige på én gang (søgningen vælger blandt de fordelinger, den når frem til). Det er dokumenteret her, fordi det ikke må påstås, at alle optimale fordelinger er lige sandsynlige.

## 4. De fire tjek, præcist

| Tjek i appen | Definition | Garanti |
|---|---|---|
| **Ingen misunder de andre** | Vægtet EF1: for alle par $a \ne b$ gælder $u_a(A_a)/w_a \ge (u_a(A_b) - \max_{i \in A_b} p_a(i))/w_b$. Dvs. $a$ foretrækker ikke $b$'s kasse, når man fjerner den ene ting i $b$'s kasse, som $a$ holder mest af. | **Tjekkes**, ikke garanteret. Uvægtet MNW er altid EF1 (Caragiannis m.fl. 2016); vægtet MNW er WEF1, som er en anden egenskab. Fejler tjekket, vises det rødt, og appen foreslår kronemetoden. I 3.000 tilfældige familier stemte tjekket med en uafhængig beregning. |
| **Ingen bytning gør det bedre** | Pareto-optimalitet over flytninger af én ting og bytninger af to ting: ingen sådan ændring giver én arving mere uden at give en anden mindre. | **Følger** af, at motoren er i et lokalt maksimum for Nash-velfærd: en Pareto-forbedring ville øge produktet. Tjekket i `tests/solver.js` (0 fund i 400 familier). Fuld Pareto-optimalitet (over alle omfordelinger) følger af global MNW-optimalitet, som er empirisk, ikke bevist. |
| **Testamentet går forud** | Hver ting med `will = h` ligger i $A_h$ og indgår ikke i point, nytte eller lod. | **Garanteret** ved konstruktion. Arvora afgør ikke, om et testamente er gyldigt; tovholderen registrerer, hvad familien selv læser i det. Uklare forhold markeres "til juridisk afklaring" (se `legal-review-checklist.md`). |
| **Hvad loddet afgjorde** | Mængden af placeringer, der kunne være endt anderledes uden tab af velfærd, se afsnit 3. | **Garanteret** fuldstændig for enkeltflytninger og kasser; for bytninger af to ting kun når der er højst 60 ønskede ting (ellers springes testen over af hensyn til tid, og det vises i rapporten som "ikke testet for bytninger"). |

Tjekket "ingen misunder" er det eneste, der kan fejle. Det vises aldrig som grønt, når det er rødt.

## 5. Håndtering af dårlige input

| Situation | Motoren | Produktet |
|---|---|---|
| Arving har ikke svaret | Fordelingen kan ikke startes (server afviser). | Tovholderen ser, hvem der mangler; påmindelse. |
| 0 point i alt | Gyldigt: "ønskede ikke noget". Tæller ikke i "fik ingen af sine ønsker". | Egen knap. |
| Point ≠ 100 (fx efter at en ting er fjernet) | `validatePoints` afviser; arvingen markeres "har ikke svaret". | Besked til arving og tovholder. |
| Point på testamenteret ting | Tælles ikke med; arvingen må fordele om. | Appen fjerner feltet, når testamente sættes. |
| Halve, negative eller > 100 point; bud < 0 eller > 1 mia. | Afvises af `validatePoints`/`validateBids` og af databasens CHECK-constraints. | Kan ikke indtastes. |
| Ting fjernes efter låsning | Boet går tilbage til "åben"; alle berørte låses op (se `beslutninger.md`). | Besked. |
| Flere optimale fordelinger | Loddet, se afsnit 3. | "Afgjort ved lodtrækning". |

## 6. Test, der dækker motoren

| Fil | Kører hvor | Dækker |
|---|---|---|
| `tests/engine-parity.js` | Node + browser | Modul = prototype, 1.500 familier, begge metoder |
| `tests/engine-props.js` | Node | Invarianter (3.000), udtømmende reference (600), determinisme (300), lod-fairness (12.000 træk), 2–6 arvinger, 1–120 ting, skæve point, alle vil have det samme, kun én ønsker, testamente, "intet", ugyldige point og bud, udligning efter arvelod, ydelse |
| `tests/solver.js` | browser | 400 familier mod udtømmende søgning, EF1, Pareto-flytninger, uafgjort pr. plads på listen |
| `tests/dup.js` | browser | 2.000 familier: intet dobbelt |
| `tests/lod.js` | browser | Lod i hele brugerfladen, 6.000 træk, fire arvinger, ens lister, genindlæsning, PDF og kopi |
| `supabase/tests/rls.sql` | Postgres | At ønsker ikke kan læses af andre, før og efter frigivelse |

Motoren må ændres, når `node tests/run-all.js "engine parity" "engine props" solver dup lod` giver 0 fejl, og når paritetstesten opdateres bevidst (begge motorer ændres sammen), og ændringen beskrives i `beslutninger.md`.

## Kilder

- Caragiannis, Kurokawa, Moulin, Procaccia, Shah, Wang: *The Unreasonable Fairness of Maximum Nash Welfare* (EC 2016).
- Chakraborty, Igarashi, Suksompong, Zick: *Weighted Envy-Freeness in Indivisible Item Allocation* (AAMAS 2020 / TEAC 2021).
- Budish: *The Combinatorial Assignment Problem: Approximate Competitive Equilibrium from Equal Incomes* (JPE 2011), om EF1.
