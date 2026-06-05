from scripts.collect_youtube import public_email_from_text


def test_public_email_from_text_extracts_visible_email():
    assert public_email_from_text("Business contact: creator@example.com") == "creator@example.com"


def test_public_email_from_text_returns_none_without_email():
    assert public_email_from_text("Follow my channel for Quest workouts") is None
