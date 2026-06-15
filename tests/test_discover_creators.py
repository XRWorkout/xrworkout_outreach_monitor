from __future__ import annotations

from datetime import datetime, timedelta, timezone

from scripts.discover_creators import (
    canonical_profile_url,
    conversation_author_lead_fit,
    creator_row,
    creator_source_slices,
    fallback_creator_fit,
    fit_source_item,
    group_items_by_creator,
    has_reliable_creator_history,
    is_apify_conversation_author_lead,
    normalize_platform,
    public_contact_from_item,
)


def test_fallback_creator_fit_promotes_keyword_matched_creator():
    item = {
        "source": "youtube",
        "source_url": "https://www.youtube.com/watch?v=abc",
        "author_name": "Quest Fitness Channel",
        "author_url": "https://www.youtube.com/channel/creator",
        "title": "Best VR fitness apps this month",
        "body": "",
        "raw_json": {"keyword": "VR fitness"},
    }

    fit = fallback_creator_fit(item)

    assert fit is not None
    assert fit["name"] == "Quest Fitness Channel"
    assert fit["profile_url"] == "https://www.youtube.com/channel/creator"
    assert fit["priority"] == "low"
    assert fit["public_contact"] is None


def test_public_contact_from_item_uses_public_metadata_email():
    item = {
        "title": "Quest workouts",
        "body": "",
        "author_name": "Creator",
        "raw_json": {"public_contact": "creator@example.com"},
    }

    assert public_contact_from_item(item) == "creator@example.com"


def test_public_contact_from_item_finds_visible_body_email():
    item = {
        "title": "Quest workouts",
        "body": "Business: creator@example.com",
        "author_name": "Creator",
        "raw_json": {},
    }

    assert public_contact_from_item(item) == "creator@example.com"


def test_fallback_creator_fit_skips_unrelated_creator_even_with_search_keyword():
    item = {
        "source": "youtube",
        "source_url": "https://www.youtube.com/watch?v=abc",
        "author_name": "Cooking Channel",
        "author_url": "https://www.youtube.com/channel/cooking",
        "title": "Pasta sauce recipe",
        "body": "",
        "raw_json": {"keyword": "VR fitness"},
    }

    assert fallback_creator_fit(item) is None


def test_fallback_creator_fit_skips_handle_with_only_vr_prefix():
    item = {
        "source": "twitch",
        "source_url": "https://www.twitch.tv/vricardo",
        "author_name": "vricardo",
        "author_url": "https://www.twitch.tv/vricardo",
        "title": "",
        "body": "",
        "raw_json": {"keyword": "VR fitness"},
    }

    assert fallback_creator_fit(item) is None


def test_creator_row_prefers_llm_fields_but_keeps_review_status():
    item = {
        "source": "twitch",
        "source_url": "https://www.twitch.tv/vrcreator",
        "author_name": "VRCreator",
        "author_url": "https://www.twitch.tv/vrcreator",
    }
    fit = {
        "name": "VR Creator",
        "profile_url": "https://www.twitch.tv/vrcreator",
        "public_contact": None,
        "niche": "VR fitness",
        "audience_estimate": "Small",
        "audience_quality": "Relevant",
        "fit_reason": "Streams Quest workouts",
        "talks_about": "VR fitness and Quest games",
        "offer_angle": "Try XRWorkout",
        "priority": "medium",
    }

    row = creator_row(item, fit)

    assert row["name"] == "VR Creator"
    assert row["platform"] == "twitch"
    assert row["recent_relevant_content"] == "https://www.twitch.tv/vrcreator"
    assert row["fit_reason"] == "Talks about: VR fitness and Quest games. Fit: Streams Quest workouts"
    assert row["status"] == "new"
    assert row["creator_quality_score"] < 85
    assert row["headset_confidence"] == "unknown"


def test_creator_row_falls_back_to_public_metadata_contact():
    item = {
        "source": "youtube",
        "source_url": "https://www.youtube.com/watch?v=abc",
        "author_name": "Quest Creator",
        "author_url": "https://www.youtube.com/channel/creator",
        "raw_json": {"public_contact": "creator@example.com"},
    }
    fit = {
        "name": "Quest Creator",
        "profile_url": "https://www.youtube.com/channel/creator",
        "public_contact": None,
        "niche": "VR fitness",
        "audience_estimate": "Small",
        "audience_quality": "Relevant",
        "fit_reason": "Reviews Quest fitness",
        "offer_angle": "Try XRWorkout",
        "priority": "medium",
    }

    assert creator_row(item, fit)["public_contact"] == "creator@example.com"


def test_creator_row_uses_quality_score_and_headset_evidence():
    item = {
        "source": "apify_instagram",
        "source_url": "https://instagram.com/questcoach",
        "author_name": "Quest Coach",
        "author_url": "https://instagram.com/questcoach",
        "raw_json": {
            "creator_evidence": {
                "history_quality": "profile_history",
                "recent_posts": [
                    {"caption": "Quest 3 boxing workout", "published_at": "2026-06-01T00:00:00+00:00"},
                    {"caption": "FitXR cardio routine", "published_at": "2026-05-20T00:00:00+00:00"},
                    {"caption": "Beat Saber workout", "published_at": "2026-05-05T00:00:00+00:00"},
                ],
            }
        },
    }
    fit = {
        "name": "Quest Coach",
        "platform": "apify_instagram",
        "profile_url": "https://instagram.com/questcoach",
        "public_contact": "coach@example.com",
        "niche": "Quest workouts",
        "audience_estimate": "Small",
        "audience_quality": "Topic-aligned comments",
        "fit_reason": "Posts Quest workouts",
        "talks_about": "VR fitness",
        "offer_angle": "Try XRWorkout",
        "creator_quality_score": 92,
        "recent_vr_posts_count": 3,
        "recent_total_posts_count": 8,
        "last_post_at": "2026-06-01T00:00:00+00:00",
        "activity_level": "high",
        "vr_involvement_evidence": "Three Quest workout posts",
        "movement_fit_evidence": "Workout and cardio posts",
        "headset_evidence": "Uses Quest 3",
        "headset_confidence": "high",
        "engagement_evidence": "Real comments",
        "contactability_evidence": "Public email",
        "safety_notes": "",
        "priority": "high",
    }

    row = creator_row(item, fit)

    assert row["priority"] == "high"
    assert row["creator_quality_score"] == 92
    assert row["recent_vr_posts_count"] == 3
    assert row["headset_confidence"] == "high"


def test_fit_source_item_matches_by_raw_item_id_first():
    item = {"id": "raw-1", "author_url": "https://example.com/a"}

    assert fit_source_item({"raw-1": item}, {"raw_item_id": "raw-1"}) == item


def test_fit_source_item_can_match_by_profile_url():
    item = {"id": "raw-1", "author_url": "https://example.com/a"}

    assert fit_source_item({"raw-1": item}, {"profile_url": "https://example.com/a"}) == item


def test_apify_social_rows_are_not_reliable_creator_history():
    item = {
        "source": "apify_tiktok",
        "raw_json": {
            "dataset_item": {
                "url": "https://www.tiktok.com/@creator/video/1",
                "caption": "Quest workout",
            }
        },
    }

    assert has_reliable_creator_history(item) is False


def test_apify_conversation_author_rows_can_seed_review_leads():
    item = {
        "id": "raw-1",
        "source": "apify_tiktok",
        "source_url": "https://www.tiktok.com/@creator/video/1",
        "author_name": "Quest Coach",
        "author_url": "https://www.tiktok.com/@creator",
        "title": "Quest 3 VR boxing workout",
        "body": "Trying a VR fitness routine today",
        "published_at": (datetime.now(timezone.utc) - timedelta(days=2)).isoformat(),
        "follower_count": 850,
        "raw_json": {
            "source_type": "social_post",
            "engagement": {"likes": 42, "comments": 5},
        },
    }

    fit = conversation_author_lead_fit(item)

    assert is_apify_conversation_author_lead(item) is True
    assert fit is not None
    assert fit["platform"] == "apify_tiktok"
    assert fit["profile_url"] == "https://www.tiktok.com/@creator"
    assert fit["priority"] in {"low", "medium"}
    assert fit["recent_vr_posts_count"] == 1
    assert fit["recent_total_posts_count"] == 1
    assert fit["activity_level"] == "low"
    assert fit["public_contact"] is None
    assert "review" in fit["offer_angle"].lower()


def test_apify_conversation_author_rows_without_identity_are_skipped():
    item = {
        "source": "apify_x",
        "source_url": "https://x.com/someone/status/1",
        "author_name": "Quest fan",
        "title": "Quest fitness",
        "body": "VR workout",
        "raw_json": {"source_type": "social_post"},
    }

    assert is_apify_conversation_author_lead(item) is False
    assert conversation_author_lead_fit(item) is None


def test_post_only_apify_rows_are_review_leads_not_profile_history():
    item = {
        "source": "apify_instagram",
        "source_url": "https://instagram.com/p/abc",
        "author_name": "Creator",
        "author_url": "https://instagram.com/creator",
        "title": "Mixed reality workout",
        "body": "Quest cardio",
        "raw_json": {"source_type": "social_post"},
    }

    assert has_reliable_creator_history(item) is False
    assert conversation_author_lead_fit(item) is not None


def test_apify_profile_history_rows_can_feed_creator_scoring():
    item = {
        "source": "apify_tiktok",
        "raw_json": {
            "creator_evidence": {
                "history_quality": "profile_history",
                "recent_total_posts_count": 8,
            }
        },
    }

    assert has_reliable_creator_history(item) is True


def test_creator_row_normalizes_platform_and_prefers_author_profile_url():
    item = {
        "source": "apify_tiktok",
        "source_url": "https://www.tiktok.com/@creator/video/1",
        "author_name": "Creator",
        "author_url": "https://www.tiktok.com/@creator",
        "title": "Quest workout",
        "body": "VR fitness",
    }
    fit = {
        "name": "Creator",
        "platform": "TikTok",
        "profile_url": "https://www.tiktok.com/@creator/video/1",
        "public_contact": None,
        "niche": "VR fitness",
        "audience_estimate": "Unknown",
        "audience_quality": "Needs review",
        "fit_reason": "Public post matched VR fitness",
        "offer_angle": "Review manually",
        "priority": "low",
    }

    row = creator_row(item, fit)

    assert normalize_platform("TikTok") == "apify_tiktok"
    assert row["platform"] == "apify_tiktok"
    assert row["profile_url"] == "https://www.tiktok.com/@creator"
    assert canonical_profile_url(item, fit) == "https://www.tiktok.com/@creator"


def test_group_items_by_creator_uses_author_profile_for_accumulation():
    rows = [
        {
            "source": "youtube",
            "source_url": "https://www.youtube.com/watch?v=1",
            "author_url": "https://www.youtube.com/channel/creator",
        },
        {
            "source": "youtube",
            "source_url": "https://www.youtube.com/watch?v=2",
            "author_url": "https://www.youtube.com/channel/creator",
        },
    ]

    grouped = group_items_by_creator(rows)

    assert len(grouped) == 1
    assert len(next(iter(grouped.values()))) == 2


def test_creator_source_slices_limits_llm_items_but_not_deterministic_leads():
    rows = [
        {
            "source": "youtube",
            "source_url": "https://www.youtube.com/watch?v=1",
            "author_url": "https://www.youtube.com/channel/1",
        },
        {
            "source": "youtube",
            "source_url": "https://www.youtube.com/watch?v=2",
            "author_url": "https://www.youtube.com/channel/2",
        },
        {
            "source": "apify_tiktok",
            "source_url": "https://www.tiktok.com/@creator/video/1",
            "author_name": "Creator One",
            "author_url": "https://www.tiktok.com/@creator",
            "raw_json": {"source_type": "social_post"},
        },
        {
            "source": "apify_tiktok",
            "source_url": "https://www.tiktok.com/@creator/video/2",
            "author_name": "Creator One",
            "author_url": "https://www.tiktok.com/@creator",
            "raw_json": {"source_type": "social_post"},
        },
    ]

    llm_items, lead_items = creator_source_slices(rows, 1)

    assert len(llm_items) == 1
    assert len(lead_items) == 2
