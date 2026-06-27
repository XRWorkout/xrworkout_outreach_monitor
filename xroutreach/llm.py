from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests

from xroutreach.config import Settings
from xroutreach.rules import priority_for_score


CLASSIFY_SYSTEM = """You classify outreach opportunities for XRWorkout.
XRWorkout is a VR/MR fitness product. Prefer high-quality, low-volume outreach.
Conversation Map rows may come from social posts, public forum threads, public group posts, server discovery, profile-history enrichment, contact enrichment, or blog/news articles.
Score for product fit, intent, reach, and safety. Prefer manual comment or manual DM for public/social conversations; never imply the system should auto-post or auto-DM.
For Discord server discovery, blogs, or broad news/trend rows, usually recommend monitor unless there is a clear creator, partnership, or public conversation to review.
Hard-stop spam, unsafe medical claims, kids/minors-focused content, competitor-owned accounts, private-community content, or anything that would be intrusive.
Never recommend spam. Return strict JSON only."""

DRAFT_SYSTEM = """You write concise founder-led XRWorkout outreach message drafts.
Tone: warm, specific, low-pressure. Do not overclaim health outcomes.
Choose email, dm, or comment from the recommended action.
For email, include a useful subject and an email-ready body.
For comment, use an empty subject and write a short public reply with explicit XRWorkout affiliation disclosure.
For dm, use an empty subject and write a concise private message that is low-pressure and affiliation-clear.
Return strict JSON only."""


@dataclass(frozen=True)
class TaskPolicy:
    provider: str
    model: str
    timeout_seconds: int
    retries: int
    temperature: float


DEFAULT_POLICY: dict[str, TaskPolicy] = {
    "classify_opportunity": TaskPolicy(
        provider="ollama",
        model="gemma3:12b",
        timeout_seconds=180,
        retries=1,
        temperature=0,
    ),
    "creator_discovery_batch": TaskPolicy(
        provider="ollama",
        model="gpt-oss:120b",
        timeout_seconds=300,
        retries=1,
        temperature=0,
    ),
    "draft_outreach": TaskPolicy(
        provider="ollama",
        model="gpt-oss:120b",
        timeout_seconds=300,
        retries=1,
        temperature=0,
    ),
}


class SchemaValidationError(RuntimeError):
    pass


class LLMProvider:
    provider_name = "unknown"

    def json_completion(
        self,
        system: str,
        payload: dict[str, Any],
        schema: dict[str, Any],
        policy: TaskPolicy,
    ) -> dict[str, Any]:
        raise NotImplementedError


class OllamaProvider(LLMProvider):
    provider_name = "ollama"

    def __init__(self, settings: Settings):
        if not settings.ollama_api_key:
            raise RuntimeError("OLLAMA_API_KEY is required when Ollama routing is enabled")
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.api_key = settings.ollama_api_key

    def json_completion(
        self,
        system: str,
        payload: dict[str, Any],
        schema: dict[str, Any],
        policy: TaskPolicy,
    ) -> dict[str, Any]:
        prompt = completion_prompt(system, payload, schema)
        response = requests.post(
            f"{self.base_url}/chat",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": policy.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "stream": False,
                "options": {"temperature": policy.temperature},
            },
            timeout=policy.timeout_seconds,
        )
        if response.status_code == 401:
            raise RuntimeError("Ollama Cloud authentication failed with 401")
        if response.status_code == 429:
            raise RuntimeError("Ollama Cloud rate limited the request with 429")
        if response.status_code >= 400:
            raise RuntimeError(
                f"Ollama Cloud failed with {response.status_code}: {summarize_error(response.text)}"
            )

        body = response.json()
        message = body.get("message") if isinstance(body, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Ollama Cloud returned an empty chat response")

        data = parse_json_object(content)
        validate_schema(data, schema)
        return data


class LLM:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.policy = load_policy(settings.llm_policy_path)
        self.founder_name = settings.founder_name
        self.site = settings.xrworkout_site
        self.ollama = None
        if settings.cheap_llm_enabled:
            self.ollama = OllamaProvider(settings)

    def classify(self, raw_item: dict[str, Any]) -> dict[str, Any]:
        prompt = {
            "source": raw_item.get("source"),
            "title": raw_item.get("title"),
            "body": raw_item.get("body"),
            "author_name": raw_item.get("author_name"),
            "source_url": raw_item.get("source_url"),
            "raw_json": raw_item.get("raw_json") if isinstance(raw_item.get("raw_json"), dict) else {},
            "instructions": {
                "score_fields": [
                    "relevance",
                    "intent",
                    "reach",
                    "xrworkout_fit",
                    "outreach_safety",
                ],
                "max_score": 100,
                "opportunity_types": [
                    "recommendation_request",
                    "complaint",
                    "does_vr_fitness_work",
                    "creator_opportunity",
                    "partnership_lead",
                    "community_event",
                    "press_newsletter",
                    "trend_news",
                    "product_feedback",
                    "support_issue",
                    "competitor_owned",
                    "do_not_engage",
                ],
            },
        }
        data = self._json_completion(
            "classify_opportunity",
            CLASSIFY_SYSTEM,
            prompt,
            CLASSIFY_SCHEMA,
            context_table="raw_items",
            context_id=raw_item.get("id"),
        )
        score = int(data.get("score", 0))
        data["score"] = max(0, min(100, score))
        data["priority"] = data.get("priority") or priority_for_score(data["score"])
        return data

    def draft(self, opportunity: dict[str, Any]) -> dict[str, str]:
        prompt = {
            "opportunity": opportunity,
            "founder_name": self.founder_name,
            "site": self.site,
            "required": {
                "channel": "email, dm, or comment based on recommended_action",
                "subject": "required for email; empty string for dm and comment",
                "body": "concise, context-aware channel-specific draft",
            },
        }
        data = self._json_completion(
            "draft_outreach",
            DRAFT_SYSTEM,
            prompt,
            DRAFT_SCHEMA,
            context_table="opportunities",
            context_id=opportunity.get("id"),
        )
        return {
            "channel": str(data.get("channel", "email")),
            "subject": str(data.get("subject", "")),
            "body": str(data.get("body", "")),
        }

    def creator_fit(self, raw_item: dict[str, Any]) -> dict[str, Any]:
        prompt = {
            "raw_item": raw_item,
            "task": (
                "Decide whether this YouTube or Twitch item should become a creator "
                "prospect for human review. Be inclusive at discovery time: create a "
                "record for plausible VR, MR, Quest, gaming, fitness, wellness, dance, "
                "boxing, rhythm-game, or tech creators whose recent content could make "
                "XRWorkout outreach relevant. Public email/contact is helpful but not "
                "required; use null when unavailable. Return should_create false only "
                "for unrelated accounts, official brand/company accounts, spam, kids "
                "content, unsafe medical claims, or accounts with too little identity "
                "context to review."
            ),
        }
        return self._json_completion(
            "creator_discovery_batch",
            CLASSIFY_SYSTEM,
            prompt,
            CREATOR_SCHEMA,
            context_table="raw_items",
            context_id=raw_item.get("id"),
        )

    def creator_fits(self, raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        compact_items = [
            {
                "raw_item_id": item.get("id"),
                "source": item.get("source"),
                "source_url": item.get("source_url"),
                "author_name": item.get("author_name"),
                "author_url": item.get("author_url"),
                "title": item.get("title"),
                "body": item.get("body"),
                "follower_count": item.get("follower_count"),
                "creator_evidence": item.get("raw_json", {}).get("creator_evidence")
                if isinstance(item.get("raw_json"), dict)
                else {},
                "source_type": item.get("raw_json", {}).get("source_type")
                if isinstance(item.get("raw_json"), dict)
                else "",
                "keyword": item.get("raw_json", {}).get("keyword")
                if isinstance(item.get("raw_json"), dict)
                else "",
            }
            for item in raw_items
        ]
        prompt = {
            "raw_items": compact_items,
            "task": (
                "Build a review list of creators who may be strong fits for XRWorkout. "
                "Evaluate YouTube, Twitch, and Apify profile-history creator items inclusively, "
                "but prioritize quality using the candidate-scoring rubric. Post-only Apify "
                "conversation author leads are promoted deterministically outside this LLM "
                "step and must not be treated as full profile-history evidence. "
                "For each plausible creator, return: raw_item_id, name, platform, "
                "profile_url, public_contact if visible in the input otherwise null, "
                "niche, audience_estimate using the real follower_count when present, "
                "audience_quality, why they fit XRWorkout, "
                "whether they already talk about VR, fitness, gaming, or wellness, "
                "suggested offer angle, creator_quality_score from 0-100, recent VR "
                "post count, recent total post count, last post date, activity level, "
                "VR involvement evidence, movement fit evidence, headset evidence, "
                "headset confidence, engagement evidence, contactability evidence, "
                "safety notes, and priority high/medium/low. Include creators "
                "who are credible VR, MR, Quest, gaming, fitness, wellness, dance, "
                "boxing, rhythm-game, or tech prospects. Exclude unrelated accounts, "
                "official brand/company accounts, spam, kids content, unsafe medical "
                "claims, and accounts with too little identity context to review."
            ),
        }
        data = self._json_completion(
            "creator_discovery_batch",
            CLASSIFY_SYSTEM,
            prompt,
            CREATOR_BATCH_SCHEMA,
            context_table="raw_items",
            context_id="batch",
        )
        creators = data.get("creators", [])
        if not isinstance(creators, list):
            return []
        return [creator for creator in creators if isinstance(creator, dict)]

    def _json_completion(
        self,
        task: str,
        system: str,
        payload: dict[str, Any],
        schema: dict[str, Any],
        context_table: str | None = None,
        context_id: Any = None,
    ) -> dict[str, Any]:
        policy = self.policy.get(task, DEFAULT_POLICY[task])
        provider = self._provider(policy)
        runtime_policy = self._runtime_policy(policy, provider)
        attempts = max(1, runtime_policy.retries + 1)
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            started = time.monotonic()
            try:
                data = provider.json_completion(system, payload, schema, runtime_policy)
                self._log_event(
                    task,
                    runtime_policy,
                    provider.provider_name,
                    "success",
                    attempt,
                    False,
                    started,
                    context_table,
                    context_id,
                    None,
                )
                return data
            except Exception as exc:
                last_error = exc
                self._log_event(
                    task,
                    runtime_policy,
                    provider.provider_name,
                    "failure",
                    attempt,
                    False,
                    started,
                    context_table,
                    context_id,
                    exc,
                )

        raise RuntimeError(f"LLM task {task} failed: {last_error}") from last_error

    def _provider(self, policy: TaskPolicy) -> LLMProvider:
        if policy.provider == "ollama":
            if self.ollama is None:
                self.ollama = OllamaProvider(self.settings)
            if not self.ollama:
                raise RuntimeError("Ollama provider was not initialized")
            return self.ollama
        raise RuntimeError(f"Unsupported LLM provider: {policy.provider}")

    def _runtime_policy(self, policy: TaskPolicy, provider: LLMProvider) -> TaskPolicy:
        return policy

    def _log_event(
        self,
        task: str,
        policy: TaskPolicy,
        provider: str,
        status: str,
        attempt: int,
        fallback_used: bool,
        started: float,
        context_table: str | None,
        context_id: Any,
        error: Exception | None,
    ) -> None:
        if not self.settings.supabase_url or not self.settings.supabase_service_role_key:
            return
        try:
            from xroutreach.db import OutreachDB

            OutreachDB(self.settings).insert_llm_usage_event(
                {
                    "task": task,
                    "provider": provider,
                    "model": policy.model or None,
                    "status": status,
                    "attempt": attempt,
                    "fallback_used": fallback_used,
                    "latency_ms": int((time.monotonic() - started) * 1000),
                    "context_table": context_table,
                    "context_id": str(context_id) if context_id is not None else None,
                    "error_summary": summarize_error(str(error)) if error else None,
                }
            )
        except Exception:
            return


def load_policy(path: str) -> dict[str, TaskPolicy]:
    policy = dict(DEFAULT_POLICY)
    policy_path = Path(path)
    if not policy_path.is_absolute():
        policy_path = Path.cwd() / policy_path
    if not policy_path.exists():
        return policy
    with open(policy_path, encoding="utf-8") as handle:
        raw = json.load(handle)
    if not isinstance(raw, dict):
        raise RuntimeError("LLM policy file must contain a JSON object")
    for task, value in raw.items():
        if not isinstance(value, dict):
            continue
        current = policy.get(task, DEFAULT_POLICY.get(task))
        if not current:
            continue
        policy[task] = TaskPolicy(
            provider=str(value.get("provider", current.provider)),
            model=str(value.get("model", current.model)),
            timeout_seconds=int(value.get("timeout_seconds", current.timeout_seconds)),
            retries=int(value.get("retries", current.retries)),
            temperature=float(value.get("temperature", current.temperature)),
        )
    return policy


def completion_prompt(system: str, payload: dict[str, Any], schema: dict[str, Any]) -> str:
    return (
        f"{system}\n\n"
        "You are running inside an automated outreach pipeline. "
        "Return one JSON object that matches the provided output schema. "
        "Do not include markdown, commentary, or code fences.\n\n"
        f"Output schema:\n{json.dumps(schema, ensure_ascii=False, indent=2)}\n\n"
        f"Input payload:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def parse_json_object(content: str) -> dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise
        data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise SchemaValidationError("LLM response must be one JSON object")
    return data


def validate_schema(data: Any, schema: dict[str, Any], path: str = "$") -> None:
    schema_type = schema.get("type")
    if schema_type:
        allowed = schema_type if isinstance(schema_type, list) else [schema_type]
        if not any(type_matches(data, expected) for expected in allowed):
            raise SchemaValidationError(f"{path} must be {allowed}")

    if "enum" in schema and data not in schema["enum"]:
        raise SchemaValidationError(f"{path} must be one of {schema['enum']}")

    if isinstance(data, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in data:
                raise SchemaValidationError(f"{path}.{key} is required")
        properties = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            extra = sorted(set(data) - set(properties))
            if extra:
                raise SchemaValidationError(f"{path} has unexpected fields: {extra}")
        for key, value in data.items():
            if key in properties:
                validate_schema(value, properties[key], f"{path}.{key}")

    if isinstance(data, list):
        item_schema = schema.get("items")
        if item_schema:
            for index, value in enumerate(data):
                validate_schema(value, item_schema, f"{path}[{index}]")

def type_matches(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "null":
        return value is None
    return True


def summarize_error(value: str, limit: int = 240) -> str:
    cleaned = " ".join(str(value).split())
    return cleaned[:limit]


CLASSIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "opportunity_type": {
            "type": "string",
            "enum": [
                "recommendation_request",
                "complaint",
                "does_vr_fitness_work",
                "creator_opportunity",
                "community_event",
                "press_newsletter",
                "product_feedback",
                "support_issue",
                "partnership_lead",
                "trend_news",
                "competitor_owned",
                "do_not_engage",
            ],
        },
        "summary": {"type": "string"},
        "pain_point": {"type": "string"},
        "xrworkout_relevance": {"type": "string"},
        "audience_type": {"type": "string"},
        "score": {"type": "integer", "minimum": 0, "maximum": 100},
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
        "recommended_action": {
            "type": "string",
            "enum": ["email", "dm", "comment", "monitor", "do_not_engage"],
        },
        "outreach_safety": {
            "type": "string",
            "enum": ["safe", "review", "do_not_engage"],
        },
    },
    "required": [
        "opportunity_type",
        "summary",
        "pain_point",
        "xrworkout_relevance",
        "audience_type",
        "score",
        "priority",
        "recommended_action",
        "outreach_safety",
    ],
    "additionalProperties": False,
}

CREATOR_SCHEMA = {
    "type": "object",
    "properties": {
        "should_create": {"type": "boolean"},
        "name": {"type": "string"},
        "profile_url": {"type": "string"},
        "public_contact": {"type": ["string", "null"]},
        "niche": {"type": "string"},
        "audience_estimate": {"type": "string"},
        "audience_quality": {"type": "string"},
        "fit_reason": {"type": "string"},
        "offer_angle": {"type": "string"},
        "priority": {"type": "string", "enum": ["high", "medium", "low"]},
    },
    "required": [
        "should_create",
        "name",
        "profile_url",
        "public_contact",
        "niche",
        "audience_estimate",
        "audience_quality",
        "fit_reason",
        "offer_angle",
        "priority",
    ],
    "additionalProperties": False,
}

CREATOR_BATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "creators": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "raw_item_id": {"type": ["string", "null"]},
                    "name": {"type": "string"},
                    "platform": {"type": "string"},
                    "profile_url": {"type": "string"},
                    "public_contact": {"type": ["string", "null"]},
                    "niche": {"type": "string"},
                    "audience_estimate": {"type": "string"},
                    "audience_quality": {"type": "string"},
                    "fit_reason": {"type": "string"},
                    "talks_about": {"type": "string"},
                    "offer_angle": {"type": "string"},
                    "creator_quality_score": {"type": "integer", "minimum": 0, "maximum": 100},
                    "recent_vr_posts_count": {"type": "integer", "minimum": 0},
                    "recent_total_posts_count": {"type": "integer", "minimum": 0},
                    "last_post_at": {"type": ["string", "null"]},
                    "activity_level": {"type": "string", "enum": ["high", "medium", "low", "unknown"]},
                    "vr_involvement_evidence": {"type": "string"},
                    "movement_fit_evidence": {"type": "string"},
                    "headset_evidence": {"type": "string"},
                    "headset_confidence": {"type": "string", "enum": ["high", "medium", "low", "unknown"]},
                    "engagement_evidence": {"type": "string"},
                    "contactability_evidence": {"type": "string"},
                    "safety_notes": {"type": "string"},
                    "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": [
                    "raw_item_id",
                    "name",
                    "platform",
                    "profile_url",
                    "public_contact",
                    "niche",
                    "audience_estimate",
                    "audience_quality",
                    "fit_reason",
                    "talks_about",
                    "offer_angle",
                    "creator_quality_score",
                    "recent_vr_posts_count",
                    "recent_total_posts_count",
                    "last_post_at",
                    "activity_level",
                    "vr_involvement_evidence",
                    "movement_fit_evidence",
                    "headset_evidence",
                    "headset_confidence",
                    "engagement_evidence",
                    "contactability_evidence",
                    "safety_notes",
                    "priority",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["creators"],
    "additionalProperties": False,
}

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "channel": {"type": "string", "enum": ["email", "dm", "comment"]},
        "subject": {"type": "string"},
        "body": {"type": "string"},
    },
    "required": ["channel", "subject", "body"],
    "additionalProperties": False,
}
