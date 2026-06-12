import { describe, expect, it } from "vitest";
import { platformNodes } from "@/lib/view-models";
import type { Creator, SummaryData } from "@/lib/types";

const summary = (sourceQuality: SummaryData["sourceQuality"]): SummaryData => ({
  counts: { rawItems: 0, opportunities: 0, creators: 0, drafts: 0, followups: 0, offers: 0 },
  rawItems: [],
  opportunities: [],
  drafts: [],
  followups: [],
  creators: [],
  sourceQuality,
  actionQueue: {
    highPriorityOpportunities: 0,
    draftsNeedingReview: 0,
    approvedDrafts: 0,
    sentDrafts: 0,
    rejectedDrafts: 0,
    creatorsMissingContact: 0,
    creatorsContactReady: 0,
    dueFollowups: 0
  }
});

const creator = (platform: string): Creator => ({
  id: platform,
  name: platform,
  platform,
  profile_url: `https://example.com/${platform}`,
  priority: "medium",
  status: "new",
  created_at: "2026-06-12T00:00:00.000Z"
});

describe("platform radar nodes", () => {
  it("lights native source nodes from Apify source aliases", () => {
    const nodes = platformNodes(
      summary([
        { source: "apify_x", rawItems: 10, opportunities: 2, highPriority: 1, averageScore: 40, drafts: 0, approvedOrSent: 0 },
        { source: "apify_tiktok", rawItems: 20, opportunities: 12, highPriority: 1, averageScore: 33.3, drafts: 1, approvedOrSent: 0 },
        { source: "apify_instagram", rawItems: 50, opportunities: 5, highPriority: 2, averageScore: 55, drafts: 0, approvedOrSent: 0 },
        { source: "apify_facebook_group", rawItems: 30, opportunities: 4, highPriority: 1, averageScore: 45, drafts: 0, approvedOrSent: 0 }
      ]),
      [creator("apify_discord")]
    );

    expect(nodes.find((node) => node.id === "x")).toMatchObject({ live: true, volume: 10, opportunities: 2 });
    expect(nodes.find((node) => node.id === "tiktok")).toMatchObject({ live: true, volume: 20, opportunities: 12 });
    expect(nodes.find((node) => node.id === "instagram")).toMatchObject({ live: true, volume: 50, opportunities: 5 });
    expect(nodes.find((node) => node.id === "facebook_group")).toMatchObject({ live: true, volume: 30, opportunities: 4 });
    expect(nodes.find((node) => node.id === "discord")).toMatchObject({ live: true, creators: 1 });
  });
});
