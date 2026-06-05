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

    quality = source_quality(raw_items, opportunities, drafts)

    assert quality[0] == {
        "source": "youtube",
        "raw_items": 2,
        "opportunities": 2,
        "high_priority": 1,
        "average_score": 74,
        "drafts": 1,
        "approved_or_sent": 1,
    }
    assert quality[1]["source"] == "reddit"


def test_due_followup_count_only_counts_pending_due_rows():
    followups = [
        {"status": "pending", "due_date": "2026-06-01"},
        {"status": "pending", "due_date": "2026-06-06"},
        {"status": "completed", "due_date": "2026-06-01"},
    ]

    assert due_followup_count(followups, date(2026, 6, 5)) == 1
