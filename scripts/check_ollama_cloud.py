#!/usr/bin/env python
from __future__ import annotations

import json
from difflib import get_close_matches

import requests

from xroutreach.config import settings
from xroutreach.llm import load_policy, parse_json_object


def auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def model_names(tags_payload: dict) -> set[str]:
    models = tags_payload.get("models") if isinstance(tags_payload, dict) else []
    names: set[str] = set()
    if not isinstance(models, list):
        return names
    for model in models:
        if not isinstance(model, dict):
            continue
        for key in ["name", "model"]:
            value = model.get(key)
            if isinstance(value, str) and value.strip():
                names.add(value.strip())
    return names


def main() -> None:
    cfg = settings()
    if not cfg.ollama_api_key:
        raise RuntimeError("OLLAMA_API_KEY is required for Ollama Cloud validation")

    base_url = cfg.ollama_base_url.rstrip("/")
    policy = load_policy(cfg.llm_policy_path)
    ollama_models = {
        task_policy.model
        for task_policy in policy.values()
        if task_policy.provider == "ollama" and task_policy.model
    }

    tags_response = requests.get(
        f"{base_url}/tags",
        headers=auth_headers(cfg.ollama_api_key),
        timeout=30,
    )
    if tags_response.status_code == 401:
        raise RuntimeError("Ollama Cloud auth check failed: 401 unauthorized")
    if tags_response.status_code == 429:
        raise RuntimeError("Ollama Cloud auth check hit rate limit: 429")
    if tags_response.status_code >= 400:
        raise RuntimeError(
            f"Ollama Cloud tags check failed with {tags_response.status_code}: {tags_response.text[:240]}"
        )

    available = model_names(tags_response.json())
    missing = sorted(model for model in ollama_models if model not in available)
    if missing:
        hints = {
            model: get_close_matches(model, sorted(available), n=3)
            for model in missing
        }
        raise RuntimeError(
            "Configured Ollama model(s) were not returned by /api/tags: "
            f"{missing}. Closest matches: {hints}. "
            "For direct API mode, use names like gpt-oss:120b, not *-cloud names."
        )

    smoke_model = policy["classify_opportunity"].model
    smoke_response = requests.post(
        f"{base_url}/chat",
        headers=auth_headers(cfg.ollama_api_key),
        json={
            "model": smoke_model,
            "messages": [
                {
                    "role": "system",
                    "content": "Return strict JSON only.",
                },
                {
                    "role": "user",
                    "content": 'Return exactly this JSON object: {"ok": true}',
                },
            ],
            "stream": False,
            "options": {"temperature": 0},
        },
        timeout=60,
    )
    if smoke_response.status_code == 401:
        raise RuntimeError("Ollama Cloud smoke check failed: 401 unauthorized")
    if smoke_response.status_code == 429:
        raise RuntimeError("Ollama Cloud smoke check hit rate limit: 429")
    if smoke_response.status_code >= 400:
        raise RuntimeError(
            f"Ollama Cloud smoke check failed with {smoke_response.status_code}: {smoke_response.text[:240]}"
        )

    payload = smoke_response.json()
    message = payload.get("message") if isinstance(payload, dict) else None
    content = message.get("content") if isinstance(message, dict) else ""
    parsed = parse_json_object(content)
    if parsed.get("ok") is not True:
        raise RuntimeError(f"Ollama Cloud smoke check returned unexpected JSON: {json.dumps(parsed)}")

    print(
        "Ollama Cloud auth check passed: "
        f"base_url={base_url} models={sorted(ollama_models)}"
    )


if __name__ == "__main__":
    main()
