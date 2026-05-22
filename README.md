# XRWorkout Outreach

Python automation for monitoring VR fitness conversations, scoring opportunities, drafting outreach, and sending only human-approved emails.

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env` locally and fill credentials.
4. Install dependencies:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
```

5. Run tests:

```bash
pytest
```

## Local dry run

```bash
python scripts/collect_reddit.py --limit 10
python scripts/collect_youtube.py --limit 10
python scripts/collect_twitch.py --limit 10
python scripts/classify_opportunities.py --limit 10
python scripts/discover_creators.py --limit 10
python scripts/generate_drafts.py --limit 10
python scripts/send_approved.py --dry-run
python scripts/weekly_report.py
```

`send_approved.py` only sends drafts with status `approved`. Set `DRY_RUN_SEND=true` while testing.

## Maintenance

Keep this README current when setup steps, required secrets, scheduled workflows, or operational assumptions change. Project work should be committed with clear messages and pushed to the configured GitHub remote after verification.
