import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function statusTone(value: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (["approved", "sent", "success", "completed"].includes(value)) return "good";
  if (["needs_review", "queued", "in_progress"].includes(value)) return "info";
  if (["edit_needed", "pending", "medium"].includes(value)) return "warn";
  if (["rejected", "failure", "cancelled", "timed_out", "high"].includes(value)) return "bad";
  return "neutral";
}
