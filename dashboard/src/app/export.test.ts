import { describe, expect, it } from "vitest";
import { buildContactExportRows, contactExportContent, parseContactExportRequest } from "@/app/page";
import type { Creator, Draft, Opportunity, RawItem } from "@/lib/types";

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

function rawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "raw-1",
    source: "apify_tiktok",
    source_url: "https://www.tiktok.com/@questcoach/video/1",
    title: "Quest 3 boxing workout",
    body: "Trying Thrill of the Fight for cardio.",
    author_name: "Quest Coach",
    author_url: "https://www.tiktok.com/@questcoach",
    follower_count: 850,
    collected_at: "2026-06-12T00:00:00+00:00",
    raw_json: { public_contact: null, source_type: "social_post" },
    ...overrides
  };
}

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opportunity-1",
    platform: "apify_tiktok",
    opportunity_type: "creator_opportunity",
    summary: "Creator posted a Quest boxing workout.",
    pain_point: "Looking for better VR fitness routines.",
    xrworkout_relevance: "Strong VR fitness signal.",
    audience_type: "VR fitness creator audience",
    score: 82,
    priority: "high",
    recommended_action: "Manual DM review",
    outreach_safety: "safe",
    status: "new",
    created_at: "2026-06-12T00:00:00+00:00",
    raw_items: rawItem(),
    ...overrides
  };
}

describe("contact export helpers", () => {
  it("includes manual-contact creator leads without public email", () => {
    const request = parseContactExportRequest("first 10 creators, 100-1000 followers csv", "csv");

    const rows = buildContactExportRows([creator()], [] as Draft[], [], [], request);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Quest Coach",
      platform: "TikTok",
      sourceKind: "Creator",
      contact: "Manual contact path",
      followers: "850 followers",
      priority: "Medium Priority",
      status: "New"
    });
    expect(rows[0].sampleMessage).toContain("Hi Quest");
    expect(rows[0].sampleMessage).toContain("Review manually");
  });

  it("exports a high-priority opportunity author without a creator row", () => {
    const request = parseContactExportRequest("top 10 high priority opportunities 100-1000 followers csv", "csv");

    const rows = buildContactExportRows([], [], [opportunity()], [], request);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Quest Coach",
      sourceKind: "Opportunity Author",
      contact: "Manual contact path",
      priority: "High Priority",
      score: "82",
      recommendedAction: "Manual DM review"
    });
  });

  it("exports conversation authors with public profiles even when no public email exists", () => {
    const request = parseContactExportRequest("first 10 conversations 100-1000 followers csv", "csv");

    const rows = buildContactExportRows([], [], [], [rawItem()], request);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Quest Coach",
      sourceKind: "Conversation Author",
      contact: "Manual contact path",
      followers: "850 followers"
    });
  });

  it("deduplicates creator, opportunity, and raw author into the strongest row", () => {
    const request = parseContactExportRequest("first 10 prospects 100-1000 followers csv", "csv");

    const rows = buildContactExportRows([creator({ priority: "medium" })], [], [opportunity()], [rawItem()], request);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      sourceKind: "Opportunity Author",
      priority: "High Priority",
      score: "82"
    });
  });

  it("excludes rejected creators and unsafe opportunities", () => {
    const request = parseContactExportRequest("first 10 prospects csv", "csv");

    const rows = buildContactExportRows(
      [creator({ id: "rejected", status: "rejected" })],
      [],
      [opportunity({ outreach_safety: "do_not_engage", raw_items: rawItem({ id: "raw-unsafe", author_url: "https://www.tiktok.com/@unsafe" }) })],
      [],
      request
    );

    expect(rows).toHaveLength(0);
  });

  it("applies follower ranges to raw and opportunity candidates", () => {
    const request = parseContactExportRequest("first 10 prospects 1000-10000 followers csv", "csv");

    const rows = buildContactExportRows(
      [],
      [],
      [opportunity({ raw_items: rawItem({ id: "raw-op", author_name: "FitXR Fan", author_url: "https://www.tiktok.com/@fitxrfan", follower_count: 1200 }) })],
      [rawItem({ id: "raw-small", author_name: "Small Coach", author_url: "https://www.tiktok.com/@smallcoach", follower_count: 850 })],
      request
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "FitXR Fan", followers: "1.2K followers" });
  });

  it("includes source context fields in CSV, JSON, and text exports", () => {
    const rows = buildContactExportRows([], [], [opportunity()], [], parseContactExportRequest("first 1 prospects csv", "csv"));

    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects csv", "csv"))).toContain('"Source Kind"');
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects json", "json"))).toContain('"recommendedAction"');
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects text", "txt"))).toContain("Recommended action:");
  });
});
