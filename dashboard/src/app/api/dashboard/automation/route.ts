import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getAutomationVariable, getWorkflowStatus } from "@/lib/github";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const [
      automationEnabled,
      sendAutomationEnabled,
      dryRunSend,
      collection,
      drafts,
      manualDraft,
      send,
      report,
      cleanStart
    ] = await Promise.all([
      getAutomationVariable("AUTOMATION_ENABLED"),
      getAutomationVariable("SEND_AUTOMATION_ENABLED"),
      getAutomationVariable("DRY_RUN_SEND"),
      getWorkflowStatus("collection"),
      getWorkflowStatus("drafts"),
      getWorkflowStatus("manualDraft"),
      getWorkflowStatus("send"),
      getWorkflowStatus("report"),
      getWorkflowStatus("cleanStart")
    ]);

    return Response.json({
      variables: {
        AUTOMATION_ENABLED: automationEnabled || "false",
        SEND_AUTOMATION_ENABLED: sendAutomationEnabled || "false",
        DRY_RUN_SEND: dryRunSend || "true"
      },
      workflows: { collection, drafts, manualDraft, send, report, cleanStart }
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
