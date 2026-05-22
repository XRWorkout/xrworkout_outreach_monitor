# XRWorkout Outreach Tasks

This file tracks concrete setup, validation, and launch tasks for the outreach system.

## Latest Validation Notes

Updated on 2026-05-22.

- [x] Verified `.env` exists at `/home/yorgobekaii/xrworkout-outreach/.env`.
- [x] Verified configured values are present for Supabase, YouTube, Twitch, Brevo, founder name, site URL, and `DRY_RUN_SEND`.
- [x] Confirmed `OPENAI_API_KEY`, `REDDIT_CLIENT_ID`, and `REDDIT_CLIENT_SECRET` are still empty.
- [x] Ran local tests with the project virtual environment: 10 tests passed.
- [x] Fixed a live validation bug where duplicate raw items inside one collector batch caused Supabase upserts to fail.
- [x] Added a regression test for batch-level raw item deduplication.
- [x] Ran YouTube collection with `--limit 5`: succeeded and wrote raw items to Supabase.
- [x] Reran YouTube collection with `--limit 5`: succeeded, confirming reruns no longer fail on duplicate rows.
- [x] Ran Twitch collection with `--limit 5`: succeeded and wrote raw items to Supabase.
- [x] Reran Twitch collection with `--limit 5`: succeeded.
- [x] Ran approved-send dry run: succeeded with `dry-run: 0; skipped: 0`.
- [x] Ran weekly report: Supabase is reachable and currently reports `raw_items: 103`, `opportunities: 0`, `creators: 0`, `drafts: 0`, `offers: 0`.
- [x] Initialized local Git repository on branch `main`; `.env` remains ignored.
- [x] Added `scripts/save_checkpoint.sh` to save local commits and push to GitHub once a remote is connected.

## Current Next Tasks

- [ ] Decide how to handle OpenAI for Phase 2:
  - Option A: create an OpenAI API key for `OPENAI_API_KEY`.
  - Option B: add a local deterministic test mode so classification, creator discovery, and draft generation can be validated without OpenAI.
- [ ] Create a dedicated Reddit automated/app account for the outreach monitor and register it during Reddit Data API app setup. Do not use the normal human Reddit account as the app account.
- [ ] Fill the remaining Reddit fields in `.env`: `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`.
- [ ] Fill `OPENAI_API_KEY` in `.env` if OpenAI remains the selected LLM path.
- [ ] Run the blocked Reddit and LLM-dependent local pipeline steps after credentials or local test mode are ready:
  - `python scripts/collect_reddit.py --limit 5`
  - `python scripts/classify_opportunities.py --limit 10`
  - `python scripts/discover_creators.py --limit 10`
  - `python scripts/generate_drafts.py --limit 10`
- [ ] Review `raw_items` in Supabase Studio, especially the latest YouTube and Twitch rows.
- [ ] After opportunity classification and draft generation work, review generated `opportunities`, `creators`, and `drafts` rows in Supabase Studio.
- [ ] Approve only safe, useful email drafts in Supabase Studio; keep public comments and DMs manual.
- [ ] Run `python scripts/send_approved.py --dry-run` again after at least one draft is approved.
- [ ] Publish the local repository to your own GitHub account and connect it as the `origin` remote.
- [ ] Add required GitHub Actions secrets after the full local dry-run pipeline works.
- [ ] Keep `DRY_RUN_SEND=true` until one approved email has been dry-run and manually checked.

## Completed Setup

- [x] Created a Supabase project for the outreach system.
- [x] Ran `/home/yorgobekaii/xrworkout-outreach/supabase/schema.sql` in the Supabase SQL editor.
- [x] Set up Alex's phone number for Twitch account 2FA so the Twitch developer application could be created.
- [x] Replaced SendGrid with Brevo in the implementation because SendGrid phone verification is not available from Lebanon.
- [x] Configured Brevo-related `.env` fields: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`.
- [x] Copied `.env.example` to `.env`.

## Still Undone Or Blocked

- [ ] Reddit collection is blocked until Reddit API app credentials are available.
- [ ] OpenAI-based classification, creator discovery, and draft generation are blocked until an API key is created or a no-OpenAI local test mode is implemented.
- [ ] Full end-to-end dry-run pipeline is not complete because Reddit and OpenAI-dependent steps are blocked.
- [ ] Live email sending has not been tested and should stay disabled.
