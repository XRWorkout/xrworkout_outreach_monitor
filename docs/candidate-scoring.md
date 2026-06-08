# Outreach Candidate Scoring

This document defines how XRWorkout should score outreach candidates before a human approves creator outreach, comments, DMs, or email drafts.

The goal is high-quality, low-volume outreach. A candidate should rank highly because there is recent, specific evidence that XRWorkout is relevant to them or their audience, not because a keyword appeared once or because an email address was easy to find.

## Two Scores, Two Decisions

Use two related but separate scores.

| Score | Question It Answers | Stored Today |
|---|---|---|
| Opportunity score | Is this conversation or post worth responding to? | `opportunities.score` |
| Creator quality score | Is this creator worth outreach or an offer? | Review model for `creators` |

The opportunity score is conversation-level. It helps decide whether a Reddit post, YouTube video, or Twitch channel record should become an outreach opportunity.

The creator quality score is person-level. It helps decide whether a creator should be reviewed first, enriched with more evidence, contacted manually, or ignored.

## Opportunity Score

The existing opportunity score remains a 0-100 score based on:

- Relevance to XRWorkout.
- User or creator intent.
- Potential reach.
- Product fit.
- Outreach safety.

Priority bands:

| Score | Priority | Default Action |
|---:|---|---|
| `80-100` | `high` | Eligible for draft generation if safety and channel rules pass. |
| `60-79` | `medium` | Monitor or manually inspect before drafting. |
| `0-59` | `low` | Usually leave alone. |

Drafts should only be generated for high-priority opportunities that pass safety rules and have enough context for a specific message.

## Creator Quality Score

Use this 100-point model when reviewing creator candidates.

| Factor | Weight | High-Quality Signal |
|---|---:|---|
| VR/XR proof | 25 | Recent posts clearly show VR, Quest, MR, XR, VR games, or headset ownership/usage. |
| Fitness/movement fit | 20 | Content connects to workouts, cardio, boxing, dance, wellness, rhythm games, active gaming, or body movement. |
| Recency and activity | 15 | Posted recently and has multiple relevant posts in the last 90 days, not one stale keyword match. |
| Audience quality and engagement | 15 | Comments, views, likes, or live engagement suggest real topic-aligned audience interest. |
| Reach and creator size | 10 | Audience is large enough to matter, but follower count is capped so it does not overpower fit. |
| Contactability and channel fit | 10 | Public email, business contact, or clear manual DM path exists. |
| Safety and brand fit | 5 | No spam, kids-content risk, unsafe medical claims, deceptive content, or obvious brand mismatch. |

### Priority Bands

| Creator Score | Priority | Action |
|---:|---|---|
| `85-100` | A / high | Review first. If contact is valid and safety is clean, prepare creator outreach. |
| `70-84` | B / medium | Keep in the review queue. Manually inspect recent posts before drafting. |
| `50-69` | C / low | Monitor or enrich with more evidence. Do not draft automatically. |
| `0-49` | Reject / ignore | Leave alone unless a human sees a specific strategic reason. |

## Minimum Evidence Rules

A high-priority creator should usually have all of the following:

- At least one recent VR/XR proof point.
- At least one recent movement, fitness, active-gaming, or wellness proof point.
- Recent relevant activity, ideally two or more relevant posts in the last 90 days.
- Real audience engagement, even if the creator is small.
- A specific reason XRWorkout is useful to their content or audience.

Strong positive signals include:

- Quest workout content.
- Supernatural, FitXR, Les Mills BodyCombat, Beat Saber workout, or similar VR-fitness content.
- Mixed-reality fitness or hand-tracking workout content.
- Controllerless workout, full-body VR workout, VR cardio, or active gaming content.
- A visible headset in recent content.
- A profile, channel description, or post history that repeatedly connects VR/XR with fitness, movement, or wellness.

If no headset signal exists, do not mark the creator `contact_ready` without manual review.

## Recency Rules

Recency should matter because old interest does not always mean current outreach relevance.

| Recent Evidence | Guidance |
|---|---|
| Relevant post in last 30 days | Strong positive signal. |
| Multiple relevant posts in last 90 days | Strong high-priority evidence. |
| One relevant post in last 90 days | Useful, but inspect the profile before drafting. |
| No relevant post in last 90 days | Usually not high priority unless the profile is explicitly dedicated to VR fitness. |
| No visible recent activity | Penalize heavily or reject. |

Use time decay: old relevant posts should not keep a creator ranked high forever.

## Contactability Rules

Contactability affects workflow priority, not product fit.

Good contact signals:

- Public business email.
- Creator contact form.
- Clear business inquiry instructions.
- Platform DM path suitable for manual outreach.

Bad contact signals:

- No public contact path.
- Personal-only or ambiguous contact details.
- Contact details copied from unrelated sources.
- Email that appears invalid, private, or scraped without context.

Do not let a public email alone make a creator high priority. Contact data is only useful after relevance, recency, audience quality, and safety are present.

## Safety Hard Stops

Do not outreach candidates with these signals:

- Official competitor-owned accounts.
- Official brand/company accounts where creator outreach is not appropriate.
- Spam, fake engagement, or low-quality scraped profiles.
- Accounts aimed primarily at children.
- Unsafe medical, weight-loss, or guaranteed health-outcome claims.
- No identifiable creator or no reviewable profile context.
- Deceptive content or content that conflicts with XRWorkout brand safety.

For these candidates, use `do_not_engage`, reject the draft, or leave the creator out of the contact-ready pipeline.

## Penalties

Apply strong penalties for:

- Broad gaming creators with no clear VR/XR bridge.
- Broad tech creators with only one weak VR mention.
- Generic fitness creators with no headset, VR, XR, or active-gaming evidence.
- Inactive accounts.
- Keyword matches that only came from the search query, not the creator's own content.
- Large follower counts with weak engagement.
- Repeated low-quality matches from the same source.

## Practical Examples

| Candidate | Likely Score | Reason |
|---|---:|---|
| Quest creator posted two VR workout videos in the last month, gets real comments, and has a public business email. | `90-100` | Strong VR proof, movement fit, recency, engagement, and contactability. |
| Beat Saber creator occasionally frames videos as cardio, posts weekly, but has no public email. | `75-85` | Strong active-gaming fit, good recency, manual contact needed. |
| General gaming creator posted one VR video six months ago. | `40-60` | Weak recency and weak product fit. |
| Fitness creator with no VR/headset/active-gaming evidence. | `20-45` | Movement fit exists, but XRWorkout relevance is not proven. |
| Huge tech channel with one Quest news video and no fitness angle. | `30-55` | Reach exists, but fit is weak. |
| Creator account with unsafe weight-loss promises or child-focused content. | `0` | Hard stop. |

## Dashboard Review Guidance

When reviewing creators:

1. Start with creators marked high or medium priority.
2. Open the profile and recent relevant content.
3. Confirm VR/XR proof, movement fit, recency, and safety.
4. Validate the public contact manually before marking a creator `contact_ready`.
5. Reject weak targets instead of editing around poor fit.
6. Approve only messages that are specific, low-pressure, affiliation-clear, and free of health-outcome overclaims.

Use the score to order review work. Use human judgment to approve outreach.

## Implementation Notes

Current database fields already support the review model:

- `creators.niche`
- `creators.follower_count`
- `creators.audience_estimate`
- `creators.audience_quality`
- `creators.recent_relevant_content`
- `creators.fit_reason`
- `creators.offer_angle`
- `creators.priority`
- `creators.status`
- `creators.public_contact`

Future implementation can add explicit numeric creator sub-scores, but v1 can apply this rubric through LLM classification, dashboard review, and operator validation before outreach approval.
