import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { creatorStatusUpdateError } from "@/lib/creator-qualification";
import { auditDashboardAction } from "@/lib/audit";
import { creatorUpdateSchema } from "@/lib/record-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Creator } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const payload = creatorUpdateSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db.from("creators").select("*").eq("id", id).single();
    if (fetchError) {
      throw fetchError;
    }

    const candidate = { ...before, ...payload } as Creator;
    const statusError = creatorStatusUpdateError(candidate, payload.status);
    if (statusError) {
      throw new Error(statusError);
    }

    const { data: after, error: updateError } = await db
      .from("creators")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (updateError) {
      throw updateError;
    }

    await auditDashboardAction({
      actorEmail: operator.email,
      actionType: "creator.update",
      targetTable: "creators",
      targetId: id,
      before,
      after
    });

    return Response.json({ creator: after });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
