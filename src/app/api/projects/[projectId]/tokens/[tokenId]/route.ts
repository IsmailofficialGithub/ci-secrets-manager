import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { tokenIdParamSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ projectId: string; tokenId: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const raw = await context.params;
  const parsed = tokenIdParamSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("deploy_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.tokenId)
    .eq("project_id", parsed.data.projectId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
