from scripts.list_due_followups import followup_summary


def test_followup_summary_flattens_context():
    row = {
        "id": "followup-1",
        "due_date": "2026-06-01",
        "cadence_step": 1,
        "status": "pending",
        "draft_body": "Follow up note",
        "drafts": {
            "subject": "Creator access",
            "creators": {
                "name": "Creator",
                "public_contact": "creator@example.com",
                "profile_url": "https://www.youtube.com/@creator",
            },
            "opportunities": {
                "summary": "VR fitness video",
                "raw_items": {"source_url": "https://www.youtube.com/watch?v=abc"},
            },
        },
    }

    assert followup_summary(row) == {
        "id": "followup-1",
        "due_date": "2026-06-01",
        "cadence_step": 1,
        "status": "pending",
        "creator": "Creator",
        "contact": "creator@example.com",
        "profile_url": "https://www.youtube.com/@creator",
        "subject": "Creator access",
        "opportunity": "VR fitness video",
        "source_url": "https://www.youtube.com/watch?v=abc",
        "draft_body": "Follow up note",
    }
