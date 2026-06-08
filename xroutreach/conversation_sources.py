from __future__ import annotations

import html
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin

from xroutreach.config import KEYWORDS
from xroutreach.dedupe import dedupe_hash


ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
MAX_BODY_CHARS = 5000


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.parts.append(text)

    def text(self) -> str:
        return " ".join(self.parts)


def config_array(raw_json: str, label: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(raw_json or "[]")
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"{label} must be valid JSON") from exc
    if not isinstance(parsed, list):
        raise RuntimeError(f"{label} must be a JSON array")
    configs = []
    for entry in parsed:
        if isinstance(entry, str):
            configs.append({"url": entry})
        elif isinstance(entry, dict) and entry.get("url"):
            configs.append(entry)
        elif isinstance(entry, dict) and entry.get("forum_url"):
            configs.append(entry)
        else:
            raise RuntimeError(f"Each {label} entry must be a URL string or object")
    return configs


def html_to_text(value: str | None) -> str:
    parser = TextExtractor()
    parser.feed(value or "")
    return parser.text()[:MAX_BODY_CHARS]


def parse_datetime(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except ValueError:
        try:
            return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            return datetime.now(timezone.utc).isoformat()


def safe_int(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 0
    return parsed if parsed >= 0 else 0


def discourse_endpoint(config: dict[str, Any]) -> str:
    base = str(config.get("forum_url") or config.get("url") or "").rstrip("/")
    mode = str(config.get("mode") or "latest").lower()
    if mode == "search":
        query = str(config.get("query") or " OR ".join(KEYWORDS[:5]))
        return f"{base}/search.json?q={query}"
    if mode == "top":
        period = str(config.get("period") or "weekly")
        return f"{base}/top/{period}.json"
    category = config.get("category_slug")
    if category:
        return f"{base}/c/{category}.json"
    return f"{base}/latest.json"


def normalize_discourse_topic(topic: dict[str, Any], config: dict[str, Any], forum_url: str) -> dict[str, Any] | None:
    topic_id = topic.get("id") or topic.get("topic_id")
    slug = topic.get("slug") or topic.get("topic_slug") or ""
    if not topic_id:
        return None
    source_url = str(topic.get("url") or urljoin(forum_url.rstrip("/") + "/", f"t/{slug}/{topic_id}"))
    title = str(topic.get("title") or "Forum discussion")
    body = html_to_text(str(topic.get("excerpt") or topic.get("blurb") or ""))
    author = topic.get("authorUsername") or topic.get("last_poster_username") or topic.get("username")
    tags = topic.get("tags") if isinstance(topic.get("tags"), list) else []
    source = str(config.get("source") or "vr_forum")
    external_id = f"{source}_{topic_id}"
    return {
        "source": source,
        "source_url": source_url,
        "external_id": external_id,
        "author_name": author,
        "author_url": None,
        "title": title[:500],
        "body": body,
        "follower_count": None,
        "published_at": parse_datetime(topic.get("created_at") or topic.get("createdAt") or topic.get("last_posted_at") or topic.get("lastPostedAt")),
        "raw_json": {
            "collector": "forums",
            "source_type": "forum_thread",
            "platform": "vr_forum",
            "community": config.get("name") or forum_url,
            "forum_url": forum_url,
            "tags": tags,
            "engagement": {
                "comments": safe_int(topic.get("posts_count") or topic.get("postsCount") or topic.get("reply_count") or topic.get("replyCount")),
                "likes": safe_int(topic.get("like_count") or topic.get("likeCount")),
                "views": safe_int(topic.get("views")),
            },
            "manual_action": "join_manually",
            "automation_policy": "no_auto_post_or_dm",
            "dataset_item": topic,
        },
        "dedupe_hash": dedupe_hash(source, external_id, source_url),
    }


def feed_entries(xml_text: str) -> list[dict[str, str]]:
    root = ET.fromstring(xml_text)
    if root.tag.endswith("feed"):
        entries = []
        for entry in root.findall("atom:entry", ATOM_NS):
            link = entry.find("atom:link", ATOM_NS)
            entries.append(
                {
                    "id": text_of(entry, "id"),
                    "title": text_of(entry, "title"),
                    "url": (link.attrib.get("href") if link is not None else "") or "",
                    "body": text_of(entry, "summary") or text_of(entry, "content"),
                    "author": text_of(entry, "author/name"),
                    "published": text_of(entry, "published") or text_of(entry, "updated"),
                }
            )
        return entries

    channel = root.find("channel")
    if channel is None:
        return []
    entries = []
    for item in channel.findall("item"):
        entries.append(
            {
                "id": child_text(item, "guid") or child_text(item, "link"),
                "title": child_text(item, "title"),
                "url": child_text(item, "link"),
                "body": child_text(item, "description"),
                "author": child_text(item, "author") or child_text(item, "{http://purl.org/dc/elements/1.1/}creator"),
                "published": child_text(item, "pubDate") or child_text(item, "published"),
            }
        )
    return entries


def text_of(entry: ET.Element, path: str) -> str:
    child = entry.find("/".join(f"atom:{part}" for part in path.split("/")), ATOM_NS)
    return html.unescape(child.text).strip() if child is not None and child.text else ""


def child_text(entry: ET.Element, tag: str) -> str:
    child = entry.find(tag)
    return html.unescape(child.text).strip() if child is not None and child.text else ""


def normalize_blog_entry(entry: dict[str, str], config: dict[str, Any]) -> dict[str, Any] | None:
    url = entry.get("url")
    external_id = entry.get("id") or url
    if not url or not external_id:
        return None
    source = str(config.get("source") or "vr_blog")
    title = entry.get("title") or "VR blog article"
    body = html_to_text(entry.get("body"))
    return {
        "source": source,
        "source_url": url,
        "external_id": f"{source}_{external_id}",
        "author_name": entry.get("author") or config.get("name"),
        "author_url": config.get("site_url") or config.get("url"),
        "title": title[:500],
        "body": body,
        "follower_count": None,
        "published_at": parse_datetime(entry.get("published")),
        "raw_json": {
            "collector": "blogs",
            "source_type": "blog_article",
            "platform": "vr_blog",
            "feed_url": config.get("url"),
            "publication": config.get("name"),
            "manual_action": "review_source",
            "automation_policy": "no_auto_post_or_dm",
            "dataset_item": entry,
        },
        "dedupe_hash": dedupe_hash(source, str(external_id), url),
    }
