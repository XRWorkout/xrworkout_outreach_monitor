#!/usr/bin/env python
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from typing import Any

import praw

from xroutreach.config import KEYWORDS, SUBREDDITS, require, settings
from xroutreach.db import OutreachDB
from xroutreach.dedupe import dedupe_hash


def build_reddit():
    cfg = settings()
    require(
        [
            ("REDDIT_CLIENT_ID", cfg.reddit_client_id),
            ("REDDIT_CLIENT_SECRET", cfg.reddit_client_secret),
            ("REDDIT_USER_AGENT", cfg.reddit_user_agent),
        ]
    )
    return praw.Reddit(
        client_id=cfg.reddit_client_id,
        client_secret=cfg.reddit_client_secret,
        user_agent=cfg.reddit_user_agent,
    )


def submission_to_row(submission: Any, subreddit: str, keyword: str) -> dict[str, Any]:
    external_id = f"reddit_submission_{submission.id}"
    url = f"https://www.reddit.com{submission.permalink}"
    return {
        "source": "reddit",
        "source_url": url,
        "external_id": external_id,
        "author_name": str(submission.author) if submission.author else None,
        "author_url": f"https://www.reddit.com/user/{submission.author}" if submission.author else None,
        "title": submission.title,
        "body": submission.selftext or "",
        "published_at": datetime.fromtimestamp(submission.created_utc, tz=timezone.utc).isoformat(),
        "raw_json": {
            "subreddit": subreddit,
            "keyword": keyword,
            "score": submission.score,
            "num_comments": submission.num_comments,
        },
        "dedupe_hash": dedupe_hash("reddit", external_id, url),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()

    reddit = build_reddit()
    db = OutreachDB(settings())
    rows: list[dict[str, Any]] = []

    for subreddit_name in SUBREDDITS:
        subreddit = reddit.subreddit(subreddit_name)
        for keyword in KEYWORDS:
            for submission in subreddit.search(keyword, sort="new", time_filter="week", limit=args.limit):
                rows.append(submission_to_row(submission, subreddit_name, keyword))

    db.upsert_raw_items(rows)
    print(f"Upserted {len(rows)} Reddit raw items")


if __name__ == "__main__":
    main()
