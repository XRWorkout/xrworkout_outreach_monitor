from __future__ import annotations

from datetime import date, timedelta


HIGH_THRESHOLD = 80
MEDIUM_THRESHOLD = 60


def priority_for_score(score: int) -> str:
    if score >= HIGH_THRESHOLD:
        return "high"
    if score >= MEDIUM_THRESHOLD:
        return "medium"
    return "low"


def should_generate_draft(score: int, outreach_safety: str, recommended_action: str) -> bool:
    if score < HIGH_THRESHOLD:
        return False
    unsafe = {"do_not_engage", "unsafe", "competitor_owned", "medical_claim_risk"}
    if outreach_safety in unsafe:
        return False
    return recommended_action in {"email", "dm", "comment", "creator_outreach"}


def next_followup_date(cadence_step: int, sent_on: date | None = None) -> date:
    base = sent_on or date.today()
    if cadence_step == 1:
        return base + timedelta(days=7)
    if cadence_step == 2:
        return base + timedelta(days=14)
    raise ValueError("cadence_step must be 1 or 2")


def sendable_status(status: str) -> bool:
    return status == "approved"

