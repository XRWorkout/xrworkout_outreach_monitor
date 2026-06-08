from __future__ import annotations

from scripts.discover_creators import creator_row, fallback_creator_fit, fit_source_item, public_contact_from_item


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
