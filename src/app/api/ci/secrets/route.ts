import { NextResponse } from "next/server";
import { getCiConfigStatus } from "@/lib/ci-config";
import { logAudit } from "@/lib/audit";
import { decrypt } from "@/lib/encryption";
import { checkRateLimit } from "@/lib/ratelimit";
import { getClientIp, getUserAgent } from "@/lib/request";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { hashToken, verifyToken } from "@/lib/tokens";
import type { DeployTokenRow, SecretRow } from "@/lib/database.types";
import { ciSecretsRequestSchema } from "@/lib/validations";

export const runtime = "nodejs";

function apiError(
  error: string,
  status: number,
  code: string,
  detail?: string,
) {
  return NextResponse.json(
    {
      error,
      code,
      ...(detail ? { detail } : {}),
    },
    { status },
  );
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);

  const config = getCiConfigStatus();
  if (!config.serviceRoleKey || !config.supabaseUrl) {
    return apiError(
      "Server configuration error",
      503,
      "SUPABASE_NOT_CONFIGURED",
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel",
    );
  }
  if (!config.masterEncryptionKey) {
    return apiError(
      "Server configuration error",
      503,
      "MASTER_KEY_NOT_CONFIGURED",
      "Set MASTER_ENCRYPTION_KEY on Vercel (same value used when secrets were saved)",
    );
  }

  let projectId: string | null = null;
  let tokenId: string | null = null;
  let admin: ReturnType<typeof createAdminSupabaseClient>;

  try {
    admin = createAdminSupabaseClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Admin client failed";
    console.error("ci_secrets_config_error", msg);
    return apiError("Server configuration error", 503, "SUPABASE_CLIENT_FAILED", msg);
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
      return apiError("Too many requests", 429, "RATE_LIMITED");
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
      return apiError("Invalid request", 400, "VALIDATION_ERROR");
    }

    projectId = parsed.data.projectId;
    const incomingToken = parsed.data.token.trim();
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
      return apiError(
        "Failed to validate token",
        500,
        "TOKEN_QUERY_FAILED",
        tokenError.message,
      );
    }

    if (!tokens.length) {
      await logAudit(admin, {
        projectId,
        tokenId: null,
        ip,
        userAgent,
        action: "invalid_token",
      });
      return apiError(
        "Unauthorized",
        401,
        "INVALID_TOKEN",
        "No matching deploy token. Generate a new API key in the dashboard and copy it exactly (starts with pst_).",
      );
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
      return apiError(
        "Unauthorized",
        401,
        "INVALID_TOKEN",
        "Token revoked, expired, or incorrect.",
      );
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
      return apiError(
        "Failed to fetch secrets",
        500,
        "SECRETS_QUERY_FAILED",
        secretsError.message,
      );
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
        return apiError(
          "Failed to decrypt secrets",
          500,
          "DECRYPT_FAILED",
          `Secret "${secret.key}": MASTER_ENCRYPTION_KEY on Vercel must match the key used when saving secrets locally.`,
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

    await logAudit(admin, {
      projectId,
      tokenId,
      ip,
      userAgent,
      action: "fetch_failure",
    }).catch(() => undefined);

    return apiError("Internal server error", 500, "INTERNAL_ERROR", msg);
  }
}
