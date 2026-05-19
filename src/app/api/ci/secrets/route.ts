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

function errorResponse(message: string, status: number) {
  const body: { error: string; detail?: string } = { error: message };
  if (process.env.NODE_ENV === "development") {
    body.detail = message;
  }
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  let projectId: string | null = null;
  let tokenId: string | null = null;
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;

  try {
    admin = createAdminSupabaseClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin client failed";
    console.error("ci_secrets_config_error", msg);
    return errorResponse("Server configuration error", 503);
  }

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

    if (tokenError) {
      console.error("ci_secrets_token_query", tokenError.message);
      await logAudit(admin, {
        projectId,
        tokenId: null,
        ip,
        userAgent,
        action: "fetch_failure",
      });
      return errorResponse("Failed to validate token", 500);
    }

    if (!tokens.length) {
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
      console.error("ci_secrets_fetch", secretsError.message);
      await logAudit(admin, {
        projectId,
        tokenId,
        ip,
        userAgent,
        action: "fetch_failure",
      });
      return errorResponse("Failed to fetch secrets", 500);
    }

    const env: Record<string, string> = {};
    for (const secret of (secrets ?? []) as SecretRow[]) {
      try {
        env[secret.key] = decrypt(
          secret.encrypted_value,
          secret.iv,
          secret.auth_tag,
        );
      } catch (decryptErr) {
        const msg =
          decryptErr instanceof Error ? decryptErr.message : "Decrypt failed";
        console.error("ci_secrets_decrypt", secret.key, msg);
        await logAudit(admin, {
          projectId,
          tokenId,
          ip,
          userAgent,
          action: "fetch_failure",
        });
        return errorResponse(
          process.env.NODE_ENV === "development"
            ? `Decryption failed for "${secret.key}". Check MASTER_ENCRYPTION_KEY matches the key used when the secret was saved.`
            : "Failed to decrypt secrets",
          500,
        );
      }
    }

    await logAudit(admin, {
      projectId,
      tokenId,
      ip,
      userAgent,
      action: "fetch_success",
    });

    return NextResponse.json({ env });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("ci_secrets_error", msg);

    if (admin) {
      await logAudit(admin, {
        projectId,
        tokenId,
        ip,
        userAgent,
        action: "fetch_failure",
      }).catch(() => undefined);
    }

    return errorResponse(
      process.env.NODE_ENV === "development" ? msg : "Internal server error",
      500,
    );
  }
}
