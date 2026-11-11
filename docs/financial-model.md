# Økonomi

*11. november 2026. Skøn. Tallene rettes, når de første familier og partnere har svaret.*

## Pris

| Produkt | Pris inkl. moms | Ekskl. moms | Note |
|---|---|---|---|
| Bo (op til 6 arvinger, 300 ting) | 795 kr. | 636 kr. | Skal testes: ville tovholderen betale? |
| Flere arvinger | +195 kr. | 156 kr. | |
| Partnerbo | 495 kr. ekskl. moms faktureret partner | 495 kr. | Familien betaler 0 |
| Mens de lever (2027) | 395 kr. | 316 kr. | V2 |

## Omkostning pr. bo

| Post | Kr. | Grundlag |
|---|---|---|
| Stripe | ca. 13 | 1,5 % + 1,80 kr. af 795 kr. (EU-kort) |
| SMS (GatewayAPI) | ca. 5–8 | 6 arvinger × (invitation + påmindelse + kode + fordeling + underskrift) ≈ 25 SMS × 0,25 kr. |
| AI-navne (Anthropic) | ca. 2–5 | 60 billeder × Haiku med billede ≈ 0,05 kr. pr. billede |
| Mail (Resend) | 0 | Under gratisgrænsen længe |
| Supabase, Netlify (andel) | ca. 1 | Fast, se nedenfor |
| **I alt** | **ca. 20–27 kr.** | |

Dækningsbidrag pr. bo: ca. 610 kr. (96 %). Pr. partnerbo: ca. 470 kr.

## Faste udgifter pr. år

| Post | Kr./år | Note |
|---|---|---|
| Supabase pro (produktion) | ca. 2.200 | 25 USD/md. Dev-projektet deler org med Zoonex; produktion bør have egen. |
| Netlify | 0–1.700 | Gratis til 100 GB; pro 19 USD/md hvis nødvendigt |
| Domæne | ca. 100 | arvora.dk |
| Resend | 0–1.700 | Gratis til 3.000 mails/md |
| Sentry eller tilsvarende | 0–2.300 | Gratis plan rækker |
| Revisor/bogføring | 3.000–6.000 | Enkeltmandsvirksomhed |
| Jurist (engang) | 8.000–15.000 | Vilkår, politik, tjekliste |
| Forsikring | 0–3.000 | Hvis juristen anbefaler det |
| **I alt år 1** | **ca. 15.000–30.000** | Uden markedsføring og uden løn |

## Scenarier (år 1 efter lancering)

| | Pessimistisk | Realistisk | Optimistisk |
|---|---|---|---|
| Boer, familien betaler | 60 | 250 | 500 |
| Partnerboer (betalte) | 20 | 150 | 400 |
| Omsætning ekskl. moms | ca. 48.000 | ca. 233.000 | ca. 516.000 |
| Variable omkostninger | ca. 2.000 | ca. 10.000 | ca. 22.000 |
| Faste | 25.000 | 25.000 | 30.000 |
| Markedsføring | 5.000 | 30.000 | 80.000 |
| **Resultat før løn og skat** | **ca. 16.000** | **ca. 168.000** | **ca. 384.000** |

Realistisk svarer til 2 boer om dagen tre dage om ugen. Markedet er skønnet til 15.000–25.000 boer om året med flere arvinger og indbo at dele (ca. 55.000 dødsfald, ca. halvdelen med flere arvinger, en del uden indbo af betydning). Realistisk = 1,5–2,5 % af markedet.

## Nulpunkt

Faste 25.000 kr. / 610 kr. pr. bo ≈ **41 boer om året**. Det er lavt, fordi der ingen løn er. Med en løn på 30.000 kr./md kræves ca. 600 boer.

## Beslutningspunkter (fra planen)

- Efter 3–5 testfamilier: fandt de fordelingen fair, og ville mindst halvdelen betale 795 kr.? Nej → pris eller produkt om.
- Efter 3 måneder: under 30 solgte boer → ny salgskanal eller stop.
- Efter 12 måneder: under 150 boer → produktet er en niche; hold det kørende billigt eller sælg det.

## Kontanter

Ingen investering nødvendig ud over jurist og det første års faste udgifter (ca. 30.000 kr.). Stripe udbetaler ugentligt. Partnere faktureres månedligt bagud.
