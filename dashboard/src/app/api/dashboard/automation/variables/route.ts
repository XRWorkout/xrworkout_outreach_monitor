import { NextRequest } from "next/server";
import { z } from "zod";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { getAutomationVariable, setAutomationVariable } from "@/lib/github";

const schema = z.object({
  name: z.enum(["AUTOMATION_ENABLED", "DRY_RUN_SEND"]),
  value: z.enum(["true", "false"])
});

export async function PATCH(request: NextRequest) {
  try {
    const operator = await requireOperator(request);
    const payload = schema.parse(await request.json());
    const before = await getAutomationVariable(payload.name);
    await setAutomationVariable(payload.name, payload.value);
    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "automation.variable",
      targetTable: "github_variables",
      targetId: payload.name,
      before: { value: before || "" },
      after: { value: payload.value }
    });
    return Response.json({ name: payload.name, value: payload.value });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
