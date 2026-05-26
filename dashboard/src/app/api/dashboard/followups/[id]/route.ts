import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { followupUpdateSchema } from "@/lib/record-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const payload = followupUpdateSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db.from("followups").select("*").eq("id", id).single();
    if (fetchError) {
      throw fetchError;
    }

    const { data: after, error: updateError } = await db
      .from("followups")
      .update(payload)
      .eq("id", id)
      .select("*, drafts(*, creators(*), opportunities(*))")
      .single();
    if (updateError) {
      throw updateError;
    }

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "followup.update",
      targetTable: "followups",
      targetId: id,
      before,
      after
    });

    return Response.json({ followup: after });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
