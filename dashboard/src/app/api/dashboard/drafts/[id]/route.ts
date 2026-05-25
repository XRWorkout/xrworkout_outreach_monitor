import { NextRequest } from "next/server";
import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { auditDashboardAction } from "@/lib/audit";
import { assertDraftCanBeEdited, draftEditSchema } from "@/lib/draft-rules";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const operator = await requireOperator(request);
    const { id } = await context.params;
    const body = draftEditSchema.parse(await request.json());
    const db = supabaseAdmin();

    const { data: before, error: fetchError } = await db
      .from("drafts")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError) {
      throw fetchError;
    }
    assertDraftCanBeEdited(before);

    const updatePayload = {
      ...body,
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
      actionType: "draft.update",
      targetTable: "drafts",
      targetId: id,
      before,
      after
    });

    return Response.json({ draft: after });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
