"use client";

import Link from "next/link";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export type ProjectItem = {
  id: string;
  name: string;
  created_at: string;
};

export function ProjectList({ projects }: { projects: ProjectItem[] }) {
  if (projects.length === 0) {
    return <p className="mt-8 text-sm text-zinc-500">No projects yet.</p>;
  }

  return (
    <ul className="mt-8 space-y-2">
      {projects.map((project) => (
        <li
          key={project.id}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800"
        >
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="min-w-0 flex-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {project.name}
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
          </Link>
          <div className="shrink-0 pr-3">
            <DeleteProjectButton
              projectId={project.id}
              projectName={project.name}
              variant="row"
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
