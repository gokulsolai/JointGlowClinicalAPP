# JointGlow workspace

JointGlow is a physician-led company offering low-dose radiation therapy (LDRT) for arthritis and joint pain, and expanding its clinics. This repo holds the clinic intake app and the team's Claude workflows.

## How to work here

- Finish the job. Hand over a working page, a finished deck or memo, or a filled spreadsheet, not an outline of one.
- Write plainly: short sentences, active voice, no filler. Lead with the answer, then the support.
- Back up every factual claim. Give a source and a date for anything outside the user's own data. If a claim has no source, say so or leave it out.
- Never invent JointGlow facts: no made-up patient counts, outcomes, prices, partners, staff or study results. If a number is missing, mark it `[needs source]` and ask.
- Check before saying something is done: run it, open it, or recalculate it. Say what you checked and what you could not check.

## Clinical and patient data

- Do not put patient-identifying information (names, dates of birth, contact details, record numbers) in this repo, in artifacts, or in prompts sent to third-party tools. Use synthetic or de-identified examples.
- Clinical content is decision support for clinicians. Label projections and models as illustrative unless they come from a cited study. Describe LDRT evidence accurately, including mixed or negative trials.
- Healthcare marketing: no guaranteed outcomes and no "cure" language. Testimonials need consent.

## Marketing numbers

Keep three kinds of figures apart and label each one:
1. **Measured**: JointGlow's own data (Supermetrics, analytics, CRM, clinic records), with the date range.
2. **Observed**: public facts about competitors (ads in the Meta Ad Library or Google Ads Transparency Center, landing pages, pricing pages), with the URL and the date seen.
3. **Estimated**: your inference, with the method shown.

Never report a competitor's spend, conversions or ROAS as known unless a source publishes it.

## Brand

- Assets: `brand/jointglow-logo-dark-text.png` (light backgrounds), `brand/jointglow-logo-white-text.png` (dark backgrounds), `brand/jointglow-mark-128.png`.
- Colors: charcoal `#373535` (text and dark surfaces), gold `#ddb529`, gold gradient `#edda5a` to `#de9c2e`, dark gold for text `#8a6d0b`, light grey `#f5f5f5`, body text `#4b494b`.
- Type: Poppins (headings 700 to 800, body 400), fallback Helvetica Neue or Arial.
- Tagline: "move. live. thrive."

## Safety during work

Don't send email, post, publish, change ad budgets, buy anything or deploy without the user's explicit go-ahead for that specific action. Draft instead.

## Workflows

Project skills live in `.claude/skills/`: `jointglow-marketing-audit`, `competitor-brief`, `partner-meeting-brief`, `executive-deliverable`. Setup notes and how to remove things: `docs/claude-setup.md`.
