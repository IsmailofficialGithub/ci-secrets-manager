"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SecretForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
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
    setShowValue(false);
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
        <div className="relative">
          <input
            type={showValue ? "text" : "password"}
            placeholder="Secret value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoComplete="off"
            className="w-full rounded-lg border border-zinc-300 py-2 pr-10 pl-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            onClick={() => setShowValue((v) => !v)}
            aria-label={showValue ? "Hide secret value" : "Show secret value"}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            {showValue ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M1 1l22 22" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
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
