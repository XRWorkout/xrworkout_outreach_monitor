import { describe, expect, it } from "vitest";
import {
  assertDraftCanBeEdited,
  assertDraftSendWorkflowAllowed,
  assertDraftStatusChangeAllowed,
  assertDryRunSendDispatchAllowed,
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
    expect(() => assertDraftStatusChangeAllowed(draft())).not.toThrow();
  });

  it("allows approving non-email drafts for manual use", () => {
    expect(() => assertDraftStatusChangeAllowed(draft({ channel: "comment" }))).not.toThrow();
    expect(() => assertDraftStatusChangeAllowed(draft({ channel: "dm" }))).not.toThrow();
  });

  it("blocks sent draft status changes", () => {
    expect(() => assertDraftStatusChangeAllowed(draft({ status: "sent" }))).toThrow("Sent drafts cannot");
  });

  it("allows send workflow dispatch only when dry-run sending is active", () => {
    expect(() => assertDryRunSendDispatchAllowed("true")).not.toThrow();
    expect(() => assertDryRunSendDispatchAllowed("false")).toThrow("dry-run only");
  });

  it("allows send workflow dispatch only for approved email drafts", () => {
    expect(() => assertDraftSendWorkflowAllowed(draft(), "approved", "true")).not.toThrow();
    expect(() => assertDraftSendWorkflowAllowed(draft({ channel: "comment" }), "approved", "true")).toThrow("Only email drafts");
    expect(() => assertDraftSendWorkflowAllowed(draft(), "rejected", "true")).toThrow("Only approved email drafts");
    expect(() => assertDraftSendWorkflowAllowed(draft(), "approved", "false")).toThrow("dry-run only");
  });
});
