#!/usr/bin/env python
from __future__ import annotations

import argparse

import requests

from xroutreach.config import settings
from xroutreach.conversation_sources import config_array, feed_entries, normalize_blog_entry
from xroutreach.db import OutreachDB


DEFAULT_BLOG_FEEDS = [
    {"name": "Meta Quest Blog", "url": "https://www.meta.com/blog/quest/rss/"},
    {"name": "Road to VR", "url": "https://www.roadtovr.com/feed/"},
    {"name": "UploadVR", "url": "https://www.uploadvr.com/rss/"},
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=15)
    parser.add_argument("--timeout-seconds", type=int, default=20)
    args = parser.parse_args()

    cfg = settings()
    feeds = config_array(cfg.blog_feeds_json, "BLOG_FEEDS_JSON") or DEFAULT_BLOG_FEEDS
    db = OutreachDB(cfg)
    rows = []
    warnings = []
    for feed in feeds:
        feed_url = str(feed.get("url") or "")
        if not feed_url:
            continue
        try:
            response = requests.get(feed_url, timeout=args.timeout_seconds)
            response.raise_for_status()
            entries = feed_entries(response.text)
        except (requests.RequestException, ValueError) as exc:
            warnings.append(f"Skipped {feed_url}: {exc}")
            continue
        for entry in entries[: args.limit]:
            row = normalize_blog_entry(entry, feed)
            if row:
                rows.append(row)

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    for warning in warnings:
        print(warning)
    print(f"Blog collection: matched={len(rows)} unique={len(unique_rows)} warnings={len(warnings)}")


if __name__ == "__main__":
    main()
