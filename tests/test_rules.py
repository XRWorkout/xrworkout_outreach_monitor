from datetime import date

from xroutreach.rules import next_followup_date, priority_for_score, sendable_status, should_generate_draft


def test_priority_for_score():
    assert priority_for_score(80) == "high"
    assert priority_for_score(60) == "medium"
    assert priority_for_score(59) == "low"


def test_sendable_status_only_approved():
    assert sendable_status("approved")
    assert not sendable_status("needs_review")
    assert not sendable_status("rejected")
    assert not sendable_status("edit_needed")
    assert not sendable_status("sent")


def test_should_generate_draft_requires_high_safe_actionable():
    assert should_generate_draft(80, "safe", "email")
    assert should_generate_draft(80, "safe", "comment")
    assert should_generate_draft(80, "safe", "dm")
    assert not should_generate_draft(79, "safe", "email")
    assert not should_generate_draft(90, "do_not_engage", "email")
    assert not should_generate_draft(90, "safe", "monitor")
    assert not should_generate_draft(90, "safe", "do_not_engage")


def test_next_followup_date():
    assert next_followup_date(1, date(2026, 1, 1)).isoformat() == "2026-01-08"
    assert next_followup_date(2, date(2026, 1, 1)).isoformat() == "2026-01-15"
