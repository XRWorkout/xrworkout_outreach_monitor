from __future__ import annotations

import hashlib


def dedupe_hash(source: str, external_id: str, source_url: str = "") -> str:
    key = "|".join([source.strip().lower(), external_id.strip(), source_url.strip()])
    return hashlib.sha256(key.encode("utf-8")).hexdigest()

