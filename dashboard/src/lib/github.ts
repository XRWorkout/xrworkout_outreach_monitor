import { optionalEnv, requiredEnv } from "@/lib/env";

export type WorkflowKey = "collection" | "drafts" | "manualDraft" | "send" | "report";

export const workflowFiles: Record<WorkflowKey, string> = {
  collection: "daily-collection.yml",
  drafts: "daily-drafts.yml",
  manualDraft: "manual-opportunity-draft.yml",
  send: "daily-send.yml",
  report: "weekly-report.yml"
};

export type AutomationVariableName = "AUTOMATION_ENABLED" | "SEND_AUTOMATION_ENABLED" | "DRY_RUN_SEND";

const automationVariables = new Set<AutomationVariableName>([
  "AUTOMATION_ENABLED",
  "SEND_AUTOMATION_ENABLED",
  "DRY_RUN_SEND"
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
      html_url: string;
    }>;
  }>(`/actions/workflows/${file}/runs?per_page=1`);
  return result.workflow_runs?.[0] || null;
}

export async function dispatchWorkflow(workflow: WorkflowKey, inputs?: Record<string, string>): Promise<void> {
  const file = workflowFiles[workflow];
  await githubRequest<void>(`/actions/workflows/${file}/dispatches`, {
    method: "POST",
    body: { ref: "main", ...(inputs ? { inputs } : {}) }
  });
}
