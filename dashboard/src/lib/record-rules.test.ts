import { describe, expect, it } from "vitest";
import {
  creatorUpdateSchema,
  followupUpdateSchema,
  offerUpdateSchema,
  opportunityStatusSchema
} from "@/lib/record-rules";

describe("operator record update validation", () => {
  it("accepts supported opportunity statuses", () => {
    expect(opportunityStatusSchema.parse({ status: "reviewed" })).toEqual({ status: "reviewed" });
  });

  it("rejects unsupported opportunity statuses", () => {
    expect(() => opportunityStatusSchema.parse({ status: "sent" })).toThrow();
  });

  it("accepts editable creator fields", () => {
    expect(
      creatorUpdateSchema.parse({
        status: "contact_ready",
        public_contact: "creator@example.com",
        priority: "high",
        fit_reason: "VR fitness creator",
        offer_angle: "Creator trial"
      })
    ).toMatchObject({ status: "contact_ready", priority: "high" });
  });

  it("accepts follow-up status and draft body edits", () => {
    expect(followupUpdateSchema.parse({ status: "completed", draft_body: "Thanks again" })).toEqual({
      status: "completed",
      draft_body: "Thanks again"
    });
  });

  it("accepts offer outcome fields", () => {
    expect(
      offerUpdateSchema.parse({
        redeemed: true,
        content_committed: true,
        content_url: "https://example.com/post",
        outcome: "Creator accepted"
      })
    ).toMatchObject({ redeemed: true, content_committed: true });
  });
});
