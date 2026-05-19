import Link from "next/link";
import { notFound } from "next/navigation";
import { CiApiAccessPanel } from "@/components/CiApiAccessPanel";
import { DeleteSecretButton } from "@/components/DeleteSecretButton";
import { SecretForm } from "@/components/SecretForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function SecretsPage({ params }: PageProps) {
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

  const { data: secrets } = await supabase
    .from("project_secrets")
    .select("id, key, updated_at")
    .eq("project_id", projectId)
    .order("key");

  const { data: tokenRows } = await supabase
    .from("deploy_tokens")
    .select("revoked_at, expires_at")
    .eq("project_id", projectId);

  const now = new Date();
  const activeTokenCount =
    tokenRows?.filter(
      (t) =>
        !t.revoked_at &&
        (!t.expires_at || new Date(t.expires_at) > now),
    ).length ?? 0;

  return (
    <div>
      <Link
        href={`/dashboard/projects/${projectId}`}
        className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Secrets
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Only key names are shown. Values cannot be viewed after saving.
      </p>

      <CiApiAccessPanel
        projectId={projectId}
        activeTokenCount={activeTokenCount}
        secretCount={(secrets ?? []).length}
      />

      <div className="mt-6">
        <SecretForm projectId={projectId} />
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Key</th>
              <th className="px-4 py-2 text-left font-medium">Updated</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(secrets ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                  No secrets yet
                </td>
              </tr>
            ) : (
              secrets?.map((secret) => (
                <tr
                  key={secret.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 font-mono">{secret.key}</td>
                  <td className="px-4 py-2 text-zinc-600">
                    {new Date(secret.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeleteSecretButton
                      projectId={projectId}
                      secretId={secret.id}
                      secretKey={secret.key}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
