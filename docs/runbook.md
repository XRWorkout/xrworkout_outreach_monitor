# Runbook

## Daily review

1. Open XRWorkout Outreach OS.
2. Start on Dashboard for KPIs, high-priority opportunities, the live feed, and AI-style recommendations.
3. Use Conversations for social listening filters and source context.
4. Use Creators to validate fit, public contact, priority, and offer angle.
5. Use Outreach to review `drafts` where `status = needs_review`.
6. Edit draft subject/body in the review drawer if needed.
7. Mark safe email drafts as `approved`; mark weak drafts as `rejected` or `edit_needed`.
8. Use "Approve + dry-run" only while `DRY_RUN_SEND=true`.
9. Review due follow-ups and mark each one `completed` or `skipped` after the operator handles it.
10. Use Analytics to check source quality before adding more sources.

Supabase Studio remains the fallback for direct database inspection.

## Dashboard automation controls

The dashboard can update GitHub repository variables and dispatch existing workflows.

- Keep `AUTOMATION_ENABLED=false` until scheduled automation should start.
- Keep `SEND_AUTOMATION_ENABLED=false`; it controls only scheduled approved-send jobs.
- Keep `DRY_RUN_SEND=true` so dashboard send dispatches are dry-run only.
- Use manual workflow dispatches from the dashboard for collection, batch draft generation, selected-opportunity LLM draft generation, approved-send dry runs, and reports.
- The dashboard does not send email directly through Brevo; it only triggers the existing GitHub Actions sender.
- Dashboard write actions are logged in `dashboard_audit_logs`.

## Follow-up queue

Use the Outreach view's Scheduled Follow-Ups section as the primary queue. It shows due date, cadence step, original draft context, creator contact, and any operator follow-up note.

For a terminal backup view:

```bash
python scripts/list_due_followups.py --as-of 2026-06-01
python scripts/list_due_followups.py --as-of 2026-06-01 --format json
```

Follow-ups remain operator-handled in v1. The system does not auto-send follow-up messages.

## Failed GitHub Actions

1. Open the failed workflow run.
2. Check whether the failure is API credentials, quota, network, or schema-related.
3. Re-run after fixing the secret or data issue.
4. If an email-send job fails mid-run, check `drafts.status` before retrying. Only `approved` drafts are eligible for sending.

## Self-hosted runner LLM checks

The LLM-dependent workflows must run on a self-hosted runner whose service account can run Codex CLI non-interactively and can reach Ollama Cloud with `OLLAMA_API_KEY`.

Use XRWorkout-owned accounts for production automation. The personal development account can commit and push code to `yorgobekaii/xr_workout_outreach_monitor`, but GitHub Actions should run from `XRWorkout/xrworkout_outreach_monitor`. The GitHub runner, Codex CLI auth, Ollama Pro account, Reddit app, Supabase, and email provider credentials should belong to XRWorkout.

## GitHub remotes

This machine is configured for two GitHub remotes:

- `origin`: `git@github.com:yorgobekaii/xr_workout_outreach_monitor.git`
- `xrworkout`: `git@github.com:XRWorkout/xrworkout_outreach_monitor.git`
- `xrworkout-deploy`: `git@github-xrworkout:XRWorkout/xrworkout_outreach_monitor.git`

The `xrworkout` remote uses the normal personal GitHub SSH identity, so the personal account must be added to `XRWorkout/xrworkout_outreach_monitor` as an admin or maintainer collaborator. Commits use the repo's local `user.name` and `user.email`, currently configured as the personal GitHub no-reply identity.

The `github-xrworkout` SSH host alias uses `/home/yorgobekaii/.ssh/id_ed25519_github_xrworkout`. The matching public key is also installed as a write deploy key on `XRWorkout/xrworkout_outreach_monitor` and is available through the `xrworkout-deploy` remote if a machine/service key is needed.

To push the current branch to both remotes:

```bash
scripts/push_remotes.sh
```

On the server, install and configure the GitHub runner from `XRWorkout/xrworkout_outreach_monitor` repository settings, then start it from the XRWorkout-owned server account that has Codex CLI authentication. Verify from that account:

```bash
cd /home/yorgobekaii/xrworkout-outreach
. .venv/bin/activate
python scripts/check_codex_cli.py
python scripts/check_ollama_cloud.py
```

The daily collection, clean start, manual source collection, and self-hosted smoke workflows run the Ollama check when `CHEAP_LLM_ENABLED=true`. Draft-only workflows still check Codex because final outreach copy stays on Codex.

## Weekly review

Check:

- New conversations found.
- New creators found.
- Drafts approved/sent.
- Replies and commitments.
- Sources producing useful opportunities.
- Product feedback and repeated objections.
