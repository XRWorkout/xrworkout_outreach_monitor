import { describe, expect, it } from "vitest";
import {
  assertDraftCanBeEdited,
  assertDraftStatusChangeAllowed,
  draftEditSchema,
  type DraftRecord
} from "@/lib/draft-rules";

const draft = (overrides: Partial<DraftRecord> = {}): DraftRecord => ({
  id: "draft-1",
  channel: "email",
  status: "needs_review",
  subject: "Hello",
  body: "Body",
  ...overrides
});

describe("draft edit validation", () => {
  it("accepts subject and body updates", () => {
    expect(draftEditSchema.parse({ subject: "New", body: "Useful body" })).toEqual({
      subject: "New",
      body: "Useful body"
    });
  });

  it("rejects empty body updates", () => {
    expect(() => draftEditSchema.parse({ body: "" })).toThrow();
  });

  it("blocks sent draft edits", () => {
    expect(() => assertDraftCanBeEdited(draft({ status: "sent" }))).toThrow("Sent drafts cannot be edited");
  });
});

describe("draft status transitions", () => {
  it("allows approving email drafts", () => {
    expect(() => assertDraftStatusChangeAllowed(draft(), "approved")).not.toThrow();
  });

  it("blocks approving non-email drafts", () => {
    expect(() => assertDraftStatusChangeAllowed(draft({ channel: "reddit" }), "approved")).toThrow("Only email drafts");
  });

  it("blocks sent draft status changes", () => {
    expect(() => assertDraftStatusChangeAllowed(draft({ status: "sent" }), "rejected")).toThrow("Sent drafts cannot");
  });
});
