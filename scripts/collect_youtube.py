#!/usr/bin/env python
from __future__ import annotations

import argparse
import re
from datetime import datetime, timezone
from typing import Any

from googleapiclient.discovery import build

from xroutreach.config import KEYWORDS, require, settings
from xroutreach.db import OutreachDB
from xroutreach.dedupe import dedupe_hash


EMAIL_RE = re.compile(r"(?<![A-Z0-9._%+-])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})(?![A-Z0-9._%+-])", re.IGNORECASE)


def public_email_from_text(*values: str | None) -> str | None:
    text = "\n".join(value or "" for value in values)
    match = EMAIL_RE.search(text)
    return match.group(1) if match else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()

    cfg = settings()
    require([("YOUTUBE_API_KEY", cfg.youtube_api_key)])
    youtube = build("youtube", "v3", developerKey=cfg.youtube_api_key)
    db = OutreachDB(cfg)
    rows: list[dict[str, Any]] = []

    for keyword in KEYWORDS:
        request = youtube.search().list(
            part="snippet",
            q=keyword,
            type="video",
            order="date",
            maxResults=min(args.limit, 50),
        )
        response = request.execute()
        for item in response.get("items", []):
            video_id = item["id"]["videoId"]
            snippet = item["snippet"]
            url = f"https://www.youtube.com/watch?v={video_id}"
            published_at = snippet.get("publishedAt") or datetime.now(timezone.utc).isoformat()
            public_contact = public_email_from_text(snippet.get("description"), snippet.get("channelTitle"))
            rows.append(
                {
                    "source": "youtube",
                    "source_url": url,
                    "external_id": f"youtube_video_{video_id}",
                    "author_name": snippet.get("channelTitle"),
                    "author_url": f"https://www.youtube.com/channel/{snippet.get('channelId')}",
                    "title": snippet.get("title"),
                    "body": snippet.get("description", ""),
                    "published_at": published_at,
                    "raw_json": {"keyword": keyword, "snippet": snippet, "public_contact": public_contact},
                    "dedupe_hash": dedupe_hash("youtube", video_id, url),
                }
            )

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    print(f"YouTube collection: matched={len(rows)} unique={len(unique_rows)} keywords={len(KEYWORDS)}")


if __name__ == "__main__":
    main()
