# Runbook

## Daily review

1. Open Supabase Studio.
2. Review `opportunities` where `priority = high`.
3. Review `drafts` where `status = needs_review`.
4. Edit draft text if needed.
5. Mark safe drafts as `approved`.
6. Mark weak drafts as `rejected` or `edit_needed`.

## Failed GitHub Actions

1. Open the failed workflow run.
2. Check whether the failure is API credentials, quota, network, or schema-related.
3. Re-run after fixing the secret or data issue.
4. If an email-send job fails mid-run, check `drafts.status` before retrying. Only `approved` drafts are eligible for sending.

## Self-hosted runner Codex check

The LLM-dependent workflows must run on a self-hosted runner whose service account can run Codex CLI non-interactively.

Use XRWorkout-owned accounts for production automation. The personal development account can commit and push code to `yorgobekaii/xr_workout_outreach_monitor`, but GitHub Actions should run from `XRWorkout/xrworkout_outreach_monitor`. The GitHub runner, Codex CLI auth, Reddit app, Supabase, and email provider credentials should belong to XRWorkout.

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
```

The daily collection and daily drafts workflows run this same check before any LLM-dependent pipeline step.

## Weekly review

Check:

- New conversations found.
- New creators found.
- Drafts approved/sent.
- Replies and commitments.
- Sources producing useful opportunities.
- Product feedback and repeated objections.
