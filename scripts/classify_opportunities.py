#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.llm import LLM
from xroutreach.rules import priority_for_score


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    llm = LLM(cfg)

    items = db.fetch_unprocessed_raw_items(args.limit)
    priority_counts = {"high": 0, "medium": 0, "low": 0}
    action_counts: dict[str, int] = {}
    for item in items:
        result = llm.classify(item)
        score = int(result.get("score", 0))
        priority = result.get("priority") or priority_for_score(score)
        action = result.get("recommended_action", "monitor")
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        action_counts[action] = action_counts.get(action, 0) + 1
        db.upsert_opportunity(
            {
                "raw_item_id": item["id"],
                "platform": item["source"],
                "opportunity_type": result.get("opportunity_type", "do_not_engage"),
                "summary": result.get("summary", ""),
                "pain_point": result.get("pain_point", ""),
                "xrworkout_relevance": result.get("xrworkout_relevance", ""),
                "audience_type": result.get("audience_type", ""),
                "score": score,
                "priority": priority,
                "recommended_action": action,
                "outreach_safety": result.get("outreach_safety", "review"),
                "status": "new",
            }
        )
        db.mark_raw_processed(item["id"])

    print(
        "Classification: "
        f"processed={len(items)} high={priority_counts.get('high', 0)} "
        f"medium={priority_counts.get('medium', 0)} low={priority_counts.get('low', 0)} "
        f"actions={action_counts}"
    )


if __name__ == "__main__":
    main()
