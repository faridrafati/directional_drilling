import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { api, type ProjectDetail } from "../api/client.js";
import { parseCsvBundle, type ImportPayload } from "../import/csv.js";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["project", id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });

  const addCountry = useMutation({
    mutationFn: (name: string) =>
      api.post("/countries", { projectId: id, name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
  const addField = useMutation({
    mutationFn: (vars: { countryId: string; name: string }) =>
      api.post("/fields", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
  const addWell = useMutation({
    mutationFn: (vars: { fieldId: string; name: string }) =>
      api.post("/wells", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
  const addCalc = useMutation({
    mutationFn: (vars: { wellId: string; name: string; type: "WellDesign" | "SurveyEditor" }) =>
      api.post("/calculations", vars),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });

  const importMut = useMutation({
    mutationFn: (payload: ImportPayload) =>
      api.post<{ ok: boolean; counts: Record<string, number> }>(
        `/projects/${id}/import`,
        payload
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", id] }),
  });
  const importInput = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  async function onCsvFiles(filesList: FileList | null) {
    if (!filesList || filesList.length === 0) return;
    const files = Array.from(filesList);
    const byName: Record<string, File> = {};
    for (const f of files) {
      const base = f.name.toLowerCase();
      if (base.includes("countr")) byName.countries = f;
      else if (base.includes("field")) byName.fields = f;
      else if (base.includes("well")) byName.wells = f;
      else if (base.includes("calc")) byName.calculations = f;
      else if (base.includes("segment") || base.includes("survey")) byName.segments = f;
    }
    if (!byName.countries) {
      setImportStatus("Missing countries.csv — at minimum that file is required.");
      return;
    }
    try {
      const payload = await parseCsvBundle({
        countries: byName.countries,
        fields: byName.fields,
        wells: byName.wells,
        calculations: byName.calculations,
        segments: byName.segments,
      });
      const r = await importMut.mutateAsync(payload);
      setImportStatus(
        `Imported ${r.counts.countries} countries, ${r.counts.fields} fields, ` +
        `${r.counts.wells} wells, ${r.counts.calculations} calcs, ${r.counts.segments} segments.`
      );
    } catch (e) {
      setImportStatus(`Import failed: ${String(e)}`);
    }
  }

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error || !data) return <div className="p-6 text-red-600">Project not found.</div>;

  const units = JSON.parse(data.units);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-3">
        <Link to="/projects" className="text-sm text-blue-600 hover:underline">
          ← All projects
        </Link>
      </div>

      <h2 className="text-xl sm:text-2xl font-semibold mb-1 text-gray-900">{data.name}</h2>
      <p className="text-xs sm:text-sm text-gray-500 mb-6">
        Units: <span className="font-mono">{units.length}</span> /{" "}
        <span className="font-mono">{units.angle}</span> /{" "}
        <span className="font-mono">{units.dls}</span>
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h3 className="text-base sm:text-lg font-medium text-gray-900">Countries</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={importInput}
            type="file"
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              onCsvFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => importInput.current?.click()}
            disabled={importMut.isPending}
            title="Bulk-load Country/Field/Well/Calculation/Segment CSVs (Pascal MIXED column names)"
            className="text-sm px-3 h-9 rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-300"
          >
            {importMut.isPending ? "Importing…" : "Import CSVs"}
          </button>
          <AddInline placeholder="New country name" testId="add-country" onSubmit={(name) => addCountry.mutate(name)} />
        </div>
      </div>

      {importStatus && (
        <p className={`text-xs mb-3 ${importStatus.startsWith("Import failed") ? "text-red-600" : "text-green-700"}`}>
          {importStatus}
        </p>
      )}

      <div className="space-y-3">
        {data.countries.length === 0 && (
          <p className="text-sm text-gray-500">No countries yet.</p>
        )}
        {data.countries.map((c) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <span className="font-semibold text-gray-900">🌎 {c.name}</span>
              <AddInline
                placeholder="Field name"
                small
                testId={`add-field-${c.name.replace(/\s+/g, "_")}`}
                onSubmit={(name) => addField.mutate({ countryId: c.id, name })}
              />
            </div>
            <div className="sm:pl-4 space-y-2">
              {c.fields.length === 0 && <p className="text-xs text-gray-400 italic">No fields yet.</p>}
              {c.fields.map((f) => (
                <div key={f.id} className="border border-gray-100 rounded-md p-2 sm:p-3 bg-gray-50/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-800">📍 {f.name}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to={`/fields/${f.id}/maps`}
                        className="text-xs text-blue-600 hover:underline whitespace-nowrap font-medium"
                      >
                        Maps →
                      </Link>
                      <AddInline
                        placeholder="Well name"
                        small
                        testId={`add-well-${f.name.replace(/\s+/g, "_")}`}
                        onSubmit={(name) => addWell.mutate({ fieldId: f.id, name })}
                      />
                    </div>
                  </div>
                  <div className="sm:pl-4 space-y-1.5">
                    {f.wells.length === 0 && <p className="text-xs text-gray-400 italic">No wells yet.</p>}
                    {f.wells.map((w) => (
                      <div
                        key={w.id}
                        data-testid={`well-card-${w.name.replace(/\s+/g, "_")}`}
                        className="border border-gray-100 rounded-md p-2 bg-white"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                          <span className="text-sm text-gray-800">⛏️ {w.name}</span>
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() =>
                                addCalc.mutate({ wellId: w.id, name: "Well Design", type: "WellDesign" })
                              }
                              data-testid={`add-well-design-${w.name.replace(/\s+/g, "_")}`}
                              className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md"
                            >
                              + Well Design
                            </button>
                            <button
                              onClick={() =>
                                addCalc.mutate({ wellId: w.id, name: "Survey Editor", type: "SurveyEditor" })
                              }
                              className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-md"
                            >
                              + Survey Editor
                            </button>
                          </div>
                        </div>
                        <ul className="pl-4 text-xs text-gray-600">
                          {w.calculations.map((calc) => (
                            <li key={calc.id}>
                              <Link to={`/calculations/${calc.id}`} className="text-blue-600 hover:underline">
                                {calc.name}
                              </Link>{" "}
                              <span className="text-gray-400">({calc.type})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddInline({
  placeholder,
  onSubmit,
  small,
  testId,
}: {
  placeholder: string;
  onSubmit: (name: string) => void;
  small?: boolean;
  /** Optional stable selector for E2E tests. The input gets `data-testid={testId}-input`
   *  and the button gets `data-testid={testId}-button`. */
  testId?: string;
}) {
  const [v, setV] = useState("");
  const inputCls = small
    ? "text-xs px-2 h-7"
    : "text-sm px-3 h-9";
  const btnCls = small
    ? "text-xs px-2 h-7"
    : "text-sm px-3 h-9";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) {
          onSubmit(v.trim());
          setV("");
        }
      }}
      className="flex gap-1"
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        data-testid={testId ? `${testId}-input` : undefined}
        className={`border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputCls}`}
      />
      <button
        type="submit"
        data-testid={testId ? `${testId}-button` : undefined}
        className={`bg-blue-600 text-white rounded-md hover:bg-blue-700 active:bg-blue-800 font-medium ${btnCls}`}
      >
        Add
      </button>
    </form>
  );
}
