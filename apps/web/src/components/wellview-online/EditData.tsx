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
 * saved.
 *
 * Saving follows the manual's rules: records save automatically when a
 * different folder is selected or the window closes ("Save and Exit"), and
 * Undo All cancels the pending changes of the current folder — before they are
 * saved, exactly the desktop boundary.
 *
 * Field editors, per the manual:
 *  • DtTm fields get the calendar — a native datetime picker in 15-minute
 *    steps (§3.9 WellView Calendar), which also makes 24:00-style invalid
 *    times unenterable (§7.2).
 *  • Library-bound fields carry the ellipsis lookup button (Table 3-6 item J)
 *    opening a filterable, sortable value list; typing stays allowed for
 *    non-restricted lists.
 *  • Record-LINK fields (IDRecWellBore, IDRecString, …) — the associated-data
 *    lookups — open a candidate list of real records with readable captions;
 *    choosing one writes the GUID and keeps the …TK companion (the target
 *    table name) in step, exactly as the desktop stores it.
 *
 * Copy Record puts a record (with its subfolders) on an app-level clipboard;
 * Paste Record inserts it into the same folder of ANY well — the manual's
 * copy-between-wells workflow. Duplicate Record is the same deep copy in place.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvRecordColumn, type WvRecords, type WvTreeNode } from "../../entry/wellviewDb.js";
import { usePicklistCatalog } from "../../entry/picklists.js";

type Row = Record<string, string | number | null>;

/** The app-level record clipboard (Copy Record / Paste Record, §3.9). */
export interface WvClipboard { db: string; table: string; idrec: string; caption: string; label: string }

interface Props {
  db: string;
  idwell: string;
  wellName: string;
  /** Open at this table if given (double-click from a report block). */
  initialTable?: string | null;
  clipboard: WvClipboard | null;
  onClipboard: (c: WvClipboard | null) => void;
  onClose: () => void;
}

export function EditData({ db, idwell, wellName, initialTable, clipboard, onClipboard, onClose }: Props) {
  const qc = useQueryClient();
  const [table, setTable] = useState<string | null>(initialTable ?? "wvWellHeader");
  const [vertical, setVertical] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  /** Selected parent record per PARENT table — the §3.9 navigation state. */
  const [parentPick, setParentPick] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<string | null>(null);
  /** The current grid's pending-edit flusher — §3.9 "records are automatically
   *  saved when a different folder is selected or the window is closed". */
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);

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

  /** Saved edits must reach everything already on screen: the folder tree
   *  counts, the report under this overlay, and the schematic. */
  const onDirty = () => {
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "tree", idwell] });
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "template"] });
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic", idwell] });
  };

  const pickFolder = (t: string) => {
    void (async () => {
      const ok = (await flushRef.current?.()) ?? true;
      if (ok) setTable(t);
    })();
  };
  const saveAndExit = () => {
    void (async () => {
      const ok = (await flushRef.current?.()) ?? true;
      if (ok) onClose();
    })();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-3 sm:p-6" onClick={saveAndExit}>
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
          <button type="button" onClick={saveAndExit} data-testid="wv-edit-save-exit"
            className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500">
            Save and Exit
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* folder tree */}
          <aside className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto p-1.5 bg-gray-50">
            {treeQ.isLoading && <div className="p-2 text-xs text-gray-400">Reading the schema…</div>}
            <FolderTree nodes={tree} depth={0} active={table} onPick={pickFolder} />
          </aside>

          {/* records */}
          <section className="flex-1 min-w-0 flex flex-col min-h-0">
            {table && treeQ.data ? (
              <FolderRecords
                key={`${table}-${chain.length}-${showSystem}`}
                db={db} idwell={idwell} table={table} chain={chain}
                vertical={vertical} showSystem={showSystem}
                parentPick={parentPick} setParentPick={setParentPick}
                clipboard={clipboard} onClipboard={onClipboard}
                onStatus={setStatus}
                onDirty={onDirty}
                registerFlush={(fn) => { flushRef.current = fn; }}
              />
            ) : (
              <div className="flex-1 grid place-items-center text-sm text-gray-400">Pick a folder.</div>
            )}
            {status && (
              <div className="px-3 py-1 border-t border-gray-100 text-[11px] text-gray-500 shrink-0" data-testid="wv-edit-status">
                {status}
              </div>
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
function FolderRecords({ db, idwell, table, chain, vertical, showSystem, parentPick, setParentPick, clipboard, onClipboard, onStatus, onDirty, registerFlush }: {
  db: string;
  idwell: string;
  table: string;
  chain: { table: string; label: string }[];
  vertical: boolean;
  showSystem: boolean;
  parentPick: Record<string, number>;
  setParentPick: (f: (p: Record<string, number>) => Record<string, number>) => void;
  clipboard: WvClipboard | null;
  onClipboard: (c: WvClipboard | null) => void;
  onStatus: (s: string | null) => void;
  onDirty: () => void;
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
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
          parentIdrec={parentIdrec} clipboard={clipboard} onClipboard={onClipboard}
          onSaved={refresh} onStatus={onStatus} registerFlush={registerFlush}
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

/** DtTm columns hold "YYYY-MM-DDTHH:MM:SSZ" wall-clock stamps. */
const isDtTmCol = (c: string) => /^dttm/i.test(c);
const isoToLocalInput = (v: string): string => {
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : "";
};
const localInputToIso = (v: string): string | null => (v ? `${v}:00Z` : null);

/**
 * The editable grid. Edits accumulate per record; they save through the Save
 * button, and automatically when the folder changes or the window closes (the
 * flush the parent registers). The ghost row inserts on save. ID/link keys are
 * server-managed; record-LINK columns edit through the candidates popover.
 */
function RecordsGrid({ db, idwell, data, vertical, showIds, parentIdrec, clipboard, onClipboard, onSaved, onStatus, registerFlush }: {
  db: string;
  idwell: string;
  data: WvRecords;
  vertical: boolean;
  /** Show the idwell/IDRec key columns — tied to "Show System Fields". */
  showIds: boolean;
  parentIdrec: string | null;
  clipboard: WvClipboard | null;
  onClipboard: (c: WvClipboard | null) => void;
  onSaved: () => void;
  onStatus: (s: string | null) => void;
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
}) {
  // TK companions are managed with their link column and never rendered.
  const cols = data.columns.filter((c) => !c.tk && (showIds || !c.id));
  const [edits, setEdits] = useState<Record<string, Row>>({});      // record key → changed fields
  const [ghost, setGhost] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const plQ = usePicklistCatalog();
  const [popover, setPopover] = useState<{ key: string | null; col: string } | null>(null);

  useEffect(() => { setEdits({}); setGhost({}); setPopover(null); }, [data.table, parentIdrec]);

  /** The well header is one record per well — no ghost row, no duplicating. */
  const singleRecord = data.table.toLowerCase() === "wvwellheader";

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

  /** Candidate records for every link column's target tables, with captions. */
  const linkTables = useMemo(() => {
    const set = new Set<string>();
    for (const c of cols) for (const t of c.link?.targets ?? []) set.add(t);
    return [...set].sort();
  }, [cols]);
  const candsQ = useQuery({
    queryKey: ["wvdb", db, "linkcands", data.table, idwell, linkTables.join(",")],
    enabled: linkTables.length > 0,
    queryFn: async () => {
      const out: Record<string, { idrec: string; caption: string }[]> = {};
      for (const t of linkTables) {
        try { out[t] = (await wvDbApi.linkCandidates(db, t, idwell)).candidates; }
        catch { out[t] = []; }
      }
      return out;
    },
  });
  const captionOfLink = (idrec: string | null): string | null => {
    if (!idrec || !candsQ.data) return null;
    for (const [t, list] of Object.entries(candsQ.data)) {
      const hit = list.find((c) => c.idrec === idrec);
      if (hit) return `${hit.caption} · ${t.replace(/^wv/, "")}`;
    }
    return null;
  };

  /** The record key: IDRec normally; wvWellHeader rows are keyed by idwell.
   *  A row with NEITHER cannot be addressed for update — its cells are locked. */
  const keyOf = (row: Row): string | null => {
    const v = row.IDRec ?? row.idwell;
    return v == null ? null : String(v);
  };

  const dirtyCount = Object.keys(edits).filter((k) => Object.keys(edits[k]).length > 0).length
    + (Object.values(ghost).some((v) => v !== null && v !== "") ? 1 : 0);

  async function saveAll(): Promise<boolean> {
    setBusy(true);
    onStatus(null);
    try {
      let saved = 0;
      let unmatched = 0;
      for (const [key, values] of Object.entries(edits)) {
        if (Object.keys(values).length === 0) continue;
        // The server says how many rows the UPDATE matched — 0 means the key
        // did not address a record, and pretending that saved would lose data.
        const res = await wvDbApi.update(db, data.table, key, values);
        if (res.changed > 0) saved++; else unmatched++;
      }
      if (!singleRecord && Object.values(ghost).some((v) => v !== null && v !== "")) {
        await wvDbApi.insert(db, data.table, {
          idwell, ...(parentIdrec ? { parent: parentIdrec } : {}), values: ghost,
        });
        saved++;
      }
      setEdits({});
      setGhost({});
      if (saved || unmatched) onSaved();
      onStatus(unmatched
        ? `Saved ${saved}, but ${unmatched} record${unmatched === 1 ? "" : "s"} could not be matched — nothing was written for ${unmatched === 1 ? "it" : "them"}.`
        : saved ? `Saved ${saved} record${saved === 1 ? "" : "s"}.` : null);
      return unmatched === 0;
    } catch (e) {
      onStatus(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // §3.9: leaving the folder (or the window) saves automatically.
  useEffect(() => {
    registerFlush(() => (dirtyCount > 0 ? saveAll() : Promise.resolve(true)));
    return () => registerFlush(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, ghost, dirtyCount, data.table, parentIdrec]);

  async function duplicate(row: Row) {
    if (singleRecord) {
      onStatus("A well has exactly one header record — create a new well from the Well Explorer instead.");
      return;
    }
    const idrec = String(row.IDRec ?? "");
    if (!idrec) return;
    setBusy(true);
    try {
      const res = await wvDbApi.copyRecord(db, data.table, idrec);
      onSaved();
      onStatus(`Record duplicated — ${res.copied} record${res.copied === 1 ? "" : "s"} copied (subfolders included).`);
    } catch (e) {
      onStatus(`Duplicate failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function pasteRecord() {
    if (!clipboard) return;
    setBusy(true);
    try {
      const res = await wvDbApi.copyRecord(db, clipboard.table, clipboard.idrec, {
        idwell, ...(parentIdrec ? { parent: parentIdrec } : {}),
      });
      onSaved();
      onStatus(`Pasted "${clipboard.caption}" — ${res.copied} record${res.copied === 1 ? "" : "s"} copied (subfolders included).`);
    } catch (e) {
      onStatus(`Paste failed: ${e instanceof Error ? e.message : String(e)}`);
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

  /** §3.9 Copy Data to Clipboard: the folder's records, headings included. */
  function copyDataToClipboard() {
    const head = cols.map((c) => c.label).join("\t");
    const body = data.rows.map((r) =>
      cols.map((c) => String(r[c.column] ?? "")).join("\t")).join("\n");
    void navigator.clipboard.writeText(`${head}\n${body}`).then(
      () => onStatus(`Copied ${data.rows.length} record${data.rows.length === 1 ? "" : "s"} to the clipboard, headings included.`),
      () => onStatus("The browser refused clipboard access."),
    );
  }

  const editable = (c: WvRecordColumn) => !c.id && !c.system;
  const valueOf = (row: Row, key: string, col: string): string => {
    const e = edits[key];
    if (e && col in e) return String(e[col] ?? "");
    return row[col] == null ? "" : String(row[col]);
  };
  const setValue = (key: string, col: string, v: string | null) =>
    setEdits((es) => ({ ...es, [key]: { ...es[key], [col]: v } }));
  const setGhostValue = (col: string, v: string | null) =>
    setGhost((g) => ({ ...g, [col]: v }));

  /** Set a LINK column: the GUID plus its TK companion (target table name). */
  const setLink = (key: string | null, c: WvRecordColumn, idrec: string | null, targetTable: string | null) => {
    const write = (col: string, v: string | null) =>
      key === null ? setGhostValue(col, v) : setValue(key, col, v);
    write(c.column, idrec);
    if (c.link?.tkColumn) write(c.link.tkColumn, idrec ? (targetTable ?? "").toLowerCase() : null);
  };

  const focusHelp = (c: WvRecordColumn) =>
    onStatus(`${c.label} — ${data.table}.${c.column}${c.link ? " · linked record" : ""}${lookupFor.has(c.column.toLowerCase()) ? " · library lookup available" : ""}`);

  const cellInput = (row: Row | null, key: string | null, c: WvRecordColumn) => {
    const isGhost = row === null;
    const val = isGhost ? String(ghost[c.column] ?? "") : valueOf(row, key!, c.column);

    if (!editable(c)) {
      return isGhost
        ? <span className="block px-1.5 py-0.5 text-gray-300 text-[10px]">auto</span>
        : <span className="block px-1.5 py-0.5 text-gray-400 font-mono text-[10px] truncate" title={val}>{val}</span>;
    }

    // Record-link column: candidates popover, caption instead of GUID.
    if (c.link) {
      const caption = val ? (captionOfLink(val) ?? `${val.slice(0, 8)}…`) : "";
      const open = popover?.key === (key ?? "__ghost__") && popover.col === c.column;
      return (
        <div className="relative">
          <button type="button" data-testid="wv-link-cell"
            onFocus={() => focusHelp(c)}
            onClick={() => setPopover(open ? null : { key: key ?? "__ghost__", col: c.column })}
            className="w-full min-w-[8rem] text-left px-1.5 py-0.5 text-[11px] rounded border border-transparent hover:border-gray-300 text-gray-900 flex items-center gap-1">
            <span className="truncate flex-1">{caption || <span className="text-gray-300">—</span>}</span>
            <span className="text-gray-400">…</span>
          </button>
          {open && (
            <LinkPopover
              targets={c.link.targets}
              cands={candsQ.data ?? {}}
              onPick={(idrec, t) => { setLink(key, c, idrec, t); setPopover(null); }}
              onClose={() => setPopover(null)}
            />
          )}
        </div>
      );
    }

    // Calendar fields (§3.9): native picker, 15-minute steps.
    if (isDtTmCol(c.column)) {
      return (
        <input
          type="datetime-local"
          step={900}
          value={isoToLocalInput(val)}
          onFocus={() => focusHelp(c)}
          onChange={(e) => {
            const iso = localInputToIso(e.target.value);
            if (isGhost) setGhostValue(c.column, iso); else setValue(key!, c.column, iso);
          }}
          className={`w-full min-w-[10.5rem] px-1 py-0.5 text-[11px] bg-transparent border border-transparent rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
      );
    }

    const lookup = lookupFor.get(c.column.toLowerCase());
    const listId = lookup ? `wv-lu-${data.table}-${c.column}` : undefined;
    const open = lookup && popover?.key === (key ?? "__ghost__") && popover.col === c.column;
    return (
      <div className={lookup ? "relative flex items-center" : undefined}>
        <input
          value={val}
          list={listId}
          placeholder={isGhost ? "new…" : undefined}
          onFocus={() => focusHelp(c)}
          onChange={(e) => (isGhost
            ? setGhostValue(c.column, e.target.value)
            : setValue(key!, c.column, e.target.value))}
          className={`w-full min-w-[7rem] px-1.5 py-0.5 text-[11px] bg-transparent border border-transparent rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
        {lookup && (
          <>
            {/* Table 3-6 item J: the ellipsis button marks a lookup list. */}
            <button type="button" tabIndex={-1} title="Library lookup list"
              onClick={() => setPopover(open ? null : { key: key ?? "__ghost__", col: c.column })}
              className="shrink-0 px-1 text-[10px] text-gray-400 hover:text-blue-600">…</button>
            <datalist id={listId}>
              {lookup.map((v) => <option key={v} value={v} />)}
            </datalist>
            {open && (
              <ValuesPopover
                values={lookup}
                onPick={(v) => {
                  if (isGhost) setGhostValue(c.column, v); else setValue(key!, c.column, v);
                  setPopover(null);
                }}
                onClose={() => setPopover(null)}
              />
            )}
          </>
        )}
      </div>
    );
  };

  const rowActions = (row: Row) => {
    const idrec = String(row.IDRec ?? "");
    return (
      <div className="flex gap-1 px-1">
        <button type="button" title="Copy Record (with subfolders) — paste into this folder on any well" disabled={busy || !idrec}
          onClick={() => {
            onClipboard({ db, table: data.table, idrec, caption: recordCaption(row), label: data.label });
            onStatus(`Copied "${recordCaption(row)}" — open the same folder anywhere and Paste Record.`);
          }}
          className="text-gray-400 hover:text-blue-600 text-[11px]">⎘</button>
        <button type="button" title="Duplicate Record (subfolders included)" disabled={busy}
          onClick={() => void duplicate(row)}
          className="text-gray-400 hover:text-blue-600 text-[11px]">⧉</button>
        <button type="button" title="Delete Record (subfolder records go with it)" disabled={busy}
          onClick={() => void remove(row)}
          className="text-gray-400 hover:text-red-600 text-[11px]">✕</button>
      </div>
    );
  };

  const canPaste = clipboard && clipboard.db === db
    && clipboard.table.toLowerCase() === data.table.toLowerCase() && !singleRecord;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-xs font-semibold text-gray-800">{data.label}</span>
        <span className="text-[10px] text-gray-400 font-mono">{data.table}</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{data.rows.length} record{data.rows.length === 1 ? "" : "s"}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={copyDataToClipboard} disabled={data.rows.length === 0}
            title="Copy Data to Clipboard — all records with headings, for Excel"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Copy Data
          </button>
          {canPaste && (
            <button type="button" onClick={() => void pasteRecord()} disabled={busy}
              title={`Paste "${clipboard!.caption}" into this folder (subfolders included)`}
              className="h-7 px-2 text-[11px] rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40">
              Paste Record
            </button>
          )}
          <button type="button" onClick={() => { setEdits({}); setGhost({}); onStatus("Pending changes undone — saved records are untouched."); }}
            disabled={busy || dirtyCount === 0}
            title="Undo All — cancel the changes made in this folder since the last save"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Undo All
          </button>
          <button type="button" onClick={() => void saveAll()} disabled={busy || dirtyCount === 0}
            data-testid="wv-edit-save"
            className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40">
            {busy ? "Saving…" : dirtyCount ? `Save (${dirtyCount})` : "Saved"}
          </button>
        </div>
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
                {!singleRecord && (
                  <td className="px-2 py-1 border-b border-l border-gray-200 text-center italic text-gray-400">new</td>
                )}
              </tr>
              {cols.map((c) => (
                <tr key={c.column}>
                  <td className="sticky left-0 bg-gray-100 px-2 py-0.5 font-medium text-gray-600 whitespace-nowrap border-b border-gray-100"
                    title={`${data.table}.${c.column}`}>
                    {c.label}
                  </td>
                  {data.rows.map((r, i) => {
                    const k = keyOf(r);
                    return (
                      <td key={i} className="border-b border-l border-gray-100 align-top">
                        {k ? cellInput(r, k, c)
                          : <span className="block px-1.5 py-0.5 text-gray-400 text-[10px]">{String(r[c.column] ?? "")}</span>}
                      </td>
                    );
                  })}
                  {!singleRecord && (
                    <td className="border-b border-l border-gray-100 align-top bg-blue-50/40">
                      {cellInput(null, null, c)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* horizontal edit mode: records as rows */
          <table className="text-[11px] border-collapse min-w-full">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="px-1 py-1 border-b border-gray-200 w-16" />
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
                const k = keyOf(r);
                const dirty = k !== null && !!edits[k] && Object.keys(edits[k]).length > 0;
                return (
                  <tr key={k ?? i} className={`${i % 2 ? "bg-gray-50" : ""} ${dirty ? "outline outline-1 outline-blue-300" : ""}`}>
                    <td className="align-middle">{rowActions(r)}</td>
                    {cols.map((c) => (
                      <td key={c.column} className="border-b border-gray-100 align-top">
                        {k ? cellInput(r, k, c)
                          : <span className="block px-1.5 py-0.5 text-gray-400 text-[10px]">{String(r[c.column] ?? "")}</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* the ghost record (§3.9 Add a New Record) */}
              {!singleRecord && (
                <tr className="bg-blue-50/40">
                  <td className="px-1 text-[10px] text-gray-400 italic align-middle">new</td>
                  {cols.map((c) => (
                    <td key={c.column} className="border-b border-gray-100 align-top">
                      {cellInput(null, null, c)}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** The library lookup window: filter row on top, sortable values, click to pick. */
function ValuesPopover({ values, onPick, onClose }: {
  values: string[]; onPick: (v: string) => void; onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [desc, setDesc] = useState(false);
  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    const list = values.filter((v) => !f || v.toLowerCase().includes(f));
    return desc ? [...list].sort((a, b) => b.localeCompare(a)) : list;
  }, [values, filter, desc]);
  return (
    <div className="absolute left-0 top-full z-30 mt-0.5 w-64 bg-white border border-gray-300 rounded-md shadow-lg">
      <div className="flex items-center gap-1 p-1 border-b border-gray-100">
        <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          placeholder="filter…" className="flex-1 h-6 px-1.5 text-[11px] border border-gray-200 rounded" />
        <button type="button" onClick={() => setDesc((d) => !d)}
          title="Sort ascending/descending" className="px-1 text-[11px] text-gray-500 hover:text-gray-800">
          {desc ? "Z→A" : "A→Z"}
        </button>
        <button type="button" onClick={onClose} className="px-1 text-[11px] text-gray-400 hover:text-gray-700">✕</button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {shown.map((v) => (
          <button key={v} type="button" onClick={() => onPick(v)}
            className="block w-full text-left px-2 py-0.5 text-[11px] hover:bg-blue-50 truncate">{v}</button>
        ))}
        {shown.length === 0 && <div className="px-2 py-1.5 text-[11px] text-gray-400">No match.</div>}
      </div>
    </div>
  );
}

/** The associated-data lookup: real records of the target table(s), by caption. */
function LinkPopover({ targets, cands, onPick, onClose }: {
  targets: string[];
  cands: Record<string, { idrec: string; caption: string }[]>;
  onPick: (idrec: string | null, table: string | null) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  return (
    <div className="absolute left-0 top-full z-30 mt-0.5 w-72 bg-white border border-gray-300 rounded-md shadow-lg">
      <div className="flex items-center gap-1 p-1 border-b border-gray-100">
        <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          placeholder="filter…" className="flex-1 h-6 px-1.5 text-[11px] border border-gray-200 rounded" />
        <button type="button" onClick={onClose} className="px-1 text-[11px] text-gray-400 hover:text-gray-700">✕</button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        <button type="button" onClick={() => onPick(null, null)}
          className="block w-full text-left px-2 py-0.5 text-[11px] text-gray-400 hover:bg-gray-50">(none)</button>
        {targets.map((t) => {
          const list = (cands[t] ?? []).filter((c) => !filter || c.caption.toLowerCase().includes(filter.toLowerCase()));
          if (!list.length) return null;
          return (
            <div key={t}>
              {targets.length > 1 && (
                <div className="px-2 pt-1 text-[9px] uppercase tracking-wide text-gray-400">{t.replace(/^wv/, "")}</div>
              )}
              {list.map((c) => (
                <button key={c.idrec} type="button" onClick={() => onPick(c.idrec, t)}
                  className="block w-full text-left px-2 py-0.5 text-[11px] hover:bg-blue-50 truncate">
                  {c.caption}
                </button>
              ))}
            </div>
          );
        })}
        {targets.every((t) => !(cands[t] ?? []).length) && (
          <div className="px-2 py-1.5 text-[11px] text-gray-400">
            No candidate records on this well yet — enter the linked folder first.
          </div>
        )}
      </div>
    </div>
  );
}
