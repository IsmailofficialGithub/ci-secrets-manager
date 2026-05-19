import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function ProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        ← Back to projects
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {project.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-zinc-500">{project.id}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/dashboard/projects/${projectId}/secrets`}
          className="rounded-xl border border-zinc-200 p-6 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Secrets</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Add, update, and delete encrypted environment variables.
          </p>
        </Link>
        <Link
          href={`/dashboard/projects/${projectId}/tokens`}
          className="rounded-xl border border-zinc-200 p-6 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">
            Deploy tokens
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Generate tokens for GitHub Actions to fetch secrets at deploy time.
          </p>
        </Link>
      </div>
    </div>
  );
}
