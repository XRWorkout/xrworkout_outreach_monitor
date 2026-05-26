#!/usr/bin/env python
from __future__ import annotations

import argparse
import json
from datetime import date

from xroutreach.config import settings
from xroutreach.db import OutreachDB


def followup_summary(row: dict) -> dict:
    draft = row.get("drafts") or {}
    creator = draft.get("creators") or {}
    opportunity = draft.get("opportunities") or {}
    return {
        "id": row.get("id"),
        "due_date": row.get("due_date"),
        "cadence_step": row.get("cadence_step"),
        "status": row.get("status"),
        "creator": creator.get("name"),
        "contact": creator.get("public_contact"),
        "subject": draft.get("subject"),
        "opportunity": opportunity.get("summary"),
        "draft_body": row.get("draft_body"),
    }


def print_text(rows: list[dict]) -> None:
    if not rows:
        print("No pending follow-ups due.")
        return
    for row in rows:
        summary = followup_summary(row)
        print(f"{summary['due_date']} step {summary['cadence_step']} - {summary['creator'] or 'Unknown creator'}")
        print(f"  contact: {summary['contact'] or 'none'}")
        print(f"  subject: {summary['subject'] or 'No subject'}")
        if summary["opportunity"]:
            print(f"  opportunity: {summary['opportunity']}")
        if summary["draft_body"]:
            print(f"  note: {summary['draft_body']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--as-of", default=date.today().isoformat())
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    as_of = date.fromisoformat(args.as_of)
    rows = OutreachDB(settings()).fetch_due_followups(as_of, args.limit)
    if args.format == "json":
        print(json.dumps([followup_summary(row) for row in rows], indent=2))
        return
    print_text(rows)
    print(f"Due pending follow-ups: {len(rows)}")


if __name__ == "__main__":
    main()
