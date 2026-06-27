from __future__ import annotations

from xroutreach.config import Settings
from xroutreach.llm import LLM


class FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or str(payload)

    def json(self):
        return self._payload


def test_llm_uses_ollama_and_clamps_classification_score(monkeypatch):
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return FakeResponse(
            200,
            {
                "message": {
                    "content": (
                        '{"opportunity_type":"creator_opportunity","summary":"Relevant creator",'
                        '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
                        '"audience_type":"VR fitness audience","score":150,"priority":"high",'
                        '"recommended_action":"email","outreach_safety":"safe"}'
                    )
                }
            },
        )

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings()).classify({"source": "youtube", "title": "VR fitness"})

    assert result["score"] == 100
    assert result["priority"] == "high"
    assert calls[0]["url"] == "https://ollama.com/api/chat"
    assert calls[0]["headers"]["Authorization"] == "Bearer ollama-secret"
    assert calls[0]["json"]["model"] == "gemma3:12b"


def test_llm_creator_fits_uses_one_batch_ollama_call(monkeypatch):
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "json": json})
        return FakeResponse(
            200,
            {
                "message": {
                    "content": (
                        '{"creators":[{"raw_item_id":"raw-1","name":"Quest Creator",'
                        '"platform":"youtube","profile_url":"https://youtube.com/channel/creator",'
                        '"public_contact":null,"niche":"VR fitness","audience_estimate":"Small",'
                        '"audience_quality":"Relevant","fit_reason":"Makes Quest workout videos",'
                        '"talks_about":"VR and fitness","offer_angle":"Try XRWorkout",'
                        '"creator_quality_score":92,"recent_vr_posts_count":3,'
                        '"recent_total_posts_count":9,"last_post_at":"2026-06-01T00:00:00+00:00",'
                        '"activity_level":"high","vr_involvement_evidence":"Recent Quest workout posts",'
                        '"movement_fit_evidence":"Workout videos","headset_evidence":"Uses Quest 3",'
                        '"headset_confidence":"high","engagement_evidence":"Real comments",'
                        '"contactability_evidence":"Manual DM path","safety_notes":"No safety issues",'
                        '"priority":"high"}]}'
                    )
                }
            },
        )

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings()).creator_fits(
        [
            {
                "id": "raw-1",
                "source": "youtube",
                "author_name": "Quest Creator",
                "raw_json": {"keyword": "VR fitness"},
            },
            {
                "id": "raw-2",
                "source": "twitch",
                "author_name": "Other Creator",
                "raw_json": {"keyword": "Quest workout"},
            },
        ]
    )

    assert len(calls) == 1
    assert calls[0]["json"]["model"] == "gpt-oss:120b"
    assert result[0]["raw_item_id"] == "raw-1"
    assert result[0]["talks_about"] == "VR and fitness"


def test_llm_draft_prompt_preserves_manual_channels(monkeypatch):
    prompts = []

    def fake_post(url, headers, json, timeout):
        prompts.append(json["messages"][1]["content"])
        return FakeResponse(
            200,
            {
                "message": {
                    "content": (
                        '{"channel":"comment","subject":"",'
                        '"body":"I work on XRWorkout, and this is relevant because..."}'
                    )
                }
            },
        )

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings()).draft(
        {
            "recommended_action": "comment",
            "summary": "Public thread asking for VR fitness options",
        }
    )

    assert result == {
        "channel": "comment",
        "subject": "",
        "body": "I work on XRWorkout, and this is relevant because...",
    }
    assert "For comment, use an empty subject" in prompts[0]
    assert "For dm, use an empty subject" in prompts[0]
    assert "required for email; empty string for dm and comment" in prompts[0]


def test_llm_uses_ollama_for_classification(monkeypatch):
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
        return FakeResponse(
            200,
            {
                "message": {
                    "content": (
                        '{"opportunity_type":"creator_opportunity","summary":"Relevant creator",'
                        '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
                        '"audience_type":"VR fitness audience","score":80,"priority":"medium",'
                        '"recommended_action":"email","outreach_safety":"safe"}'
                    )
                }
            },
        )

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings()).classify(
        {"source": "youtube", "title": "VR fitness"}
    )

    assert calls[0]["url"] == "https://ollama.com/api/chat"
    assert calls[0]["headers"]["Authorization"] == "Bearer ollama-secret"
    assert calls[0]["json"]["model"] == "gemma3:12b"
    assert result["score"] == 80


def test_llm_raises_after_ollama_retries(monkeypatch):
    def fake_post(url, headers, json, timeout):
        return FakeResponse(200, {"message": {"content": "not json"}})

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    try:
        LLM(_settings()).classify({"source": "youtube", "title": "VR fitness"})
    except RuntimeError as exc:
        assert "LLM task classify_opportunity failed" in str(exc)
    else:
        raise AssertionError("Expected Ollama failure")


def test_llm_draft_uses_ollama(monkeypatch):
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(json)
        return FakeResponse(
            200,
            {
                "message": {
                    "content": (
                        '{"channel":"email","subject":"Creator access",'
                        '"body":"Short founder-led draft."}'
                    )
                }
            },
        )

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings()).draft(
        {"recommended_action": "email", "summary": "Relevant opportunity"}
    )

    assert len(calls) == 1
    assert calls[0]["model"] == "gpt-oss:120b"
    assert result["subject"] == "Creator access"


def _settings(cheap_llm_enabled: bool = True) -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        cheap_llm_enabled=cheap_llm_enabled,
        ollama_base_url="https://ollama.com/api",
        ollama_api_key="ollama-secret",
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
        brevo_api_key="",
        brevo_from_email="",
        brevo_from_name="XRWorkout",
        report_to_email="",
        founder_name="Alex",
        xrworkout_site="https://xrworkout.ai",
        dry_run_send=True,
    )
