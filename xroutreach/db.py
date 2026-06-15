from __future__ import annotations

from collections.abc import Iterable
from datetime import date, datetime, timezone
from typing import Any

from supabase import Client, create_client

from xroutreach.config import Settings, require


def normalize_creator_platform(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_").replace(" ", "_")


def normalize_creator_profile_url(value: Any) -> str:
    return str(value or "").strip().lower().rstrip("/")


class OutreachDB:
    def __init__(self, settings: Settings):
        require(
            [
                ("SUPABASE_URL", settings.supabase_url),
                ("SUPABASE_SERVICE_ROLE_KEY", settings.supabase_service_role_key),
            ]
        )
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )

    def upsert_raw_items(self, rows: Iterable[dict[str, Any]]) -> None:
        payload = self.deduped_raw_payload(rows)
        if not payload:
            return
        self.client.table("raw_items").upsert(payload, on_conflict="dedupe_hash").execute()

    def deduped_raw_payload(self, rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        return list(
            {
                row["dedupe_hash"]: row
                for row in rows
                if row.get("dedupe_hash")
            }.values()
        )

    def fetch_unprocessed_raw_items(self, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.table("raw_items")
            .select("*")
            .is_("processed_at", "null")
            .order("collected_at")
            .limit(limit)
            .execute()
        )
        return result.data or []

    def mark_raw_processed(self, raw_item_id: str) -> None:
        self.client.table("raw_items").update(
            {"processed_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", raw_item_id).execute()

    def upsert_opportunity(self, row: dict[str, Any]) -> None:
        self.client.table("opportunities").upsert(row, on_conflict="raw_item_id").execute()

    def fetch_high_priority_opportunities_without_drafts(self, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.rpc("get_high_priority_opportunities_without_drafts", {"row_limit": limit})
            .execute()
        )
        return result.data or []

    def fetch_opportunity(self, opportunity_id: str) -> dict[str, Any] | None:
        result = (
            self.client.table("opportunities")
            .select("*")
            .eq("id", opportunity_id)
            .single()
            .execute()
        )
        return result.data

    def insert_draft(self, row: dict[str, Any]) -> None:
        self.client.table("drafts").insert(row).execute()

    def fetch_approved_drafts(self, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.table("drafts")
            .select("*, creators(*), opportunities(*)")
            .eq("status", "approved")
            .limit(limit)
            .execute()
        )
        return result.data or []

    def mark_draft_sent(self, draft_id: str) -> None:
        self.client.table("drafts").update(
            {
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", draft_id).execute()

    def insert_followup(self, row: dict[str, Any]) -> None:
        self.client.table("followups").insert(row).execute()

    def insert_llm_usage_event(self, row: dict[str, Any]) -> None:
        self.client.table("llm_usage_events").insert(row).execute()

    def fetch_due_followups(self, as_of: date, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.table("followups")
            .select("*, drafts(*, creators(*), opportunities(*))")
            .eq("status", "pending")
            .lte("due_date", as_of.isoformat())
            .order("due_date")
            .limit(limit)
            .execute()
        )
        return result.data or []

    def upsert_creator(self, row: dict[str, Any]) -> None:
        payload = dict(row)
        payload["platform"] = normalize_creator_platform(payload.get("platform"))
        payload["profile_url"] = normalize_creator_profile_url(payload.get("profile_url"))

        existing = (
            self.client.table("creators")
            .select("id, platform, profile_url, status, public_contact")
            .ilike("profile_url", payload["profile_url"])
            .execute()
        )
        matching = [
            candidate
            for candidate in existing.data or []
            if normalize_creator_platform(candidate.get("platform")) == payload["platform"]
        ]
        exact = next(
            (
                candidate
                for candidate in matching
                if candidate.get("platform") == payload["platform"]
                and candidate.get("profile_url") == payload["profile_url"]
            ),
            None,
        )
        target = exact or (matching[0] if matching else None)
        if target:
            update_payload = dict(payload)
            existing_status = str(target.get("status") or "").strip()
            if existing_status and existing_status != "new":
                update_payload.pop("status", None)
            if target.get("public_contact") and not update_payload.get("public_contact"):
                update_payload.pop("public_contact", None)
            self.client.table("creators").update(update_payload).eq("id", target["id"]).execute()
            return

        self.client.table("creators").upsert(payload, on_conflict="platform,profile_url").execute()

    def fetch_creator_source_items(self, limit: int) -> list[dict[str, Any]]:
        result = (
            self.client.table("raw_items")
            .select("*")
            .in_(
                "source",
                [
                    "youtube",
                    "twitch",
                    "apify",
                    "apify_instagram",
                    "apify_tiktok",
                    "apify_youtube",
                    "apify_youtube_enriched",
                    "apify_twitch",
                    "apify_social",
                    "apify_x",
                    "apify_twitter",
                    "apify_facebook",
                    "apify_facebook_group",
                    "apify_discord",
                ],
            )
            .order("collected_at", desc=True)
            .limit(limit)
            .execute()
        )
        return result.data or []

    def delete_operational_data(self) -> dict[str, int]:
        counts = self.weekly_counts()
        for table in ["followups", "offers", "drafts", "opportunities", "creators", "raw_items"]:
            self.client.table(table).delete().filter("id", "not.is", "null").execute()
        return counts

    def weekly_counts(self) -> dict[str, int]:
        tables = ["raw_items", "opportunities", "creators", "drafts", "followups", "offers"]
        counts: dict[str, int] = {}
        for table in tables:
            result = self.client.table(table).select("id", count="exact").execute()
            counts[table] = result.count or 0
        return counts
