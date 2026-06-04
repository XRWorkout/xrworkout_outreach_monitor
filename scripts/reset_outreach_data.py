#!/usr/bin/env python
from __future__ import annotations

from xroutreach.config import settings
from xroutreach.db import OutreachDB


def main() -> None:
    db = OutreachDB(settings())
    before = db.delete_operational_data()
    after = db.weekly_counts()
    print("Operational outreach data reset")
    print("===============================")
    print("Before:")
    for table, count in before.items():
        print(f"{table}: {count}")
    print("")
    print("After:")
    for table, count in after.items():
        print(f"{table}: {count}")


if __name__ == "__main__":
    main()
