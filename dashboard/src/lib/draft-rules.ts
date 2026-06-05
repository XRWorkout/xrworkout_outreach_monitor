import { z } from "zod";

export const draftStatuses = ["needs_review", "approved", "sent", "rejected", "edit_needed"] as const;
export type DraftStatus = (typeof draftStatuses)[number];

export type DraftRecord = {
  id: string;
  channel: string;
  status: DraftStatus | string;
  subject?: string | null;
  body?: string | null;
};

export const draftEditSchema = z
  .object({
    subject: z.string().trim().max(300).nullable().optional(),
    body: z.string().trim().min(1).max(12000).optional()
  })
  .strict();

export const draftStatusSchema = z
  .object({
    status: z.enum(["needs_review", "approved", "rejected", "edit_needed"]),
    runSendWorkflow: z.boolean().optional().default(false)
  })
  .strict();

export function assertDraftCanBeEdited(draft: DraftRecord): void {
  if (draft.status === "sent") {
    throw new Error("Sent drafts cannot be edited from the dashboard.");
  }
}

export function assertDraftStatusChangeAllowed(draft: DraftRecord): void {
  assertDraftCanBeEdited(draft);
}

export function assertDryRunSendDispatchAllowed(dryRunSend: string): void {
  if ((dryRunSend || "true") !== "true") {
    throw new Error("Approve + run send is dry-run only. Set DRY_RUN_SEND=true before using this dashboard action.");
  }
}

export function assertDraftSendWorkflowAllowed(draft: DraftRecord, nextStatus: DraftStatus, dryRunSend: string): void {
  if (nextStatus !== "approved") {
    throw new Error("Only approved email drafts can run the send workflow.");
  }
  if (draft.channel !== "email") {
    throw new Error("Only email drafts can run the send workflow.");
  }
  assertDryRunSendDispatchAllowed(dryRunSend);
}
