#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.apify import ApifyClient
from xroutreach.config import settings
from xroutreach.db import OutreachDB
from xroutreach.profile_enrichment import (
    dedupe_targets,
    enrich_target,
    profile_enrichment_actor_configs,
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--max-posts", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    cfg = settings()
    if not cfg.profile_enrichment_enabled and not args.dry_run:
        print("Profile enrichment: disabled")
        return

    limit = args.limit or cfg.profile_enrichment_max_creators_per_run
    max_posts = args.max_posts or cfg.profile_enrichment_max_posts_per_creator
    db = OutreachDB(cfg)
    creators = db.fetch_creators_for_profile_enrichment(max(limit * 5, limit))
    targets, skipped_recent = dedupe_targets(
        creators,
        refresh_hours=cfg.profile_enrichment_refresh_hours,
        force=args.force,
        limit=limit,
    )

    if args.dry_run:
        print(
            "Profile enrichment dry-run: "
            f"candidates={len(targets)} skipped_recent={skipped_recent} limit={limit} max_posts={max_posts}"
        )
        for target in targets:
            print(f"- {target.platform}: {target.profile_url}")
        return

    configs = profile_enrichment_actor_configs(cfg)
    apify_client = ApifyClient(cfg) if cfg.apify_token else None
    rows = []
    success = 0
    partial = 0
    failed = 0
    for target in targets:
        row, metadata = enrich_target(target, cfg, apify_client, configs, max_posts)
        db.update_creator_enrichment_metadata(target.creator, metadata)
        if not row:
            failed += 1
            continue
        rows.append(row)
        if metadata.get("status") == "success":
            success += 1
        else:
            partial += 1

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    print(
        "Profile enrichment: "
        f"candidates={len(targets)} success={success} partial={partial} failed={failed} "
        f"skipped_recent={skipped_recent} raw_rows={len(unique_rows)}"
    )


if __name__ == "__main__":
    main()
