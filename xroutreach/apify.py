from __future__ import annotations

import json
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import quote

import requests

from xroutreach.config import KEYWORDS, Settings, require
from xroutreach.creator_scoring import HEADSET_TERMS, MOVEMENT_TERMS, RECENCY_DAYS, VR_TERMS, activity_level, has_term, parse_datetime
from xroutreach.dedupe import dedupe_hash


EMAIL_RE = re.compile(r"(?<![A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![A-Z0-9._%+-])", re.IGNORECASE)


def actor_configs(raw_json: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(raw_json or "[]")
    except json.JSONDecodeError as exc:
        raise RuntimeError("Apify actor config must be valid JSON") from exc
    if not isinstance(parsed, list):
        raise RuntimeError("Apify actor config must be a JSON array")
    configs = []
    for entry in parsed:
        if isinstance(entry, str):
            configs.append({"actor_id": entry, "input": {}})
        elif isinstance(entry, dict) and entry.get("actor_id"):
            configs.append(entry)
        else:
            raise RuntimeError("Each Apify actor config must be an actor_id string or object")
    return configs


def source_type(config: dict[str, Any], fallback: str) -> str:
    value = config.get("source_type") or config.get("purpose") or fallback
    normalized = str(value).lower().replace("-", "_").replace(" ", "_")
    purpose_map = {
        "conversation_discovery": fallback,
        "profile_discovery": "profile_lead",
        "profile_history": "profile_history",
        "contact_enrichment": "contact_enrichment",
    }
    return purpose_map.get(normalized, normalized)


class ApifyClient:
    def __init__(self, settings: Settings):
        require([("APIFY_TOKEN", settings.apify_token)])
        self.token = settings.apify_token

    def run_actor(self, actor_id: str, actor_input: dict[str, Any], timeout_seconds: int = 900) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        encoded_actor = quote(actor_id, safe="")
        response = requests.post(
            f"https://api.apify.com/v2/acts/{encoded_actor}/runs",
            params={"token": self.token},
            json=actor_input,
            timeout=30,
        )
        response.raise_for_status()
        run = response.json().get("data") or {}
        run_id = run.get("id")
        if not run_id:
            raise RuntimeError(f"Apify actor {actor_id} did not return a run id")

        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            status_response = requests.get(
                f"https://api.apify.com/v2/actor-runs/{run_id}",
                params={"token": self.token},
                timeout=30,
            )
            status_response.raise_for_status()
            run = status_response.json().get("data") or {}
            status = run.get("status")
            if status in {"SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"}:
                break
            time.sleep(5)

        if run.get("status") != "SUCCEEDED":
            raise RuntimeError(f"Apify actor {actor_id} ended with status {run.get('status')}")

        dataset_id = run.get("defaultDatasetId")
        if not dataset_id:
            return run, []
        items_response = requests.get(
            f"https://api.apify.com/v2/datasets/{dataset_id}/items",
            params={"token": self.token, "clean": "true", "format": "json"},
            timeout=60,
        )
        items_response.raise_for_status()
        items = items_response.json()
        return run, items if isinstance(items, list) else []


def first_string(item: dict[str, Any], keys: list[str]) -> str | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    for nested_key in ["authorMeta", "author", "user", "owner", "profile", "group", "server"]:
        nested = item.get(nested_key)
        if isinstance(nested, dict):
            value = first_string(nested, keys)
            if value:
                return value
    return None


def first_int(item: dict[str, Any], keys: list[str]) -> int | None:
    for key in keys:
        value = item.get(key)
        if isinstance(value, bool):
            continue
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            continue
        if parsed >= 0:
            return parsed
    for nested_key in ["authorMeta", "author", "user", "owner", "profile", "stats", "public_metrics", "group", "server"]:
        nested = item.get(nested_key)
        if isinstance(nested, dict):
            value = first_int(nested, keys)
            if value is not None:
                return value
    return None


def public_contact(item: dict[str, Any]) -> str | None:
    direct = first_string(item, ["email", "publicEmail", "businessEmail", "contactEmail"])
    if direct and EMAIL_RE.search(direct):
        return EMAIL_RE.search(direct).group(1)
    text = "\n".join(str(item.get(key) or "") for key in ["biography", "bio", "description", "caption", "text", "title"])
    match = EMAIL_RE.search(text)
    return match.group(1) if match else None


def post_text(post: dict[str, Any]) -> str:
    return "\n".join(str(post.get(key) or "") for key in ["title", "caption", "text", "description", "hashtags"])


def engagement_payload(item: dict[str, Any]) -> dict[str, int]:
    fields = {
        "likes": ["likesCount", "likeCount", "likes", "favorite_count", "favorites", "reactionCount", "reactionsCount"],
        "comments": ["commentsCount", "commentCount", "comments", "reply_count", "replies", "comments_count"],
        "shares": ["shareCount", "sharesCount", "shares", "retweet_count", "retweets"],
        "views": ["viewsCount", "viewCount", "views", "views_count"],
    }
    return {
        key: value
        for key, keys in fields.items()
        if (value := first_int(item, keys)) is not None
    }


def conversation_source_url(item: dict[str, Any]) -> str | None:
    return first_string(
        item,
        [
            "url",
            "postUrl",
            "post_url",
            "tweetUrl",
            "twitterUrl",
            "facebookUrl",
            "groupUrl",
            "serverUrl",
            "inviteUrl",
            "profileUrl",
            "channelUrl",
            "webVideoUrl",
        ],
    )


def conversation_author_url(item: dict[str, Any]) -> str | None:
    return first_string(item, ["authorUrl", "author_url", "profileUrl", "userUrl", "twitterUrl", "channelUrl"])


def post_date(post: dict[str, Any]) -> str | None:
    value = first_string(post, ["timestamp", "publishedAt", "published_at", "createdAt", "created_at", "createTimeISO", "date"])
    if value:
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
        except ValueError:
            try:
                return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError):
                return None
    timestamp = first_int(post, ["createTime", "timestamp"])
    if timestamp:
        if timestamp > 10_000_000_000:
            timestamp = timestamp // 1000
        return datetime.fromtimestamp(timestamp, timezone.utc).isoformat()
    return None


def recent_posts(item: dict[str, Any]) -> list[dict[str, Any]]:
    for key in ["recentPosts", "recent_posts", "posts", "latestPosts", "videos", "items"]:
        value = item.get(key)
        if isinstance(value, list):
            return [post for post in value if isinstance(post, dict)]
    return []


def creator_evidence(item: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    posts = recent_posts(item)
    history_quality = "profile_history" if posts else "profile_only"
    recent = []
    newest: datetime | None = None
    for post in posts:
        parsed = parse_datetime(post_date(post))
        if parsed and (current - parsed).days <= RECENCY_DAYS:
            recent.append(post)
        if parsed and (newest is None or parsed > newest):
            newest = parsed

    if not posts:
        profile_date = first_string(item, ["lastPostAt", "last_post_at", "latestPostDate"])
        parsed = parse_datetime(profile_date)
        if parsed:
            newest = parsed

    profile_text = "\n".join(str(item.get(key) or "") for key in ["title", "fullName", "username", "name", "biography", "bio", "description"])
    recent_texts = [post_text(post) for post in recent]
    all_text = "\n".join([profile_text, *recent_texts])
    vr_posts = [post for post in recent if has_term(post_text(post), VR_TERMS)]
    movement_posts = [post for post in recent if has_term(post_text(post), MOVEMENT_TERMS)]
    headset_posts = [post for post in recent if has_term(post_text(post), HEADSET_TERMS)]
    contact = public_contact(item)
    engagement = {
        "likes": first_int(item, ["likesCount", "likes", "avgLikes"]),
        "comments": first_int(item, ["commentsCount", "comments", "avgComments"]),
        "views": first_int(item, ["viewsCount", "views", "avgViews"]),
    }
    engagement_text = ", ".join(f"{key}: {value}" for key, value in engagement.items() if value is not None)
    headset_confidence = "high" if headset_posts else "medium" if has_term(profile_text, HEADSET_TERMS) else "unknown"
    recent_total = len(recent) if posts else first_int(item, ["recentTotalPostsCount", "recent_total_posts_count"]) or 0
    recent_vr = len(vr_posts) if posts else first_int(item, ["recentVrPostsCount", "recent_vr_posts_count"]) or (1 if has_term(all_text, VR_TERMS) else 0)
    last_post = newest.isoformat() if newest else None

    return {
        "recent_vr_posts_count": recent_vr,
        "recent_total_posts_count": recent_total,
        "last_post_at": last_post,
        "activity_level": activity_level(recent_total, last_post),
        "vr_involvement_evidence": "; ".join(text[:180] for text in recent_texts if has_term(text, VR_TERMS))[:600] or ("Profile mentions VR/XR." if has_term(profile_text, VR_TERMS) else ""),
        "movement_fit_evidence": "; ".join(text[:180] for text in recent_texts if has_term(text, MOVEMENT_TERMS))[:600] or ("Profile mentions fitness/movement." if has_term(profile_text, MOVEMENT_TERMS) else ""),
        "headset_evidence": "; ".join(post_text(post)[:180] for post in headset_posts)[:600] or ("Profile mentions headset use." if headset_confidence == "medium" else ""),
        "headset_confidence": headset_confidence,
        "engagement_evidence": engagement_text,
        "contactability_evidence": f"Public email: {contact}" if contact else "",
        "safety_notes": "",
        "public_contact": contact,
        "recent_posts": recent[:10],
        "engagement": engagement,
        "history_quality": history_quality,
    }


def profile_url(item: dict[str, Any]) -> str | None:
    return first_string(item, ["profileUrl", "profile_url", "authorUrl", "author_url", "webVideoUrl", "url", "channelUrl", "channel_url"])


def source_url(item: dict[str, Any]) -> str | None:
    return first_string(item, ["url", "postUrl", "post_url", "webVideoUrl", "videoUrl", "video_url", "profileUrl", "profile_url"])


def normalize_conversation_item(item: dict[str, Any], config: dict[str, Any], run: dict[str, Any]) -> dict[str, Any] | None:
    platform = platform_name(config, item, "conversation")
    source = platform if platform.startswith("apify_") else f"apify_{platform}"
    url = conversation_source_url(item)
    if not url:
        return None
    item_type = source_type(config, "social_post")
    external_id = first_string(item, ["id", "tweetId", "postId", "shortCode", "url", "serverId", "channelId"]) or url
    title = first_string(item, ["title", "full_text", "text", "caption", "name", "serverName", "groupName"]) or "Public conversation signal"
    body = first_string(item, ["full_text", "text", "caption", "description", "body", "summary", "about"]) or ""
    author_name = first_string(item, ["authorName", "username", "screenName", "name", "ownerUsername", "channelName", "serverName", "groupName"])
    author_url = conversation_author_url(item)
    engagement = engagement_payload(item)
    return {
        "source": source,
        "source_url": url,
        "external_id": f"{source}_{external_id}",
        "author_name": author_name,
        "author_url": author_url,
        "title": title[:500],
        "body": body[:5000],
        "follower_count": first_int(item, ["followersCount", "followers", "follower_count", "subscriberCount", "members", "memberCount", "userFollowers"]),
        "published_at": post_date(item) or datetime.now(timezone.utc).isoformat(),
        "raw_json": {
            "collector": "apify_conversations",
            "source_type": item_type,
            "purpose": config.get("purpose") or "conversation_discovery",
            "keyword": config.get("keyword") or config.get("search_query") or config.get("searchQuery") or ", ".join(KEYWORDS[:5]),
            "actor_id": config.get("actor_id"),
            "run_id": run.get("id"),
            "dataset_id": run.get("defaultDatasetId"),
            "platform": platform,
            "engagement": engagement,
            "manual_action": "review_source" if item_type == "server_discovery" else "join_manually",
            "automation_policy": "no_auto_post_or_dm",
            "dataset_item": item,
        },
        "dedupe_hash": dedupe_hash(source, str(external_id), url),
    }


def platform_name(config: dict[str, Any], item: dict[str, Any], fallback: str) -> str:
    value = config.get("platform") or item.get("platform") or fallback
    return str(value).lower().replace(" ", "_")


def normalize_creator_item(item: dict[str, Any], config: dict[str, Any], run: dict[str, Any]) -> dict[str, Any] | None:
    platform = platform_name(config, item, "apify")
    source = platform if platform.startswith("apify_") else f"apify_{platform}"
    url = profile_url(item) or source_url(item)
    if not url:
        return None
    name = first_string(item, ["fullName", "nickName", "nickname", "name", "username", "authorName", "channelName"]) or "Unknown creator"
    external_id = first_string(item, ["id", "userId", "secUid", "username", "channelId", "profileUrl", "url"]) or url
    evidence = creator_evidence(item)
    contact = public_contact(item) or evidence.get("public_contact")
    title = first_string(item, ["title", "fullName", "username", "name"]) or name
    body = first_string(item, ["biography", "bio", "description", "caption", "text"]) or evidence.get("vr_involvement_evidence") or ""
    return {
        "source": source,
        "source_url": url,
        "external_id": f"{source}_{external_id}",
        "author_name": name,
        "author_url": url,
        "title": title,
        "body": body,
        "follower_count": first_int(item, ["followersCount", "followers", "follower_count", "subscriberCount", "subscribers", "fans", "fansCount"]),
        "published_at": evidence.get("last_post_at") or datetime.now(timezone.utc).isoformat(),
        "raw_json": {
            "keyword": config.get("keyword") or ", ".join(KEYWORDS[:5]),
            "actor_id": config.get("actor_id"),
            "run_id": run.get("id"),
            "dataset_id": run.get("defaultDatasetId"),
            "platform": platform,
            "public_contact": contact,
            "creator_evidence": evidence,
            "dataset_item": item,
        },
        "dedupe_hash": dedupe_hash(source, str(external_id), url),
    }


def normalize_social_item(item: dict[str, Any], config: dict[str, Any], run: dict[str, Any]) -> dict[str, Any] | None:
    platform = platform_name(config, item, "social")
    source = platform if platform.startswith("apify_") else f"apify_{platform}"
    url = source_url(item)
    if not url:
        return None
    external_id = first_string(item, ["id", "postId", "shortCode", "url"]) or url
    author_url = profile_url(item) or first_string(item, ["authorUrl", "author_url"])
    title = first_string(item, ["title", "caption", "text"]) or "Apify social signal"
    body = first_string(item, ["text", "caption", "description", "body"]) or ""
    return {
        "source": source,
        "source_url": url,
        "external_id": f"{source}_{external_id}",
        "author_name": first_string(item, ["authorName", "username", "ownerUsername", "channelName", "name", "nickName", "nickname"]),
        "author_url": author_url,
        "title": title[:500],
        "body": body,
        "follower_count": first_int(item, ["followersCount", "followers", "subscriberCount", "fans", "fansCount"]),
        "published_at": post_date(item) or datetime.now(timezone.utc).isoformat(),
        "raw_json": {
            "keyword": config.get("keyword") or ", ".join(KEYWORDS[:5]),
            "actor_id": config.get("actor_id"),
            "run_id": run.get("id"),
            "dataset_id": run.get("defaultDatasetId"),
            "platform": platform,
            "public_contact": public_contact(item),
            "dataset_item": item,
        },
        "dedupe_hash": dedupe_hash(source, str(external_id), url),
    }
