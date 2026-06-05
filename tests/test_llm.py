from __future__ import annotations

import subprocess
from pathlib import Path

from xroutreach.config import Settings
from xroutreach.llm import LLM


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


def _settings() -> Settings:
    return Settings(
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
        brevo_api_key="",
        brevo_from_email="",
        brevo_from_name="XRWorkout",
        report_to_email="",
        founder_name="Alex",
        xrworkout_site="https://xrworkout.ai",
        dry_run_send=True,
    )
