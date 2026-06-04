import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { dispatchWorkflow, getAutomationVariable, setAutomationVariable, workflowFiles } from "@/lib/github";

const safetyVariables = {
  AUTOMATION_ENABLED: "true",
  SEND_AUTOMATION_ENABLED: "false",
  DRY_RUN_SEND: "true"
} as const;

export async function POST(request: Request) {
  try {
    const operator = await requireOperator(request);
    const before = {
      AUTOMATION_ENABLED: await getAutomationVariable("AUTOMATION_ENABLED"),
      SEND_AUTOMATION_ENABLED: await getAutomationVariable("SEND_AUTOMATION_ENABLED"),
      DRY_RUN_SEND: await getAutomationVariable("DRY_RUN_SEND")
    };

    await setAutomationVariable("SEND_AUTOMATION_ENABLED", safetyVariables.SEND_AUTOMATION_ENABLED);
    await setAutomationVariable("DRY_RUN_SEND", safetyVariables.DRY_RUN_SEND);
    await setAutomationVariable("AUTOMATION_ENABLED", safetyVariables.AUTOMATION_ENABLED);
    await dispatchWorkflow("cleanStart");

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "automation.clean_start",
      targetTable: "github_workflows",
      targetId: workflowFiles.cleanStart,
      before,
      after: {
        variables: safetyVariables,
        workflow: "cleanStart",
        file: workflowFiles.cleanStart,
        deletes: ["followups", "offers", "drafts", "opportunities", "creators", "raw_items"],
        sendsRemainDisabled: true
      }
    });

    return Response.json({
      dispatched: true,
      workflow: "cleanStart",
      file: workflowFiles.cleanStart,
      variables: safetyVariables
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
