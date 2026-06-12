from datetime import date

from scripts.weekly_report import due_followup_count, source_quality


def test_source_quality_ranks_by_high_priority_then_average_score():
    raw_items = [
        {"source": "youtube"},
        {"source": "youtube"},
        {"source": "reddit"},
    ]
    opportunities = [
        {"platform": "youtube", "priority": "high", "score": 88},
        {"platform": "youtube", "priority": "medium", "score": 60},
        {"platform": "reddit", "priority": "high", "score": 70},
    ]
    drafts = [
        {"status": "sent", "opportunities": {"raw_items": {"source": "youtube"}}},
        {"status": "needs_review", "opportunities": {"raw_items": {"source": "reddit"}}},
    ]

    creators = [{"platform": "youtube"}, {"platform": "apify_tiktok"}]

    quality = source_quality(raw_items, opportunities, drafts, creators)

    assert quality[0] == {
        "source": "youtube",
        "raw_items": 2,
        "opportunities": 2,
        "high_priority": 1,
        "creators": 1,
        "average_score": 74,
        "drafts": 1,
        "approved_or_sent": 1,
    }
    assert quality[1]["source"] == "reddit"


def test_source_quality_includes_creator_only_sources():
    quality = source_quality([], [], [], [{"platform": "TikTok"}, {"platform": "apify_tiktok"}])

    assert quality == [
        {
            "source": "apify_tiktok",
            "raw_items": 0,
            "opportunities": 0,
            "high_priority": 0,
            "creators": 2,
            "average_score": 0,
            "drafts": 0,
            "approved_or_sent": 0,
        }
    ]


def test_due_followup_count_only_counts_pending_due_rows():
    followups = [
        {"status": "pending", "due_date": "2026-06-01"},
        {"status": "pending", "due_date": "2026-06-06"},
        {"status": "completed", "due_date": "2026-06-01"},
    ]

    assert due_followup_count(followups, date(2026, 6, 5)) == 1
