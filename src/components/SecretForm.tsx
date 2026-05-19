"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SecretForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/projects/${projectId}/secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save secret");
      return;
    }

    setKey("");
    setValue("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Add or update secret
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          placeholder="KEY_NAME"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          required
          pattern="[A-Za-z_][A-Za-z0-9_]*"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-800"
        />
        <input
          type="password"
          placeholder="Secret value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoComplete="off"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {loading ? "Saving…" : "Save secret"}
      </button>
      <p className="text-xs text-zinc-500">
        Values are encrypted server-side. After saving, only the key name is shown.
      </p>
    </form>
  );
}
