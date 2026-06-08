from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


RECENCY_DAYS = 90

VR_TERMS = [
    "vr",
    "virtual reality",
    "quest",
    "meta quest",
    "mixed reality",
    "mr",
    "xr",
    "headset",
    "beat saber",
    "supernatural",
    "fitxr",
    "les mills",
    "bodycombat",
]

MOVEMENT_TERMS = [
    "fitness",
    "workout",
    "exercise",
    "cardio",
    "boxing",
    "dance",
    "wellness",
    "active gaming",
    "rhythm game",
    "body movement",
]

HEADSET_TERMS = [
    "headset",
    "quest 2",
    "quest 3",
    "quest pro",
    "meta quest",
    "oculus",
    "vive",
    "valve index",
    "pico",
    "psvr",
    "wearing a headset",
]

SAFETY_TERMS = ["kids", "child", "children", "weight loss guaranteed", "guaranteed weight loss", "cure", "medical claim"]


def parse_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def days_old(value: Any, now: datetime | None = None) -> int | None:
    parsed = parse_datetime(value)
    if not parsed:
        return None
    current = now or datetime.now(timezone.utc)
    return max(0, (current - parsed).days)


def has_term(text: str, terms: list[str]) -> bool:
    normalized = text.lower()
    for term in terms:
        if " " in term:
            if term in normalized:
                return True
        elif re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", normalized):
            return True
    return False


def evidence_text(item: dict[str, Any]) -> str:
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    evidence = raw_json.get("creator_evidence") if isinstance(raw_json.get("creator_evidence"), dict) else {}
    values: list[str] = [
        str(item.get("title") or ""),
        str(item.get("body") or ""),
        str(item.get("author_name") or ""),
        str(raw_json.get("keyword") or ""),
        str(raw_json.get("profile") or ""),
        str(evidence.get("vr_involvement_evidence") or ""),
        str(evidence.get("movement_fit_evidence") or ""),
        str(evidence.get("headset_evidence") or ""),
    ]
    posts = raw_json.get("recent_posts") or evidence.get("recent_posts")
    if isinstance(posts, list):
        for post in posts[:25]:
            if isinstance(post, dict):
                values.extend(str(post.get(key) or "") for key in ["title", "caption", "text", "description"])
    return "\n".join(values)


def raw_creator_evidence(item: dict[str, Any]) -> dict[str, Any]:
    raw_json = item.get("raw_json") if isinstance(item.get("raw_json"), dict) else {}
    evidence = raw_json.get("creator_evidence")
    return evidence if isinstance(evidence, dict) else {}


def int_value(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def creator_score_from_evidence(
    *,
    recent_vr_posts_count: int | None,
    recent_total_posts_count: int | None,
    last_post_at: str | None,
    follower_count: int | None,
    public_contact: str | None,
    activity_level: str,
    headset_confidence: str,
    text: str,
    engagement_available: bool,
) -> int:
    vr_count = recent_vr_posts_count or 0
    total_count = recent_total_posts_count or 0
    last_post_days = days_old(last_post_at)
    has_vr = vr_count > 0 or has_term(text, VR_TERMS)
    has_movement = has_term(text, MOVEMENT_TERMS)
    has_headset = headset_confidence in {"high", "medium"} or has_term(text, HEADSET_TERMS)
    has_safety_risk = has_term(text, SAFETY_TERMS)

    score = 0
    score += 25 if has_headset or (has_vr and vr_count >= 2) else 16 if has_vr else 0
    score += 20 if has_movement and has_vr else 12 if has_movement else 0
    if last_post_days is not None and last_post_days <= 30 and vr_count >= 1:
        score += 15
    elif vr_count >= 2 or activity_level == "high":
        score += 12
    elif vr_count == 1 or activity_level == "medium":
        score += 8
    elif total_count > 0:
        score += 3
    score += 15 if engagement_available else 8 if follower_count and follower_count >= 1_000 else 4 if follower_count else 0
    if follower_count:
        score += 10 if follower_count >= 10_000 else 7 if follower_count >= 1_000 else 4
    score += 10 if public_contact and "@" in public_contact else 6 if public_contact else 0
    score += 0 if has_safety_risk else 5

    if not has_headset:
        score = min(score, 84)
    if vr_count == 0 and not has_vr:
        score = min(score, 49)
    if last_post_days is None and total_count == 0:
        score = min(score, 69)
    elif last_post_days is not None and last_post_days > RECENCY_DAYS:
        score = min(score, 69)
    if has_safety_risk:
        score = min(score, 25)

    return max(0, min(100, score))


def priority_for_creator_score(score: int) -> str:
    if score >= 85:
        return "high"
    if score >= 70:
        return "medium"
    if score >= 50:
        return "low"
    return "low"


def activity_level(recent_total_posts_count: int | None, last_post_at: str | None) -> str:
    total = recent_total_posts_count or 0
    age = days_old(last_post_at)
    if age is not None and age <= 30 and total >= 6:
        return "high"
    if age is not None and age <= RECENCY_DAYS and total >= 2:
        return "medium"
    if age is not None and age <= RECENCY_DAYS:
        return "low"
    return "unknown"


def creator_evidence_from_item(item: dict[str, Any], fit: dict[str, Any] | None = None) -> dict[str, Any]:
    fit = fit or {}
    raw = raw_creator_evidence(item)
    text = "\n".join([evidence_text(item), str(fit.get("fit_reason") or ""), str(fit.get("talks_about") or "")])
    recent_vr_posts_count = int_value(fit.get("recent_vr_posts_count")) or int_value(raw.get("recent_vr_posts_count"))
    recent_total_posts_count = int_value(fit.get("recent_total_posts_count")) or int_value(raw.get("recent_total_posts_count"))
    last_post_at = fit.get("last_post_at") or raw.get("last_post_at")
    if not isinstance(last_post_at, str):
        last_post_at = None
    level = str(fit.get("activity_level") or raw.get("activity_level") or activity_level(recent_total_posts_count, last_post_at))
    headset_confidence = str(fit.get("headset_confidence") or raw.get("headset_confidence") or ("medium" if has_term(text, HEADSET_TERMS) else "unknown"))
    public_contact = fit.get("public_contact") or raw.get("public_contact")
    follower_count = int_value(item.get("follower_count")) or int_value(raw.get("follower_count"))
    engagement_available = bool(fit.get("engagement_evidence") or raw.get("engagement_evidence") or raw.get("engagement"))
    score = int_value(fit.get("creator_quality_score"))
    if score is None:
        score = creator_score_from_evidence(
            recent_vr_posts_count=recent_vr_posts_count,
            recent_total_posts_count=recent_total_posts_count,
            last_post_at=last_post_at,
            follower_count=follower_count,
            public_contact=public_contact if isinstance(public_contact, str) else None,
            activity_level=level,
            headset_confidence=headset_confidence,
            text=text,
            engagement_available=engagement_available,
        )

    return {
        "creator_quality_score": score,
        "recent_vr_posts_count": recent_vr_posts_count or 0,
        "recent_total_posts_count": recent_total_posts_count or 0,
        "last_post_at": last_post_at,
        "activity_level": level if level in {"high", "medium", "low", "unknown"} else "unknown",
        "vr_involvement_evidence": fit.get("vr_involvement_evidence") or raw.get("vr_involvement_evidence") or ("VR/XR signal found in recent content." if has_term(text, VR_TERMS) else ""),
        "movement_fit_evidence": fit.get("movement_fit_evidence") or raw.get("movement_fit_evidence") or ("Movement or fitness signal found." if has_term(text, MOVEMENT_TERMS) else ""),
        "headset_evidence": fit.get("headset_evidence") or raw.get("headset_evidence") or ("Headset signal found." if has_term(text, HEADSET_TERMS) else ""),
        "headset_confidence": headset_confidence if headset_confidence in {"high", "medium", "low", "unknown"} else "unknown",
        "engagement_evidence": fit.get("engagement_evidence") or raw.get("engagement_evidence") or "",
        "contactability_evidence": fit.get("contactability_evidence") or raw.get("contactability_evidence") or ("Public email found." if isinstance(public_contact, str) and "@" in public_contact else ""),
        "safety_notes": fit.get("safety_notes") or raw.get("safety_notes") or "",
        "evidence_json": {**raw, **({"llm_fit": fit} if fit else {})},
    }
