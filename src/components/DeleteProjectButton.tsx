"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function DeleteProjectButton({
  projectId,
  projectName,
  variant = "default",
}: {
  projectId: string;
  projectName: string;
  variant?: "default" | "row";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nameMatches = confirmName.trim() === projectName;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  function closeModal() {
    if (loading) return;
    setOpen(false);
    setConfirmName("");
    setError(null);
  }

  const btnBase =
    "cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-50";

  async function handleDelete() {
    if (!nameMatches) return;
    setError(null);
    setLoading(true);

    const res = await fetch(`/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: confirmName.trim() }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete project");
      return;
    }

    closeModal();
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={loading}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!loading) setOpen(true);
        }}
        className={
          variant === "row"
            ? `${btnBase} rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950`
            : `${btnBase} rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`
        }
      >
        {variant === "row" ? "Delete" : "Delete project"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-project-title"
          onClick={() => !loading && closeModal()}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
              Danger zone
            </p>
            <h2
              id="delete-project-title"
              className="mt-1 text-lg font-semibold text-red-700 dark:text-red-400"
            >
              Delete project?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              This permanently deletes{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">{projectName}</strong>
              , including all secrets, deploy tokens, and audit logs. This cannot be undone.
            </p>

            <label
              htmlFor={`confirm-project-name-${projectId}`}
              className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Type <span className="font-mono text-zinc-900 dark:text-zinc-100">{projectName}</span> to confirm
            </label>
            <input
              id={`confirm-project-name-${projectId}`}
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              autoComplete="off"
              disabled={loading}
              className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={loading}
                className={`${btnBase} rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading || !nameMatches}
                className={`${btnBase} rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40`}
              >
                {loading ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

