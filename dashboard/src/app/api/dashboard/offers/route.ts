import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const { data, error } = await supabaseAdmin()
      .from("offers")
      .select("*, creators(*)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }
    return Response.json({ offers: data || [] });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
