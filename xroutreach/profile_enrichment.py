from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from googleapiclient.discovery import build

from xroutreach.apify import ApifyClient, actor_configs, normalize_creator_item, recent_posts
from xroutreach.config import Settings
from xroutreach.creator_scoring import parse_datetime
from xroutreach.dedupe import dedupe_hash


@dataclass(frozen=True)
class ProfileTarget:
    creator: dict[str, Any]
    platform: str
    profile_url: str
    username: str | None = None
    channel_id: str | None = None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalized_platform(value: Any, profile_url: str | None = None) -> str:
    raw = str(value or "").lower().strip().replace("-", "_").replace(" ", "_")
    url = (profile_url or "").lower()
    if raw in {"youtube", "apify_youtube"} or "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if raw in {"tiktok", "tik_tok", "apify_tiktok"} or "tiktok.com" in url:
        return "tiktok"
    if raw in {"instagram", "apify_instagram"} or "instagram.com" in url:
        return "instagram"
    if raw in {"x", "twitter", "apify_x", "apify_twitter"} or "x.com" in url or "twitter.com" in url:
        return "x"
    return raw


def clean_username(value: str | None) -> str | None:
    if not value:
        return None
    username = value.strip().lstrip("@")
    if re.fullmatch(r"[A-Za-z0-9_.-]{2,80}", username):
        return username
    return None


def youtube_channel_id(profile_url: str) -> str | None:
    match = re.search(r"youtube\.com/channel/([^/?#]+)", profile_url, re.IGNORECASE)
    return match.group(1) if match else None


def username_from_profile_url(profile_url: str, platform: str) -> str | None:
    parsed = urlparse(profile_url)
    path = parsed.path.strip("/")
    if not path:
        return None
    parts = path.split("/")
    first = parts[0]
    if platform == "tiktok" and first.startswith("@"):
        return clean_username(first)
    if platform == "instagram" and first not in {"p", "reel", "reels", "stories", "explore"}:
        return clean_username(first)
    if platform == "x" and first.lower() not in {"home", "i", "intent", "search", "share"}:
        return clean_username(first)
    if platform == "youtube" and first.startswith("@"):
        return clean_username(first)
    return None


def target_from_creator(creator: dict[str, Any]) -> ProfileTarget | None:
    profile_url = str(creator.get("profile_url") or "").strip()
    if not profile_url:
        return None
    platform = normalized_platform(creator.get("platform"), profile_url)
    if platform not in {"youtube", "tiktok", "instagram", "x"}:
        return None
    return ProfileTarget(
        creator=creator,
        platform=platform,
        profile_url=profile_url,
        username=username_from_profile_url(profile_url, platform),
        channel_id=youtube_channel_id(profile_url),
    )


def enrichment_metadata(creator: dict[str, Any]) -> dict[str, Any]:
    evidence = creator.get("evidence_json") if isinstance(creator.get("evidence_json"), dict) else {}
    metadata = evidence.get("profile_enrichment") if isinstance(evidence.get("profile_enrichment"), dict) else {}
    return metadata


def enriched_recently(creator: dict[str, Any], refresh_hours: int, current: datetime | None = None) -> bool:
    metadata = enrichment_metadata(creator)
    enriched_at = parse_datetime(metadata.get("enriched_at"))
    if not enriched_at:
        return False
    now = current or datetime.now(timezone.utc)
    return (now - enriched_at).total_seconds() < refresh_hours * 3600


def dedupe_targets(creators: list[dict[str, Any]], refresh_hours: int, force: bool, limit: int) -> tuple[list[ProfileTarget], int]:
    targets: list[ProfileTarget] = []
    skipped_recent = 0
    seen: set[tuple[str, str]] = set()
    for creator in creators:
        target = target_from_creator(creator)
        if not target:
            continue
        key = (target.platform, target.profile_url.lower().rstrip("/"))
        if key in seen:
            continue
        seen.add(key)
        if not force and enriched_recently(creator, refresh_hours):
            skipped_recent += 1
            continue
        targets.append(target)
        if len(targets) >= limit:
            break
    return targets, skipped_recent


def template_value(value: Any, target: ProfileTarget, max_posts: int) -> Any:
    if isinstance(value, str):
        return (
            value.replace("{{profile_url}}", target.profile_url)
            .replace("{{username}}", target.username or "")
            .replace("{{channel_id}}", target.channel_id or "")
            .replace("{{max_posts}}", str(max_posts))
        )
    if isinstance(value, list):
        return [template_value(item, target, max_posts) for item in value]
    if isinstance(value, dict):
        return {key: template_value(item, target, max_posts) for key, item in value.items()}
    return value


def default_actor_input(target: ProfileTarget, max_posts: int) -> dict[str, Any]:
    if target.platform == "tiktok":
        return {
            "profiles": [target.username or target.profile_url],
            "profileScrapeSections": ["videos"],
            "profileSorting": "latest",
            "maxItems": max_posts,
        }
    if target.platform == "instagram":
        return {"directUrls": [target.profile_url], "resultsLimit": max_posts, "resultsType": "posts"}
    if target.platform == "x":
        query = f"from:{target.username}" if target.username else target.profile_url
        return {"searchTerms": [query], "maxItems": max_posts, "sort": "Latest"}
    return {"startUrls": [target.profile_url], "maxItems": max_posts}


def actor_config_for_platform(configs: list[dict[str, Any]], platform: str) -> dict[str, Any] | None:
    for config in configs:
        configured_platform = normalized_platform(config.get("platform") or config.get("source"))
        if configured_platform == platform:
            return config
    return None


def actor_input(config: dict[str, Any], target: ProfileTarget, max_posts: int) -> dict[str, Any]:
    raw_input = config.get("input") if isinstance(config.get("input"), dict) else None
    if raw_input:
        return template_value(raw_input, target, max_posts)
    return default_actor_input(target, max_posts)


def synthetic_profile_item(target: ProfileTarget, items: list[dict[str, Any]], max_posts: int) -> dict[str, Any]:
    first = items[0] if items else {}
    posts = items[:max_posts]
    return {
        "profileUrl": target.profile_url,
        "url": target.profile_url,
        "username": target.username or first.get("username") or first.get("authorUsername"),
        "name": first.get("fullName") or first.get("name") or first.get("authorName") or target.creator.get("name"),
        "biography": first.get("biography") or first.get("bio") or first.get("description") or target.creator.get("fit_reason"),
        "followersCount": first.get("followersCount") or first.get("followers") or target.creator.get("follower_count"),
        "posts": posts,
    }


def enrichment_provenance(
    *,
    source: str,
    status: str,
    enriched_at: str,
    post_count: int = 0,
    actor_id: str | None = None,
    run_id: str | None = None,
    failure_reason: str | None = None,
) -> dict[str, Any]:
    return {
        "source": source,
        "status": status,
        "enriched_at": enriched_at,
        "post_count": post_count,
        **({"actor_id": actor_id} if actor_id else {}),
        **({"run_id": run_id} if run_id else {}),
        **({"failure_reason": failure_reason} if failure_reason else {}),
    }


def normalize_apify_enrichment(
    target: ProfileTarget,
    config: dict[str, Any],
    run: dict[str, Any],
    items: list[dict[str, Any]],
    max_posts: int,
    enriched_at: str,
) -> dict[str, Any] | None:
    if not items:
        return None
    profile_item = next((item for item in items if recent_posts(item)), None) or synthetic_profile_item(target, items, max_posts)
    normalized_config = {**config, "platform": target.platform, "source_type": "profile_history"}
    row = normalize_creator_item(profile_item, normalized_config, run)
    if not row:
        return None
    row["source"] = f"apify_{target.platform}"
    row["source_url"] = target.profile_url
    row["author_url"] = target.profile_url
    row["external_id"] = f"profile_enrichment_{target.platform}_{target.profile_url.lower().rstrip('/')}"
    row["dedupe_hash"] = dedupe_hash(row["source"], row["external_id"], target.profile_url)
    raw_json = row.setdefault("raw_json", {})
    evidence = raw_json.setdefault("creator_evidence", {})
    provenance = enrichment_provenance(
        source="apify",
        status="success" if evidence.get("history_quality") == "profile_history" else "partial",
        enriched_at=enriched_at,
        post_count=len(evidence.get("recent_posts") or []),
        actor_id=str(config.get("actor_id") or ""),
        run_id=str(run.get("id") or ""),
    )
    evidence["profile_enrichment"] = provenance
    raw_json["profile_enrichment"] = provenance
    return row


def fetch_youtube_profile(target: ProfileTarget, settings: Settings, max_posts: int, enriched_at: str) -> dict[str, Any] | None:
    if not target.channel_id or not settings.youtube_api_key:
        return None
    youtube = build("youtube", "v3", developerKey=settings.youtube_api_key)
    channel_response = youtube.channels().list(part="snippet,statistics", id=target.channel_id, maxResults=1).execute()
    channel = (channel_response.get("items") or [None])[0]
    if not channel:
        return None
    search_response = youtube.search().list(
        part="snippet",
        channelId=target.channel_id,
        type="video",
        order="date",
        maxResults=min(max_posts, 50),
    ).execute()
    posts = []
    for item in search_response.get("items", []):
        video_id = (item.get("id") or {}).get("videoId")
        snippet = item.get("snippet") or {}
        if not video_id:
            continue
        posts.append(
            {
                "title": snippet.get("title"),
                "description": snippet.get("description"),
                "published_at": snippet.get("publishedAt"),
                "url": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    snippet = channel.get("snippet") or {}
    statistics = channel.get("statistics") or {}
    item = {
        "profileUrl": target.profile_url,
        "channelId": target.channel_id,
        "name": snippet.get("title") or target.creator.get("name"),
        "description": snippet.get("description") or target.creator.get("fit_reason"),
        "subscriberCount": statistics.get("subscriberCount"),
        "videos": posts,
    }
    row = normalize_creator_item(item, {"platform": "youtube", "actor_id": "youtube_api", "keyword": "profile enrichment"}, {"id": "youtube_api"})
    if not row:
        return None
    row["source"] = "youtube"
    row["source_url"] = target.profile_url
    row["author_url"] = target.profile_url
    row["external_id"] = f"profile_enrichment_youtube_{target.profile_url.lower().rstrip('/')}"
    row["dedupe_hash"] = dedupe_hash("youtube", row["external_id"], target.profile_url)
    raw_json = row.setdefault("raw_json", {})
    evidence = raw_json.setdefault("creator_evidence", {})
    provenance = enrichment_provenance(
        source="youtube_api",
        status="success" if evidence.get("history_quality") == "profile_history" else "partial",
        enriched_at=enriched_at,
        post_count=len(evidence.get("recent_posts") or []),
    )
    evidence["profile_enrichment"] = provenance
    raw_json["profile_enrichment"] = provenance
    return row


def failure_metadata(target: ProfileTarget, reason: str, enriched_at: str) -> dict[str, Any]:
    return enrichment_provenance(
        source="profile_enrichment",
        status="failure",
        enriched_at=enriched_at,
        post_count=0,
        failure_reason=reason[:500],
    )


def success_metadata(row: dict[str, Any]) -> dict[str, Any]:
    raw_json = row.get("raw_json") if isinstance(row.get("raw_json"), dict) else {}
    evidence = raw_json.get("creator_evidence") if isinstance(raw_json.get("creator_evidence"), dict) else {}
    metadata = evidence.get("profile_enrichment") if isinstance(evidence.get("profile_enrichment"), dict) else {}
    return metadata


def enrich_target(
    target: ProfileTarget,
    settings: Settings,
    apify_client: ApifyClient | None,
    configs: list[dict[str, Any]],
    max_posts: int,
) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    enriched_at = now_iso()
    try:
        if target.platform == "youtube":
            row = fetch_youtube_profile(target, settings, max_posts, enriched_at)
            if row:
                return row, success_metadata(row)
        config = actor_config_for_platform(configs, target.platform)
        if not config:
            return None, failure_metadata(target, f"No profile-history actor configured for {target.platform}", enriched_at)
        if not apify_client:
            return None, failure_metadata(target, "APIFY_TOKEN is required for actor-based enrichment", enriched_at)
        run, items = apify_client.run_actor(str(config["actor_id"]), actor_input(config, target, max_posts))
        row = normalize_apify_enrichment(target, config, run, items, max_posts, enriched_at)
        if not row:
            return None, failure_metadata(target, "Actor returned no normalizable profile-history item", enriched_at)
        return row, success_metadata(row)
    except Exception as exc:  # noqa: BLE001 - failures are stored for operator review.
        return None, failure_metadata(target, str(exc), enriched_at)


def profile_enrichment_actor_configs(settings: Settings) -> list[dict[str, Any]]:
    return actor_configs(settings.profile_enrichment_actors_json)
