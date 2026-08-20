/**
 * Writing a query template (§8.1).
 *
 * Running the 29 templates Peloton ships has worked for a while; this is
 * authoring one. A query is a list of criteria — a column, an operator, a value
 * — and the wells it finds are the ones satisfying all of them.
 *
 * THE SEMANTIC THE USER HAS TO SEE. Criteria on the SAME table must hold on the
 * SAME row: two conditions on wvJobReport mean one daily report satisfying
 * both, not two reports each satisfying one. That is what makes a date range
 * mean a report inside the window rather than any two reports either side of
 * it, and it is stated on screen because it is not guessable from the form.
 *
 * Only per-well tables are offered. A criterion on a table with no idwell
 * cannot select wells, and the runner would skip it — better that the builder
 * cannot compose it at all.
 *
 * Nothing is saved until it has been previewed: the Run button reports how many
 * wells the criteria find, so a query that matches everything or nothing is
 * visible before it is given a name.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvCriterion, type WvSavedQuery } from "../../entry/wellviewDb.js";

const OPS = [
  { op: "=", label: "is" },
  { op: "<>", label: "is not" },
  { op: "LIKE", label: "starts with" },
  { op: "NOT LIKE", label: "does not start with" },
  { op: ">=", label: "is at least" },
  { op: "<=", label: "is at most" },
  { op: ">", label: "is more than" },
  { op: "<", label: "is less than" },
  { op: "IS NULL", label: "is empty" },
  { op: "IS NOT NULL", label: "is not empty" },
];
const NEEDS_VALUE = (op: string) => op !== "IS NULL" && op !== "IS NOT NULL";

interface Props {
  db: string;
  /** Editing an existing saved query, or null for a new one. */
  editing: WvSavedQuery | null;
  onClose: () => void;
  onSaved: () => void;
}

export function QueryBuilder({ db, editing, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [criteria, setCriteria] = useState<WvCriterion[]>(
    // A saved query's criteria carry display labels and a nullable operator;
    // the builder works in the plain shape it will send back.
    editing?.criteria.length
      ? editing.criteria.map((c) => ({
          table: c.table, field: c.field, op: c.op ?? "=",
          value: c.value ?? "", prompts: c.prompts,
        }))
      : [{ table: "", field: "", op: "=", value: "" }]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesQ = useQuery({
    queryKey: ["wvdb", db, "query-tables"],
    queryFn: () => wvDbApi.queryTables(db),
    staleTime: Infinity,
  });

  const set = (i: number, patch: Partial<WvCriterion>) =>
    setCriteria((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const complete = useMemo(
    () => criteria.filter((c) => c.table && c.field && c.op
      && (!NEEDS_VALUE(c.op) || (c.value ?? "").trim() !== "")),
    [criteria]);

  const run = async () => {
    setBusy(true); setError(null); setPreview(null);
    try {
      const res = await wvDbApi.runCriteria(db, complete);
      const skipped = res.skipped.length ? ` (${res.skipped.length} criterion skipped)` : "";
      setPreview(`${res.wells.length} well${res.wells.length === 1 ? "" : "s"} match${skipped}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await wvDbApi.saveQuery(db, {
        id: editing?.id, name: name.trim(), category: category.trim() || undefined, criteria: complete,
      });
      await qc.invalidateQueries({ queryKey: ["wvdb", db, "saved-queries"] });
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full max-w-3xl mx-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">{editing ? "Edit query" : "New query"}</span>
          <button type="button" onClick={onClose} data-testid="wv-qb-close"
            className="ml-auto h-7 px-3 text-[11px] rounded bg-gray-700 hover:bg-gray-600">Close</button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-600">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} data-testid="wv-qb-name"
                placeholder="Wells spudded this year"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-2 text-xs" />
            </label>
            <label className="text-[11px] text-gray-600">
              Category (optional)
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="Drilling" data-testid="wv-qb-category"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-2 text-xs" />
            </label>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-800">Criteria</p>
            <p className="text-[11px] text-gray-500 mb-1.5">
              A well must satisfy every line. Lines on the <b>same table</b> must be satisfied by the
              <b> same record</b> — two conditions on a daily report mean one report meeting both,
              not two reports meeting one each.
            </p>
            <ul className="space-y-1.5">
              {criteria.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5" data-testid="wv-qb-row">
                  <select value={c.table} data-testid="wv-qb-table"
                    onChange={(e) => set(i, { table: e.target.value, field: "" })}
                    className="h-8 border border-gray-300 rounded px-1 text-xs bg-white min-w-[10rem]">
                    <option value="">Subject area…</option>
                    {(tablesQ.data?.tables ?? []).map((t) => (
                      <option key={t.table} value={t.table}>{t.label}</option>
                    ))}
                  </select>
                  <FieldPicker db={db} table={c.table} value={c.field}
                    onChange={(field) => set(i, { field })} />
                  <select value={c.op} onChange={(e) => set(i, { op: e.target.value })}
                    data-testid="wv-qb-op"
                    className="h-8 border border-gray-300 rounded px-1 text-xs bg-white">
                    {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                  </select>
                  {NEEDS_VALUE(c.op) && (
                    <input value={c.value ?? ""} onChange={(e) => set(i, { value: e.target.value })}
                      data-testid="wv-qb-value" placeholder="value"
                      className="h-8 border border-gray-300 rounded px-2 text-xs w-40" />
                  )}
                  <button type="button" onClick={() => setCriteria((cs) => cs.filter((_, k) => k !== i))}
                    disabled={criteria.length === 1} title="Remove this line"
                    className="h-8 w-8 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30">×</button>
                </li>
              ))}
            </ul>
            <button type="button" data-testid="wv-qb-add"
              onClick={() => setCriteria((cs) => [...cs, { table: "", field: "", op: "=", value: "" }])}
              className="mt-1.5 h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">
              Add a criterion
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
            <button type="button" onClick={() => void run()} data-testid="wv-qb-run"
              disabled={busy || complete.length === 0}
              className="h-8 px-3 text-xs rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
              Test it
            </button>
            <button type="button" onClick={() => void save()} data-testid="wv-qb-save"
              disabled={busy || complete.length === 0 || !name.trim()}
              className="h-8 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
              {editing ? "Save changes" : "Save query"}
            </button>
            {preview && <span className="text-[11px] text-gray-700" data-testid="wv-qb-preview">{preview}</span>}
            {error && <span className="text-[11px] text-red-700" data-testid="wv-qb-error">{error}</span>}
            {complete.length < criteria.length && (
              <span className="text-[11px] text-gray-400">
                {criteria.length - complete.length} incomplete line(s) ignored
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The columns of one table, by the model's captions. */
function FieldPicker({ db, table, value, onChange }: {
  db: string; table: string; value: string; onChange: (f: string) => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "query-fields", table],
    queryFn: () => wvDbApi.queryFields(db, table),
    enabled: !!table,
    staleTime: Infinity,
  });
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!table}
      data-testid="wv-qb-field"
      className="h-8 border border-gray-300 rounded px-1 text-xs bg-white min-w-[10rem] disabled:bg-gray-50">
      <option value="">{table ? "Field…" : "—"}</option>
      {(q.data?.fields ?? []).map((f) => (
        <option key={f.field} value={f.field}>{f.label}</option>
      ))}
    </select>
  );
}
