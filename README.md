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
- Use an `AUTOMATION_ENABLED` switch before treating scheduled jobs as always-on production automation.
- Provide a Next.js visual dashboard for review queues, draft editing, approval, and automation controls.

## Operating Principle

Agents collect, classify, score, draft, log, and report. Humans approve. Automation sends only approved email drafts.

That rule is enforced in code: the sender only processes drafts with `status = approved`. Drafts marked `needs_review`, `edit_needed`, `rejected`, or `sent` are not eligible for sending.

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
Human review happens in Supabase Studio
        |
        v
Approved-only sender sends email through Brevo
        |
        v
Follow-up tasks and reporting keep the loop visible
        |
        v
Dashboard presents queues, charts, draft controls, and automation status
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
- Weekly report script.
- GitHub Actions schedules for collection, drafts, approved sends, and weekly reporting.
- Scheduled workflow jobs are gated by `AUTOMATION_ENABLED`; manual runs still work for validation.
- Next.js dashboard under `dashboard/` with Supabase login, operator allowlist, draft editing, workflow dispatch, and automation variable controls.
- Unit tests for deduplication, scoring rules, follow-up timing, database batch dedupe, and sender recipient extraction.

## What Is Planned

- Deploy the dashboard to Vercel after the dashboard environment variables are configured.
- Expand dashboard outcome tracking after the first controlled send loop is complete.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Python 3.11+ |
| Scheduler | GitHub Actions cron, with Codex jobs on a self-hosted runner and scheduled jobs gated by `AUTOMATION_ENABLED` |
| Database | Supabase Postgres |
| Review UI | Supabase Studio |
| LLM | Codex CLI on the server |
| Reddit | Reddit RSS for v1, PRAW / Reddit Data API as a future fallback |
| YouTube | YouTube Data API |
| Twitch | Twitch Helix API |
| Email | Brevo |
| Tests | Pytest |
| Dashboard | Next.js on Vercel, Supabase Auth, GitHub API |

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
| `scripts/collect_youtube.py` | Collects relevant YouTube videos and channel context. |
| `scripts/collect_twitch.py` | Collects relevant Twitch channel records. |
| `scripts/classify_opportunities.py` | Scores raw items and creates outreach opportunities. |
| `scripts/discover_creators.py` | Promotes strong creator prospects into `creators`. |
| `scripts/generate_drafts.py` | Creates outreach drafts for high-priority safe opportunities. |
| `scripts/send_approved.py` | Sends only approved email drafts and creates follow-up tasks. |
| `scripts/weekly_report.py` | Prints operational counts and review reminders. |

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
npm test
npm run lint
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

- `AUTOMATION_ENABLED`, global switch for scheduled workflows; set to `true` only when scheduled automation should run
- `CODEX_BIN`, defaults to `codex`
- `CODEX_MODEL`, optional; when empty, Codex CLI uses its configured default model
- `CODEX_TIMEOUT_SECONDS`, defaults to `300`
- `XRWORKOUT_FOUNDER_NAME`
- `XRWORKOUT_SITE`, defaults to `https://xrworkout.ai`
- `EMAIL_PROVIDER`, defaults to `brevo`
- `DRY_RUN_SEND`, keep `true` until approved-send behavior is verified
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
python scripts/weekly_report.py
```

Keep `DRY_RUN_SEND=true` during setup. The send script can also be run with `--dry-run` for an explicit no-send check.

## Daily Operation

1. Open Supabase Studio.
2. Review high-priority rows in `opportunities`.
3. Review drafts where `status = needs_review`.
4. Edit weak drafts or mark them `edit_needed`.
5. Mark only safe, useful email drafts as `approved`.
6. Let the approved-send job process approved email drafts.
7. Review follow-up tasks and weekly reporting to track outcomes.

Public comments and DMs remain manual in v1.

## GitHub Actions

The repo includes four scheduled workflows:

| Workflow | Schedule | Purpose |
|---|---:|---|
| `daily-collection.yml` | Daily 14:00 UTC | Collects source items, classifies opportunities, and discovers creators. |
| `daily-drafts.yml` | Daily 16:00 UTC | Generates outreach drafts for high-priority opportunities. |
| `daily-send.yml` | Daily 17:00 UTC | Sends only approved email drafts. |
| `weekly-report.yml` | Friday 18:00 UTC | Prints weekly operational counts. |

All workflows can also be run manually from GitHub Actions.

Launch control:

- Keep the cron schedules in the workflow files so automation is ready.
- Make scheduled jobs stop early unless `AUTOMATION_ENABLED` is explicitly `true`.
- If `AUTOMATION_ENABLED` is missing, scheduled jobs behave as disabled.
- Keep manual runs available for testing while scheduled automation is disabled.
- Keep `DRY_RUN_SEND=true` as the separate email safety switch until one approved email has been dry-run and checked.

## Dashboard

The dashboard reads from Supabase and makes the outreach queue easier to operate than Supabase Studio. It does not replace Supabase as the source of truth.

Planned views:

- Overview metrics for raw items, opportunities, creators, drafts, sent emails, follow-ups, and offers.
- Source charts showing platform volume, source quality, classification rate, and high-priority rate.
- Opportunity queue with filters for platform, priority, score, age, safety status, and recommended action.
- Draft review view with source context, creator context, subject/body, safety notes, and approve/reject/edit-needed actions.
- Creator pipeline with contact availability, niche, fit reason, offer angle, and outreach history.
- Follow-up queue for due and overdue follow-ups.
- Offer tracking for the 3-month-free creator offer and content outcomes.
- Automation status showing schedule state, last workflow runs, failures, `AUTOMATION_ENABLED`, and `DRY_RUN_SEND`.
- Automation controls for toggling `AUTOMATION_ENABLED` and `DRY_RUN_SEND`, and manually dispatching collection, draft, approved-send, and report workflows.

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

The core system is implemented and tested locally. YouTube and Twitch collection have been validated against Supabase, the dry-run sender has been validated, and the repository is configured for GitHub push access.

Remaining launch blockers:

- Reddit API app credentials are optional future fallback work if RSS becomes unreliable.
- Review real Supabase rows and generate at least one reviewable draft.
- Live email sending should remain disabled until at least one approved draft is dry-run and manually checked.
- Dashboard deployment and Vercel environment configuration are still pending.

## Maintenance

Keep this README current when setup steps, scripts, required secrets, workflow schedules, providers, or safety assumptions change.

Meaningful changes should be committed with clear messages and pushed to the configured `origin/main` remote after verification.
