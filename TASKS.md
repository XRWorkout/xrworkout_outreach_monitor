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
- [x] Generated a separate XRWorkout GitHub SSH key at `/home/yorgobekaii/.ssh/id_ed25519_github_xrworkout`.
- [x] Added local SSH host alias `github-xrworkout` for the XRWorkout GitHub key.
- [x] Added local git remote `xrworkout` for personal-account pushes to `XRWorkout/xrworkout_outreach_monitor`.
- [x] Added local git remote `xrworkout-deploy` for deploy-key pushes to `XRWorkout/xrworkout_outreach_monitor`.
- [x] Verified the XRWorkout deploy-key remote is reachable.
- [x] Added `scripts/push_remotes.sh` and updated `scripts/save_checkpoint.sh` to push both remotes once XRWorkout access is enabled.
- [x] Verified personal-account access to `XRWorkout/xrworkout_outreach_monitor` with `git ls-remote xrworkout`.
- [x] Pushed `main` to `XRWorkout/xrworkout_outreach_monitor` using the personal collaborator account.
- [x] Added GitHub Actions secrets and variables in `XRWorkout/xrworkout_outreach_monitor` for Supabase, YouTube, Twitch, Brevo, Codex CLI settings, founder name, site URL, and dry-run mode.
- [x] Confirmed `python scripts/check_codex_cli.py` returned `Codex CLI auth check passed` during self-hosted runner setup.
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
- [x] Attempted a manual `Daily drafts` workflow dispatch on 2026-05-23 while the self-hosted runner was running with `./run.sh`.
- [x] Observed no local `Runner.Worker`, no `_work` checkout, and no worker diagnostic log after the dispatch; the job did not visibly reach this server-side runner.
- [x] Stopped the manual self-hosted runner process on 2026-05-23 to avoid stale or duplicate runner sessions.
- [x] Noted the GitHub Actions Node.js 20 deprecation warning for `actions/checkout@v4` and `actions/setup-python@v5`; this is warning-level for now, but should be cleaned up before relying on scheduled automation.
- [x] User confirmed on 2026-05-24 that the GitHub self-hosted runner shows a green dot and `idle` after service setup.
- [x] Added `.github/workflows/self-hosted-smoke.yml` to verify checkout, Python setup, package install, and `python scripts/check_codex_cli.py` on the self-hosted runner.
- [x] Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to GitHub Actions jobs to opt into Node.js 24 for JavaScript actions.
- [x] User confirmed the `Self-hosted smoke` GitHub Actions workflow completed successfully on 2026-05-24.
- [x] User confirmed the `Daily drafts` GitHub Actions workflow succeeded on 2026-05-24, including `Codex CLI auth check passed` and draft generation output.
- [x] User confirmed the `Weekly report` GitHub Actions workflow succeeded on 2026-05-24.
- [x] Added `scripts/collect_reddit_rss.py` as the active Reddit collector so v1 can collect low-volume public Reddit signals without Reddit app credentials.
- [x] Updated `daily-collection.yml` to use Reddit RSS instead of the PRAW collector.
- [x] Ran local RSS Reddit collection on 2026-05-24: `python scripts/collect_reddit_rss.py --limit 2 --max-total 5 --sleep-seconds 0 --timeout-seconds 20`, which succeeded with `Upserted 5 Reddit RSS raw items`.
- [x] Ran weekly report after RSS collection: `raw_items: 108`, `opportunities: 1`, `creators: 0`, `drafts: 0`, `offers: 0`.

## Current Next Tasks

- [ ] Cancel any queued or in-progress `Daily drafts` run from 2026-05-23 in the GitHub Actions UI if it is still waiting for a runner.
- [ ] In `XRWorkout/xrworkout_outreach_monitor` → Settings → Actions → Runners, remove stale/offline duplicate entries for `xrworkout-outreach-server` if GitHub shows more than one or shows a stuck session.
- [ ] Decide the exact Linux user that should own production automation, then authenticate Codex CLI under that same user before reinstalling or starting the runner.
- [ ] Treat Reddit API credentials as a future upgrade only if RSS collection becomes unreliable.
- [ ] Run the updated `Daily collection` workflow manually in GitHub Actions and confirm RSS Reddit, YouTube, Twitch, classification, and creator discovery complete.
- [ ] Authenticate Codex CLI on the server using XRWorkout's Codex/OpenAI account, not the personal `yorgobekaii` account, when that account is available.
- [ ] After reviewing the first classified opportunity, continue the local LLM pipeline in small batches:
  - `python scripts/classify_opportunities.py --limit 10`
  - `python scripts/discover_creators.py --limit 10`
  - `python scripts/generate_drafts.py --limit 10`
- [ ] Review `raw_items` in Supabase Studio, especially the latest YouTube and Twitch rows.
- [ ] After opportunity classification and draft generation work, review generated `opportunities`, `creators`, and `drafts` rows in Supabase Studio.
- [ ] Approve only safe, useful email drafts in Supabase Studio; keep public comments and DMs manual.
- [ ] Run `python scripts/send_approved.py --dry-run` again after at least one draft is approved.
- [ ] Keep `DRY_RUN_SEND=true` until one approved email has been dry-run and manually checked.

## Completed Setup

- [x] Created a Supabase project for the outreach system.
- [x] Ran `/home/yorgobekaii/xrworkout-outreach/supabase/schema.sql` in the Supabase SQL editor.
- [x] Set up Alex's phone number for Twitch account 2FA so the Twitch developer application could be created.
- [x] Replaced SendGrid with Brevo in the implementation because SendGrid phone verification is not available from Lebanon.
- [x] Configured Brevo-related `.env` fields: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`.
- [x] Copied `.env.example` to `.env`.

## Still Undone Or Blocked

- [ ] Full end-to-end dry-run pipeline is not complete because no reviewable draft has been generated yet.
- [ ] Live email sending has not been tested and should stay disabled.
