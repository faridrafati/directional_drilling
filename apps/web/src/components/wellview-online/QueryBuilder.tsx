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
 *
 * DEPTHS CANNOT BE QUERIED FROM ANOTHER DATUM. WellView's own help is flat
 * about it: "You can query depths only when you are using Original KB Elevation
 * for reference datum. All depths are stored relative to the original KB in the
 * database. The query engine can run against these values. If you select a
 * different reference datum for reference, the query datum cannot determine the
 * specific datum offsets for each well." The offset is per WELL, and a query
 * runs across all of them at once, so there is no single number to shift the
 * criterion by. The builder therefore refuses depth fields while another datum
 * is selected rather than matching a casing-flange number against kelly-bushing
 * values and returning a confident, wrong list of wells.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvCriterion, type WvQueryField, type WvSavedQuery } from "../../entry/wellviewDb.js";
import { useDatum } from "../../entry/datum.js";
import { useUnitSet } from "../../entry/unitSet.js";
import { DATUM_LABELS } from "@dd/shared";

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
  const [datum] = useDatum();
  const depthsQueryable = datum === "OrigKB";
  const [name, setName] = useState(editing?.name ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [criteria, setCriteria] = useState<WvCriterion[]>(
    // A saved query's criteria carry display labels and a nullable operator;
    // the builder works in the plain shape it will send back.
    editing?.criteria.length
      ? editing.criteria.map((c) => ({
          table: c.table, field: c.field, op: c.op ?? "=",
          value: c.value ?? "", prompts: c.prompts, conj: c.conj,
        }))
      : [{ table: "", field: "", op: "=", value: "" }]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sql, setSql] = useState("");
  /**
   * The chosen field per criterion row, so the value box can say which unit it
   * is asking for. Keyed by row index, which is what `set(i, …)` uses.
   */
  const [fieldOf, setFieldOf] = useState<Record<number, WvQueryField | null>>({});
  const [unitSet] = useUnitSet();

  /**
   * §8.1's "Paste From Criteria" — the grid above, written out as SQL.
   *
   * Deliberately the SAME shape the runner builds: one EXISTS per subject area
   * so that criteria on a table hold on ONE of its rows, groups ANDed, OR
   * between groups. A statement that read differently would be a second,
   * quietly diverging implementation of the query, which is worse than none.
   *
   * Values are inlined with quotes doubled, because this is a starting point a
   * person then edits — a placeholder they had to fill in would defeat it.
   */
  const sqlFromCriteria = (cs: WvCriterion[]): string => {
    if (!cs.length) return "";
    const groups: WvCriterion[][] = [];
    cs.forEach((c, i) => {
      if (i === 0 || c.conj !== "OR") {
        if (!groups.length) groups.push([]);
        groups[groups.length - 1].push(c);
      } else groups.push([c]);
    });
    const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;
    const groupSql = groups.map((g) => {
      const byTable = new Map<string, string[]>();
      for (const c of g) {
        const preds = byTable.get(c.table) ?? [];
        if (c.op === "IS NULL" || c.op === "IS NOT NULL") preds.push(`x."${c.field}" ${c.op}`);
        // A PROMPTING criterion cannot become a named parameter here.
        //
        // This SQL is pasted into the editor and run as a plain string with no
        // parameters bound, and node:sqlite does not throw on an unbound named
        // parameter — it returns no rows. So ":Field" turned "show me this SQL"
        // into a query that silently answers "0 wells", indistinguishable from
        // a real empty result.
        //
        // The value the user has typed is inlined instead, exactly as every
        // other criterion is; the file's own note says values are inlined
        // "because a placeholder they had to fill in would defeat it". A prompt
        // with nothing typed yet is dropped and reported, rather than pasted as
        // SQL that cannot run.
        // Nothing typed yet: drop it. The caller names what it dropped.
        else if (c.prompts && (c.value ?? "").trim() === "") { /* no predicate */ }
        else if (c.prompts) preds.push(`x."${c.field}" ${c.op} ${lit(c.value ?? "")}`);
        else if (c.op === "LIKE" || c.op === "NOT LIKE") {
          preds.push(`x."${c.field}" ${c.op} ${lit(`%${c.value ?? ""}%`)}`);
        } else preds.push(`x."${c.field}" ${c.op} ${lit(c.value ?? "")}`);
        byTable.set(c.table, preds);
      }
      // A table left with no predicates — every criterion on it was an
      // unfilled prompt — must not become "… WHERE x.idwell = h.idwell AND )".
      const parts = [...byTable.entries()].filter(([, preds]) => preds.length).map(([t, preds]) =>
        `EXISTS (SELECT 1 FROM "${t}" x WHERE x.idwell = h.idwell AND ${preds.join(" AND ")})`);
      if (!parts.length) return null;
      return parts.length > 1 ? `(${parts.join("\n     AND ")})` : parts[0];
    }).filter((g): g is string => g !== null);
    // Nothing left to ask. Returning empty SQL beats "WHERE" with no condition,
    // which would select every well and look like a working query.
    if (!groupSql.length) return "";
    return `SELECT h.idwell, h."WellName"\n  FROM "wvWellHeader" h\n WHERE ${groupSql.join("\n    OR ")}`;
  };

  const runSql = async () => {
    setBusy(true); setError(null); setPreview(null);
    try {
      const r = await wvDbApi.runSql(db, sql);
      const extra = r.unknown.length
        ? ` ${r.unknown.length} id${r.unknown.length === 1 ? "" : "s"} matched no well.`
        : "";
      setPreview(`${r.wells.length} well${r.wells.length === 1 ? "" : "s"}`
        + (r.truncated ? " (truncated)" : "") + `.${extra}`);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  const tablesQ = useQuery({
    queryKey: ["wvdb", db, "query-tables"],
    queryFn: () => wvDbApi.queryTables(db),
    staleTime: Infinity,
  });

  const set = (i: number, patch: Partial<WvCriterion>) =>
    setCriteria((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const complete = useMemo(
    // A criterion that PROMPTS is complete without a value: the value is
    // supplied when the query runs, which is what makes one template serve
    // every contact name (§8.1).
    () => criteria.filter((c) => c.table && c.field && c.op
      && (!NEEDS_VALUE(c.op) || c.prompts === true || (c.value ?? "").trim() !== "")),
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
            {!depthsQueryable && (
              <p className="mb-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800"
                data-testid="wv-qb-datum-notice">
                Depth fields cannot be queried while the reference datum is
                <b> {DATUM_LABELS[datum]}</b>. Depths are stored from the original KB and the
                offset differs per well, so there is no single number to compare against. Switch
                the datum back to <b>Original KB Elevation</b> to query on depth — everything
                else can be queried from any datum.
              </p>
            )}
            <p className="text-[11px] text-gray-500 mb-1.5">
              Lines joined by <b>And</b> must all hold; an <b>Or</b> starts a new alternative, and a
              well matches if any alternative does. Lines on the <b>same table</b> must be satisfied
              by the <b>same record</b> — two conditions on a daily report mean one report meeting
              both, not two reports meeting one each. Unlike the desktop, an <b>And</b> across
              different subject areas really does mean both (§8.1 notes that WellView degrades it to
              an Or and suggests Custom SQL instead).
            </p>
            <ul className="space-y-1.5">
              {criteria.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5" data-testid="wv-qb-row">
                  {/* §8.1: "Add a condition to every line in the list of
                      criteria, except the first one." */}
                  {i === 0 ? (
                    <span className="w-14 text-[10px] uppercase tracking-wide text-gray-400 text-right pr-1">
                      where
                    </span>
                  ) : (
                    <select value={c.conj ?? "AND"} data-testid="wv-qb-conj"
                      onChange={(e) => set(i, { conj: e.target.value as "AND" | "OR" })}
                      className="h-8 w-14 border border-gray-300 rounded px-1 text-xs bg-white">
                      <option value="AND">And</option>
                      <option value="OR">Or</option>
                    </select>
                  )}
                  <select value={c.table} data-testid="wv-qb-table"
                    onChange={(e) => set(i, { table: e.target.value, field: "" })}
                    className="h-8 border border-gray-300 rounded px-1 text-xs bg-white min-w-[10rem]">
                    <option value="">Subject area…</option>
                    {(tablesQ.data?.tables ?? []).map((t) => (
                      <option key={t.table} value={t.table}>{t.label}</option>
                    ))}
                  </select>
                  <FieldPicker db={db} table={c.table} value={c.field}
                    depthsQueryable={depthsQueryable}
                    onChange={(field) => set(i, { field })}
                    onField={(f) => setFieldOf((m) => (m[i]?.field === f?.field ? m : { ...m, [i]: f }))} />
                  <select value={c.op} onChange={(e) => set(i, { op: e.target.value })}
                    data-testid="wv-qb-op"
                    className="h-8 border border-gray-300 rounded px-1 text-xs bg-white">
                    {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
                  </select>
                  {NEEDS_VALUE(c.op) && (
                    c.prompts ? (
                      <span className="h-8 px-2 flex items-center text-[11px] text-blue-700 bg-blue-50
                        border border-blue-200 rounded w-40" data-testid="wv-qb-prompted">
                        asked when it runs
                      </span>
                    ) : (
                      <>
                        <ValueBox db={db} table={c.table} field={c.field} value={c.value ?? ""}
                          onChange={(v) => set(i, { value: v })} />
                        {/*
                          * WHAT UNIT THE BOX WANTS.
                          *
                          * The guide: "Value 1 and Value 2 must be in base
                          * units." The app obeys that — it never converts what
                          * is typed here — but it used to take the number in
                          * silence while every other screen showed the field in
                          * the user's own set. wvJobReport.PresCas is stored in
                          * kPa and displayed in psi, so a criterion of 2000
                          * finds one well and the 2000 psi that was meant is
                          * 13,790 kPa and finds none.
                          *
                          * Naming the set's own unit as well, when it differs,
                          * is what makes the number actionable rather than just
                          * labelled.
                          */}
                        {(() => {
                          const f = fieldOf[i];
                          if (!f?.unit) return null;
                          const shown = f.units?.[unitSet]?.unit;
                          return (
                            <span className="text-[10px] text-amber-700 whitespace-nowrap"
                              data-testid="wv-qb-unit-hint"
                              title={shown && shown !== f.unit
                                ? `Stored in ${f.unit}. Your unit set shows this field in ${shown}, but a criterion is read in ${f.unit} — the guide: "Value 1 and Value 2 must be in base units."`
                                : `Stored in ${f.unit}, which is how a criterion is read.`}>
                              in {f.unit}{shown && shown !== f.unit ? `, not ${shown}` : ""}
                            </span>
                          );
                        })()}
                      </>
                    )
                  )}
                  {NEEDS_VALUE(c.op) && (
                    /* §8.1 "Select Prompt for Value": the query asks at run
                       time instead of storing an answer, which is how one
                       template serves every contact name or date range. */
                    <label className="flex items-center gap-1 text-[10px] text-gray-500"
                      title="Prompt for Value (§8.1) — ask for this when the query runs">
                      <input type="checkbox" checked={c.prompts === true}
                        data-testid="wv-qb-prompts"
                        onChange={(e) => set(i, { prompts: e.target.checked })} />
                      Prompt
                    </label>
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

          {/*
            * §8.1 Custom SQL Queries — "users can also build their own searches
            * using a direct SQL query", by typing it, pasting it, or using
            * "Paste From Criteria" to start from the grid above.
            *
            * Read-only and one SELECT at a time; the server enforces both and
            * says which rule was broken rather than surfacing a driver error.
            */}
          <details className="border-t border-gray-100 pt-2" data-testid="wv-qb-sql-panel">
            <summary className="text-xs font-medium text-gray-800 cursor-pointer">
              Custom SQL
            </summary>
            <p className="text-[11px] text-gray-500 mt-1 mb-1.5">
              One <b>SELECT</b>, returning an <b>idwell</b> column — the result is a list of wells.
              Run only; nothing here can change the database.
            </p>
            <div className="flex items-center gap-1.5 mb-1.5">
              <button type="button" data-testid="wv-qb-sql-paste"
                onClick={() => {
                  // A prompting criterion has no value until the query runs, so
                  // there is nothing to inline for it here. Say which ones were
                  // left out rather than pasting SQL that quietly asks less than
                  // the criteria above it do.
                  const unfilled = complete.filter(
                    (c) => c.prompts && (c.value ?? "").trim() === "");
                  const out = sqlFromCriteria(complete);
                  setSql(out);
                  setError(unfilled.length
                    ? `Pasted without ${unfilled.map((c) => c.field).join(", ")} — `
                      + `${unfilled.length === 1 ? "that criterion prompts" : "those criteria prompt"} `
                      + "for a value, and SQL cannot ask. Type a value above to include it."
                    : null);
                }}
                disabled={!complete.length}
                title="Paste From Criteria (§8.1) — start from the lines above"
                className="h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
                Paste From Criteria
              </button>
              <button type="button" data-testid="wv-qb-sql-run"
                onClick={() => void runSql()} disabled={busy || !sql.trim()}
                className="h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-40">
                Run SQL
              </button>
            </div>
            <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={4}
              data-testid="wv-qb-sql"
              placeholder="SELECT DISTINCT idwell FROM wvJob WHERE wvTyp = 'Drilling'"
              className="w-full border border-gray-300 rounded p-2 text-[11px] font-mono" />
          </details>

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
function FieldPicker({ db, table, value, depthsQueryable, onChange, onField }: {
  db: string; table: string; value: string;
  /** False when another reference datum is selected; depth fields are then unusable. */
  depthsQueryable: boolean;
  onChange: (f: string) => void;
  /** The chosen field's definition, so the value box can name its unit. */
  onField?: (f: WvQueryField | null) => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "query-fields", table],
    queryFn: () => wvDbApi.queryFields(db, table),
    enabled: !!table,
    staleTime: Infinity,
  });
  const chosen = (q.data?.fields ?? []).find((f) => f.field === value) ?? null;
  useEffect(() => { onField?.(chosen); }, [chosen?.field, chosen?.unit]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={!table}
      data-testid="wv-qb-field"
      className="h-8 border border-gray-300 rounded px-1 text-xs bg-white min-w-[10rem] disabled:bg-gray-50">
      <option value="">{table ? "Field…" : "—"}</option>
      {(q.data?.fields ?? []).map((f) => {
        // Disabled rather than hidden: a field that vanished from the list would
        // read as "this table has no depth", which is a different and wrong
        // statement. The label says why it cannot be picked.
        const blocked = !!f.applyDatum && !depthsQueryable;
        return (
          <option key={f.field} value={f.field} disabled={blocked}>
            {f.label}{f.unit ? ` (${f.unit})` : ""}{blocked ? "  — needs Original KB" : ""}
          </option>
        );
      })}
    </select>
  );
}

/**
 * A criterion's value, with §8.1's Lookup list.
 *
 * "Click the Lookup button to display a list of values already entered in the
 * field" — the desktop reads the approved library; this reads the DISTINCT
 * values the open database actually holds for the column, which is the same
 * list the Edit Data grid offers and is captioned the same way there. It is a
 * datalist, so the box stays free text: a value not yet in the data is a
 * legitimate thing to search for.
 */
function ValueBox({ db, table, field, value, onChange }: {
  db: string; table: string; field: string; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["wvdb", db, "column-values", table, field],
    // Fetched only when the Lookup is opened: a query can name a dozen fields
    // and almost none of them get looked up.
    queryFn: () => wvDbApi.columnValues(db, table, field),
    enabled: open && !!table && !!field,
    staleTime: 5 * 60 * 1000,
  });
  const listId = `wv-qb-vals-${table}-${field}`.replace(/\W/g, "");
  return (
    <span className="flex items-center gap-1">
      <input value={value} onChange={(e) => onChange(e.target.value)}
        data-testid="wv-qb-value" placeholder="value" list={open ? listId : undefined}
        className="h-8 border border-gray-300 rounded px-2 text-xs w-40" />
      <datalist id={listId}>
        {(q.data?.values ?? []).map((v) => <option key={v} value={v} />)}
      </datalist>
      <button type="button" data-testid="wv-qb-lookup" disabled={!table || !field}
        onClick={() => setOpen(true)}
        title="Lookup (§8.1) — values already entered in this field"
        className="h-8 px-1.5 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-30">
        {q.isFetching ? "…" : "▾"}
      </button>
    </span>
  );
}
