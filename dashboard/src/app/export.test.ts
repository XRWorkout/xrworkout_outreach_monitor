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
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects csv", "csv"))).toContain('"Record Type"');
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects json", "json"))).toContain('"recommendedAction"');
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects json", "json"))).toContain('"recordType"');
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects text", "txt"))).toContain("Record type:");
    expect(contactExportContent(rows, parseContactExportRequest("first 1 prospects text", "txt"))).toContain("Recommended action:");
  });

  it("filters opportunity and conversation records by score threshold", () => {
    const request = parseContactExportRequest("first 10 records score 60+ csv", "csv");

    const rows = buildContactExportRows(
      [],
      [],
      [
        opportunity({ id: "strong", score: 72, raw_items: rawItem({ id: "raw-strong", author_name: null, author_url: null, source_url: "https://example.com/strong" }) }),
        opportunity({ id: "weak", score: 42, raw_items: rawItem({ id: "raw-weak", author_name: null, author_url: null, source_url: "https://example.com/weak" }) })
      ],
      [],
      request
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sourceKind: "Conversation Record", score: "72", contact: "Review source manually" });
  });

  it("includes medium and high priority but excludes low priority", () => {
    const request = parseContactExportRequest("first 10 records medium and up csv", "csv");

    const rows = buildContactExportRows(
      [],
      [],
      [
        opportunity({ id: "high", priority: "high", raw_items: rawItem({ id: "raw-high", author_name: "High Creator", author_url: "https://example.com/high" }) }),
        opportunity({ id: "medium", priority: "medium", raw_items: rawItem({ id: "raw-medium", author_name: "Medium Creator", author_url: "https://example.com/medium" }) }),
        opportunity({ id: "low", priority: "low", raw_items: rawItem({ id: "raw-low", author_name: "Low Creator", author_url: "https://example.com/low" }) })
      ],
      [],
      request
    );

    expect(rows.map((row) => row.name).sort()).toEqual(["High Creator", "Medium Creator"]);
  });

  it("supports high-only priority requests", () => {
    const request = parseContactExportRequest("first 10 high only records csv", "csv");

    const rows = buildContactExportRows(
      [],
      [],
      [
        opportunity({ id: "high", priority: "high", raw_items: rawItem({ id: "raw-high", author_name: "High Creator", author_url: "https://example.com/high" }) }),
        opportunity({ id: "medium", priority: "medium", raw_items: rawItem({ id: "raw-medium", author_name: "Medium Creator", author_url: "https://example.com/medium" }) })
      ],
      [],
      request
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "High Creator", priority: "High Priority" });
  });

  it("parses large record requests up to the 1000 row cap", () => {
    expect(parseContactExportRequest("first 800 records score 50+", "csv")).toMatchObject({
      limit: 800,
      minOpportunityScore: 50,
      minCreatorScore: 50
    });
    expect(parseContactExportRequest("first 2000 records", "csv").limit).toBe(1000);
  });

  it("exports conversation records without author profiles using the source url", () => {
    const request = parseContactExportRequest("first 10 records score 50+ csv", "csv");

    const rows = buildContactExportRows(
      [],
      [],
      [opportunity({ score: 75, raw_items: rawItem({ author_name: null, author_url: null, source_url: "https://example.com/conversation", title: "A useful VR workout thread" }) })],
      [],
      request
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "A useful VR workout thread",
      sourceKind: "Conversation Record",
      recordType: "Conversation",
      profile: "https://example.com/conversation",
      contact: "Review source manually"
    });
  });

  it("ranks contact-ready prospects above same-score conversation records", () => {
    const request = parseContactExportRequest("first 10 records score 50+ csv", "csv");

    const rows = buildContactExportRows(
      [creator({ status: "contact_ready", public_contact: "coach@example.com", creator_quality_score: 75, priority: "high" })],
      [],
      [opportunity({ score: 75, raw_items: rawItem({ id: "raw-conversation", author_name: null, author_url: null, source_url: "https://example.com/conversation" }) })],
      [],
      request
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ recordType: "Prospect", contact: "coach@example.com" });
    expect(rows[1]).toMatchObject({ recordType: "Conversation", contact: "Review source manually" });
  });
});
