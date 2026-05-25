# XRWorkout Outreach Tasks

This file tracks concrete setup, validation, and launch tasks for the outreach system.

## Latest Validation Notes

Updated on 2026-05-25.

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
- [x] User confirmed the updated `Daily collection` GitHub Actions workflow succeeded on 2026-05-24 after switching Reddit collection to RSS.
- [x] User reviewed some Supabase rows on 2026-05-24 and said they looked legitimate enough to continue.
- [x] Added an `AUTOMATION_ENABLED` job-level gate to scheduled GitHub Actions workflows; manual `workflow_dispatch` runs still work.
- [x] Kept the daily pipeline schedule at once per day: collection at 14:00 UTC, drafts at 16:00 UTC, and approved sends at 17:00 UTC. Weekly reporting remains Friday at 18:00 UTC.
- [x] Implemented the Next.js dashboard under `dashboard/` with Supabase login, operator allowlist, overview charts, queues, draft editing, draft status actions, GitHub automation controls, and workflow dispatch.
- [x] Added `dashboard_audit_logs` to `supabase/schema.sql` for dashboard write auditing.
- [x] Verified dashboard tests and production build on 2026-05-25.
- [x] Fast-forwarded the canonical local repo to include the latest XRWorkout remote README and daily-collection edits.
- [x] Found and fixed a malformed `daily-collection.yml` indentation issue introduced by the latest remote edit.
- [x] Removed a stray README list marker under `Why This Exists`.
- [x] Verified `dashboard_audit_logs` exists in Supabase; dashboard write auditing is available.
- [x] Confirmed the dashboard has already recorded workflow dispatch, draft status, and GitHub variable audit events.
- [x] Confirmed current GitHub Actions variables are `AUTOMATION_ENABLED=false` and `DRY_RUN_SEND=true`.
- [x] Ran the weekly report on 2026-05-25: `raw_items: 289`, `opportunities: 50`, `creators: 1`, `drafts: 6`, `offers: 0`.
- [x] Checked current Supabase state on 2026-05-25: opportunities are `7 high`, `14 medium`, `29 low`; drafts are `5 needs_review` and `1 sent`; creators are `1 new`.
- [x] Confirmed the sent email draft created one pending step-1 follow-up due on 2026-06-01.
- [x] Checked latest GitHub workflow runs: `daily-drafts`, `daily-send`, and `weekly-report` succeeded manually on 2026-05-25; the latest `daily-collection` push run failed because of the YAML issue fixed above.
- [x] Pushed the YAML/README/TASKS checkpoint to `origin/main`, `xrworkout/main`, and confirmed the deploy-key remote points to the same commit.

## Current Next Tasks

- [ ] Manually dispatch `Daily collection` once after the YAML fix lands, and confirm it completes successfully.
- [ ] Review the 5 `needs_review` drafts now in Supabase/dashboard; reject weak targets, mark edit-needed drafts clearly, and approve only safe email drafts.
- [ ] Review the 7 high-priority opportunities and the 1 new creator row for targeting quality and contact validity.
- [ ] Confirm the 2026-05-25 sent email in Brevo: delivery status, recipient correctness, sender identity, and no unsafe claims.
- [ ] Keep `AUTOMATION_ENABLED=false` while polishing review quality and workflow reliability.
- [ ] Keep `DRY_RUN_SEND=true` until the sent-email verification and at least one more approved-draft dry run are clean.
- [ ] Deploy the `dashboard/` app to Vercel, or confirm the production dashboard URL if it has already been deployed.
- [ ] Configure and verify Vercel environment variables for Supabase auth/admin access, dashboard operator emails, and the GitHub fine-grained token.
- [ ] Investigate the local dashboard `npm run build`, `npm run lint`, and `npx tsc --noEmit` hangs before treating dashboard deployment as verified.
- [ ] Polish existing dashboard features before adding new sources: empty states, loading/error states, draft editing ergonomics, table filters, and automation status clarity.
- [ ] Add focused tests for the dashboard API write paths that update draft status, edit draft content, update GitHub variables, and dispatch workflows.
- [ ] Add clearer pipeline logging around collector row counts, LLM classification outcomes, draft eligibility skips, and sender dry-run/live-send decisions.
- [ ] Add a due-followup processing script or operator workflow before the first follow-up due date on 2026-06-01.
- [ ] Treat Reddit API credentials as a future upgrade only if RSS collection becomes unreliable.
- [ ] Authenticate Codex CLI on the server using XRWorkout's Codex/OpenAI account, not the personal `yorgobekaii` account, when that account is available.
- [ ] After one more clean collection/draft/send validation cycle, decide whether to set `AUTOMATION_ENABLED=true` for scheduled daily operation.

## Completed Setup

- [x] Created a Supabase project for the outreach system.
- [x] Ran `/home/yorgobekaii/xrworkout-outreach/supabase/schema.sql` in the Supabase SQL editor.
- [x] Set up Alex's phone number for Twitch account 2FA so the Twitch developer application could be created.
- [x] Replaced SendGrid with Brevo in the implementation because SendGrid phone verification is not available from Lebanon.
- [x] Configured Brevo-related `.env` fields: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`.
- [x] Copied `.env.example` to `.env`.

## Still Undone Or Blocked

- [ ] One email draft is marked `sent`, but Brevo delivery and recipient correctness still need manual confirmation.
- [ ] Scheduled automation is intentionally disabled with `AUTOMATION_ENABLED=false`.
- [ ] Dashboard production deployment and environment verification are still pending unless the user confirms a deployed URL.
- [ ] Follow-up handling is not automated yet; one pending follow-up is due on 2026-06-01.
