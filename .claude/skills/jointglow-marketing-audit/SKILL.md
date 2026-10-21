---
name: jointglow-marketing-audit
description: Audit JointGlow's marketing performance — campaign results, cost per lead and per consult, lead and conversion quality, and a ranked list of experiments to run next. Use when asked how ads or campaigns are doing, where marketing money is going, why leads or consults dropped, or what to test next.
---

# JointGlow marketing audit

Turn JointGlow's own marketing data into a short audit: what is working, what is wasting money, and which experiments to run next.

## 1. Get the data (measured only)

Use the first source that works, and record which one you used:
1. The **Supermetrics** connector: `accounts_discovery` to find accounts, then `data_query` for the date range. Ask which date range to use if the user didn't say; the default is the last 90 days compared with the 90 days before that.
2. **Google Drive** or uploaded CSV/XLSX exports from ad platforms, analytics or the CRM.
3. If there's no data, stop and ask for exports. Never fill gaps with guesses.

Pull spend, impressions, clicks, leads, and if available consults booked, consults attended and treatment starts, by channel and campaign.

## 2. Build the funnel

Spend → clicks → leads → consults booked → consults attended → treatment starts.

For each channel, report cost per lead, cost per booked consult, booking rate and show rate. Cost per booked consult and lead quality matter more than cost per click. Flag any channel whose leads rarely book (for example under 15% of leads booking a consult) even if its cost per lead looks cheap.

## 3. Check lead quality

Where the data allows, check:
- Fit: age 40 and over, joint pain, within driving distance of a clinic.
- Speed to first contact.
- Main reasons leads don't book (cost, insurance, distance, "not ready").

Say plainly when the data can't answer one of these.

## 4. Rank the experiments

List 3 to 7 experiments. For each, give: hypothesis, change, success metric, expected size of effect (labelled **estimate**), effort, and how long until it gives a readable result. Rank by impact × confidence ÷ effort. Change one variable per test.

## 5. Write it up

Order: one-paragraph summary → funnel table → what's working → what's wasting money → ranked experiments → data gaps.

Label every number **Measured** (with source and date range), **Observed** or **Estimated**. Healthcare ad rules apply: no outcome guarantees, and no patient-identifying data in ad platforms or pixels.

Deliver the audit as a page, memo or deck using the `executive-deliverable` skill when the user wants something to share.

Do not change budgets, pause campaigns or publish ads. Recommend the change and let the user make it.
