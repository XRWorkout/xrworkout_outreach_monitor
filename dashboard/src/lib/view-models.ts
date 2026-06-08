import { dayKey, isToday, platformLabel, scoreLabel } from "@/lib/presentation";
import type { AutomationData, Creator, Draft, Followup, Opportunity, RawItem, SummaryData } from "@/lib/types";

export type Recommendation = {
  id: string;
  title: string;
  rationale: string;
  confidence: number;
  action: string;
  kind: "opportunity" | "creator" | "draft" | "followup";
  targetId?: string;
};

export function priorityCounts(opportunities: Opportunity[]) {
  return {
    high: opportunities.filter((row) => row.priority === "high").length,
    medium: opportunities.filter((row) => row.priority === "medium").length,
    low: opportunities.filter((row) => row.priority === "low").length
  };
}

export function buildKpis(summary: SummaryData | null, creators: Creator[], drafts: Draft[], offersCount: number) {
  const rawToday = summary?.rawItems.filter((row) => isToday(row.collected_at)).length || 0;
  const creatorsToday = creators.filter((row) => isToday(row.created_at)).length;
  const outreachSent = drafts.filter((row) => row.status === "sent").length;
  const responses = drafts.filter((row) => Boolean(row.response_status)).length;
  const activePartnerships = offersCount + creators.filter((row) => ["partnered", "converted"].includes(row.status)).length;

  return [
    { label: "Conversations Detected Today", value: rawToday, detail: "Fresh social signals" },
    { label: "New Creators Found", value: creatorsToday, detail: "Added today" },
    { label: "Outreach Sent", value: outreachSent, detail: "Approved emails sent" },
    { label: "Responses Received", value: responses, detail: "Tracked replies" },
    { label: "Active Partnerships", value: activePartnerships, detail: "Offers or conversions" }
  ];
}

export function buildOpportunityFeed(opportunities: Opportunity[], drafts: Draft[], rawItems: RawItem[]) {
  const opportunityItems = opportunities.slice(0, 8).map((opportunity) => ({
    id: opportunity.id,
    title: `${platformLabel(opportunity.platform)} opportunity detected`,
    source: opportunity.platform,
    timestamp: opportunity.created_at,
    score: opportunity.score,
    action: opportunity.recommended_action,
    detail: opportunity.summary || opportunity.pain_point || "Review this opportunity."
  }));
  const draftItems = drafts.slice(0, 4).map((draft) => ({
    id: draft.id,
    title: draft.status === "sent" ? "Creator outreach sent" : "Draft ready for review",
    source: draft.opportunities?.platform || draft.channel,
    timestamp: draft.updated_at || draft.created_at,
    score: draft.opportunities?.score || 0,
    action: draft.status === "needs_review" ? "Review draft" : "Inspect history",
    detail: draft.subject || draft.body.slice(0, 100)
  }));
  const rawFallback = rawItems.slice(0, 4).map((raw) => ({
    id: raw.id,
    title: `${platformLabel(raw.source)} discussion detected`,
    source: raw.source,
    timestamp: raw.collected_at || raw.published_at || "",
    score: raw.processed_at ? 35 : 12,
    action: raw.processed_at ? "Review context" : "Await classification",
    detail: raw.title || raw.body || "Collected source item."
  }));
  return [...opportunityItems, ...draftItems, ...rawFallback]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
    .slice(0, 10);
}

export function buildRecommendations(opportunities: Opportunity[], creators: Creator[], drafts: Draft[], followups: Followup[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  opportunities
    .filter((row) => row.priority === "high" && row.status === "new")
    .slice(0, 3)
    .forEach((row) =>
      recommendations.push({
        id: `opportunity-${row.id}`,
        title: row.recommended_action?.toLowerCase().includes("dm") ? "DM this creator" : "Act on high-priority signal",
        rationale: row.summary || row.xrworkout_relevance || "High-priority opportunity has not been reviewed yet.",
        confidence: Math.max(62, row.score),
        action: "Review opportunity",
        kind: "opportunity",
        targetId: row.id
      })
    );
  creators
    .filter((row) => row.priority === "high" || row.status === "contact_ready")
    .slice(0, 2)
    .forEach((row) =>
      recommendations.push({
        id: `creator-${row.id}`,
        title: row.public_contact ? "Prepare creator outreach" : "Validate creator contact",
        rationale: row.fit_reason || row.offer_angle || "Creator profile looks relevant for XRWorkout outreach.",
        confidence: row.priority === "high" ? 82 : 68,
        action: "Open creator",
        kind: "creator",
        targetId: row.id
      })
    );
  drafts
    .filter((row) => row.status === "needs_review")
    .slice(0, 2)
    .forEach((row) =>
      recommendations.push({
        id: `draft-${row.id}`,
        title: row.channel === "email" ? "Approve or reject email draft" : "Review manual message",
        rationale: row.opportunities?.summary || row.subject || "Draft needs a human decision before use.",
        confidence: row.opportunities?.score || 70,
        action: "Review draft",
        kind: "draft",
        targetId: row.id
      })
    );
  followups
    .filter((row) => row.status === "pending" && row.due_date <= new Date().toISOString().slice(0, 10))
    .slice(0, 2)
    .forEach((row) =>
      recommendations.push({
        id: `followup-${row.id}`,
        title: "Send follow-up email",
        rationale: "A pending follow-up is due now or overdue.",
        confidence: 74,
        action: "Open follow-up",
        kind: "followup",
        targetId: row.id
      })
    );
  return recommendations.slice(0, 6);
}

export function conversationsByDay(rawItems: RawItem[]) {
  const counts = new Map<string, number>();
  rawItems.forEach((row) => {
    const key = dayKey(row.collected_at || row.published_at);
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([name, value]) => ({ name: name.slice(5), value }));
}

export function outreachByDay(drafts: Draft[]) {
  const counts = new Map<string, number>();
  drafts
    .filter((row) => row.status === "sent" || row.status === "approved")
    .forEach((row) => {
      const key = dayKey(row.sent_at || row.updated_at || row.created_at);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([name, value]) => ({ name: name.slice(5), value }));
}

export function funnelData(summary: SummaryData | null, opportunities: Opportunity[], creators: Creator[], drafts: Draft[]) {
  const detected = summary?.counts.rawItems || 0;
  const qualified = opportunities.filter((row) => row.priority === "high" || row.priority === "medium").length;
  const contacted = creators.filter((row) => ["contacted", "contact_ready"].includes(row.status)).length + drafts.filter((row) => row.status === "sent").length;
  const responded = drafts.filter((row) => Boolean(row.response_status)).length;
  const partnered = creators.filter((row) => ["partnered", "converted"].includes(row.status)).length;
  return [
    { name: "Detected", value: detected },
    { name: "Qualified", value: qualified },
    { name: "Contacted", value: contacted },
    { name: "Responded", value: responded },
    { name: "Partnered", value: partnered }
  ];
}

export function platformNodes(summary: SummaryData | null, creators: Creator[]) {
  const configured = ["reddit", "discord", "x", "youtube", "tiktok", "instagram", "facebook_group", "vr_forum", "vr_blog"];
  const sourceQuality = new Map((summary?.sourceQuality || []).map((row) => [row.source.toLowerCase(), row]));
  return configured.map((source, index) => {
    const quality = sourceQuality.get(source) || sourceQuality.get(source === "twitter" ? "x" : source);
    const creatorDensity = creators.filter((creator) => {
      const platform = creator.platform.toLowerCase();
      if (source === "x") return platform === "x" || platform === "twitter" || platform === "apify_x";
      return platform === source;
    }).length;
    return {
      id: source,
      label: platformLabel(source),
      live: Boolean(quality?.rawItems || creatorDensity),
      volume: quality?.rawItems || 0,
      opportunities: quality?.opportunities || 0,
      relevance: quality?.averageScore || 0,
      creators: creatorDensity,
      angle: (index / configured.length) * Math.PI * 2
    };
  });
}

export function scoreText(score?: number | null) {
  return scoreLabel(score);
}

export function workflowAgents(summary: SummaryData | null, automation: AutomationData | null) {
  return [
    {
      name: "Discovery Agent",
      description: "Finds conversations",
      status: automation?.workflows.collection?.conclusion || automation?.workflows.collection?.status || "idle",
      lastRun: automation?.workflows.collection?.created_at,
      completed: summary?.counts.rawItems || 0,
      found: summary?.counts.opportunities || 0
    },
    {
      name: "Creator Agent",
      description: "Identifies creators",
      status: automation?.workflows.collection?.conclusion || automation?.workflows.collection?.status || "idle",
      lastRun: automation?.workflows.collection?.created_at,
      completed: summary?.counts.creators || 0,
      found: summary?.actionQueue.creatorsContactReady || 0
    },
    {
      name: "Outreach Agent",
      description: "Generates drafts",
      status: automation?.workflows.drafts?.conclusion || automation?.workflows.drafts?.status || "idle",
      lastRun: automation?.workflows.drafts?.created_at,
      completed: summary?.counts.drafts || 0,
      found: summary?.actionQueue.draftsNeedingReview || 0
    },
    {
      name: "Analytics Agent",
      description: "Measures outcomes",
      status: automation?.workflows.report?.conclusion || automation?.workflows.report?.status || "idle",
      lastRun: automation?.workflows.report?.created_at,
      completed: summary?.sourceQuality.length || 0,
      found: summary?.actionQueue.sentDrafts || 0
    }
  ];
}
