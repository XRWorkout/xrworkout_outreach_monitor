#!/usr/bin/env python
from __future__ import annotations

import argparse

from xroutreach.apify import ApifyClient, actor_configs, normalize_conversation_item
from xroutreach.config import require, settings
from xroutreach.db import OutreachDB


def enabled_config(config: dict) -> bool:
    return bool(config.get("enabled_for_testing", True))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    cfg = settings()
    if not cfg.apify_enabled:
        print("Apify conversation collection: disabled")
        return
    require([("APIFY_TOKEN", cfg.apify_token)])
    configs = [config for config in actor_configs(cfg.apify_conversation_actors_json) if enabled_config(config)]
    if not configs:
        print("Apify conversation collection: no actors configured")
        return

    client = ApifyClient(cfg)
    db = OutreachDB(cfg)
    rows = []
    run_limit = max(0, cfg.apify_max_runs_per_day)
    item_limit = args.limit or cfg.apify_max_items_per_run
    for config in configs[:run_limit]:
        actor_input = dict(config.get("input") or {})
        actor_input.setdefault("maxItems", min(item_limit, int(config.get("max_targets") or item_limit)))
        run, items = client.run_actor(str(config["actor_id"]), actor_input)
        for item in items[:item_limit]:
            if not isinstance(item, dict):
                continue
            row = normalize_conversation_item(item, config, run)
            if row:
                rows.append(row)

    unique_rows = db.deduped_raw_payload(rows)
    db.upsert_raw_items(unique_rows)
    print(
        "Apify conversation collection: "
        f"actors={min(len(configs), run_limit)} matched={len(rows)} unique={len(unique_rows)}"
    )


if __name__ == "__main__":
    main()
