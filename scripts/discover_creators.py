#!/usr/bin/env python
from __future__ import annotations

import argparse
import re
from collections import defaultdict
from typing import Any

from xroutreach.config import settings
from xroutreach.creator_scoring import creator_evidence_from_item, priority_for_creator_score
from xroutreach.db import OutreachDB
from xroutreach.llm import LLM


STRONG_CREATOR_PHRASES = [
    "vr fitness",
    "vrfitness",
    "vr workout",
    "vrworkout",
    "quest fitness",
    "quest workout",
    "meta quest fitness",
    "mixed reality workout",
    "beat saber workout",
    "fitxr",
    "supernatural",
    "les mills",
    "bodycombat",
    "xrworkout",
]

VR_TERMS = ["vr", "virtual reality", "quest", "meta quest", "mixed reality", "mr", "xr"]
MOVEMENT_TERMS = [
    "fitness",
    "workout",
    "exercise",
    "cardio",
    "boxing",
    "dance",
    "wellness",
    "gym",
]

EMAIL_RE = re.compile(r"(?<![A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![A-Z0-9._%+-])", re.IGNORECASE)

PLATFORM_ALIASES = {
    "tiktok": "apify_tiktok",
    "tik_tok": "apify_tiktok",
    "instagram": "apify_instagram",
    "x": "apify_x",
    "twitter": "apify_x",
    "apify_twitter": "apify_x",
    "facebook": "apify_facebook",
    "facebook_group": "apify_facebook_group",
    "facebook_groups": "apify_facebook_group",
    "facebook groups": "apify_facebook_group",
    "apify_facebook_groups": "apify_facebook_group",
    "discord": "apify_discord",
}

APIFY_CONVERSATION_SOURCES = {
    "apify",
    "apify_instagram",
    "apify_tiktok",
    "apify_social",
    "apify_x",
    "apify_twitter",
    "apify_facebook",
    "apify_facebook_group",
    "apify_discord",
}


def normalize_platform(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace("-", "_")
    normalized = re.sub(r"\s+", "_", normalized)
    return PLATFORM_ALIASES.get(normalized, normalized)


def canonical_profile_url(item: dict[str, Any], fit: dict[str, Any]) -> str | None:
    source = normalize_platform(fit.get("platform") or item.get("source"))
    author_url = item.get("author_url")
    fit_url = fit.get("profile_url")
    source_url = item.get("source_url")
    if isinstance(author_url, str) and author_url.strip():
        return author_url.strip()
    if isinstance(fit_url, str) and fit_url.strip():
        return fit_url.strip()
    if source in {"youtube", "twitch"} and isinstance(source_url, str) and source_url.strip():
        return source_url.strip()
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    source_type = str(raw_json.get("source_type") or "")
    if source_type in {"profile_history", "profile_lead", "contact_enrichment"} and isinstance(source_url, str) and source_url.strip():
        return source_url.strip()
    return None




def creator_profile_key(item: dict[str, Any], fit: dict[str, Any] | None = None) -> tuple[str, str] | None:
    fit = fit or {}
    platform = normalize_platform(fit.get("platform") or item.get("source"))
    profile_url = canonical_profile_url(item, fit)
    if not profile_url and isinstance(item.get("author_url"), str) and item.get("author_url").strip():
        profile_url = item.get("author_url").strip()
    if not profile_url:
        return None
    normalized_url = profile_url.strip().lower().rstrip("/")
    return platform, normalized_url


def group_items_by_creator(items: list[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for item in items:
        key = creator_profile_key(item)
        if key:
            grouped[key].append(item)
    return grouped


def normalize_profile_url_for_storage(value: str | None) -> str | None:
    return value.strip().lower().rstrip("/") if isinstance(value, str) and value.strip() else None

def public_contact_from_item(item: dict[str, Any]) -> str | None:
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    public_contact = raw_json.get("public_contact")
    if isinstance(public_contact, str) and public_contact.strip():
        return public_contact.strip()

    text = "\n".join(
        str(value or "")
        for value in [
            item.get("title"),
            item.get("body"),
            item.get("author_name"),
            raw_json.get("keyword"),
        ]
    )
    match = EMAIL_RE.search(text)
    return match.group(1) if match else None


def follower_count_from_item(item: dict[str, Any]) -> int | None:
    count = item.get("follower_count")
    if isinstance(count, int) and count >= 0:
        return count
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    raw_count = raw_json.get("follower_count")
    return raw_count if isinstance(raw_count, int) and raw_count >= 0 else None


def has_reliable_creator_history(item: dict[str, Any]) -> bool:
    source = str(item.get("source") or "")
    if not source.startswith("apify"):
        return True
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    evidence = raw_json.get("creator_evidence") if isinstance(raw_json.get("creator_evidence"), dict) else {}
    return evidence.get("history_quality") == "profile_history"


def is_apify_conversation_author_lead(item: dict[str, Any]) -> bool:
    source = normalize_platform(item.get("source"))
    if source not in APIFY_CONVERSATION_SOURCES:
        return False
    if has_reliable_creator_history(item):
        return False
    name = item.get("author_name")
    url = item.get("author_url")
    if not isinstance(name, str) or not name.strip():
        return False
    if not isinstance(url, str) or not url.strip():
        return False
    return True


def has_term(text: str, term: str) -> bool:
    if " " in term:
        return term in text
    return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None


def has_creator_signal(text: str) -> bool:
    if any(phrase in text for phrase in STRONG_CREATOR_PHRASES):
        return True
    has_vr_context = any(has_term(text, term) for term in VR_TERMS)
    has_movement_context = any(has_term(text, term) for term in MOVEMENT_TERMS)
    return has_vr_context and has_movement_context


def fallback_creator_fit(item: dict[str, Any], related_items: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    profile_url = item.get("author_url") or item.get("source_url")
    name = item.get("author_name")
    if not name or not profile_url:
        return None

    haystack = " ".join(
        str(value or "")
        for value in [
            item.get("title"),
            item.get("body"),
            item.get("author_name"),
            item.get("source_url"),
        ]
    ).lower()
    if not has_creator_signal(haystack):
        return None

    evidence = creator_evidence_from_item(item, related_items=related_items)
    return {
        "raw_item_id": item.get("id"),
        "name": name,
        "platform": item.get("source"),
        "profile_url": profile_url,
        "public_contact": public_contact_from_item(item),
        "niche": "Potential VR fitness creator",
        "follower_count": follower_count_from_item(item),
        "audience_estimate": "Unknown",
        "audience_quality": "Needs human review",
        "fit_reason": "Matched XRWorkout creator discovery keywords; review manually.",
        "talks_about": "VR, fitness, gaming, or wellness keyword match",
        "offer_angle": "Evaluate fit for a low-pressure XRWorkout creator offer.",
        "creator_quality_score": evidence["creator_quality_score"],
        "recent_vr_posts_count": evidence["recent_vr_posts_count"],
        "recent_total_posts_count": evidence["recent_total_posts_count"],
        "last_post_at": evidence["last_post_at"],
        "activity_level": evidence["activity_level"],
        "vr_involvement_evidence": evidence["vr_involvement_evidence"],
        "movement_fit_evidence": evidence["movement_fit_evidence"],
        "headset_evidence": evidence["headset_evidence"],
        "headset_confidence": evidence["headset_confidence"],
        "engagement_evidence": evidence["engagement_evidence"],
        "contactability_evidence": evidence["contactability_evidence"],
        "safety_notes": evidence["safety_notes"],
        "priority": priority_for_creator_score(evidence["creator_quality_score"]),
    }


def conversation_author_lead_fit(item: dict[str, Any], related_items: list[dict[str, Any]] | None = None) -> dict[str, Any] | None:
    if not is_apify_conversation_author_lead(item):
        return None

    haystack = " ".join(
        str(value or "")
        for value in [
            item.get("title"),
            item.get("body"),
            item.get("author_name"),
            item.get("source_url"),
        ]
    ).lower()
    if not has_creator_signal(haystack):
        return None

    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    source_type = str(raw_json.get("source_type") or "social_post").replace("_", " ")
    engagement = raw_json.get("engagement") if isinstance(raw_json.get("engagement"), dict) else {}
    engagement_bits = ", ".join(f"{key}: {value}" for key, value in engagement.items() if value is not None)
    evidence = creator_evidence_from_item(item, related_items=related_items)
    score = min(int(evidence["creator_quality_score"]), 69)
    return {
        "raw_item_id": item.get("id"),
        "name": item.get("author_name"),
        "platform": normalize_platform(item.get("source")),
        "profile_url": item.get("author_url"),
        "public_contact": public_contact_from_item(item),
        "niche": "Conversation author lead",
        "follower_count": follower_count_from_item(item),
        "audience_estimate": "Unknown" if not item.get("follower_count") else f"{item.get('follower_count')} visible followers or members",
        "audience_quality": "Needs manual review from conversation context",
        "fit_reason": (
            f"Review-only creator lead from a public {source_type}; "
            "the source content matched XRWorkout creator keywords."
        ),
        "talks_about": "VR, fitness, gaming, or wellness signal in a public conversation",
        "offer_angle": "Review manually for comment, DM, or later creator outreach. Do not auto-contact.",
        "creator_quality_score": score,
        "recent_vr_posts_count": evidence["recent_vr_posts_count"],
        "recent_total_posts_count": evidence["recent_total_posts_count"],
        "last_post_at": evidence["last_post_at"],
        "activity_level": evidence["activity_level"],
        "vr_involvement_evidence": evidence["vr_involvement_evidence"],
        "movement_fit_evidence": evidence["movement_fit_evidence"],
        "headset_evidence": evidence["headset_evidence"],
        "headset_confidence": evidence["headset_confidence"],
        "engagement_evidence": engagement_bits,
        "contactability_evidence": "Public profile URL captured; no email assumed.",
        "safety_notes": "Review-only conversation author lead from public source data.",
        "priority": "medium" if score >= 60 else "low",
        "lead_source_type": "conversation_author",
        "source_url": item.get("source_url"),
    }


def creator_row(item: dict[str, Any], fit: dict[str, Any], related_items: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    fit_reason = fit.get("fit_reason", "")
    talks_about = fit.get("talks_about")
    if talks_about:
        fit_reason = f"Talks about: {talks_about}. Fit: {fit_reason}"

    evidence = creator_evidence_from_item(item, fit, related_items=related_items)
    priority = fit.get("priority") or priority_for_creator_score(evidence["creator_quality_score"])
    if evidence["creator_quality_score"] < 85 and priority == "high":
        priority = priority_for_creator_score(evidence["creator_quality_score"])

    return {
        "name": fit.get("name") or item.get("author_name") or "Unknown",
        "platform": normalize_platform(fit.get("platform") or item["source"]),
        "profile_url": normalize_profile_url_for_storage(canonical_profile_url(item, fit)),
        "public_contact": fit.get("public_contact") or public_contact_from_item(item),
        "niche": fit.get("niche", ""),
        "follower_count": follower_count_from_item(item),
        "audience_estimate": fit.get("audience_estimate", ""),
        "audience_quality": fit.get("audience_quality", ""),
        "recent_relevant_content": item.get("source_url"),
        "fit_reason": fit_reason,
        "offer_angle": fit.get("offer_angle", ""),
        "priority": priority,
        "status": "new",
        "creator_quality_score": evidence["creator_quality_score"],
        "recent_vr_posts_count": evidence["recent_vr_posts_count"],
        "recent_total_posts_count": evidence["recent_total_posts_count"],
        "last_post_at": evidence["last_post_at"],
        "activity_level": evidence["activity_level"],
        "vr_involvement_evidence": evidence["vr_involvement_evidence"],
        "movement_fit_evidence": evidence["movement_fit_evidence"],
        "headset_evidence": evidence["headset_evidence"],
        "headset_confidence": evidence["headset_confidence"],
        "engagement_evidence": evidence["engagement_evidence"],
        "contactability_evidence": evidence["contactability_evidence"],
        "safety_notes": evidence["safety_notes"],
        "evidence_json": evidence["evidence_json"],
    }


def fit_source_item(items_by_id: dict[str, dict[str, Any]], fit: dict[str, Any]) -> dict[str, Any] | None:
    raw_item_id = fit.get("raw_item_id")
    if raw_item_id and raw_item_id in items_by_id:
        return items_by_id[raw_item_id]
    profile_url = fit.get("profile_url")
    if profile_url:
        for item in items_by_id.values():
            if profile_url in {item.get("author_url"), item.get("source_url")}:
                return item
    return None


def promote_fallback_items(
    db: OutreachDB,
    items: list[dict[str, Any]],
    used_item_ids: set[str],
    related_items_by_creator: dict[tuple[str, str], list[dict[str, Any]]] | None = None,
) -> tuple[int, int]:
    created = 0
    skipped = 0
    for item in items:
        if item.get("id") in used_item_ids:
            continue
        related_items = (related_items_by_creator or {}).get(creator_profile_key(item) or ("", ""), [])
        fallback_fit = fallback_creator_fit(item, related_items=related_items)
        if not fallback_fit:
            skipped += 1
            continue
        db.upsert_creator(creator_row(item, fallback_fit, related_items=related_items))
        created += 1
        if item.get("id"):
            used_item_ids.add(item["id"])
    return created, skipped


def promote_conversation_author_leads(
    db: OutreachDB,
    items: list[dict[str, Any]],
    used_item_ids: set[str],
    related_items_by_creator: dict[tuple[str, str], list[dict[str, Any]]] | None = None,
) -> tuple[int, int]:
    created = 0
    skipped = 0
    for item in items:
        if item.get("id") in used_item_ids:
            continue
        related_items = (related_items_by_creator or {}).get(creator_profile_key(item) or ("", ""), [])
        lead_fit = conversation_author_lead_fit(item, related_items=related_items)
        if not lead_fit:
            skipped += 1
            continue
        db.upsert_creator(creator_row(item, lead_fit, related_items=related_items))
        created += 1
        if item.get("id"):
            used_item_ids.add(item["id"])
    return created, skipped


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)

    created = 0
    skipped = 0
    fallback_created = 0
    lead_created = 0
    source_items = db.fetch_creator_source_items(max(1000, args.limit * 20))
    related_items_by_creator = group_items_by_creator(source_items)
    items = [item for item in source_items if has_reliable_creator_history(item)][: args.limit]
    lead_items = [item for item in source_items if is_apify_conversation_author_lead(item)][: args.limit]
    if not items and not lead_items:
        print("Creator discovery: scanned=0 upserted=0 fallback=0 skipped=0")
        return

    items_by_id = {item["id"]: item for item in items if item.get("id")}
    used_item_ids: set[str] = set()

    if items:
        llm = LLM(cfg)
        for fit in llm.creator_fits(items):
            item = fit_source_item(items_by_id, fit)
            if not item:
                skipped += 1
                continue
            related_items = related_items_by_creator.get(creator_profile_key(item, fit) or ("", ""), [])
            db.upsert_creator(creator_row(item, fit, related_items=related_items))
            if item.get("id"):
                used_item_ids.add(item["id"])
            created += 1

    fallback_items = [item for item in source_items if has_reliable_creator_history(item)]
    fallback_created, fallback_skipped = promote_fallback_items(db, fallback_items, used_item_ids, related_items_by_creator)
    lead_created, lead_skipped = promote_conversation_author_leads(db, lead_items, used_item_ids, related_items_by_creator)
    created += fallback_created + lead_created
    skipped += fallback_skipped + lead_skipped

    print(
        "Creator discovery: "
        f"scanned={len(items) + len(lead_items)} upserted={created} "
        f"fallback={fallback_created} leads={lead_created} skipped={skipped}"
    )


if __name__ == "__main__":
    main()
