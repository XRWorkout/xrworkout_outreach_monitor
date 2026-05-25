# Secrets

Configure these in GitHub repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `REDDIT_USER_AGENT`
- `YOUTUBE_API_KEY`
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `BREVO_API_KEY`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`

Optional repository variables:

- `CODEX_BIN`: defaults to `codex`.
- `CODEX_MODEL`: optional; when empty, Codex CLI uses its configured default model.
- `CODEX_TIMEOUT_SECONDS`: defaults to `300`.
- `XRWORKOUT_FOUNDER_NAME`: used in outreach drafts.
- `EMAIL_PROVIDER`: defaults to `brevo`.
- `DRY_RUN_SEND`: keep `true` until approved-send behavior is verified.

## Dashboard environment

Configure these in Vercel for the `dashboard/` app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DASHBOARD_OPERATOR_EMAILS`: comma-separated approved operator emails.
- `DASHBOARD_GITHUB_TOKEN`: fine-grained GitHub token for `XRWorkout/xrworkout_outreach_monitor`.
- `DASHBOARD_GITHUB_OWNER`: defaults to `XRWorkout`.
- `DASHBOARD_GITHUB_REPO`: defaults to `xrworkout_outreach_monitor`.

The GitHub token needs:

- Repository metadata read.
- Repository Actions read/write.
- Repository variables read/write.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `DASHBOARD_GITHUB_TOKEN` as public `NEXT_PUBLIC_*` variables.
