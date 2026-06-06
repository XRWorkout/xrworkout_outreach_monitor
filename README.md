# XRWorkout Outreach Monitor

Agentic outreach infrastructure for XRWorkout: a scheduled Python system that finds relevant VR fitness conversations, scores real opportunities, drafts personalized outreach, and sends only emails that a human has approved.

The goal is simple: turn scattered creator and community signals into a reliable outreach queue without losing human judgment.

## Why This Exists

XRWorkout needs to stay close to the people already talking about VR fitness, mixed reality workouts, Quest apps, creator reviews, and alternatives to apps like FitXR, Supernatural, Les Mills BodyCombat, and Beat Saber workouts.

Doing that manually is slow and inconsistent. This repo builds the operating layer:

- Collect relevant signals from Reddit RSS, YouTube, and Twitch.
- Deduplicate source items before they enter the pipeline.
- Use Codex CLI to classify, score, and summarize opportunities.
- Promote promising creators into a reviewable prospect table.
- Generate outreach drafts for high-fit opportunities.
- Require human approval before any email is sent.
- Track sent drafts, follow-ups, and creator offers in Supabase.
- Run on GitHub Actions, with LLM-dependent jobs on a self-hosted server runner that has Codex CLI installed and authenticated.
- Use explicit automation switches before treating scheduled jobs as always-on production automation.
- Provide a Next.js XRWorkout Outreach OS dashboard for review queues, social listening, contact validation, draft editing, approval, follow-ups, source-quality reporting, automation controls, and analytics.

## Operating Principle

Agents collect, classify, score, draft, log, and report. Humans approve. Automation sends only approved email drafts.

That rule is enforced in code: the sender only processes drafts with `status = approved`. Drafts marked `needs_review`, `edit_needed`, `rejected`, or `sent` are not eligible for sending.

For the detailed intake, filtering, prioritization, channel decision, tracker, anti-spam, and follow-up design, see [docs/outreach-design.md](docs/outreach-design.md).

## System Overview

```text
Reddit / YouTube / Twitch
        |
        v
Collectors write deduped raw_items
        |
        v
LLM classification creates opportunities
        |
        v
Creator discovery creates creator prospects
        |
        v
Draft generation creates needs_review drafts
        |
        v
Human review happens in XRWorkout Outreach OS
        |
        v
Approved-only sender sends email through Brevo
        |
        v
Follow-up tasks and reporting keep the loop visible
        |
        v
Dashboard presents conversations, opportunity feeds, creator pipeline, outreach queues, automation agents, analytics, and source status
```

## What Is Implemented

- Python package for outreach collection, scoring, drafting, and sending.
- Supabase schema for `raw_items`, `opportunities`, `creators`, `drafts`, `followups`, and `offers`.
- Reddit RSS collector for low-volume public Reddit monitoring, with the PRAW collector retained as a future OAuth/API fallback.
- YouTube collector using the YouTube Data API.
- Twitch collector using the Twitch Helix API.
- Codex CLI wrapper for classification, creator discovery, and draft generation.
- Brevo email sender with dry-run support.
- Approval-only sending logic.
- Follow-up task creation after sent emails.
- Weekly report script with action queues and source-quality ranking.
- Clean reset script for deleting operational outreach rows before a fresh run.
- GitHub Actions schedules for collection, drafts, approved sends, and weekly reporting.
- Manual clean automatic start workflow that resets outreach data, runs collection/classification/creator discovery/draft generation, then reports counts.
- Scheduled collection, draft, and report jobs are gated by `AUTOMATION_ENABLED`; scheduled approved sends are gated by `SEND_AUTOMATION_ENABLED`; manual runs still work for validation.
- Next.js dashboard under `dashboard/` with Supabase login, operator allowlist, dark-mode Outreach OS navigation, Dashboard, Conversations, Conversation Map, Creators, Outreach, Export, Automations, Run Monitor, Analytics, and Settings views.
- Dashboard product surfaces include presentation-layer labels, KPI cards, live opportunity feed, AI-style recommendations, social listening filters, interactive source radar, creator kanban, outreach review drawers, contact export builder, automation agent cards, workflow controls, live run monitoring, and source attribution charts.
- Deployed dashboard for day-to-day review and automation controls.
- Audited dashboard editing for opportunity status, creator review fields, follow-up outcomes, and offer outcomes.
- Manual dashboard dispatch from selected opportunities into the LLM draft generator.
- Dashboard clean automatic start control for wiping outreach rows, launching the fresh pipeline, enabling scheduled collection/drafts, and keeping sends disabled in dry-run mode.
- Dry-run-only dashboard send dispatch while `DRY_RUN_SEND=true`.
- Unit tests for deduplication, scoring rules, follow-up timing/context, database batch dedupe, public contact extraction, source-quality reporting, and sender recipient extraction.

## What Is Planned

- Expand dashboard outcome tracking after the first controlled send loop is complete.
- Add new sources only after the Reddit/YouTube/Twitch review loop is consistently producing high-quality opportunities.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Python 3.11+ |
| Scheduler | GitHub Actions cron, with Codex jobs on a self-hosted runner and scheduled jobs disabled by repository variables until launch |
| Database | Supabase Postgres |
| Review UI | Deployed dashboard, with Supabase Studio as fallback |
| LLM | Codex CLI on the server |
| Reddit | Reddit RSS for v1, PRAW / Reddit Data API as a future fallback |
| YouTube | YouTube Data API |
| Twitch | Twitch Helix API |
| Email | Brevo |
| Tests | Pytest |
| Dashboard | Next.js on Vercel, Tailwind CSS, local shadcn-style primitives, Supabase Auth, GitHub API |

## Repository Structure

```text
.
├── .github/workflows/       # Scheduled jobs
├── dashboard/                # Next.js internal dashboard
├── docs/                    # Runbook and secrets guide
├── prompts/                 # Outreach and reply prompt templates
├── scripts/                 # CLI entrypoints for each pipeline stage
├── supabase/schema.sql      # Database schema
├── tests/                   # Unit tests
└── xroutreach/              # Shared package code
```

## Pipeline Scripts

| Script | Purpose |
|---|---|
| `scripts/collect_reddit_rss.py` | Collects low-volume public Reddit RSS entries matching VR fitness keywords. |
| `scripts/collect_reddit.py` | Legacy PRAW collector retained for a future Reddit API upgrade. |
| `scripts/collect_youtube.py` | Collects relevant YouTube videos and channel context, preserving visible public contact emails from API metadata when present. |
| `scripts/collect_twitch.py` | Collects relevant Twitch channel records. |
| `scripts/classify_opportunities.py` | Scores raw items and creates outreach opportunities. |
| `scripts/discover_creators.py` | Promotes strong creator prospects into `creators` and carries forward visible public contact metadata for human validation. |
| `scripts/generate_drafts.py` | Creates outreach drafts for high-priority safe opportunities. |
| `scripts/generate_draft_for_opportunity.py` | Creates one LLM-generated `needs_review` draft for an operator-selected opportunity. |
| `scripts/reset_outreach_data.py` | Deletes operational outreach rows from `followups`, `offers`, `drafts`, `opportunities`, `creators`, and `raw_items`; keeps schema and audit logs. |
| `scripts/send_approved.py` | Sends only approved email drafts and creates follow-up tasks. |
| `scripts/list_due_followups.py` | Lists pending follow-ups due on or before a selected date with contact, profile, opportunity, and source context for operator handling. |
| `scripts/weekly_report.py` | Prints operational counts, action queues, source-quality ranking, and review reminders. |

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`.
4. Fill the required credentials in `.env`.
5. Install and authenticate Codex CLI on the server account that will run the LLM-dependent jobs.
6. Install the project locally:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

7. Run the tests:

```bash
pytest
```

## Dashboard Setup

The dashboard lives in `dashboard/` and is designed for Vercel.

Dashboard environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_OPERATOR_EMAILS`, comma-separated approved operator emails
- `DASHBOARD_GITHUB_TOKEN`, fine-grained token with repository Actions read/write, repository variables read/write, and metadata read
- `DASHBOARD_GITHUB_OWNER`, defaults to `XRWorkout`
- `DASHBOARD_GITHUB_REPO`, defaults to `xrworkout_outreach_monitor`

Install and verify locally:

```bash
cd dashboard
npm install
npm exec vitest run -- --pool=threads --maxWorkers=1
npm run lint
npm run typecheck
npm run build
```

Before using dashboard write actions, run the updated `supabase/schema.sql` so `dashboard_audit_logs` exists.

## Required Credentials

Local `.env` values and GitHub repository secrets should include:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`

Optional settings:

- `AUTOMATION_ENABLED`, switch for scheduled collection, draft, and report workflows; keep `false` until schedules should run
- `SEND_AUTOMATION_ENABLED`, switch for scheduled approved-send workflow; keep `false`
- `CODEX_BIN`, defaults to `codex`
- `CODEX_MODEL`, optional; when empty, Codex CLI uses its configured default model
- `CODEX_TIMEOUT_SECONDS`, defaults to `300`
- `XRWORKOUT_FOUNDER_NAME`
- `XRWORKOUT_SITE`, defaults to `https://xrworkout.ai`
- `EMAIL_PROVIDER`, defaults to `brevo`
- `DRY_RUN_SEND`, keep `true` so dashboard send dispatches stay dry-run only
- `REDDIT_USER_AGENT`, optional; defaults to a clear XRWorkout monitoring user agent

## Local Dry Run

Run the pipeline in small batches while validating credentials and data quality:

```bash
python scripts/collect_reddit_rss.py --limit 5 --max-total 25 --sleep-seconds 2
python scripts/collect_youtube.py --limit 10
python scripts/collect_twitch.py --limit 10
python scripts/classify_opportunities.py --limit 10
python scripts/discover_creators.py --limit 10
python scripts/generate_drafts.py --limit 10
python scripts/send_approved.py --dry-run
python scripts/list_due_followups.py --as-of 2026-06-01
python scripts/weekly_report.py
```

Keep `DRY_RUN_SEND=true` during setup. The send script can also be run with `--dry-run` for an explicit no-send check.

## Daily Operation

1. Open the deployed XRWorkout Outreach OS; use Supabase Studio only as a fallback.
2. Start on Dashboard for KPIs, priority opportunities, live feed items, and AI-style next-step recommendations.
3. Use Conversations for social listening filters and source context.
4. Use Conversation Map to see which platforms are live, inactive, or producing useful opportunities.
5. Use Creators to validate contact details, fit, offer angle, and pipeline status.
6. Use Outreach to review `needs_review` drafts, scheduled follow-ups, and outreach history.
7. Use Export to create downloadable contact lists from creator data, follower ranges, and sample message context.
8. When an opportunity is worth outreach, use `Generate LLM draft` from the opportunity review pane.
9. Mark only safe, useful email drafts as `approved`; comments and DMs remain manual.
10. Run approved-send only as a dry-run while `DRY_RUN_SEND=true`.
11. Use Automations for Clean start, workflow dispatches, and safety variables.
12. Use Run Monitor to inspect workflow progress, step status, and failed-step guidance.
13. Use Analytics to identify which source is producing the best opportunities before adding more sources.

Public comments and DMs remain manual in v1.

## GitHub Actions

The repo includes four scheduled workflows plus manual workflows for selected-opportunity drafts and clean automatic starts:

| Workflow | Schedule | Purpose |
|---|---:|---|
| `daily-collection.yml` | Daily 14:00 UTC | Collects source items, classifies opportunities, and discovers creators. |
| `daily-drafts.yml` | Daily 16:00 UTC | Generates outreach drafts for high-priority opportunities. |
| `manual-opportunity-draft.yml` | Manual only | Generates one LLM draft for an operator-selected opportunity. |
| `clean-automatic-start.yml` | Manual only | Deletes operational outreach rows, runs collection/classification/creator discovery/draft generation, and reports counts. |
| `daily-send.yml` | Daily 17:00 UTC | Processes approved email drafts; scheduled runs require `SEND_AUTOMATION_ENABLED=true`. |
| `weekly-report.yml` | Friday 18:00 UTC | Prints operational counts, action queues, and source-quality ranking. |

All workflows can also be run manually from GitHub Actions.

Launch control:

- Keep the cron schedules in the workflow files so automation is ready.
- Collection, draft, and report schedules stop early unless `AUTOMATION_ENABLED` is explicitly `true`.
- Approved-send schedules stop early unless `SEND_AUTOMATION_ENABLED` is explicitly `true`.
- If either automation variable is missing, that schedule behaves as disabled.
- Keep manual runs available for testing while scheduled automation is disabled.
- Keep `DRY_RUN_SEND=true` as the separate email safety switch; dashboard send dispatch is dry-run only.
- The dashboard `Clean start` action sets `AUTOMATION_ENABLED=true`, `SEND_AUTOMATION_ENABLED=false`, and `DRY_RUN_SEND=true` before dispatching `clean-automatic-start.yml`.

## Dashboard

The dashboard reads from Supabase and makes the outreach queue easier to operate than Supabase Studio. It does not replace Supabase as the source of truth.

Current views:

- Overview metrics for raw items, opportunities, creators, drafts, follow-ups, offers, action queues, and best-performing source.
- Source charts and source-quality ranking showing platform volume, classified opportunities, high-priority count, average score, drafts, and approved/sent count.
- Opportunity queue with filters for platform, priority, score, age, safety status, and recommended action.
- Draft review view with editable subject/body, recipient contact, creator profile, linked opportunity, original source link, and approve/reject/edit-needed actions.
- Creator pipeline with contact availability, profile URL, recent relevant content, niche, fit reason, offer angle, status, and priority.
- Follow-up queue for due and overdue follow-ups with original draft, creator contact, creator profile, linked opportunity, and source link.
- Export builder for dynamic contact-list requests, follower-range parsing, result previews, sample outreach messages, and downloadable CSV, JSON, or readable text files.
- Offer tracking for the 3-month-free creator offer and content outcomes.
- Automation status showing schedule state, last workflow runs, failures, `AUTOMATION_ENABLED`, `SEND_AUTOMATION_ENABLED`, and `DRY_RUN_SEND`.
- Automation controls for toggling automation variables, starting a clean automatic pipeline, and manually dispatching collection, draft, approved-send dry runs, and reports.
- Run Monitor showing live GitHub Actions run status, step timing, failed-step guidance, and run links.

## Safety Rules

Automation may:

- Collect source items.
- Deduplicate records.
- Classify and score opportunities.
- Identify creator prospects.
- Generate outreach drafts.
- Create follow-up tasks.
- Produce reports.

Automation must not:

- Send drafts unless `status = approved`.
- Send rejected, edit-needed, needs-review, or already-sent drafts.
- Auto-post public comments.
- Auto-DM people.
- Make medical, weight-loss, or guaranteed health-outcome claims.
- Pretend to be a neutral user when representing XRWorkout.

## Current Launch Status

The core system is implemented and tested locally. YouTube and Twitch collection have been validated against Supabase, the approved-send dry run has been validated, the dashboard is deployed, and the repository is configured for GitHub push access.

Remaining launch blockers:

- Reddit API app credentials are optional future fallback work if RSS becomes unreliable.
- Deploy the latest dashboard update, then review real Supabase rows and generated drafts through the improved dashboard context.
- Keep scheduled automation disabled until the project is ready for production operation.
- Keep follow-up sending operator-handled in v1.
- Keep new source additions paused until existing source quality and review operations are trusted.

## Maintenance

Keep this README current when setup steps, scripts, required secrets, workflow schedules, providers, or safety assumptions change.

Meaningful changes should be committed with clear messages and pushed to the configured `origin/main` remote after verification.
