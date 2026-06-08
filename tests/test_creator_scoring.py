from __future__ import annotations

from datetime import datetime, timedelta, timezone

from xroutreach.creator_scoring import activity_level, creator_score_from_evidence


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
