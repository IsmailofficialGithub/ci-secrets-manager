import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditAction =
  | "fetch_success"
  | "fetch_failure"
  | "invalid_token"
  | "rate_limited"
  | "validation_error";

export async function logAudit(
  supabaseAdmin: SupabaseClient,
  params: {
    projectId?: string | null;
    tokenId?: string | null;
    ip: string;
    userAgent: string;
    action: AuditAction;
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    project_id: params.projectId ?? null,
    token_id: params.tokenId ?? null,
    ip_address: params.ip,
    user_agent: params.userAgent,
    action: params.action,
  });

  if (error) {
    // Never log secret values; audit failure is non-fatal for the request
    console.error("audit_log_insert_failed");
  }
}
