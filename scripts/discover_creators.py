#!/usr/bin/env python
from __future__ import annotations

import argparse
import re
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


def fallback_creator_fit(item: dict[str, Any]) -> dict[str, Any] | None:
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

    evidence = creator_evidence_from_item(item)
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


def creator_row(item: dict[str, Any], fit: dict[str, Any]) -> dict[str, Any]:
    fit_reason = fit.get("fit_reason", "")
    talks_about = fit.get("talks_about")
    if talks_about:
        fit_reason = f"Talks about: {talks_about}. Fit: {fit_reason}"

    evidence = creator_evidence_from_item(item, fit)
    priority = fit.get("priority") or priority_for_creator_score(evidence["creator_quality_score"])
    if evidence["creator_quality_score"] < 85 and priority == "high":
        priority = priority_for_creator_score(evidence["creator_quality_score"])

    return {
        "name": fit.get("name") or item.get("author_name") or "Unknown",
        "platform": fit.get("platform") or item["source"],
        "profile_url": fit.get("profile_url") or item.get("author_url") or item.get("source_url"),
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    llm = LLM(cfg)

    created = 0
    skipped = 0
    fallback_created = 0
    items = db.fetch_creator_source_items(args.limit)
    if not items:
        print("Creator discovery: scanned=0 upserted=0 fallback=0 skipped=0")
        return

    items_by_id = {item["id"]: item for item in items if item.get("id")}
    used_item_ids: set[str] = set()

    for fit in llm.creator_fits(items):
        item = fit_source_item(items_by_id, fit)
        if not item:
            skipped += 1
            continue
        db.upsert_creator(creator_row(item, fit))
        if item.get("id"):
            used_item_ids.add(item["id"])
        created += 1

    for item in items:
        if item.get("id") in used_item_ids:
            continue
        fallback_fit = fallback_creator_fit(item)
        if not fallback_fit:
            skipped += 1
            continue
        db.upsert_creator(creator_row(item, fallback_fit))
        fallback_created += 1
        created += 1

    print(
        "Creator discovery: "
        f"scanned={len(items)} upserted={created} "
        f"fallback={fallback_created} skipped={skipped}"
    )


if __name__ == "__main__":
    main()
