import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { secretIdParamSchema } from "@/lib/validations";

type RouteContext = {
  params: Promise<{ projectId: string; secretId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const raw = await context.params;
  const parsed = secretIdParamSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("project_secrets")
    .delete()
    .eq("id", parsed.data.secretId)
    .eq("project_id", parsed.data.projectId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete secret" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
