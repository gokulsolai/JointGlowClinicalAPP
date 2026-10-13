---
name: partner-meeting-brief
description: Prepare a brief for a meeting with a JointGlow partner, investor, referring physician, clinic host or vendor — pulls relevant Notion notes, Gmail threads and Google Calendar context into history, decisions, open questions and next steps. Use before a partner call, or when asked "what's the status with X" or "prep me for my meeting with X".
---

# Partner meeting brief

Get the user ready for a partner meeting in five minutes of reading.

## Gather (read-only)

1. **Email (Gmail)**: run `search_threads` with the partner's name, company domain and deal keywords, limited to the last 90 days (for example `from:@partner.com OR to:@partner.com newer_than:90d`). Search results show only the oldest messages in each thread, so open the relevant threads with `get_thread` and read the newest messages in full.
2. **Calendar (Google Calendar)**: find the meeting. Note the time, attendees and agenda. If the calendar isn't connected, ask the user for the time and attendees.
3. **Notion**: search the partner's name, company, and the project or deal name. Read the most recent and most relevant pages: meeting notes, business updates, deal pages.
4. **Public context**, only if useful: the partner's site, recent news. Date each item.

List which sources you searched and which were unavailable, for example "Google Calendar not connected".

## Write the brief

- **Who and why**: the partner, the attendees and their roles, and what this meeting is for.
- **History**: 3 to 6 dated bullets on how the relationship got here.
- **Decisions made**: what has been agreed, with the source and date for each.
- **Open questions**: what is unresolved and who owns each item.
- **What they want / what we want**.
- **Risks or sensitivities**.
- **Proposed agenda and asks**: what the user should leave with.
- **Next steps** after the meeting, with suggested owners and dates.

Cite the source for every fact (Notion page title, email subject and date). Mark anything inferred as inferred.

## Limits

Read only. Don't send or reply to email, accept invites, or edit Notion pages unless the user asks. You may offer a follow-up email, saved as a Gmail draft with `create_draft` only after the user says yes, for the user to review and send.
