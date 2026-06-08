import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { getAutomationVariable, getWorkflowRunDetail, getWorkflowStatus } from "@/lib/github";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const [
      automationEnabled,
      sendAutomationEnabled,
      dryRunSend,
      apifyEnabled,
      collection,
      sourceCollection,
      drafts,
      manualDraft,
      send,
      report,
      cleanStart
    ] = await Promise.all([
      getAutomationVariable("AUTOMATION_ENABLED"),
      getAutomationVariable("SEND_AUTOMATION_ENABLED"),
      getAutomationVariable("DRY_RUN_SEND"),
      getAutomationVariable("APIFY_ENABLED"),
      getWorkflowStatus("collection"),
      getWorkflowStatus("sourceCollection"),
      getWorkflowStatus("drafts"),
      getWorkflowStatus("manualDraft"),
      getWorkflowStatus("send"),
      getWorkflowStatus("report"),
      getWorkflowStatus("cleanStart")
    ]);

    const workflows = { collection, sourceCollection, drafts, manualDraft, send, report, cleanStart };
    const runDetailEntries = await Promise.all(
      Object.entries(workflows).map(async ([workflow, run]) => {
        if (!run?.id) return [workflow, null] as const;
        return [workflow, await getWorkflowRunDetail(workflow as keyof typeof workflows, run.id)] as const;
      })
    );

    return Response.json({
      variables: {
        AUTOMATION_ENABLED: automationEnabled || "false",
        SEND_AUTOMATION_ENABLED: sendAutomationEnabled || "false",
        DRY_RUN_SEND: dryRunSend || "true",
        APIFY_ENABLED: apifyEnabled || "false"
      },
      workflows,
      runDetails: Object.fromEntries(runDetailEntries)
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
