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
