import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { deleteProjectSchema, projectIdParamSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth.response) return auth.response;

  const { projectId } = await context.params;
  const params = projectIdParamSchema.safeParse({ projectId });
  if (!params.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { data: project } = await auth.supabase
    .from("projects")
    .select("id, name")
    .eq("id", params.data.projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (project.name !== parsed.data.confirmName) {
    return NextResponse.json(
      { error: "Project name does not match" },
      { status: 400 },
    );
  }

  const { error } = await auth.supabase
    .from("projects")
    .delete()
    .eq("id", params.data.projectId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
