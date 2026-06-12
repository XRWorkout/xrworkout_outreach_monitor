import { describe, expect, it } from "vitest";
import { buildContactExportRows, parseContactExportRequest } from "@/app/page";
import type { Creator, Draft } from "@/lib/types";

function creator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: "creator-1",
    name: "Quest Coach",
    platform: "apify_tiktok",
    profile_url: "https://www.tiktok.com/@questcoach",
    public_contact: null,
    niche: "Conversation author lead",
    follower_count: 850,
    audience_estimate: "Unknown",
    audience_quality: "Needs manual review from conversation context",
    recent_relevant_content: "https://www.tiktok.com/@questcoach/video/1",
    fit_reason: "Review-only creator lead from a public social post.",
    offer_angle: "Review manually for comment, DM, or later creator outreach.",
    creator_quality_score: 62,
    priority: "medium",
    status: "new",
    created_at: "2026-06-12T00:00:00+00:00",
    ...overrides
  };
}

describe("contact export helpers", () => {
  it("includes manual-contact creator leads without public email", () => {
    const request = parseContactExportRequest("first 10 creators, 100-1000 followers csv", "csv");

    const rows = buildContactExportRows([creator()], [] as Draft[], request);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Quest Coach",
      platform: "TikTok",
      contact: "No public contact captured",
      followers: "850 followers",
      priority: "Medium Priority",
      status: "New"
    });
    expect(rows[0].sampleMessage).toContain("Hi Quest");
    expect(rows[0].sampleMessage).toContain("Review manually");
  });
});
