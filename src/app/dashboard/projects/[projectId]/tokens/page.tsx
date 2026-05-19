import Link from "next/link";
import { notFound } from "next/navigation";
import { TokenManager } from "@/components/TokenManager";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function TokensPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const { data: tokens } = await supabase
    .from("deploy_tokens")
    .select("id, name, expires_at, revoked_at, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Deploy tokens
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Plain tokens are shown once at generation. Only a hash is stored.
      </p>

      <div className="mt-6">
        <TokenManager projectId={projectId} tokens={tokens ?? []} />
      </div>
    </div>
  );
}
