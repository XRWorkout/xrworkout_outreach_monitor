#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.llm import LLM


def actionable_for_operator(opportunity: dict) -> bool:
    unsafe = {"do_not_engage", "unsafe", "competitor_owned", "medical_claim_risk"}
    if opportunity.get("outreach_safety") in unsafe:
        return False
    if opportunity.get("recommended_action") == "do_not_engage":
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--opportunity-id", required=True)
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    llm = LLM(cfg)

    opportunity = db.fetch_opportunity(args.opportunity_id)
    if not opportunity:
        raise RuntimeError(f"Opportunity not found: {args.opportunity_id}")
    if not actionable_for_operator(opportunity):
        raise RuntimeError("Opportunity is marked unsafe or do_not_engage; no draft generated.")

    draft = llm.draft(opportunity)
    if not draft["body"]:
        raise RuntimeError("LLM returned an empty draft body.")

    db.insert_draft(
        {
            "opportunity_id": opportunity["id"],
            "channel": draft["channel"],
            "subject": draft["subject"],
            "body": draft["body"],
            "status": "needs_review",
        }
    )
    print(
        "Manual opportunity draft generation: "
        f"opportunity_id={opportunity['id']} channel={draft['channel']} status=needs_review"
    )


if __name__ == "__main__":
    main()
