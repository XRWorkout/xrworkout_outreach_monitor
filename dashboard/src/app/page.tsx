"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FileDown,
  Filter,
  LayoutDashboard,
  LogOut,
  MailCheck,
  Minimize2,
  MessageSquare,
  Network,
  Play,
  Radar,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
  XCircle
} from "lucide-react";
import { type DragEvent, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AreaSummary, BarSummary } from "@/components/Charts";
import { Button, Card, EmptyState, Field, Select, SoftBadge, TextArea, TextInput } from "@/components/ui";
import { clientSupabase, hasClientSupabaseConfig } from "@/lib/client-supabase";
import { cn } from "@/lib/utils";
import { labelFor, percentage, platformLabel, shortDate, toneFor } from "@/lib/presentation";
import { activityMetricLabel, activityMetricValue, hasComputedActivityEvidence, qualificationDecision, qualificationSummary } from "@/lib/creator-qualification";
import {
  buildKpis,
  buildOpportunityFeed,
  buildRecommendations,
  conversationsByDay,
  funnelData,
  outreachByDay,
  platformNodes,
  priorityCounts,
  scoreText,
  workflowAgents,
  type Recommendation
} from "@/lib/view-models";
import type { AutomationData, Creator, Draft, Followup, Offer, Opportunity, RawItem, SummaryData, WorkflowRunDetail } from "@/lib/types";

type SessionState = {
  token: string;
  email: string;
};

type DashboardData = {
  summary: SummaryData | null;
  opportunities: Opportunity[];
  drafts: Draft[];
  creators: Creator[];
  followups: Followup[];
  offers: Offer[];
  automation: AutomationData | null;
};

type View = "dashboard" | "conversations" | "map" | "creators" | "outreach" | "export" | "automations" | "runMonitor" | "analytics" | "settings";
export type ExportFormat = "csv" | "json" | "txt";

const emptyData: DashboardData = {
  summary: null,
  opportunities: [],
  drafts: [],
  creators: [],
  followups: [],
  offers: [],
  automation: null
};

const navigation: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={17} /> },
  { id: "conversations", label: "Conversations", icon: <MessageSquare size={17} /> },
  { id: "map", label: "Conversation Map", icon: <Network size={17} /> },
  { id: "creators", label: "Creators", icon: <Users size={17} /> },
  { id: "outreach", label: "Outreach", icon: <Send size={17} /> },
  { id: "export", label: "Export", icon: <FileDown size={17} /> },
  { id: "automations", label: "Automations", icon: <Bot size={17} /> },
  { id: "runMonitor", label: "Run Monitor", icon: <CircleDot size={17} /> },
  { id: "analytics", label: "Analytics", icon: <BarChart3 size={17} /> },
  { id: "settings", label: "Settings", icon: <Settings size={17} /> }
];

const opportunityStatuses = ["new", "reviewed", "monitor", "contacted", "rejected"] as const;
const creatorStatuses = ["new", "reviewed", "qualified", "contact_ready", "contacted", "rejected"] as const;
const priorities = ["high", "medium", "low"] as const;
const followupStatuses = ["pending", "completed", "skipped"] as const;
const followerRanges = [
  { value: "all", label: "Any Followers" },
  { value: "0-1000", label: "Under 1K" },
  { value: "1000-10000", label: "1K - 10K" },
  { value: "10000-50000", label: "10K - 50K" },
  { value: "50000-100000", label: "50K - 100K" },
  { value: "100000+", label: "100K+" },
  { value: "unknown", label: "Unknown" }
] as const;
const scoreBands = [
  { value: "all", label: "Any Score" },
  { value: "a", label: "A / 85+" },
  { value: "b", label: "B / 70-84" },
  { value: "c", label: "C / 50-69" },
  { value: "reject", label: "Under 50" },
  { value: "unknown", label: "Unknown" }
] as const;
const activityLevels = [
  { value: "all", label: "Any Activity" },
  { value: "high", label: "High Activity" },
  { value: "medium", label: "Medium Activity" },
  { value: "low", label: "Low Activity" },
  { value: "unknown", label: "Unknown Activity" }
] as const;
const headsetConfidenceLevels = [
  { value: "all", label: "Any Headset Signal" },
  { value: "high", label: "High Headset Confidence" },
  { value: "medium", label: "Medium Headset Confidence" },
  { value: "low", label: "Low Headset Confidence" },
  { value: "unknown", label: "Unknown Headset" }
] as const;
const contactabilityFilters = [
  { value: "all", label: "Any Contact" },
  { value: "email", label: "Public Email" },
  { value: "manual", label: "Manual Path" },
  { value: "missing", label: "Missing Contact" }
] as const;
const sourceTypeFilters = [
  { value: "all", label: "Any Source Type" },
  { value: "social_post", label: "Posts" },
  { value: "forum_thread", label: "Threads" },
  { value: "blog_article", label: "Articles" },
  { value: "group_post", label: "Group Posts" },
  { value: "profile_lead", label: "Profile Leads" },
  { value: "server_discovery", label: "Servers" }
] as const;
const intentFilters = [
  { value: "all", label: "Any Intent" },
  { value: "recommendation_request", label: "Recommendation" },
  { value: "complaint", label: "Pain Point" },
  { value: "creator_opportunity", label: "Creator Prospect" },
  { value: "trend_news", label: "Trend / News" },
  { value: "partnership_lead", label: "Contact Lead" }
] as const;
const creatorBoardColumns = ["Review", "Qualified", "Contact Ready", "Contacted", "Rejected"] as const;

async function fetchJson<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || `Request failed: ${path}`);
  }
  return json as T;
}

function isDueOrOverdue(value?: string | null) {
  if (!value) return false;
  return value <= new Date().toISOString().slice(0, 10);
}

function trendFor(count: number, total: number) {
  const share = percentage(count, total);
  const delta = total ? Math.max(4, Math.round((count / total) * 24)) : 0;
  return { share, delta: `+${delta}%` };
}

function initials(name?: string | null) {
  return (name || "XR")
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function creatorStage(creator: Creator) {
  const decision = qualificationDecision(creator);
  if (creator.status === "contacted") return "Contacted";
  if (creator.status === "contact_ready" && decision.canContactReady) return "Contact Ready";
  if (creator.status === "qualified" && decision.canQualify) return "Qualified";
  if (creator.status === "rejected") return "Rejected";
  return "Review";
}

function creatorStatusLabel(creator: Creator) {
  const decision = qualificationDecision(creator);
  if (creator.status === "qualified" && !decision.canQualify) return "Review Required";
  if (creator.status === "contact_ready" && !decision.canContactReady) return "Review Required";
  return labelFor(creator.status);
}

function creatorStatusTone(creator: Creator) {
  const decision = qualificationDecision(creator);
  if (["qualified", "contact_ready"].includes(creator.status) && !decision.canQualify) return "warn" as const;
  if (creator.status === "contact_ready" && !decision.canContactReady) return "warn" as const;
  return toneFor(creator.status);
}

function responseRate(drafts: Draft[]) {
  const sent = drafts.filter((draft) => draft.status === "sent").length;
  const responses = drafts.filter((draft) => draft.response_status).length;
  return percentage(responses, sent);
}

function conversionRate(creators: Creator[]) {
  const converted = creators.filter((creator) => ["partnered", "converted"].includes(creator.status)).length;
  return percentage(converted, creators.length);
}

function parseFollowerCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase().replace(/,/g, "").trim();
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([kmb])?/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const multiplier = match[2] === "b" ? 1_000_000_000 : match[2] === "m" ? 1_000_000 : match[2] === "k" ? 1_000 : 1;
  return Math.round(amount * multiplier);
}

function firstFollowerCountFromObject(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const followerKeys = [
    "followers",
    "follower_count",
    "followers_count",
    "followerCount",
    "subscriber_count",
    "subscriberCount",
    "subscribers",
    "audience_estimate",
    "audienceEstimate"
  ];

  for (const key of followerKeys) {
    const count = parseFollowerCount(record[key]);
    if (count !== null) return count;
  }

  for (const nested of Object.values(record)) {
    const count = firstFollowerCountFromObject(nested);
    if (count !== null) return count;
  }

  return null;
}

function creatorFollowerCount(creator: Creator) {
  return creator.follower_count ?? null;
}

function conversationFollowerCount(item: RawItem, linkedOpportunity?: Opportunity) {
  return item.follower_count ?? linkedOpportunity?.raw_items?.follower_count ?? firstFollowerCountFromObject(item.raw_json) ?? firstFollowerCountFromObject(linkedOpportunity?.raw_items?.raw_json);
}

function followerRangeMatches(count: number | null, range: string) {
  if (range === "all") return true;
  if (range === "unknown") return count === null;
  if (count === null) return false;
  if (range.endsWith("+")) return count >= Number(range.slice(0, -1));
  const [min, max] = range.split("-").map(Number);
  return count >= min && count < max;
}

function followerCountLabel(count: number | null) {
  if (count === null) return "Followers unknown";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(count >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M followers`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(count >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K followers`;
  return `${count} followers`;
}

function scoreBandMatches(score: number | null | undefined, band: string) {
  if (band === "all") return true;
  if (band === "unknown") return score === null || score === undefined;
  if (score === null || score === undefined) return false;
  if (band === "a") return score >= 85;
  if (band === "b") return score >= 70 && score < 85;
  if (band === "c") return score >= 50 && score < 70;
  if (band === "reject") return score < 50;
  return true;
}

function contactabilityMatches(creator: Creator, filter: string) {
  if (filter === "all") return true;
  const contact = `${creator.public_contact || ""} ${creator.contactability_evidence || ""}`.toLowerCase();
  if (filter === "email") return contact.includes("@");
  if (filter === "manual") return !contact.includes("@") && Boolean(contact.trim());
  if (filter === "missing") return !contact.trim();
  return true;
}

function creatorFitBand(creator: Creator) {
  const score = creator.creator_quality_score;
  if (score === null || score === undefined) return { label: "Unscored", tone: "neutral" as const };
  if (score >= 85) return { label: "Strong VR/XR fit", tone: "good" as const };
  if (score >= 70) return { label: "Moderate fit", tone: "info" as const };
  if (score >= 50) return { label: "Weak/incidental fit", tone: "warn" as const };
  return { label: "Reject-level fit", tone: "bad" as const };
}

function creatorEvidenceQuality(creator: Creator) {
  const value = creator.evidence_json?.computed_evidence_quality;
  if (value === "profile_history") return "Full profile history";
  if (value === "profile_history_plus_observed") return "Profile history + observed posts";
  if (value === "accumulated_observed_posts") return "Accumulated observed posts";
  if (value === "observed_post") return "Single observed post";
  if (value === "partial_history") return "Partial profile evidence";
  if (value === "failed_enrichment") return "Enrichment failed";
  if (value === "conversation_author") return "Conversation author lead";
  if (value === "no_history") return "No post history captured";
  return typeof value === "string" && value.trim() ? labelFor(value) : "Evidence quality unknown";
}

function creatorEvidenceConfidence(creator: Creator) {
  const value = creator.evidence_json?.computed_evidence_confidence;
  return typeof value === "string" && value.trim() ? labelFor(value) : "Confidence unknown";
}

function numericEvidenceField(creator: Creator, key: string) {
  const value = creator.evidence_json?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function creatorRelevantPosts(creator: Creator) {
  const value = creator.evidence_json?.computed_recent_relevant_posts;
  return Array.isArray(value)
    ? value.filter((post): post is Record<string, unknown> => Boolean(post && typeof post === "object"))
    : [];
}

function stringField(value: Record<string, unknown> | undefined, key: string) {
  const field = value?.[key];
  return typeof field === "string" && field.trim() ? field.trim() : "";
}

function creatorLatestRelevantPost(creator: Creator) {
  return creatorRelevantPosts(creator)[0];
}

function creatorFitCategory(creator: Creator) {
  const decision = qualificationDecision(creator);
  const vrCount = creator.recent_vr_posts_count ?? 0;
  const movement = Boolean(creator.movement_fit_evidence?.trim());
  const quality = creator.evidence_json?.computed_evidence_quality;
  if (decision.canQualify) return "Qualified by profile history";
  if (decision.state === "observed_only") return "Observed-only review lead";
  if (decision.state === "unknown") return "Unknown evidence";
  if (vrCount >= 2 && movement) return "Review - recurring VR fitness evidence";
  if (vrCount >= 2) return "Review - recurring VR/XR evidence";
  if (vrCount === 1 && quality === "observed_post") return "Single-post review lead";
  if (vrCount === 1) return "Review - limited VR/XR evidence";
  return "Review - needs stronger VR/XR proof";
}

function strongestCreatorEvidence(creator: Creator) {
  const latestPost = creatorLatestRelevantPost(creator);
  return (
    stringField(latestPost, "evidence") ||
    creator.vr_involvement_evidence ||
    creator.movement_fit_evidence ||
    creator.headset_evidence ||
    creator.recent_relevant_content ||
    creator.fit_reason ||
    "No creator-specific evidence captured."
  );
}

function creatorInclusionReason(creator: Creator) {
  const vrCount = creator.recent_vr_posts_count ?? 0;
  const latest = creatorLatestRelevantPost(creator);
  const latestDate = stringField(latest, "published_at") || creator.last_post_at;
  const recent = latestDate ? `Most recent relevant post ${shortDate(latestDate)}.` : "No relevant post date captured.";
  const decision = qualificationDecision(creator);
  if (!hasComputedActivityEvidence(creator)) {
    return `${creatorFitCategory(creator)}. Computed 90-day post counts are not available from source evidence. ${recent}`;
  }
  const basis = activityMetricLabel(creator, "vr") === "VR/XR observed" ? "observed in stored source records" : "in the last 90 days";
  const summary = decision.canQualify ? "Meets deterministic qualification rules." : `Not qualified: ${decision.reasons[0] || "needs review."}`;
  return `${creatorFitCategory(creator)}. ${vrCount} VR/XR post${vrCount === 1 ? "" : "s"} ${basis}. ${recent} ${summary}`;
}

function activityEvidenceLabel(creator: Creator) {
  const level = creator.activity_level || "unknown";
  const total = creator.recent_total_posts_count ?? 0;
  const vrCount = creator.recent_vr_posts_count ?? 0;
  const quality = creator.evidence_json?.computed_evidence_quality;
  const confidence = creatorEvidenceConfidence(creator);
  const observations = numericEvidenceField(creator, "computed_source_observation_count");
  const profilePosts = numericEvidenceField(creator, "computed_profile_history_posts_count");
  const observedPosts = numericEvidenceField(creator, "computed_observed_source_posts_count");

  if (quality === "profile_history" || quality === "profile_history_plus_observed") {
    const extra = quality === "profile_history_plus_observed" ? ` plus ${observedPosts} observed source post${observedPosts === 1 ? "" : "s"}` : "";
    const profileBasis = profilePosts ? `; ${profilePosts} came from the profile-history payload` : "";
    return `${labelFor(level)} activity from profile history: ${vrCount} VR/XR post${vrCount === 1 ? "" : "s"} across ${total} recent post${total === 1 ? "" : "s"}${extra}${profileBasis}. ${confidence}.`;
  }
  if (quality === "accumulated_observed_posts") {
    return `${labelFor(level)} activity from accumulated source observations: ${vrCount} VR/XR post${vrCount === 1 ? "" : "s"} across ${total} observed post${total === 1 ? "" : "s"} from ${observations} stored source record${observations === 1 ? "" : "s"}. ${confidence}.`;
  }
  if (quality === "conversation_author") {
    return `Review-only conversation author lead: ${vrCount} VR/XR source post${vrCount === 1 ? "" : "s"} observed. Full profile history was not supplied; use the source post and profile link for manual review. ${confidence}.`;
  }
  if (quality === "observed_post") {
    return `Single observed source post: ${vrCount} VR/XR match from ${observedPosts || 1} stored post. Full profile history was not supplied; treat as low-confidence but actionable for manual review.`;
  }
  if (quality === "partial_history") {
    return `Partial profile evidence: source returned profile metadata but no usable recent post list. ${observedPosts ? `${observedPosts} observed source post${observedPosts === 1 ? "" : "s"} still available for review.` : "No recent source post was attached."}`;
  }
  if (quality === "failed_enrichment") {
    return `Creator enrichment failed for post history. ${observedPosts ? `${observedPosts} observed source post${observedPosts === 1 ? "" : "s"} remains available for manual qualification.` : "Retry enrichment or inspect the profile manually."}`;
  }
  if (!hasComputedActivityEvidence(creator)) {
    return `No computed activity evidence is available. Do not treat stored 90-day counts as measured until source history or observed-post evidence is captured.`;
  }
  if (total > 0 && level !== "unknown") {
    return `${labelFor(level)} - ${total} observed post${total === 1 ? "" : "s"} in last 90 days`;
  }
  if (creator.last_post_at) {
    return `Last activity seen ${shortDate(creator.last_post_at)}; no usable post-history list was captured.`;
  }
  return `No post history captured yet. Use visible profile/source links and rerun enrichment; current evidence confidence is ${confidence.toLowerCase()}.`;
}

function creatorReviewRank(creator: Creator) {
  const score = creator.creator_quality_score ?? -1;
  const priorityBoost = creator.priority === "high" ? 30 : creator.priority === "medium" ? 15 : 0;
  const statusBoost = creator.status === "contact_ready" ? 24 : creator.status === "qualified" ? 18 : creator.status === "reviewed" ? 8 : 0;
  const evidenceBoost = (creator.recent_vr_posts_count ?? 0) * 3 + (creator.headset_confidence === "high" ? 8 : creator.headset_confidence === "medium" ? 4 : 0);
  return score + priorityBoost + statusBoost + evidenceBoost;
}

function statusForCreatorColumn(column: string) {
  if (column === "Qualified") return "qualified";
  if (column === "Contact Ready") return "contact_ready";
  if (column === "Contacted") return "contacted";
  if (column === "Rejected") return "rejected";
  return "reviewed";
}

function urlsFromText(value?: string | null) {
  if (!value) return [];
  return Array.from(value.matchAll(/https?:\/\/[^\s)]+/g)).map((match) => match[0]);
}

function exportSafeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "prospects";
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

function sampleMessageForCreator(creator: Creator, draft?: Draft) {
  if (draft?.body?.trim()) return draft.body.trim();
  const focus = creator.niche || creator.recent_relevant_content || creator.fit_reason || "VR fitness content";
  const offer = creator.offer_angle || "a 3-month XRWorkout creator pass";
  return `Hi ${firstName(creator.name)}, I liked your ${platformLabel(creator.platform)} work around ${focus}. XRWorkout is looking for creators who can give practical feedback on VR fitness experiences. Would you be open to trying ${offer} and sharing what feels useful for your audience?`;
}

function rawJsonString(value: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!value) return "";
  for (const key of keys) {
    const rawValue = value[key];
    if (typeof rawValue === "string" && rawValue.trim()) return rawValue.trim();
  }
  return "";
}

function publicContactFromRawItem(item?: RawItem | null) {
  return rawJsonString(item?.raw_json, ["public_contact", "email", "contact", "businessEmail", "business_email"]);
}

function profileUrlFromRawItem(item?: RawItem | null) {
  return (
    item?.author_url?.trim() ||
    rawJsonString(item?.raw_json, ["authorUrl", "author_url", "profileUrl", "profile_url", "userUrl", "channelUrl", "channel_url"]) ||
    ""
  );
}

function normalizedProfileKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "");
}

function normalizedNameKey(platform: string, name: string) {
  return `${platform.toLowerCase()}:${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function contactLabel(publicContact: string, profile: string) {
  if (publicContact) return publicContact;
  if (profile) return "Manual contact path";
  return "No public contact captured";
}

function sourceKindLabel(value: ExportSourceKind) {
  if (value === "opportunity_author") return "Opportunity Author";
  if (value === "conversation_author") return "Conversation Author";
  if (value === "conversation_record") return "Conversation Record";
  return "Creator";
}

function contactKind(contact: string) {
  if (contact.includes("@")) return "email";
  if (contact === "Manual contact path") return "manual";
  if (contact === "Review source manually") return "review";
  return "missing";
}

function sourceScopeMatches(sourceKind: ExportSourceKind, scope: ContactExportRequest["sourceScope"]) {
  if (scope === "all") return true;
  if (scope === "creators") return sourceKind === "creator";
  if (scope === "opportunities") return sourceKind === "opportunity_author";
  if (scope === "conversations") return sourceKind === "conversation_author" || sourceKind === "conversation_record";
  return true;
}

function recordScopeMatches(sourceKind: ExportSourceKind, scope: ContactExportRequest["recordScope"]) {
  if (scope === "all") return true;
  if (scope === "prospects") return sourceKind !== "conversation_record";
  if (scope === "conversations") return sourceKind === "conversation_author" || sourceKind === "conversation_record";
  if (scope === "creators") return sourceKind === "creator";
  if (scope === "opportunities") return sourceKind === "opportunity_author";
  return true;
}

export type ContactExportRequest = {
  limit: number;
  minFollowers: number | null;
  maxFollowers: number | null;
  minOpportunityScore: number | null;
  minCreatorScore: number | null;
  priorityFloor: "all" | "low" | "medium" | "high";
  recordScope: "all" | "prospects" | "conversations" | "creators" | "opportunities";
  format: ExportFormat;
  query: string;
  contactFilter: "all" | "email" | "manual";
  sourceScope: "all" | "creators" | "opportunities" | "conversations";
  highPriorityOnly: boolean;
};

export type ContactExportRow = {
  name: string;
  platform: string;
  source: string;
  sourceKind: string;
  recordType: string;
  profile: string;
  contact: string;
  followers: string;
  followerCount: number | null;
  priority: string;
  score: string;
  status: string;
  fit: string;
  recommendedAction: string;
  sampleMessage: string;
};

type ExportSourceKind = "creator" | "opportunity_author" | "conversation_author" | "conversation_record";

type ContactExportCandidate = {
  name: string;
  platform: string;
  source: string;
  sourceKind: ExportSourceKind;
  recordType: "Prospect" | "Conversation";
  profile: string;
  contact: string;
  followerCount: number | null;
  priority: string;
  score: number | null;
  status: string;
  fit: string;
  recommendedAction: string;
  sampleMessage: string;
  rank: number;
};

function priorityValue(priority: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  if (priority === "low") return 1;
  return 0;
}

function priorityFloorFromQuery(normalized: string): ContactExportRequest["priorityFloor"] {
  if (normalized.includes("high only") || normalized.includes("high priority") || normalized.includes("high-priority")) return "high";
  if (normalized.includes("medium and up") || normalized.includes("medium or higher") || normalized.includes("medium+")) return "medium";
  if (normalized.includes("low and up") || normalized.includes("low or higher") || normalized.includes("low+")) return "low";
  return "all";
}

function scoreThresholdFromQuery(normalized: string) {
  const patterns = [
    /\bscore\s*(?:of\s*)?(?:above|over|at least|minimum|min)?\s*(\d{1,3})\s*\+?\b/,
    /\b(?:above|over|at least|minimum|min)\s*(\d{1,3})\s*(?:score|opportunity score)?\b/,
    /\b(\d{1,3})\s*\+\s*(?:score|opportunity score|records|opportunities)?\b/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const score = Number(match[1]);
    if (Number.isFinite(score)) return Math.min(100, Math.max(0, score));
  }
  return null;
}

export function parseContactExportRequest(query: string, format: ExportFormat): ContactExportRequest {
  const normalized = query.toLowerCase();
  const limitMatch = normalized.match(/\b(?:first|top|limit|export|need|give me)\s+(\d{1,4})\b/) || normalized.match(/\b(\d{1,4})\s+(?:people|contacts|creators|prospects|leads|records|conversations|opportunities)\b/);
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?\s*[kmb]?)\s*(?:-|to|through|and)\s*(\d+(?:\.\d+)?\s*[kmb]?)\s*(?:followers|subs|subscribers)?/);
  const explicitFormat = normalized.includes("json") ? "json" : normalized.includes("text") || normalized.includes("txt") ? "txt" : normalized.includes("csv") || normalized.includes("excel") ? "csv" : format;
  const contactFilter = normalized.includes("email") || normalized.includes("public contact") ? "email" : normalized.includes("manual") || normalized.includes("dm") ? "manual" : "all";
  const recordScope = normalized.includes("conversation")
    ? "conversations"
    : normalized.includes("opportunit")
      ? "opportunities"
      : normalized.includes("creator")
        ? "creators"
        : normalized.includes("prospect") || normalized.includes("people") || normalized.includes("contacts")
          ? "prospects"
          : "all";
  const sourceScope = normalized.includes("opportunit")
    ? "opportunities"
    : normalized.includes("conversation")
      ? "conversations"
      : normalized.includes("creator")
        ? "creators"
        : "all";
  const scoreThreshold = scoreThresholdFromQuery(normalized);
  const priorityFloor = priorityFloorFromQuery(normalized);
  return {
    limit: Math.min(1000, Math.max(1, limitMatch ? Number(limitMatch[1]) : 50)),
    minFollowers: rangeMatch ? parseFollowerCount(rangeMatch[1]) : null,
    maxFollowers: rangeMatch ? parseFollowerCount(rangeMatch[2]) : null,
    minOpportunityScore: scoreThreshold,
    minCreatorScore: scoreThreshold,
    priorityFloor,
    recordScope,
    format: explicitFormat,
    query,
    contactFilter,
    sourceScope,
    highPriorityOnly: priorityFloor === "high"
  };
}

function exportPriorityScore(priority: string) {
  if (priority === "high") return 35;
  if (priority === "medium") return 22;
  if (priority === "low") return 8;
  return 0;
}

function exportFollowerScore(count: number | null) {
  if (count === null) return 5;
  if (count <= 10_000) return 14;
  if (count <= 50_000) return 11;
  if (count <= 100_000) return 7;
  return 3;
}

function exportCandidateRank(candidate: Omit<ContactExportCandidate, "rank">) {
  const kind = contactKind(candidate.contact);
  const contactScore = kind === "email" ? 40 : kind === "manual" ? 28 : kind === "review" ? 10 : 0;
  const statusScore = candidate.status === "contact_ready" ? 24 : candidate.status === "reviewed" ? 16 : candidate.status === "new" ? 8 : 0;
  const scoreSignal = candidate.score === null ? 0 : Math.min(24, Math.max(0, Math.round(candidate.score / 4)));
  const sourceScore = candidate.sourceKind === "creator" ? 14 : candidate.sourceKind === "opportunity_author" ? 11 : candidate.sourceKind === "conversation_author" ? 7 : 0;
  const profileScore = candidate.profile ? 8 : 0;
  const bucketScore = kind === "email" ? 300 : kind === "manual" ? 220 : candidate.sourceKind === "conversation_record" && (candidate.score || 0) >= 50 ? 150 : 60;
  return bucketScore + contactScore + statusScore + exportPriorityScore(candidate.priority) + scoreSignal + sourceScore + profileScore + exportFollowerScore(candidate.followerCount);
}

function shouldExcludeOpportunity(opportunity: Opportunity) {
  const status = opportunity.status.toLowerCase();
  const safety = (opportunity.outreach_safety || "").toLowerCase();
  return status === "rejected" || safety.includes("do_not_engage") || safety.includes("do not engage") || safety.includes("unsafe");
}

function candidateKey(candidate: ContactExportCandidate) {
  const profileKey = normalizedProfileKey(candidate.profile);
  if (candidate.sourceKind === "conversation_record") return `source:${normalizedProfileKey(candidate.source || candidate.profile)}`;
  return profileKey ? `profile:${profileKey}` : `name:${normalizedNameKey(candidate.platform, candidate.name)}`;
}

function dedupeCandidates(candidates: ContactExportCandidate[]) {
  const bestByKey = new Map<string, ContactExportCandidate>();
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const current = bestByKey.get(key);
    if (!current || candidate.rank > current.rank) {
      bestByKey.set(key, candidate);
    }
  }
  return Array.from(bestByKey.values());
}

function creatorCandidate(creator: Creator, drafts: Draft[]): ContactExportCandidate | null {
  if (creator.status === "rejected") return null;
  const draft = drafts.find((item) => item.creator_id === creator.id);
  const contact = contactLabel(creator.public_contact?.trim() || "", creator.profile_url);
  const candidate = {
    name: creator.name,
    platform: creator.platform,
    source: creator.recent_relevant_content || creator.profile_url,
    sourceKind: "creator" as const,
    recordType: "Prospect" as const,
    profile: creator.profile_url,
    contact,
    followerCount: creatorFollowerCount(creator),
    priority: creator.priority,
    score: creator.creator_quality_score ?? null,
    status: creator.status,
    fit: creator.fit_reason || creator.niche || creator.audience_quality || "Needs operator review",
    recommendedAction: creator.public_contact ? "Validate contact and prepare outreach" : creator.offer_angle || "Review manually for comment, DM, or later creator outreach.",
    sampleMessage: sampleMessageForCreator(creator, draft)
  };
  return { ...candidate, rank: exportCandidateRank(candidate) };
}

function opportunityCandidate(opportunity: Opportunity): ContactExportCandidate | null {
  const item = opportunity.raw_items;
  const profile = profileUrlFromRawItem(item);
  const name = item?.author_name?.trim();
  if (shouldExcludeOpportunity(opportunity) || (!name && !profile && !item?.source_url)) return null;
  const isConversationRecord = !name || !profile;
  const contact = contactLabel(publicContactFromRawItem(item), profile);
  const focus = opportunity.summary || item?.title || opportunity.pain_point || "your VR fitness conversation";
  const recommendedAction = opportunity.recommended_action || (contactKind(contact) === "email" ? "Prepare outreach" : "Review manually");
  const displayName = name || item?.title?.trim() || `${platformLabel(opportunity.platform)} opportunity`;
  const candidate = {
    name: displayName,
    platform: opportunity.platform || item?.source || "unknown",
    source: item?.source_url || profile,
    sourceKind: isConversationRecord ? "conversation_record" as const : "opportunity_author" as const,
    recordType: isConversationRecord ? "Conversation" as const : "Prospect" as const,
    profile: profile || item?.source_url || "",
    contact: isConversationRecord ? "Review source manually" : contact,
    followerCount: conversationFollowerCount(item as RawItem, opportunity),
    priority: opportunity.priority,
    score: opportunity.score,
    status: opportunity.status,
    fit: opportunity.xrworkout_relevance || opportunity.pain_point || opportunity.summary || "Classified outreach opportunity",
    recommendedAction,
    sampleMessage: isConversationRecord
      ? `Review this ${platformLabel(opportunity.platform)} opportunity about ${focus}. If it looks relevant, decide whether it belongs in monitoring, a manual community reply, or creator outreach.`
      : `Hi ${firstName(displayName)}, I saw your ${platformLabel(opportunity.platform)} post about ${focus}. XRWorkout is looking for people who can give practical feedback on VR fitness experiences. Would you be open to taking a look and sharing what would be useful for your audience?`
  };
  return { ...candidate, rank: exportCandidateRank(candidate) };
}

function conversationCandidate(item: RawItem, opportunityByRawItemId: Map<string, Opportunity>): ContactExportCandidate | null {
  const linkedOpportunity = opportunityByRawItemId.get(item.id);
  if (linkedOpportunity && shouldExcludeOpportunity(linkedOpportunity)) return null;
  const profile = profileUrlFromRawItem(item);
  const name = item.author_name?.trim();
  if (!name && !profile && !item.source_url) return null;
  const isConversationRecord = !name || !profile;
  const contact = isConversationRecord ? "Review source manually" : contactLabel(publicContactFromRawItem(item), profile);
  const priority = linkedOpportunity?.priority || "medium";
  const status = linkedOpportunity?.status || "new";
  const sourceKind: ExportSourceKind = isConversationRecord ? "conversation_record" : linkedOpportunity ? "opportunity_author" : "conversation_author";
  const focus = linkedOpportunity?.summary || item.title || "your VR fitness conversation";
  const displayName = name || item.title?.trim() || `${platformLabel(item.source)} conversation`;
  const candidate = {
    name: displayName,
    platform: linkedOpportunity?.platform || item.source,
    source: item.source_url || profile,
    sourceKind,
    recordType: isConversationRecord ? "Conversation" as const : "Prospect" as const,
    profile: profile || item.source_url || "",
    contact,
    followerCount: conversationFollowerCount(item, linkedOpportunity),
    priority,
    score: linkedOpportunity?.score ?? null,
    status,
    fit: linkedOpportunity?.xrworkout_relevance || linkedOpportunity?.pain_point || item.title || item.body || "Public conversation lead",
    recommendedAction: linkedOpportunity?.recommended_action || conversationManualAction(item),
    sampleMessage: isConversationRecord
      ? `Review this ${platformLabel(linkedOpportunity?.platform || item.source)} conversation about ${focus}. If it looks relevant, decide whether it belongs in monitoring, a manual community reply, or creator outreach.`
      : `Hi ${firstName(displayName)}, I saw your ${platformLabel(linkedOpportunity?.platform || item.source)} post about ${focus}. XRWorkout is looking for practical feedback from people already discussing VR fitness. Would it be useful if I shared more details?`
  };
  return { ...candidate, rank: exportCandidateRank(candidate) };
}

function requestMatchesCandidate(candidate: ContactExportCandidate, request: ContactExportRequest) {
  if (request.minFollowers !== null && (candidate.followerCount === null || candidate.followerCount < request.minFollowers)) return false;
  if (request.maxFollowers !== null && (candidate.followerCount === null || candidate.followerCount > request.maxFollowers)) return false;
  if (request.highPriorityOnly && candidate.priority !== "high") return false;
  if (request.priorityFloor !== "all" && priorityValue(candidate.priority) < priorityValue(request.priorityFloor)) return false;
  if (candidate.recordType === "Conversation" && request.minOpportunityScore !== null && (candidate.score === null || candidate.score < request.minOpportunityScore)) return false;
  if (candidate.recordType === "Prospect" && candidate.sourceKind === "creator" && request.minCreatorScore !== null && (candidate.score === null || candidate.score < request.minCreatorScore)) return false;
  if (candidate.recordType === "Prospect" && candidate.sourceKind !== "creator" && request.minOpportunityScore !== null && (candidate.score === null || candidate.score < request.minOpportunityScore)) return false;
  if (!recordScopeMatches(candidate.sourceKind, request.recordScope)) return false;
  if (!sourceScopeMatches(candidate.sourceKind, request.sourceScope)) return false;
  const kind = contactKind(candidate.contact);
  if (request.contactFilter === "email" && kind !== "email") return false;
  if (request.contactFilter === "manual" && !["manual", "review"].includes(kind)) return false;
  return true;
}

export function buildContactExportRows(creators: Creator[], drafts: Draft[], opportunities: Opportunity[], rawItems: RawItem[], request: ContactExportRequest): ContactExportRow[] {
  const opportunityByRawItemId = new Map(opportunities.flatMap((opportunity) => (opportunity.raw_items?.id ? [[opportunity.raw_items.id, opportunity] as const] : [])));
  const candidates = [
    ...creators.map((creator) => creatorCandidate(creator, drafts)),
    ...opportunities.map(opportunityCandidate),
    ...rawItems.map((item) => conversationCandidate(item, opportunityByRawItemId))
  ].filter((candidate): candidate is ContactExportCandidate => Boolean(candidate));

  return dedupeCandidates(candidates)
    .filter((candidate) => requestMatchesCandidate(candidate, request))
    .sort((a, b) => b.rank - a.rank || (a.followerCount ?? Number.MAX_SAFE_INTEGER) - (b.followerCount ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
    .slice(0, request.limit)
    .map((candidate) => ({
      name: candidate.name,
      platform: platformLabel(candidate.platform),
      source: candidate.source,
      sourceKind: sourceKindLabel(candidate.sourceKind),
      recordType: candidate.recordType,
      profile: candidate.profile,
      contact: candidate.contact,
      followers: followerCountLabel(candidate.followerCount),
      followerCount: candidate.followerCount,
      priority: labelFor(candidate.priority),
      score: candidate.score === null ? "Not scored" : String(candidate.score),
      status: labelFor(candidate.status),
      fit: candidate.fit,
      recommendedAction: candidate.recommendedAction,
      sampleMessage: candidate.sampleMessage
    }));
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function contactExportContent(rows: ContactExportRow[], request: ContactExportRequest) {
  if (request.format === "json") return JSON.stringify(rows, null, 2);
  if (request.format === "txt") {
    return rows
      .map(
        (row, index) =>
          `${index + 1}. ${row.name}\nRecord type: ${row.recordType}\nPlatform: ${row.platform}\nSource: ${row.source}\nSource kind: ${row.sourceKind}\nProfile: ${row.profile}\nContact: ${row.contact}\nFollowers: ${row.followers}\nPriority: ${row.priority}\nScore: ${row.score}\nStatus: ${row.status}\nFit: ${row.fit}\nRecommended action: ${row.recommendedAction}\nSample message:\n${row.sampleMessage}`
      )
      .join("\n\n---\n\n");
  }
  const headers = ["Name", "Platform", "Source", "Source Kind", "Record Type", "Profile", "Contact", "Followers", "Priority", "Score", "Status", "Fit", "Recommended Action", "Sample Message"];
  const lines = rows.map((row) => [row.name, row.platform, row.source, row.sourceKind, row.recordType, row.profile, row.contact, row.followers, row.priority, row.score, row.status, row.fit, row.recommendedAction, row.sampleMessage].map(csvCell).join(","));
  return [headers.map(csvCell).join(","), ...lines].join("\n");
}

function downloadContactExport(rows: ContactExportRow[], request: ContactExportRequest) {
  const content = contactExportContent(rows, request);
  const type = request.format === "json" ? "application/json" : request.format === "txt" ? "text/plain" : "text/csv";
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `xrworkout-${exportSafeFilename(request.query)}.${request.format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function isActiveRun(run?: WorkflowRunDetail | null) {
  return run?.status === "queued" || run?.status === "in_progress" || run?.status === "waiting";
}

function runDurationLabel(start?: string | null, end?: string | null) {
  if (!start) return "Not started";
  const finish = end ? new Date(end).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((finish - new Date(start).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

function estimateLabel(seconds: number) {
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.round(seconds / 60)}m`;
}

function stepDurationSeconds(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000));
}

function workflowProgress(run?: WorkflowRunDetail | null) {
  const steps = run?.jobs.flatMap((job) => job.steps) || [];
  if (!steps.length) return 0;
  const completed = steps.filter((step) => step.status === "completed").length;
  return Math.round((completed / steps.length) * 100);
}

function workflowIssue(run?: WorkflowRunDetail | null) {
  return run?.jobs.flatMap((job) => job.steps).find((step) => step.conclusion === "failure" || step.conclusion === "timed_out") || null;
}

function hasConversationContent(item: RawItem) {
  return Boolean(item.title?.trim() || item.body?.trim());
}

function rawString(item: RawItem, key: string) {
  const value = item.raw_json?.[key];
  return typeof value === "string" ? value : "";
}

function sourceType(item: RawItem) {
  return rawString(item, "source_type") || "social_post";
}

function conversationManualAction(item: RawItem) {
  return rawString(item, "manual_action") || (sourceType(item) === "server_discovery" ? "review_source" : "join_manually");
}

function conversationTitle(item: RawItem, opportunity?: Opportunity) {
  return item.title?.trim() || opportunity?.summary || `${platformLabel(item.source)} signal from ${item.author_name || "unknown creator"}`;
}

function conversationBody(item: RawItem, opportunity?: Opportunity) {
  return item.body?.trim() || opportunity?.summary || opportunity?.pain_point || "No conversation details captured.";
}

const creatorWorkspaceMaxSize = { width: 1080, height: 720 };

function creatorWorkspaceDimensions() {
  if (typeof window === "undefined") {
    return creatorWorkspaceMaxSize;
  }
  return {
    width: Math.min(creatorWorkspaceMaxSize.width, window.innerWidth - 32),
    height: Math.min(creatorWorkspaceMaxSize.height, window.innerHeight - 32)
  };
}

function defaultCreatorPanelPosition() {
  if (typeof window === "undefined") {
    return { x: 96, y: 80 };
  }
  const size = creatorWorkspaceDimensions();
  return {
    x: Math.max(16, Math.round((window.innerWidth - size.width) / 2)),
    y: Math.max(16, Math.round((window.innerHeight - size.height) / 2))
  };
}

function clampCreatorPanelPosition(nextX: number, nextY: number) {
  if (typeof window === "undefined") return { x: nextX, y: nextY };
  const size = creatorWorkspaceDimensions();
  return {
    x: Math.min(Math.max(16, nextX), Math.max(16, window.innerWidth - size.width - 16)),
    y: Math.min(Math.max(16, nextY), Math.max(16, window.innerHeight - size.height - 16))
  };
}

export default function Page() {
  const hasSupabaseConfig = hasClientSupabaseConfig();
  const supabase = useMemo(() => clientSupabase(), []);
  const [session, setSession] = useState<SessionState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunityStatus, setOpportunityStatus] = useState("new");
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [creatorStatus, setCreatorStatus] = useState("new");
  const [creatorContact, setCreatorContact] = useState("");
  const [creatorPriority, setCreatorPriority] = useState("medium");
  const [creatorFitReason, setCreatorFitReason] = useState("");
  const [creatorOfferAngle, setCreatorOfferAngle] = useState("");
  const [creatorPanelPosition, setCreatorPanelPosition] = useState(() => defaultCreatorPanelPosition());
  const [minimizedCreators, setMinimizedCreators] = useState<Creator[]>([]);
  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null);
  const [followupStatus, setFollowupStatus] = useState("pending");
  const [followupDraftBody, setFollowupDraftBody] = useState("");
  const [selectedMapNode, setSelectedMapNode] = useState("reddit");
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationPlatform, setConversationPlatform] = useState("all");
  const [conversationRelevance, setConversationRelevance] = useState("all");
  const [conversationDate, setConversationDate] = useState("all");
  const [conversationFollowers, setConversationFollowers] = useState("all");
  const [conversationSourceType, setConversationSourceType] = useState("all");
  const [conversationIntent, setConversationIntent] = useState("all");
  const [creatorFollowers, setCreatorFollowers] = useState("all");
  const [creatorScoreBand, setCreatorScoreBand] = useState("all");
  const [creatorActivity, setCreatorActivity] = useState("all");
  const [creatorHeadset, setCreatorHeadset] = useState("all");
  const [creatorContactability, setCreatorContactability] = useState("all");
  const [outreachTab, setOutreachTab] = useState<"drafts" | "followups" | "history">("drafts");
  const [exportQuery, setExportQuery] = useState("First 200 records score 50+ with sample messages");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [cleanStartRunning, setCleanStartRunning] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));

  const loadDashboard = useCallback(async (token: string) => {
    setLoading(true);
    setError("");
    try {
      const [summary, opportunities, drafts, creators, followups, offers, automation] = await Promise.all([
        fetchJson<SummaryData>("/api/dashboard/summary", token),
        fetchJson<{ opportunities: Opportunity[] }>("/api/dashboard/opportunities", token),
        fetchJson<{ drafts: Draft[] }>("/api/dashboard/drafts", token),
        fetchJson<{ creators: Creator[] }>("/api/dashboard/creators", token),
        fetchJson<{ followups: Followup[] }>("/api/dashboard/followups", token),
        fetchJson<{ offers: Offer[] }>("/api/dashboard/offers", token),
        fetchJson<AutomationData>("/api/dashboard/automation", token)
      ]);
      setData({
        summary,
        opportunities: opportunities.opportunities,
        drafts: drafts.drafts,
        creators: creators.creators,
        followups: followups.followups,
        offers: offers.offers,
        automation
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) return;
    supabase.auth.getSession().then(({ data: authData }) => {
      const activeSession = authData.session;
      if (activeSession?.access_token && activeSession.user.email) {
        setSession({ token: activeSession.access_token, email: activeSession.user.email });
        void loadDashboard(activeSession.access_token);
        return;
      }
      setLoading(false);
    });
  }, [hasSupabaseConfig, loadDashboard, supabase]);

  useEffect(() => {
    if (!session || activeView !== "runMonitor") return;
    const hasActiveRun = Object.values(data.automation?.runDetails || {}).some(isActiveRun);
    if (!hasActiveRun) return;
    const interval = window.setInterval(() => {
      void loadDashboard(session.token);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [activeView, data.automation?.runDetails, loadDashboard, session]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!hasSupabaseConfig) {
      setError("Dashboard Supabase env vars are missing.");
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.session?.access_token || !authData.user.email) {
      setError(authError?.message || "Sign in failed");
      return;
    }
    setSession({ token: authData.session.access_token, email: authData.user.email });
    void loadDashboard(authData.session.access_token);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setData(emptyData);
  }

  function startEditing(draft: Draft) {
    setEditingDraft(draft);
    setDraftSubject(draft.subject || "");
    setDraftBody(draft.body || "");
    setActiveView("outreach");
    setOutreachTab("drafts");
  }

  function reviewOpportunity(opportunity: Opportunity) {
    setSelectedOpportunity(opportunity);
    setOpportunityStatus(opportunity.status || "new");
    setActiveView("dashboard");
  }

  function reviewCreator(creator: Creator) {
    setSelectedCreator(creator);
    setCreatorPanelPosition(defaultCreatorPanelPosition());
    setMinimizedCreators((current) => current.filter((item) => item.id !== creator.id));
    setCreatorStatus(creator.status || "new");
    setCreatorContact(creator.public_contact || "");
    setCreatorPriority(creator.priority || "medium");
    setCreatorFitReason(creator.fit_reason || "");
    setCreatorOfferAngle(creator.offer_angle || "");
    setActiveView("creators");
  }

  function minimizeCreator() {
    if (!selectedCreator) return;
    setMinimizedCreators((current) =>
      current.some((creator) => creator.id === selectedCreator.id) ? current : [...current, selectedCreator]
    );
    setSelectedCreator(null);
  }

  function closeCreator() {
    setSelectedCreator(null);
  }

  function reviewFollowup(followup: Followup) {
    setSelectedFollowup(followup);
    setFollowupStatus(followup.status || "pending");
    setFollowupDraftBody(followup.draft_body || "");
    setActiveView("outreach");
    setOutreachTab("followups");
  }

  async function saveDraft() {
    if (!session || !editingDraft) return;
    const result = await fetchJson<{ draft: Draft }>(`/api/dashboard/drafts/${editingDraft.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({ subject: draftSubject || null, body: draftBody })
    });
    setData((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => (draft.id === result.draft.id ? result.draft : draft))
    }));
    setEditingDraft(result.draft);
    setNotice("Draft saved.");
  }

  async function changeDraftStatus(status: "needs_review" | "approved" | "rejected" | "edit_needed", runSendWorkflow = false) {
    if (!session || !editingDraft) return;
    const result = await fetchJson<{ draft: Draft; sendWorkflowDispatched: boolean }>(
      `/api/dashboard/drafts/${editingDraft.id}/status`,
      session.token,
      {
        method: "POST",
        body: JSON.stringify({ status, runSendWorkflow })
      }
    );
    setData((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => (draft.id === result.draft.id ? result.draft : draft))
    }));
    setEditingDraft(result.draft);
    const manualReady = status === "approved" && result.draft.channel !== "email";
    setNotice(
      result.sendWorkflowDispatched
        ? "Email draft approved and dry-run send workflow started."
        : manualReady
          ? "Message approved for manual use."
          : `Draft marked ${labelFor(status)}.`
    );
    void loadDashboard(session.token);
  }

  async function updateOpportunity() {
    if (!session || !selectedOpportunity) return;
    const result = await fetchJson<{ opportunity: Opportunity }>(`/api/dashboard/opportunities/${selectedOpportunity.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({ status: opportunityStatus })
    });
    setData((current) => ({
      ...current,
      opportunities: current.opportunities.map((opportunity) =>
        opportunity.id === result.opportunity.id ? result.opportunity : opportunity
      )
    }));
    setSelectedOpportunity(result.opportunity);
    setNotice("Opportunity status saved.");
  }

  async function generateLlmDraftFromOpportunity(targetOpportunity = selectedOpportunity) {
    if (!session || !targetOpportunity) return;
    await fetchJson(`/api/dashboard/automation/workflows/manualDraft/dispatch`, session.token, {
      method: "POST",
      body: JSON.stringify({ inputs: { opportunity_id: targetOpportunity.id } })
    });
    setNotice("LLM draft workflow started for this opportunity.");
    void loadDashboard(session.token);
  }

  async function updateCreator(nextStatus = creatorStatus, targetCreator = selectedCreator) {
    if (!session || !targetCreator) return;
    const isEditingSelected = selectedCreator?.id === targetCreator.id;
    const decision = qualificationDecision(targetCreator);
    let statusToSave = nextStatus;
    if (nextStatus === "qualified" && !decision.canQualify) {
      statusToSave = "reviewed";
      setNotice(`Moved to Review. ${qualificationSummary(targetCreator)}`);
    }
    if (nextStatus === "contact_ready" && !decision.canContactReady) {
      statusToSave = "reviewed";
      setNotice(`Moved to Review. ${decision.canQualify ? "Add a validated contact path before Contact Ready." : qualificationSummary(targetCreator)}`);
    }
    const result = await fetchJson<{ creator: Creator }>(`/api/dashboard/creators/${targetCreator.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({
        status: statusToSave,
        public_contact: (isEditingSelected ? creatorContact : targetCreator.public_contact) || null,
        priority: isEditingSelected ? creatorPriority : targetCreator.priority,
        fit_reason: (isEditingSelected ? creatorFitReason : targetCreator.fit_reason) || null,
        offer_angle: (isEditingSelected ? creatorOfferAngle : targetCreator.offer_angle) || null
      })
    });
    setData((current) => ({
      ...current,
      creators: current.creators.map((creator) => (creator.id === result.creator.id ? result.creator : creator))
    }));
    if (isEditingSelected) {
      setSelectedCreator(result.creator);
      setCreatorStatus(result.creator.status || nextStatus);
    }
    if (statusToSave === nextStatus) {
      setNotice(`${result.creator.name} moved to ${labelFor(result.creator.status)}.`);
    }
  }

  async function updateFollowup(nextStatus = followupStatus) {
    if (!session || !selectedFollowup) return;
    const result = await fetchJson<{ followup: Followup }>(`/api/dashboard/followups/${selectedFollowup.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, draft_body: followupDraftBody || null })
    });
    setData((current) => ({
      ...current,
      followups: current.followups.map((followup) => (followup.id === result.followup.id ? result.followup : followup))
    }));
    setSelectedFollowup(result.followup);
    setFollowupStatus(result.followup.status || "pending");
    setFollowupDraftBody(result.followup.draft_body || "");
    setNotice(`Follow-up marked ${labelFor(result.followup.status)}.`);
    void loadDashboard(session.token);
  }

  async function updateVariable(name: "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND" | "APIFY_ENABLED" | "PROFILE_ENRICHMENT_ENABLED", value: string) {
    if (!session) return;
    await fetchJson(`/api/dashboard/automation/variables`, session.token, {
      method: "PATCH",
      body: JSON.stringify({ name, value })
    });
    setNotice(`${name} set to ${value}.`);
    void loadDashboard(session.token);
  }

  async function dispatch(workflow: string) {
    if (!session) return;
    await fetchJson(`/api/dashboard/automation/workflows/${workflow}/dispatch`, session.token, {
      method: "POST",
      body: JSON.stringify({})
    });
    setNotice(`${labelFor(workflow)} workflow started.`);
    void loadDashboard(session.token);
  }

  async function dispatchSourceCollection(source: string, classify = true) {
    if (!session) return;
    await fetchJson(`/api/dashboard/automation/workflows/sourceCollection/dispatch`, session.token, {
      method: "POST",
      body: JSON.stringify({ inputs: { source, classify: classify ? "true" : "false" } })
    });
    setNotice(`${labelFor(source)} source collection started.`);
    void loadDashboard(session.token);
  }

  async function cleanAutomaticStart() {
    if (!session || cleanStartRunning) return;
    setCleanStartRunning(true);
    setError("");
    try {
      await fetchJson(`/api/dashboard/automation/clean-start`, session.token, {
        method: "POST",
        body: JSON.stringify({})
      });
      setNotice("Clean automatic start launched. Sends remain disabled and dry-run stays on.");
      void loadDashboard(session.token);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Clean automatic start failed");
    } finally {
      setCleanStartRunning(false);
    }
  }

  const summary = data.summary;
  const rawItems = useMemo(() => summary?.rawItems || [], [summary?.rawItems]);
  const dryRunSendEnabled = (data.automation?.variables.DRY_RUN_SEND || "true") === "true";
  const kpis = buildKpis(summary, data.creators, data.drafts, data.offers.length);
  const priority = priorityCounts(data.opportunities);
  const recommendations = buildRecommendations(data.opportunities, data.creators, data.drafts, data.followups);
  const feed = buildOpportunityFeed(data.opportunities, data.drafts, rawItems);
  const nodes = platformNodes(summary, data.creators);
  const selectedNode = nodes.find((node) => node.id === selectedMapNode) || nodes[0];
  const agents = workflowAgents(summary, data.automation);
  const opportunityByRawItemId = new Map(data.opportunities.flatMap((opportunity) => (opportunity.raw_items?.id ? [[opportunity.raw_items.id, opportunity] as const] : [])));
  const conversationRows = rawItems.filter((item) => opportunityByRawItemId.has(item.id) || hasConversationContent(item));
  const platforms = ["all", ...Array.from(new Set(conversationRows.map((item) => item.source))).sort()];
  const totalOpportunities = data.opportunities.length || 1;
  const filteredConversations = conversationRows.filter((item) => {
    const linkedOpportunity = opportunityByRawItemId.get(item.id);
    const query = conversationSearch.trim().toLowerCase();
    const matchesSearch =
      !query ||
      [conversationTitle(item, linkedOpportunity), conversationBody(item, linkedOpportunity), item.author_name, item.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesPlatform = conversationPlatform === "all" || item.source === conversationPlatform;
    const matchesSourceType = conversationSourceType === "all" || sourceType(item) === conversationSourceType;
    const matchesIntent = conversationIntent === "all" || linkedOpportunity?.opportunity_type === conversationIntent;
    const matchesFollowers = followerRangeMatches(conversationFollowerCount(item, linkedOpportunity), conversationFollowers);
    const matchesRelevance =
      conversationRelevance === "all" ||
      (conversationRelevance === "high" && (linkedOpportunity?.score || 0) >= 70) ||
      (conversationRelevance === "medium" && (linkedOpportunity?.score || 0) >= 35 && (linkedOpportunity?.score || 0) < 70) ||
      (conversationRelevance === "unscored" && !linkedOpportunity);
    const matchesDate =
      conversationDate === "all" ||
      (conversationDate === "today" && item.collected_at?.slice(0, 10) === todayIso) ||
      (conversationDate === "week" &&
        item.collected_at &&
        nowMs - new Date(item.collected_at).getTime() <= 7 * 24 * 60 * 60 * 1000);
    return matchesSearch && matchesPlatform && matchesSourceType && matchesIntent && matchesRelevance && matchesDate && matchesFollowers;
  });
  const filteredCreators = data.creators.filter((creator) => {
    const matchesFollowers = followerRangeMatches(creatorFollowerCount(creator), creatorFollowers);
    const matchesScore = scoreBandMatches(creator.creator_quality_score, creatorScoreBand);
    const matchesActivity = creatorActivity === "all" || (creator.activity_level || "unknown") === creatorActivity;
    const matchesHeadset = creatorHeadset === "all" || (creator.headset_confidence || "unknown") === creatorHeadset;
    const matchesContactability = contactabilityMatches(creator, creatorContactability);
    return matchesFollowers && matchesScore && matchesActivity && matchesHeadset && matchesContactability;
  }).sort((left, right) => creatorReviewRank(right) - creatorReviewRank(left));
  const exportRequest = useMemo(() => parseContactExportRequest(exportQuery, exportFormat), [exportFormat, exportQuery]);
  const exportRows = useMemo(() => buildContactExportRows(data.creators, data.drafts, data.opportunities, rawItems, exportRequest), [data.creators, data.drafts, data.opportunities, rawItems, exportRequest]);
  const showAssistant = activeView !== "creators" && activeView !== "export";

  if (loading && !session) {
    return <main className="grid min-h-screen place-items-center bg-zinc-950 text-zinc-100">Loading XRWorkout Outreach OS...</main>;
  }

  if (!session) {
    const configError = hasSupabaseConfig
      ? error
      : "Dashboard Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#164e63_0%,#09090b_38%,#020617_100%)] p-6 text-zinc-100">
        <Card className="w-full max-w-md p-7">
          <form className="grid gap-5" onSubmit={signIn}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">XRWorkout</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Outreach OS</h1>
              <p className="mt-2 text-sm text-zinc-400">Sign in with an approved operator account.</p>
            </div>
            <Field label="Email">
              <TextInput type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </Field>
            <Field label="Password">
              <TextInput type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            {configError ? <p className="rounded-md border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">{configError}</p> : null}
            <Button type="submit" variant="primary" disabled={!hasSupabaseConfig}>
              Sign in
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-zinc-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.16),transparent_26%),radial-gradient(circle_at_86%_12%,rgba(16,185,129,0.1),transparent_24%),linear-gradient(180deg,#0a0b0f_0%,#050506_100%)]" />
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/25 p-4 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid size-9 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">XRWorkout</p>
              <p className="text-xs text-zinc-500">Outreach OS</p>
            </div>
          </div>
          <nav className="mt-7 grid gap-1">
            {navigation.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 text-left text-sm transition",
                  activeView === item.id ? "bg-white/[0.09] text-white" : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
                )}
                onClick={() => setActiveView(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Safety</p>
            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Send automation</span>
                <SoftBadge tone={toneFor(data.automation?.variables.SEND_AUTOMATION_ENABLED)}>
                  {data.automation?.variables.SEND_AUTOMATION_ENABLED || "false"}
                </SoftBadge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-400">Dry-run</span>
                <SoftBadge tone={toneFor(data.automation?.variables.DRY_RUN_SEND)}>
                  {data.automation?.variables.DRY_RUN_SEND || "true"}
                </SoftBadge>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#07080a]/80 px-4 backdrop-blur xl:px-6">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-cyan-200">Internal growth command center</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{navigation.find((item) => item.id === activeView)?.label}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => loadDashboard(session.token)}>
                <RefreshCw size={15} /> Refresh
              </Button>
              <Button variant="ghost" onClick={signOut}>
                <LogOut size={15} /> Sign out
              </Button>
            </div>
          </header>

          <div className={cn("grid gap-5 p-4 xl:p-6", showAssistant && "xl:grid-cols-[minmax(0,1fr)_340px]")}>
            <div className="min-w-0">
              {notice ? <div className="mb-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">{notice}</div> : null}
              {error ? <div className="mb-4 rounded-md border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div> : null}
              {loading ? <div className="mb-4 rounded-md border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">Loading current outreach data...</div> : null}

              {activeView === "dashboard" ? (
                <DashboardView
                  kpis={kpis}
                  priority={priority}
                  totalOpportunities={totalOpportunities}
                  feed={feed}
                  selectedOpportunity={selectedOpportunity}
                  opportunityStatus={opportunityStatus}
                  setOpportunityStatus={setOpportunityStatus}
                  updateOpportunity={updateOpportunity}
                  generateLlmDraftFromOpportunity={generateLlmDraftFromOpportunity}
                  reviewOpportunity={reviewOpportunity}
                  opportunities={data.opportunities}
                  drafts={data.drafts}
                  dryRunSendEnabled={dryRunSendEnabled}
                />
              ) : null}

              {activeView === "conversations" ? (
                <ConversationsView
                  rawItems={filteredConversations}
                  allRawItems={conversationRows}
                  opportunities={data.opportunities}
                  platforms={platforms}
                  search={conversationSearch}
                  setSearch={setConversationSearch}
                  platform={conversationPlatform}
                  setPlatform={setConversationPlatform}
                  relevance={conversationRelevance}
                  setRelevance={setConversationRelevance}
                  date={conversationDate}
                  setDate={setConversationDate}
                  followers={conversationFollowers}
                  setFollowers={setConversationFollowers}
                  sourceTypeFilter={conversationSourceType}
                  setSourceTypeFilter={setConversationSourceType}
                  intentFilter={conversationIntent}
                  setIntentFilter={setConversationIntent}
                  onReviewOpportunity={reviewOpportunity}
                  onDraftOpportunity={(opportunity) => {
                    reviewOpportunity(opportunity);
                    void generateLlmDraftFromOpportunity(opportunity);
                  }}
                />
              ) : null}

              {activeView === "map" ? (
                <ConversationMapView nodes={nodes} selectedNode={selectedNode} setSelectedNode={setSelectedMapNode} />
              ) : null}

              {activeView === "creators" ? (
                <CreatorsView
                  creators={filteredCreators}
                  allCreatorsCount={data.creators.length}
                  drafts={data.drafts}
                  followerRange={creatorFollowers}
                  setFollowerRange={setCreatorFollowers}
                  scoreBand={creatorScoreBand}
                  setScoreBand={setCreatorScoreBand}
                  activityFilter={creatorActivity}
                  setActivityFilter={setCreatorActivity}
                  headsetFilter={creatorHeadset}
                  setHeadsetFilter={setCreatorHeadset}
                  contactabilityFilter={creatorContactability}
                  setContactabilityFilter={setCreatorContactability}
                  creatorStatus={creatorStatus}
                  setCreatorStatus={setCreatorStatus}
                  creatorPriority={creatorPriority}
                  setCreatorPriority={setCreatorPriority}
                  creatorContact={creatorContact}
                  setCreatorContact={setCreatorContact}
                  creatorFitReason={creatorFitReason}
                  setCreatorFitReason={setCreatorFitReason}
                  creatorOfferAngle={creatorOfferAngle}
                  setCreatorOfferAngle={setCreatorOfferAngle}
                  reviewCreator={reviewCreator}
                  updateCreator={updateCreator}
                />
              ) : null}

              {activeView === "outreach" ? (
                <OutreachView
                  tab={outreachTab}
                  setTab={setOutreachTab}
                  drafts={data.drafts}
                  followups={data.followups}
                  editingDraft={editingDraft}
                  startEditing={startEditing}
                  draftSubject={draftSubject}
                  setDraftSubject={setDraftSubject}
                  draftBody={draftBody}
                  setDraftBody={setDraftBody}
                  saveDraft={saveDraft}
                  changeDraftStatus={changeDraftStatus}
                  dryRunSendEnabled={dryRunSendEnabled}
                  selectedFollowup={selectedFollowup}
                  reviewFollowup={reviewFollowup}
                  followupStatus={followupStatus}
                  setFollowupStatus={setFollowupStatus}
                  followupDraftBody={followupDraftBody}
                  setFollowupDraftBody={setFollowupDraftBody}
                  updateFollowup={updateFollowup}
                />
              ) : null}

              {activeView === "export" ? (
                <ExportView
                  query={exportQuery}
                  setQuery={setExportQuery}
                  format={exportFormat}
                  setFormat={setExportFormat}
                  request={exportRequest}
                  rows={exportRows}
                  totalCreators={data.creators.length}
                  download={() => {
                    downloadContactExport(exportRows, exportRequest);
                    setNotice(`Exported ${exportRows.length} prospects.`);
                  }}
                />
              ) : null}

              {activeView === "automations" ? (
                <AutomationsView
                  automation={data.automation}
                  agents={agents}
                  updateVariable={updateVariable}
                  dispatch={dispatch}
                  dispatchSourceCollection={dispatchSourceCollection}
                  cleanAutomaticStart={cleanAutomaticStart}
                  cleanStartRunning={cleanStartRunning}
                  dryRunSendEnabled={dryRunSendEnabled}
                />
              ) : null}

              {activeView === "runMonitor" ? (
                <RunMonitorView automation={data.automation} refresh={() => session && loadDashboard(session.token)} />
              ) : null}

              {activeView === "analytics" ? (
                <AnalyticsView summary={summary} opportunities={data.opportunities} creators={data.creators} drafts={data.drafts} rawItems={rawItems} />
              ) : null}

              {activeView === "settings" ? (
                <SettingsView session={session} automation={data.automation} nodes={nodes} updateVariable={updateVariable} />
              ) : null}
            </div>

            {showAssistant ? (
              <AssistantPanel
                recommendations={recommendations}
                onOpen={(recommendation) => {
                  if (recommendation.kind === "opportunity") {
                    const target = data.opportunities.find((row) => row.id === recommendation.targetId);
                    if (target) reviewOpportunity(target);
                  }
                  if (recommendation.kind === "creator") {
                    const target = data.creators.find((row) => row.id === recommendation.targetId);
                    if (target) reviewCreator(target);
                  }
                  if (recommendation.kind === "draft") {
                    const target = data.drafts.find((row) => row.id === recommendation.targetId);
                    if (target) startEditing(target);
                  }
                  if (recommendation.kind === "followup") {
                    const target = data.followups.find((row) => row.id === recommendation.targetId);
                    if (target) reviewFollowup(target);
                  }
                }}
              />
            ) : null}
          </div>
          {activeView === "creators" && selectedCreator ? (
            <CreatorFloatingTab
              key={selectedCreator.id}
              selectedCreator={selectedCreator}
              drafts={data.drafts}
              creatorStatus={creatorStatus}
              setCreatorStatus={setCreatorStatus}
              creatorPriority={creatorPriority}
              setCreatorPriority={setCreatorPriority}
              creatorContact={creatorContact}
              setCreatorContact={setCreatorContact}
              creatorFitReason={creatorFitReason}
              setCreatorFitReason={setCreatorFitReason}
              creatorOfferAngle={creatorOfferAngle}
              setCreatorOfferAngle={setCreatorOfferAngle}
              updateCreator={updateCreator}
              onMinimize={minimizeCreator}
              onClose={closeCreator}
              position={creatorPanelPosition}
              setPosition={setCreatorPanelPosition}
            />
          ) : null}
          {activeView === "creators" && minimizedCreators.length ? (
            <MinimizedCreatorDock creators={minimizedCreators} onOpen={reviewCreator} onClose={(creatorId) => setMinimizedCreators((current) => current.filter((creator) => creator.id !== creatorId))} />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function DashboardView({
  kpis,
  priority,
  totalOpportunities,
  feed,
  selectedOpportunity,
  opportunityStatus,
  setOpportunityStatus,
  updateOpportunity,
  generateLlmDraftFromOpportunity,
  reviewOpportunity,
  opportunities
}: {
  kpis: Array<{ label: string; value: number; detail: string }>;
  priority: { high: number; medium: number; low: number };
  totalOpportunities: number;
  feed: Array<{ id: string; title: string; source: string; timestamp: string; score: number; action: string; detail: string }>;
  selectedOpportunity: Opportunity | null;
  opportunityStatus: string;
  setOpportunityStatus: (value: string) => void;
  updateOpportunity: () => void;
  generateLlmDraftFromOpportunity: () => void;
  reviewOpportunity: (opportunity: Opportunity) => void;
  opportunities: Opportunity[];
  drafts: Draft[];
  dryRunSendEnabled: boolean;
}) {
  const priorityCards = [
    { key: "high", count: priority.high, icon: <ShieldAlert size={18} />, accent: "border-red-300/30" },
    { key: "medium", count: priority.medium, icon: <Target size={18} />, accent: "border-amber-300/25" },
    { key: "low", count: priority.low, icon: <CircleDot size={18} />, accent: "border-zinc-500/25" }
  ] as const;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4 transition hover:-translate-y-0.5 hover:border-white/20">
            <p className="text-xs text-zinc-500">{kpi.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{kpi.value}</p>
            <p className="mt-2 text-sm text-zinc-400">{kpi.detail}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {priorityCards.map((card) => {
          const trend = trendFor(card.count, totalOpportunities);
          return (
            <Card key={card.key} className={cn("border-l-2 p-5", card.accent)}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-zinc-200">
                    {card.icon}
                    <h3 className="font-medium">{labelFor(card.key)}</h3>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">{card.count}</p>
                  <p className="mt-2 text-sm text-zinc-500">Opportunities needing prioritization</p>
                </div>
                <div className="text-right">
                  <SoftBadge tone={card.key === "high" ? "bad" : card.key === "medium" ? "warn" : "neutral"}>{trend.delta}</SoftBadge>
                  <p className="mt-2 text-xs text-zinc-500">{trend.share} of queue</p>
                </div>
              </div>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Live Opportunity Feed</h3>
              <p className="text-sm text-zinc-500">Signals from conversations, creators, drafts, and outreach state.</p>
            </div>
            <Sparkles className="text-cyan-200" size={18} />
          </div>
          <div className="grid gap-3">
            {feed.map((item) => {
              const opportunity = opportunities.find((row) => row.id === item.id);
              return (
                <button
                  key={item.id}
                  className="group grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/[0.04]"
                  onClick={() => opportunity && reviewOpportunity(opportunity)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-100">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-zinc-500">{item.detail}</p>
                    </div>
                    <ChevronRight className="text-zinc-600 transition group-hover:text-cyan-200" size={18} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <SoftBadge>{platformLabel(item.source)}</SoftBadge>
                    <span>{shortDate(item.timestamp)}</span>
                    <span>{scoreText(item.score)}</span>
                    <span>{labelFor(item.action)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-white">Opportunity Review</h3>
          {selectedOpportunity ? (
            <div className="mt-4 grid gap-4">
              <div className="flex flex-wrap gap-2">
                <SoftBadge tone={toneFor(selectedOpportunity.priority)}>{labelFor(selectedOpportunity.priority)}</SoftBadge>
                <SoftBadge tone="info">Score {selectedOpportunity.score}</SoftBadge>
                <SoftBadge>{platformLabel(selectedOpportunity.platform)}</SoftBadge>
              </div>
              <Field label="Status">
                <Select value={opportunityStatus} onChange={(event) => setOpportunityStatus(event.target.value)}>
                  {opportunityStatuses.map((status) => (
                    <option key={status} value={status}>
                      {labelFor(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <ContextBlock
                rows={[
                  ["Summary", selectedOpportunity.summary || "No summary."],
                  ["Pain point", selectedOpportunity.pain_point || "No pain point."],
                  ["XRWorkout fit", selectedOpportunity.xrworkout_relevance || "No relevance note."],
                  ["Suggested action", labelFor(selectedOpportunity.recommended_action)]
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={updateOpportunity}>
                  <Save size={15} /> Save status
                </Button>
                <Button variant="success" onClick={generateLlmDraftFromOpportunity}>
                  <Sparkles size={15} /> Generate LLM draft
                </Button>
                {selectedOpportunity.raw_items?.source_url ? (
                  <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-100" href={selectedOpportunity.raw_items.source_url} target="_blank" rel="noreferrer">
                    Open source <ExternalLink size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState title="Select an opportunity" detail="Use the live feed or assistant recommendations to inspect context and act." />
          )}
        </Card>
      </section>
    </div>
  );
}

function ConversationsView({
  rawItems,
  allRawItems,
  opportunities,
  platforms,
  search,
  setSearch,
  platform,
  setPlatform,
  relevance,
  setRelevance,
  date,
  setDate,
  followers,
  setFollowers,
  sourceTypeFilter,
  setSourceTypeFilter,
  intentFilter,
  setIntentFilter,
  onReviewOpportunity,
  onDraftOpportunity
}: {
  rawItems: RawItem[];
  allRawItems: RawItem[];
  opportunities: Opportunity[];
  platforms: string[];
  search: string;
  setSearch: (value: string) => void;
  platform: string;
  setPlatform: (value: string) => void;
  relevance: string;
  setRelevance: (value: string) => void;
  date: string;
  setDate: (value: string) => void;
  followers: string;
  setFollowers: (value: string) => void;
  sourceTypeFilter: string;
  setSourceTypeFilter: (value: string) => void;
  intentFilter: string;
  setIntentFilter: (value: string) => void;
  onReviewOpportunity: (opportunity: Opportunity) => void;
  onDraftOpportunity: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="grid gap-5">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_repeat(6,minmax(140px,1fr))]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-zinc-500" size={16} />
            <TextInput className="pl-9" placeholder="Search conversations, authors, communities" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <Select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            {platforms.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All Platforms" : platformLabel(item)}
              </option>
            ))}
          </Select>
          <Select value={sourceTypeFilter} onChange={(event) => setSourceTypeFilter(event.target.value)}>
            {sourceTypeFilters.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={intentFilter} onChange={(event) => setIntentFilter(event.target.value)}>
            {intentFilters.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
          <Select value={relevance} onChange={(event) => setRelevance(event.target.value)}>
            <option value="all">All Relevance</option>
            <option value="high">High Signal</option>
            <option value="medium">Promising</option>
            <option value="unscored">Not Scored Yet</option>
          </Select>
          <Select value={date} onChange={(event) => setDate(event.target.value)}>
            <option value="all">Any Date</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
          </Select>
          <Select value={followers} onChange={(event) => setFollowers(event.target.value)}>
            {followerRanges.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Filter size={15} />
        Showing {rawItems.length} of {allRawItems.length} collected conversations
      </div>
      <div className="grid gap-3">
        {rawItems.length ? (
          rawItems.slice(0, 80).map((item) => {
            const opportunity = opportunities.find((row) => row.raw_items?.id === item.id);
            const followerCount = conversationFollowerCount(item, opportunity);
            return (
              <Card key={item.id} className="p-4 transition hover:border-white/20 hover:bg-white/[0.035]">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap gap-2">
                      <SoftBadge>{platformLabel(item.source)}</SoftBadge>
                      <SoftBadge>{labelFor(sourceType(item))}</SoftBadge>
                      <SoftBadge tone={opportunity ? toneFor(opportunity.priority) : "neutral"}>
                        {opportunity ? scoreText(opportunity.score) : "Not scored yet"}
                      </SoftBadge>
                      {opportunity?.opportunity_type ? <SoftBadge>{labelFor(opportunity.opportunity_type)}</SoftBadge> : null}
                      <SoftBadge>{opportunity?.outreach_safety ? labelFor(opportunity.outreach_safety) : "Review pending"}</SoftBadge>
                    </div>
                    <h3 className="text-base font-medium text-white">{conversationTitle(item, opportunity)}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">{conversationBody(item, opportunity)}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
                      <span>{item.author_name || "Unknown author"}</span>
                      <span>{followerCountLabel(followerCount)}</span>
                      <span>{shortDate(item.collected_at || item.published_at)}</span>
                      <span>Engagement: {opportunity ? labelFor(opportunity.priority) : "Unknown"}</span>
                      <span>{rawString(item, "automation_policy") || "Manual review only"}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.source_url ? (
                      <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-100" href={item.source_url} target="_blank" rel="noreferrer">
                        {conversationManualAction(item) === "join_manually" ? "Join manually" : "Review source"} <ExternalLink size={14} />
                      </a>
                    ) : null}
                    <Button variant="secondary" disabled={!opportunity} onClick={() => opportunity && onReviewOpportunity(opportunity)}>
                      Review Opportunity
                    </Button>
                    <Button variant="primary" disabled={!opportunity} onClick={() => opportunity && onDraftOpportunity(opportunity)}>
                      Draft Reply
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <EmptyState title="No conversations match these filters" detail="Clear a filter or run collection to bring in more source items." />
        )}
      </div>
    </div>
  );
}

function ConversationMapView({
  nodes,
  selectedNode,
  setSelectedNode
}: {
  nodes: ReturnType<typeof platformNodes>;
  selectedNode: ReturnType<typeof platformNodes>[number];
  setSelectedNode: (value: string) => void;
}) {
  const radius = 190;
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="relative min-h-[620px] overflow-hidden p-5">
        <div className="absolute inset-6 rounded-full border border-cyan-300/10" />
        <div className="absolute inset-20 rounded-full border border-cyan-300/10" />
        <div className="absolute left-1/2 top-1/2 z-10 grid size-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 text-center shadow-[0_0_70px_rgba(34,211,238,0.18)]">
          <div>
            <Radar className="mx-auto text-cyan-200" size={28} />
            <p className="mt-2 text-sm font-semibold text-white">XRWorkout</p>
            <p className="text-xs text-cyan-100/70">signal core</p>
          </div>
        </div>
        <div className="absolute left-1/2 top-1/2 size-[1px]">
          {nodes.map((node) => {
            const size = Math.min(118, Math.max(74, 70 + node.volume / 4));
            const x = Math.cos(node.angle) * radius;
            const y = Math.sin(node.angle) * radius;
            return (
              <button
                key={node.id}
                className={cn(
                  "absolute grid place-items-center rounded-full border text-center transition hover:scale-105",
                  node.live
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100 shadow-[0_0_34px_rgba(52,211,153,0.12)]"
                    : "border-red-300/20 bg-red-400/8 text-red-100",
                  selectedNode.id === node.id && "ring-2 ring-cyan-200/50"
                )}
                style={{
                  width: size,
                  height: size,
                  transform: `translate(calc(${x}px - 50%), calc(${y}px - 50%))`,
                  opacity: node.live ? 0.95 : 0.58
                }}
                onClick={() => setSelectedNode(node.id)}
              >
                <span className="px-2 text-xs font-semibold">{node.label}</span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">{selectedNode.label}</h3>
            <p className="mt-1 text-sm text-zinc-500">Conversation radar details</p>
          </div>
          <SoftBadge tone={selectedNode.live ? "good" : "bad"}>{selectedNode.live ? "Live" : "API not set up"}</SoftBadge>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniStat label="Volume" value={selectedNode.volume} />
          <MiniStat label="Opps" value={selectedNode.opportunities} />
          <MiniStat label="Creators" value={selectedNode.creators} />
        </div>
        <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-medium text-zinc-200">Communities</p>
          <div className="mt-3 grid gap-2 text-sm text-zinc-400">
            {selectedNode.id === "reddit" ? (
              ["r/OculusQuest", "r/VRFitness", "r/VirtualReality"].map((community) => <span key={community}>{community}</span>)
            ) : selectedNode.live ? (
              <span>{selectedNode.label} source cluster</span>
            ) : (
              <span>Inactive until source integration starts producing data.</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

function CreatorsView(props: {
  creators: Creator[];
  allCreatorsCount: number;
  drafts: Draft[];
  followerRange: string;
  setFollowerRange: (value: string) => void;
  scoreBand: string;
  setScoreBand: (value: string) => void;
  activityFilter: string;
  setActivityFilter: (value: string) => void;
  headsetFilter: string;
  setHeadsetFilter: (value: string) => void;
  contactabilityFilter: string;
  setContactabilityFilter: (value: string) => void;
  creatorStatus: string;
  setCreatorStatus: (value: string) => void;
  creatorPriority: string;
  setCreatorPriority: (value: string) => void;
  creatorContact: string;
  setCreatorContact: (value: string) => void;
  creatorFitReason: string;
  setCreatorFitReason: (value: string) => void;
  creatorOfferAngle: string;
  setCreatorOfferAngle: (value: string) => void;
  reviewCreator: (creator: Creator) => void;
  updateCreator: (status?: string, creator?: Creator | null) => void;
}) {
  const [draggingCreatorId, setDraggingCreatorId] = useState<string | null>(null);
  const creatorsByColumn = useMemo(
    () =>
      creatorBoardColumns.map((column) => ({
        name: column,
        status: statusForCreatorColumn(column),
        creators: props.creators.filter((creator) => creatorStage(creator) === column)
      })),
    [props.creators]
  );
  const stats = [
    ["Total", props.creators.length],
    ["Qualifiable", props.creators.filter((creator) => qualificationDecision(creator).canQualify).length],
    ["Observed-only", props.creators.filter((creator) => qualificationDecision(creator).state === "observed_only").length],
    ["Unknown", props.creators.filter((creator) => qualificationDecision(creator).state === "unknown").length]
  ];

  function handleDrop(event: DragEvent<HTMLElement>, status: string) {
    event.preventDefault();
    const creatorId = event.dataTransfer.getData("text/plain") || draggingCreatorId;
    const creator = props.creators.find((row) => row.id === creatorId);
    setDraggingCreatorId(null);
    if (!creator || creator.status === status) return;
    props.updateCreator(status, creator);
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(140px,170px))]">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Filter size={15} />
            {props.creators.length} of {props.allCreatorsCount} creators
          </div>
          <Select value={props.followerRange} onChange={(event) => props.setFollowerRange(event.target.value)}>
            {followerRanges.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
          </Select>
          <Select value={props.scoreBand} onChange={(event) => props.setScoreBand(event.target.value)}>
            {scoreBands.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}
          </Select>
          <Select value={props.activityFilter} onChange={(event) => props.setActivityFilter(event.target.value)}>
            {activityLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
          </Select>
          <Select value={props.headsetFilter} onChange={(event) => props.setHeadsetFilter(event.target.value)}>
            {headsetConfidenceLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
          </Select>
          <Select value={props.contactabilityFilter} onChange={(event) => props.setContactabilityFilter(event.target.value)}>
            {contactabilityFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
          </Select>
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {creatorsByColumn.map((column) => (
          <Card
            key={column.name}
            className={cn("min-h-[620px] min-w-0 p-3 transition", draggingCreatorId ? "border-cyan-300/25 bg-cyan-300/[0.03]" : "")}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDrop(event, column.status)}
          >
            <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-white">{column.name}</h3>
                <p className="text-xs text-zinc-500">Drop here to request {labelFor(column.status)}</p>
              </div>
              <SoftBadge>{column.creators.length}</SoftBadge>
            </div>
            <div className="grid gap-3">
              {column.creators.map((creator) => {
                const fit = creatorFitBand(creator);
                const latest = creatorLatestRelevantPost(creator);
                const latestUrl = stringField(latest, "url") || urlsFromText(stringField(latest, "evidence"))[0] || "";
                const sourceUrl = latestUrl || urlsFromText(creator.recent_relevant_content)[0] || urlsFromText(strongestCreatorEvidence(creator))[0] || "";
                return (
                  <article
                    key={creator.id}
                    draggable
                    onDragStart={(event) => {
                      setDraggingCreatorId(creator.id);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", creator.id);
                    }}
                    onDragEnd={() => setDraggingCreatorId(null)}
                    className={cn(
                      "min-w-0 rounded-lg border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-300/30",
                      draggingCreatorId === creator.id ? "opacity-50" : ""
                    )}
                  >
                    <button className="block w-full min-w-0 text-left" onClick={() => props.reviewCreator(creator)}>
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                          <p className="mt-1 break-words text-xs leading-5 text-zinc-500">{platformLabel(creator.platform)} • {creatorFitCategory(creator)}</p>
                        </div>
                        <div className="flex max-w-full shrink-0 flex-col items-end gap-1">
                          <SoftBadge tone={fit.tone}>{creator.creator_quality_score ?? "--"}</SoftBadge>
                          {(creator.duplicate_row_count || 0) > 1 ? <SoftBadge tone="warn">{creator.duplicate_row_count} rows</SoftBadge> : null}
                        </div>
                      </div>
                      <p className="mt-3 break-words text-sm font-medium leading-5 text-zinc-200">{creatorInclusionReason(creator)}</p>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{strongestCreatorEvidence(creator)}</p>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-center text-xs">
                        <span className="min-w-0 break-words rounded-md border border-white/10 bg-black/20 p-2 leading-4"><strong className="block break-words text-zinc-100">{activityMetricValue(creator, creator.recent_vr_posts_count)}</strong>{activityMetricLabel(creator, "vr")}</span>
                        <span className="min-w-0 break-words rounded-md border border-white/10 bg-black/20 p-2 leading-4"><strong className="block break-words text-zinc-100">{activityMetricValue(creator, creator.recent_total_posts_count)}</strong>{activityMetricLabel(creator, "total")}</span>
                        <span className="min-w-0 break-words rounded-md border border-white/10 bg-black/20 p-2 leading-4"><strong className="block break-words text-zinc-100">{labelFor(creator.headset_confidence || "unknown")}</strong>Headset</span>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                      {creator.profile_url ? <a className="text-xs font-medium text-cyan-200 hover:text-cyan-100" href={creator.profile_url} target="_blank" rel="noreferrer">Profile</a> : null}
                      {sourceUrl ? <a className="text-xs font-medium text-cyan-200 hover:text-cyan-100" href={sourceUrl} target="_blank" rel="noreferrer">Source</a> : null}
                      {latestUrl && latestUrl !== sourceUrl ? <a className="text-xs font-medium text-cyan-200 hover:text-cyan-100" href={latestUrl} target="_blank" rel="noreferrer">Latest post</a> : null}
                    </div>
                  </article>
                );
              })}
              {!column.creators.length ? <div className="rounded-lg border border-dashed border-white/10 p-5 text-center text-sm text-zinc-500">No creators in this stage.</div> : null}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

function CreatorFloatingTab({
  selectedCreator,
  drafts,
  creatorStatus,
  setCreatorStatus,
  creatorPriority,
  setCreatorPriority,
  creatorContact,
  setCreatorContact,
  creatorFitReason,
  setCreatorFitReason,
  creatorOfferAngle,
  setCreatorOfferAngle,
  updateCreator,
  onMinimize,
  onClose,
  position,
  setPosition
}: {
  selectedCreator: Creator;
  drafts: Draft[];
  creatorStatus: string;
  setCreatorStatus: (value: string) => void;
  creatorPriority: string;
  setCreatorPriority: (value: string) => void;
  creatorContact: string;
  setCreatorContact: (value: string) => void;
  creatorFitReason: string;
  setCreatorFitReason: (value: string) => void;
  creatorOfferAngle: string;
  setCreatorOfferAngle: (value: string) => void;
  updateCreator: (status?: string, creator?: Creator | null) => void;
  onMinimize: () => void;
  onClose: () => void;
  position: { x: number; y: number };
  setPosition: (position: { x: number; y: number }) => void;
}) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [workspacePage, setWorkspacePage] = useState<"review" | "outreach">("review");
  const creatorDrafts = drafts.filter((draft) => draft.creator_id === selectedCreator.id);
  const fit = creatorFitBand(selectedCreator);
  const relevantPosts = creatorRelevantPosts(selectedCreator);
  const latestPost = creatorLatestRelevantPost(selectedCreator);
  const latestPostUrl = stringField(latestPost, "url") || urlsFromText(stringField(latestPost, "evidence"))[0] || "";
  const evidenceUrls = Array.from(
    new Set(
      [
        latestPostUrl,
        ...urlsFromText(selectedCreator.recent_relevant_content),
        ...urlsFromText(selectedCreator.vr_involvement_evidence),
        ...urlsFromText(selectedCreator.movement_fit_evidence),
        ...urlsFromText(selectedCreator.headset_evidence),
        ...urlsFromText(selectedCreator.engagement_evidence),
        ...urlsFromText(selectedCreator.contactability_evidence),
        ...urlsFromText(selectedCreator.safety_notes)
      ].filter(Boolean)
    )
  );
  const sourceLinks: Array<{ label: string; url: string }> = [
    ...(selectedCreator.profile_url ? [{ label: "Profile", url: selectedCreator.profile_url }] : []),
    ...(latestPostUrl ? [{ label: "Latest post", url: latestPostUrl }] : []),
    ...evidenceUrls.filter((url) => url !== latestPostUrl && url !== selectedCreator.profile_url).slice(0, 5).map((url, index) => ({ label: `Evidence ${index + 1}`, url }))
  ];

  return (
    <Card
      className="fixed z-40 flex overflow-hidden border-cyan-300/20 shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
      style={{
        left: position.x,
        top: position.y,
        width: "min(1080px, calc(100vw - 2rem))",
        height: "min(720px, calc(100vh - 2rem))"
      }}
    >
      <div className="flex min-h-0 w-full flex-col">
        <div
          className="flex cursor-move items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragOffset({ x: event.clientX - position.x, y: event.clientY - position.y });
          }}
          onPointerMove={(event) => {
            if (!dragOffset) return;
            setPosition(clampCreatorPanelPosition(event.clientX - dragOffset.x, event.clientY - dragOffset.y));
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setDragOffset(null);
          }}
          onPointerCancel={() => setDragOffset(null)}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
              {initials(selectedCreator.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-cyan-200">Creator Workspace</p>
              <h3 className="truncate text-base font-semibold text-white">{selectedCreator.name}</h3>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2" onPointerDown={(event) => event.stopPropagation()}>
            <div className="hidden rounded-md border border-white/10 bg-black/20 p-1 sm:flex">
              {(["review", "outreach"] as const).map((page) => (
                <button
                  key={page}
                  className={cn(
                    "min-h-8 rounded px-3 text-sm font-medium transition",
                    workspacePage === page ? "bg-cyan-300 text-zinc-950" : "text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100"
                  )}
                  onClick={() => setWorkspacePage(page)}
                >
                  {page === "review" ? "Review" : "Outreach"}
                </button>
              ))}
            </div>
            <Button className="size-8 p-0" variant="ghost" onClick={onMinimize} aria-label="Minimize creator workspace" title="Minimize">
              <Minimize2 size={15} />
            </Button>
            <Button className="size-8 p-0" variant="ghost" onClick={onClose} aria-label="Close creator workspace" title="Close">
              <X size={15} />
            </Button>
          </div>
        </div>

        <div className="grid shrink-0 gap-3 border-b border-white/10 bg-black/15 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SoftBadge tone={fit.tone}>{selectedCreator.creator_quality_score ?? "--"}/100</SoftBadge>
              <SoftBadge tone={creatorStatusTone(selectedCreator)}>{creatorStatusLabel(selectedCreator)}</SoftBadge>
              <SoftBadge>{platformLabel(selectedCreator.platform)}</SoftBadge>
              <SoftBadge>{creatorEvidenceQuality(selectedCreator)}</SoftBadge>
              <SoftBadge tone={qualificationDecision(selectedCreator).canQualify ? "good" : qualificationDecision(selectedCreator).state === "unknown" ? "warn" : "info"}>{qualificationDecision(selectedCreator).label}</SoftBadge>
              {(selectedCreator.duplicate_row_count || 0) > 1 ? <SoftBadge tone="warn">Duplicate rows: {selectedCreator.duplicate_row_count}</SoftBadge> : null}
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-300">{creatorInclusionReason(selectedCreator)}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button variant="secondary" onClick={() => updateCreator("reviewed")} title="Move to Review">
              <CheckCircle2 size={15} /> Review
            </Button>
            <Button variant="success" disabled={!qualificationDecision(selectedCreator).canQualify} title={qualificationSummary(selectedCreator)} onClick={() => updateCreator("qualified")}>
              <Target size={15} /> Qualify
            </Button>
            <Button variant="primary" disabled={!qualificationDecision(selectedCreator).canContactReady} title={qualificationDecision(selectedCreator).canQualify ? "Requires a validated contact path" : qualificationSummary(selectedCreator)} onClick={() => updateCreator("contact_ready")}>
              <MailCheck size={15} /> Contact
            </Button>
          </div>
        </div>

        <div className="flex shrink-0 border-b border-white/10 bg-white/[0.025] sm:hidden">
          {(["review", "outreach"] as const).map((page) => (
            <button
              key={page}
              className={cn(
                "min-h-11 flex-1 text-sm font-medium transition",
                workspacePage === page ? "bg-cyan-300 text-zinc-950" : "text-zinc-400"
              )}
              onClick={() => setWorkspacePage(page)}
            >
              {page === "review" ? "Review" : "Outreach"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {workspacePage === "review" ? (
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
              <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
                <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.055] p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 shrink-0 text-cyan-200" size={18} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cyan-100">Qualification signal</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-200">{creatorInclusionReason(selectedCreator)}</p>
                      <p className="mt-2 text-sm leading-6 text-zinc-400"><LinkifiedText value={strongestCreatorEvidence(selectedCreator)} /></p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat label={activityMetricLabel(selectedCreator, "vr")} value={activityMetricValue(selectedCreator, selectedCreator.recent_vr_posts_count)} />
                  <MiniStat label={activityMetricLabel(selectedCreator, "total")} value={activityMetricValue(selectedCreator, selectedCreator.recent_total_posts_count)} />
                  <MiniStat label="Last post" value={selectedCreator.last_post_at ? shortDate(selectedCreator.last_post_at) : "Unknown"} />
                  <MiniStat label="Headset" value={labelFor(selectedCreator.headset_confidence || "unknown")} />
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-zinc-200">Links</p>
                  <div className="mt-3 grid gap-2">
                    {sourceLinks.length ? sourceLinks.map((link) => (
                      <a
                        key={`${link.label}-${link.url}`}
                        className="inline-flex min-h-10 items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-cyan-100 hover:border-cyan-300/40 hover:text-cyan-50"
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="truncate">{link.label}</span>
                        <ExternalLink className="shrink-0" size={14} />
                      </a>
                    )) : <p className="text-sm text-zinc-500">No usable links captured.</p>}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <MiniStat label="Fit" value={creatorFitCategory(selectedCreator)} />
                  <MiniStat label="Activity" value={labelFor(selectedCreator.activity_level || "unknown")} />
                  <MiniStat label="Confidence" value={creatorEvidenceConfidence(selectedCreator)} />
                </div>
                <div className="min-h-0 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-200">Relevant post evidence</p>
                    <SoftBadge>{relevantPosts.length} captured</SoftBadge>
                  </div>
                  <div className="mt-3 grid max-h-[calc(100%-2.5rem)] gap-3 overflow-y-auto pr-1">
                    {relevantPosts.length ? relevantPosts.slice(0, 8).map((post, index) => {
                      const date = stringField(post, "published_at") || stringField(post, "date");
                      const url = stringField(post, "url") || urlsFromText(stringField(post, "evidence"))[0] || "";
                      const evidence = stringField(post, "evidence") || stringField(post, "text") || stringField(post, "title") || `Relevant post ${index + 1}`;
                      return (
                        <div key={`${date}-${index}`} className="rounded-md border border-white/10 bg-black/20 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
                            <span>{date ? shortDate(date) : "Date unavailable"}</span>
                            {url ? <a className="inline-flex items-center gap-1 text-cyan-200 hover:text-cyan-100" href={url} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a> : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-zinc-300"><LinkifiedText value={evidence} /></p>
                        </div>
                      );
                    }) : (
                      <p className="rounded-md border border-dashed border-white/10 p-4 text-sm leading-6 text-zinc-500">
                        {activityEvidenceLabel(selectedCreator)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
                <EvidenceNote label="VR/XR proof" value={selectedCreator.vr_involvement_evidence} />
                <EvidenceNote label="Movement fit" value={selectedCreator.movement_fit_evidence} />
                <EvidenceNote label="Headset evidence" value={selectedCreator.headset_evidence} />
                <EvidenceNote label="Engagement" value={selectedCreator.engagement_evidence} />
                <EvidenceNote label="Contactability" value={selectedCreator.contactability_evidence || selectedCreator.public_contact} />
                <EvidenceNote label="Safety notes" value={selectedCreator.safety_notes} />
              </div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
              <div className="grid min-h-0 content-start gap-3 overflow-y-auto pr-1">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-zinc-200">Review controls</p>
                  <div className="mt-3 grid gap-3">
                    <Field label="Outreach status">
                      <Select value={creatorStatus} onChange={(event) => setCreatorStatus(event.target.value)}>
                        {creatorStatuses.map((status) => (
                          <option key={status} value={status}>{labelFor(status)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Priority">
                      <Select value={creatorPriority} onChange={(event) => setCreatorPriority(event.target.value)}>
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>{labelFor(priority)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Public contact">
                      <TextInput value={creatorContact} onChange={(event) => setCreatorContact(event.target.value)} placeholder="creator@example.com or public contact note" />
                    </Field>
                  </div>
                </div>
                <ContextBlock
                  rows={[
                    ["Evidence", `${creatorEvidenceQuality(selectedCreator)} - ${creatorEvidenceConfidence(selectedCreator)}`],
                    ["Activity", activityEvidenceLabel(selectedCreator)],
                    ["Audience", selectedCreator.audience_quality || selectedCreator.audience_estimate || "No audience estimate."],
                    ["Contact", selectedCreator.contactability_evidence || selectedCreator.public_contact || "No contact path captured."]
                  ]}
                />
              </div>

              <div className="grid min-h-0 grid-rows-2 gap-3">
                <Field label="Notes / fit reason">
                  <TextArea className="h-full min-h-0 resize-none" value={creatorFitReason} onChange={(event) => setCreatorFitReason(event.target.value)} />
                </Field>
                <Field label="Suggested offer angle">
                  <TextArea className="h-full min-h-0 resize-none" value={creatorOfferAngle} onChange={(event) => setCreatorOfferAngle(event.target.value)} />
                </Field>
              </div>

              <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
                <div className="min-h-0 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-zinc-200">Outreach drafts</p>
                  <div className="mt-3 grid max-h-[calc(100%-2rem)] gap-2 overflow-y-auto pr-1 text-sm text-zinc-500">
                    {creatorDrafts.length ? creatorDrafts.map((draft) => (
                      <div key={draft.id} className="rounded-md border border-white/10 bg-black/20 p-3">
                        <p className="font-medium text-zinc-200">{draft.subject || labelFor(draft.channel)}</p>
                        <p className="mt-1 text-xs text-zinc-500">{labelFor(draft.status)} - {labelFor(draft.channel)}</p>
                      </div>
                    )) : <span>No linked drafts yet.</span>}
                  </div>
                </div>
                <div className="grid gap-2">
                  <Button variant="danger" onClick={() => updateCreator("rejected")}>
                    <XCircle size={15} /> Reject creator
                  </Button>
                  <Button variant="ghost" onClick={() => updateCreator()}>
                    <Save size={15} /> Save edits
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function LinkifiedText({ value, fallback = "No evidence captured." }: { value?: string | null; fallback?: string }) {
  const text = value?.trim();
  if (!text) return <>{fallback}</>;
  return (
    <>
      {text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a key={`${part}-${index}`} className="break-all text-cyan-200 hover:text-cyan-100" href={part} target="_blank" rel="noreferrer">
            {part}
          </a>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function EvidenceNote({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 rounded-md border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">
        <LinkifiedText value={value} />
      </p>
    </div>
  );
}

function MinimizedCreatorDock({
  creators,
  onOpen,
  onClose
}: {
  creators: Creator[];
  onOpen: (creator: Creator) => void;
  onClose: (creatorId: string) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-2 overflow-auto rounded-lg border border-white/10 bg-zinc-950/92 p-2 shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur">
      {creators.map((creator) => (
        <div key={creator.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] p-1">
          <button className="flex min-h-9 max-w-56 items-center gap-2 px-2 text-left text-sm text-zinc-200" onClick={() => onOpen(creator)} title={`Reopen ${creator.name}`}>
            <span className="grid size-7 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.06] text-xs font-semibold">
              {initials(creator.name)}
            </span>
            <span className="truncate">{creator.name}</span>
          </button>
          <Button className="size-8 p-0" variant="ghost" onClick={() => onClose(creator.id)} aria-label={`Close minimized ${creator.name}`}>
            <X size={14} />
          </Button>
        </div>
      ))}
    </div>
  );
}

function OutreachView(props: {
  tab: "drafts" | "followups" | "history";
  setTab: (value: "drafts" | "followups" | "history") => void;
  drafts: Draft[];
  followups: Followup[];
  editingDraft: Draft | null;
  startEditing: (draft: Draft) => void;
  draftSubject: string;
  setDraftSubject: (value: string) => void;
  draftBody: string;
  setDraftBody: (value: string) => void;
  saveDraft: () => void;
  changeDraftStatus: (status: "needs_review" | "approved" | "rejected" | "edit_needed", runSendWorkflow?: boolean) => void;
  dryRunSendEnabled: boolean;
  selectedFollowup: Followup | null;
  reviewFollowup: (followup: Followup) => void;
  followupStatus: string;
  setFollowupStatus: (value: string) => void;
  followupDraftBody: string;
  setFollowupDraftBody: (value: string) => void;
  updateFollowup: (status?: string) => void;
}) {
  const visibleDrafts = props.tab === "history" ? props.drafts.filter((draft) => draft.status === "sent" || draft.status === "rejected") : props.drafts.filter((draft) => draft.status !== "sent" && draft.status !== "rejected");
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
      <div className="grid gap-4">
        <Card className="flex flex-wrap gap-2 p-2">
          {(["drafts", "followups", "history"] as const).map((tab) => (
            <Button key={tab} variant={props.tab === tab ? "primary" : "ghost"} onClick={() => props.setTab(tab)}>
              {tab === "drafts" ? "Draft Queue" : tab === "followups" ? "Scheduled Follow-Ups" : "Outreach History"}
            </Button>
          ))}
        </Card>
        {props.tab === "followups" ? (
          <div className="grid gap-3">
            {props.followups.length ? props.followups.map((followup) => <FollowupCard key={followup.id} followup={followup} onOpen={() => props.reviewFollowup(followup)} />) : <EmptyState title="No follow-ups" detail="Follow-up tasks appear after approved emails are sent." />}
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleDrafts.length ? visibleDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} onOpen={() => props.startEditing(draft)} />) : <EmptyState title="No outreach messages here" detail="Drafts, manual messages, and history will appear as the pipeline runs." />}
          </div>
        )}
      </div>
      <Card className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto p-5">
        {props.tab === "followups" ? (
          props.selectedFollowup ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <SoftBadge tone={isDueOrOverdue(props.selectedFollowup.due_date) ? "bad" : toneFor(props.selectedFollowup.status)}>
                  {isDueOrOverdue(props.selectedFollowup.due_date) ? "Due Now" : labelFor(props.selectedFollowup.status)}
                </SoftBadge>
                <SoftBadge>Step {props.selectedFollowup.cadence_step}</SoftBadge>
              </div>
              <Field label="Status">
                <Select value={props.followupStatus} onChange={(event) => props.setFollowupStatus(event.target.value)}>
                  {followupStatuses.map((status) => (
                    <option key={status} value={status}>
                      {labelFor(status)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Follow-up draft note">
                <TextArea value={props.followupDraftBody} onChange={(event) => props.setFollowupDraftBody(event.target.value)} />
              </Field>
              <ContextBlock
                rows={[
                  ["Due", props.selectedFollowup.due_date],
                  ["Original subject", props.selectedFollowup.drafts?.subject || "No subject."],
                  ["Creator contact", props.selectedFollowup.drafts?.creators?.public_contact || "No creator contact."],
                  ["Opportunity", props.selectedFollowup.drafts?.opportunities?.summary || "No opportunity summary."]
                ]}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => props.updateFollowup()}>
                  <Save size={15} /> Save
                </Button>
                <Button variant="success" onClick={() => props.updateFollowup("completed")}>
                  <CheckCircle2 size={15} /> Complete
                </Button>
                <Button variant="danger" onClick={() => props.updateFollowup("skipped")}>
                  <XCircle size={15} /> Skip
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState title="Select a follow-up" detail="Review cadence, source context, and outcome." />
          )
        ) : props.editingDraft ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <SoftBadge tone={toneFor(props.editingDraft.status)}>{labelFor(props.editingDraft.status)}</SoftBadge>
              <SoftBadge>{labelFor(props.editingDraft.channel)}</SoftBadge>
            </div>
            <Field label="Subject">
              <TextInput value={props.draftSubject} onChange={(event) => props.setDraftSubject(event.target.value)} disabled={props.editingDraft.status === "sent"} />
            </Field>
            <Field label="Body">
              <TextArea className="min-h-72" value={props.draftBody} onChange={(event) => props.setDraftBody(event.target.value)} disabled={props.editingDraft.status === "sent"} />
            </Field>
            <ContextBlock
              rows={[
                ["Recipient/contact", props.editingDraft.creators?.public_contact || "No creator contact."],
                ["Creator", props.editingDraft.creators?.name || "No linked creator."],
                ["Opportunity", props.editingDraft.opportunities?.summary || "No opportunity summary."],
                ["XRWorkout fit", props.editingDraft.opportunities?.xrworkout_relevance || "No fit note."]
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={props.saveDraft} disabled={props.editingDraft.status === "sent"}>
                <Save size={15} /> Save text
              </Button>
              <Button variant="secondary" onClick={() => props.changeDraftStatus("edit_needed")} disabled={props.editingDraft.status === "sent"}>
                <ShieldAlert size={15} /> Edit needed
              </Button>
              <Button variant="danger" onClick={() => props.changeDraftStatus("rejected")} disabled={props.editingDraft.status === "sent"}>
                <XCircle size={15} /> Reject
              </Button>
              <Button variant="success" onClick={() => props.changeDraftStatus("approved")} disabled={props.editingDraft.status === "sent"}>
                <CheckCircle2 size={15} /> Approve
              </Button>
              <Button
                variant="success"
                onClick={() => props.changeDraftStatus("approved", true)}
                disabled={props.editingDraft.status === "sent" || props.editingDraft.channel !== "email" || !props.dryRunSendEnabled}
              >
                <MailCheck size={15} /> Approve + dry-run
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState title="Select a message" detail="Review generated text, safety context, recipient, and workflow actions." />
        )}
      </Card>
    </div>
  );
}

function ExportView({
  query,
  setQuery,
  format,
  setFormat,
  request,
  rows,
  totalCreators,
  download
}: {
  query: string;
  setQuery: (value: string) => void;
  format: ExportFormat;
  setFormat: (value: ExportFormat) => void;
  request: ContactExportRequest;
  rows: ContactExportRow[];
  totalCreators: number;
  download: () => void;
}) {
  const followerFilter =
    request.minFollowers !== null && request.maxFollowers !== null
      ? `${followerCountLabel(request.minFollowers)} to ${followerCountLabel(request.maxFollowers)}`
      : "Any follower count";
  const matchedProspects = rows.filter((row) => row.recordType === "Prospect").length;
  const matchedConversations = rows.filter((row) => row.recordType === "Conversation").length;
  const minimumQuality =
    request.minOpportunityScore !== null
      ? `Score ${request.minOpportunityScore}+`
      : request.priorityFloor !== "all"
        ? `${labelFor(request.priorityFloor)}+`
        : "Any score";

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white">Prospect Export Builder</h3>
            <p className="mt-1 text-sm text-zinc-500">Build a downloadable prospect list from creators, opportunity authors, conversation leads, and existing draft context.</p>
          </div>
          <Button variant="primary" onClick={download} disabled={!rows.length}>
            <FileDown size={15} /> Download {request.format.toUpperCase()}
          </Button>
        </div>
        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px]">
          <Field label="Request">
            <TextArea
              className="min-h-24"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="First 200 records score 50+ with sample messages"
            />
          </Field>
          <Field label="File format">
            <Select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="txt">Readable text</option>
            </Select>
          </Field>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="p-4"><MiniStat label="Matched Prospects" value={matchedProspects} /></Card>
        <Card className="p-4"><MiniStat label="Matched Conversations" value={matchedConversations} /></Card>
        <Card className="p-4"><MiniStat label="Minimum Quality" value={minimumQuality} /></Card>
        <Card className="p-4"><MiniStat label="Download Limit" value={request.limit} /></Card>
      </section>
      <p className="text-xs text-zinc-500">Follower filter: {followerFilter}. Available creator records: {totalCreators}.</p>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Export Preview</h3>
              <p className="mt-1 text-sm text-zinc-500">Sorted by contact readiness, opportunity quality, source quality, and smaller audience fit.</p>
            </div>
            <SoftBadge tone={rows.length ? "good" : "warn"}>{rows.length ? "Ready" : "No matches"}</SoftBadge>
          </div>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Person</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Followers</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Fit</th>
                  <th className="px-4 py-3 font-medium">Sample Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.slice(0, 100).map((row) => (
                  <tr key={`${row.platform}-${row.profile}`} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-white">{row.name}</p>
                      <a className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-200" href={row.profile} target="_blank" rel="noreferrer">
                        {row.platform} <ExternalLink size={12} />
                      </a>
                    </td>
                    <td className="px-4 py-4 text-zinc-400">
                      <p>{row.sourceKind}</p>
                      {row.source ? (
                        <a className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-200" href={row.source} target="_blank" rel="noreferrer">
                          Source <ExternalLink size={12} />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-zinc-400">{row.contact}</td>
                    <td className="px-4 py-4 text-zinc-400">{row.followers}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <SoftBadge tone={toneFor(row.priority)}>{row.priority}</SoftBadge>
                        <SoftBadge>{row.score}</SoftBadge>
                        <SoftBadge>{row.status}</SoftBadge>
                      </div>
                    </td>
                    <td className="max-w-[260px] px-4 py-4 text-zinc-400">
                      <p className="line-clamp-3 leading-6">{row.fit}</p>
                    </td>
                    <td className="max-w-[360px] px-4 py-4 text-zinc-400">
                      <p className="line-clamp-4 leading-6">{row.sampleMessage}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState title="No prospects match this request" detail="Try a wider follower range or run source collection to bring in more conversation and opportunity leads." />
          </div>
        )}
      </Card>
    </div>
  );
}

function AutomationsView({
  automation,
  agents,
  updateVariable,
  dispatch,
  dispatchSourceCollection,
  cleanAutomaticStart,
  cleanStartRunning,
  dryRunSendEnabled
}: {
  automation: AutomationData | null;
  agents: ReturnType<typeof workflowAgents>;
  updateVariable: (name: "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND" | "APIFY_ENABLED" | "PROFILE_ENRICHMENT_ENABLED", value: string) => void;
  dispatch: (workflow: string) => void;
  dispatchSourceCollection: (source: string, classify?: boolean) => void;
  cleanAutomaticStart: () => void;
  cleanStartRunning: boolean;
  dryRunSendEnabled: boolean;
}) {
  const workflowSteps = ["Discovery", "Filtering", "Scoring", "Creator Detection", "Draft Generation", "Human Approval", "Outreach", "Analytics"];
  const sourceCollectors = [
    { source: "all", title: "All Sources", detail: "Runs Reddit, YouTube, Twitch, Apify conversations, forums, blogs, then classification." },
    { source: "apify_conversations", title: "Apify Conversations", detail: "Runs configured X, Facebook, Discord discovery, TikTok, or other Apify public conversation actors." },
    { source: "profile_enrichment", title: "Profile Enrichment", detail: "Enriches all known creator profiles with trusted recent-post history when PROFILE_ENRICHMENT_ENABLED is true." },
    { source: "forums", title: "VR Forums", detail: "Runs public Discourse/forum sources from FORUM_SOURCES_JSON." },
    { source: "blogs", title: "VR Blogs", detail: "Runs RSS/Atom feeds from BLOG_FEEDS_JSON." },
    { source: "reddit", title: "Reddit", detail: "Runs low-volume Reddit RSS collection." },
    { source: "youtube", title: "YouTube", detail: "Runs YouTube keyword collection." },
    { source: "twitch", title: "Twitch", detail: "Runs Twitch channel collection." }
  ];
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        {agents.map((agent) => (
          <Card key={agent.name} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-white">{agent.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">{agent.description}</p>
              </div>
              <Bot className="text-cyan-200" size={18} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniStat label="Completed" value={agent.completed} />
              <MiniStat label="Found" value={agent.found} />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <SoftBadge tone={toneFor(agent.status)}>{labelFor(agent.status)}</SoftBadge>
              <span className="text-xs text-zinc-500">{shortDate(agent.lastRun)}</span>
            </div>
          </Card>
        ))}
      </section>
      <Card className="p-5">
        <h3 className="font-semibold text-white">Agentic Workflow</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {workflowSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3">
              <div className="grid min-h-20 flex-1 place-items-center rounded-lg border border-white/10 bg-white/[0.035] p-3 text-center text-sm text-zinc-200">
                {step}
              </div>
              {index < workflowSteps.length - 1 ? <ArrowRight className="hidden text-zinc-600 xl:block" size={16} /> : null}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Clean Automatic Start</h3>
            <p className="mt-1 text-sm text-zinc-500">Refreshes outreach data, runs Reddit, YouTube, Twitch, Apify conversations when enabled, public forums, blogs, classification, creator discovery, and draft generation. Scheduled sending stays disabled and send dispatch stays dry-run only.</p>
          </div>
          <Button variant="primary" onClick={cleanAutomaticStart} disabled={cleanStartRunning}>
            <RefreshCw size={15} /> {cleanStartRunning ? "Starting..." : "Clean start"}
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Run Missing Source</h3>
            <p className="mt-1 text-sm text-zinc-500">Run a specific collector when the Conversation Map is missing data. Each run classifies new rows by default.</p>
          </div>
          <SoftBadge tone="info">Manual collection</SoftBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sourceCollectors.map((collector) => (
            <div key={collector.source} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <h4 className="text-sm font-semibold text-white">{collector.title}</h4>
              <p className="mt-2 min-h-12 text-xs leading-5 text-zinc-500">{collector.detail}</p>
              <Button className="mt-3 w-full" variant={collector.source === "all" ? "primary" : "secondary"} onClick={() => dispatchSourceCollection(collector.source, collector.source !== "profile_enrichment")}>
                <Play size={14} /> Run
              </Button>
            </div>
          ))}
        </div>
      </Card>
      <section className="grid gap-4 xl:grid-cols-3">
        {(["AUTOMATION_ENABLED", "APIFY_ENABLED", "PROFILE_ENRICHMENT_ENABLED", "SEND_AUTOMATION_ENABLED", "DRY_RUN_SEND"] as const).map((name) => {
          const value = automation?.variables[name] || (name === "DRY_RUN_SEND" ? "true" : "false");
          return (
            <Card key={name} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-white">{name}</h3>
                <SoftBadge tone={toneFor(value)}>{value}</SoftBadge>
              </div>
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => updateVariable(name, "false")}>Set false</Button>
                <Button variant="primary" onClick={() => updateVariable(name, "true")}>Set true</Button>
              </div>
            </Card>
          );
        })}
      </section>
      <section className="grid gap-4 xl:grid-cols-6">
        {(["collection", "sourceCollection", "drafts", "manualDraft", "send", "report"] as const).map((workflow) => {
          const run = automation?.workflows[workflow];
          const isManualDraftWorkflow = workflow === "manualDraft";
          return (
            <Card key={workflow} className="p-4">
              <h3 className="font-semibold text-white">{isManualDraftWorkflow ? "Selected Draft" : workflow === "sourceCollection" ? "Source Collection" : labelFor(workflow)}</h3>
              <p className="mt-2 text-sm text-zinc-500">Last run: {shortDate(run?.created_at)}</p>
              <div className="mt-3">
                <SoftBadge tone={toneFor(run?.conclusion || run?.status || "unknown")}>{labelFor(run?.conclusion || run?.status || "unknown")}</SoftBadge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {run?.html_url ? (
                  <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-100" href={run.html_url} target="_blank" rel="noreferrer">
                    Open <ExternalLink size={14} />
                  </a>
                ) : null}
                <Button variant="primary" onClick={() => dispatch(workflow)} disabled={isManualDraftWorkflow || workflow === "sourceCollection" || (workflow === "send" && !dryRunSendEnabled)}>
                  <Play size={15} /> Run
                </Button>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function RunMonitorView({ automation, refresh }: { automation: AutomationData | null; refresh: () => void }) {
  const runDetails = automation?.runDetails;
  const workflowOrder = ["cleanStart", "collection", "sourceCollection", "drafts", "manualDraft", "send", "report"] as const;
  const runs = workflowOrder.map((workflow) => runDetails?.[workflow] || null);
  const activeRuns = runs.filter(isActiveRun).length;
  const failedRuns = runs.filter((run) => run?.conclusion === "failure" || run?.conclusion === "timed_out").length;
  const latestRun = runs.find((run): run is WorkflowRunDetail => Boolean(run));

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="p-4"><MiniStat label="Active Runs" value={activeRuns} /></Card>
        <Card className="p-4"><MiniStat label="Failed Latest Runs" value={failedRuns} /></Card>
        <Card className="p-4"><MiniStat label="Latest Progress" value={`${workflowProgress(latestRun)}%`} /></Card>
        <Card className="p-4"><MiniStat label="Last Update" value={shortDate(latestRun?.updated_at)} /></Card>
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Live Workflow Monitor</h3>
            <p className="mt-1 text-sm text-zinc-500">Tracks GitHub Actions jobs, step timing, failed steps, and likely operator fixes.</p>
          </div>
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </Card>

      <div className="grid gap-4">
        {workflowOrder.map((workflow) => {
          const run = runDetails?.[workflow] || null;
          const issue = workflowIssue(run);
          const status = run?.conclusion || run?.status || "unknown";
          const progress = workflowProgress(run);
          return (
            <Card key={workflow} className="overflow-hidden p-0">
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{workflow === "cleanStart" ? "Clean Start" : workflow === "sourceCollection" ? "Source Collection" : labelFor(workflow)}</h3>
                      <SoftBadge tone={toneFor(status)}>{labelFor(status)}</SoftBadge>
                      {run?.run_id ? <SoftBadge>Run #{run.run_id}</SoftBadge> : null}
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">
                      Started {shortDate(run?.run_started_at || run?.created_at)} · Duration {runDurationLabel(run?.run_started_at || run?.created_at, run?.conclusion ? run?.updated_at : null)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {run?.html_url ? (
                      <a className="inline-flex min-h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-zinc-100" href={run.html_url} target="_blank" rel="noreferrer">
                        Open run <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      status === "success" ? "bg-emerald-300" : status === "failure" || status === "timed_out" ? "bg-red-300" : "bg-cyan-300"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {issue ? (
                  <div className="mt-4 rounded-lg border border-red-300/20 bg-red-300/8 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 text-red-200" size={17} />
                      <div>
                        <p className="text-sm font-medium text-red-100">Failed at: {issue.name}</p>
                        <p className="mt-1 text-sm leading-6 text-red-100/75">{issue.likely_fix}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 p-5">
                {run?.jobs.length ? (
                  run.jobs.map((job) => (
                    <div key={job.id} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{job.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {job.started_at ? `Started ${shortDate(job.started_at)}` : "Waiting for runner"} · {runDurationLabel(job.started_at, job.completed_at)}
                          </p>
                        </div>
                        <SoftBadge tone={toneFor(job.conclusion || job.status || "unknown")}>{labelFor(job.conclusion || job.status || "unknown")}</SoftBadge>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {job.steps.map((step) => {
                          const duration = stepDurationSeconds(step.started_at, step.completed_at);
                          const stepStatus = step.conclusion || step.status || "pending";
                          return (
                            <div key={`${job.id}-${step.number}`} className="grid gap-3 rounded-md border border-white/10 bg-black/20 p-3 md:grid-cols-[28px_minmax(0,1fr)_120px_120px] md:items-center">
                              <div className="text-zinc-400">
                                {step.conclusion === "success" ? <CheckCircle2 className="text-emerald-200" size={17} /> : step.conclusion === "failure" || step.conclusion === "timed_out" ? <XCircle className="text-red-200" size={17} /> : <CircleDot className="text-cyan-200" size={17} />}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-zinc-100">{step.name}</p>
                                {step.conclusion === "failure" || step.conclusion === "timed_out" ? <p className="mt-1 text-xs leading-5 text-red-100/75">{step.likely_fix}</p> : null}
                              </div>
                              <SoftBadge tone={toneFor(stepStatus)}>{labelFor(stepStatus)}</SoftBadge>
                              <div className="text-xs text-zinc-500">
                                <span>{duration === null ? "Actual pending" : `Actual ${estimateLabel(duration).replace("~", "")}`}</span>
                                <span className="mx-1">·</span>
                                <span>{estimateLabel(step.estimate_seconds)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No job details yet" detail="GitHub has not reported step-level data for this workflow run yet." />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function AnalyticsView({ summary, opportunities, creators, drafts, rawItems }: { summary: SummaryData | null; opportunities: Opportunity[]; creators: Creator[]; drafts: Draft[]; rawItems: RawItem[] }) {
  const funnel = funnelData(summary, opportunities, creators, drafts);
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <Card className="p-4"><MiniStat label="Response Rate" value={responseRate(drafts)} /></Card>
        <Card className="p-4"><MiniStat label="Conversion Rate" value={conversionRate(creators)} /></Card>
        <Card className="p-4"><MiniStat label="Top Source" value={summary?.sourceQuality[0]?.source ? platformLabel(summary.sourceQuality[0].source) : "None"} /></Card>
        <Card className="p-4"><MiniStat label="Qualified" value={funnel[1].value} /></Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Conversations Over Time"><AreaSummary data={conversationsByDay(rawItems)} /></ChartCard>
        <ChartCard title="Outreach Sent"><AreaSummary data={outreachByDay(drafts)} /></ChartCard>
        <ChartCard title="Top Performing Platforms"><BarSummary data={(summary?.sourceQuality || []).slice(0, 6).map((row) => ({ name: platformLabel(row.source), value: row.highPriority || row.opportunities }))} /></ChartCard>
        <ChartCard title="Response + Conversion Funnel"><BarSummary data={funnel} /></ChartCard>
      </section>
      <Card className="p-5">
        <h3 className="font-semibold text-white">Source Attribution</h3>
        <div className="mt-4 grid gap-2">
          {(summary?.sourceQuality || []).map((source) => (
            <div key={source.source} className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400 md:grid-cols-6">
              <strong className="text-zinc-100">{platformLabel(source.source)}</strong>
              <span>{source.rawItems} conversations</span>
              <span>{source.opportunities} opportunities</span>
              <span>{source.highPriority} high priority</span>
              <span>avg {source.averageScore}</span>
              <span>{source.drafts} drafts</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SettingsView({ session, automation, nodes, updateVariable }: { session: SessionState; automation: AutomationData | null; nodes: ReturnType<typeof platformNodes>; updateVariable: (name: "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND" | "APIFY_ENABLED" | "PROFILE_ENRICHMENT_ENABLED", value: string) => void }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-semibold text-white">Operator</h3>
        <p className="mt-3 text-sm text-zinc-400">{session.email}</p>
        <p className="mt-2 text-sm text-zinc-500">Secrets are not exposed in the dashboard.</p>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold text-white">Safety State</h3>
        <div className="mt-4 grid gap-3">
          {(["AUTOMATION_ENABLED", "APIFY_ENABLED", "PROFILE_ENRICHMENT_ENABLED", "SEND_AUTOMATION_ENABLED", "DRY_RUN_SEND"] as const).map((name) => {
            const value = automation?.variables[name] || (name === "DRY_RUN_SEND" ? "true" : "false");
            return (
              <div key={name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <span className="text-sm text-zinc-300">{name}</span>
                <div className="flex gap-2">
                  <SoftBadge tone={toneFor(value)}>{value}</SoftBadge>
                  <Button variant="secondary" onClick={() => updateVariable(name, value === "true" ? "false" : "true")}>Toggle</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card className="p-5 xl:col-span-2">
        <h3 className="font-semibold text-white">Integration Status</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {nodes.map((node) => (
            <div key={node.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-100">{node.label}</span>
                <SoftBadge tone={node.live ? "good" : "bad"}>{node.live ? "Live" : "Inactive"}</SoftBadge>
              </div>
              <p className="mt-2 text-xs text-zinc-500">{node.volume} conversations, {node.opportunities} opportunities</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AssistantPanel({ recommendations, onOpen }: { recommendations: Recommendation[]; onOpen: (recommendation: Recommendation) => void }) {
  return (
    <aside className="hidden xl:block">
      <Card className="sticky top-20 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-cyan-200" size={18} />
          <h3 className="font-semibold text-white">AI Assistant</h3>
        </div>
        <p className="mt-2 text-sm text-zinc-500">Recommended next moves from current outreach data.</p>
        <div className="mt-5 grid gap-3">
          {recommendations.length ? recommendations.map((item) => (
            <button key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-300/30" onClick={() => onOpen(item)}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-zinc-100">{item.title}</p>
                <SoftBadge tone={item.confidence >= 80 ? "good" : "info"}>{item.confidence}%</SoftBadge>
              </div>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-500">{item.rationale}</p>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-200">
                {item.action} <ArrowRight size={13} />
              </p>
            </button>
          )) : <EmptyState title="No recommendations yet" detail="Recommendations appear when opportunities, drafts, creators, or follow-ups need action." />}
        </div>
      </Card>
    </aside>
  );
}

function DraftCard({ draft, onOpen }: { draft: Draft; onOpen: () => void }) {
  return (
    <button className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/30" onClick={onOpen}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-white">{draft.subject || labelFor(draft.channel)}</h3>
          <p className="mt-1 text-sm text-zinc-500">{draft.creators?.name || "No creator"} • {platformLabel(draft.opportunities?.platform || draft.channel)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SoftBadge tone={toneFor(draft.status)}>{labelFor(draft.status)}</SoftBadge>
          <SoftBadge>{labelFor(draft.channel)}</SoftBadge>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500">{draft.body}</p>
    </button>
  );
}

function FollowupCard({ followup, onOpen }: { followup: Followup; onOpen: () => void }) {
  return (
    <button className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/30" onClick={onOpen}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-white">{followup.drafts?.subject || "Follow-up task"}</h3>
          <p className="mt-1 text-sm text-zinc-500">{followup.drafts?.creators?.name || "No creator"} • Due {followup.due_date}</p>
        </div>
        <SoftBadge tone={isDueOrOverdue(followup.due_date) ? "bad" : toneFor(followup.status)}>
          {isDueOrOverdue(followup.due_date) ? "Due" : labelFor(followup.status)}
        </SoftBadge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-500">{followup.draft_body || followup.drafts?.body || "Review the original outreach and decide the next touch."}</p>
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ContextBlock({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <div className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">{label}</p>
          <div className="mt-1 text-sm leading-6 text-zinc-300">{value}</div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-white">{title}</h3>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
