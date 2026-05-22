#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.llm import LLM
from xroutreach.rules import should_generate_draft


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    llm = LLM(cfg)

    opportunities = db.fetch_high_priority_opportunities_without_drafts(args.limit)
    count = 0
    for opportunity in opportunities:
        if not should_generate_draft(
            int(opportunity.get("score", 0)),
            opportunity.get("outreach_safety", ""),
            opportunity.get("recommended_action", ""),
        ):
            continue
        draft = llm.draft(opportunity)
        if not draft["body"]:
            continue
        db.insert_draft(
            {
                "opportunity_id": opportunity["id"],
                "channel": draft["channel"],
                "subject": draft["subject"],
                "body": draft["body"],
                "status": "needs_review",
            }
        )
        count += 1

    print(f"Generated {count} drafts")


if __name__ == "__main__":
    main()
