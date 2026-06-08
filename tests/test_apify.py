from __future__ import annotations

from xroutreach.apify import actor_configs, normalize_conversation_item, normalize_creator_item, normalize_social_item, post_date


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
    assert row["raw_json"]["creator_evidence"]["history_quality"] == "profile_history"


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


def test_post_date_accepts_tiktok_millisecond_timestamps():
    assert post_date({"createTime": 1780272000000}).startswith("2026-06-01")


def test_post_date_accepts_twitter_style_dates():
    assert post_date({"created_at": "Wed Mar 06 10:00:39 +0000 2024"}) == "2024-03-06T10:00:39+00:00"


def test_normalize_x_conversation_item_preserves_source_type_and_engagement():
    row = normalize_conversation_item(
        {
            "id": "tweet-1",
            "url": "https://x.com/creator/status/1",
            "full_text": "Looking for a better Quest workout than FitXR",
            "createdAt": "2026-06-01T00:00:00+00:00",
            "username": "creator",
            "favorite_count": 12,
            "reply_count": 3,
        },
        {"actor_id": "maximedupre/twitter-scraper", "platform": "x", "purpose": "conversation_discovery"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
    )

    assert row is not None
    assert row["source"] == "apify_x"
    assert row["raw_json"]["source_type"] == "social_post"
    assert row["raw_json"]["engagement"]["likes"] == 12
    assert row["raw_json"]["automation_policy"] == "no_auto_post_or_dm"


def test_normalize_facebook_group_item_can_be_group_post():
    row = normalize_conversation_item(
        {
            "postId": "post-1",
            "facebookUrl": "https://facebook.com/groups/vr/post/1",
            "text": "Has anyone tried VR boxing for cardio?",
            "commentsCount": 8,
            "authorName": "Group Member",
        },
        {"actor_id": "apify/facebook-groups-scraper", "platform": "facebook_group", "source_type": "group_post"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
    )

    assert row is not None
    assert row["source"] == "apify_facebook_group"
    assert row["raw_json"]["source_type"] == "group_post"
    assert row["raw_json"]["manual_action"] == "join_manually"


def test_normalize_discord_server_discovery_is_review_only():
    row = normalize_conversation_item(
        {
            "serverId": "server-1",
            "serverUrl": "https://discord.com/invite/example",
            "serverName": "VR Fitness Community",
            "description": "Public Discord for Quest workouts",
            "memberCount": 2500,
        },
        {"actor_id": "easyapi/discord-servers-scraper", "platform": "discord", "source_type": "server_discovery"},
        {"id": "run-1", "defaultDatasetId": "dataset-1"},
    )

    assert row is not None
    assert row["source"] == "apify_discord"
    assert row["raw_json"]["source_type"] == "server_discovery"
    assert row["raw_json"]["manual_action"] == "review_source"
