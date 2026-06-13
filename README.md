# XRWorkout Outreach Monitor

Agentic outreach infrastructure for XRWorkout: a scheduled Python system that finds relevant VR fitness conversations, scores real opportunities, drafts personalized outreach, and sends only emails that a human has approved.

The goal is simple: turn scattered creator and community signals into a reliable outreach queue without losing human judgment.

## Why This Exists

XRWorkout needs to stay close to the people already talking about VR fitness, mixed reality workouts, Quest apps, creator reviews, and alternatives to apps like FitXR, Supernatural, Les Mills BodyCombat, and Beat Saber workouts.

Doing that manually is slow and inconsistent. This repo builds the operating layer:

- Collect relevant signals from Reddit RSS, YouTube, Twitch, and disabled-by-default Apify creator/social actors.
- Deduplicate source items before they enter the pipeline.
- Use Codex CLI to classify, score, and summarize opportunities.
- Promote promising creators and public conversation-author leads into a reviewable prospect table.
- Apply deterministic creator-quality scoring with source-history-derived or accumulated-observation 90-day VR/XR counts, evidence-quality labels for full history, partial history, observed posts, and failed enrichment, plus caps for weak history, one-off VR mentions, stale activity, missing VR proof, contactability, safety, and review priority.
- Generate outreach drafts for high-fit opportunities.
- Require human approval before any email is sent.
- Track sent drafts, follow-ups, and creator offers in Supabase.
- Run on GitHub Actions, with LLM-dependent jobs on a self-hosted server runner that has Codex CLI installed and Ollama Cloud credentials configured.
- Use explicit automation switches before treating scheduled jobs as always-on production automation.
- Provide a Next.js XRWorkout Outreach OS dashboard for review queues, social listening, contact validation, draft editing, approval, follow-ups, source-quality reporting, automation controls, and analytics.

## Operating Principle

Agents collect, classify, score, draft, log, and report. Humans approve. Automation sends only approved email drafts.

That rule is enforced in code: the sender only processes drafts with `status = approved`. Drafts marked `needs_review`, `edit_needed`, `rejected`, or `sent` are not eligible for sending.

For the detailed intake, filtering, prioritization, channel decision, tracker, anti-spam, and follow-up design, see [docs/outreach-design.md](docs/outreach-design.md). For the dedicated outreach candidate scoring rubric, see [docs/candidate-scoring.md](docs/candidate-scoring.md).

## System Overview

```text
Reddit / YouTube / Twitch / Apify
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
- Apify creator, social, and public conversation collectors with item/run caps, currently used for controlled dashboard validation.
- Codex CLI wrapper for classification, creator discovery, and draft generation.
- Brevo email sender with dry-run support.
- Approval-only sending logic.
- Follow-up task creation after sent emails.
- Weekly report script with action queues, creator-quality evidence counts, source-quality ranking, and creator conversion counts by source.
- Clean reset script for deleting operational outreach rows before a fresh run.
- GitHub Actions schedules for collection, drafts, approved sends, and weekly reporting.
- Manual clean automatic start workflow that resets outreach data, runs Reddit, YouTube, Twitch, Apify conversations when enabled, public forums, blogs, classification, creator discovery, draft generation, then reports counts.
- Manual source collection workflow for rerunning one missing source from the Automation tab without wiping the whole dataset.
- Scheduled collection, draft, and report jobs are gated by `AUTOMATION_ENABLED`; scheduled approved sends are gated by `SEND_AUTOMATION_ENABLED`; manual runs still work for validation.
- Next.js dashboard under `dashboard/` with Supabase login, operator allowlist, dark-mode Outreach OS navigation, Dashboard, Conversations, Conversation Map, Creators, Outreach, Export, Automations, Run Monitor, Analytics, and Settings views.
- Dashboard product surfaces include presentation-layer labels, KPI cards, live opportunity feed, AI-style recommendations, social listening filters, interactive source radar with native/Apify source alias aggregation, a drag-and-drop creator review board, explicit creator inclusion reasons, clickable profile/source/evidence links, a workspace-style creator detail panel, multi-source prospect export builder, automation agent cards, workflow controls, live run monitoring, and source attribution charts.
- Deployed dashboard for day-to-day review and automation controls.
- Audited dashboard editing for opportunity status, creator review fields, follow-up outcomes, and offer outcomes.
- Manual dashboard dispatch from selected opportunities into the LLM draft generator.
- Dashboard clean automatic start control for wiping outreach rows, launching the fresh pipeline, enabling scheduled collection/drafts, and keeping sends disabled in dry-run mode.
- Dry-run-only dashboard send dispatch while `DRY_RUN_SEND=true`.
- Unit tests for deduplication, scoring rules, Apify normalization, creator quality scoring, follow-up timing/context, database batch dedupe, public contact extraction, source-quality reporting, and sender recipient extraction.

## What Is Planned

- Expand dashboard outcome tracking after the first controlled send loop is complete.
- Validate higher-volume Apify conversation actors for X/Twitter, TikTok, Instagram hashtags/reels, Discord discovery, and public Facebook groups before relying on them in scheduled refreshes.

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Python 3.11+ |
| Scheduler | GitHub Actions cron, with LLM jobs on a self-hosted runner and scheduled jobs disabled by repository variables until launch |
| Database | Supabase Postgres |
| Review UI | Deployed dashboard, with Supabase Studio as fallback |
| LLM | Ollama Cloud for classification/creator scoring; Codex CLI for drafts and fallback |
| Reddit | Reddit RSS for v1, PRAW / Reddit Data API as a future fallback |
| YouTube | YouTube Data API |
| Twitch | Twitch Helix API |
| Apify | Supplemental creator/social scraping, disabled until actor quality and budget are validated |
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
| `scripts/collect_apify_creators.py` | Runs configured Apify creator actors when `APIFY_ENABLED=true`, normalizes profile/recent-post evidence, and stores rows in `raw_items`. |
| `scripts/collect_apify_social.py` | Runs configured Apify social-listening actors when `APIFY_ENABLED=true` and stores post-level signals in `raw_items`. |
| `scripts/collect_apify_conversations.py` | Runs configured public conversation actors for X/Twitter, Facebook groups/pages, TikTok, Discord server discovery, and other Apify-backed social sources, preserving public author/profile metadata when actors expose it. |
| `scripts/collect_forums.py` | Collects public Discourse-style VR/forum threads through public JSON endpoints. |
| `scripts/collect_blogs.py` | Collects VR/XR blog and news RSS/Atom feed articles. |
| `scripts/classify_opportunities.py` | Scores raw items and creates outreach opportunities. |
| `scripts/discover_creators.py` | Promotes creator prospects into `creators`, computes profile-history-backed or accumulated-observed 90-day VR/XR activity metrics, applies deterministic creator-quality evidence caps, normalizes creator platform/profile identity before persistence, updates case-variant duplicate rows safely, and also creates capped review-only conversation-author leads from Apify rows with usable public author profiles. |
| `scripts/generate_drafts.py` | Creates outreach drafts for high-priority safe opportunities. |
| `scripts/generate_draft_for_opportunity.py` | Creates one LLM-generated `needs_review` draft for an operator-selected opportunity. |
| `scripts/check_ollama_cloud.py` | Verifies Ollama Cloud auth, configured model tags, and a small JSON smoke response. |
| `scripts/reset_outreach_data.py` | Deletes operational outreach rows from `followups`, `offers`, `drafts`, `opportunities`, `creators`, and `raw_items`; keeps schema and audit logs. |
| `scripts/send_approved.py` | Sends only approved email drafts and creates follow-up tasks. |
| `scripts/list_due_followups.py` | Lists pending follow-ups due on or before a selected date with contact, profile, opportunity, and source context for operator handling. |
| `scripts/weekly_report.py` | Prints operational counts, action queues, source-quality ranking, and review reminders. |

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`.
4. Fill the required credentials in `.env`.
5. Install and authenticate Codex CLI on the server account that will run draft/fallback jobs.
6. Add `OLLAMA_API_KEY` for the XRWorkout Ollama Pro account and verify it with `python scripts/check_ollama_cloud.py`.
7. Install the project locally:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

8. Run the tests:

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
npx playwright install chromium
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
- `APIFY_TOKEN`, only required when Apify collection is enabled
- `OLLAMA_API_KEY`, required when `CHEAP_LLM_ENABLED=true`

Optional settings:

- `AUTOMATION_ENABLED`, switch for scheduled collection, draft, and report workflows; keep `false` until schedules should run
- `SEND_AUTOMATION_ENABLED`, switch for scheduled approved-send workflow; keep `false`
- `CODEX_BIN`, defaults to `codex`
- `CODEX_MODEL`, optional; when empty, Codex CLI uses its configured default model
- `CODEX_TIMEOUT_SECONDS`, defaults to `300`
- `CHEAP_LLM_ENABLED`, enables Ollama Cloud for classification and creator scoring
- `OLLAMA_BASE_URL`, defaults to `https://ollama.com/api`
- `LLM_POLICY_PATH`, defaults to `llm_policy.json`
- `LLM_NOTIFY_FALLBACKS`, prints and logs Codex fallback events
- `XRWORKOUT_FOUNDER_NAME`
- `XRWORKOUT_SITE`, defaults to `https://xrworkout.ai`
- `EMAIL_PROVIDER`, defaults to `brevo`
- `DRY_RUN_SEND`, keep `true` so dashboard send dispatches stay dry-run only
- `REDDIT_USER_AGENT`, optional; defaults to a clear XRWorkout monitoring user agent
- `APIFY_ENABLED`, enable only during controlled actor validation or after actor quality is accepted
- `APIFY_CREATOR_ACTORS_JSON`, JSON array of actor configs
- `APIFY_SOCIAL_ACTORS_JSON`, JSON array of actor configs
- `APIFY_CONVERSATION_ACTORS_JSON`, JSON array of public conversation actor configs
- `APIFY_MAX_ITEMS_PER_RUN`, defaults to `100`
- `APIFY_MAX_RUNS_PER_DAY`, defaults to `4`; current max-efficiency validation uses `6`
- `FORUM_SOURCES_JSON`, JSON array of public Discourse/forum sources
- `BLOG_FEEDS_JSON`, JSON array of RSS/Atom feed sources

## Local Dry Run

Run the pipeline in small batches while validating credentials and data quality:

```bash
python scripts/collect_reddit_rss.py --limit 5 --max-total 25 --sleep-seconds 2
python scripts/collect_youtube.py --limit 10
python scripts/collect_twitch.py --limit 10
# after Apify actors are configured and APIFY_ENABLED=true:
python scripts/collect_apify_creators.py --limit 25
python scripts/collect_apify_social.py --limit 25
python scripts/collect_apify_conversations.py --limit 25
python scripts/collect_forums.py --limit 3
python scripts/collect_blogs.py --limit 3
python scripts/check_ollama_cloud.py
python scripts/check_codex_cli.py
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
5. Use Creators to validate the quality score, score band, evidence quality, evidence confidence, strongest relevance proof, recent VR/activity evidence, whether counts came from full profile history or accumulated observed posts, headset evidence, contact details, fit, offer angle, and pipeline status; mark rows `reviewed`, `qualified`, `contact_ready`, or `rejected` from the creator tab.
6. Use Outreach to review `needs_review` drafts, scheduled follow-ups, and outreach history.
7. Use Export to create downloadable prospect lists from creator data, opportunity authors, conversation-author leads, follower ranges, manual-contact paths, and sample message context.
8. When an opportunity is worth outreach, use `Generate LLM draft` from the opportunity review pane.
9. Mark only safe, useful email drafts as `approved`; comments and DMs remain manual.
10. Run approved-send only as a dry-run while `DRY_RUN_SEND=true`.
11. Use Automations for Clean start, source-specific collection runs, workflow dispatches, and safety variables.
12. Use Run Monitor to inspect workflow progress, step status, and failed-step guidance.
13. Use Analytics to identify which source is producing the best opportunities before adding more sources.

Public comments and DMs remain manual in v1.

## GitHub Actions

The repo includes four scheduled workflows plus manual workflows for selected-opportunity drafts, source-specific collection, and clean automatic starts:

| Workflow | Schedule | Purpose |
|---|---:|---|
| `daily-collection.yml` | Daily 14:00 UTC | Collects source items, classifies opportunities, and discovers creators. |
| `daily-drafts.yml` | Daily 16:00 UTC | Generates outreach drafts for high-priority opportunities. |
| `manual-opportunity-draft.yml` | Manual only | Generates one LLM draft for an operator-selected opportunity. |
| `manual-source-collection.yml` | Manual only | Runs one selected collector or all collectors, then classifies new rows by default. |
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
- Keep `APIFY_ENABLED` controlled by the operator; current validation enables it for manual source runs while scheduled approved sending remains disabled.
- Keep `DRY_RUN_SEND=true` as the separate email safety switch; dashboard send dispatch is dry-run only.
- The dashboard `Clean start` action sets `AUTOMATION_ENABLED=true`, `SEND_AUTOMATION_ENABLED=false`, and `DRY_RUN_SEND=true` before dispatching `clean-automatic-start.yml`.
- The dashboard `Run Missing Source` controls dispatch `manual-source-collection.yml` for all sources, Apify conversations, forums, blogs, Reddit, YouTube, or Twitch.

## Dashboard

The dashboard reads from Supabase and makes the outreach queue easier to operate than Supabase Studio. It does not replace Supabase as the source of truth.

Current views:

- Overview metrics for raw items, opportunities, creators, drafts, follow-ups, offers, action queues, and best-performing source.
- Source charts and source-quality ranking showing platform volume, classified opportunities, high-priority count, average score, drafts, and approved/sent count.
- Conversation Map and Conversations filters for platform, source type, intent, relevance, date, and follower range across X/Twitter, TikTok, Instagram, YouTube, Reddit, Facebook groups, Discord discovery, VR forums, and VR blogs. Radar nodes light up from either native sources or matching Apify source aliases.
- Opportunity queue with filters for platform, priority, score, age, safety status, and recommended action.
- Draft review view with editable subject/body, recipient contact, creator profile, linked opportunity, original source link, and approve/reject/edit-needed actions.
- Creator pipeline with contact availability, profile URL, quality score band, evidence quality/confidence, strongest relevance proof, recent VR/activity counts, source provenance for full profile history versus accumulated observed posts, headset confidence, movement evidence, engagement/contactability evidence, safety notes, recent relevant content, niche, fit reason, offer angle, reviewed/qualified/contact-ready actions, status, and priority.
- Follow-up queue for due and overdue follow-ups with original draft, creator contact, creator profile, linked opportunity, and source link.
- Export builder for dynamic prospect and conversation requests, follower-range parsing, score/priority thresholds, result previews, sample outreach messages, and downloadable CSV, JSON, or readable text files. Exports combine creator records, high-fit opportunity authors, public conversation-author leads, and high-scoring conversation records, then dedupe and rank them while clearly labeling public contacts, manual contact paths, source-review records, and missing contact data.
- Offer tracking for the 3-month-free creator offer and content outcomes.
- Automation status showing schedule state, last workflow runs, failures, `AUTOMATION_ENABLED`, `APIFY_ENABLED`, `SEND_AUTOMATION_ENABLED`, and `DRY_RUN_SEND`.
- Automation controls for toggling automation variables, starting a clean automatic pipeline, rerunning a specific missing source, and manually dispatching collection, draft, approved-send dry runs, and reports.
- Run Monitor showing live GitHub Actions run status, step timing, failed-step guidance, and run links.

Discord handling is intentionally limited to public server discovery metadata. Message ingestion requires an explicit future authorized bot path for servers XRWorkout owns or has permission to monitor.

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
- Keep Apify disabled until schema deployment, actor choice, low-limit validation, and Starter-plan usage are reviewed.

## Maintenance

Keep this README current when setup steps, scripts, required secrets, workflow schedules, providers, or safety assumptions change.

Meaningful changes should be committed with clear messages and pushed to the configured `origin/main` remote after verification.
