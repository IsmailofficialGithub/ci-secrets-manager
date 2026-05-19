"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteSecretButton({
  projectId,
  secretId,
  secretKey,
}: {
  projectId: string;
  secretId: string;
  secretKey: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete secret "${secretKey}"?`)) return;
    setLoading(true);

    await fetch(`/api/projects/${projectId}/secrets/${secretId}`, {
      method: "DELETE",
    });

    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
    >
      {loading ? "…" : "Delete"}
    </button>
  );
}
