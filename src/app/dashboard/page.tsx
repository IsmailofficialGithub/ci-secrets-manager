import { CreateProjectForm } from "@/components/CreateProjectForm";
import { ProjectList } from "@/components/ProjectList";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Projects
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Store encrypted secrets and fetch them from CI with deploy tokens.
      </p>

      <div className="mt-6">
        <CreateProjectForm />
      </div>

      <ProjectList projects={projects ?? []} />
    </div>
  );
}
