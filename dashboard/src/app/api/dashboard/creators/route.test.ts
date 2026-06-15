import { describe, expect, it } from "vitest";
import { dedupeCreators } from "@/app/api/dashboard/creators/route";

describe("creator API dedupe", () => {
  it("keeps the strongest duplicate row and surfaces duplicate count", () => {
    const rows = dedupeCreators([
      {
        id: "old",
        platform: "YouTube",
        profile_url: "https://www.youtube.com/channel/UCABC",
        recent_vr_posts_count: 1,
        recent_total_posts_count: 1,
        creator_quality_score: 60,
        evidence_json: { computed_evidence_quality: "observed_post" },
        created_at: "2026-06-01T00:00:00+00:00"
      },
      {
        id: "strong",
        platform: "youtube",
        profile_url: "https://www.youtube.com/channel/ucabc",
        recent_vr_posts_count: 4,
        recent_total_posts_count: 7,
        creator_quality_score: 88,
        evidence_json: { computed_evidence_quality: "profile_history" },
        created_at: "2026-06-02T00:00:00+00:00"
      }
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "strong", duplicate_row_count: 2 });
  });
});
