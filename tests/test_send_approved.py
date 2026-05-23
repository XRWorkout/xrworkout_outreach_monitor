import responses

from scripts.send_approved import recipient_for_draft
from xroutreach.config import Settings
from xroutreach.emailer import Emailer


def test_recipient_for_draft_uses_creator_public_contact():
    draft = {"creators": {"public_contact": "creator@example.com"}}
    assert recipient_for_draft(draft) == "creator@example.com"


def test_recipient_for_draft_ignores_non_email_contact():
    draft = {"creators": {"public_contact": "instagram dm"}}
    assert recipient_for_draft(draft) is None


def test_emailer_sends_brevo_api_key_header():
    cfg = Settings(
        supabase_url="",
        supabase_service_role_key="",
        codex_bin="codex",
        codex_model="",
        codex_timeout_seconds=300,
        reddit_client_id="",
        reddit_client_secret="",
        reddit_user_agent="",
        youtube_api_key="",
        twitch_client_id="",
        twitch_client_secret="",
        email_provider="brevo",
        brevo_api_key="brevo-secret",
        brevo_from_email="hello@xrworkout.ai",
        brevo_from_name="XRWorkout",
        report_to_email="",
        founder_name="",
        xrworkout_site="",
        dry_run_send=False,
    )

    with responses.RequestsMock() as rsps:
        rsps.add(responses.POST, Emailer.endpoint, json={"messageId": "abc"}, status=201)

        Emailer(cfg).send("creator@example.com", "Creator access", "Hello")

        request = rsps.calls[0].request
        assert request.headers["api-key"] == "brevo-secret"
        assert request.headers["content-type"] == "application/json"
        assert b'"sender": {"name": "XRWorkout", "email": "hello@xrworkout.ai"}' in request.body
