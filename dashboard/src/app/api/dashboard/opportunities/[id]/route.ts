import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { opportunityStatusSchema } from "@/lib/record-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const payload = opportunityStatusSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db.from("opportunities").select("*").eq("id", id).single();
    if (fetchError) {
      throw fetchError;
    }

    const { data: after, error: updateError } = await db
      .from("opportunities")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*, raw_items(*)")
      .single();
    if (updateError) {
      throw updateError;
    }

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "opportunity.update",
      targetTable: "opportunities",
      targetId: id,
      before,
      after
    });

    return Response.json({ opportunity: after });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
