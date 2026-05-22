#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.llm import LLM


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    llm = LLM(cfg)

    created = 0
    for item in db.fetch_creator_source_items(args.limit):
        fit = llm.creator_fit(item)
        if not fit.get("should_create", False):
            continue
        db.upsert_creator(
            {
                "name": fit.get("name") or item.get("author_name") or "Unknown",
                "platform": item["source"],
                "profile_url": fit.get("profile_url") or item.get("author_url") or item.get("source_url"),
                "public_contact": fit.get("public_contact"),
                "niche": fit.get("niche", ""),
                "audience_estimate": fit.get("audience_estimate", ""),
                "audience_quality": fit.get("audience_quality", ""),
                "recent_relevant_content": item.get("source_url"),
                "fit_reason": fit.get("fit_reason", ""),
                "offer_angle": fit.get("offer_angle", ""),
                "priority": fit.get("priority", "medium"),
                "status": "new",
            }
        )
        created += 1

    print(f"Upserted {created} creator prospects")


if __name__ == "__main__":
    main()
