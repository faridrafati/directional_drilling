import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import { api, type ProjectSummary } from "../api/client.js";
import { UNIT_PRESETS } from "@dd/shared/units";

export function ProjectsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectSummary[]>("/projects"),
  });

  const [name, setName] = useState("");
  const [preset, setPreset] = useState<keyof typeof UNIT_PRESETS>("API");

  const createMut = useMutation({
    mutationFn: () =>
      api.post<ProjectSummary>("/projects", { name, units: UNIT_PRESETS[preset] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setName("");
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-gray-900">Projects</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) createMut.mutate();
        }}
        className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end"
      >
        <div className="flex-1 min-w-0">
          <label className="block text-xs sm:text-sm text-gray-600 mb-1 font-medium">
            Project name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hithfield Phase 2"
            className="w-full border border-gray-300 rounded-md px-3 h-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs sm:text-sm text-gray-600 mb-1 font-medium">
            Units
          </label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as keyof typeof UNIT_PRESETS)}
            className="w-full sm:w-auto border border-gray-300 rounded-md px-3 h-10 bg-white"
          >
            {Object.keys(UNIT_PRESETS).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={createMut.isPending || !name.trim()}
          className="bg-blue-600 text-white px-4 h-10 rounded-md hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 font-medium min-w-[110px]"
        >
          {createMut.isPending ? "Creating…" : "Create"}
        </button>
      </form>

      {isLoading && (
        <div className="text-gray-500 text-sm flex items-center gap-2">
          <Spinner /> Loading projects…
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3">
          Could not reach the API. Is it running on port 4000?
          <div className="mt-1 text-xs text-red-500">{String(error)}</div>
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          icon="📂"
          title="No projects yet"
          description="Create your first project above to get started. A project holds countries, fields, wells, and calculations — the full drilling-plan hierarchy."
        />
      )}

      {data && data.length > 0 && (
        <ul className="grid gap-3 sm:gap-2">
          {data.map((p) => (
            <li key={p.id}>
              <div className="group bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4 flex items-center justify-between gap-3">
                <Link
                  to={`/projects/${p.id}`}
                  className="flex-1 min-w-0"
                >
                  <div className="text-blue-700 group-hover:text-blue-800 font-medium truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Created {new Date(p.createdAt).toLocaleString()}
                  </div>
                </Link>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${p.name}"?`)) deleteMut.mutate(p.id);
                  }}
                  aria-label={`Delete ${p.name}`}
                  className="text-sm text-gray-400 hover:text-red-600 -m-1 p-2 rounded transition-colors"
                >
                  <TrashIcon />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({
  icon, title, description,
}: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white border-2 border-dashed border-gray-200 rounded-lg p-8 sm:p-12 text-center">
      <div className="text-4xl mb-2">{icon}</div>
      <h3 className="text-base font-medium text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">{description}</p>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
