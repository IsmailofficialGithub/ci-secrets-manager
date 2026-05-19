"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const USAGE_OPTIONS = [
  {
    id: "github_actions",
    label: "GitHub Actions",
    hint: "Store SECRETS_API_URL, PROJECT_ID, and DEPLOY_TOKEN in repo secrets.",
    tokenName: "GitHub Actions",
  },
  {
    id: "gitlab_ci",
    label: "GitLab CI",
    hint: "Add variables in Settings → CI/CD → Variables (masked).",
    tokenName: "GitLab CI",
  },
  {
    id: "curl",
    label: "curl / shell script",
    hint: "Run locally or in any pipeline with curl and jq.",
    tokenName: "curl script",
  },
  {
    id: "other_ci",
    label: "Other CI (Vercel, Jenkins, etc.)",
    hint: "POST to the API URL with project ID and deploy token in the body.",
    tokenName: "CI deploy",
  },
] as const;

type UsageId = (typeof USAGE_OPTIONS)[number]["id"];

function buildCurlExample(apiUrl: string, projectId: string, token: string) {
  return `curl -sS -X POST "${apiUrl}/api/ci/secrets" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"${projectId}","token":"${token}"}'`;
}

function buildGithubSnippet(apiUrl: string) {
  return `# Repository secrets:
# SECRETS_API_URL = ${apiUrl}
# PROJECT_ID = <project-id>
# DEPLOY_TOKEN = <token-from-dashboard>`;
}

export function CiApiAccessPanel({
  projectId,
  activeTokenCount,
  secretCount,
}: {
  projectId: string;
  activeTokenCount: number;
  secretCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<UsageId>("github_actions");
  const [tokenName, setTokenName] = useState("GitHub Actions");
  const [limitExpiry, setLimitExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const apiBaseUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  const apiUrl = `${apiBaseUrl}/api/ci/secrets`;

  const selectedUsage = USAGE_OPTIONS.find((o) => o.id === usage)!;

  const btn =
    "cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-50";

  function openModal() {
    setOpen(true);
    setError(null);
    setPlainToken(null);
    if (activeTokenCount === 0) {
      setUsage("github_actions");
      setTokenName("GitHub Actions");
    }
  }

  function closeModal() {
    if (loading) return;
    setOpen(false);
    setPlainToken(null);
    setError(null);
    setLimitExpiry(false);
    setExpiresAt("");
  }

  function handleUsageChange(id: UsageId) {
    setUsage(id);
    const opt = USAGE_OPTIONS.find((o) => o.id === id);
    if (opt) setTokenName(opt.tokenName);
  }

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (secretCount === 0) {
      setError("Add at least one secret before generating an API key.");
      return;
    }

    setError(null);
    setLoading(true);
    setPlainToken(null);

    const body: { name?: string; expiresAt?: string } = {
      name: tokenName.trim() || selectedUsage.tokenName,
    };
    if (limitExpiry && expiresAt) {
      body.expiresAt = new Date(expiresAt).toISOString();
    }

    const res = await fetch(`/api/projects/${projectId}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate API key");
      return;
    }

    const data = await res.json();
    setPlainToken(data.token);
    router.refresh();
  }

  const usageInstructions = useMemo(() => {
    if (!plainToken) return null;
    switch (usage) {
      case "github_actions":
        return buildGithubSnippet(apiBaseUrl);
      case "curl":
        return buildCurlExample(apiBaseUrl, projectId, plainToken);
      default:
        return `POST ${apiUrl}\nBody: { "projectId": "${projectId}", "token": "<your-token>" }`;
    }
  }, [plainToken, usage, apiBaseUrl, apiUrl, projectId]);

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50/80 p-4 dark:border-cyan-900/50 dark:bg-cyan-950/30">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-cyan-900 dark:text-cyan-100">
            CI / API access
          </p>
          <p className="mt-0.5 text-xs text-cyan-800/80 dark:text-cyan-300/80">
            {activeTokenCount > 0
              ? `${activeTokenCount} active API key${activeTokenCount === 1 ? "" : "s"}. Generate a URL + token for your pipeline.`
              : "No API key yet — generate one to fetch secrets from GitHub Actions or other CI."}
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          disabled={loading}
          className={`${btn} shrink-0 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-500`}
        >
          {activeTokenCount > 0 ? "API key & URL" : "Generate API key"}
        </button>
        <Link
          href={`/dashboard/projects/${projectId}/tokens`}
          className={`${btn} text-sm text-cyan-800 underline-offset-2 hover:underline dark:text-cyan-300`}
        >
          Manage keys
        </Link>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              CI API access
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Fetch encrypted secrets in your pipeline via{" "}
              <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">
                POST /api/ci/secrets
              </code>
            </p>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <p className="text-xs font-medium text-zinc-500">API URL</p>
              <code className="mt-1 block break-all text-sm text-zinc-900 dark:text-zinc-100">
                {apiUrl}
              </code>
              <button
                type="button"
                disabled={loading}
                onClick={() => copyText(apiUrl, "url")}
                className={`${btn} mt-2 text-xs font-medium text-cyan-700 hover:text-cyan-900 dark:text-cyan-400`}
              >
                {copied === "url" ? "Copied!" : "Copy URL"}
              </button>
            </div>

            {plainToken ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Copy your API key now — it won&apos;t be shown again
                  </p>
                  <code className="mt-2 block break-all rounded bg-white p-2 text-xs dark:bg-zinc-900">
                    {plainToken}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyText(plainToken, "token")}
                    className={`${btn} mt-2 rounded-md bg-amber-800 px-3 py-1.5 text-sm text-white hover:bg-amber-700`}
                  >
                    {copied === "token" ? "Copied!" : "Copy API key"}
                  </button>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500">Project ID</p>
                  <code className="mt-1 block break-all text-sm">{projectId}</code>
                  <button
                    type="button"
                    onClick={() => copyText(projectId, "project")}
                    className={`${btn} mt-1 text-xs text-cyan-700 dark:text-cyan-400`}
                  >
                    {copied === "project" ? "Copied!" : "Copy project ID"}
                  </button>
                </div>

                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    How to use in {selectedUsage.label}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedUsage.hint}</p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
                    {usageInstructions}
                  </pre>
                  {usageInstructions && (
                    <button
                      type="button"
                      onClick={() => copyText(usageInstructions!, "snippet")}
                      className={`${btn} mt-2 text-xs text-cyan-700 dark:text-cyan-400`}
                    >
                      {copied === "snippet" ? "Copied!" : "Copy example"}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className={`${btn} w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900`}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleGenerate} className="mt-4 space-y-4">
                {activeTokenCount === 0 && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                    No API key exists yet. Create one below to authenticate CI requests.
                  </p>
                )}

                {secretCount === 0 && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    Add secrets first, then generate an API key.
                  </p>
                )}

                <div>
                  <label
                    htmlFor="api-usage"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Where will you use this API key?
                  </label>
                  <select
                    id="api-usage"
                    value={usage}
                    disabled={loading}
                    onChange={(e) => handleUsageChange(e.target.value as UsageId)}
                    className="mt-1.5 w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    {USAGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-zinc-500">{selectedUsage.hint}</p>
                </div>

                <div>
                  <label
                    htmlFor="token-name"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Key label (optional)
                  </label>
                  <input
                    id="token-name"
                    type="text"
                    value={tokenName}
                    disabled={loading}
                    onChange={(e) => setTokenName(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
                  />
                </div>

                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={limitExpiry}
                      disabled={loading}
                      onChange={(e) => setLimitExpiry(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      Limit access time (expiring API key)
                    </span>
                  </label>
                  {limitExpiry && (
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      disabled={loading}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                      className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-800"
                    />
                  )}
                  <p className="mt-1 text-xs text-zinc-500">
                    Leave unchecked for a key that does not expire (revoke manually when done).
                  </p>
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    className={`${btn} rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || secretCount === 0}
                    className={`${btn} rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800`}
                  >
                    {loading ? "Generating…" : "Generate API key"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

