export type RawItem = {
  id: string;
  source: string;
  source_url?: string | null;
  external_id?: string | null;
  title?: string | null;
  body?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  published_at?: string | null;
  collected_at?: string | null;
  processed_at?: string | null;
  follower_count?: number | null;
  raw_json?: Record<string, unknown> | null;
};

export type Opportunity = {
  id: string;
  platform: string;
  opportunity_type: string;
  summary?: string | null;
  pain_point?: string | null;
  xrworkout_relevance?: string | null;
  audience_type?: string | null;
  score: number;
  priority: string;
  recommended_action: string;
  outreach_safety: string;
  status: string;
  created_at: string;
  raw_items?: RawItem | null;
};

export type Creator = {
  id: string;
  name: string;
  platform: string;
  profile_url: string;
  public_contact?: string | null;
  niche?: string | null;
  follower_count?: number | null;
  audience_estimate?: string | null;
  audience_quality?: string | null;
  recent_relevant_content?: string | null;
  fit_reason?: string | null;
  offer_angle?: string | null;
  creator_quality_score?: number | null;
  recent_vr_posts_count?: number | null;
  recent_total_posts_count?: number | null;
  last_post_at?: string | null;
  activity_level?: string | null;
  vr_involvement_evidence?: string | null;
  movement_fit_evidence?: string | null;
  headset_evidence?: string | null;
  headset_confidence?: string | null;
  engagement_evidence?: string | null;
  contactability_evidence?: string | null;
  safety_notes?: string | null;
  evidence_json?: Record<string, unknown> | null;
  priority: string;
  status: string;
  created_at: string;
};

export type Draft = {
  id: string;
  opportunity_id?: string | null;
  creator_id?: string | null;
  channel: string;
  subject?: string | null;
  body: string;
  status: string;
  approved_by?: string | null;
  sent_at?: string | null;
  response_status?: string | null;
  created_at: string;
  updated_at: string;
  creators?: Creator | null;
  opportunities?: Opportunity | null;
};

export type Followup = {
  id: string;
  draft_id?: string | null;
  due_date: string;
  cadence_step: number;
  draft_body?: string | null;
  status: string;
  created_at: string;
  drafts?: Draft | null;
};

export type Offer = {
  id: string;
  creator_id?: string | null;
  offer_type: string;
  code_or_link?: string | null;
  sent_at?: string | null;
  redeemed: boolean;
  content_committed: boolean;
  content_url?: string | null;
  outcome?: string | null;
  created_at: string;
  creators?: Creator | null;
};

export type SummaryData = {
  counts: {
    rawItems: number;
    opportunities: number;
    creators: number;
    drafts: number;
    followups: number;
    offers: number;
  };
  rawItems: RawItem[];
  opportunities: Array<{ priority: string; status: string; platform: string; score: number }>;
  drafts: Array<{ status: string; channel: string; opportunities?: { platform?: string | null; raw_items?: { source?: string | null } | null } | null }>;
  followups: Array<{ status: string; due_date: string }>;
  creators: Array<{ status: string; public_contact?: string | null }>;
  sourceQuality: Array<{
    source: string;
    rawItems: number;
    opportunities: number;
    highPriority: number;
    averageScore: number;
    drafts: number;
    approvedOrSent: number;
  }>;
  actionQueue: {
    highPriorityOpportunities: number;
    draftsNeedingReview: number;
    approvedDrafts: number;
    sentDrafts: number;
    rejectedDrafts: number;
    creatorsMissingContact: number;
    creatorsContactReady: number;
    dueFollowups: number;
  };
};

export type AutomationData = {
  variables: {
    AUTOMATION_ENABLED: string;
    SEND_AUTOMATION_ENABLED: string;
    DRY_RUN_SEND: string;
    APIFY_ENABLED?: string;
  };
  workflows: Record<
    "collection" | "drafts" | "manualDraft" | "send" | "report" | "cleanStart",
    | {
        id: number;
        name: string | null;
        status: string | null;
        conclusion: string | null;
        created_at: string;
        html_url: string;
      }
    | null
  >;
  runDetails?: Record<"collection" | "drafts" | "manualDraft" | "send" | "report" | "cleanStart", WorkflowRunDetail | null>;
};

export type WorkflowRunStep = {
  name: string;
  number: number;
  status: string | null;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimate_seconds: number;
  likely_fix: string;
};

export type WorkflowRunJob = {
  id: number;
  name: string;
  status: string | null;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string;
  steps: WorkflowRunStep[];
};

export type WorkflowRunDetail = {
  workflow: "collection" | "drafts" | "manualDraft" | "send" | "report" | "cleanStart";
  run_id: number;
  name: string | null;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at: string | null;
  html_url: string;
  jobs: WorkflowRunJob[];
};
