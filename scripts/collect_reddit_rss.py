#!/usr/bin/env python
from __future__ import annotations

import argparse
import html
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import Any

import requests

from xroutreach.config import KEYWORDS, SUBREDDITS, settings
from xroutreach.db import OutreachDB
from xroutreach.dedupe import dedupe_hash


ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
DEFAULT_USER_AGENT = "XRWorkoutOutreachMonitor/0.1 contact: https://xrworkout.ai"
REDDIT_BASE_URL = "https://www.reddit.com"
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


def reddit_rss_urls() -> list[tuple[str, str, str]]:
    urls: list[tuple[str, str, str]] = []
    for subreddit in SUBREDDITS:
        urls.append((f"{REDDIT_BASE_URL}/r/{subreddit}/.rss", "subreddit", subreddit))
    for keyword in KEYWORDS:
        query = requests.utils.quote(f'"{keyword}"')
        urls.append((f"{REDDIT_BASE_URL}/search.rss?q={query}&sort=new", "search", keyword))
    return urls


def fetch_feed(url: str, user_agent: str, timeout: int) -> tuple[str | None, str | None]:
    response = requests.get(
        url,
        headers={"User-Agent": user_agent},
        timeout=timeout,
    )
    if response.status_code in {403, 429}:
        return None, f"Skipped {url}: Reddit returned {response.status_code}"
    response.raise_for_status()
    return response.text, None


def parse_datetime(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).isoformat()
    except ValueError:
        try:
            return parsedate_to_datetime(value).astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError):
            return datetime.now(timezone.utc).isoformat()


def entry_text(entry: ET.Element, tag: str) -> str:
    child = entry.find(f"atom:{tag}", ATOM_NS)
    if child is None or child.text is None:
        return ""
    return html.unescape(child.text).strip()


def html_to_text(value: str) -> str:
    parser = TextExtractor()
    parser.feed(value)
    return parser.text()[:MAX_BODY_CHARS]


def entry_link(entry: ET.Element) -> str:
    link = entry.find("atom:link", ATOM_NS)
    if link is None:
        return ""
    return (link.attrib.get("href") or "").strip()


def entry_author(entry: ET.Element) -> tuple[str | None, str | None]:
    name = entry.find("atom:author/atom:name", ATOM_NS)
    uri = entry.find("atom:author/atom:uri", ATOM_NS)
    author_name = html.unescape(name.text).strip() if name is not None and name.text else None
    author_url = uri.text.strip() if uri is not None and uri.text else None
    return author_name, author_url


def entry_subreddit(entry: ET.Element) -> str | None:
    category = entry.find("atom:category", ATOM_NS)
    if category is None:
        return None
    label = category.attrib.get("label") or category.attrib.get("term")
    if not label:
        return None
    return label.removeprefix("r/").strip()


def body_matches_keywords(title: str, body: str) -> bool:
    haystack = f"{title}\n{body}".lower()
    return any(keyword.lower() in haystack for keyword in KEYWORDS)


def parse_feed(xml_text: str, feed_url: str, feed_type: str, feed_value: str, limit: int) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    rows: list[dict[str, Any]] = []
    for entry in root.findall("atom:entry", ATOM_NS):
        external_id = entry_text(entry, "id")
        source_url = entry_link(entry)
        title = entry_text(entry, "title")
        body = html_to_text(entry_text(entry, "content"))
        if not external_id or not source_url:
            continue
        if not external_id.startswith("t3_"):
            continue
        if feed_type == "subreddit" and not body_matches_keywords(title, body):
            continue
        author_name, author_url = entry_author(entry)
        published_at = entry_text(entry, "published") or entry_text(entry, "updated")
        subreddit = entry_subreddit(entry) or (feed_value if feed_type == "subreddit" else None)
        rows.append(
            {
                "source": "reddit",
                "source_url": source_url,
                "external_id": f"reddit_rss_{external_id}",
                "author_name": author_name,
                "author_url": author_url,
                "title": title,
                "body": body,
                "published_at": parse_datetime(published_at),
                "raw_json": {
                    "collector": "reddit_rss",
                    "feed_url": feed_url,
                    "feed_type": feed_type,
                    "feed_value": feed_value,
                    "subreddit": subreddit,
                },
                "dedupe_hash": dedupe_hash("reddit", f"reddit_rss_{external_id}", source_url),
            }
        )
        if len(rows) >= limit:
            break
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25, help="Maximum items per feed")
    parser.add_argument("--max-total", type=int, default=100, help="Maximum items per run")
    parser.add_argument("--sleep-seconds", type=float, default=5.0)
    parser.add_argument("--timeout-seconds", type=int, default=20)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    user_agent = cfg.reddit_user_agent or DEFAULT_USER_AGENT
    rows: list[dict[str, Any]] = []
    warnings: list[str] = []

    for index, (url, feed_type, feed_value) in enumerate(reddit_rss_urls()):
        if index:
            time.sleep(args.sleep_seconds)
        xml_text, warning = fetch_feed(url, user_agent, args.timeout_seconds)
        if warning:
            warnings.append(warning)
            continue
        if not xml_text:
            continue
        remaining = args.max_total - len(rows)
        if remaining <= 0:
            break
        rows.extend(parse_feed(xml_text, url, feed_type, feed_value, min(args.limit, remaining)))

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    for warning in warnings:
        print(warning)
    print(f"Reddit RSS collection: matched={len(rows)} unique={len(unique_rows)} warnings={len(warnings)}")


if __name__ == "__main__":
    main()
