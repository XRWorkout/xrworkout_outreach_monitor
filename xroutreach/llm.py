from __future__ import annotations

import json
from typing import Any

from openai import OpenAI

from xroutreach.config import Settings, require
from xroutreach.rules import priority_for_score


CLASSIFY_SYSTEM = """You classify outreach opportunities for XRWorkout.
XRWorkout is a VR/MR fitness product. Prefer high-quality, low-volume outreach.
Never recommend spam. Return strict JSON only."""

DRAFT_SYSTEM = """You write concise founder-led XRWorkout outreach drafts.
Tone: warm, specific, low-pressure. Do not overclaim health outcomes.
Public comments must disclose affiliation. Return strict JSON only."""


class LLM:
    def __init__(self, settings: Settings):
        require([("OPENAI_API_KEY", settings.openai_api_key)])
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model
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
                "score_fields": ["relevance", "intent", "reach", "xrworkout_fit", "outreach_safety"],
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
        data = self._json_completion(CLASSIFY_SYSTEM, prompt)
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
                "subject": "required for email, empty string otherwise",
                "body": "concise, context-aware draft",
            },
        }
        data = self._json_completion(DRAFT_SYSTEM, prompt)
        return {
            "channel": str(data.get("channel", "email")),
            "subject": str(data.get("subject", "")),
            "body": str(data.get("body", "")),
        }

    def creator_fit(self, raw_item: dict[str, Any]) -> dict[str, Any]:
        prompt = {
            "raw_item": raw_item,
            "task": "If this item represents a creator prospect, extract a creator record. Return should_create false if weak fit.",
        }
        return self._json_completion(CLASSIFY_SYSTEM, prompt)

    def _json_completion(self, system: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)

