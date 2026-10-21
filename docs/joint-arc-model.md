# Joint Arc: how the assessment is calculated

This document explains every calculation in `app/joint-arc.html`: what goes in, what comes out, the exact weights, where each idea comes from, and what is a design choice rather than evidence. It is written for physician review before anything in the app is shown to a patient.

Line numbers refer to `app/joint-arc.html` as of 2026-10-21.

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
                       ├─▶ Differential (A–D) + red flags
                       ├─▶ Knee drawing
                       └─▶ Natural decline rate ─▶ Treatment arc ─▶ 3-year table
                                                        │
                                                        └─▶ Recommended plan ─▶ Patient report
```

Everything downstream recalculates on every change to a field.

## 3. Inputs

### History (OPQRST)

OPQRST is the standard pain-history mnemonic taught in medical and EMS training: Onset, Provokes/Palliates, Quality, Radiation, Severity, Timing. The app maps each letter to one or two fields (`OPQRST`, line 298). The clinical point of each letter, as used by the rules:

| Letter | Fields | What the rules use it for |
|---|---|---|
| O | onset, duration | Gradual onset supports osteoarthritis; injury onset supports meniscal or ligament injury and argues against an inflammatory OA flare. |
| P | provokes, palliates | Stairs, chairs and squatting load the patellofemoral joint and cartilage; rest or night pain suggests inflammation. |
| Q | quality | Locking/catching and giving way are mechanical signs; swelling and stiffness are inflammatory signs; grinding points to cartilage wear. |
| R | radiation | Pain in the hip or groin, or travelling up the thigh, raises referred hip pain. |
| S | pain now, pain worst (0–10) | Starting point for the pain curve on the arc. |
| T | morning stiffness, pattern | Stiffness under 30 minutes fits OA (Altman 1986 ACR clinical criteria); over 60 minutes raises inflammatory arthritis. Night waking adds to the inflammation and bone scores. |

Also captured: prior treatments and number of steroid shots, medical conditions, pregnancy status, walking distance, stairs, and KOOS JR (a validated 7-item knee outcome score, 0–100, 100 = no problems; Lyman 2016).

### Exam and imaging

Vitals, BMI (from height and weight), effusion, warmth, redness, ability to bear weight, flexion and extension deficit, crepitus, joint-line tenderness, ligament stability, McMurray test, quadriceps strength (MRC 1–5), alignment; imaging modality and age, Kellgren–Lawrence grade (0–4; Kellgren & Lawrence 1957), narrowest joint-space width, and listed findings.

## 4. Four-area scores (`compartments`, lines 337–353)

The knee is scored in four areas, each 0–100. Points are added per finding and the total is clamped to 0–100. The point values are design choices. The direction of each (which findings load which area) follows standard teaching about what each finding indicates.

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
| Age over 40 | 0.3 per year over 40 |

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

Rationale: these are the radiographic and MRI features of bone response to overload in OA. Bone marrow lesions are weighted highest because they are associated with pain and progression in the MRI literature (for example, Felson 2001).

### Muscles, tendons and ligaments

| Finding | Points |
|---|---|
| Quadriceps strength (MRC) | (5 − grade) × 10 |
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

## 5. Joint health score and joint age (`analyze`, lines 410–420)

```
health  = 100 − (0.20·syn + 0.35·cart + 0.25·bone + 0.20·sup)      clamped to 5–100
jointAge = 30 + (100 − health) / 1.2                                clamped to 20–99
```

The weights (0.20, 0.35, 0.25, 0.20) reflect a judgement that cartilage and bone changes are the slow, structural part of the disease and should count most toward a "how worn is this joint" number, while synovial inflammation and support problems are more treatable. They are not derived from data.

**Joint age is a presentation device, not an epidemiological measure.** It is a straight-line rescaling of the health score so that a perfect joint reads as 30 and the worst reads as 99. The idea came from the design notes ("joint age score"). Before it goes in front of patients, it should either be calibrated against real age-matched norms (for example, from the Osteoarthritis Initiative) or be renamed to avoid implying a measurement.

Example: Maria (synthetic), scores syn 52, cart 48, bone 15, sup 15 → health = 100 − (10.4 + 16.8 + 3.75 + 3.0) = 66 → joint age 58.

Also computed here: the **main driver** (the area with the highest score) and the **natural decline rate**, described in section 9.

## 6. Differential diagnosis (`differential`, lines 362–399)

Ten candidate diagnoses each have a list of rules. Each rule that fires adds its points (one rule subtracts). Candidates with a positive score are ranked, and the top four are shown as A–D. Labels: the top one is "Leading"; others are "Likely" at ≥70% of the top score, "Possible" at ≥40%, otherwise "Less likely". The percentage bar is score ÷ top score.

| Diagnosis (ICD-10) | Rules (points) |
|---|---|
| Knee OA, inflammatory flare (M17.11 / M17.12 / M17.0 by side) | age ≥40 (+2); synovium score ≥30 (+3); KL 1–3 (+2); stiffness <30 or 30–60 min (+1); gradual onset (+1); effusion on imaging (+2); **injury onset (−2)** |
| Knee OA, structural (same codes) | age ≥45 (+2); KL ≥2 (+3); osteophytes (+1); any crepitus (+1); stairs or chair pain (+1); malalignment (+1); joint space <3 mm (+2) |
| Meniscal tear (M23.2-) | locking/catching (+3); McMurray + (+3); injury onset (+2); joint-line tenderness (+1); tear on MRI (+3); squatting pain (+1) |
| Ligament injury / instability (M23.5-) | giving way (+3); laxity on exam (+4); injury onset (+2); tear on MRI (+3) |
| Patellofemoral pain (M22.2-) | stairs (+1); chairs (+1); squatting (+1); age <45 (+2); KL ≤1 (+1) |
| Pes anserine bursitis / tendinopathy (M70.5-) | medial tenderness (+1); diabetes (+1); BMI ≥30 (+1); stairs (+1); KL ≤2 (+1) |
| Gout or pseudogout (M10.- / M11.2-) | sudden onset, no injury (+3); warm (+1); red (+2); gout history (+3); chondrocalcinosis (+3) |
| Inflammatory arthritis, RA or psoriatic (M06.9 / L40.5-) | stiffness >60 min (+3); RA history (+4); psoriasis (+2); hand joints painful (+2); two or more other joints (+1) |
| Referred from hip (M25.55-) | hip/groin pain (+3); pain up the thigh (+2); hip listed as painful (+2); knee imaging near normal, KL ≤1 (+1) |
| Septic arthritis (M00.9), marked Urgent | fever/unwell (+3); temperature ≥38 °C (+3); warm (+1); red (+1); moderate/large effusion (+1). Shown only when score ≥5. |

Each row also carries a "confirm with" next step (ultrasound, MRI, aspiration, labs, hip X-ray) so the differential leads somewhere.

Rationale and sources: the pattern recognition here is standard clinical teaching. OA clinical criteria (age, stiffness under 30 minutes, crepitus) follow Altman 1986. Morning stiffness over an hour as an inflammatory feature follows the classic RA criteria. The septic arthritis rule follows the principle that a hot, swollen joint with fever needs aspiration before anything else (Margaretten 2007). The point values and the 70%/40% label cut-offs are mine. This is a scoring heuristic, not a Bayesian or likelihood-ratio model; it does not use published sensitivities or specificities.

## 7. Red flags (`redFlags`, lines 401–409)

Shown as an alert banner and listed first in the plan.

| Flag | Trigger |
|---|---|
| Possible joint infection | (fever/unwell OR temperature ≥38 °C) AND (warm OR moderate/large effusion) |
| Possible fracture | cannot bear weight AND onset after injury (one of the Ottawa knee rule criteria; Stiell 1996) |
| Night pain with weight loss | unexplained weight loss AND (wakes at night OR rest/night pain) |
| Hot red joint | red skin AND sudden onset without injury |

## 8. The knee drawing (`kneeSVG`, lines 537–591)

Two front-view knees are drawn from the same template: a healthy knee with fixed values, and the patient's knee driven by the four-area scores and specific findings. This is a schematic, not an anatomical reconstruction or an image of the patient's own X-ray.

| Visual | Driven by | Formula |
|---|---|---|
| Cartilage band thickness (blue) | cartilage score | healthy 7 px; patient 1.5 + 5.5 × (1 − cart/100) |
| Joint-space gap per side | cartilage band | 4 + 2 × thickness |
| Medial side thinner | medial joint-line tenderness OR varus alignment | medial thickness × 0.65 (medial compartment usually narrows first in varus OA) |
| Capsule size (synovium) | synovium score | rx = 84 + 0.18 × syn, ry = 42 + 0.22 × syn |
| Area tint and colour | each area's score and severity label | tint opacity 0.12 + 0.55 × score/100, none below 20; colour by severity (green / yellow / orange / red) |
| Osteophyte spurs | bone score ≥25 | spur size 3 + bone/12 |
| Sclerosis band under the plateau | bone score ≥40 | drawn |
| Bone marrow lesion spot | finding listed | drawn, medial tibia |
| Ligament colour | support score ≥40 | severity colour, otherwise brown |
| Dashed ligament | laxity on exam | dashed line on the named ligament (MCL, LCL, ACL/PCL) |
| Meniscal tear zigzag | tear on imaging OR McMurray positive | drawn on the medial side |
| Left knee | side field | whole drawing mirrored; MEDIAL/LATERAL labels swap |

## 9. Treatment arc (`TX`, `early`, `project`, lines 422–488)

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

Rationale: age, radiographic grade, synovitis, obesity and instability are the established risk factors for knee OA progression (Felson 2000; Bastick 2015 systematic review). The coefficients are not from those papers; they were set so a typical 45-year-old with KL 2 and mild synovitis loses about 2 points a year and reaches the "end-stage" band in roughly 15 years untreated.

Decline accelerates as the joint worsens: each step multiplies by `1 + 0.4 × (points lost so far / 100)`.

### Treatment effects

Each option has a multiplier on the decline rate, a fraction of pain relieved, and a delay before relief starts. The arc runs in quarter-year steps for 20 years.

| Option | Decline multiplier | Pain relieved | Onset (yr) | Evidence note in app |
|---|---|---|---|---|
| No treatment | 1.00 | 0 | — | OA usually progresses slowly |
| NSAIDs | 0.97 | 30% | 0 | Short-term relief; GI, renal, cardiac risk with chronic use; topical preferred (ACR 2019) |
| Steroid injections | **1.10 (faster loss)** | 25% | 0 | 3-monthly triamcinolone caused more cartilage loss than saline over 2 years, with no pain benefit (McAlindon 2017) |
| Physical therapy | 1 − 0.3 × sup/100 − 0.05 | 30% | 0.15 | First-line in every guideline (ACR 2019, OARSI 2019) |
| PRP | 0.93 | 35% | 0.10 | No difference from saline at 12 months (Bennell 2021) |
| LDRT | 1 − 0.45 × (syn/100) × early | 55% × early | 0.20 | See LDRT note below |
| Stem cells | 0.96 | 30% | 0.20 | Limited, low-quality evidence; not FDA-approved for OA |
| Knee replacement | special | pain → 2 after surgery | 0.5 | Strong for end-stage; about 1 in 5 dissatisfied (Bourne 2010) |

**The "early intervention" factor** (`early`, line 422):

```
early = 1 − 0.15 × KL grade − 0.012 × years over age 45        clamped to 0.3–1.0
```

This is what makes LDRT look better when started sooner. It encodes the hypothesis in the design notes that calming synovitis helps most before structural damage sets in. It is a hypothesis, not a finding, and it is the single biggest assumption in the app. The "start now / in 5 / in 10 years" toggle simply delays when the multiplier and relief begin.

**LDRT evidence, as stated in the app:** retrospective German series report pain response in a majority of patients (Keller 2013 and others), while two small sham-controlled Dutch trials found no difference from sham for knee (Mahler 2019) and hand (Minten 2018). The app says "evidence is still developing". This wording should be reviewed by Dr. Thomas, and the response-rate figure checked against the primary papers before patient use.

**Knee replacement** (`tkaEligible`, line 458): offered as "indicated now" when KL ≥3 and health <50, or health <38. On the arc, replacement resets health to 82, after which it declines 0.4 points a year (implant wear), and pain drops to 2. Before surgery, pain is raised by 2 for six months to represent the pre-operative and recovery period. If not currently eligible, the arc places the replacement when the untreated curve would cross health 35.

### Pain and function curves

```
pain(t)     = pain today + 0.08 × (health lost since today)      clamped 0–10
              × (1 − relief) once treatment has taken effect
function(t) = 0.55 × health + 45 × (1 − pain/10)                  0–100
```

Function is a made-up composite for the 3-year table, not KOOS JR. If KOOS JR is recorded at follow-ups, the real score should replace it.

### Visit and time burden (`burden`, lines 489–493)

Visits over 3 years = first-year visits + 2 × later-year visits (for example LDRT: 15 + 2 × 1 = 17). Hours = visits × hours per visit (2 h default, 1.5 h physical therapy, 1.25 h for a 15–20-minute LDRT fraction), plus 240 h recovery for replacement. Time cost = hours × the hourly value the clinician enters (default $40). The visit counts follow the LDRT course in the discovery document (consult, simulation, 10 fractions, follow-ups) and typical schedules for the others; they are estimates.

## 10. Plan and cautions (`planSteps`, `cautions`, lines 450–457 and 494–513)

Plan steps appear in this order when their condition holds:

1. Resolve red flags (any flag).
2. Orthopedic / sports medicine review (leading diagnosis is meniscal or ligament).
3. **LDRT** when all of: age ≥40, not pregnant, no prior radiation to this knee, osteoarthritis is the leading or second diagnosis, and no red flags. The text names the radiation oncology consult (CPT 77263) and the protocol seen in the de-identified charts, 4.5 Gy in 10 fractions. Other painful joints listed by the patient are added to the same step.
4. Simulation and mapping X-rays (CPT 77290), with LDRT.
5. Weight-bearing X-rays when there is no imaging or it is over 12 months old.
6. Physical therapy when support score ≥25 or cartilage score ≥40.
7. Weight management when BMI ≥30 (each kilogram lost removes about four kilograms of knee load per step; Messier 2005).
8. Surgical opinion when replacement-eligible.
9. Track outcomes at 6 weeks, 3, 6 and 12 months. Always included.

Patient-specific cautions on the option cards: NSAIDs with GI bleed, kidney disease, blood thinners or heart disease; steroid shots with diabetes or three or more prior shots; LDRT under age 40, possible pregnancy, or prior radiation to the knee; replacement when not yet indicated. The age-40 line for LDRT follows the general practice of avoiding radiation for benign disease in younger patients; the clinic's own policy should replace it.

## 11. Encounter checklist (`REQ`, lines 514–534)

Eighteen items a complete consult note needs, each with the plain-language question to ask. They map to the S/O/P tabs and cover OPQRST, prior treatment, history, pregnancy status, function baseline, laterality, vitals, height and weight, swelling, range of motion, stability, imaging with KL grade, and consent. The list is a first draft of the billing and documentation criteria the design notes mention; the clinic's billing requirements should replace it.

## 12. De-identified record (`deid`, lines 759–778)

The name, age and sex are hashed (FNV-1a) into a codename such as "Banana-4127"; age becomes a five-year band; BMI becomes a band; location becomes country only; dates become day offsets from the consult. This follows the spirit of HIPAA Safe Harbor but has not been reviewed by a compliance lead. Rare combinations can still identify someone, and the hash is deterministic, so the same person always gets the same codename; that is useful for linking encounters and a risk for re-identification.

## 13. Sources

Clinical frameworks and guidelines:
- OPQRST pain-history mnemonic (standard medical and EMS teaching).
- Kellgren JH, Lawrence JS. Radiological assessment of osteo-arthrosis. *Ann Rheum Dis* 1957;16:494–502.
- Altman R, et al. Development of criteria for the classification and reporting of osteoarthritis: classification of osteoarthritis of the knee. *Arthritis Rheum* 1986;29:1039–49.
- Lyman S, et al. Validation of the KOOS, JR: a short-form knee arthroplasty outcomes survey. *Clin Orthop Relat Res* 2016;474:1461–71.
- Stiell IG, et al. Prospective validation of a decision rule for the use of radiography in acute knee injuries. *JAMA* 1996;275:611–15 (Ottawa knee rule).
- Margaretten ME, et al. Does this adult patient have septic arthritis? *JAMA* 2007;297:1478–88.
- Kolasinski SL, et al. 2019 ACR/Arthritis Foundation guideline for the management of osteoarthritis of the hand, hip, and knee. *Arthritis Care Res* 2020;72:149–62.
- Bannuru RR, et al. OARSI guidelines for the non-surgical management of knee, hip, and polyarticular osteoarthritis. *Osteoarthritis Cartilage* 2019;27:1578–89.

Trials and studies cited on the option cards and in the plan:
- McAlindon TE, et al. Effect of intra-articular triamcinolone vs saline on knee cartilage volume and pain. *JAMA* 2017;317:1967–75.
- Bennell KL, et al. Effect of intra-articular platelet-rich plasma vs placebo injection on pain and medial tibial cartilage volume (RESTORE). *JAMA* 2021;326:2021–30.
- Mahler EAM, et al. Effectiveness of low-dose radiation therapy on symptoms in patients with knee osteoarthritis: a randomised, double-blinded, sham-controlled trial. *Ann Rheum Dis* 2019;78:83–90.
- Minten MJM, et al. Lack of beneficial effects of low-dose radiation therapy on hand osteoarthritis symptoms and inflammation. *Ann Rheum Dis* 2018;77:1454–60.
- Keller S, et al. Efficacy of low-dose radiotherapy in painful gonarthrosis: experiences from a retrospective East German bicenter study. *Radiat Oncol* 2013;8:29.
- Messier SP, et al. Weight loss reduces knee-joint loads in overweight and obese older adults with knee osteoarthritis. *Arthritis Rheum* 2005;52:2026–32.
- Bourne RB, et al. Patient satisfaction after total knee arthroplasty: who is satisfied and who is not? *Clin Orthop Relat Res* 2010;468:57–63.

Progression risk factors behind the decline formula (direction only, not coefficients):
- Felson DT, et al. Osteoarthritis: new insights. Part 1: the disease and its risk factors. *Ann Intern Med* 2000;133:635–46.
- Felson DT, et al. The association of bone marrow lesions with pain in knee osteoarthritis. *Ann Intern Med* 2001;134:541–49.
- Bastick AN, et al. What are the prognostic factors for radiographic progression of knee osteoarthritis? A meta-analysis. *Clin Orthop Relat Res* 2015;473:2969–89.

JointGlow material:
- PAteam × JointGlow, *LDRT Clinic Workflow, as We Understand It* (Discovery, October 2026): the 4.5 Gy / 10 fraction protocol, CPT codes, visit sequence, tissue-depth measurement.
- The founder's design notes and transcript (OPQRST intake, four areas of the knee, joint age, treatment arc, 10-encounter data model).

**Caveat on citations:** these references were written from memory in a cloud session whose network policy blocks general web access, so I could not open the papers to confirm page numbers or exact figures. The studies and their main findings are well known, but every citation should be checked against the primary source before it appears in patient-facing material.

## 14. Known limitations

1. **No validation.** No parameter has been tested against real outcomes. Joint age, the health score and the arc could be wrong in direction or magnitude for a given patient.
2. **Additive points, no interactions.** The scores add up findings; they do not model that, for example, an effusion means something different after an injury than in long-standing OA.
3. **Knee only.** Other joints are captured as a list and only affect the differential (hand, hip) and the LDRT plan text.
4. **No imaging analysis.** Findings are entered by a person; the app does not read X-rays.
5. **Browser storage only.** Records live in the clinician's browser until exported. There is no database, audit trail or multi-user access.
6. **Synthetic examples.** The three example patients are invented.

## 15. What to review and how to make it real

For Dr. Thomas:
- The point tables in sections 4 and 6: are any findings weighted in the wrong direction or missing?
- The LDRT effect size and the "early" factor in section 9: what effect, onset and duration would the clinic be comfortable showing?
- The replacement-eligibility rule and the age-40 LDRT line.
- The wording of every evidence note on the option cards.

To replace heuristics with evidence over time:
- Record KOOS JR, pain and walking distance at each of the ten encounters (the Data tab already lists them) and compare with what the arc predicted.
- Replace the natural decline formula with a published progression model (for example, models derived from the Osteoarthritis Initiative) once the inputs it needs are captured.
- Calibrate joint age against age-stratified health-score norms, or drop the age framing.
- Validate the differential rules against the physician's final diagnoses on real encounters.
