from __future__ import annotations

from xroutreach.apify import actor_configs, normalize_creator_item, normalize_social_item


def test_actor_configs_accepts_strings_and_objects():
    configs = actor_configs('[{"actor_id":"user/creator","input":{"maxItems":5}}, "user/social"]')

    assert configs[0]["actor_id"] == "user/creator"
    assert configs[0]["input"]["maxItems"] == 5
    assert configs[1]["actor_id"] == "user/social"


def test_normalize_creator_item_preserves_evidence_and_contact():
    row = normalize_creator_item(
        {
            "username": "questcoach",
            "profileUrl": "https://instagram.com/questcoach",
            "biography": "Quest 3 cardio workouts. Business: coach@example.com",
            "followersCount": 12000,
            "recentPosts": [
                {
                    "caption": "Quest 3 VR workout with boxing intervals",
                    "timestamp": "2026-06-01T00:00:00+00:00",
                    "commentsCount": 12,
                }
            ],
        },
        {"actor_id": "user/instagram", "platform": "instagram"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
    )

    assert row is not None
    assert row["source"] == "apify_instagram"
    assert row["raw_json"]["public_contact"] == "coach@example.com"
    assert row["raw_json"]["creator_evidence"]["recent_vr_posts_count"] == 1
    assert row["raw_json"]["creator_evidence"]["headset_confidence"] == "high"


def test_normalize_social_item_builds_raw_item_payload():
    row = normalize_social_item(
        {
            "id": "post-1",
            "url": "https://www.tiktok.com/@creator/video/1",
            "username": "creator",
            "caption": "Trying a VR fitness app",
            "timestamp": "2026-06-01T00:00:00+00:00",
        },
        {"actor_id": "user/tiktok", "platform": "tiktok"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
    )

    assert row is not None
    assert row["source"] == "apify_tiktok"
    assert row["external_id"] == "apify_tiktok_post-1"
    assert row["raw_json"]["actor_id"] == "user/tiktok"
