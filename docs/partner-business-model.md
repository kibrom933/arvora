# Partnermodel

*11. november 2026. Bedemænd, advokater og bobestyrere møder familien, når det sker. De er salgskanalen før annoncer.*

## Hvorfor partnere

Familien leder ikke efter Arvora. De leder efter en bedemand. Bedemanden sidder med dem i den uge, hvor spørgsmålet "hvad gør vi med tingene?" kommer op. Én sætning fra bedemanden ("der findes en tjeneste til det") er mere værd end tusind klik på en annonce.

## Tilbuddet til partneren

| | |
|---|---|
| Pris | 495 kr. ekskl. moms pr. bo, der bliver brugt (mindst én arving har svaret). Ikke pr. kode udleveret. |
| Gratis | De første 3 måneder efter aftalen, uanset antal. |
| Familien betaler | Intet. Boet er partnerens gave til familien. |
| Partneren får | En kode (fx `BEGRAV01`), en lille folder/kort til familien, en månedlig oversigt: koder brugt, boer afsluttet, uden navne. |
| Hvad partneren ikke får | Indsigt i boet, ønsker, arvinger eller fordeling. Aldrig. |
| Afregning | Månedlig faktura bagud. Betalingsfrist 14 dage. |
| Opsigelse | Løbende måned + 1 måned, begge veje. |

Alternativ, der testes samtidig: **partneren videregiver kun koden, familien betaler selv** med 100 kr. rabat (695 kr.), og partneren får intet. Lettere for advokater, der ikke må modtage henvisningshonorar (se juristens tjekliste pkt. 13).

## Hvem

1. **Bedemænd** (ca. 700 i DK, mange små). Først. De har kontakten, de har brug for noget at tilbyde, og de er vant til at videreformidle tjenester (blomster, stenhugger).
2. **Advokater med dødsboer**. De møder konflikten. Men henvisningshonorar kan være et problem; rabatmodellen er sikrere.
3. **Bobestyrere**. Samme. Mere interesserede i, at fordelingen kan dokumenteres (PDF).
4. **Senere:** plejehjem (mens de lever), rydningsfirmaer (restlisten), banker (arv).

## Mål

10 partnere på 3 måneder, i ejerens eget område først (man kan møde op). Mål pr. partner: 2–4 boer om måneden. 10 partnere × 3 boer × 495 kr. ≈ 15.000 kr. om måneden efter gratisperioden.

## Hvad partneren skal kunne i produktet (V1: minimum)

- Koden virker ved "Opret bo" (bygget: `partner_referrals`).
- Partneren får en mail hver måned med tallene (ikke bygget; `housekeeping` kan sende den fra `partner_referrals`).
- En partnerside i appen med tallene (V2; tabellerne findes).

## Materiale til partneren

- Et kort i A6, der ligger på bedemandens bord: "Del tingene, ikke familien. Spørg os om Arvora." Kode på bagsiden.
- En side på arvora.dk/partner med det samme som ovenfor og en formular (mail til ejeren). Indtil appen findes, en mail.
- Et eksempel på en fordelingsliste (PDF fra demoen), så partneren kan vise, hvad familien ender med.

## Det, ejeren skal gøre

Ringe til 2 bedemænd (findes i `owner-action-list.md`), spørge: Får I spørgsmålet om indbo? Hvad siger I i dag? Ville I give familien en kode? Hvad skulle der til? Derefter rette modellen efter svarene.
