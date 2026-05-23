#!/usr/bin/env python
from __future__ import annotations

import json
import subprocess
import tempfile

from xroutreach.config import settings


def main() -> None:
    cfg = settings()
    schema = {
        "type": "object",
        "properties": {
            "ok": {"type": "boolean"},
            "message": {"type": "string"},
        },
        "required": ["ok", "message"],
        "additionalProperties": False,
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        schema_path = f"{tmpdir}/schema.json"
        output_path = f"{tmpdir}/last-message.json"
        with open(schema_path, "w", encoding="utf-8") as handle:
            json.dump(schema, handle)

        command = [cfg.codex_bin, "-a", "never"]
        if cfg.codex_model:
            command.extend(["--model", cfg.codex_model])
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

        result = subprocess.run(
            command,
            input='Return JSON with ok true and message "codex auth works".',
            capture_output=True,
            text=True,
            timeout=cfg.codex_timeout_seconds,
            check=False,
        )

        if result.returncode != 0:
            details = (result.stderr or result.stdout).strip()
            raise RuntimeError(f"Codex CLI auth check failed: {details}")

        with open(output_path, encoding="utf-8") as handle:
            data = json.load(handle)
        if data.get("ok") is not True:
            raise RuntimeError(f"Codex CLI auth check returned unexpected output: {data}")

    print("Codex CLI auth check passed")


if __name__ == "__main__":
    main()
