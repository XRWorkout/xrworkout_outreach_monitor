from __future__ import annotations

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
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

STRONG_VR_FITNESS_TERMS = [
    "vr fitness",
    "vr workout",
    "quest fitness",
    "quest workout",
    "meta quest fitness",
    "mixed reality workout",
    "supernatural",
    "fitxr",
    "les mills",
    "bodycombat",
    "beat saber workout",
    "vr cardio",
    "vr boxing",
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
POST_DATE_KEYS = ["published_at", "publishedAt", "created_at", "createdAt", "createTimeISO", "timestamp", "date", "createTime"]
POST_URL_KEYS = ["url", "postUrl", "post_url", "webVideoUrl", "videoUrl", "video_url", "shortUrl", "shareUrl"]
POST_TEXT_KEYS = ["title", "caption", "text", "description", "hashtags"]


def parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        timestamp = int(value)
        if timestamp > 10_000_000_000:
            timestamp = timestamp // 1000
        try:
            return datetime.fromtimestamp(timestamp, timezone.utc)
        except (OSError, ValueError):
            return None
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    if normalized.isdigit():
        return parse_datetime(int(normalized))
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        try:
            parsed = parsedate_to_datetime(value)
        except (TypeError, ValueError, IndexError, OverflowError):
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


def first_string(value: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        raw = value.get(key)
        if isinstance(raw, str) and raw.strip():
            return raw.strip()
    return None


def post_text(post: dict[str, Any]) -> str:
    return "\n".join(str(post.get(key) or "") for key in POST_TEXT_KEYS)


def post_datetime(post: dict[str, Any]) -> datetime | None:
    for key in POST_DATE_KEYS:
        parsed = parse_datetime(post.get(key))
        if parsed:
            return parsed
    return None


def post_url(post: dict[str, Any]) -> str | None:
    return first_string(post, POST_URL_KEYS)


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
                values.append(post_text(post))
    return "\n".join(values)


def source_text(item: dict[str, Any]) -> str:
    return "\n".join(str(item.get(key) or "") for key in ["title", "body"])


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


def recent_relevant_posts_from_history(raw: dict[str, Any], text: str, now: datetime | None = None) -> dict[str, Any]:
    posts = raw.get("recent_posts")
    if not isinstance(posts, list):
        return {"available": False, "vr_count": None, "total_count": None, "last_post_at": None, "relevant_posts": []}

    current = now or datetime.now(timezone.utc)
    newest: datetime | None = None
    total = 0
    relevant_posts: list[dict[str, Any]] = []
    for post in posts:
        if not isinstance(post, dict):
            continue
        parsed = post_datetime(post)
        if not parsed or (current - parsed).days > RECENCY_DAYS:
            continue
        total += 1
        if newest is None or parsed > newest:
            newest = parsed
        text_value = post_text(post)
        if has_term(text_value, VR_TERMS):
            relevant_posts.append(
                {
                    "title": first_string(post, ["title", "caption", "text", "description"]) or "Relevant VR/XR post",
                    "published_at": parsed.isoformat(),
                    "url": post_url(post),
                    "evidence": text_value[:280],
                }
            )

    if total == 0 and has_term(text, VR_TERMS):
        return {"available": False, "vr_count": None, "total_count": None, "last_post_at": None, "relevant_posts": []}
    relevant_posts.sort(key=lambda post: str(post.get("published_at") or ""), reverse=True)
    return {
        "available": True,
        "vr_count": len(relevant_posts),
        "total_count": total,
        "last_post_at": newest.isoformat() if newest else None,
        "relevant_posts": relevant_posts[:10],
    }


def history_quality_from_raw(raw: dict[str, Any]) -> str:
    quality = str(raw.get("history_quality") or "").strip().lower()
    if quality in {"profile_history", "profile_partial", "profile_only", "failed_enrichment", "enrichment_failed"}:
        return quality
    if isinstance(raw.get("recent_posts"), list):
        return "profile_history"
    return "unknown"


def observed_post_evidence(item: dict[str, Any]) -> dict[str, Any]:
    text = source_text(item)
    if not text.strip():
        return {"available": False, "vr_count": None, "total_count": None, "last_post_at": None, "relevant_posts": []}
    published_at = item.get("published_at") or item.get("collected_at")
    parsed = parse_datetime(published_at)
    if not parsed or days_old(parsed.isoformat()) is None or days_old(parsed.isoformat()) > RECENCY_DAYS:
        return {"available": False, "vr_count": None, "total_count": None, "last_post_at": None, "relevant_posts": []}
    relevant = has_term(text, VR_TERMS)
    return {
        "available": True,
        "vr_count": 1 if relevant else 0,
        "total_count": 1,
        "last_post_at": parsed.isoformat(),
        "relevant_posts": [
            {
                "title": str(item.get("title") or "Observed source post"),
                "published_at": parsed.isoformat(),
                "url": item.get("source_url"),
                "evidence": text[:280],
            }
        ]
        if relevant
        else [],
    }


def post_identity(post: dict[str, Any]) -> str:
    url = str(post.get("url") or "").strip().lower()
    if url:
        return f"url:{url}"
    title = str(post.get("title") or "").strip().lower()
    date = str(post.get("published_at") or post.get("date") or "").strip()[:10]
    evidence = str(post.get("evidence") or "").strip().lower()[:120]
    return f"text:{date}:{title}:{evidence}"


def merge_relevant_posts(*post_lists: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for posts in post_lists:
        for post in posts:
            if not isinstance(post, dict):
                continue
            merged.setdefault(post_identity(post), post)
    return sorted(merged.values(), key=lambda post: str(post.get("published_at") or ""), reverse=True)


def accumulated_source_evidence(
    item: dict[str, Any],
    related_items: list[dict[str, Any]] | None = None,
    now: datetime | None = None,
) -> dict[str, Any]:
    items = [item, *(related_items or [])]
    seen_ids: set[str] = set()
    unique_items: list[dict[str, Any]] = []
    for candidate in items:
        identity = str(candidate.get("id") or candidate.get("dedupe_hash") or candidate.get("source_url") or id(candidate))
        if identity in seen_ids:
            continue
        seen_ids.add(identity)
        unique_items.append(candidate)

    best_history: dict[str, Any] | None = None
    best_history_total = -1
    profile_partial = False
    failed_enrichment = False
    observed_total = 0
    observed_vr = 0
    observed_posts: list[dict[str, Any]] = []
    newest: datetime | None = None

    for candidate in unique_items:
        raw = raw_creator_evidence(candidate)
        quality = history_quality_from_raw(raw)
        if quality in {"profile_partial", "profile_only"}:
            profile_partial = True
        if quality in {"failed_enrichment", "enrichment_failed"}:
            failed_enrichment = True

        history = recent_relevant_posts_from_history(raw, evidence_text(candidate), now=now)
        if history["available"]:
            total = int_value(history.get("total_count")) or 0
            if total > best_history_total:
                best_history = history
                best_history_total = total
            parsed = parse_datetime(history.get("last_post_at"))
            if parsed and (newest is None or parsed > newest):
                newest = parsed

        observed = observed_post_evidence(candidate)
        if observed["available"]:
            observed_total += int_value(observed.get("total_count")) or 0
            observed_vr += int_value(observed.get("vr_count")) or 0
            observed_posts.extend(observed.get("relevant_posts") or [])
            parsed = parse_datetime(observed.get("last_post_at"))
            if parsed and (newest is None or parsed > newest):
                newest = parsed

    history_total = int_value(best_history.get("total_count")) if best_history else None
    history_vr = int_value(best_history.get("vr_count")) if best_history else None
    history_posts = best_history.get("relevant_posts") if best_history else []
    history_posts = history_posts if isinstance(history_posts, list) else []
    relevant_posts = merge_relevant_posts(history_posts, observed_posts)

    if history_total is not None and history_total > 0:
        total_count = max(history_total, observed_total)
        vr_count = max(history_vr or 0, observed_vr)
        evidence_quality = "profile_history" if total_count == history_total else "profile_history_plus_observed"
    elif observed_total > 1:
        total_count = observed_total
        vr_count = observed_vr
        evidence_quality = "accumulated_observed_posts"
    elif observed_total == 1:
        total_count = observed_total
        vr_count = observed_vr
        evidence_quality = "observed_post"
    else:
        total_count = None
        vr_count = None
        evidence_quality = "failed_enrichment" if failed_enrichment else "partial_history" if profile_partial else "no_history"

    if evidence_quality in {"profile_history", "profile_history_plus_observed"} and total_count and total_count >= 3:
        confidence = "high"
    elif evidence_quality in {"profile_history", "profile_history_plus_observed", "accumulated_observed_posts"}:
        confidence = "medium"
    elif evidence_quality == "observed_post":
        confidence = "low"
    else:
        confidence = "weak"

    return {
        "vr_count": vr_count,
        "total_count": total_count,
        "last_post_at": newest.isoformat() if newest else None,
        "relevant_posts": relevant_posts[:10],
        "evidence_quality": evidence_quality,
        "confidence": confidence,
        "observed_source_posts_count": observed_total,
        "observed_vr_posts_count": observed_vr,
        "profile_history_posts_count": history_total or 0,
        "source_observation_count": len(unique_items),
    }


def score_cap(
    *,
    has_vr: bool,
    has_movement: bool,
    has_headset: bool,
    vr_count: int,
    total_count: int,
    last_post_at: str | None,
    has_safety_risk: bool,
    evidence_quality: str,
    text: str,
) -> int:
    if has_safety_risk:
        return 25
    if not has_vr:
        return 39

    last_post_days = days_old(last_post_at)
    strong_specific_signal = has_term(text, STRONG_VR_FITNESS_TERMS)
    cap = 100

    if evidence_quality in {"conversation_author", "post_only", "observed_post"}:
        cap = min(cap, 64)
    if evidence_quality == "accumulated_observed_posts":
        cap = min(cap, 78)
    if evidence_quality in {"partial_history", "no_history", "failed_enrichment"}:
        cap = min(cap, 54)
    if total_count == 0 and last_post_days is None:
        cap = min(cap, 49)
    if last_post_days is not None and last_post_days > RECENCY_DAYS:
        cap = min(cap, 49)
    if vr_count <= 1:
        cap = min(cap, 76 if strong_specific_signal and has_movement else 64)
    if not has_movement:
        cap = min(cap, 62)
    if not has_headset:
        cap = min(cap, 84)
    return cap


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
    strong_specific_signal = has_term(text, STRONG_VR_FITNESS_TERMS)

    score = 0
    score += 25 if has_headset and vr_count >= 2 else 22 if has_headset or vr_count >= 2 else 16 if has_vr else 0
    score += 20 if has_movement and (vr_count >= 2 or strong_specific_signal) else 15 if has_movement and has_vr else 10 if has_movement else 0
    if last_post_days is not None and last_post_days <= 30 and vr_count >= 2:
        score += 15
    elif last_post_days is not None and last_post_days <= 30 and vr_count == 1:
        score += 9
    elif vr_count >= 2 and activity_level in {"high", "medium"}:
        score += 12
    elif vr_count == 1 or activity_level == "medium":
        score += 6
    elif total_count > 0:
        score += 3
    score += 15 if engagement_available else 8 if follower_count and follower_count >= 1_000 else 4 if follower_count else 0
    if follower_count:
        score += 10 if follower_count >= 10_000 else 7 if follower_count >= 1_000 else 4
    score += 10 if public_contact and "@" in public_contact else 6 if public_contact else 0
    score += 0 if has_safety_risk else 5
    cap = score_cap(
        has_vr=has_vr,
        has_movement=has_movement,
        has_headset=has_headset,
        vr_count=vr_count,
        total_count=total_count,
        last_post_at=last_post_at,
        has_safety_risk=has_safety_risk,
        evidence_quality="profile_history" if total_count > 1 else "observed_post" if total_count == 1 else "unknown",
        text=text,
    )

    return max(0, min(100, score, cap))


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


def first_available_int(*values: int | None) -> int | None:
    for value in values:
        if value is not None:
            return value
    return None


def creator_evidence_from_item(
    item: dict[str, Any],
    fit: dict[str, Any] | None = None,
    related_items: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    fit = fit or {}
    raw = raw_creator_evidence(item)
    text = "\n".join([evidence_text(item), str(fit.get("fit_reason") or ""), str(fit.get("talks_about") or "")])
    accumulated = accumulated_source_evidence(item, related_items)
    fit_vr_count = int_value(fit.get("recent_vr_posts_count"))
    fit_total_count = int_value(fit.get("recent_total_posts_count"))
    raw_quality = history_quality_from_raw(raw)
    raw_vr_value = int_value(raw.get("recent_vr_posts_count"))
    raw_total_value = int_value(raw.get("recent_total_posts_count"))
    raw_vr_count = raw_vr_value if raw_quality == "profile_history" or raw_vr_value else None
    raw_total_count = raw_total_value if raw_quality == "profile_history" or raw_total_value else None

    # Source-derived accumulated evidence is authoritative. LLM fit counts are only a last resort.
    recent_vr_posts_count = first_available_int(int_value(accumulated.get("vr_count")), raw_vr_count, fit_vr_count)
    recent_total_posts_count = first_available_int(int_value(accumulated.get("total_count")), raw_total_count, fit_total_count)
    last_post_at = accumulated.get("last_post_at") or raw.get("last_post_at") or fit.get("last_post_at")
    if not isinstance(last_post_at, str):
        last_post_at = None

    computed_level = activity_level(recent_total_posts_count, last_post_at)
    level = computed_level if computed_level != "unknown" else str(raw.get("activity_level") or fit.get("activity_level") or "unknown")
    headset_confidence = str(fit.get("headset_confidence") or raw.get("headset_confidence") or ("medium" if has_term(text, HEADSET_TERMS) else "unknown"))
    public_contact = fit.get("public_contact") or raw.get("public_contact")
    follower_count = int_value(item.get("follower_count")) or int_value(raw.get("follower_count"))
    engagement_available = bool(fit.get("engagement_evidence") or raw.get("engagement_evidence") or raw.get("engagement"))
    deterministic_score = creator_score_from_evidence(
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
    evidence_quality = str(fit.get("lead_source_type") or accumulated.get("evidence_quality") or raw.get("history_quality") or "unknown")
    cap = score_cap(
        has_vr=(recent_vr_posts_count or 0) > 0 or has_term(text, VR_TERMS),
        has_movement=has_term(text, MOVEMENT_TERMS),
        has_headset=headset_confidence in {"high", "medium"} or has_term(text, HEADSET_TERMS),
        vr_count=recent_vr_posts_count or 0,
        total_count=recent_total_posts_count or 0,
        last_post_at=last_post_at,
        has_safety_risk=has_term(text, SAFETY_TERMS),
        evidence_quality=evidence_quality,
        text=text,
    )
    llm_score = int_value(fit.get("creator_quality_score"))
    score = min(cap, deterministic_score if llm_score is None else max(deterministic_score, llm_score))
    relevant_posts = accumulated.get("relevant_posts")
    relevant_posts = relevant_posts if isinstance(relevant_posts, list) else []

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
        "evidence_json": {
            **raw,
            "computed_score_cap": cap,
            "computed_evidence_quality": evidence_quality,
            "computed_evidence_confidence": accumulated.get("confidence"),
            "computed_recent_relevant_posts": relevant_posts,
            "computed_recent_vr_posts_count": recent_vr_posts_count or 0,
            "computed_recent_total_posts_count": recent_total_posts_count or 0,
            "computed_observed_source_posts_count": accumulated.get("observed_source_posts_count") or 0,
            "computed_observed_vr_posts_count": accumulated.get("observed_vr_posts_count") or 0,
            "computed_profile_history_posts_count": accumulated.get("profile_history_posts_count") or 0,
            "computed_source_observation_count": accumulated.get("source_observation_count") or 1,
            **({"llm_fit": fit} if fit else {}),
        },
    }
