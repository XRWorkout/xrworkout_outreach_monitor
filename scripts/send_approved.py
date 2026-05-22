#!/usr/bin/env python
from __future__ import annotations

import argparse
from datetime import date

from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.emailer import Emailer
from xroutreach.rules import next_followup_date, sendable_status


def recipient_for_draft(draft: dict) -> str | None:
    creator = draft.get("creators") or {}
    contact = creator.get("public_contact")
    if contact and "@" in contact:
        return contact
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = settings()
    db = OutreachDB(cfg)
    emailer = None if (args.dry_run or cfg.dry_run_send) else Emailer(cfg)

    sent = 0
    skipped = 0
    for draft in db.fetch_approved_drafts(args.limit):
        if not sendable_status(draft.get("status", "")):
            skipped += 1
            continue
        if draft.get("channel") != "email":
            skipped += 1
            continue
        to_email = recipient_for_draft(draft)
        if not to_email:
            skipped += 1
            continue
        if emailer:
            emailer.send(to_email, draft.get("subject") or "XRWorkout creator access", draft["body"])
            db.mark_draft_sent(draft["id"])
            db.insert_followup(
                {
                    "draft_id": draft["id"],
                    "due_date": next_followup_date(1, date.today()).isoformat(),
                    "cadence_step": 1,
                    "status": "pending",
                }
            )
        sent += 1

    mode = "dry-run" if (args.dry_run or cfg.dry_run_send) else "sent"
    print(f"{mode}: {sent}; skipped: {skipped}")


if __name__ == "__main__":
    main()
