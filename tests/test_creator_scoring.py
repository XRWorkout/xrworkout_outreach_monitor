from __future__ import annotations

from datetime import datetime, timedelta, timezone

from xroutreach.creator_scoring import activity_level, creator_evidence_from_item, creator_score_from_evidence


def days_ago(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def test_creator_score_rewards_recent_vr_headset_and_activity():
    score = creator_score_from_evidence(
        recent_vr_posts_count=3,
        recent_total_posts_count=9,
        last_post_at=days_ago(7),
        follower_count=12_000,
        public_contact="creator@example.com",
        activity_level="high",
        headset_confidence="high",
        text="Quest 3 VR workout cardio boxing",
        engagement_available=True,
    )

    assert score >= 85


def test_creator_score_caps_high_priority_without_headset_signal():
    score = creator_score_from_evidence(
        recent_vr_posts_count=3,
        recent_total_posts_count=9,
        last_post_at=days_ago(7),
        follower_count=50_000,
        public_contact="creator@example.com",
        activity_level="high",
        headset_confidence="unknown",
        text="VR workout cardio boxing",
        engagement_available=True,
    )

    assert score == 84


def test_activity_level_uses_90_day_window():
    assert activity_level(8, days_ago(7)) == "high"
    assert activity_level(2, days_ago(45)) == "medium"
    assert activity_level(1, days_ago(45)) == "low"
    assert activity_level(1, days_ago(120)) == "unknown"


def test_creator_score_caps_single_incidental_vr_mention():
    score = creator_score_from_evidence(
        recent_vr_posts_count=1,
        recent_total_posts_count=12,
        last_post_at=days_ago(8),
        follower_count=80_000,
        public_contact="creator@example.com",
        activity_level="high",
        headset_confidence="unknown",
        text="General tech creator tried a VR app once. No workouts or fitness content.",
        engagement_available=True,
    )

    assert score <= 64


def test_creator_score_rejects_generic_fitness_without_vr():
    score = creator_score_from_evidence(
        recent_vr_posts_count=0,
        recent_total_posts_count=10,
        last_post_at=days_ago(4),
        follower_count=20_000,
        public_contact="coach@example.com",
        activity_level="high",
        headset_confidence="unknown",
        text="Home workout cardio boxing fitness coach focused on gym routines and wellness.",
        engagement_available=True,
    )

    assert score <= 39


def test_creator_evidence_counts_recent_profile_history_and_caps_llm_score():
    item = {
        "source": "apify_youtube",
        "title": "Quest workouts",
        "body": "VR fitness channel",
        "author_name": "Quest Coach",
        "follower_count": 12_000,
        "raw_json": {
            "public_contact": "coach@example.com",
            "creator_evidence": {
                "history_quality": "profile_history",
                "headset_confidence": "high",
                "engagement_evidence": "comments: 40",
                "recent_posts": [
                    {"title": "Quest 3 VR boxing workout", "published_at": days_ago(5)},
                    {"title": "FitXR cardio routine", "published_at": days_ago(20)},
                    {"title": "Regular vlog", "published_at": days_ago(35)},
                    {"title": "Old Quest workout", "published_at": days_ago(140)},
                ],
            },
        },
    }
    evidence = creator_evidence_from_item(item, {"creator_quality_score": 99})

    assert evidence["recent_vr_posts_count"] == 2
    assert evidence["recent_total_posts_count"] == 3
    assert evidence["last_post_at"] == item["raw_json"]["creator_evidence"]["recent_posts"][0]["published_at"]
    assert evidence["creator_quality_score"] >= 85
    assert evidence["evidence_json"]["computed_evidence_quality"] == "profile_history"


def test_creator_evidence_caps_llm_score_for_post_only_incidental_match():
    item = {
        "source": "youtube",
        "title": "Trying VR once",
        "body": "A general tech creator tests one app.",
        "author_name": "Tech Creator",
        "follower_count": 80_000,
        "published_at": days_ago(4),
        "raw_json": {"public_contact": "tech@example.com"},
    }
    evidence = creator_evidence_from_item(item, {"creator_quality_score": 95})

    assert evidence["recent_vr_posts_count"] == 1
    assert evidence["recent_total_posts_count"] == 1
    assert evidence["creator_quality_score"] < 70
    assert evidence["evidence_json"]["computed_evidence_quality"] == "observed_post"



def test_creator_evidence_counts_apify_date_key_variants_in_90_day_window():
    item = {
        "source": "apify_tiktok",
        "title": "Quest workouts",
        "body": "VR fitness channel",
        "author_name": "Quest Coach",
        "follower_count": 12_000,
        "raw_json": {
            "creator_evidence": {
                "history_quality": "profile_history",
                "headset_confidence": "high",
                "recent_posts": [
                    {"caption": "Quest 3 VR boxing workout", "publishedAt": days_ago(3), "webVideoUrl": "https://example.com/quest-boxing"},
                    {"caption": "FitXR cardio in mixed reality", "createdAt": days_ago(18), "url": "https://example.com/fitxr"},
                    {"caption": "Beat Saber workout challenge", "createTimeISO": days_ago(42), "url": "https://example.com/beat-saber"},
                    {"caption": "Old Quest workout", "publishedAt": days_ago(130), "url": "https://example.com/old"},
                ],
            },
        },
    }

    evidence = creator_evidence_from_item(item)

    assert evidence["recent_vr_posts_count"] == 3
    assert evidence["recent_total_posts_count"] == 3
    assert evidence["evidence_json"]["computed_recent_relevant_posts"][0]["url"] == "https://example.com/quest-boxing"


def test_creator_evidence_ignores_placeholder_fit_zero_when_observed_post_exists():
    item = {
        "source": "apify_tiktok",
        "source_url": "https://www.tiktok.com/@creator/video/1",
        "title": "Quest 3 VR boxing workout",
        "body": "Trying a VR fitness routine today",
        "author_name": "Quest Coach",
        "published_at": days_ago(2),
        "raw_json": {"source_type": "social_post"},
    }
    fit = {
        "lead_source_type": "conversation_author",
        "recent_vr_posts_count": 0,
        "recent_total_posts_count": 0,
        "activity_level": "unknown",
    }

    evidence = creator_evidence_from_item(item, fit)

    assert evidence["recent_vr_posts_count"] == 1
    assert evidence["recent_total_posts_count"] == 1
    assert evidence["activity_level"] == "low"
    assert evidence["evidence_json"]["computed_recent_relevant_posts"][0]["url"] == "https://www.tiktok.com/@creator/video/1"
