import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateToken, hashToken } from "@/lib/tokens";
import { createDeployTokenSchema, projectIdParamSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { projectId } = await context.params;
  const params = projectIdParamSchema.safeParse({ projectId });
  if (!params.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("deploy_tokens")
    .select("id, name, expires_at, revoked_at, created_at")
    .eq("project_id", params.data.projectId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tokens" }, { status: 500 });
  }

  return NextResponse.json({ tokens: data });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { projectId } = await context.params;
  const params = projectIdParamSchema.safeParse({ projectId });
  if (!params.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createDeployTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);

  const { data, error } = await auth.supabase
    .from("deploy_tokens")
    .insert({
      project_id: params.data.projectId,
      name: parsed.data.name ?? null,
      token_hash: tokenHash,
      expires_at: parsed.data.expiresAt ?? null,
    })
    .select("id, name, expires_at, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create token" }, { status: 500 });
  }

  return NextResponse.json(
    {
      token: plainToken,
      deployToken: data,
    },
    { status: 201 },
  );
}
