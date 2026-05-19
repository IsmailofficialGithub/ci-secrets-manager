import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp, getUserAgent } from "@/lib/request";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { hashToken, verifyToken } from "@/lib/tokens";
import type { DeployTokenRow, SecretRow } from "@/lib/database.types";
import { ciSecretsRequestSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  const admin = createAdminSupabaseClient();

  let projectId: string | null = null;
  let tokenId: string | null = null;

  try {
    const rate = await checkRateLimit(ip);
    if (!rate.success) {
      await logAudit(admin, {
        projectId: null,
        tokenId: null,
        ip,
        userAgent,
        action: "rate_limited",
      });
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);
    const parsed = ciSecretsRequestSchema.safeParse(body);

    if (!parsed.success) {
      await logAudit(admin, {
        projectId: null,
        tokenId: null,
        ip,
        userAgent,
        action: "validation_error",
      });
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    projectId = parsed.data.projectId;
    const incomingToken = parsed.data.token;
    const incomingHash = hashToken(incomingToken);

    const { data: tokenRows, error: tokenError } = await admin
      .from("deploy_tokens")
      .select("id, token_hash, expires_at, revoked_at")
      .eq("project_id", projectId)
      .eq("token_hash", incomingHash);

    const tokens = (tokenRows ?? []) as DeployTokenRow[];

    if (tokenError || !tokens.length) {
      await logAudit(admin, {
        projectId,
        tokenId: null,
        ip,
        userAgent,
        action: "invalid_token",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const validToken = tokens.find((row) => {
      if (row.revoked_at) return false;
      if (row.expires_at && new Date(row.expires_at) <= now) return false;
      return verifyToken(incomingToken, row.token_hash);
    });

    if (!validToken) {
      await logAudit(admin, {
        projectId,
        tokenId: null,
        ip,
        userAgent,
        action: "invalid_token",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    tokenId = validToken.id;

    const { data: secrets, error: secretsError } = await admin
      .from("project_secrets")
      .select("key, encrypted_value, iv, auth_tag")
      .eq("project_id", projectId);

    if (secretsError) {
      await logAudit(admin, {
        projectId,
        tokenId,
        ip,
        userAgent,
        action: "fetch_failure",
      });
      return NextResponse.json({ error: "Failed to fetch secrets" }, { status: 500 });
    }

    const env: Record<string, string> = {};
    for (const secret of (secrets ?? []) as SecretRow[]) {
      env[secret.key] = decrypt(
        secret.encrypted_value,
        secret.iv,
        secret.auth_tag,
      );
    }

    await logAudit(admin, {
      projectId,
      tokenId,
      ip,
      userAgent,
      action: "fetch_success",
    });

    return NextResponse.json({ env });
  } catch {
    await logAudit(admin, {
      projectId,
      tokenId,
      ip,
      userAgent,
      action: "fetch_failure",
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
