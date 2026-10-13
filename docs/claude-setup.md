# Claude Code setup for JointGlow

Set up on 2026-10-13. This file records what is installed, what was verified, and how to remove each part.

## How it persists

Cloud sessions start in a fresh container, so anything installed only in the container is lost. The durable parts live in this repo:

| File | Purpose |
|---|---|
| `.claude/settings.json` | Declares the three plugin marketplaces and turns on the plugins below for anyone who opens this repo in Claude Code (cloud or local). |
| `CLAUDE.md` | Project instructions: plain writing, finished deliverables, sourced claims, verification, brand, and data rules. |
| `.claude/skills/*` | Four JointGlow workflows (see below). |
| `brand/` | JointGlow logos taken from the clinic-app design export. |

The claude.ai connectors (Notion, Gmail, Google Calendar, Google Drive, Supermetrics) belong to your claude.ai account, not this repo. They follow you into every session once they're connected.

## What's installed

| Item | Source | Status |
|---|---|---|
| superpowers | claude-plugins-official | Installed |
| context7 | claude-plugins-official | Installed. Blocked by the cloud network policy (`mcp.context7.com`, `context7.com`). |
| frontend-design | claude-plugins-official | Installed |
| code-review | claude-plugins-official | Installed |
| playwright | claude-plugins-official | Installed and verified. In the cloud it needs the browser variables below. |
| document-skills (docx, xlsx, pptx, pdf) | anthropics/skills | Installed and verified (spreadsheet made and recalculated) |
| data | knowledge-work-plugins | Installed |
| marketing, sales | knowledge-work-plugins | Already synced from your claude.ai org, so not installed again |
| github plugin | claude-plugins-official | Skipped in the cloud: these sessions already include GitHub tools, and the plugin needs a personal access token. On your own computer: `claude plugin install github@claude-plugins-official` with `GITHUB_PERSONAL_ACCESS_TOKEN` set. |
| Notion plugin | makenotion | Skipped: your claude.ai Notion connector already works, and a second copy would duplicate it. |
| Language servers | claude-plugins-official | Skipped for now: the repo is a single HTML/JS app. Add `typescript-lsp` once there's a JS/TS codebase. |

## Remaining steps for you

1. **Email is Gmail, not Outlook.** The Gmail connector works (a read-only search was verified on 2026-10-13). The partner meeting brief reads Gmail, and only saves a draft when you ask for one. **Google Calendar** is added to claude.ai but not connected. Connect it at https://claude.ai/customize/connectors and start a new session so meeting briefs can find your meetings. The unfinished Microsoft 365 connector isn't needed; remove it there if you like.
2. **Supermetrics**: add the "Supermetrics Marketing Analytics" connector at https://claude.ai/customize/connectors, sign in to Supermetrics, then start a new session.
3. **Context7 and general web access in cloud sessions**: in the cloud environment settings (environment menu, then Edit, then Network access), allow `mcp.context7.com` and `context7.com`, plus any sites you want Claude to research. Leave "Allow package managers" ticked. See https://code.claude.com/docs/en/cloud-environments#network-access.
4. **Playwright in cloud sessions**: add these environment variables to the cloud environment so Playwright uses the browser already installed there:
   ```
   PLAYWRIGHT_MCP_BROWSER=chromium
   PLAYWRIGHT_MCP_EXECUTABLE_PATH=/opt/pw-browsers/chromium
   PLAYWRIGHT_MCP_HEADLESS=true
   PLAYWRIGHT_MCP_NO_SANDBOX=true
   ```
   Don't set these on your own computer. Playwright installs its own browser there.

## Project skills

| Skill | Use it for |
|---|---|
| `jointglow-marketing-audit` | Funnel, cost per consult, lead quality, ranked experiments from Supermetrics or exported data |
| `competitor-brief` | Public-source competitor research with a dated source for every point |
| `partner-meeting-brief` | Notion, email and calendar context turned into decisions, open questions and next steps |
| `executive-deliverable` | Approved material turned into an on-brand deck, memo, spreadsheet or page |

## Disable or remove

- Turn off one plugin for this repo: set it to `false` under `enabledPlugins` in `.claude/settings.json`, or delete its line.
- Turn off one plugin just for you: `claude plugin disable <name>@<marketplace>`. Remove it: `claude plugin uninstall <name>@<marketplace>`.
- Remove a marketplace: `claude plugin marketplace remove <marketplace>`, and delete its entry under `extraKnownMarketplaces`.
- Remove a project skill: delete its folder in `.claude/skills/`.
- Disconnect a connector: https://claude.ai/customize/connectors.
- Undo everything: delete `.claude/`, `CLAUDE.md`, `brand/` and `docs/claude-setup.md`, or revert the setup commit.
