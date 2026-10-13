# JointGlowClinicalAPP

JointGlow clinic intake and assessment tools.

## Joint Arc (`app/joint-arc.html`)

Knee diagnosis and treatment-arc app, published as a Claude artifact: https://claude.ai/artifact/8YLBXodoPVSKLGHokJDxxg (private to the owner until shared).

- **S · History**: patient details and the OPQRST pain history, plus prior treatments and conditions.
- **O · Exam & imaging**: vitals, knee exam, imaging (Kellgren–Lawrence grade, joint space, findings).
- **A · Assessment**: four-area knee model (lining/fluid, cartilage, bone, muscles/tendons/ligaments) drawn next to a healthy knee, joint age, joint health score, red flags, and a ranked A–D differential with ICD-10 codes.
- **P · Plan & arc**: eight treatment options with patient-specific warnings and cited evidence, a 20-year joint arc, a 3-year pain/function/time-cost table, and a recommended plan.
- **Patient report**: plain-language take-home document (download as HTML inside Claude).
- **Data**: the 10-encounter LDRT course and a de-identified JSON record for the outcomes data set.

The copilot rail tracks 18 items needed for a complete consult note and suggests what to ask next. Inside Claude it can also draft a physician summary or patient explanation (the patient's name is never sent).

All scores and projections come from an illustrative rules model, not a validated clinical tool. Example patients are synthetic. Data stays in the browser.

The file is written as artifact page content (no `<html>`/`<head>` wrapper); open it through the artifact link, or serve the folder locally and open it in a browser.
