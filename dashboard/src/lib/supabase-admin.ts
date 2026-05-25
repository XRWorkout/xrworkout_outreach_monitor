import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env";

export function supabaseAdmin() {
  return createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function tableCount(table: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) {
    throw error;
  }
  return count || 0;
}
