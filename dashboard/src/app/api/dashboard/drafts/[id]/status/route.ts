import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { dispatchWorkflow, getAutomationVariable } from "@/lib/github";
import { assertDraftSendWorkflowAllowed, assertDraftStatusChangeAllowed, draftStatusSchema } from "@/lib/draft-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const payload = draftStatusSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db
      .from("drafts")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError) {
      throw fetchError;
    }
    assertDraftStatusChangeAllowed(before);
    if (payload.runSendWorkflow) {
      const dryRunSend = await getAutomationVariable("DRY_RUN_SEND");
      assertDraftSendWorkflowAllowed(before, payload.status, dryRunSend);
    }

    const updatePayload = {
      status: payload.status,
      approved_by: payload.status === "approved" ? operator.email : before.approved_by,
      updated_at: new Date().toISOString()
    };

    const { data: after, error: updateError } = await db
      .from("drafts")
      .update(updatePayload)
      .eq("id", id)
      .select("*, creators(*), opportunities(*)")
      .single();
    if (updateError) {
      throw updateError;
    }

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "draft.status",
      targetTable: "drafts",
      targetId: id,
      before,
      after
    });

    if (payload.status === "approved" && payload.runSendWorkflow) {
      await dispatchWorkflow("send");
      await auditDashboardAction({
        actorEmail: operator.email,
        actionType: "workflow.dispatch",
        targetTable: "github_workflows",
        targetId: "daily-send.yml",
        before: null,
        after: { workflow: "send", draftId: id }
      });
    }

    return Response.json({ draft: after, sendWorkflowDispatched: payload.status === "approved" && payload.runSendWorkflow });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
