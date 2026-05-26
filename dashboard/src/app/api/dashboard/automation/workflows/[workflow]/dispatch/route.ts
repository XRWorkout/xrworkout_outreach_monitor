import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { assertDryRunSendDispatchAllowed } from "@/lib/draft-rules";
import { assertWorkflowKey, dispatchWorkflow, getAutomationVariable, workflowFiles } from "@/lib/github";

type RouteContext = {
  params: Promise<{ workflow: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { workflow } = await context.params;
    assertWorkflowKey(workflow);
    if (workflow === "send") {
      const dryRunSend = await getAutomationVariable("DRY_RUN_SEND");
      assertDryRunSendDispatchAllowed(dryRunSend);
    }
    await dispatchWorkflow(workflow);
    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "workflow.dispatch",
      targetTable: "github_workflows",
      targetId: workflowFiles[workflow],
      before: null,
      after: { workflow, file: workflowFiles[workflow] }
    });
    return Response.json({ workflow, dispatched: true });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
