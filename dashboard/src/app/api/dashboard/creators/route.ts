import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const { data, error } = await supabaseAdmin()
      .from("creators")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      throw error;
    }
    return Response.json({ creators: data || [] });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
