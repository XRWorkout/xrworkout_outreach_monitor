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

  async function updateVariable(name: "AUTOMATION_ENABLED" | "DRY_RUN_SEND", value: string) {
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

  const opportunityColumns = useMemo<ColumnDef<Opportunity>[]>(
    () => [
      { header: "Priority", accessorKey: "priority", cell: ({ row }) => <Badge tone={statusTone(row.original.priority)}>{row.original.priority}</Badge> },
      { header: "Score", accessorKey: "score" },
      { header: "Platform", accessorKey: "platform" },
      { header: "Type", accessorKey: "opportunity_type" },
      { header: "Safety", accessorKey: "outreach_safety" },
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
      { header: "Fit", accessorKey: "fit_reason", cell: ({ row }) => <span className="line-clamp">{row.original.fit_reason || "none"}</span> }
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

        {activeTab === "opportunities" ? <DataTable data={data.opportunities} columns={opportunityColumns} searchPlaceholder="Filter opportunities" /> : null}

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
                    <button className="success icon-text" onClick={() => changeDraftStatus("approved", true)} disabled={editingDraft.status === "sent" || editingDraft.channel !== "email"}>
                      <MailCheck size={16} /> Approve + run send
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty-state">Select a draft to review text, status, and send workflow actions.</div>
              )}
            </aside>
          </div>
        ) : null}

        {activeTab === "creators" ? <DataTable data={data.creators} columns={creatorColumns} searchPlaceholder="Filter creators" /> : null}

        {activeTab === "followups" ? (
          <DataTable
            data={data.followups}
            searchPlaceholder="Filter follow-ups"
            columns={[
              { header: "Status", accessorKey: "status", cell: ({ row }) => <Badge tone={statusTone(row.original.status)}>{row.original.status}</Badge> },
              { header: "Due", accessorKey: "due_date" },
              { header: "Step", accessorKey: "cadence_step" },
              { header: "Draft", cell: ({ row }) => row.original.drafts?.subject || "No subject" }
            ]}
          />
        ) : null}

        {activeTab === "offers" ? (
          <DataTable
            data={data.offers}
            searchPlaceholder="Filter offers"
            columns={[
              { header: "Type", accessorKey: "offer_type" },
              { header: "Creator", cell: ({ row }) => row.original.creators?.name || "No creator" },
              { header: "Redeemed", cell: ({ row }) => (row.original.redeemed ? "yes" : "no") },
              { header: "Committed", cell: ({ row }) => (row.original.content_committed ? "yes" : "no") },
              { header: "Outcome", accessorKey: "outcome" }
            ]}
          />
        ) : null}

        {activeTab === "automation" && data.automation ? (
          <div className="view-stack">
            <section className="automation-grid">
              {(["AUTOMATION_ENABLED", "DRY_RUN_SEND"] as const).map((name) => {
                const value = data.automation?.variables[name] || "false";
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
              {(["collection", "drafts", "send", "report"] as const).map((workflow) => {
                const run = data.automation?.workflows[workflow];
                return (
                  <div className="panel" key={workflow}>
                    <div className="panel-title">
                      <Bot size={18} />
                      <h3>{workflow}</h3>
                    </div>
                    <p className="muted">Last run: {run ? formatDate(run.created_at) : "none"}</p>
                    <p>
                      <Badge tone={statusTone(run?.conclusion || run?.status || "unknown")}>{run?.conclusion || run?.status || "unknown"}</Badge>
                    </p>
                    <div className="button-row">
                      {run?.html_url ? (
                        <a className="button-link" href={run.html_url} target="_blank" rel="noreferrer">
                          Open run <ExternalLink size={14} />
                        </a>
                      ) : null}
                      <button className="primary icon-text" onClick={() => dispatch(workflow)}>
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
