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

On the server, install and configure the GitHub runner from the repository settings, then start it from the same account that has Codex CLI authentication. Verify from that account:

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
