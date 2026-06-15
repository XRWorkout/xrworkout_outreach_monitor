from __future__ import annotations

from datetime import datetime, timedelta, timezone

from xroutreach.apify import creator_evidence
from xroutreach.profile_enrichment import (
    actor_input,
    dedupe_targets,
    normalize_apify_enrichment,
    target_from_creator,
    template_value,
)


def creator(profile_url: str, platform: str = "apify_tiktok", evidence_json: dict | None = None) -> dict:
    return {
        "id": profile_url,
        "name": "Creator",
        "platform": platform,
        "profile_url": profile_url,
        "evidence_json": evidence_json or {},
    }


def test_target_from_creator_parses_supported_profile_urls():
    tiktok = target_from_creator(creator("https://www.tiktok.com/@questcoach"))
    instagram = target_from_creator(creator("https://www.instagram.com/questcoach", "instagram"))
    x = target_from_creator(creator("https://x.com/questcoach", "twitter"))
    youtube = target_from_creator(creator("https://www.youtube.com/channel/UC123", "youtube"))

    assert tiktok and tiktok.platform == "tiktok" and tiktok.username == "questcoach"
    assert instagram and instagram.platform == "instagram" and instagram.username == "questcoach"
    assert x and x.platform == "x" and x.username == "questcoach"
    assert youtube and youtube.platform == "youtube" and youtube.channel_id == "UC123"


def test_dedupe_targets_skips_recent_enrichment_and_limits_results():
    recent = datetime.now(timezone.utc) - timedelta(hours=2)
    rows = [
        creator("https://www.tiktok.com/@recent", evidence_json={"profile_enrichment": {"enriched_at": recent.isoformat()}}),
        creator("https://www.tiktok.com/@one"),
        creator("https://www.tiktok.com/@one"),
        creator("https://www.instagram.com/two", "instagram"),
    ]

    targets, skipped_recent = dedupe_targets(rows, refresh_hours=24, force=False, limit=1)

    assert skipped_recent == 1
    assert len(targets) == 1
    assert targets[0].profile_url == "https://www.tiktok.com/@one"


def test_template_value_replaces_profile_placeholders():
    target = target_from_creator(creator("https://x.com/questcoach", "x"))
    assert target is not None

    rendered = template_value(
        {"searchTerms": ["from:{{username}}"], "maxItems": "{{max_posts}}", "url": "{{profile_url}}"},
        target,
        25,
    )

    assert rendered == {
        "searchTerms": ["from:questcoach"],
        "maxItems": "25",
        "url": "https://x.com/questcoach",
    }


def test_actor_input_uses_default_profile_shapes_when_input_missing():
    target = target_from_creator(creator("https://www.tiktok.com/@questcoach"))
    assert target is not None

    rendered = actor_input({"platform": "tiktok", "actor_id": "actor"}, target, 10)

    assert rendered["profiles"] == ["questcoach"]
    assert rendered["profileScrapeSections"] == ["videos"]
    assert rendered["maxItems"] == 10


def test_normalize_apify_enrichment_writes_profile_history_with_provenance():
    target = target_from_creator(creator("https://www.tiktok.com/@questcoach"))
    assert target is not None
    item = {
        "profileUrl": "https://www.tiktok.com/@questcoach",
        "username": "questcoach",
        "name": "Quest Coach",
        "posts": [
            {"caption": "Quest 3 boxing workout", "published_at": "2026-06-01T00:00:00+00:00", "url": "https://www.tiktok.com/@questcoach/video/1"},
            {"caption": "FitXR cardio", "published_at": "2026-05-25T00:00:00+00:00", "url": "https://www.tiktok.com/@questcoach/video/2"},
        ],
    }

    row = normalize_apify_enrichment(
        target,
        {"platform": "tiktok", "actor_id": "clockworks/tiktok-scraper"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
        [item],
        10,
        "2026-06-15T00:00:00+00:00",
    )

    assert row is not None
    evidence = row["raw_json"]["creator_evidence"]
    assert row["source"] == "apify_tiktok"
    assert evidence["history_quality"] == "profile_history"
    assert evidence["profile_enrichment"]["status"] == "success"
    assert evidence["profile_enrichment"]["post_count"] == 2


def test_profile_history_requires_dated_posts():
    evidence = creator_evidence(
        {
            "profileUrl": "https://www.instagram.com/questcoach",
            "posts": [{"caption": "Quest workout without a visible date"}],
        }
    )

    assert evidence["history_quality"] == "profile_only"
    assert evidence["activity_level"] == "unknown"
