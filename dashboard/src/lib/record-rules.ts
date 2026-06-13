import { z } from "zod";

export const opportunityStatusSchema = z
  .object({
    status: z.enum(["new", "reviewed", "monitor", "contacted", "rejected"])
  })
  .strict();

export const creatorUpdateSchema = z
  .object({
    status: z.enum(["new", "reviewed", "qualified", "contact_ready", "contacted", "rejected"]).optional(),
    public_contact: z.string().trim().max(300).nullable().optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    fit_reason: z.string().trim().max(4000).nullable().optional(),
    offer_angle: z.string().trim().max(4000).nullable().optional()
  })
  .strict();

export const followupUpdateSchema = z
  .object({
    status: z.enum(["pending", "completed", "skipped"]),
    draft_body: z.string().trim().max(12000).nullable().optional()
  })
  .strict();

export const offerUpdateSchema = z
  .object({
    offer_type: z.string().trim().min(1).max(200).optional(),
    code_or_link: z.string().trim().max(1000).nullable().optional(),
    sent_at: z.string().trim().max(80).nullable().optional(),
    redeemed: z.boolean().optional(),
    content_committed: z.boolean().optional(),
    content_url: z.string().trim().max(1000).nullable().optional(),
    outcome: z.string().trim().max(4000).nullable().optional()
  })
  .strict();

export type FollowupStatus = z.infer<typeof followupUpdateSchema>["status"];
