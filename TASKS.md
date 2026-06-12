# XRWorkout Outreach Tasks

This file tracks concrete setup, validation, and launch tasks for the outreach system.

## Latest Validation Notes

Updated on 2026-06-09.

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
- [x] Confirmed current GitHub Actions variables are `AUTOMATION_ENABLED=false`, `SEND_AUTOMATION_ENABLED=false`, and `DRY_RUN_SEND=true`.
- [x] Ran the weekly report on 2026-05-25: `raw_items: 289`, `opportunities: 50`, `creators: 1`, `drafts: 6`, `offers: 0`.
- [x] Checked current Supabase state on 2026-05-25: opportunities are `7 high`, `14 medium`, `29 low`; drafts are `5 needs_review` and `1 sent`; creators are `1 new`.
- [x] Confirmed the sent email draft created one pending step-1 follow-up due on 2026-06-01.
- [x] Checked latest GitHub workflow runs: `daily-drafts`, `daily-send`, and `weekly-report` succeeded manually on 2026-05-25; the latest `daily-collection` push run failed because of the YAML issue fixed above.
- [x] Pushed the YAML/README/TASKS checkpoint to `origin/main`, `xrworkout/main`, and confirmed the deploy-key remote points to the same commit.
- [x] User confirmed on 2026-05-26 that the dashboard has been deployed.
- [x] User confirmed on 2026-05-26 that the 2026-05-25 sent email was manually verified in Brevo.
- [x] Added `docs/outreach-design.md` to document intake sources, filtering, prioritization, channel decisions, tracker structure, anti-spam rules, follow-up cadence, and agent automation steps.
- [x] User confirmed on 2026-05-26 that one approved-send dry run was manually run and only approved email drafts were counted.
- [x] Added `SEND_AUTOMATION_ENABLED` as the separate scheduled approved-send safety gate; schedules remain disabled.
- [x] Verified GitHub Actions variable `SEND_AUTOMATION_ENABLED=false` in `XRWorkout/xrworkout_outreach_monitor`.
- [x] Added audited dashboard controls for opportunity status, creator review fields, follow-up outcomes, and offer outcomes.
- [x] Made dashboard send workflow dispatch dry-run only while `DRY_RUN_SEND=true`.
- [x] Added `scripts/list_due_followups.py` as a read-only backup for operator follow-up handling.
- [x] Added clearer pipeline logging around collector row counts, LLM classification outcomes, draft eligibility skips, and sender dry-run decisions.
- [x] Added manual dashboard dispatch from selected opportunities into the LLM draft generator so operators can decide which opportunities enter the draft queue.
- [x] Loosened creator discovery and converted it from per-item Codex calls to one batch Codex call per run using the creator review fields: name, platform, profile URL, public contact, niche, audience estimate/quality, fit reason, VR/fitness/gaming/wellness signal, offer angle, and priority.
- [x] Ran focused creator discovery tests after the batch change: 8 tests passed.
- [x] Tightened fallback creator promotion so a row is not created merely because the collector search query was `VR fitness`; future fallback rows need creator/profile/title text evidence.
- [x] Ran `python scripts/discover_creators.py --limit 10` on 2026-06-04: completed in about 25 seconds with `scanned=10 upserted=10 fallback=7 skipped=0`.
- [x] Checked Supabase after creator discovery on 2026-06-04: `raw_items: 289`, `opportunities: 50`, `creators: 24`, `drafts: 6`, `followups: 1`, `offers: 0`; all 24 creators are currently `new` and need review.
- [x] Added dashboard `Clean start` action and `clean-automatic-start.yml` workflow to delete operational outreach data, run the fresh pipeline, enable scheduled collection/drafts, keep scheduled sending disabled, and keep send dispatches dry-run only.
- [x] Added `scripts/reset_outreach_data.py` and database reset coverage; reset deletes `followups`, `offers`, `drafts`, `opportunities`, `creators`, and `raw_items` while leaving schema and audit logs intact.
- [x] Verified after clean-start implementation: backend tests passed, dashboard tests passed, dashboard typecheck passed, and dashboard lint passed.
- [x] Fixed local dashboard validation reliability on 2026-06-04 by narrowing ESLint and TypeScript scopes away from generated `.next` output; verified `npm run build`, `npm run lint`, and `npx tsc --noEmit` complete locally.
- [x] Implemented the operational finish pass on 2026-06-05: draft review now shows recipient/contact, creator profile, linked opportunity context, and original source links.
- [x] Added dashboard action metrics and source-quality ranking so the overview identifies which source is producing the best opportunities.
- [x] Made due and overdue follow-ups obvious in the dashboard and added creator contact, profile, opportunity, and source context to follow-up review.
- [x] Preserved visible public contact emails from YouTube API metadata and carried visible public contact metadata through creator discovery for human validation.
- [x] Expanded `scripts/list_due_followups.py` and `scripts/weekly_report.py` with contact/profile/source context, action queues, due follow-up counts, and source-quality ranking.
- [x] Verified the operational finish pass: backend tests passed, dashboard tests passed, dashboard typecheck passed, dashboard lint passed, and dashboard production build passed.
- [x] Ran the enhanced weekly report on 2026-06-05: best current source is YouTube with `7` high-priority opportunities, average score `41.4`, `6` drafts, and `1` approved/sent draft.
- [x] Redesigned the dashboard into XRWorkout Outreach OS with dark-mode navigation, first-class Dashboard/Conversations/Conversation Map/Creators/Outreach/Automations/Analytics/Settings views, presentation-layer labels, card feeds, creator kanban, automation agent cards, and visual analytics.
- [x] Verified the Outreach OS redesign locally: dashboard lint passed, typecheck passed, focused Vitest run passed, and production build passed.
- [x] Ran Clean automatic start successfully on 2026-06-06 after fixing the Supabase reset delete filter; refreshed state was `raw_items: 142`, `opportunities: 75`, `creators: 33`, `drafts: 5`, and `6` high-priority opportunities.
- [x] Added dashboard Run Monitor view on 2026-06-06 to show live GitHub Actions run status, per-step status, estimated timing, failed-step guidance, likely fixes, and GitHub run links.
- [x] Added dashboard Export view on 2026-06-06 for dynamic contact-list requests, follower-range parsing, result previews, sample messages, and downloadable CSV/JSON/text files.
- [x] Verified the dashboard export update on 2026-06-06: lint passed, typecheck passed, Vitest passed, and production build passed.
- [x] Implemented disabled-by-default Apify creator and social collectors on 2026-06-08.
- [x] Added Apify config fields, workflow env wiring, and Starter-plan caps with `APIFY_ENABLED=false` as the safety gate.
- [x] Added creator-quality scoring evidence fields to Supabase schema for score, 90-day VR/activity counts, activity level, headset confidence/evidence, movement evidence, engagement, contactability, safety notes, and raw evidence JSON.
- [x] Updated creator discovery to include Apify sources and store candidate-scoring evidence.
- [x] Updated dashboard creator review with score/activity/headset/contactability filters and a creator evidence panel.
- [x] Updated weekly report with creator A-score, headset evidence, and active creator counts.
- [x] Verified Apify/scoring implementation locally: backend tests passed, dashboard lint passed, dashboard typecheck passed, and dashboard Vitest passed.
- [x] Verified Supabase creator evidence columns exist on 2026-06-08.
- [x] Added `APIFY_TOKEN` to the XRWorkout GitHub Actions secrets on 2026-06-08.
- [x] Replaced placeholder Apify GitHub variables with tested low-limit TikTok actor configs and kept `APIFY_ENABLED=false`.
- [x] Ran low-limit Apify validation on 2026-06-08 using `clockworks/tiktok-scraper`: creator collection wrote `6` unique raw items, social collection wrote `6` unique raw items, classification processed `12` Apify rows with `1 high`, `2 medium`, and `9 low`, and source quality reported `apify_tiktok: raw=12 opportunities=12 high=1 avg_score=33.3 drafts=0`.
- [x] Apify validation found useful TikTok social signals, including a high-priority Thrill of the Fight / Quest 3 fitness post, but creator-level enrichment needs review because low-limit TikTok profile/search data did not provide enough recent-post history for strong activity scoring.
- [x] User reviewed Apify validation on 2026-06-08: returned opportunities looked useful, no public contact was found, creator history was weak, and activity/VR-post filters were unreliable because the tested TikTok output did not scrape real profile history.
- [x] Updated Apify creator handling so post-only Apify rows can remain useful social/opportunity signals but are not treated as reliable creator-history rows for creator scoring.
- [x] Implemented Conversation Map expansion on 2026-06-08 with Apify-backed public conversation normalization, X/Facebook/Discord source support, public forum collection, VR blog/RSS collection, source-type and intent filters, and source-quality rollups.
- [x] Added source-specific automation controls on 2026-06-08: Clean Start runs expanded collection automatically, and the Automation tab can run all sources, Apify conversations, forums, blogs, Reddit, YouTube, or Twitch individually.
- [x] User ran Automation > Run all on 2026-06-09; Apify remained disabled by the safety gate, blog collection produced reviewable rows, and classification hit a Codex rate limit before processing blog rows.
- [x] Ran weekly report after the 2026-06-09 Run all attempt: `raw_items: 266`, `opportunities: 204`, `creators: 53`, `drafts: 12`, `followups: 0`, `offers: 0`; source quality showed `vr_blog: raw=30 opportunities=0`.
- [x] Implemented the Ollama Cloud LLM router on 2026-06-09: `qwen3.5:397b` for classification, `gpt-oss:120b` for creator discovery/scoring, Codex-only drafting, one Ollama retry, Codex fallback, policy-file routing, smoke check script, workflow env wiring, usage-event schema, weekly-report fallback counts, and tests.

## Current Next Tasks

- [x] Added the XRWorkout Ollama Pro `OLLAMA_API_KEY` locally and confirmed GitHub Actions receives the secret.
- [x] Set GitHub variables `CHEAP_LLM_ENABLED=true`, `OLLAMA_BASE_URL=https://ollama.com/api`, `LLM_POLICY_PATH=llm_policy.json`, and `LLM_NOTIFY_FALLBACKS=true` on 2026-06-12.
- [ ] Run `python scripts/check_ollama_cloud.py` locally and through the self-hosted smoke workflow.
- [ ] Deploy the updated Supabase schema so `llm_usage_events` exists.
- [ ] Retry Manual source collection with `source=blogs` and `classify=true` now that GitHub has `CHEAP_LLM_ENABLED=true`.
- [ ] Keep `APIFY_ENABLED=false` until the expanded Apify conversation actors are configured and low-limit validation is reviewed in the dashboard.
- [ ] Configure low-limit `APIFY_CONVERSATION_ACTORS_JSON` for X/Twitter, Facebook groups, Discord server discovery, and TikTok conversation discovery before enabling Apify.
- [ ] Configure `FORUM_SOURCES_JSON` with the first small public source list.
- [ ] Use Automation > Run Missing Source to validate Apify conversations and forums individually before relying on Clean Start for full refreshes.
- [ ] Decide whether to use the tested TikTok actor only as a supplemental social-listening/opportunity source.
- [ ] Test a better profile-history actor or actor input before using Apify for creator scoring, activity filters, or recent VR-post counts.
- [ ] Deploy the latest dashboard update with follower filters, cleaned conversation review, the Run Monitor interface, and the new Export tab.
- [ ] Keep `SEND_AUTOMATION_ENABLED=false` so scheduled approved sends remain disabled.
- [ ] Keep `DRY_RUN_SEND=true` so dashboard send workflow dispatches remain dry-run only.
- [ ] Review the current 33 creator rows for contact validity and mark valid prospects `contact_ready`; all 33 currently lack public contact.
- [ ] Review the 5 `needs_review` drafts with the improved source/opportunity context; reject weak targets and approve only safe email drafts.
- [ ] Add deeper route-handler tests for the dashboard API write paths if the current schema/helper coverage is not enough.
- [ ] Treat Reddit API credentials as a future upgrade only if RSS collection becomes unreliable.
- [ ] Decide when the project is complete enough to enable schedules; do not enable them yet.

## Last Touches / Non-Immediate

- [ ] Authenticate Codex CLI on the server using XRWorkout's Codex/OpenAI account, not the personal `yorgobekaii` account, when that account is available.

## Completed Setup

- [x] Created a Supabase project for the outreach system.
- [x] Ran `/home/yorgobekaii/xrworkout-outreach/supabase/schema.sql` in the Supabase SQL editor.
- [x] Set up Alex's phone number for Twitch account 2FA so the Twitch developer application could be created.
- [x] Replaced SendGrid with Brevo in the implementation because SendGrid phone verification is not available from Lebanon.
- [x] Configured Brevo-related `.env` fields: `EMAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME`.
- [x] Copied `.env.example` to `.env`.

## Still Undone Or Blocked

- [ ] Scheduled collection/draft/report automation should be enabled only through the dashboard `Clean start` flow or an explicit operator decision.
- [ ] Scheduled approved sending is intentionally disabled with `SEND_AUTOMATION_ENABLED=false`.
- [ ] Follow-up sending is intentionally operator-handled in v1; one pending follow-up is due on 2026-06-01.
- [ ] Apify is intentionally disabled until actor choice, low-limit validation, schema deployment, and Starter-plan usage are reviewed.
