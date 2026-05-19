import { NextResponse } from "next/server";
import { getCiConfigStatus, isCiFullyConfigured } from "@/lib/ci-config";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET() {
  const checks = getCiConfigStatus();

  let database = false;
  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("projects").select("id").limit(1);
    database = !error;
  } catch {
    database = false;
  }

  const ok = isCiFullyConfigured() && database;

  return NextResponse.json({
    ok,
    checks: {
      ...checks,
      database,
    },
    hint: !checks.upstashRedis
      ? "Optional: set Upstash for rate limiting. CI works without it."
      : !checks.masterEncryptionKey
        ? "Set MASTER_ENCRYPTION_KEY (openssl rand -hex 32) on Vercel"
        : !checks.serviceRoleKey
          ? "Set SUPABASE_SERVICE_ROLE_KEY on Vercel"
          : !database
            ? "Cannot reach Supabase — check URL and service role key"
            : undefined,
  });
}
