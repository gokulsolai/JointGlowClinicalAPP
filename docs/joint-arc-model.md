# Joint Arc: how the assessment is calculated

This document explains every calculation in `app/joint-arc.html`: what goes in, what comes out, the exact weights, where each idea comes from, and what is a design choice rather than evidence. It is written for physician review before anything in the app is shown to a patient.

Line numbers refer to `app/joint-arc.html` as of 2026-10-21, after the corrections listed in section 16. The document was checked against the code by six independent review passes on that date; the corrections they produced are in section 16.

## 1. The short version

- **There is no machine learning and no trained model.** Every number comes from hand-written, deterministic rules in JavaScript that run in the browser. The same inputs always give the same outputs.
- **The rules are a prototype.** The clinical frameworks they lean on are standard (OPQRST, Kellgren–Lawrence grading, KOOS JR, Ottawa knee rule, ACR and OARSI guidelines). The specific point values, weights and curves are my design choices, picked to move in the clinically expected direction. They are not fitted to data and have not been validated against outcomes.
- **Claude (the AI) is not used for any score.** Nothing in the assessment, differential, joint age or arc calls an AI. The only AI use is the "Ask Claude" panel, which drafts text when a clinician clicks a button, and it receives the de-identified record without the patient's name.
- **The physician decides.** The app ranks possibilities and draws pictures to support a conversation. It does not diagnose.

## 2. Data flow

```
History (S)  ─┐
Exam (O)     ─┼─▶ Four-area scores ─▶ Joint health score ─▶ Joint age
Imaging (O)  ─┘        │                      │
                       ├─▶ Differential (A–D) ─▶ red flags
                       ├─▶ Knee drawing
                       └─▶ Natural decline rate ─▶ Treatment arc ─▶ projection table
                                                        │
                                                        └─▶ Recommended plan ─▶ Patient report
```

Everything downstream recalculates on every change to a field.

## 3. Inputs

### History (OPQRST)

OPQRST is the standard pain-history mnemonic taught in medical and EMS training: Onset, Provokes/Palliates, Quality, Radiation, Severity, Timing. The app maps each letter to one or two fields (`OPQRST`, line 298). The clinical point of each letter, as used by the rules:

| Letter | Fields | What the rules use it for |
|---|---|---|
| O | onset, duration | Gradual onset supports osteoarthritis; injury onset supports meniscal or ligament injury and argues against an inflammatory OA flare. Duration is recorded for the checklist and the export but used in no rule. |
| P | provokes, palliates | Stairs, chairs and squatting load the patellofemoral joint and cartilage; rest or night pain suggests inflammation. "Better with" is recorded but used in no rule. |
| Q | quality | Locking/catching and giving way are mechanical signs; swelling is an inflammatory sign; grinding points to cartilage wear. The other ticks (aching, sharp/stabbing, burning, throbbing, stiffness) are recorded but used in no rule; stiffness is scored from the morning-stiffness field under T. |
| R | radiation | Pain in the hip or groin, or travelling up the thigh, raises referred hip pain. |
| S | pain now, pain worst (0–10) | "Pain now" is the starting point for the pain curve on the arc. "Pain worst" is recorded but not used in any calculation. |
| T | morning stiffness, pattern | Stiffness of under 30 or 30–60 minutes adds to the OA flare score (the Altman 1986 ACR clinical criteria use under 30 minutes); over 60 minutes raises inflammatory arthritis; every level also adds to the synovium score (5 / 12 / 18). Night waking adds to the inflammation and bone scores. |

Also captured: prior treatments and number of steroid shots, medical conditions, pregnancy status, walking distance, stairs, and KOOS JR (a 7-item knee score, 0–100, 100 = no problems; validated in knee-replacement patients by Lyman 2016 and widely used for non-operative OA). Of these, only the steroid-shot count (a caution at three or more shots), medical conditions and pregnancy status enter any rule; prior treatments, walking distance, stairs and KOOS JR are recorded for the encounter checklist and the export only.

### Exam and imaging

Vitals, BMI (from height and weight), effusion, warmth, redness, ability to bear weight, flexion and extension deficit, crepitus, joint-line tenderness, ligament stability, McMurray test, quadriceps strength (MRC 0–5 scale; the app offers grades 1–5), alignment; imaging modality and age, Kellgren–Lawrence grade (0–4; Kellgren & Lawrence 1957), narrowest joint-space width, and listed findings. Extension deficit, diastolic blood pressure and heart rate are recorded but not scored.

### How blank fields are treated

This matters because the app can be used mid-intake.

| Field | If blank |
|---|---|
| Age | No age-based points in the cartilage score or the differential. The LDRT plan step and the under-40 caution require age to be entered; the card shows "Age not recorded" instead. The arc assumes age 50, which adds 0.34 health points a year to the natural decline (0.85 × 0.04 × 10) and lowers the LDRT early factor by 0.06 (0.12 at a 5-year start, 0.18 at 10); every curve, the projection table and the replacement timing are affected even though the LDRT plan step is suppressed. |
| KL grade | Counts as 0 in the decline rate and the early factor, and switches off the KL branch of the replacement rule. In the cartilage score, 15 points if "grinding" is reported, otherwise 5. |
| Height or weight | BMI treated as 25 (no BMI points). |
| Pain now | Arc starts from 5/10. |
| Quadriceps strength | Scored as 5/5 (0 points). |
| Side | OA code shown as M17.1- (unspecified). |

## 4. Four-area scores (`compartments`, lines 337–353)

The knee is scored in four areas, each 0–100. Points are added per finding, the total is clamped to 0–100 and rounded to the nearest whole number (the age and joint-space terms can give fractions; Maria's cartilage total of 47.9 shows as 48). The point values are design choices. The direction of each (which findings load which area) follows standard teaching about what each finding indicates.

### Joint lining and fluid (synovium)

| Finding | Points |
|---|---|
| Effusion mild / moderate / large | 15 / 30 / 45 |
| Warm to touch | 15 |
| Red skin | 5 |
| Morning stiffness <30 min / 30–60 min / >60 min | 5 / 12 / 18 |
| Quality includes "Swelling" | 10 |
| Timing includes "Wakes me at night" | 8 |
| Worse "At rest / night" | 5 |
| Imaging shows effusion / synovitis | 15 |

### Cartilage

| Finding | Points |
|---|---|
| Kellgren–Lawrence grade (0–4) | 15 × grade |
| If no KL grade entered | 15 if "Grinding / crunching", else 5 |
| Narrowest joint space < 4 mm | (4 − mm) × 8 |
| Crepitus mild / marked | 6 / 14 |
| Quality includes "Grinding / crunching" | 8 |
| Worse with stairs | 4 |
| Age over 40 | 0.3 per year over 40 (0 if age blank) |

Rationale: KL grade is the primary structural staging of knee OA, and joint-space narrowing is its radiographic surrogate for cartilage loss. Normal medial tibiofemoral joint space is roughly 4–6 mm in adults; the 4 mm threshold and the 8 points per millimetre are heuristics.

### Bone

| Finding | Points |
|---|---|
| Osteophytes | 15 |
| Subchondral sclerosis | 12 |
| Subchondral cysts | 10 |
| Bone marrow lesion | 18 |
| KL grade ≥ 3 | 15 |
| KL grade 4 | additional 10 |
| Varus or valgus alignment | 10 |
| Wakes at night | 5 |

Rationale: these are the radiographic and MRI features of bone response to overload in OA. Bone marrow lesions are weighted highest because they are associated with pain (Felson 2001) and with structural progression (Felson 2003) in the MRI literature.

### Muscles, tendons and ligaments

| Finding | Points |
|---|---|
| Quadriceps strength (MRC) | (5 − grade) × 10; blank scored as 5/5 |
| Ligament laxity (any) | 25 |
| McMurray positive | 18 |
| Locking / catching | 14 |
| Giving way | 14 |
| Meniscal tear on imaging | 20 |
| Ligament tear on imaging | 25 |
| Joint-line tenderness (either side) | 5 |
| Onset after injury or twist | 10 |
| Flexion < 110° | 8 |

Severity labels (`sevOf`, line 360): 0–19 Healthy, 20–39 Mild, 40–64 Moderate, 65–100 Severe.

## 5. Joint health score and joint age (`analyze`, lines 412–422)

```
health   = round( clamp( 100 − (0.20·syn + 0.35·cart + 0.25·bone + 0.20·sup), 5, 100 ) )
jointAge = round( clamp( 30 + (100 − health) / 1.2, 20, 99 ) )     using the rounded health score
```

The weights (0.20, 0.35, 0.25, 0.20) reflect a judgement that cartilage and bone changes are the slow, structural part of the disease and should count most toward a "how worn is this joint" number, while synovial inflammation and support problems are more treatable. They are not derived from data.

**Joint age is a presentation device, not an epidemiological measure.** A perfect joint (health 100) reads as 30 and each health point lost adds 0.83 years, capped at 99. The cap is reached at health 17, so every health score from 5 to 17 reads as 99 and the scale is flat below that; the lower clamp of 20 never applies because the minimum output is 30. The idea came from the design notes ("joint age score"). Before it goes in front of patients, it should either be calibrated against real age-matched norms (for example, from the Osteoarthritis Initiative) or be renamed to avoid implying a measurement.

Example: Maria (synthetic), scores syn 52, cart 48, bone 15, sup 15 → health = 100 − (10.4 + 16.8 + 3.75 + 3.0) = 66.05 → 66 → joint age 30 + 34/1.2 = 58.3 → 58.

Also computed here: the **main driver** (the area with the highest score; on a tie the earlier of synovium, cartilage, bone, support wins), the starting pain for the arc (pain now, or 5 if blank), and the **natural decline rate**, described in section 9.

## 6. Differential diagnosis (`differential`, lines 362–403)

Ten candidate diagnoses each have a list of rules. Each rule that fires adds its points (one rule subtracts). Only positive rules appear in the clue text under each diagnosis; the −2 injury-onset penalty on the inflammatory-flare row is applied but not listed. Candidates with a positive score are ranked, and the top four are shown as A–D. Labels: the top one is "Leading"; others are "Likely" at ≥70% of the top score, "Possible" at ≥40%, otherwise "Less likely". The percentage bar is score ÷ top score. Ties keep table order (OA flare first, septic arthritis last), so a septic score that ties the top is shown second as "Likely" with a full bar rather than "Leading"; it still carries the Urgent marker and raises the red flag.

| Diagnosis (ICD-10) | Rules (points) |
|---|---|
| Knee OA, inflammatory flare (M17.11 right / M17.12 left / M17.0 both; M17.1- if no side recorded) | age ≥40 (+2); synovium score ≥30 (+3); KL 1–3 (+2); stiffness <30 or 30–60 min (+1); gradual onset (+1); effusion on imaging (+2); **injury onset (−2)** |
| Knee OA, structural (same codes) | age ≥45 (+2); KL ≥2 (+3); osteophytes (+1); any crepitus (+1); stairs or chair pain (+1); malalignment (+1); joint space <3 mm (+2) |
| Meniscal tear (M23.2-) | locking/catching (+3); McMurray + (+3); injury onset (+2); joint-line tenderness (+1); tear on MRI (+3); squatting pain (+1) |
| Ligament injury / instability (M23.5-) | giving way (+3); laxity on exam (+4); injury onset (+2); tear on MRI (+3) |
| Patellofemoral pain (M22.2-) | stairs (+1); chairs (+1); squatting (+1); age <45 (+2); KL ≤1 (+1) |
| Pes anserine bursitis / tendinopathy (M70.5-) | medial tenderness (+1); diabetes (+1); BMI ≥30 (+1); stairs (+1); KL ≤2 (+1) |
| Gout or pseudogout (M10.- / M11.2-) | sudden onset, no injury (+3); warm (+1); red (+2); gout history (+3); chondrocalcinosis (+3) |
| Inflammatory arthritis, RA or psoriatic (M06.9 / L40.5-) | stiffness >60 min (+3); RA history (+4); psoriasis (+2); hand joints painful (+2); two or more other joints (+1) |
| Referred from hip (M25.55-) | hip/groin pain (+3); pain up the thigh (+2); hip listed as painful (+2); knee imaging near normal, KL ≤1 (+1) |
| Septic arthritis (M00.9), marked Urgent | fever/unwell (+3); temperature ≥38 °C (+3); warm (+2); red (+1); moderate/large effusion (+2); sudden onset without injury (+1); cannot bear weight (+1). Shown only when the score is ≥5 **and** there is a joint sign on exam (warm, or moderate/large effusion). |

Age rules fire only when age has been entered, and KL rules (KL 1–3, KL ≥2, KL ≤1, KL ≤2) only when a grade has been entered; a blank grade is not treated as 0, so the "little arthritis on imaging" points for patellofemoral, pes anserine and referred hip pain are not given until imaging is graded. Each row also carries a "confirm with" next step (ultrasound, MRI, aspiration, labs, hip X-ray) so the differential leads somewhere.

Worked septic examples: fever plus a warm knee = 5, shown and flagged. An acutely hot, swollen, non-weight-bearing knee without fever = 2 + 2 + 1 + 1 = 6, shown and flagged. A chronic OA knee that is warm with a moderate effusion, gradual onset, bearing weight = 4, not shown. Fever with no joint sign is not shown.

Rationale and sources: the pattern recognition here is standard clinical teaching. OA clinical criteria (age, stiffness under 30 minutes, crepitus) follow Altman 1986. Morning stiffness over an hour as an inflammatory feature follows the classic RA criteria. The septic rule follows the principle that a hot, swollen joint needs aspiration before anything else; the afebrile pathway was added because fever has a pooled sensitivity of only about 57% for septic arthritis (Margaretten 2007), so roughly four in ten septic joints are afebrile. The rule still lacks the risk factors Margaretten quantified (age over 80, diabetes, rheumatoid arthritis, recent joint surgery, a hip or knee prosthesis, especially with overlying skin infection, and HIV infection), plus recent intra-articular injection, which other sources add, because the intake does not capture most of them yet. The point values and the 70%/40% label cut-offs are mine. This is a scoring heuristic, not a Bayesian or likelihood-ratio model; it does not use published sensitivities or specificities.

## 7. Red flags (`redFlags`, lines 404–411)

Shown as an alert banner and listed first in the plan. Red flags suppress the LDRT plan step.

| Flag | Trigger |
|---|---|
| Possible joint infection | The septic arthritis row passes the differential's test (score ≥5 with a joint sign). The row is always shown among A–D when it passes (it takes the fourth slot if four other diagnoses outscore it) and is always included in the exported record, so the banner never appears without a visible row. |
| Possible fracture | cannot bear weight AND onset after injury (one of the Ottawa knee rule criteria; Stiell 1996) |
| Night pain with weight loss | unexplained weight loss AND (wakes at night OR rest/night pain) |
| Hot red joint | red skin AND sudden onset without injury |

## 8. The knee drawing (`kneeSVG` and `kneeOpts`, lines 541–600)

Two front-view knees are drawn from the same template: a healthy knee with fixed values, and the patient's knee driven by the four-area scores and specific findings. This is a schematic, not an anatomical reconstruction or an image of the patient's own X-ray.

| Visual | Driven by | Formula |
|---|---|---|
| Cartilage band thickness (blue) | cartilage score | healthy 7 px; patient 1.5 + 5.5 × (1 − cart/100). Cartilage is never tinted; its severity shows only through thickness. |
| Joint-space gap per side | cartilage band | 4 + 2 × thickness |
| Medial side thinner | medial joint-line tenderness OR varus alignment | medial thickness × 0.65 (medial compartment usually narrows first in varus OA). There is no lateral counterpart: valgus alignment or lateral-only tenderness draws both sides equal. |
| Capsule size (synovium) | synovium score | rx = 84 + 0.18 × syn, ry = 42 + 0.22 × syn |
| Area tint and colour | synovium (capsule), bone (femur and tibia) and support (quadriceps) scores | opacity 0.12 + 0.55 × score/100, none below 20; the bone overlay uses 0.8 × that value; colour by severity (green / yellow / orange / red) |
| Osteophyte spurs | bone score ≥25 | spur size 3 + bone/12 |
| Sclerosis band under the plateau | bone score ≥40 | drawn |
| Bone marrow lesion spot | finding listed | drawn, medial tibia |
| Ligament colour | support score ≥40 | severity colour, otherwise brown |
| Dashed ligament | laxity on exam | dashed line on the named ligament (MCL, LCL, ACL/PCL) |
| Meniscal tear zigzag | tear on imaging OR McMurray positive | drawn on the medial side |
| Left knee | side field | whole drawing mirrored; MEDIAL/LATERAL labels swap |

## 9. Treatment arc (`early`, `TX`, `tkaEligible`, `project`, `burden`, lines 425–496)

This is an illustrative dynamical model, not a prognosis. It exists so patients can see the shape of "act now versus wait" that the design notes describe. Every parameter below is an assumption I set.

### Natural decline (points of joint health per year)

```
decline = 0.85 × ( 0.5
                 + 0.04 × years over age 40
                 + 0.30 × KL grade
                 + 0.012 × synovium score
                 + 0.08 × BMI points over 25
                 + 0.3 if support score > 40 )
```

Rationale: age, radiographic grade, obesity and instability are widely taught risk factors for knee OA and were chosen for direction only. The published progression evidence is more mixed than that: the Bastick 2015 meta-analysis found strong evidence for baseline knee pain, Heberden's nodes and varus alignment as progression factors, and strong evidence of no association for joint laxity; synovitis and effusion as risk factors for cartilage loss come from MRI cohort studies (for example, Roemer 2011, in knees without radiographic OA at baseline). The coefficients are not from any of these papers.

What the formula gives: a 45-year-old with KL 2, mild synovitis (score 20–39), BMI 25 and no instability loses about 1.3–1.5 points a year before acceleration; the rate reaches about 2 points a year only when obesity (BMI 30) and instability are added. From a starting health of 60 such a patient crosses the end-stage band (below 40 on the chart) in 13–15 years untreated; from 70 the untreated curve ends the 20-year window at about 40–42, crossing 40 only at the top of that synovitis range. If age is blank, both this formula and the early factor use 50 (see section 3).

Decline accelerates as the joint worsens: each step multiplies by `1 + 0.4 × (points lost so far / 100)`.

### Treatment effects

Each option has a multiplier on the decline rate, a fraction of pain relieved, and a delay before relief starts. The arc runs in quarter-year steps for 20 years.

| Option | Decline multiplier | Pain relieved | Onset (yr) | Evidence note on the card |
|---|---|---|---|---|
| No treatment | 1.00 | 0 | — | OA usually progresses slowly |
| NSAIDs | 0.97 | 30% | 0 | Short-term relief; GI, renal, cardiac risk with chronic use; topical preferred (ACR 2019) |
| Steroid injections | **1.10 (faster loss)** | 25% | 0 | Guidelines recommend them for short-term relief (ACR 2019, OARSI 2019); 3-monthly triamcinolone for 2 years caused more cartilage loss than saline with no pain benefit (McAlindon 2017), so repeated courses are used cautiously. |
| Physical therapy | 1 − 0.3 × sup/100 − 0.05 | 30% | 0.15 | First-line in every guideline (ACR 2019, OARSI 2019) |
| PRP | 0.93 | 35% | 0.10 | No difference from saline at 12 months (Bennell 2021); ACR 2019 recommends against it |
| LDRT | 1 − 0.45 × (syn/100) × early | 55% × early | 0.20 | See LDRT note below |
| Stem cells | 0.96 | 30% | 0.20 | Limited, low-quality evidence; ACR 2019 strongly recommends against; not FDA-approved for OA |
| Knee replacement | special | pain → 2 after surgery | 0.5 | Strong for end-stage; about 1 in 5 dissatisfied (Bourne 2010) |

Each card also shows a one-line description, ↑/↓ chips for the four areas (`fx`, display only, used in no calculation), a "Works in" onset, a "Lasts" duration and an out-of-pocket tier. These are clinical claims shown to patients and need the same review as the evidence notes. The steroid card's description, which is always visible, says the shot is "usually given no more often than every 3 months" and that "the arc models a repeated 3-monthly course".

| Option | Works in | Lasts | Out of pocket | Chips |
|---|---|---|---|---|
| No treatment | — | — | — | none |
| NSAIDs | Days | While taking them | $ | ↑ Lining |
| Steroid injections | 1–3 days | A few weeks; usually faded by 4–6 weeks | $ | ↑ Lining, ↓ Cartilage |
| Physical therapy | 4–8 weeks | As long as exercises continue | $$ | ↑ Muscles |
| PRP | 4–6 weeks | Unclear | $$$ | ↑ Lining |
| LDRT | Builds over 6–12 weeks | Varies; long-term data come from uncontrolled series; a second course is sometimes given | $$ | ↑ Lining |
| Stem cells | 1–3 months | Unclear | $$$$ | ↑ Lining |
| Knee replacement | 3–6 months recovery | Most implants last 15–20+ years | Insurance; high total cost | ↑ Lining, ↑ Cartilage, ↑ Bone |

Chip labels are the short area names (Lining, Cartilage, Bone, Muscles). On the quarter-year grid every non-surgical onset (0 to 0.2 years) resolves to the same first step after the start line, so relief for all seven non-surgical options begins 0.25 years after the start, and the decline multiplier also begins at that step; the onset values differ only in the card text, not on the arc or in the table.

**The "early intervention" factor** (`early`, line 425):

```
early = 1 − 0.15 × KL grade − 0.012 × years over age 45 at the start of treatment     clamped to 0.3–1.0
```

This is what makes LDRT look better for patients who are younger and at a lower KL grade when treatment starts. It encodes the hypothesis in the design notes that calming synovitis helps most before structural damage sets in. It is a hypothesis, not a finding, and it is the single biggest assumption in the app. The "start now / in 5 / in 10 years" toggle delays when the multiplier and relief begin and ages the patient by the delay inside `early`; the KL grade is not advanced because the app has no model of grade progression. On the arc, the cost of waiting is therefore the untreated, accelerating decline before the start line plus a smaller early factor.

**LDRT evidence, as stated on the card:** uncontrolled German series (Keller 2013 is the example named) report pain improvement in a majority of patients, using 0.5–1 Gy fractions to 3–6 Gy; without a sham group the placebo contribution is unknown. A small sham-controlled knee trial (55 patients, 6 × 1 Gy) found no difference from sham at 3 months (Mahler 2019); a companion hand trial was also negative (Minten 2018). The card states that the clinic's 4.5 Gy in 10 fractions schedule has not been studied in those reports, and that evidence is still developing. The card's description says LDRT is "thought to reduce inflammation in the joint lining; shown in laboratory studies, not yet confirmed in controlled trials in patients", because both Dutch trials measured synovial inflammation on imaging and found no change.

**The LDRT decline multiplier is a model assumption with no human evidence behind it.** No trial has shown that LDRT slows radiographic or MRI progression of knee OA. The chart note says so. The LDRT card's chips show only ↑ Lining for the same reason, and the physical-therapy card shows only ↑ Muscles because exercise trials show pain and function benefit, not cartilage protection.

**Knee replacement** (`tkaEligible`, line 461): offered as "indicated now" when KL ≥3 and health <50, or health <38. On the arc, replacement resets health to 82, after which it declines 0.4 points a year (implant wear), and pain drops to 2. For the six months before the reset (starting at the first step after today, so "pain now" in the table is always the recorded pain), pain is raised by 2 to represent the pre-operative and recovery period. If not currently eligible, the arc runs the untreated curve from today (the start-delay toggle is ignored on this path), finds the first quarter-year step at which health is at or below 35, and places the reset 0.5 years after that point; if the untreated curve never reaches 35 within 20 years, no replacement is drawn and the replacement curve is identical to no treatment.

### Pain and function curves

```
pain(t)     = pain now + 0.08 × (health lost since today)      clamped 0–10
              × (1 − relief) once treatment has taken effect
function(t) = 0.55 × health + 45 × (1 − pain/10)                0–100
```

Function is a made-up composite for the projection table, not KOOS JR. If KOOS JR is recorded at follow-ups, the real score should replace it. The table shows pain and function today → 3 years, joint health at 10 and 20 years, and 3-year visits, hours and time cost.

### Visit and time burden (`burden`, lines 492–496)

Visits over 3 years = first-year visits + 2 × later-year visits. Hours = visits × hours per visit, plus 240 h recovery for replacement. Time cost = hours × the hourly value the clinician enters (default $40).

| Option | Visits yr 1 | Visits per later yr | 3-yr visits | h per visit | 3-yr hours |
|---|---|---|---|---|---|
| No treatment | 1 | 1 | 3 | 2 | 6 |
| NSAIDs | 2 | 2 | 6 | 2 | 12 |
| Steroid injections | 5 | 5 | 15 | 2 | 30 |
| Physical therapy | 16 | 4 | 24 | 1.5 | 36 |
| PRP | 3 | 1 | 5 | 2 | 10 |
| LDRT | 15 | 1 | 17 | 1.25 | 21 |
| Stem cells | 2 | 0.5 | 3 | 2 | 6 |
| Knee replacement | 30 | 1 | 32 | 2 | 64, or 304 with the 240 h recovery |

The 240 h is added only when the patient is replacement-eligible today. For a patient who is not yet eligible, the replacement row shows 32 visits and 64 h with no recovery time even though the arc still places a replacement later; this should be reworked when the burden model is revisited. The LDRT visit count follows the course in the discovery document (consult, simulation, 10 fractions, follow-ups); the others are typical schedules. All are estimates.

## 10. Plan and cautions (`cautions`, lines 453–460; `planSteps`, lines 497–514)

Plan steps appear in this order when their condition holds:

1. Resolve red flags (any flag).
2. Orthopedic / sports medicine review (leading diagnosis is meniscal or ligament).
3. **LDRT** when all of: age entered and ≥40, pregnancy not recorded as "Yes" or "Unsure", no prior radiation to this knee, osteoarthritis is the leading or second diagnosis, and no red flags. The text names the radiation oncology consult (CPT 77263), states that the prescription is set by the physician, and quotes the protocol most often seen in charts, 4.5 Gy in 10 fractions over 2–3 weeks. Other painful joints listed by the patient, except the spine, are added to the same step.
4. Simulation and mapping X-rays (CPT 77290), with LDRT.
5. Weight-bearing X-rays when there is no imaging or it is over 12 months old.
6. Physical therapy, 6–8 weeks of quadriceps and hip strengthening, when support score ≥25 or cartilage score ≥40.
7. Weight management when BMI ≥30 (each kilogram lost removes about four kilograms of knee load per step; Messier 2005).
8. Surgical opinion when replacement-eligible.
9. Track outcomes at 6 weeks, 3, 6 and 12 months. Always included.

The clinician can untick any step. Unticked steps are dropped from the patient report and from the de-identified record's `plan` list; the record does not say that a step was suggested and removed, so the exported plan is the clinician's edited plan, not the raw rule output.

Patient-specific cautions on the option cards: NSAIDs with GI bleed, kidney disease, blood thinners or heart disease; steroid shots with diabetes or three or more prior shots; LDRT when age is not recorded, under age 40, possible pregnancy ("Yes" or "Unsure"), or prior radiation to the knee; replacement when not yet indicated. The age-40 line for LDRT follows the general practice of avoiding radiation for benign disease in younger patients; the clinic's own policy should replace it.

## 11. Encounter checklist (`REQ`, lines 517–537)

Nineteen items a complete consult note needs, each with the plain-language question to ask. They cover age, OPQRST, prior treatment, history, pregnancy status, function baseline, laterality, vitals, height and weight, swelling, range of motion, stability, imaging with KL grade, and consent.

Completion rules: Onset needs both onset and duration; "Worse / better with" is met by either a provoking or a palliating factor; Severity needs only today's pain (worst pain is asked but not required); Timing is met by either morning stiffness or a timing pattern; Function is met by either walking distance or KOOS JR; Vitals need systolic BP, heart rate and temperature (diastolic is not checked); Swelling needs both effusion and warmth recorded; Imaging needs a modality other than "None yet" and a KL grade; Consent is met by "Discussed" or "Signed". The pregnancy item is satisfied automatically when sex is anything other than "Female" (including blank) or age is 55 or over; it only prompts for patients recorded as Female whose age is under 55 or not yet entered, and the 55-year cut-off is a design choice.

The list is a first draft of the billing and documentation criteria the design notes mention; the clinic's billing requirements should replace it.

## 12. De-identified record (`hash`, `deid`, lines 763–782)

What the export does:
- The name and sex are hashed (FNV-1a) into a codename such as "Banana-4127". The same name and sex always give the same codename, which links encounters in this prototype; a misspelled name breaks the link, and two patients with the same name and sex collide. A stable identifier such as a medical record number should replace the name as the hash input.
- Age becomes a five-year band; BMI becomes a band. The assessment block exports the four area scores, `joint_health` and `joint_age` (joint age is a fixed function of joint health, so exporting it adds no information), the top three differential rows plus the septic row whenever it passes (id, ICD-10 code and label), and the red-flag names.
- The only location captured is the free-text Country box, exported as typed; no city or address field exists, but a city typed into that box would be exported.
- No dates are captured. The record carries a constant `encounter: 1` and `day_offset: 0` as placeholders for a future multi-encounter format, and imaging age is exported in months as entered.

This follows the spirit of HIPAA Safe Harbor but has not been reviewed by a compliance lead. Rare combinations (age band, country, a rare condition) can still identify someone.

## 13. Sources

Clinical frameworks and guidelines:
- OPQRST pain-history mnemonic (standard medical and EMS teaching).
- Kellgren JH, Lawrence JS. Radiological assessment of osteo-arthrosis. *Ann Rheum Dis* 1957;16:494–502.
- Altman R, et al. Development of criteria for the classification and reporting of osteoarthritis: classification of osteoarthritis of the knee. *Arthritis Rheum* 1986;29:1039–49.
- Lyman S, et al. Validation of the KOOS, JR: a short-form knee arthroplasty outcomes survey. *Clin Orthop Relat Res* 2016;474:1461–71.
- Stiell IG, et al. Prospective validation of a decision rule for the use of radiography in acute knee injuries. *JAMA* 1996;275:611–15 (Ottawa knee rule).
- Margaretten ME, et al. Does this adult patient have septic arthritis? *JAMA* 2007;297:1478–88.
- Kolasinski SL, et al. 2019 ACR/Arthritis Foundation guideline for the management of osteoarthritis of the hand, hip, and knee. *Arthritis Care Res* 2020;72:149–62. Positions used in the app: exercise strongly recommended; topical NSAIDs before oral for the knee; intra-articular glucocorticoid injection strongly recommended; PRP and stem-cell injections strongly recommended against.
- Bannuru RR, et al. OARSI guidelines for the non-surgical management of knee, hip, and polyarticular osteoarthritis. *Osteoarthritis Cartilage* 2019;27:1578–89.

Trials and studies cited on the option cards and in the plan:
- McAlindon TE, et al. Effect of intra-articular triamcinolone vs saline on knee cartilage volume and pain. *JAMA* 2017;317:1967–75.
- Bennell KL, et al. Effect of intra-articular platelet-rich plasma vs placebo injection on pain and medial tibial cartilage volume (RESTORE). *JAMA* 2021;326:2021–30.
- Mahler EAM, et al. Effectiveness of low-dose radiation therapy on symptoms in patients with knee osteoarthritis: a randomised, double-blinded, sham-controlled trial. *Ann Rheum Dis* 2019;78:83–90.
- Minten MJM, et al. Lack of beneficial effects of low-dose radiation therapy on hand osteoarthritis symptoms and inflammation: a randomised, blinded, sham-controlled trial. *Osteoarthritis Cartilage* 2018;26:1283–90. (Journal corrected from an earlier draft; verify.)
- Keller S, et al. Efficacy of low-dose radiotherapy in painful gonarthrosis: experiences from a retrospective East German bicenter study. *Radiat Oncol* 2013;8:29. The exact response rate reported should be taken from the paper; the app now says "a majority" rather than a figure.
- Messier SP, et al. Weight loss reduces knee-joint loads in overweight and obese older adults with knee osteoarthritis. *Arthritis Rheum* 2005;52:2026–32.
- Bourne RB, et al. Patient satisfaction after total knee arthroplasty: who is satisfied and who is not? *Clin Orthop Relat Res* 2010;468:57–63.

Progression evidence behind the decline formula (direction only, not coefficients):
- Felson DT, et al. The association of bone marrow lesions with pain in knee osteoarthritis. *Ann Intern Med* 2001;134:541–49.
- Felson DT, et al. Bone marrow edema and its relation to progression of knee osteoarthritis. *Ann Intern Med* 2003;139:330–36.
- Bastick AN, et al. What are the prognostic factors for radiographic progression of knee osteoarthritis? A meta-analysis. *Clin Orthop Relat Res* 2015;473:2969–89.
- Roemer FW, et al. Presence of MRI-detected joint effusion and synovitis increases the risk of cartilage loss in knees without osteoarthritis at 30-month follow-up: the MOST study. *Ann Rheum Dis* 2011;70:1804–09. (Verify.)
- Ott OJ, Niewald M, Weitmann HD, et al. DEGRO guidelines for the radiotherapy of non-malignant disorders. Part II: painful degenerative skeletal disorders. *Strahlenther Onkol* 2015;191:1–6. (Verify pages.)

Regimen note: the German series and the DEGRO guideline on benign-disease radiotherapy (Ott 2015) use 0.5–1.0 Gy per fraction to 3–6 Gy total, and both Dutch sham trials used 6 × 1 Gy. The clinic's 4.5 Gy in 10 fractions schedule (0.45 Gy per fraction) is not the regimen behind the published figures, and the app says so.

JointGlow material:
- PAteam × JointGlow, *LDRT Clinic Workflow, as We Understand It* (Discovery, October 2026): the 4.5 Gy / 10 fraction protocol, CPT codes, visit sequence, tissue-depth measurement.
- The founder's design notes and transcript (OPQRST intake, four areas of the knee, joint age, treatment arc, 10-encounter data model).

**Caveat on citations:** these references were written from memory in a cloud session whose network policy blocks general web access, so I could not open the papers to confirm page numbers or exact figures. A second, independent pass from memory agreed with all of them except the Minten journal, which has been corrected. Every citation should still be checked against the primary source before it appears in patient-facing material.

## 14. Known limitations

1. **No validation.** No parameter has been tested against real outcomes. Joint age, the health score and the arc could be wrong in direction or magnitude for a given patient.
2. **Additive points, no interactions.** The scores add up findings; they do not model that, for example, an effusion means something different after an injury than in long-standing OA.
3. **Knee only.** Other joints are captured as a list and only affect the differential (hand, hip) and the LDRT plan text.
4. **No imaging analysis.** Findings are entered by a person; the app does not read X-rays.
5. **Browser storage only.** Records live in the clinician's browser until exported. There is no database, audit trail or multi-user access.
6. **Synthetic examples.** The three example patients are invented.
7. **Septic arthritis rule is incomplete.** It lacks the risk factors (recent injection or surgery, prosthetic joint, skin infection, immunosuppression) that the intake does not yet capture.
8. **Replacement burden** for patients not yet eligible is inconsistent with the arc (section 9).

## 15. What to review and how to make it real

For Dr. Thomas:
- The point tables in sections 4 and 6: are any findings weighted in the wrong direction or missing?
- The LDRT effect size and the "early" factor in section 9: what effect, onset and duration would the clinic be comfortable showing, and should the arc show any structural (disease-modifying) effect at all?
- The replacement-eligibility rule and the age-40 LDRT line.
- The wording of every evidence note and card description.

To replace heuristics with evidence over time:
- Record KOOS JR, pain and walking distance at each of the ten encounters (the Data tab already lists them) and compare with what the arc predicted.
- Replace the natural decline formula with a published progression model (for example, models derived from the Osteoarthritis Initiative) once the inputs it needs are captured.
- Calibrate joint age against age-stratified health-score norms, or drop the age framing.
- Validate the differential rules against the physician's final diagnoses on real encounters.
- Add the septic-arthritis risk factors to the intake.

## 16. Changes made after verification (2026-10-21)

Six review passes compared the first draft of this document with the code and checked the citations. Besides the wording corrections absorbed above, they found four problems in the app itself, now fixed:

1. **Blank age.** The differential treated a blank age as 0 (adding "younger age" points) while the plan and cautions treated it as 50 (passing the LDRT age gate). Now no age rule fires without an age, the LDRT step requires an age, the LDRT card says "Age not recorded", and the checklist asks for age.
2. **De-identified record leaked exact age.** `joint_age_delta` (joint age minus actual age) could be combined with `joint_health` to recover the age. The record now exports `joint_age` instead. Age was also removed from the codename hash so a birthday no longer changes the codename.
3. **Infection flag and septic row disagreed, and neither could fire without fever.** Both now use one test (septic score ≥5 with a joint sign), and an acutely hot, swollen, non-weight-bearing knee reaches it without fever.
4. **Delayed start ignored ageing.** The "start in 5 / 10 years" toggle did not change the LDRT effect. The early factor now uses the patient's age at the start of treatment.

Card wording was also corrected: LDRT no longer claims to "calm the inflamed joint lining" as fact, no longer gives a 60–80% response figure or a "1–2 years" duration, and states that the clinic's 4.5 Gy in 10 fractions schedule has not been studied in the reports it cites; steroid injections now cite the guideline recommendation for them; PRP and stem-cell cards cite the ACR 2019 recommendations against; the LDRT structural effect on the arc is labelled as a model assumption.

A second pass (23 further items, nearly all precision in this document) led to these further code changes: the synovium chip label read "Joint" (the first word of the area name) and now reads "Lining"; the physical-therapy card no longer shows an "↑ Cartilage" chip; the steroid card says "usually given no more often than every 3 months" and "a few weeks; usually faded by 4–6 weeks"; the PRP card gives the trial size and the strength of the ACR recommendation; the septic arthritis row is always shown and exported when it passes its test; and the replacement row's "pain now" no longer includes the pre-operative +2.
