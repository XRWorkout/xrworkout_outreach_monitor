import { describe, expect, it } from "vitest";
import { activityMetricLabel, activityMetricValue, creatorStatusUpdateError, qualificationDecision } from "@/lib/creator-qualification";
import type { Creator } from "@/lib/types";

function creator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: "creator-1",
    name: "Quest Coach",
    platform: "youtube",
    profile_url: "https://www.youtube.com/channel/questcoach",
    public_contact: "coach@example.com",
    creator_quality_score: 90,
    recent_vr_posts_count: 3,
    recent_total_posts_count: 8,
    last_post_at: new Date().toISOString(),
    movement_fit_evidence: "Cardio boxing workouts in VR.",
    headset_evidence: "Uses Quest 3 headset.",
    headset_confidence: "high",
    safety_notes: "",
    evidence_json: {
      computed_evidence_quality: "profile_history",
      computed_evidence_confidence: "high"
    },
    priority: "high",
    status: "new",
    created_at: new Date().toISOString(),
    ...overrides
  };
}

describe("creator qualification policy", () => {
  it("qualifies creators only when deterministic profile-history evidence is complete", () => {
    const decision = qualificationDecision(creator());

    expect(decision.canQualify).toBe(true);
    expect(decision.canContactReady).toBe(true);
    expect(decision.state).toBe("qualified");
    expect(activityMetricLabel(creator(), "vr")).toBe("VR/XR 90d");
    expect(activityMetricValue(creator(), 3)).toBe(3);
  });

  it("keeps observed-only creators in review even with high observed counts", () => {
    const row = creator({
      evidence_json: { computed_evidence_quality: "accumulated_observed_posts", computed_evidence_confidence: "medium" },
      recent_vr_posts_count: 7,
      recent_total_posts_count: 7,
      creator_quality_score: 96
    });

    const decision = qualificationDecision(row);

    expect(decision.canQualify).toBe(false);
    expect(decision.state).toBe("observed_only");
    expect(decision.reasons.join(" ")).toContain("observed-only");
    expect(activityMetricLabel(row, "vr")).toBe("VR/XR observed");
    expect(creatorStatusUpdateError(row, "qualified")).toContain("cannot mark creator Qualified");
  });

  it("marks unknown or insufficient data as unknown and does not collapse it to zero", () => {
    const row = creator({
      evidence_json: { computed_evidence_quality: "no_history", computed_evidence_confidence: "weak" },
      recent_vr_posts_count: 0,
      recent_total_posts_count: 0,
      last_post_at: null
    });

    const decision = qualificationDecision(row);

    expect(decision.canQualify).toBe(false);
    expect(decision.state).toBe("unknown");
    expect(activityMetricValue(row, row.recent_vr_posts_count)).toBe("Unknown");
  });

  it("distinguishes true zero from unknown when profile history was computed", () => {
    const row = creator({
      evidence_json: { computed_evidence_quality: "profile_history", computed_evidence_confidence: "high" },
      creator_quality_score: 38,
      recent_vr_posts_count: 0,
      recent_total_posts_count: 8
    });

    const decision = qualificationDecision(row);

    expect(decision.canQualify).toBe(false);
    expect(decision.state).toBe("review");
    expect(activityMetricLabel(row, "vr")).toBe("VR/XR 90d");
    expect(activityMetricValue(row, row.recent_vr_posts_count)).toBe(0);
    expect(decision.reasons.join(" ")).toContain("at least 2 recent VR/XR posts");
  });

  it("requires a validated contact path before Contact Ready", () => {
    const row = creator({ public_contact: null, contactability_evidence: "" });
    const decision = qualificationDecision(row);

    expect(decision.canQualify).toBe(true);
    expect(decision.canContactReady).toBe(false);
    expect(creatorStatusUpdateError(row, "contact_ready")).toContain("validated public contact");
  });
});
