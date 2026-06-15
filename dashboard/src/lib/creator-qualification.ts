import type { Creator } from "@/lib/types";

export type CreatorQualificationState = "qualified" | "review" | "observed_only" | "unknown";

export type CreatorQualificationDecision = {
  state: CreatorQualificationState;
  canQualify: boolean;
  canContactReady: boolean;
  label: string;
  metricBasis: "profile_history" | "observed_only" | "unknown";
  reasons: string[];
};

const PROFILE_HISTORY_QUALITIES = new Set(["profile_history", "profile_history_plus_observed"]);
const OBSERVED_ONLY_QUALITIES = new Set(["accumulated_observed_posts", "observed_post", "conversation_author"]);
const UNKNOWN_QUALITIES = new Set(["no_history", "partial_history", "failed_enrichment", "enrichment_failed"]);
const SAFETY_RISK_RE = /(?:unsafe|spam|kids|children|child|medical|weight loss|guarantee|competitor|official account|brand-owned|do not engage|reject)/i;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function daysOld(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

export function creatorEvidenceQualityValue(creator: Pick<Creator, "evidence_json">) {
  return stringValue(creator.evidence_json?.computed_evidence_quality);
}

export function hasComputedActivityEvidence(creator: Pick<Creator, "evidence_json">) {
  const quality = creatorEvidenceQualityValue(creator);
  return PROFILE_HISTORY_QUALITIES.has(quality) || OBSERVED_ONLY_QUALITIES.has(quality);
}

export function creatorMetricBasis(creator: Pick<Creator, "evidence_json">): "profile_history" | "observed_only" | "unknown" {
  const quality = creatorEvidenceQualityValue(creator);
  if (PROFILE_HISTORY_QUALITIES.has(quality)) return "profile_history";
  if (OBSERVED_ONLY_QUALITIES.has(quality)) return "observed_only";
  return "unknown";
}

export function activityMetricLabel(creator: Pick<Creator, "evidence_json">, metric: "vr" | "total") {
  const basis = creatorMetricBasis(creator);
  if (basis === "profile_history") return metric === "vr" ? "VR/XR 90d" : "Posts 90d";
  if (basis === "observed_only") return metric === "vr" ? "VR/XR observed" : "Posts observed";
  return metric === "vr" ? "VR/XR 90d" : "Posts 90d";
}

export function activityMetricValue(creator: Pick<Creator, "evidence_json">, value?: number | null) {
  return hasComputedActivityEvidence(creator) ? value ?? 0 : "Unknown";
}

export function qualificationDecision(creator: Creator): CreatorQualificationDecision {
  const reasons: string[] = [];
  const quality = creatorEvidenceQualityValue(creator);
  const basis = creatorMetricBasis(creator);
  const score = numberValue(creator.creator_quality_score) ?? 0;
  const vrCount = numberValue(creator.recent_vr_posts_count) ?? 0;
  const totalCount = numberValue(creator.recent_total_posts_count) ?? 0;
  const lastPostDays = daysOld(creator.last_post_at);
  const movementEvidence = stringValue(creator.movement_fit_evidence);
  const headsetEvidence = stringValue(creator.headset_evidence);
  const headsetConfidence = stringValue(creator.headset_confidence).toLowerCase();
  const safetyNotes = stringValue(creator.safety_notes);
  const contact = stringValue(creator.public_contact || creator.contactability_evidence);

  if (!quality || UNKNOWN_QUALITIES.has(quality) || basis === "unknown") {
    reasons.push("No reliable computed activity evidence is available.");
  }
  if (basis === "observed_only") {
    reasons.push("Evidence is observed-only from stored source records, not validated profile history.");
  }
  if (!PROFILE_HISTORY_QUALITIES.has(quality)) {
    reasons.push("Qualified requires full profile-history evidence.");
  }
  if (score < 85) reasons.push("Qualified requires creator quality score >= 85.");
  if (vrCount < 2) reasons.push("Qualified requires at least 2 recent VR/XR posts.");
  if (totalCount < 3) reasons.push("Qualified requires at least 3 recent profile-history posts.");
  if (lastPostDays === null || lastPostDays > 90) reasons.push("Qualified requires recent activity inside the 90-day window.");
  if (!movementEvidence) reasons.push("Qualified requires movement or fitness evidence.");
  if (!headsetEvidence && !["high", "medium"].includes(headsetConfidence)) {
    reasons.push("Qualified requires headset or XR ownership/use evidence.");
  }
  if (safetyNotes && SAFETY_RISK_RE.test(safetyNotes)) reasons.push("Safety notes require review before qualification.");

  const canQualify = reasons.length === 0;
  const canContactReady = canQualify && Boolean(contact);
  const state: CreatorQualificationState = canQualify
    ? "qualified"
    : basis === "observed_only"
      ? "observed_only"
      : basis === "unknown"
        ? "unknown"
        : "review";

  return {
    state,
    canQualify,
    canContactReady,
    metricBasis: basis,
    label: canQualify
      ? "Qualified"
      : state === "observed_only"
        ? "Review - observed only"
        : state === "unknown"
          ? "Unknown / insufficient data"
          : "Review",
    reasons
  };
}

export function qualificationSummary(creator: Creator) {
  const decision = qualificationDecision(creator);
  return decision.canQualify
    ? "Meets deterministic qualification rules."
    : decision.reasons.join(" ");
}

export function creatorStatusUpdateError(creator: Creator, requestedStatus?: string | null) {
  const decision = qualificationDecision(creator);
  if (requestedStatus === "qualified" && !decision.canQualify) {
    return `cannot mark creator Qualified: ${qualificationSummary(creator)}`;
  }
  if (requestedStatus === "contact_ready" && !decision.canContactReady) {
    const reason = decision.canQualify ? "validated public contact is required before Contact Ready" : qualificationSummary(creator);
    return `cannot mark creator Contact Ready: ${reason}`;
  }
  return null;
}
