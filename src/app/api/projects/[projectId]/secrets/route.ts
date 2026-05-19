import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { encrypt } from "@/lib/encryption";
import { projectIdParamSchema, upsertSecretSchema } from "@/lib/validations";

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
    .from("project_secrets")
    .select("id, key, created_at, updated_at")
    .eq("project_id", params.data.projectId)
    .order("key");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch secrets" }, { status: 500 });
  }

  return NextResponse.json({ secrets: data });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { projectId } = await context.params;
  const params = projectIdParamSchema.safeParse({ projectId });
  if (!params.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = upsertSecretSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { key, value } = parsed.data;
  const encrypted = encrypt(value);

  const { data: existing } = await auth.supabase
    .from("project_secrets")
    .select("id")
    .eq("project_id", params.data.projectId)
    .eq("key", key)
    .maybeSingle();

  if (existing) {
    const { data, error } = await auth.supabase
      .from("project_secrets")
      .update({
        encrypted_value: encrypted.encrypted_value,
        iv: encrypted.iv,
        auth_tag: encrypted.auth_tag,
      })
      .eq("id", existing.id)
      .select("id, key, created_at, updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update secret" }, { status: 500 });
    }
    return NextResponse.json({ secret: data });
  }

  const { data, error } = await auth.supabase
    .from("project_secrets")
    .insert({
      project_id: params.data.projectId,
      key,
      encrypted_value: encrypted.encrypted_value,
      iv: encrypted.iv,
      auth_tag: encrypted.auth_tag,
    })
    .select("id, key, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create secret" }, { status: 500 });
  }

  return NextResponse.json({ secret: data }, { status: 201 });
}
