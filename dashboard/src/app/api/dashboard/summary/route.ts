import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin, tableCount } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    await requireOperator(request);
    const db = supabaseAdmin();
    const [rawItems, opportunities, creators, drafts, followups, offers] = await Promise.all([
      tableCount("raw_items"),
      tableCount("opportunities"),
      tableCount("creators"),
      tableCount("drafts"),
      tableCount("followups"),
      tableCount("offers")
    ]);

    const [{ data: rawRows }, { data: opportunityRows }, { data: draftRows }, { data: followupRows }] =
      await Promise.all([
        db.from("raw_items").select("source, processed_at").order("collected_at", { ascending: false }).limit(1000),
        db.from("opportunities").select("priority, status, platform").order("created_at", { ascending: false }).limit(1000),
        db.from("drafts").select("status, channel").order("created_at", { ascending: false }).limit(1000),
        db.from("followups").select("status, due_date").order("due_date", { ascending: true }).limit(1000)
      ]);

    return Response.json({
      counts: { rawItems, opportunities, creators, drafts, followups, offers },
      rawItems: rawRows || [],
      opportunities: opportunityRows || [],
      drafts: draftRows || [],
      followups: followupRows || []
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
