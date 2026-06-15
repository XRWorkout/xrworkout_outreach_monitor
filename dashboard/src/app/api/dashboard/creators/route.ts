import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CreatorRow = {
  id?: string;
  platform?: string | null;
  profile_url?: string | null;
  creator_quality_score?: number | null;
  recent_vr_posts_count?: number | null;
  recent_total_posts_count?: number | null;
  evidence_json?: Record<string, unknown> | null;
  created_at?: string | null;
  duplicate_row_count?: number | null;
};

export function normalizedCreatorKey(row: CreatorRow) {
  return `${(row.platform || "").toLowerCase().replace(/[-\s]+/g, "_")}:${(row.profile_url || "").toLowerCase().replace(/\/$/, "")}`;
}

export function evidenceRank(row: CreatorRow) {
  const quality = row.evidence_json?.computed_evidence_quality;
  const qualityScore =
    quality === "profile_history" || quality === "profile_history_plus_observed"
      ? 50
      : quality === "accumulated_observed_posts"
        ? 40
        : quality === "observed_post" || quality === "conversation_author"
          ? 20
          : 0;
  return (
    (row.recent_vr_posts_count || 0) * 1000 +
    (row.recent_total_posts_count || 0) * 20 +
    qualityScore +
    (row.creator_quality_score || 0)
  );
}

export function dedupeCreators(rows: CreatorRow[]) {
  const groups = new Map<string, CreatorRow[]>();
  for (const row of rows) {
    const key = normalizedCreatorKey(row);
    const groupKey = !row.profile_url || key === ":" ? row.id || `${key}:${groups.size}` : key;
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
  }

  return Array.from(groups.values())
    .map((group) => {
      const strongest = group.reduce((best, row) => (evidenceRank(row) > evidenceRank(best) ? row : best), group[0]);
      return { ...strongest, duplicate_row_count: group.length };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime(),
    );
}

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
    return Response.json({
      creators: dedupeCreators((data || []) as CreatorRow[]),
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
