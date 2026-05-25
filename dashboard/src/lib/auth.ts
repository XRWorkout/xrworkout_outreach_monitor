import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env";

export type Operator = {
  email: string;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function parseOperatorEmails(value: string | undefined): Set<string> {
  return new Set(
    (value || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAllowedOperator(email: string | undefined, allowlist: Set<string>): boolean {
  if (!email) {
    return false;
  }
  return allowlist.has(email.trim().toLowerCase());
}

export async function requireOperator(request: Request): Promise<Operator> {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) {
    throw new AuthError("Missing dashboard session", 401);
  }

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) {
    throw new AuthError("Invalid dashboard session", 401);
  }

  const allowlist = parseOperatorEmails(process.env.DASHBOARD_OPERATOR_EMAILS);
  if (!isAllowedOperator(data.user.email, allowlist)) {
    throw new AuthError("This account is not allowed to use the dashboard", 403);
  }

  return { email: data.user.email };
}

export function authErrorResponse(error: unknown): Response | null {
  if (error instanceof AuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
