import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const { data, error } = await supabaseAdmin()
      .from("followups")
      .select("*, drafts(*)")
      .order("due_date", { ascending: true })
      .limit(200);

    if (error) {
      throw error;
    }
    return Response.json({ followups: data || [] });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
