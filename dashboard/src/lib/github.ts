import { optionalEnv, requiredEnv } from "@/lib/env";

export type WorkflowKey = "collection" | "sourceCollection" | "drafts" | "manualDraft" | "send" | "report" | "cleanStart";

export const workflowFiles: Record<WorkflowKey, string> = {
  collection: "daily-collection.yml",
  sourceCollection: "manual-source-collection.yml",
  drafts: "daily-drafts.yml",
  manualDraft: "manual-opportunity-draft.yml",
  send: "daily-send.yml",
  report: "weekly-report.yml",
  cleanStart: "clean-automatic-start.yml"
};

export type AutomationVariableName = "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND" | "APIFY_ENABLED" | "PROFILE_ENRICHMENT_ENABLED";

const automationVariables = new Set<AutomationVariableName>([
  "AUTOMATION_ENABLED",
  "SEND_AUTOMATION_ENABLED",
  "DRY_RUN_SEND",
  "APIFY_ENABLED",
  "PROFILE_ENRICHMENT_ENABLED"
]);

type GitHubRequestOptions = {
  method?: string;
  body?: unknown;
};

export function assertAutomationVariableName(name: string): asserts name is AutomationVariableName {
  if (!automationVariables.has(name as AutomationVariableName)) {
    throw new Error(`Unsupported automation variable: ${name}`);
  }
}

export function assertWorkflowKey(workflow: string): asserts workflow is WorkflowKey {
  if (!Object.prototype.hasOwnProperty.call(workflowFiles, workflow)) {
    throw new Error(`Unsupported workflow: ${workflow}`);
  }
}

export function githubRepo() {
  return {
    owner: optionalEnv("DASHBOARD_GITHUB_OWNER", "XRWorkout"),
    repo: optionalEnv("DASHBOARD_GITHUB_REPO", "xrworkout_outreach_monitor")
  };
}

async function githubRequest<T>(path: string, options: GitHubRequestOptions = {}): Promise<T> {
  const { owner, repo } = githubRepo();
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${requiredEnv("DASHBOARD_GITHUB_TOKEN")}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof json?.message === "string" ? json.message : "GitHub API request failed";
    throw new Error(message);
  }
  return json as T;
}

export async function getAutomationVariable(name: AutomationVariableName): Promise<string> {
  try {
    const result = await githubRequest<{ value: string }>(`/actions/variables/${name}`);
    return result.value;
  } catch (error) {
    if (error instanceof Error && error.message === "Not Found") {
      return "";
    }
    throw error;
  }
}

export async function setAutomationVariable(
  name: AutomationVariableName,
  value: string
): Promise<void> {
  assertAutomationVariableName(name);
  const current = await getAutomationVariable(name);
  if (current === "") {
    await githubRequest<void>("/actions/variables", {
      method: "POST",
      body: { name, value }
    });
    return;
  }
  await githubRequest<void>(`/actions/variables/${name}`, {
    method: "PATCH",
    body: { name, value }
  });
}

export async function getWorkflowStatus(workflow: WorkflowKey) {
  const file = workflowFiles[workflow];
  const result = await githubRequest<{
    workflow_runs?: Array<{
      id: number;
      name: string | null;
      status: string | null;
      conclusion: string | null;
      created_at: string;
      updated_at: string;
      run_started_at: string | null;
      html_url: string;
    }>;
  }>(`/actions/workflows/${file}/runs?per_page=1`);
  return result.workflow_runs?.[0] || null;
}

function stepEstimateSeconds(stepName: string) {
  const name = stepName.toLowerCase();
  if (name.includes("setup-python") || name.includes("checkout") || name.includes("set up job")) return 20;
  if (name.includes("pip install")) return 90;
  if (name.includes("check_ollama")) return 30;
  if (name.includes("reset_outreach")) return 60;
  if (name.includes("collect_reddit")) return 180;
  if (name.includes("collect_youtube")) return 60;
  if (name.includes("collect_twitch")) return 90;
  if (name.includes("collect_apify_conversations")) return 180;
  if (name.includes("collect_forums")) return 120;
  if (name.includes("collect_blogs")) return 60;
  if (name.includes("classify_opportunities")) return 720;
  if (name.includes("discover_creators")) return 300;
  if (name.includes("generate_drafts")) return 360;
  if (name.includes("send_approved")) return 90;
  if (name.includes("weekly_report")) return 45;
  return 60;
}

function likelyFixForStep(stepName: string, conclusion?: string | null) {
  const name = stepName.toLowerCase();
  if (conclusion && conclusion !== "failure" && conclusion !== "timed_out") return "No action needed.";
  if (name.includes("checkout")) return "Confirm the GitHub token can read the repository and the branch still exists.";
  if (name.includes("setup-python") || name.includes("pip install")) return "Check Python dependency installation in pyproject.toml and rerun after package errors are fixed.";
  if (name.includes("check_ollama")) return "Check OLLAMA_API_KEY, Ollama Cloud model access, and the configured LLM policy.";
  if (name.includes("reset_outreach")) return "Confirm Supabase schema is up to date and the service role key can delete operational rows.";
  if (name.includes("collect_reddit")) return "Reddit RSS may be rate-limited or unavailable. Rerun later or reduce feed volume.";
  if (name.includes("collect_youtube")) return "Check YouTube API key, quota, and whether the follower_count schema column exists.";
  if (name.includes("collect_twitch")) return "Check Twitch client credentials and API access for channel follower totals.";
  if (name.includes("enrich_creator_profiles")) return "Check PROFILE_ENRICHMENT_ENABLED, YouTube API quota, APIFY_TOKEN, profile actor JSON variables, and actor input shape.";
  if (name.includes("collect_apify")) return "Check APIFY_TOKEN, actor JSON variables, Starter-plan usage, and actor input shape.";
  if (name.includes("collect_forums")) return "Check FORUM_SOURCES_JSON and whether the target forum exposes public Discourse JSON endpoints.";
  if (name.includes("collect_blogs")) return "Check BLOG_FEEDS_JSON and whether the feed URL returns valid RSS or Atom XML.";
  if (name.includes("classify_opportunities")) return "Check Ollama Cloud availability, model timeout, and raw item volume. Rerun with a lower limit if needed.";
  if (name.includes("discover_creators")) return "Check Ollama output and creator schema fields, especially follower_count, evidence_json, and public contact fields.";
  if (name.includes("generate_drafts")) return "Check draft eligibility, Ollama output, and safety-rule validation errors.";
  if (name.includes("send_approved")) return "Keep DRY_RUN_SEND=true unless intentionally sending; check Brevo credentials if email sending is expected.";
  if (name.includes("weekly_report")) return "Check Supabase connectivity and table access for report queries.";
  return "Open the GitHub job log, inspect the failed command, fix the failing secret/schema/API input, then rerun.";
}

export async function getWorkflowRunDetail(workflow: WorkflowKey, runId: number) {
  const run = await githubRequest<{
    id: number;
    name: string | null;
    status: string | null;
    conclusion: string | null;
    created_at: string;
    updated_at: string;
    run_started_at: string | null;
    html_url: string;
  }>(`/actions/runs/${runId}`);
  const jobsResult = await githubRequest<{
    jobs?: Array<{
      id: number;
      name: string;
      status: string | null;
      conclusion: string | null;
      started_at: string | null;
      completed_at: string | null;
      html_url: string;
      steps?: Array<{
        name: string;
        number: number;
        status: string | null;
        conclusion: string | null;
        started_at: string | null;
        completed_at: string | null;
      }>;
    }>;
  }>(`/actions/runs/${runId}/jobs?per_page=50`);

  return {
    workflow,
    run_id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    created_at: run.created_at,
    updated_at: run.updated_at,
    run_started_at: run.run_started_at,
    html_url: run.html_url,
    jobs: (jobsResult.jobs || []).map((job) => ({
      id: job.id,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      started_at: job.started_at,
      completed_at: job.completed_at,
      html_url: job.html_url,
      steps: (job.steps || []).map((step) => ({
        name: step.name,
        number: step.number,
        status: step.status,
        conclusion: step.conclusion,
        started_at: step.started_at,
        completed_at: step.completed_at,
        estimate_seconds: stepEstimateSeconds(step.name),
        likely_fix: likelyFixForStep(step.name, step.conclusion)
      }))
    }))
  };
}

export async function dispatchWorkflow(workflow: WorkflowKey, inputs?: Record<string, string>): Promise<void> {
  const file = workflowFiles[workflow];
  await githubRequest<void>(`/actions/workflows/${file}/dispatches`, {
    method: "POST",
    body: { ref: "main", ...(inputs ? { inputs } : {}) }
  });
}
