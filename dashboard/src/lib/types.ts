export type RawItem = {
  id: string;
  source: string;
  source_url?: string | null;
  title?: string | null;
  author_name?: string | null;
  collected_at?: string | null;
  processed_at?: string | null;
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
  audience_quality?: string | null;
  fit_reason?: string | null;
  offer_angle?: string | null;
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
  rawItems: Array<{ source: string; processed_at?: string | null }>;
  opportunities: Array<{ priority: string; status: string; platform: string }>;
  drafts: Array<{ status: string; channel: string }>;
  followups: Array<{ status: string; due_date: string }>;
};

export type AutomationData = {
  variables: {
    AUTOMATION_ENABLED: string;
    DRY_RUN_SEND: string;
  };
  workflows: Record<
    "collection" | "drafts" | "send" | "report",
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
};
