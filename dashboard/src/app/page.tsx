"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  Bot,
  CheckCircle2,
  Edit3,
  ExternalLink,
  LogOut,
  MailCheck,
  Play,
  RefreshCw,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  XCircle
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BarSummary, groupCounts, PieSummary } from "@/components/Charts";
import { DataTable } from "@/components/DataTable";
import { Badge, statusTone } from "@/components/Badge";
import { Metric } from "@/components/Metric";
import { clientSupabase, hasClientSupabaseConfig } from "@/lib/client-supabase";
import type { AutomationData, Creator, Draft, Followup, Offer, Opportunity, SummaryData } from "@/lib/types";

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

const emptyData: DashboardData = {
  summary: null,
  opportunities: [],
  drafts: [],
  creators: [],
  followups: [],
  offers: [],
  automation: null
};

const tabs = ["overview", "opportunities", "drafts", "creators", "followups", "offers", "automation"] as const;
type Tab = (typeof tabs)[number];

const opportunityStatuses = ["new", "reviewed", "monitor", "contacted", "rejected"] as const;
const creatorStatuses = ["new", "reviewed", "contact_ready", "contacted", "rejected"] as const;
const priorities = ["high", "medium", "low"] as const;
const followupStatuses = ["pending", "completed", "skipped"] as const;

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

function formatDate(value?: string | null) {
  if (!value) return "none";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function Page() {
  const hasSupabaseConfig = hasClientSupabaseConfig();
  const supabase = useMemo(() => clientSupabase(), []);
  const [session, setSession] = useState<SessionState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
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
  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null);
  const [followupStatus, setFollowupStatus] = useState("pending");
  const [followupDraftBody, setFollowupDraftBody] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [offerType, setOfferType] = useState("");
  const [offerCode, setOfferCode] = useState("");
  const [offerSentAt, setOfferSentAt] = useState("");
  const [offerRedeemed, setOfferRedeemed] = useState(false);
  const [offerCommitted, setOfferCommitted] = useState(false);
  const [offerContentUrl, setOfferContentUrl] = useState("");
  const [offerOutcome, setOfferOutcome] = useState("");
  const [cleanStartRunning, setCleanStartRunning] = useState(false);

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
    if (!hasSupabaseConfig) {
      return;
    }
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
    setActiveTab("drafts");
  }

  function reviewOpportunity(opportunity: Opportunity) {
    setSelectedOpportunity(opportunity);
    setOpportunityStatus(opportunity.status || "new");
    setActiveTab("opportunities");
  }

  function reviewCreator(creator: Creator) {
    setSelectedCreator(creator);
    setCreatorStatus(creator.status || "new");
    setCreatorContact(creator.public_contact || "");
    setCreatorPriority(creator.priority || "medium");
    setCreatorFitReason(creator.fit_reason || "");
    setCreatorOfferAngle(creator.offer_angle || "");
    setActiveTab("creators");
  }

  function reviewFollowup(followup: Followup) {
    setSelectedFollowup(followup);
    setFollowupStatus(followup.status || "pending");
    setFollowupDraftBody(followup.draft_body || "");
    setActiveTab("followups");
  }

  function reviewOffer(offer: Offer) {
    setSelectedOffer(offer);
    setOfferType(offer.offer_type || "3 months free");
    setOfferCode(offer.code_or_link || "");
    setOfferSentAt(offer.sent_at || "");
    setOfferRedeemed(Boolean(offer.redeemed));
    setOfferCommitted(Boolean(offer.content_committed));
    setOfferContentUrl(offer.content_url || "");
    setOfferOutcome(offer.outcome || "");
    setActiveTab("offers");
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
    setNotice(result.sendWorkflowDispatched ? "Draft approved and send workflow started." : `Draft marked ${status}.`);
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

  async function generateLlmDraftFromOpportunity() {
    if (!session || !selectedOpportunity) return;
    await fetchJson(`/api/dashboard/automation/workflows/manualDraft/dispatch`, session.token, {
      method: "POST",
      body: JSON.stringify({
        inputs: { opportunity_id: selectedOpportunity.id }
      })
    });
    setNotice("LLM draft workflow started for this opportunity. Refresh drafts after the workflow completes.");
    void loadDashboard(session.token);
  }

  async function updateCreator() {
    if (!session || !selectedCreator) return;
    const result = await fetchJson<{ creator: Creator }>(`/api/dashboard/creators/${selectedCreator.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({
        status: creatorStatus,
        public_contact: creatorContact || null,
        priority: creatorPriority,
        fit_reason: creatorFitReason || null,
        offer_angle: creatorOfferAngle || null
      })
    });
    setData((current) => ({
      ...current,
      creators: current.creators.map((creator) => (creator.id === result.creator.id ? result.creator : creator))
    }));
    setSelectedCreator(result.creator);
    setNotice("Creator saved.");
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
    setNotice(`Follow-up marked ${result.followup.status}.`);
    void loadDashboard(session.token);
  }

  async function updateOffer() {
    if (!session || !selectedOffer) return;
    const result = await fetchJson<{ offer: Offer }>(`/api/dashboard/offers/${selectedOffer.id}`, session.token, {
      method: "PATCH",
      body: JSON.stringify({
        offer_type: offerType,
        code_or_link: offerCode || null,
        sent_at: offerSentAt || null,
        redeemed: offerRedeemed,
        content_committed: offerCommitted,
        content_url: offerContentUrl || null,
        outcome: offerOutcome || null
      })
    });
    setData((current) => ({
      ...current,
      offers: current.offers.map((offer) => (offer.id === result.offer.id ? result.offer : offer))
    }));
    setSelectedOffer(result.offer);
    setNotice("Offer saved.");
  }

  async function updateVariable(name: "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND", value: string) {
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
    setNotice(`${workflow} workflow started.`);
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

  const opportunityColumns = useMemo<ColumnDef<Opportunity>[]>(
    () => [
      { header: "Priority", accessorKey: "priority", cell: ({ row }) => <Badge tone={statusTone(row.original.priority)}>{row.original.priority}</Badge> },
      { header: "Score", accessorKey: "score" },
      { header: "Platform", accessorKey: "platform" },
      { header: "Type", accessorKey: "opportunity_type" },
      { header: "Safety", accessorKey: "outreach_safety" },
      { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status}</Badge> },
      { header: "Summary", accessorKey: "summary", cell: ({ row }) => <span className="line-clamp">{row.original.summary || "No summary"}</span> },
      {
        header: "Source",
        cell: ({ row }) =>
          row.original.raw_items?.source_url ? (
            <a href={row.original.raw_items.source_url} target="_blank" rel="noreferrer">
              Open <ExternalLink size={14} />
            </a>
          ) : (
            "none"
          )
      },
      {
        header: "Action",
        cell: ({ row }) => (
          <button className="icon-text small" onClick={() => reviewOpportunity(row.original)}>
            <Edit3 size={14} /> Review
          </button>
        )
      }
    ],
    []
  );

  const draftColumns = useMemo<ColumnDef<Draft>[]>(
    () => [
      { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status}</Badge> },
      { header: "Channel", accessorKey: "channel" },
      { header: "Subject", accessorKey: "subject", cell: ({ row }) => row.original.subject || "No subject" },
      { header: "Creator", cell: ({ row }) => row.original.creators?.name || "No creator" },
      { header: "Updated", accessorKey: "updated_at", cell: ({ row }) => formatDate(row.original.updated_at) },
      {
        header: "Action",
        cell: ({ row }) => (
          <button className="icon-text small" onClick={() => startEditing(row.original)}>
            <Edit3 size={14} /> Review
          </button>
        )
      }
    ],
    []
  );

  const creatorColumns = useMemo<ColumnDef<Creator>[]>(
    () => [
      { header: "Priority", accessorKey: "priority", cell: ({ row }) => <Badge tone={statusTone(row.original.priority)}>{row.original.priority}</Badge> },
      { header: "Name", accessorKey: "name" },
      { header: "Platform", accessorKey: "platform" },
      { header: "Contact", accessorKey: "public_contact", cell: ({ row }) => row.original.public_contact || "none" },
      { header: "Niche", accessorKey: "niche" },
      { header: "Fit", accessorKey: "fit_reason", cell: ({ row }) => <span className="line-clamp">{row.original.fit_reason || "none"}</span> },
      {
        header: "Action",
        cell: ({ row }) => (
          <button className="icon-text small" onClick={() => reviewCreator(row.original)}>
            <Edit3 size={14} /> Review
          </button>
        )
      }
    ],
    []
  );

  if (loading && !session) {
    return <main className="centered">Loading dashboard...</main>;
  }

  if (!session) {
    const configError = hasSupabaseConfig
      ? error
      : "Dashboard Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    return (
      <main className="login-page">
        <form className="login-panel" onSubmit={signIn}>
          <div>
            <p className="eyebrow">XRWorkout</p>
            <h1>Outreach dashboard</h1>
            <p className="muted">Sign in with an approved operator account.</p>
          </div>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {configError ? <p className="error">{configError}</p> : null}
          <button type="submit" className="primary" disabled={!hasSupabaseConfig}>Sign in</button>
        </form>
      </main>
    );
  }

  const summary = data.summary;
  const dryRunSendEnabled = (data.automation?.variables.DRY_RUN_SEND || "true") === "true";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">XRWorkout</p>
          <h1>Outreach</h1>
        </div>
        <nav>
          {tabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>
        <div className="operator">
          <span>{session.email}</span>
          <button className="icon-text" onClick={signOut}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Internal operator console</p>
            <h2>{activeTab}</h2>
          </div>
          <button className="icon-text" onClick={() => loadDashboard(session.token)}>
            <RefreshCw size={16} /> Refresh
          </button>
        </header>

        {notice ? <div className="notice">{notice}</div> : null}
        {error ? <div className="error-block">{error}</div> : null}
        {loading ? <div className="notice">Loading current outreach data...</div> : null}

        {activeTab === "overview" && summary ? (
          <div className="view-stack">
            <section className="metric-grid">
              <Metric label="Raw items" value={summary.counts.rawItems} detail="Collected signals" />
              <Metric label="Opportunities" value={summary.counts.opportunities} detail="Classified rows" />
              <Metric label="Creators" value={summary.counts.creators} detail="Prospect records" />
              <Metric label="Drafts" value={summary.counts.drafts} detail="Review queue" />
              <Metric label="Follow-ups" value={summary.counts.followups} detail="Pending cadence" />
              <Metric label="Offers" value={summary.counts.offers} detail="Creator offers" />
            </section>
            <section className="chart-grid">
              <div className="panel">
                <h3>Source mix</h3>
                <PieSummary data={groupCounts(summary.rawItems, "source")} />
              </div>
              <div className="panel">
                <h3>Opportunity priority</h3>
                <BarSummary data={groupCounts(summary.opportunities, "priority")} />
              </div>
              <div className="panel">
                <h3>Draft status</h3>
                <BarSummary data={groupCounts(summary.drafts, "status")} />
              </div>
              <div className="panel">
                <h3>Follow-up status</h3>
                <PieSummary data={groupCounts(summary.followups, "status")} />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "opportunities" ? (
          <div className="split">
            <DataTable data={data.opportunities} columns={opportunityColumns} searchPlaceholder="Filter opportunities" />
            <aside className="review-pane">
              {selectedOpportunity ? (
                <>
                  <div className="review-header">
                    <Badge tone={statusTone(selectedOpportunity.priority)}>{selectedOpportunity.priority}</Badge>
                    <Badge tone={statusTone(selectedOpportunity.outreach_safety)}>{selectedOpportunity.outreach_safety}</Badge>
                    <Badge tone="info">score {selectedOpportunity.score}</Badge>
                  </div>
                  <label>
                    Status
                    <select value={opportunityStatus} onChange={(event) => setOpportunityStatus(event.target.value)}>
                      {opportunityStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <div className="context-box">
                    <strong>Summary</strong>
                    <p>{selectedOpportunity.summary || "No summary."}</p>
                    <strong>Pain point</strong>
                    <p>{selectedOpportunity.pain_point || "No pain point."}</p>
                    <strong>XRWorkout fit</strong>
                    <p>{selectedOpportunity.xrworkout_relevance || "No relevance note."}</p>
                    <strong>Recommended action</strong>
                    <p>{selectedOpportunity.recommended_action}</p>
                  </div>
                  <div className="button-row">
                    <button className="primary icon-text" onClick={updateOpportunity}>
                      <Save size={16} /> Save status
                    </button>
                    {selectedOpportunity.raw_items?.source_url ? (
                      <a className="button-link" href={selectedOpportunity.raw_items.source_url} target="_blank" rel="noreferrer">
                        Open source <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </div>
                  <div className="context-box">
                    <strong>Generate draft from this opportunity</strong>
                    <p>Use your judgment to send this opportunity through the LLM draft workflow. The result will appear as a needs-review draft you can edit before approval.</p>
                  </div>
                  <div className="button-row">
                    <button className="success icon-text" onClick={generateLlmDraftFromOpportunity}>
                      <Edit3 size={16} /> Generate LLM draft
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select an opportunity to inspect fit, safety, source context, and status.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "drafts" ? (
          <div className="split">
            <DataTable data={data.drafts} columns={draftColumns} searchPlaceholder="Filter drafts" />
            <aside className="review-pane">
              {editingDraft ? (
                <>
                  <div className="review-header">
                    <Badge tone={statusTone(editingDraft.status)}>{editingDraft.status}</Badge>
                    <Badge tone={editingDraft.channel === "email" ? "good" : "warn"}>{editingDraft.channel}</Badge>
                  </div>
                  <label>
                    Subject
                    <input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} disabled={editingDraft.status === "sent"} />
                  </label>
                  <label>
                    Body
                    <textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} disabled={editingDraft.status === "sent"} />
                  </label>
                  <div className="context-box">
                    <strong>Opportunity</strong>
                    <p>{editingDraft.opportunities?.summary || "No opportunity summary available."}</p>
                    <strong>Creator</strong>
                    <p>{editingDraft.creators?.name || "No linked creator."}</p>
                  </div>
                  <div className="button-row">
                    <button className="primary icon-text" onClick={saveDraft} disabled={editingDraft.status === "sent"}>
                      <Edit3 size={16} /> Save text
                    </button>
                    <button className="icon-text" onClick={() => changeDraftStatus("edit_needed")} disabled={editingDraft.status === "sent"}>
                      <ShieldAlert size={16} /> Edit needed
                    </button>
                    <button className="danger icon-text" onClick={() => changeDraftStatus("rejected")} disabled={editingDraft.status === "sent"}>
                      <XCircle size={16} /> Reject
                    </button>
                    <button className="success icon-text" onClick={() => changeDraftStatus("approved")} disabled={editingDraft.status === "sent" || editingDraft.channel !== "email"}>
                      <CheckCircle2 size={16} /> Approve
                    </button>
                    <button
                      className="success icon-text"
                      onClick={() => changeDraftStatus("approved", true)}
                      disabled={editingDraft.status === "sent" || editingDraft.channel !== "email" || !dryRunSendEnabled}
                      title={dryRunSendEnabled ? "Approve and dispatch the dry-run send workflow" : "DRY_RUN_SEND must be true for this action"}
                    >
                      <MailCheck size={16} /> Approve + dry-run send
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a draft to review text, status, and send workflow actions.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "creators" ? (
          <div className="split">
            <DataTable data={data.creators} columns={creatorColumns} searchPlaceholder="Filter creators" />
            <aside className="review-pane">
              {selectedCreator ? (
                <>
                  <div className="review-header">
                    <Badge tone={statusTone(selectedCreator.priority)}>{selectedCreator.priority}</Badge>
                    <Badge tone={statusTone(selectedCreator.status)}>{selectedCreator.status}</Badge>
                  </div>
                  <label>
                    Status
                    <select value={creatorStatus} onChange={(event) => setCreatorStatus(event.target.value)}>
                      {creatorStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority
                    <select value={creatorPriority} onChange={(event) => setCreatorPriority(event.target.value)}>
                      {priorities.map((priority) => (
                        <option key={priority} value={priority}>{priority}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Public contact
                    <input value={creatorContact} onChange={(event) => setCreatorContact(event.target.value)} placeholder="creator@example.com or public contact note" />
                  </label>
                  <label>
                    Fit reason
                    <textarea className="compact-textarea" value={creatorFitReason} onChange={(event) => setCreatorFitReason(event.target.value)} />
                  </label>
                  <label>
                    Offer angle
                    <textarea className="compact-textarea" value={creatorOfferAngle} onChange={(event) => setCreatorOfferAngle(event.target.value)} />
                  </label>
                  <div className="button-row">
                    <button className="primary icon-text" onClick={updateCreator}>
                      <Save size={16} /> Save creator
                    </button>
                    <a className="button-link" href={selectedCreator.profile_url} target="_blank" rel="noreferrer">
                      Open profile <ExternalLink size={14} />
                    </a>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a creator to validate contact details, fit, offer angle, and pipeline status.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "followups" ? (
          <div className="split">
            <DataTable
              data={data.followups}
              searchPlaceholder="Filter follow-ups"
              columns={[
                { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status}</Badge> },
                { header: "Due", accessorKey: "due_date" },
                { header: "Step", accessorKey: "cadence_step" },
                { header: "Draft", cell: ({ row }) => row.original.drafts?.subject || "No subject" },
                {
                  header: "Action",
                  cell: ({ row }) => (
                    <button className="icon-text small" onClick={() => reviewFollowup(row.original)}>
                      <Edit3 size={14} /> Review
                    </button>
                  )
                }
              ]}
            />
            <aside className="review-pane">
              {selectedFollowup ? (
                <>
                  <div className="review-header">
                    <Badge tone={statusTone(selectedFollowup.status)}>{selectedFollowup.status}</Badge>
                    <Badge tone="info">step {selectedFollowup.cadence_step}</Badge>
                  </div>
                  <label>
                    Status
                    <select value={followupStatus} onChange={(event) => setFollowupStatus(event.target.value)}>
                      {followupStatuses.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Follow-up draft note
                    <textarea value={followupDraftBody} onChange={(event) => setFollowupDraftBody(event.target.value)} />
                  </label>
                  <div className="context-box">
                    <strong>Due</strong>
                    <p>{selectedFollowup.due_date}</p>
                    <strong>Original subject</strong>
                    <p>{selectedFollowup.drafts?.subject || "No subject."}</p>
                    <strong>Creator contact</strong>
                    <p>{selectedFollowup.drafts?.creators?.public_contact || "No creator contact."}</p>
                    <strong>Original body</strong>
                    <p>{selectedFollowup.drafts?.body || "No body."}</p>
                  </div>
                  <div className="button-row">
                    <button className="primary icon-text" onClick={() => updateFollowup()}>
                      <Save size={16} /> Save follow-up
                    </button>
                    <button className="success icon-text" onClick={() => updateFollowup("completed")}>
                      <CheckCircle2 size={16} /> Complete
                    </button>
                    <button className="danger icon-text" onClick={() => updateFollowup("skipped")}>
                      <XCircle size={16} /> Skip
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a follow-up to review cadence, original message, creator contact, and outcome.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "offers" ? (
          <div className="split">
            <DataTable
              data={data.offers}
              searchPlaceholder="Filter offers"
              columns={[
                { header: "Type", accessorKey: "offer_type" },
                { header: "Creator", cell: ({ row }) => row.original.creators?.name || "No creator" },
                { header: "Redeemed", cell: ({ row }) => (row.original.redeemed ? "yes" : "no") },
                { header: "Committed", cell: ({ row }) => (row.original.content_committed ? "yes" : "no") },
                { header: "Outcome", accessorKey: "outcome" },
                {
                  header: "Action",
                  cell: ({ row }) => (
                    <button className="icon-text small" onClick={() => reviewOffer(row.original)}>
                      <Edit3 size={14} /> Review
                    </button>
                  )
                }
              ]}
            />
            <aside className="review-pane">
              {selectedOffer ? (
                <>
                  <div className="review-header">
                    <Badge tone={selectedOffer.redeemed ? "good" : "warn"}>{selectedOffer.redeemed ? "redeemed" : "not redeemed"}</Badge>
                    <Badge tone={selectedOffer.content_committed ? "good" : "neutral"}>{selectedOffer.content_committed ? "committed" : "no commitment"}</Badge>
                  </div>
                  <label>
                    Offer type
                    <input value={offerType} onChange={(event) => setOfferType(event.target.value)} />
                  </label>
                  <label>
                    Code or link
                    <input value={offerCode} onChange={(event) => setOfferCode(event.target.value)} />
                  </label>
                  <label>
                    Sent timestamp
                    <input value={offerSentAt} onChange={(event) => setOfferSentAt(event.target.value)} placeholder="ISO timestamp or blank" />
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={offerRedeemed} onChange={(event) => setOfferRedeemed(event.target.checked)} />
                    Redeemed
                  </label>
                  <label className="check-row">
                    <input type="checkbox" checked={offerCommitted} onChange={(event) => setOfferCommitted(event.target.checked)} />
                    Content committed
                  </label>
                  <label>
                    Content URL
                    <input value={offerContentUrl} onChange={(event) => setOfferContentUrl(event.target.value)} />
                  </label>
                  <label>
                    Outcome
                    <textarea className="compact-textarea" value={offerOutcome} onChange={(event) => setOfferOutcome(event.target.value)} />
                  </label>
                  <div className="button-row">
                    <button className="primary icon-text" onClick={updateOffer}>
                      <Save size={16} /> Save offer
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select an offer to track redemption, commitment, content URL, and outcome.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "automation" && data.automation ? (
          <div className="view-stack">
            <section className="panel clean-start-panel">
              <div>
                <div className="panel-title">
                  <ShieldAlert size={18} />
                  <h3>Clean automatic start</h3>
                </div>
                <p className="muted">
                  Clears outreach records, starts a fresh collection-to-drafts run, enables scheduled collection and drafts, keeps scheduled sending off, and keeps send dispatches dry-run only.
                </p>
              </div>
              <div className="clean-start-status">
                <Badge tone="warn">deletes outreach data</Badge>
                <Badge tone="good">sending disabled</Badge>
                <Badge tone="good">dry-run on</Badge>
              </div>
              <div className="button-row">
                {data.automation.workflows.cleanStart?.html_url ? (
                  <a className="button-link" href={data.automation.workflows.cleanStart.html_url} target="_blank" rel="noreferrer">
                    Open clean run <ExternalLink size={14} />
                  </a>
                ) : null}
                <button className="primary icon-text" onClick={cleanAutomaticStart} disabled={cleanStartRunning}>
                  <RefreshCw size={16} /> {cleanStartRunning ? "Starting..." : "Clean start"}
                </button>
              </div>
            </section>
            <section className="automation-grid">
              {(["AUTOMATION_ENABLED", "SEND_AUTOMATION_ENABLED", "DRY_RUN_SEND"] as const).map((name) => {
                const value = data.automation?.variables[name] || (name === "DRY_RUN_SEND" ? "true" : "false");
                return (
                  <div className="panel" key={name}>
                    <div className="panel-title">
                      <SlidersHorizontal size={18} />
                      <h3>{name}</h3>
                    </div>
                    <Badge tone={value === "true" ? "good" : "warn"}>{value}</Badge>
                    <div className="button-row">
                      <button onClick={() => updateVariable(name, "false")}>Set false</button>
                      <button className="primary" onClick={() => updateVariable(name, "true")}>Set true</button>
                    </div>
                  </div>
                );
              })}
            </section>
            <section className="workflow-grid">
              {(["collection", "drafts", "manualDraft", "send", "report"] as const).map((workflow) => {
                const run = data.automation?.workflows[workflow];
                const isManualDraftWorkflow = workflow === "manualDraft";
                return (
                  <div className="panel" key={workflow}>
                    <div className="panel-title">
                      <Bot size={18} />
                      <h3>{isManualDraftWorkflow ? "selected draft" : workflow}</h3>
                    </div>
                    <p className="muted">Last run: {run ? formatDate(run.created_at) : "none"}</p>
                    {isManualDraftWorkflow ? (
                      <p className="muted">Start this from an opportunity review so the workflow receives the selected opportunity.</p>
                    ) : null}
                    <p>
                      <Badge tone={statusTone(run?.conclusion || run?.status || "unknown")}>{run?.conclusion || run?.status || "unknown"}</Badge>
                    </p>
                    <div className="button-row">
                      {run?.html_url ? (
                        <a className="button-link" href={run.html_url} target="_blank" rel="noreferrer">
                          Open run <ExternalLink size={14} />
                        </a>
                      ) : null}
                      <button
                        className="primary icon-text"
                        onClick={() => dispatch(workflow)}
                        disabled={isManualDraftWorkflow || (workflow === "send" && !dryRunSendEnabled)}
                        title={
                          isManualDraftWorkflow
                            ? "Use the opportunity review pane to generate an LLM draft"
                            : workflow === "send" && !dryRunSendEnabled
                              ? "DRY_RUN_SEND must be true for dashboard send dispatch"
                              : "Run workflow now"
                        }
                      >
                        <Play size={16} /> Run now
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
