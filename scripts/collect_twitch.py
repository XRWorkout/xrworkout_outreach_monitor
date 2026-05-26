#!/usr/bin/env python
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any

import requests

from xroutreach.config import KEYWORDS, require, settings
from xroutreach.db import OutreachDB
from xroutreach.dedupe import dedupe_hash


def twitch_token(client_id: str, client_secret: str) -> str:
    response = requests.post(
        "https://id.twitch.tv/oauth2/token",
        data={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials",
        },
        timeout=20,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()

    cfg = settings()
    require(
        [
            ("TWITCH_CLIENT_ID", cfg.twitch_client_id),
            ("TWITCH_CLIENT_SECRET", cfg.twitch_client_secret),
        ]
    )
    token = twitch_token(cfg.twitch_client_id, cfg.twitch_client_secret)
    headers = {
        "Client-ID": cfg.twitch_client_id,
        "Authorization": f"Bearer {token}",
    }
    db = OutreachDB(cfg)
    rows: list[dict[str, Any]] = []

    for keyword in KEYWORDS:
        response = requests.get(
            "https://api.twitch.tv/helix/search/channels",
            headers=headers,
            params={"query": keyword, "first": min(args.limit, 100), "live_only": "false"},
            timeout=20,
        )
        response.raise_for_status()
        for item in response.json().get("data", []):
            broadcaster_login = item.get("broadcaster_login") or item.get("display_name")
            external_id = f"twitch_channel_{item.get('id')}"
            url = f"https://www.twitch.tv/{broadcaster_login}"
            rows.append(
                {
                    "source": "twitch",
                    "source_url": url,
                    "external_id": external_id,
                    "author_name": item.get("display_name"),
                    "author_url": url,
                    "title": item.get("title"),
                    "body": item.get("game_name") or "",
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "raw_json": {"keyword": keyword, "channel": item},
                    "dedupe_hash": dedupe_hash("twitch", external_id, url),
                }
            )

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    print(f"Twitch collection: matched={len(rows)} unique={len(unique_rows)} keywords={len(KEYWORDS)}")


if __name__ == "__main__":
    main()
