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

## Weekly review

Check:

- New conversations found.
- New creators found.
- Drafts approved/sent.
- Replies and commitments.
- Sources producing useful opportunities.
- Product feedback and repeated objections.

