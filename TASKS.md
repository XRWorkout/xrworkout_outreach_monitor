# XRWorkout Outreach Tasks

This file tracks concrete setup, validation, and launch tasks for the outreach system.

## Latest Validation Notes

Updated on 2026-05-23.

- [x] Verified `.env` exists at `/home/yorgobekaii/xrworkout-outreach/.env`.
- [x] Verified configured values are present for Supabase, YouTube, Twitch, Brevo, founder name, site URL, and `DRY_RUN_SEND`.
- [x] Confirmed `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` are still empty.
- [x] Replaced the previous API-key LLM path with server-installed Codex CLI for classification, creator discovery, and draft generation.
- [x] Ran local tests after the Codex CLI change: 11 tests passed.
- [x] Ran a direct Codex wrapper smoke test: structured classification JSON returned successfully.
- [x] Ran `python scripts/classify_opportunities.py --limit 1`: succeeded and created the first opportunity row.
- [x] Ran `python scripts/discover_creators.py --limit 1`: succeeded with `Upserted 0 creator prospects`.
- [x] Ran `python scripts/generate_drafts.py --limit 1`: succeeded with `Generated 0 drafts`.
- [x] Ran weekly report after the Codex validation: `raw_items: 103`, `opportunities: 1`, `creators: 0`, `drafts: 0`, `offers: 0`.
- [x] Confirmed Codex CLI auth works for the current `yorgobekaii` server account.
- [x] Checked this server for a GitHub self-hosted runner process, service, or install files; none were found.
- [x] Added `scripts/check_codex_cli.py` so workflows can verify Codex CLI auth from the actual runner account before LLM jobs run.
- [x] Clarified that project automation must use XRWorkout-owned accounts and credentials, not the personal commit account.
- [x] Confirmed the personal repository remains the development push target: `yorgobekaii/xr_workout_outreach_monitor`.
- [x] Confirmed GitHub Actions should run from the XRWorkout-owned repository: `XRWorkout/xrworkout_outreach_monitor`.
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
- [x] Published the local repository to `yorgobekaii/xr_workout_outreach_monitor` and configured SSH push access.
- [x] Added standing repository operating rules in `AGENTS.md` for future commits, pushes, summaries, and README maintenance.

## Current Next Tasks

- [ ] Create a dedicated Reddit automated/app account for the outreach monitor and register it during Reddit Data API app setup. Do not use the normal human Reddit account as the app account.
- [ ] Fill the remaining Reddit fields in `.env`: `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`.
- [ ] Ensure `XRWorkout/xrworkout_outreach_monitor` exists and contains the current project files and workflows.
- [ ] Authenticate Codex CLI on the server using XRWorkout's Codex/OpenAI account, not the personal `yorgobekaii` account.
- [ ] Install and start the GitHub self-hosted runner registered from `XRWorkout/xrworkout_outreach_monitor` on the server.
- [ ] Confirm the GitHub self-hosted runner uses the XRWorkout-owned server account with authenticated Codex CLI access.
- [ ] Run the blocked Reddit collector after Reddit credentials are ready:
  - `python scripts/collect_reddit.py --limit 5`
- [ ] After reviewing the first classified opportunity, continue the local LLM pipeline in small batches:
  - `python scripts/classify_opportunities.py --limit 10`
  - `python scripts/discover_creators.py --limit 10`
  - `python scripts/generate_drafts.py --limit 10`
- [ ] Review `raw_items` in Supabase Studio, especially the latest YouTube and Twitch rows.
- [ ] After opportunity classification and draft generation work, review generated `opportunities`, `creators`, and `drafts` rows in Supabase Studio.
- [ ] Approve only safe, useful email drafts in Supabase Studio; keep public comments and DMs manual.
- [ ] Run `python scripts/send_approved.py --dry-run` again after at least one draft is approved.
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
- [ ] Full end-to-end dry-run pipeline is not complete because Reddit collection is still blocked and no reviewable draft has been generated yet.
- [ ] Live email sending has not been tested and should stay disabled.
