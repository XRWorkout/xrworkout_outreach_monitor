import { authErrorResponse, requireOperator } from "@/lib/auth";
import { errorResponse } from "@/lib/api";
import { supabaseAdmin, tableCount } from "@/lib/supabase-admin";

type SourceQuality = {
  source: string;
  rawItems: number;
  opportunities: number;
  highPriority: number;
  averageScore: number;
  drafts: number;
  approvedOrSent: number;
};

type JoinedOpportunity =
  | { platform?: string | null; raw_items?: { source?: string | null } | Array<{ source?: string | null }> | null }
  | Array<{ platform?: string | null; raw_items?: { source?: string | null } | Array<{ source?: string | null }> | null }>
  | null
  | undefined;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function sourceForDraft(draft: { opportunities?: JoinedOpportunity }) {
  const opportunity = firstRelation(draft.opportunities);
  const rawItem = firstRelation(opportunity?.raw_items);
  return rawItem?.source || opportunity?.platform || "unknown";
}

function buildSourceQuality(
  rawRows: Array<{ source?: string | null }>,
  opportunityRows: Array<{ platform?: string | null; priority?: string | null; score?: number | null }>,
  draftRows: Array<{
    status?: string | null;
    opportunities?: JoinedOpportunity;
  }>
): SourceQuality[] {
  const sources = new Set<string>();
  const bySource = new Map<string, SourceQuality & { scoreTotal: number }>();

  function row(source: string) {
    sources.add(source);
    const existing = bySource.get(source);
    if (existing) return existing;
    const created = {
      source,
      rawItems: 0,
      opportunities: 0,
      highPriority: 0,
      averageScore: 0,
      drafts: 0,
      approvedOrSent: 0,
      scoreTotal: 0
    };
    bySource.set(source, created);
    return created;
  }

  rawRows.forEach((raw) => {
    row(raw.source || "unknown").rawItems += 1;
  });
  opportunityRows.forEach((opportunity) => {
    const current = row(opportunity.platform || "unknown");
    current.opportunities += 1;
    current.scoreTotal += Number(opportunity.score || 0);
    if (opportunity.priority === "high") current.highPriority += 1;
  });
  draftRows.forEach((draft) => {
    const current = row(sourceForDraft(draft));
    current.drafts += 1;
    if (draft.status === "approved" || draft.status === "sent") current.approvedOrSent += 1;
  });

  return Array.from(sources)
    .map((source) => {
      const current = bySource.get(source)!;
      return {
        source,
        rawItems: current.rawItems,
        opportunities: current.opportunities,
        highPriority: current.highPriority,
        averageScore: current.opportunities ? Math.round((current.scoreTotal / current.opportunities) * 10) / 10 : 0,
        drafts: current.drafts,
        approvedOrSent: current.approvedOrSent
      };
    })
    .sort((a, b) =>
      b.highPriority - a.highPriority ||
      b.averageScore - a.averageScore ||
      b.drafts - a.drafts ||
      b.rawItems - a.rawItems
    );
}

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

    const [{ data: rawRows }, { data: opportunityRows }, { data: draftRows }, { data: followupRows }, { data: creatorRows }] =
      await Promise.all([
        db
          .from("raw_items")
          .select("id, source, source_url, external_id, author_name, author_url, title, body, follower_count, published_at, collected_at, processed_at, raw_json")
          .order("collected_at", { ascending: false })
          .limit(1000),
        db.from("opportunities").select("priority, status, platform, score").order("created_at", { ascending: false }).limit(1000),
        db.from("drafts").select("status, channel, opportunities(platform, raw_items(source))").order("created_at", { ascending: false }).limit(1000),
        db.from("followups").select("status, due_date").order("due_date", { ascending: true }).limit(1000),
        db.from("creators").select("status, public_contact").order("created_at", { ascending: false }).limit(1000)
      ]);
    const safeRawRows = rawRows || [];
    const safeOpportunityRows = opportunityRows || [];
    const safeDraftRows = draftRows || [];
    const safeFollowupRows = followupRows || [];
    const safeCreatorRows = creatorRows || [];
    const today = new Date().toISOString().slice(0, 10);

    return Response.json({
      counts: { rawItems, opportunities, creators, drafts, followups, offers },
      rawItems: safeRawRows,
      opportunities: safeOpportunityRows,
      drafts: safeDraftRows,
      followups: safeFollowupRows,
      creators: safeCreatorRows,
      sourceQuality: buildSourceQuality(safeRawRows, safeOpportunityRows, safeDraftRows),
      actionQueue: {
        highPriorityOpportunities: safeOpportunityRows.filter((row) => row.priority === "high").length,
        draftsNeedingReview: safeDraftRows.filter((row) => row.status === "needs_review").length,
        approvedDrafts: safeDraftRows.filter((row) => row.status === "approved").length,
        sentDrafts: safeDraftRows.filter((row) => row.status === "sent").length,
        rejectedDrafts: safeDraftRows.filter((row) => row.status === "rejected").length,
        creatorsMissingContact: safeCreatorRows.filter((row) => !row.public_contact).length,
        creatorsContactReady: safeCreatorRows.filter((row) => row.status === "contact_ready").length,
        dueFollowups: safeFollowupRows.filter((row) => row.status === "pending" && row.due_date <= today).length
      }
    });
  } catch (error) {
    return authErrorResponse(error) || errorResponse(error);
  }
}
