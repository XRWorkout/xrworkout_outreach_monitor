export function titleCaseValue(value?: string | null) {
  if (!value) return "Unknown";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

const platformLabels: Record<string, string> = {
  reddit: "Reddit",
  youtube: "YouTube",
  twitch: "Twitch",
  twitter: "X / Twitter",
  x: "X / Twitter",
  discord: "Discord",
  discord_server: "Discord Server",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook Groups",
  facebook_groups: "Facebook Groups",
  vr_forums: "VR Forums",
  blogs: "Blogs"
};

const valueLabels: Record<string, string> = {
  content_ready: "Content Ready",
  high_priority: "High Priority",
  waiting_response: "Waiting for Response",
  creator_outreach: "Creator Outreach",
  needs_review: "Needs Review",
  edit_needed: "Edit Needed",
  contact_ready: "Contact Ready",
  public_contact: "Public Contact",
  outreach_safety: "Outreach Safety",
  recommended_action: "Recommended Action",
  raw_items: "Collected Signals",
  followups: "Follow-Ups",
  dm: "DM",
  email: "Email",
  comment: "Community Reply",
  high: "High Priority",
  medium: "Medium Priority",
  low: "Low Priority",
  new: "New",
  reviewed: "Reviewed",
  monitor: "Monitor",
  contacted: "Contacted",
  rejected: "Rejected",
  approved: "Approved",
  sent: "Sent",
  pending: "Pending",
  completed: "Completed",
  skipped: "Skipped"
};

export function labelFor(value?: string | null) {
  if (!value) return "Unknown";
  const normalized = value.toLowerCase();
  return platformLabels[normalized] || valueLabels[normalized] || titleCaseValue(value);
}

export function platformLabel(value?: string | null) {
  if (!value) return "Unknown";
  return platformLabels[value.toLowerCase()] || labelFor(value);
}

export function shortDate(value?: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function dayKey(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function isToday(value?: string | null) {
  return Boolean(value && dayKey(value) === new Date().toISOString().slice(0, 10));
}

export function toneFor(value?: string | null): "neutral" | "good" | "warn" | "bad" | "info" {
  const normalized = (value || "").toLowerCase();
  if (["approved", "sent", "success", "completed", "contact_ready", "partnered", "active", "true"].includes(normalized)) return "good";
  if (["needs_review", "queued", "in_progress", "reviewed", "new"].includes(normalized)) return "info";
  if (["edit_needed", "pending", "medium", "monitor", "false"].includes(normalized)) return "warn";
  if (["rejected", "failure", "cancelled", "timed_out", "high", "overdue", "inactive"].includes(normalized)) return "bad";
  return "neutral";
}

export function scoreLabel(score?: number | null) {
  if (score == null) return "Not scored";
  if (score >= 75) return "High signal";
  if (score >= 45) return "Promising";
  if (score >= 20) return "Weak signal";
  return "Monitor";
}

export function percentage(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}
