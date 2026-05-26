import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { offerUpdateSchema } from "@/lib/record-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const payload = offerUpdateSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db.from("offers").select("*").eq("id", id).single();
    if (fetchError) {
      throw fetchError;
    }

    const { data: after, error: updateError } = await db
      .from("offers")
      .update(payload)
      .eq("id", id)
      .select("*, creators(*)")
      .single();
    if (updateError) {
      throw updateError;
    }

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "offer.update",
      targetTable: "offers",
      targetId: id,
      before,
      after
    });

    return Response.json({ offer: after });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
