"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TokenRow = {
  id: string;
  name: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export function TokenManager({
  projectId,
  tokens,
}: {
  projectId: string;
  tokens: TokenRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setPlainToken(null);

    const body: { name?: string; expiresAt?: string } = {};
    if (name.trim()) body.name = name.trim();
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

    const res = await fetch(`/api/projects/${projectId}/tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to generate token");
      return;
    }

    const data = await res.json();
    setPlainToken(data.token);
    setName("");
    setExpiresAt("");
    router.refresh();
  }

  async function handleRevoke(tokenId: string) {
    if (!confirm("Revoke this deploy token? CI jobs using it will fail.")) return;

    await fetch(`/api/projects/${projectId}/tokens/${tokenId}`, {
      method: "PATCH",
    });
    router.refresh();
  }

  async function copyToken() {
    if (!plainToken) return;
    await navigator.clipboard.writeText(plainToken);
  }

  return (
    <div className="space-y-6">
      {plainToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Copy this token now — it will not be shown again
          </p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs dark:bg-zinc-900">
            {plainToken}
          </code>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={copyToken}
              className="rounded-lg bg-amber-800 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setPlainToken(null)}
              className="rounded-lg border border-amber-400 px-3 py-1.5 text-sm text-amber-900 dark:text-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleGenerate}
        className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 className="text-sm font-medium">Generate deploy token</h2>
        <input
          type="text"
          placeholder="Token name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {loading ? "Generating…" : "Generate token"}
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Name</th>
              <th className="px-4 py-2 text-left font-medium">Expires</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tokens.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  No deploy tokens yet
                </td>
              </tr>
            ) : (
              tokens.map((token) => (
                <tr
                  key={token.id}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-2">{token.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {token.expires_at
                      ? new Date(token.expires_at).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="px-4 py-2">
                    {token.revoked_at ? (
                      <span className="text-red-600">Revoked</span>
                    ) : (
                      <span className="text-green-600">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {!token.revoked_at && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(token.id)}
                        className="text-sm text-red-600 hover:text-red-800"
                      >
                        Revoke
                      </button>
                    )}
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
