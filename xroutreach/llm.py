from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from typing import Any

from xroutreach.config import Settings
from xroutreach.rules import priority_for_score


CLASSIFY_SYSTEM = """You classify outreach opportunities for XRWorkout.
XRWorkout is a VR/MR fitness product. Prefer high-quality, low-volume outreach.
Never recommend spam. Return strict JSON only."""

DRAFT_SYSTEM = """You write concise founder-led XRWorkout outreach message drafts.
Tone: warm, specific, low-pressure. Do not overclaim health outcomes.
Choose email, dm, or comment from the recommended action.
For email, include a useful subject and an email-ready body.
For comment, use an empty subject and write a short public reply with explicit XRWorkout affiliation disclosure.
For dm, use an empty subject and write a concise private message that is low-pressure and affiliation-clear.
Return strict JSON only."""


class LLM:
    def __init__(self, settings: Settings):
        self.codex_bin = settings.codex_bin
        if not shutil.which(self.codex_bin):
            raise RuntimeError(f"Codex CLI not found on PATH: {self.codex_bin}")
        self.model = settings.codex_model
        self.timeout_seconds = settings.codex_timeout_seconds
        self.founder_name = settings.founder_name
        self.site = settings.xrworkout_site

    def classify(self, raw_item: dict[str, Any]) -> dict[str, Any]:
        prompt = {
            "source": raw_item.get("source"),
            "title": raw_item.get("title"),
            "body": raw_item.get("body"),
            "author_name": raw_item.get("author_name"),
            "source_url": raw_item.get("source_url"),
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
                    "community_event",
                    "press_newsletter",
                    "product_feedback",
                    "support_issue",
                    "competitor_owned",
                    "do_not_engage",
                ],
            },
        }
        data = self._json_completion(CLASSIFY_SYSTEM, prompt, CLASSIFY_SCHEMA)
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
        data = self._json_completion(DRAFT_SYSTEM, prompt, DRAFT_SCHEMA)
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
        return self._json_completion(CLASSIFY_SYSTEM, prompt, CREATOR_SCHEMA)

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
                "Evaluate YouTube and Twitch items inclusively, but prioritize quality. "
                "For each plausible creator, return: raw_item_id, name, platform, "
                "profile_url, public_contact if visible in the input otherwise null, "
                "niche, audience_estimate, audience_quality, why they fit XRWorkout, "
                "whether they already talk about VR, fitness, gaming, or wellness, "
                "suggested offer angle, and priority high/medium/low. Include creators "
                "who are credible VR, MR, Quest, gaming, fitness, wellness, dance, "
                "boxing, rhythm-game, or tech prospects. Exclude unrelated accounts, "
                "official brand/company accounts, spam, kids content, unsafe medical "
                "claims, and accounts with too little identity context to review."
            ),
        }
        data = self._json_completion(CLASSIFY_SYSTEM, prompt, CREATOR_BATCH_SCHEMA)
        creators = data.get("creators", [])
        if not isinstance(creators, list):
            return []
        return [creator for creator in creators if isinstance(creator, dict)]

    def _json_completion(
        self, system: str, payload: dict[str, Any], schema: dict[str, Any]
    ) -> dict[str, Any]:
        prompt = (
            f"{system}\n\n"
            "You are running inside an automated outreach pipeline. "
            "Return one JSON object that matches the provided output schema. "
            "Do not include markdown, commentary, or code fences.\n\n"
            f"Input payload:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            schema_path = f"{tmpdir}/schema.json"
            output_path = f"{tmpdir}/last-message.json"
            with open(schema_path, "w", encoding="utf-8") as handle:
                json.dump(schema, handle)

            command = [self.codex_bin, "-a", "never"]
            if self.model:
                command.extend(["--model", self.model])
            command.extend(
                [
                    "exec",
                    "--skip-git-repo-check",
                    "--ephemeral",
                    "--sandbox",
                    "read-only",
                    "--output-schema",
                    schema_path,
                    "--output-last-message",
                    output_path,
                    "--color",
                    "never",
                    "-",
                ]
            )

            try:
                result = subprocess.run(
                    command,
                    input=prompt,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise RuntimeError(
                    f"Codex CLI timed out after {self.timeout_seconds} seconds"
                ) from exc

            if result.returncode != 0:
                details = (result.stderr or result.stdout).strip()
                raise RuntimeError(
                    f"Codex CLI failed with exit code {result.returncode}: {details}"
                )

            with open(output_path, encoding="utf-8") as handle:
                content = handle.read().strip()
        return json.loads(content or "{}")


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
                    "platform": {"type": "string", "enum": ["youtube", "twitch"]},
                    "profile_url": {"type": "string"},
                    "public_contact": {"type": ["string", "null"]},
                    "niche": {"type": "string"},
                    "audience_estimate": {"type": "string"},
                    "audience_quality": {"type": "string"},
                    "fit_reason": {"type": "string"},
                    "talks_about": {"type": "string"},
                    "offer_angle": {"type": "string"},
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
