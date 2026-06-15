#!/usr/bin/env python
from __future__ import annotations

from collections import defaultdict
from datetime import date
from statistics import mean

from xroutreach.config import settings
from xroutreach.db import OutreachDB


def rows(db: OutreachDB, table: str, select: str) -> list[dict]:
    result = db.client.table(table).select(select).execute()
    return result.data or []


def optional_rows(db: OutreachDB, table: str, select: str) -> list[dict]:
    try:
        return rows(db, table, select)
    except Exception:
        return []


def source_cluster(source: str | None) -> str:
    normalized = (source or "unknown").lower()
    normalized = normalized.replace("-", "_").replace(" ", "_")
    if normalized in {"apify_x", "apify_twitter", "twitter"}:
        return "x"
    if normalized in {"tiktok", "tik_tok"}:
        return "apify_tiktok"
    if normalized == "instagram":
        return "apify_instagram"
    if normalized in {"apify_facebook", "apify_facebook_group", "apify_facebook_groups", "facebook", "facebook_groups"}:
        return "facebook_group"
    if normalized in {"apify_discord", "discord_server"}:
        return "discord"
    if normalized == "vr_forums":
        return "vr_forum"
    if normalized == "blogs":
        return "vr_blog"
    return normalized


def source_quality(raw_items: list[dict], opportunities: list[dict], drafts: list[dict], creators: list[dict] | None = None) -> list[dict]:
    raw_counts: dict[str, int] = defaultdict(int)
    for item in raw_items:
        raw_counts[source_cluster(item.get("source"))] += 1

    creator_counts: dict[str, int] = defaultdict(int)
    for creator in creators or []:
        creator_counts[source_cluster(creator.get("platform"))] += 1

    draft_counts: dict[str, int] = defaultdict(int)
    approved_sent_counts: dict[str, int] = defaultdict(int)
    for draft in drafts:
        opportunity = draft.get("opportunities") or {}
        raw_item = opportunity.get("raw_items") or {}
        source = source_cluster(raw_item.get("source") or opportunity.get("platform"))
        draft_counts[source] += 1
        if draft.get("status") in {"approved", "sent"}:
            approved_sent_counts[source] += 1

    grouped: dict[str, list[dict]] = defaultdict(list)
    for opportunity in opportunities:
        grouped[source_cluster(opportunity.get("platform"))].append(opportunity)

    all_sources = set(raw_counts) | set(grouped) | set(draft_counts) | set(creator_counts)
    quality = []
    for source in sorted(all_sources):
        source_opportunities = grouped.get(source, [])
        scores = [int(row.get("score") or 0) for row in source_opportunities]
        high_count = sum(1 for row in source_opportunities if row.get("priority") == "high")
        quality.append(
            {
                "source": source,
                "raw_items": raw_counts[source],
                "opportunities": len(source_opportunities),
                "high_priority": high_count,
                "creators": creator_counts[source],
                "average_score": round(mean(scores), 1) if scores else 0,
                "drafts": draft_counts[source],
                "approved_or_sent": approved_sent_counts[source],
            }
        )

    return sorted(
        quality,
        key=lambda row: (row["high_priority"], row["average_score"], row["drafts"], row["raw_items"]),
        reverse=True,
    )


def creator_evidence_basis(creator: dict) -> str:
    evidence = creator.get("evidence_json") if isinstance(creator.get("evidence_json"), dict) else {}
    quality = str(evidence.get("computed_evidence_quality") or "").lower()
    enrichment = evidence.get("profile_enrichment") if isinstance(evidence.get("profile_enrichment"), dict) else {}
    if quality in {"profile_history", "profile_history_plus_observed"}:
        return "profile_history"
    if quality in {"accumulated_observed_posts", "observed_post", "conversation_author"}:
        return "observed_only"
    if enrichment.get("status") == "failure":
        return "enrichment_failed"
    return "unknown"


def due_followup_count(followups: list[dict], as_of: date) -> int:
    return sum(
        1
        for row in followups
        if row.get("status") == "pending" and row.get("due_date") and date.fromisoformat(row["due_date"]) <= as_of
    )


def main() -> None:
    db = OutreachDB(settings())
    counts = db.weekly_counts()
    today = date.today()
    raw_items = rows(db, "raw_items", "source")
    opportunities = rows(db, "opportunities", "platform, priority, score, status")
    drafts = rows(db, "drafts", "status, channel, opportunities(platform, raw_items(source))")
    creators = rows(db, "creators", "platform, status, public_contact, creator_quality_score, headset_confidence, activity_level, evidence_json")
    followups = rows(db, "followups", "status, due_date")
    llm_events = optional_rows(db, "llm_usage_events", "task, provider, model, status, fallback_used")
    quality = source_quality(raw_items, opportunities, drafts, creators)

    print("XRWorkout outreach weekly report")
    print("================================")
    for table, count in counts.items():
        print(f"{table}: {count}")
    print("")
    print("Action queue")
    print("------------")
    print(f"high-priority opportunities: {sum(1 for row in opportunities if row.get('priority') == 'high')}")
    print(f"drafts needing review: {sum(1 for row in drafts if row.get('status') == 'needs_review')}")
    print(f"approved drafts: {sum(1 for row in drafts if row.get('status') == 'approved')}")
    print(f"sent drafts: {sum(1 for row in drafts if row.get('status') == 'sent')}")
    print(f"rejected drafts: {sum(1 for row in drafts if row.get('status') == 'rejected')}")
    print(f"creators missing contact: {sum(1 for row in creators if not row.get('public_contact'))}")
    print(f"creators contact-ready: {sum(1 for row in creators if row.get('status') == 'contact_ready')}")
    print(f"creators A-score: {sum(1 for row in creators if int(row.get('creator_quality_score') or 0) >= 85)}")
    print(f"creators with headset evidence: {sum(1 for row in creators if row.get('headset_confidence') in {'high', 'medium'})}")
    print(f"active creators: {sum(1 for row in creators if row.get('activity_level') in {'high', 'medium'})}")
    evidence_counts: dict[str, int] = defaultdict(int)
    for row in creators:
        evidence_counts[creator_evidence_basis(row)] += 1
    print(f"creator evidence basis: {dict(sorted(evidence_counts.items()))}")
    print(f"due or overdue follow-ups: {due_followup_count(followups, today)}")
    print(f"LLM events: {len(llm_events)}")
    print(f"LLM fallbacks to Codex: {sum(1 for row in llm_events if row.get('fallback_used'))}")
    print(f"LLM failures: {sum(1 for row in llm_events if row.get('status') == 'failure')}")
    if llm_events:
        by_provider: dict[str, int] = defaultdict(int)
        for row in llm_events:
            by_provider[f"{row.get('provider')}/{row.get('model') or 'default'}"] += 1
        print(f"LLM provider usage: {dict(sorted(by_provider.items()))}")
    print("")
    print("Source quality")
    print("--------------")
    if quality:
        best = quality[0]
        print(
            "best source: "
            f"{best['source']} "
            f"({best['high_priority']} high-priority, "
            f"avg score {best['average_score']}, "
            f"{best['drafts']} drafts, "
            f"{best['approved_or_sent']} approved/sent)"
        )
        for row in quality:
            print(
                f"{row['source']}: raw={row['raw_items']} "
                f"opportunities={row['opportunities']} high={row['high_priority']} "
                f"creators={row['creators']} avg_score={row['average_score']} drafts={row['drafts']} "
                f"approved_or_sent={row['approved_or_sent']}"
            )
    else:
        print("No source rows available yet.")
    print("")
    print("Review high-priority opportunities, needs_review drafts, missing-contact creators, and due follow-ups in the dashboard.")


if __name__ == "__main__":
    main()
