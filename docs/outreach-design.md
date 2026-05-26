# Outreach System Design

This document describes how the XRWorkout outreach system finds, scores, logs, reviews, and follows up on creator and community opportunities.

The operating rule is:

**Agents collect, classify, score, draft, log, and report. Humans approve. Automation sends only approved email drafts.**

## Current Operating State

- Scheduled GitHub Actions jobs are configured, but scheduled automation is intentionally gated by `AUTOMATION_ENABLED`.
- Public comments and DMs remain manual in v1.
- Email sending is approval-only and uses Brevo.
- The dashboard is deployed for day-to-day review and automation controls.
- Supabase remains the source of truth.
- The May 25, 2026 sent email has been manually verified in Brevo.

## Intake Sources

The daily collection workflow pulls from low-volume, official or stable sources:

| Source | Collector | Purpose |
|---|---|---|
| Reddit | `scripts/collect_reddit_rss.py` | Finds public Reddit posts from configured subreddits and keyword search feeds. |
| YouTube | `scripts/collect_youtube.py` | Finds recent videos matching XR and VR fitness keywords. |
| Twitch | `scripts/collect_twitch.py` | Finds Twitch channels matching XR and VR fitness keywords. |

Reddit API credentials are not required for v1 because Reddit RSS is the active Reddit path. The PRAW collector remains in the repository as a future fallback if OAuth/API access is approved.

Configured Reddit subreddits:

- `vrfit`
- `MetaQuestVR`
- `OculusQuest`
- `virtualreality`
- `VRGaming`
- `sidequest`

Configured keywords include:

- `VR fitness`
- `exercise in VR`
- `workout in VR`
- `Meta Quest fitness`
- `Quest workout`
- `best VR fitness app`
- `FitXR alternative`
- `Supernatural alternative`
- `Les Mills BodyCombat`
- `Beat Saber workout`
- `mixed reality workout`
- `controllerless workout`
- `hand tracking fitness`
- `full body VR workout`
- `VR weight loss`
- `VR cardio`
- `XRWorkout`
- `VRWorkout`

## How New Conversations Are Found Daily

The daily collection workflow is configured to run at `14:00 UTC`.

The workflow:

1. Runs the Reddit RSS, YouTube, and Twitch collectors.
2. Converts matching source records into `raw_items`.
3. Deduplicates records with a unique `dedupe_hash`.
4. Runs LLM classification on unprocessed raw items.
5. Promotes strong creator prospects into the `creators` table.

Manual `workflow_dispatch` runs remain available even when scheduled automation is disabled.

## Opportunity Detection

`scripts/classify_opportunities.py` reads unprocessed rows from `raw_items` and asks Codex CLI to classify each item.

The classifier considers:

- Relevance to XRWorkout
- User or creator intent
- Potential reach
- Product fit
- Outreach safety

Supported opportunity types:

- `recommendation_request`
- `complaint`
- `does_vr_fitness_work`
- `creator_opportunity`
- `community_event`
- `press_newsletter`
- `product_feedback`
- `support_issue`
- `competitor_owned`
- `do_not_engage`

Each classified opportunity gets:

- `summary`
- `pain_point`
- `xrworkout_relevance`
- `audience_type`
- `score`
- `priority`
- `recommended_action`
- `outreach_safety`
- `status`

## Creator Detection

`scripts/discover_creators.py` reviews YouTube and Twitch source items and promotes strong creator prospects into `creators`.

Creator records track:

- Name
- Platform
- Profile URL
- Public contact, if available
- Niche
- Audience estimate
- Audience quality
- Recent relevant content
- Fit reason
- Offer angle
- Priority
- Status

Automated email sending requires a valid creator email in `public_contact`.

## Filtering Criteria

The system optimizes for high-quality, low-volume outreach.

Items are filtered by:

- Source match: Reddit, YouTube, or Twitch.
- Keyword or subreddit relevance.
- Deduplication hash.
- LLM relevance and intent scoring.
- Safety classification.
- Priority threshold.
- Whether there is enough context for a specific, useful message.

Drafts are only generated for high-priority opportunities that pass the safety gate.

Current draft eligibility:

- Score is at least `80`.
- Priority is `high`.
- Opportunity status is `new`.
- No existing draft is attached.
- `outreach_safety` is not unsafe.
- `recommended_action` is one of `email`, `dm`, `comment`, or `creator_outreach`.

## Tagging And Prioritization

Priority is score-based:

| Score | Priority |
|---:|---|
| `80-100` | `high` |
| `60-79` | `medium` |
| `0-59` | `low` |

Important tags and fields:

- `platform`
- `opportunity_type`
- `audience_type`
- `pain_point`
- `xrworkout_relevance`
- `score`
- `priority`
- `recommended_action`
- `outreach_safety`
- `status`

High-priority items are reviewed first. Medium-priority items can be monitored or manually reviewed. Low-priority items should normally be left alone unless there is a clear reason to revisit them.

## Channel Decision Rules

The classifier recommends one of:

- `email`
- `dm`
- `comment`
- `monitor`
- `do_not_engage`

The current v1 behavior is:

| Recommended Action | System Behavior |
|---|---|
| `email` | May generate a draft. Automation can send only after human approval and only if a valid email exists. |
| `dm` | May generate draft text, but sending is manual in v1. |
| `comment` | May generate draft text, but posting is manual in v1 and must disclose XRWorkout affiliation. |
| `monitor` | Log and review later if needed. Do not outreach automatically. |
| `do_not_engage` | Do not outreach. |

Operational decision tree:

1. If unsafe, competitor-owned, medical-risk, or low quality, do nothing or monitor.
2. If it is a useful public conversation, prepare a public comment only for manual posting.
3. If a creator has a valid public email and strong fit, generate an email draft.
4. If creator fit exists but no email is available, track the creator and handle any DM manually.
5. If the item is medium or low priority, monitor unless a human explicitly decides otherwise.

## Tracker Structure

Supabase is the tracker and source of truth.

| Table | Purpose |
|---|---|
| `raw_items` | External source inbox for Reddit posts, YouTube videos, and Twitch channels. |
| `opportunities` | Classified, scored, and prioritized outreach opportunities. |
| `creators` | Creator prospects and fit context. |
| `drafts` | Human review queue for generated outreach. |
| `followups` | Follow-up task queue after approved emails are sent. |
| `offers` | Tracks 3-month-free creator offers, redemptions, content commitments, URLs, and outcomes. |
| `dashboard_audit_logs` | Audit trail for dashboard write actions. |

Important workflow statuses:

- Drafts: `needs_review`, `approved`, `sent`, `rejected`, `edit_needed`
- Follow-ups: `pending` and future resolved states
- Opportunities: currently begin as `new`
- Creators: currently begin as `new`

## Human Review Workflow

Operators review opportunities, creators, drafts, and follow-ups in the dashboard. Supabase Studio remains the fallback review surface.

Daily review flow:

1. Review high-priority opportunities.
2. Review new creator rows for fit and contact validity.
3. Review drafts with `status = needs_review`.
4. Reject weak targets instead of trying to repair bad fit.
5. Mark drafts `edit_needed` when the target is good but the copy needs work.
6. Approve only safe, useful email drafts.
7. Let the approved-send workflow process approved email drafts.
8. Track due follow-ups and outcomes.

## Anti-Spam Rules

Automation must not:

- Auto-post public comments.
- Auto-DM people.
- Send drafts unless `status = approved`.
- Send rejected, edit-needed, needs-review, or already-sent drafts.
- Make medical, weight-loss, or guaranteed health outcome claims.
- Pretend to be a neutral user when representing XRWorkout.

Human approval is required for:

- Creator emails.
- Any 3-month-free offer.
- Competitor comparisons.
- Public community replies.
- Medical, weight-loss, or sensitive health language.

Public comments must disclose affiliation with XRWorkout.

## Follow-Up Tracking

Configured cadence:

| Timing | Action |
|---|---|
| Day 0 | Initial email. |
| Day 5-7 | One helpful follow-up. |
| Day 14 | Final soft close. |
| After engagement | Stop automatic follow-up and handle manually. |

Current implementation:

- When an approved email is sent, the sender marks the draft `sent`.
- The sender creates the first follow-up task.
- The first follow-up is currently scheduled 7 days after send.
- The schema and rules support step 1 and step 2.

Not fully automated yet:

- Processing due follow-ups.
- Drafting follow-up text from pending follow-up rows.
- Closing follow-up tasks after reply or manual operator action.

## Suggested Automation Steps

Current and recommended agent steps:

1. Collect Reddit RSS, YouTube, and Twitch items daily.
2. Deduplicate source items into `raw_items`.
3. Classify raw items into `opportunities`.
4. Score and prioritize opportunities.
5. Discover creator prospects into `creators`.
6. Generate drafts only for safe, high-priority opportunities.
7. Store drafts as `needs_review`.
8. Have a human review drafts in the dashboard.
9. Send only approved email drafts through Brevo.
10. Create follow-up tasks after sent emails.
11. Report weekly on source volume, opportunities, drafts, sends, and follow-ups.
12. Add due-follow-up processing before scaling scheduled sending.

## Known Gaps

- Scheduled automation should remain disabled until one more clean collection, draft, and send validation cycle is complete.
- Due-follow-up processing is not automated yet.
- Reddit API credentials are not configured and should stay a future upgrade unless RSS becomes unreliable.
- Public comments and DMs are manual in v1.
- XRWorkout-owned Codex CLI authentication should replace personal server authentication when the XRWorkout account is available.
