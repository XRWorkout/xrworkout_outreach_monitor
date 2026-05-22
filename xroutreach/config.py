from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

from dotenv import load_dotenv


load_dotenv()


KEYWORDS = [
    "VR fitness",
    "exercise in VR",
    "workout in VR",
    "Meta Quest fitness",
    "Quest workout",
    "best VR fitness app",
    "FitXR alternative",
    "Supernatural alternative",
    "Les Mills BodyCombat",
    "Beat Saber workout",
    "mixed reality workout",
    "controllerless workout",
    "hand tracking fitness",
    "full body VR workout",
    "VR weight loss",
    "VR cardio",
    "XRWorkout",
    "VRWorkout",
]

SUBREDDITS = [
    "vrfit",
    "MetaQuestVR",
    "OculusQuest",
    "virtualreality",
    "VRGaming",
    "sidequest",
]


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    openai_api_key: str
    openai_model: str
    reddit_client_id: str
    reddit_client_secret: str
    reddit_user_agent: str
    youtube_api_key: str
    twitch_client_id: str
    twitch_client_secret: str
    email_provider: str
    brevo_api_key: str
    brevo_from_email: str
    brevo_from_name: str
    report_to_email: str
    founder_name: str
    xrworkout_site: str
    dry_run_send: bool


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def settings() -> Settings:
    return Settings(
        supabase_url=env("SUPABASE_URL"),
        supabase_service_role_key=env("SUPABASE_SERVICE_ROLE_KEY"),
        openai_api_key=env("OPENAI_API_KEY"),
        openai_model=env("OPENAI_MODEL", "gpt-4.1-mini"),
        reddit_client_id=env("REDDIT_CLIENT_ID"),
        reddit_client_secret=env("REDDIT_CLIENT_SECRET"),
        reddit_user_agent=env("REDDIT_USER_AGENT", "XRWorkout outreach monitor"),
        youtube_api_key=env("YOUTUBE_API_KEY"),
        twitch_client_id=env("TWITCH_CLIENT_ID"),
        twitch_client_secret=env("TWITCH_CLIENT_SECRET"),
        email_provider=env("EMAIL_PROVIDER", "brevo").lower(),
        brevo_api_key=env("BREVO_API_KEY"),
        brevo_from_email=env("BREVO_FROM_EMAIL"),
        brevo_from_name=env("BREVO_FROM_NAME", "XRWorkout"),
        report_to_email=env("REPORT_TO_EMAIL"),
        founder_name=env("XRWORKOUT_FOUNDER_NAME", "the XRWorkout team"),
        xrworkout_site=env("XRWORKOUT_SITE", "https://xrworkout.ai"),
        dry_run_send=env("DRY_RUN_SEND", "true").lower() in {"1", "true", "yes"},
    )


def require(values: Iterable[tuple[str, str]]) -> None:
    missing = [name for name, value in values if not value]
    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(f"Missing required environment variables: {joined}")
