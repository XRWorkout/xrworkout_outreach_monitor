import responses

from scripts.send_approved import recipient_for_draft, skip_reason_for_draft
from xroutreach.config import Settings
from xroutreach.emailer import Emailer


def test_recipient_for_draft_uses_creator_public_contact():
    draft = {"creators": {"public_contact": "creator@example.com"}}
    assert recipient_for_draft(draft) == "creator@example.com"


def test_recipient_for_draft_ignores_non_email_contact():
    draft = {"creators": {"public_contact": "instagram dm"}}
    assert recipient_for_draft(draft) is None


def test_skip_reason_for_draft_skips_manual_channels():
    draft = {
        "status": "approved",
        "channel": "comment",
        "creators": {"public_contact": "creator@example.com"},
    }
    assert skip_reason_for_draft(draft) == "channel"


def test_skip_reason_for_draft_requires_email_recipient():
    draft = {
        "status": "approved",
        "channel": "email",
        "creators": {"public_contact": "instagram dm"},
    }
    assert skip_reason_for_draft(draft) == "recipient"


def test_skip_reason_for_draft_allows_approved_email_with_recipient():
    draft = {
        "status": "approved",
        "channel": "email",
        "creators": {"public_contact": "creator@example.com"},
    }
    assert skip_reason_for_draft(draft) is None


def test_emailer_sends_brevo_api_key_header():
    cfg = Settings(
        supabase_url="",
        supabase_service_role_key="",
        cheap_llm_enabled=False,
        ollama_base_url="https://ollama.com/api",
        ollama_api_key="",
        llm_policy_path="llm_policy.json",
        llm_notify_fallbacks=True,
        reddit_client_id="",
        reddit_client_secret="",
        reddit_user_agent="",
        youtube_api_key="",
        twitch_client_id="",
        twitch_client_secret="",
        apify_token="",
        apify_creator_actors_json="[]",
        apify_social_actors_json="[]",
        apify_conversation_actors_json="[]",
        apify_max_items_per_run=100,
        apify_max_runs_per_day=4,
        apify_enabled=False,
        profile_enrichment_enabled=False,
        profile_enrichment_max_creators_per_run=25,
        profile_enrichment_max_posts_per_creator=25,
        profile_enrichment_refresh_hours=168,
        profile_enrichment_actors_json="[]",
        forum_sources_json="[]",
        blog_feeds_json="[]",
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
