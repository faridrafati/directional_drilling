/**
 * The Edit Data window (manual §3.9), on the web.
 *
 * Left: the subject-area folder tree, derived from the database schema itself
 * (idwell tables are subject areas; the name-prefix rule gives the subfolders),
 * with per-well record counts — a dimmed folder holds no records, exactly as
 * the manual describes the paper-in-folder icons.
 *
 * Right: the records of the selected folder. Horizontal edit mode shows records
 * as rows; vertical mode as columns. A subfolder's records belong to the record
 * selected in the PARENT folder — the parent chain is shown above the grid, and
 * Previous/Next page through the parent's records (§3.9 "View All Available
 * Records"). The ghost row at the bottom becomes a new record the moment it is
 * saved. Deleting a record deletes its subfolder records too — the server
 * enforces the same cascade the manual documents.
 *
 * Lookup lists: fields whose library binding is known (wellview-picklists.json,
 * derived from the sample data through WellView's own data model) render as a
 * datalist — type freely or pick, which mirrors "enter the item in the Edit
 * Data window, not the Library" for non-restricted lists.
 *
 * ID/link columns are shown dimmed and are never editable; system fields are
 * hidden until "Show System Fields" is ticked, as in the desktop app.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvRecords, type WvTreeNode } from "../../entry/wellviewDb.js";
import { usePicklistCatalog } from "../../entry/picklists.js";

type Row = Record<string, string | number | null>;

interface Props {
  db: string;
  idwell: string;
  wellName: string;
  /** Open at this table if given (double-click from a report block). */
  initialTable?: string | null;
  onClose: () => void;
}

export function EditData({ db, idwell, wellName, initialTable, onClose }: Props) {
  const qc = useQueryClient();
  const [table, setTable] = useState<string | null>(initialTable ?? "wvWellHeader");
  const [vertical, setVertical] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  /** Selected parent record per PARENT table — the §3.9 navigation state. */
  const [parentPick, setParentPick] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string | null>(null);

  const treeQ = useQuery({
    queryKey: ["wvdb", db, "tree", idwell],
    queryFn: () => wvDbApi.tree(db, idwell),
  });
  const tree = useMemo(() => treeQ.data?.tree ?? [], [treeQ.data]);

  /** Chain of tables from the subject area down to the selected folder. */
  const chain = useMemo(() => {
    if (!table) return [];
    const path: WvTreeNode[] = [];
    const walk = (nodes: WvTreeNode[], acc: WvTreeNode[]): boolean => {
      for (const n of nodes) {
        const next = [...acc, n];
        if (n.table.toLowerCase() === table.toLowerCase()) { path.push(...next); return true; }
        if (walk(n.children, next)) return true;
      }
      return false;
    };
    walk(tree, []);
    return path;
  }, [tree, table]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* title bar — the manual: it names the well being worked */}
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">Edit Data</span>
          <span className="text-xs text-gray-300 truncate">{wellName}</span>
          <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-300">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            Show System Fields
          </label>
          <button type="button" onClick={() => setVertical((v) => !v)}
            title="Change Edit Mode — horizontal reads left to right, vertical top to bottom"
            className="h-7 px-2 text-[11px] rounded border border-gray-600 text-gray-200 hover:bg-gray-700">
            {vertical ? "Vertical" : "Horizontal"} mode
          </button>
          <button type="button" onClick={onClose} data-testid="wv-edit-save-exit"
            className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500">
            Save and Exit
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* folder tree */}
          <aside className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto p-1.5 bg-gray-50">
            {treeQ.isLoading && <div className="p-2 text-xs text-gray-400">Reading the schema…</div>}
            <FolderTree nodes={tree} depth={0} active={table} onPick={setTable} />
          </aside>

          {/* records */}
          <section className="flex-1 min-w-0 flex flex-col min-h-0">
            {table && treeQ.data ? (
              <FolderRecords
                key={`${table}-${chain.length}-${showSystem}`}
                db={db} idwell={idwell} table={table} chain={chain}
                vertical={vertical} showSystem={showSystem}
                parentPick={parentPick} setParentPick={setParentPick}
                onStatus={setStatus}
                onDirty={() => { void qc.invalidateQueries({ queryKey: ["wvdb", db, "tree", idwell] }); }}
              />
            ) : (
              <div className="flex-1 grid place-items-center text-sm text-gray-400">Pick a folder.</div>
            )}
            {status && (
              <div className="px-3 py-1 border-t border-gray-100 text-[11px] text-gray-500 shrink-0">{status}</div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FolderTree({ nodes, depth, active, onPick }: {
  nodes: WvTreeNode[]; depth: number; active: string | null; onPick: (t: string) => void;
}) {
  return (
    <div>
      {nodes.map((n) => (
        <div key={n.table}>
          <button type="button"
            style={{ paddingLeft: 6 + depth * 14 }}
            className={`w-full text-left pr-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 ${
              active?.toLowerCase() === n.table.toLowerCase()
                ? "bg-blue-100 text-blue-900 font-medium"
                : n.count > 0 ? "text-gray-800 hover:bg-gray-100" : "text-gray-400 hover:bg-gray-100"}`}
            title={n.table}
            onClick={() => onPick(n.table)}>
            <FolderGlyph filled={n.count > 0} />
            <span className="truncate">{n.label}</span>
            {n.count > 0 && <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{n.count}</span>}
          </button>
          {n.children.length > 0 && (
            <FolderTree nodes={n.children} depth={depth + 1} active={active} onPick={onPick} />
          )}
        </div>
      ))}
    </div>
  );
}

/** Filled folders carry "paper"; empty folders are dimmed — the manual's cue. */
function FolderGlyph({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`w-3.5 h-3.5 shrink-0 ${filled ? "text-amber-500" : "text-gray-300"}`}
      fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5v7A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-8.5z" />
      {filled && <rect x="4" y="6.5" width="8" height="1.2" fill="#fff" opacity="0.8" />}
    </svg>
  );
}

/**
 * The records grid for one folder, including the parent-record chain.
 *
 * Parent resolution: for a chain A → B → C (folder C selected), the records of
 * B shown are those under the picked record of A, and C's records are those
 * under the picked record of B. Each level's pick is an index, defaulting to
 * the first record, adjustable with Previous/Next exactly as §3.9 describes.
 */
function FolderRecords({ db, idwell, table, chain, vertical, showSystem, parentPick, setParentPick, onStatus, onDirty }: {
  db: string;
  idwell: string;
  table: string;
  chain: { table: string; label: string }[];
  vertical: boolean;
  showSystem: boolean;
  parentPick: Record<string, number>;
  setParentPick: (f: (p: Record<string, number>) => Record<string, number>) => void;
  onStatus: (s: string | null) => void;
  onDirty: () => void;
}) {
  // Resolve the parent chain record by record, top down.
  const ancestors = chain.slice(0, -1);
  const ancestorQueries: { table: string; label: string; rows: Row[]; pick: number; idrec: string | null }[] = [];
  let parentIdrec: string | null = null;
  let chainBroken = false;

  // Sequential dependent queries — the chain is short (≤4 in practice).
  // Hook-order safety: the number of useQuery calls equals the chain length,
  // which is fixed for a given `table`, and the parent keys this component with
  // the table name — a table change REMOUNTS it, so hook order never shifts
  // within one mounted instance.
  for (const anc of ancestors) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const q = useQuery({
      queryKey: ["wvdb", db, "records", anc.table, idwell, parentIdrec, false],
      queryFn: () => wvDbApi.records(db, anc.table, { idwell, parent: parentIdrec ?? undefined }),
      enabled: !chainBroken,
    });
    const rows = (q.data?.rows ?? []) as Row[];
    const pick = Math.min(parentPick[anc.table] ?? 0, Math.max(0, rows.length - 1));
    const idrec = rows.length ? String(rows[pick].IDRec ?? "") : null;
    ancestorQueries.push({ table: anc.table, label: anc.label, rows, pick, idrec });
    if (!idrec) chainBroken = true;
    parentIdrec = idrec;
  }

  const recordsQ = useQuery({
    queryKey: ["wvdb", db, "records", table, idwell, parentIdrec, showSystem],
    queryFn: () => wvDbApi.records(db, table, {
      idwell, parent: parentIdrec ?? undefined, system: showSystem,
    }),
    enabled: !chainBroken || ancestors.length === 0,
  });

  const data = recordsQ.data;
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "records", table] });
    onDirty();
  };

  if (ancestors.length && chainBroken) {
    const broken = ancestorQueries.find((a) => !a.idrec);
    return (
      <div className="p-4 text-sm text-gray-500">
        <b>{chain[chain.length - 1]?.label}</b> records belong to a record in{" "}
        <b>{broken?.label}</b>, and this well has none yet — add the parent record first, the way the
        manual has you work down the subject areas in order.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* parent chain + Previous/Next (§3.9) */}
      {ancestorQueries.length > 0 && (
        <div className="px-3 py-1.5 border-b border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600 shrink-0">
          {ancestorQueries.map((a) => (
            <span key={a.table} className="flex items-center gap-1">
              <span className="text-gray-400">{a.label}:</span>
              <button type="button" disabled={a.pick <= 0}
                onClick={() => setParentPick((p) => ({ ...p, [a.table]: a.pick - 1 }))}
                className="px-1 rounded border border-gray-300 disabled:opacity-30">‹</button>
              <b className="max-w-[16rem] truncate">{recordCaption(a.rows[a.pick])}</b>
              <span className="text-gray-400 tabular-nums">({a.pick + 1}/{a.rows.length})</span>
              <button type="button" disabled={a.pick >= a.rows.length - 1}
                onClick={() => setParentPick((p) => ({ ...p, [a.table]: a.pick + 1 }))}
                className="px-1 rounded border border-gray-300 disabled:opacity-30">›</button>
            </span>
          ))}
        </div>
      )}

      {recordsQ.isLoading ? (
        <div className="p-4 text-sm text-gray-400">Reading records…</div>
      ) : recordsQ.error ? (
        <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {(recordsQ.error as Error).message}
        </div>
      ) : data ? (
        <RecordsGrid
          db={db} idwell={idwell} data={data} vertical={vertical} showIds={showSystem}
          parentIdrec={parentIdrec} onSaved={refresh} onStatus={onStatus}
        />
      ) : null}
    </div>
  );
}

/** Something readable to identify a record by in the parent chain. */
function recordCaption(row: Row | undefined): string {
  if (!row) return "—";
  for (const k of ["DtTmStart", "DtTm", "DtTmRun", "Des", "WellName", "ZoneName", "Com"]) {
    const v = row[k];
    if (v != null && v !== "") {
      const s = String(v);
      const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
      if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
      return s.slice(0, 40);
    }
  }
  return String(row.IDRec ?? "record").slice(0, 12);
}

/**
 * The editable grid. Edits accumulate per record and save on blur of the row
 * (or the Save button); the ghost row inserts on save. Green fields — WellView's
 * calculated fields — do not exist in the stored schema, so what the desktop
 * grays out simply is not here; ID/link columns are the dimmed, uneditable ones.
 */
function RecordsGrid({ db, idwell, data, vertical, showIds, parentIdrec, onSaved, onStatus }: {
  db: string;
  idwell: string;
  data: WvRecords;
  vertical: boolean;
  /** Show the idwell/IDRec link columns — tied to "Show System Fields", since
   *  the desktop app never shows record GUIDs in the grid at all. */
  showIds: boolean;
  parentIdrec: string | null;
  onSaved: () => void;
  onStatus: (s: string | null) => void;
}) {
  const cols = data.columns.filter((c) => showIds || !c.id);
  const [edits, setEdits] = useState<Record<string, Row>>({});      // idrec → changed fields
  const [ghost, setGhost] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const plQ = usePicklistCatalog();

  useEffect(() => { setEdits({}); setGhost({}); }, [data.table, parentIdrec]);

  /** Lookup values for a column, when the library binding knows it. */
  const lookupFor = useMemo(() => {
    const map = new Map<string, string[]>();
    const cat = plQ.data;
    if (!cat) return map;
    for (const pl of Object.values(cat.picklists)) {
      const [t, c] = pl.source.split(".");
      if (t?.toLowerCase() === data.table.toLowerCase() && pl.usable) {
        map.set(c.toLowerCase(), pl.values.map((v) => v.value));
      }
    }
    return map;
  }, [plQ.data, data.table]);

  const dirtyCount = Object.keys(edits).length + (Object.keys(ghost).length ? 1 : 0);

  async function saveAll() {
    setBusy(true);
    onStatus(null);
    try {
      let saved = 0;
      for (const [idrec, values] of Object.entries(edits)) {
        if (Object.keys(values).length === 0) continue;
        await wvDbApi.update(db, data.table, idrec, values);
        saved++;
      }
      if (Object.values(ghost).some((v) => v !== null && v !== "")) {
        await wvDbApi.insert(db, data.table, {
          idwell, ...(parentIdrec ? { parent: parentIdrec } : {}), values: ghost,
        });
        saved++;
      }
      setEdits({});
      setGhost({});
      onSaved();
      onStatus(saved ? `Saved ${saved} record${saved === 1 ? "" : "s"}.` : "Nothing to save.");
    } catch (e) {
      onStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(row: Row) {
    setBusy(true);
    try {
      const values: Record<string, unknown> = {};
      for (const c of cols) {
        if (c.id || c.system) continue;
        if (row[c.column] != null) values[c.column] = row[c.column];
      }
      await wvDbApi.insert(db, data.table, { idwell, ...(parentIdrec ? { parent: parentIdrec } : {}), values });
      onSaved();
      onStatus("Record duplicated (subfolder records are not copied by the web app — yet).");
    } catch (e) {
      onStatus(`Duplicate failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: Row) {
    const idrec = String(row.IDRec ?? "");
    if (!idrec) return;
    // The manual warns: deleting removes subfolder records too. Say so.
    if (!window.confirm("Delete this record? Records in its subfolders are deleted with it.")) return;
    setBusy(true);
    try {
      const res = await wvDbApi.remove(db, data.table, idrec);
      onSaved();
      onStatus(`Deleted ${res.removed} record${res.removed === 1 ? "" : "s"} (including subfolders).`);
    } catch (e) {
      onStatus(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const editable = (c: { id: boolean; system: boolean }) => !c.id && !c.system;
  const valueOf = (row: Row, idrec: string, col: string): string => {
    const e = edits[idrec];
    if (e && col in e) return String(e[col] ?? "");
    return row[col] == null ? "" : String(row[col]);
  };
  const setValue = (idrec: string, col: string, v: string) =>
    setEdits((es) => ({ ...es, [idrec]: { ...es[idrec], [col]: v } }));

  const cellInput = (row: Row | null, idrec: string | null, c: WvRecords["columns"][number]) => {
    const isGhost = idrec === null;
    const val = isGhost ? String(ghost[c.column] ?? "") : valueOf(row!, idrec!, c.column);
    if (!editable(c) && !isGhost) {
      return <span className="block px-1.5 py-0.5 text-gray-400 font-mono text-[10px] truncate" title={val}>{val}</span>;
    }
    if (!editable(c) && isGhost) return <span className="block px-1.5 py-0.5 text-gray-300 text-[10px]">auto</span>;
    const lookup = lookupFor.get(c.column.toLowerCase());
    const listId = lookup ? `wv-lu-${data.table}-${c.column}` : undefined;
    return (
      <>
        <input
          value={val}
          list={listId}
          placeholder={isGhost ? "new…" : undefined}
          onChange={(e) => (isGhost
            ? setGhost((g) => ({ ...g, [c.column]: e.target.value }))
            : setValue(idrec!, c.column, e.target.value))}
          className={`w-full min-w-[7rem] px-1.5 py-0.5 text-[11px] bg-transparent border border-transparent rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
        {lookup && (
          <datalist id={listId}>
            {lookup.map((v) => <option key={v} value={v} />)}
          </datalist>
        )}
      </>
    );
  };

  const rowActions = (row: Row) => (
    <div className="flex gap-1 px-1">
      <button type="button" title="Duplicate Record" disabled={busy}
        onClick={() => void duplicate(row)}
        className="text-gray-400 hover:text-blue-600 text-[11px]">⧉</button>
      <button type="button" title="Delete Record (subfolder records go with it)" disabled={busy}
        onClick={() => void remove(row)}
        className="text-gray-400 hover:text-red-600 text-[11px]">✕</button>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-800">{data.label}</span>
        <span className="text-[10px] text-gray-400 font-mono">{data.table}</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{data.rows.length} record{data.rows.length === 1 ? "" : "s"}</span>
        <button type="button" onClick={() => void saveAll()} disabled={busy || dirtyCount === 0}
          data-testid="wv-edit-save"
          className="ml-auto h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
          {busy ? "Saving…" : dirtyCount ? `Save (${dirtyCount})` : "Saved"}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {vertical ? (
          /* vertical edit mode: fields down the left, records across */
          <table className="text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="sticky left-0 bg-gray-100 px-2 py-1 border-b border-gray-200" />
                {data.rows.map((r, i) => (
                  <td key={i} className="px-2 py-1 border-b border-l border-gray-200 text-center text-gray-400">
                    #{i + 1}{rowActions(r)}
                  </td>
                ))}
                <td className="px-2 py-1 border-b border-l border-gray-200 text-center italic text-gray-400">new</td>
              </tr>
              {cols.map((c) => (
                <tr key={c.column}>
                  <td className="sticky left-0 bg-gray-100 px-2 py-0.5 font-medium text-gray-600 whitespace-nowrap border-b border-gray-100"
                    title={`${data.table}.${c.column}`}>
                    {c.label}
                  </td>
                  {data.rows.map((r, i) => (
                    <td key={i} className="border-b border-l border-gray-100 align-top">
                      {cellInput(r, String(r.IDRec ?? `row${i}`), c)}
                    </td>
                  ))}
                  <td className="border-b border-l border-gray-100 align-top bg-blue-50/40">
                    {cellInput(null, null, c)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* horizontal edit mode: records as rows */
          <table className="text-[11px] border-collapse min-w-full">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="px-1 py-1 border-b border-gray-200 w-12" />
                {cols.map((c) => (
                  <th key={c.column}
                    className={`px-1.5 py-1 text-left font-medium whitespace-nowrap border-b border-gray-200 ${
                      c.id || c.system ? "text-gray-400" : "text-gray-600"}`}
                    title={`${data.table}.${c.column}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => {
                const idrec = String(r.IDRec ?? `row${i}`);
                const dirty = !!edits[idrec] && Object.keys(edits[idrec]).length > 0;
                return (
                  <tr key={idrec} className={`${i % 2 ? "bg-gray-50" : ""} ${dirty ? "outline outline-1 outline-blue-300" : ""}`}>
                    <td className="align-middle">{rowActions(r)}</td>
                    {cols.map((c) => (
                      <td key={c.column} className="border-b border-gray-100 align-top">
                        {cellInput(r, idrec, c)}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* the ghost record (§3.9 Add a New Record) */}
              <tr className="bg-blue-50/40">
                <td className="px-1 text-[10px] text-gray-400 italic align-middle">new</td>
                {cols.map((c) => (
                  <td key={c.column} className="border-b border-gray-100 align-top">
                    {cellInput(null, null, c)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
