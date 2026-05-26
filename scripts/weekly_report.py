#!/usr/bin/env python
from __future__ import annotations

from xroutreach.config import settings
from xroutreach.db import OutreachDB


def main() -> None:
    db = OutreachDB(settings())
    counts = db.weekly_counts()
    print("XRWorkout outreach weekly report")
    print("================================")
    for table, count in counts.items():
        print(f"{table}: {count}")
    print("")
    print("Review high-priority opportunities, needs_review drafts, and due follow-ups in the dashboard.")


if __name__ == "__main__":
    main()
