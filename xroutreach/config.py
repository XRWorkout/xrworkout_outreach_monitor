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
    cheap_llm_enabled: bool
    ollama_base_url: str
    ollama_api_key: str
    llm_policy_path: str
    llm_notify_fallbacks: bool
    reddit_client_id: str
    reddit_client_secret: str
    reddit_user_agent: str
    youtube_api_key: str
    twitch_client_id: str
    twitch_client_secret: str
    apify_token: str
    apify_creator_actors_json: str
    apify_social_actors_json: str
    apify_conversation_actors_json: str
    apify_max_items_per_run: int
    apify_max_runs_per_day: int
    apify_enabled: bool
    profile_enrichment_enabled: bool
    profile_enrichment_max_creators_per_run: int
    profile_enrichment_max_posts_per_creator: int
    profile_enrichment_refresh_hours: int
    profile_enrichment_actors_json: str
    forum_sources_json: str
    blog_feeds_json: str
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


def env_int(name: str, default: int) -> int:
    value = env(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer") from exc


def settings() -> Settings:
    return Settings(
        supabase_url=env("SUPABASE_URL"),
        supabase_service_role_key=env("SUPABASE_SERVICE_ROLE_KEY"),
        cheap_llm_enabled=env("CHEAP_LLM_ENABLED", "false").lower() in {"1", "true", "yes"},
        ollama_base_url=env("OLLAMA_BASE_URL", "https://ollama.com/api"),
        ollama_api_key=env("OLLAMA_API_KEY"),
        llm_policy_path=env("LLM_POLICY_PATH", "llm_policy.json"),
        llm_notify_fallbacks=env("LLM_NOTIFY_FALLBACKS", "true").lower()
        in {"1", "true", "yes"},
        reddit_client_id=env("REDDIT_CLIENT_ID"),
        reddit_client_secret=env("REDDIT_CLIENT_SECRET"),
        reddit_user_agent=env("REDDIT_USER_AGENT", "XRWorkout outreach monitor"),
        youtube_api_key=env("YOUTUBE_API_KEY"),
        twitch_client_id=env("TWITCH_CLIENT_ID"),
        twitch_client_secret=env("TWITCH_CLIENT_SECRET"),
        apify_token=env("APIFY_TOKEN"),
        apify_creator_actors_json=env("APIFY_CREATOR_ACTORS_JSON", "[]"),
        apify_social_actors_json=env("APIFY_SOCIAL_ACTORS_JSON", "[]"),
        apify_conversation_actors_json=env("APIFY_CONVERSATION_ACTORS_JSON", "[]"),
        apify_max_items_per_run=env_int("APIFY_MAX_ITEMS_PER_RUN", 100),
        apify_max_runs_per_day=env_int("APIFY_MAX_RUNS_PER_DAY", 4),
        apify_enabled=env("APIFY_ENABLED", "false").lower() in {"1", "true", "yes"},
        profile_enrichment_enabled=env("PROFILE_ENRICHMENT_ENABLED", "false").lower()
        in {"1", "true", "yes"},
        profile_enrichment_max_creators_per_run=env_int("PROFILE_ENRICHMENT_MAX_CREATORS_PER_RUN", 25),
        profile_enrichment_max_posts_per_creator=env_int("PROFILE_ENRICHMENT_MAX_POSTS_PER_CREATOR", 25),
        profile_enrichment_refresh_hours=env_int("PROFILE_ENRICHMENT_REFRESH_HOURS", 168),
        profile_enrichment_actors_json=env("PROFILE_ENRICHMENT_ACTORS_JSON", "[]"),
        forum_sources_json=env("FORUM_SOURCES_JSON", "[]"),
        blog_feeds_json=env("BLOG_FEEDS_JSON", "[]"),
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
