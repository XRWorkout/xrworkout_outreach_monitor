#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.apify import ApifyClient, actor_configs, normalize_social_item
from xroutreach.config import require, settings
from xroutreach.db import OutreachDB


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    cfg = settings()
    if not cfg.apify_enabled:
        print("Apify social collection: disabled")
        return
    require([("APIFY_TOKEN", cfg.apify_token)])
    configs = actor_configs(cfg.apify_social_actors_json)
    if not configs:
        print("Apify social collection: no actors configured")
        return

    client = ApifyClient(cfg)
    db = OutreachDB(cfg)
    rows = []
    run_limit = max(0, cfg.apify_max_runs_per_day)
    item_limit = args.limit or cfg.apify_max_items_per_run
    for config in configs[:run_limit]:
        actor_input = dict(config.get("input") or {})
        actor_input.setdefault("maxItems", item_limit)
        run, items = client.run_actor(str(config["actor_id"]), actor_input)
        for item in items[:item_limit]:
            if not isinstance(item, dict):
                continue
            row = normalize_social_item(item, config, run)
            if row:
                rows.append(row)

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    print(
        "Apify social collection: "
        f"actors={min(len(configs), run_limit)} matched={len(rows)} unique={len(unique_rows)}"
    )


if __name__ == "__main__":
    main()
