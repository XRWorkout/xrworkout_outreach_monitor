import { supabaseAdmin } from "@/lib/supabase-admin";

export type AuditLogInput = {
  actorEmail: string;
  actionType: string;
  targetTable: string;
  targetId: string;
  before: unknown;
  after: unknown;
};

export async function auditDashboardAction(input: AuditLogInput): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("dashboard_audit_logs")
    .insert({
      actor_email: input.actorEmail,
      action_type: input.actionType,
      target_table: input.targetTable,
      target_id: input.targetId,
      before_json: input.before,
      after_json: input.after
    });

  if (error) {
    throw error;
  }
}
