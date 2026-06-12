from __future__ import annotations

import subprocess
from pathlib import Path

from xroutreach.config import Settings
from xroutreach.llm import LLM


class FakeResponse:
    def __init__(self, status_code: int, payload: dict, text: str = ""):
        self.status_code = status_code
        self._payload = payload
        self.text = text or str(payload)

    def json(self):
        return self._payload


def test_llm_uses_codex_cli_and_clamps_classification_score(monkeypatch):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"opportunity_type":"creator_opportunity","summary":"Relevant creator",'
            '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
            '"audience_type":"VR fitness audience","score":150,"priority":"high",'
            '"recommended_action":"email","outreach_safety":"safe"}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

    result = LLM(_settings()).classify({"source": "youtube", "title": "VR fitness"})

    assert result["score"] == 100
    assert result["priority"] == "high"
    assert commands[0][:3] == ["codex", "-a", "never"]
    assert "--output-schema" in commands[0]
    assert "--output-last-message" in commands[0]


def test_llm_creator_fits_uses_one_batch_codex_call(monkeypatch):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
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
            '"priority":"high"}]}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

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

    assert len(commands) == 1
    assert result[0]["raw_item_id"] == "raw-1"
    assert result[0]["talks_about"] == "VR and fitness"


def test_llm_draft_prompt_preserves_manual_channels(monkeypatch):
    prompts = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        prompts.append(input)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"channel":"comment","subject":"","body":"I work on XRWorkout, and this is relevant because..."}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

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


def test_llm_uses_ollama_for_classification_when_enabled(monkeypatch):
    calls = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

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

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings(cheap_llm_enabled=True)).classify(
        {"source": "youtube", "title": "VR fitness"}
    )

    assert calls[0]["url"] == "https://ollama.com/api/chat"
    assert calls[0]["headers"]["Authorization"] == "Bearer ollama-secret"
    assert calls[0]["json"]["model"] == "gemma3:12b"
    assert result["score"] == 80


def test_llm_retries_ollama_then_falls_back_to_codex(monkeypatch, capsys):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"opportunity_type":"creator_opportunity","summary":"Fallback creator",'
            '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
            '"audience_type":"VR fitness audience","score":70,"priority":"medium",'
            '"recommended_action":"email","outreach_safety":"safe"}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(json)
        return FakeResponse(200, {"message": {"content": "not json"}})

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings(cheap_llm_enabled=True)).classify(
        {"source": "youtube", "title": "VR fitness"}
    )

    assert len(calls) == 2
    assert len(commands) == 1
    assert result["summary"] == "Fallback creator"
    assert "LLM fallback: task=classify_opportunity primary=ollama/gemma3:12b" in capsys.readouterr().out


def test_llm_falls_back_to_codex_after_ollama_auth_and_rate_errors(monkeypatch):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"opportunity_type":"creator_opportunity","summary":"Fallback after HTTP errors",'
            '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
            '"audience_type":"VR fitness audience","score":70,"priority":"medium",'
            '"recommended_action":"email","outreach_safety":"safe"}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

    responses_to_return = [
        FakeResponse(401, {"error": "unauthorized"}),
        FakeResponse(429, {"error": "rate limit"}),
    ]
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append(json)
        return responses_to_return.pop(0)

    monkeypatch.setattr("xroutreach.llm.requests.post", fake_post)

    result = LLM(_settings(cheap_llm_enabled=True)).classify(
        {"source": "youtube", "title": "VR fitness"}
    )

    assert len(calls) == 2
    assert len(commands) == 1
    assert result["summary"] == "Fallback after HTTP errors"


def test_llm_uses_codex_default_model_when_cheap_llm_disabled(monkeypatch):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"opportunity_type":"creator_opportunity","summary":"Codex default",'
            '"pain_point":"Needs VR fitness content","xrworkout_relevance":"Strong fit",'
            '"audience_type":"VR fitness audience","score":70,"priority":"medium",'
            '"recommended_action":"email","outreach_safety":"safe"}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)

    result = LLM(_settings(cheap_llm_enabled=False)).classify(
        {"source": "youtube", "title": "VR fitness"}
    )

    assert result["summary"] == "Codex default"
    assert "--model" not in commands[0]
    assert "gemma3:12b" not in commands[0]


def test_llm_draft_stays_on_codex_when_cheap_llm_enabled(monkeypatch):
    commands = []

    def fake_which(binary):
        assert binary == "codex"
        return "/usr/bin/codex"

    def fake_run(command, input, capture_output, text, timeout, check):
        commands.append(command)
        output_path = command[command.index("--output-last-message") + 1]
        Path(output_path).write_text(
            '{"channel":"email","subject":"Creator access","body":"Short founder-led draft."}',
            encoding="utf-8",
        )
        return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

    def unexpected_post(*args, **kwargs):
        raise AssertionError("drafting should not call Ollama")

    monkeypatch.setattr("xroutreach.llm.shutil.which", fake_which)
    monkeypatch.setattr("xroutreach.llm.subprocess.run", fake_run)
    monkeypatch.setattr("xroutreach.llm.requests.post", unexpected_post)

    result = LLM(_settings(cheap_llm_enabled=True)).draft(
        {"recommended_action": "email", "summary": "Relevant opportunity"}
    )

    assert len(commands) == 1
    assert result["subject"] == "Creator access"


def _settings(cheap_llm_enabled: bool = False) -> Settings:
    return Settings(
        supabase_url="",
        supabase_service_role_key="",
        codex_bin="codex",
        codex_model="",
        codex_timeout_seconds=300,
        cheap_llm_enabled=cheap_llm_enabled,
        ollama_base_url="https://ollama.com/api",
        ollama_api_key="ollama-secret" if cheap_llm_enabled else "",
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
