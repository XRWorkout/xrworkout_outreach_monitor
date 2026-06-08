#!/usr/bin/env python
from __future__ import annotations

import argparse
from typing import Any

import requests

from xroutreach.config import settings
from xroutreach.conversation_sources import config_array, discourse_endpoint, normalize_discourse_topic
from xroutreach.db import OutreachDB


DEFAULT_FORUM_SOURCES = [
    {
        "name": "Meta Community Forums",
        "forum_url": "https://communityforums.atmeta.com",
        "mode": "search",
        "query": "Quest workout OR VR fitness OR FitXR OR Supernatural",
    }
]


def topics_from_payload(payload: dict[str, Any]) -> list[dict[str, Any]]:
    topics = payload.get("topic_list", {}).get("topics") if isinstance(payload.get("topic_list"), dict) else None
    if isinstance(topics, list):
        return [topic for topic in topics if isinstance(topic, dict)]
    topics = payload.get("topics")
    if isinstance(topics, list):
        return [topic for topic in topics if isinstance(topic, dict)]
    results = payload.get("results")
    if isinstance(results, list):
        rows = []
        for result in results:
            if not isinstance(result, dict):
                continue
            topic = result.get("topic")
            rows.append(topic if isinstance(topic, dict) else result)
        return rows
    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--timeout-seconds", type=int, default=20)
    args = parser.parse_args()

    cfg = settings()
    sources = config_array(cfg.forum_sources_json, "FORUM_SOURCES_JSON") or DEFAULT_FORUM_SOURCES
    db = OutreachDB(cfg)
    rows = []
    warnings = []
    for source in sources:
        forum_url = str(source.get("forum_url") or source.get("url") or "").rstrip("/")
        if not forum_url:
            continue
        try:
            response = requests.get(discourse_endpoint(source), timeout=args.timeout_seconds)
            response.raise_for_status()
            topics = topics_from_payload(response.json())
        except requests.RequestException as exc:
            warnings.append(f"Skipped {forum_url}: {exc}")
            continue
        for topic in topics[: args.limit]:
            row = normalize_discourse_topic(topic, source, forum_url)
            if row:
                rows.append(row)

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    for warning in warnings:
        print(warning)
    print(f"Forum collection: matched={len(rows)} unique={len(unique_rows)} warnings={len(warnings)}")


if __name__ == "__main__":
    main()
