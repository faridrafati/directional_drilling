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
import { useUnitSet, type UnitSet } from "../../entry/unitSet.js";
import { useDatumShift } from "../../entry/datum.js";
import { toDisplay, fromDisplay, displayUnitLabel, formatUnitValue } from "@dd/shared";
import type { DatumShift } from "@dd/shared";
import { Attachments } from "./Attachments.js";
import { InventoryTransfer } from "./InventoryTransfer.js";

type Row = Record<string, string | number | null>;

/** The app-level record clipboard (Copy Record / Paste Record, §3.9). */
export interface WvClipboard { db: string; table: string; idrec: string; caption: string; label: string }

interface Props {
  db: string;
  idwell: string;
  wellName: string;
  /** Open at this table if given (double-click from a report block). */
  initialTable?: string | null;
  /**
   * Open ON this record, with every parent folder positioned to reach it, and
   * the named column focused — the manual's "double-click a field on the
   * report … the cursor will appear in the same field in the table".
   */
  initialRecord?: string | null;
  initialColumn?: string | null;
  clipboard: WvClipboard | null;
  onClipboard: (c: WvClipboard | null) => void;
  onClose: () => void;
}

export function EditData({
  db, idwell, wellName, initialTable, initialRecord, initialColumn, clipboard, onClipboard, onClose,
}: Props) {
  const qc = useQueryClient();
  const [table, setTable] = useState<string | null>(initialTable ?? "wvWellHeader");
  const [vertical, setVertical] = useState(false);
  const [showSystem, setShowSystem] = useState(false);
  /** Selected parent RECORD per parent table — the §3.9 navigation state.
   *  Keyed by record id, not row index, so it survives a re-sort or a refresh
   *  and can be set from a record's ancestor path. */
  const [parentPick, setParentPick] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  /** §3.9 attachments: the files hanging off this well or this folder. */
  const [showAttach, setShowAttach] = useState(false);
  /** §5.1 Add-ins > Utilities > Mud Inventory Transfer. */
  const [showInventory, setShowInventory] = useState(false);

  /**
   * Arriving from a report field: position every parent folder on the record's
   * own ancestors before showing the grid, so the record is actually on screen.
   */
  const pathQ = useQuery({
    queryKey: ["wvdb", db, "record-path", initialTable, initialRecord],
    queryFn: () => wvDbApi.recordPath(db, initialTable!, initialRecord!),
    enabled: !!initialTable && !!initialRecord,
    staleTime: Infinity,
  });
  useEffect(() => {
    const path = pathQ.data?.path;
    if (!path?.length) return;
    const picks: Record<string, string> = {};
    for (const hop of path.slice(0, -1)) picks[hop.table] = hop.idrec;
    setParentPick((p) => ({ ...p, ...picks }));
  }, [pathQ.data]);
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
          <button type="button" onClick={() => setShowInventory(true)}
            data-testid="wv-edit-inventory"
            title="Add-ins > Utilities > Mud Inventory Transfer — carry a previous well's closing mud and supply balances onto a job here"
            className="h-7 px-2 text-[11px] rounded border border-gray-600 text-gray-200 hover:bg-gray-700">
            Utilities
          </button>
          <button type="button" onClick={() => setShowAttach((v) => !v)}
            data-testid="wv-edit-attachments"
            title="Files stored in the database against this well"
            className={`h-7 px-2 text-[11px] rounded border ${showAttach
              ? "bg-blue-600 border-blue-600 text-white"
              : "border-gray-600 text-gray-200 hover:bg-gray-700"}`}>
            Attachments
          </button>
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

        {showInventory && (
          <InventoryTransfer db={db} toWell={idwell} toWellName={wellName}
            onClose={() => setShowInventory(false)} />
        )}
        {showAttach && (
          /* Files stored in the database against this well. Scoped to the
             folder in view when one is open, so uploading from the Casing
             folder attaches to casing rather than to the well at large. */
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 max-h-72 overflow-y-auto shrink-0">
            <Attachments db={db} idwell={idwell} table={table ?? undefined} />
          </div>
        )}

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
                focusRecord={initialRecord ?? null}
                focusColumn={initialColumn ?? null}
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
function FolderRecords({ db, idwell, table, chain, vertical, showSystem, parentPick, setParentPick, clipboard, onClipboard, onStatus, onDirty, registerFlush, focusRecord, focusColumn }: {
  db: string;
  idwell: string;
  table: string;
  chain: { table: string; label: string }[];
  vertical: boolean;
  showSystem: boolean;
  parentPick: Record<string, string>;
  setParentPick: (f: (p: Record<string, string>) => Record<string, string>) => void;
  clipboard: WvClipboard | null;
  onClipboard: (c: WvClipboard | null) => void;
  onStatus: (s: string | null) => void;
  onDirty: () => void;
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
  /** Record/column to land on, arriving from a report field. */
  focusRecord: string | null;
  focusColumn: string | null;
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
    // The pick is a record id; an unknown id (or none yet) falls back to the
    // first record, which is what the desktop shows on arrival.
    const wanted = parentPick[anc.table];
    const found = wanted ? rows.findIndex((r) => String(r.IDRec ?? "") === wanted) : -1;
    const pick = found >= 0 ? found : 0;
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
                onClick={() => setParentPick((p) => ({ ...p, [a.table]: String(a.rows[a.pick - 1]?.IDRec ?? "") }))}
                className="px-1 rounded border border-gray-300 disabled:opacity-30">‹</button>
              <b className="max-w-[16rem] truncate">{recordCaption(a.rows[a.pick])}</b>
              <span className="text-gray-400 tabular-nums">({a.pick + 1}/{a.rows.length})</span>
              <button type="button" disabled={a.pick >= a.rows.length - 1}
                onClick={() => setParentPick((p) => ({ ...p, [a.table]: String(a.rows[a.pick + 1]?.IDRec ?? "") }))}
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
          focusRecord={focusRecord} focusColumn={focusColumn}
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

/** Display form for a read-only cell: dates read as dates, floats stay sane. */
function fmtCell(v: string): string {
  if (!v) return "";
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
  if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
  const n = Number(v);
  if (v.trim() !== "" && Number.isFinite(n) && !Number.isInteger(n)) return String(Number(n.toFixed(4)));
  return v;
}
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
function RecordsGrid({ db, idwell, data, vertical, showIds, parentIdrec, clipboard, onClipboard, onSaved, onStatus, registerFlush, focusRecord, focusColumn }: {
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
  focusRecord: string | null;
  focusColumn: string | null;
}) {
  // TK companions are managed with their link column and never rendered.
  // Fields the data model marks hidden appear only under "Show All Fields",
  // which is what the desktop's toggle does.
  const visible = data.columns.filter((c) =>
    !c.tk && (showIds || !c.id) && (showIds || !c.hiddenByDefault));
  /**
   * Order the columns by WellView's own form SECTIONS — "Well Identifiers",
   * "Well License", "Location", "Elevations" — which is the order the guide's
   * exercises walk through. Ungrouped columns keep their schema order at the end.
   */
  const cols = useMemo(() => {
    const order = data.fieldGroups ?? [];
    if (!order.length) return visible;
    const rank = (c: WvRecordColumn) => {
      const i = c.group ? order.indexOf(c.group) : -1;
      return i < 0 ? order.length : i;
    };
    return [...visible].sort((a, b) => rank(a) - rank(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.columns, data.fieldGroups, showIds]);

  /** Contiguous runs of one section, for the grouped header row. */
  const sections = useMemo(() => {
    const out: { group: string | null; span: number }[] = [];
    for (const c of cols) {
      const g = c.group ?? null;
      const last = out[out.length - 1];
      if (last && last.group === g) last.span++;
      else out.push({ group: g, span: 1 });
    }
    return out;
  }, [cols]);
  const [edits, setEdits] = useState<Record<string, Row>>({});      // record key → changed fields
  const [ghost, setGhost] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const plQ = usePicklistCatalog();
  const [unitSet] = useUnitSet();
  const { shift: datumShift } = useDatumShift(db, idwell);
  /** §3.9 Paste Data from Clipboard — the mapping dialog is open. */
  const [pasting, setPasting] = useState(false);
  const [popover, setPopover] = useState<{ key: string | null; col: string } | null>(null);
  /** What the model says about one column's units, for the conversion helpers. */
  const unitOf = (c: WvRecordColumn) =>
    ({ unit: c.unit, units: c.units, applyDatum: c.applyDatum, datumMode: c.datumMode });

  /**
   * §5 "Set up Day Two": a new record inherits the previous one's carry-forward
   * fields, and a few of them STEP — a daily report's end date moves on a day,
   * days-since-incident goes up by one, a run number increments. The model says
   * which fields and by how much, so the ghost row arrives pre-filled exactly as
   * the desktop's new record does.
   *
   * Only the ghost is seeded. Existing records are never rewritten, and typing
   * over a carried value is just an edit like any other.
   */
  const carrySeed = useMemo(() => {
    const prev = data.rows[data.rows.length - 1];
    if (!prev) return {} as Row;
    const seed: Row = {};
    for (const c of data.columns) {
      if (!c.carryForward || c.tk || c.id || c.system) continue;
      // "Continue where the last record stopped": the model names the SOURCE
      // field when it is not this one — a daily report's start date comes from
      // the previous report's END date, not from its start.
      let source = c.column;
      if (c.carryForwardFrom) {
        const [srcTable, srcField] = c.carryForwardFrom.split(".");
        if (srcTable?.toLowerCase() === data.table.toLowerCase() && srcField) {
          const actual = data.columns.find(
            (x) => x.column.toLowerCase() === srcField.toLowerCase());
          if (actual) source = actual.column;
        }
      }
      const v = prev[source];
      if (v == null || v === "") continue;
      const step = c.carryForwardIncrement;
      if (!step) { seed[c.column] = v; continue; }
      if (c.type === "datetime") {
        // The increment is in DAYS for a date field.
        const m = String(v).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})Z$/);
        if (!m) { seed[c.column] = v; continue; }
        const d = new Date(`${m[1]}T${m[2]}Z`);
        d.setTime(d.getTime() + step * 86_400_000);
        seed[c.column] = `${d.toISOString().slice(0, 19)}Z`;
      } else {
        const n = Number(v);
        seed[c.column] = Number.isFinite(n) ? String(n + step) : v;
      }
    }
    /*
     * A CARRIED LINK NEEDS ITS TK COMPANION, or the row is written with a GUID
     * and no idea what it points at.
     *
     * WellView stores a record link as a pair: the GUID, and a `…TK` column
     * naming the target TABLE. `setLink` keeps them in step when a user picks a
     * link by hand; carry-forward did not, because the loop above skips every
     * `c.tk` column — and the model declares no TK field at all, so none could
     * ever have carried itself.
     *
     * The invariant is real and the database proves it: of 6,275 link values in
     * the sample, 6,268 carry their TK. The seven that do not are all one
     * polymorphic column. A row this app carried forward would have joined that
     * handful — resolvable here only because `captionOfLink` searches every
     * candidate table, and not resolvable at all in the desktop, which uses the
     * TK to know where to look.
     *
     * Copied from the previous row rather than derived: that row's TK is what
     * the GUID beside it actually points at, and inferring a table name from a
     * column name would be a guess where an answer is sitting right there.
     */
    for (const c of data.columns) {
      const tkCol = c.link?.tkColumn;
      if (!tkCol || seed[c.column] == null) continue;
      const tk = prev[tkCol];
      if (tk != null && tk !== "") seed[tkCol] = tk;
    }
    return seed;
  }, [data.rows, data.columns]);
  /*
   * Counted for the user, so it counts only what the user can see. A TK rides
   * along with its link and is never rendered; including it would report two
   * carried fields where one row of the form changed.
   */
  const carriedCount = Object.keys(carrySeed)
    .filter((k) => !data.columns.find((c) => c.column === k)?.tk).length;

  /**
   * The seed as the user will SEE it.
   *
   * `carrySeed` is copied from stored values, so it is in base units and its
   * increments are too. The ghost row, like any pending edit, holds what the
   * user sees and types — display units — and `toBaseUnits` converts it back on
   * save. Seeding it with base values would send a carried depth through that
   * conversion a second time and store a fraction of the real one.
   */
  const carrySeedShown = useMemo(() => {
    const out: Row = {};
    for (const [col, v] of Object.entries(carrySeed)) {
      const c = data.columns.find((x) => x.column === col);
      const n = c?.unit ? Number(v) : NaN;
      const d = Number.isFinite(n) ? toDisplay(n, unitOf(c!), unitSet, datumShift) : null;
      out[col] = d ? formatUnitValue(d.value, d) : v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrySeed, data.columns, unitSet]);

  useEffect(() => {
    setEdits({});
    setGhost(carrySeedShown);
    setPopover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.table, parentIdrec]);

  /**
   * The unit set changed with edits still pending.
   *
   * What the user typed was a number of feet; leaving the digits alone would
   * silently turn it into that many metres on save. Re-express every pending
   * value in the new set — the same move the saved rows make when they
   * re-render, so the whole grid still reads in one unit.
   */
  const shownIn = useRef(unitSet);
  useEffect(() => {
    const from = shownIn.current;
    if (from === unitSet) return;
    shownIn.current = unitSet;
    const restate = (row: Row): Row => {
      const out: Row = { ...row };
      for (const c of data.columns) {
        if (!c.unit || !(c.column in out)) continue;
        const v = out[c.column];
        if (v == null || v === "") continue;
        const base = fromDisplay(String(v), unitOf(c), from, datumShift);
        if (base === null) continue;
        const d = toDisplay(base, unitOf(c), unitSet, datumShift);
        if (d) out[c.column] = formatUnitValue(d.value, d);
      }
      return out;
    };
    setEdits((es) => Object.fromEntries(
      Object.entries(es).map(([k, row]) => [k, restate(row)])));
    setGhost((g) => restate(g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitSet, data.columns]);

  /**
   * Arriving from a report field: put the cursor in the same field of the same
   * record, and bring it into view. The manual is explicit — "double-click a
   * field on the report to open the Edit Data window. The cursor will appear in
   * the same field in the table."
   */
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusRecord) return;
    // Column names arrive from the .afr lowercased, while the grid uses the
    // database's mixed case — match on the lowercase form of both.
    const cell = focusColumn
      ? gridRef.current?.querySelector<HTMLElement>(
        `[data-cell="${CSS.escape(`${focusRecord}|${focusColumn.toLowerCase()}`)}"]`)
      : null;
    const row = gridRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(focusRecord)}"]`);
    const el = cell ?? row;
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center" });
    // Only a CELL gets the cursor; landing on a row must not focus its
    // Copy/Delete buttons.
    if (cell) (cell.querySelector("input,button") as HTMLElement | null)?.focus();
  }, [focusRecord, focusColumn, data.table, data.rows.length]);

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

  /** A ghost holding only carried values is not an edit — the user has not
   *  typed anything yet, and saving it would add a record they never asked for. */
  const ghostTouched = Object.entries(ghost).some(([k, v]) =>
    v !== null && v !== "" && String(v) !== String(carrySeedShown[k] ?? ""));
  const dirtyCount = Object.keys(edits).filter((k) => Object.keys(edits[k]).length > 0).length
    + (ghostTouched ? 1 : 0);

  /** Rewrite a pending record's unit-bearing fields from display back to base. */
  function toBaseUnits(values: Row): void {
    for (const c of data.columns) {
      if (!c.unit || !(c.column in values)) continue;
      const v = values[c.column];
      if (v == null || v === "") continue;
      const base = fromDisplay(String(v), unitOf(c), unitSet, datumShift);
      if (base !== null) values[c.column] = base;
    }
  }

  async function saveAll(): Promise<boolean> {
    setBusy(true);
    onStatus(null);
    try {
      let saved = 0;
      let unmatched = 0;
      for (const [key, values] of Object.entries(edits)) {
        if (Object.keys(values).length === 0) continue;
        toBaseUnits(values);
        // The server says how many rows the UPDATE matched — 0 means the key
        // did not address a record, and pretending that saved would lose data.
        const res = await wvDbApi.update(db, data.table, key, values);
        if (res.changed > 0) saved++; else unmatched++;
      }
      if (!singleRecord && ghostTouched) {
        const newValues = { ...ghost };
        toBaseUnits(newValues);
        await wvDbApi.insert(db, data.table, {
          idwell, ...(parentIdrec ? { parent: parentIdrec } : {}), values: newValues,
        });
        saved++;
      }
      // §3.10: the Data Auditor "will issue a warning" when a required field is
      // blank. Saving still happens — the desktop warns, it does not refuse.
      const blanks = new Set<string>();
      for (const c of cols) {
        if (!c.required) continue;
        for (const values of Object.values(edits)) {
          if (c.column in values && String(values[c.column] ?? "").trim() === "") blanks.add(c.label);
        }
        if (Object.keys(ghost).length && String(ghost[c.column] ?? "").trim() === "") blanks.add(c.label);
      }
      setEdits({});
      setGhost(carrySeedShown);
      if (saved || unmatched) onSaved();
      if (blanks.size) {
        onStatus(`Saved ${saved}. Required field${blanks.size === 1 ? "" : "s"} still empty: ${[...blanks].join(", ")}.`);
        return unmatched === 0;
      }
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

  /**
   * Delete, with the two things the help asks for and this had neither of.
   *
   * "A warning message lists the subfolders that are affected" — so the cost is
   * fetched and NAMED before the confirm, not counted afterwards. A casing
   * string carries 222 tally rows; "records in its subfolders are deleted with
   * it" does not convey that, and there is no undo to fall back on.
   *
   * "You cannot delete a record that has fields associated to it … You must
   * first remove the associations before you delete the record" — so a record
   * something still points at is refused, and the refusal says what is holding
   * on. The server refuses too; this is so the user finds out before the
   * confirm rather than after it.
   */
  async function remove(row: Row) {
    const idrec = String(row.IDRec ?? "");
    if (!idrec) return;
    setBusy(true);
    try {
      const pre = await wvDbApi.deletePreflight(db, data.table, idrec);

      if (!pre.canDelete) {
        const held = pre.referencedBy
          .map((r) => `${r.count} ${r.label} (${r.column})`)
          .join(", ");
        onStatus(`Not deleted — this record is still linked from ${held}. `
          + "Clear those links first, then delete it.");
        return;
      }

      const lines = pre.children.length
        ? pre.children.map((c) => `  • ${c.count} ${c.label}`).join("\n")
        : "  • nothing in its subfolders";
      const ok = window.confirm(
        `Delete this record and everything under it?\n\n${lines}\n\n`
        + `${pre.records} record${pre.records === 1 ? "" : "s"} in total. This cannot be undone.`);
      if (!ok) return;

      const res = await wvDbApi.remove(db, data.table, idrec);
      onSaved();
      onStatus(`Deleted ${res.removed} record${res.removed === 1 ? "" : "s"} (including subfolders).`);
    } catch (e) {
      onStatus(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * §3.9's ordering commands, for the folders the model marks `sequenced` —
   * the string components and tallies. The whole intended order is sent, so
   * every command is one call and the stored sequence cannot drift from what
   * is on screen. WellView draws string components on the schematic in this
   * order, which is why Invert exists at all.
   */
  const ordered = !!data.sequenced && data.rows.every((r) => r.IDRec != null);
  async function reorder(order: string[], what: string) {
    setBusy(true);
    try {
      const res = await wvDbApi.reorder(db, data.table, {
        idwell, ...(parentIdrec ? { parent: parentIdrec } : {}), order,
      });
      onSaved();
      onStatus(`${what} — ${res.reordered} records renumbered.`);
    } catch (e) {
      onStatus(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }
  const ids = () => data.rows.map((r) => String(r.IDRec));
  const moveRow = (index: number, by: -1 | 1) => {
    const next = ids();
    const to = index + by;
    if (to < 0 || to >= next.length) return;
    [next[index], next[to]] = [next[to], next[index]];
    void reorder(next, by < 0 ? "Moved up" : "Moved down");
  };

  /** §3.9 Copy Data to Clipboard: the folder's records, headings included. */
  /**
   * Copy Data to Clipboard (§3.9) — what is ON SCREEN, not what is in the file.
   *
   * It used to read `r[c.column]` straight out of the row, so the grid showed a
   * casing depth in feet and the clipboard pasted the stored metres beside a
   * heading with no unit at all. The screen and the clipboard disagreeing is
   * worse than either being wrong on its own: the number looks checked.
   * `valueOf` is the same function the cells render through, so a pending edit
   * copies as the user typed it too.
   */
  function copyDataToClipboard() {
    const head = cols.map((c) => {
      const u = c.unit ? displayUnitLabel(c, unitSet, datumShift) : "";
      return u ? `${c.label} (${u})` : c.label;
    }).join("\t");
    const body = data.rows.map((r) => {
      const k = keyOf(r);
      return cols.map((c) => {
        const v = k ? valueOf(r, k, c.column) : String(r[c.column] ?? "");
        // A record link shows its caption on screen; a 32-hex GUID in the
        // spreadsheet is not the same information, it is no information.
        return c.link && v ? captionOfLink(v) ?? v : v;
      }).join("\t");
    }).join("\n");
    void navigator.clipboard.writeText(`${head}\n${body}`).then(
      () => onStatus(`Copied ${data.rows.length} record${data.rows.length === 1 ? "" : "s"} to the clipboard, headings included.`),
      () => onStatus("The browser refused clipboard access."),
    );
  }

  /** Calculated fields are WellView's print-time computations — the desktop
   *  paints them green and refuses edits, and so does the server. */
  const editable = (c: WvRecordColumn) => !c.id && !c.system && !c.calculated;
  /**
   * §4.3's colour convention, in full:
   *   yellow = required, cyan = required GLOBAL METRIC, green = calculated.
   * The cue shows while the field is still empty; a global metric keeps its
   * cyan marking always, because which fields they are is the point.
   */
  const missingRequired = (c: WvRecordColumn, value: string) =>
    !!(c.required || c.globalMetric) && value.trim() === "";
  const fieldTone = (c: WvRecordColumn, value: string): string => {
    if (c.globalMetric) {
      return missingRequired(c, value)
        ? "bg-cyan-100 border-cyan-400"
        : "bg-cyan-50 border-cyan-200";
    }
    if (missingRequired(c, value)) return "bg-amber-100 border-amber-300";
    return "bg-transparent border-transparent";
  };
  /**
   * Values are STORED in the model's base unit and shown in the user's set, so
   * every read converts out and every write converts back. A pending edit is
   * held in DISPLAY units — it is what the user typed — and only crosses back to
   * base when it is saved.
   */
  const valueOf = (row: Row, key: string, col: string): string => {
    const e = edits[key];
    if (e && col in e) return String(e[col] ?? "");
    const raw = row[col];
    if (raw == null) return "";
    const c = data.columns.find((x) => x.column === col);
    if (c?.unit) {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        const d = toDisplay(n, unitOf(c), unitSet, datumShift);
        if (d) return formatUnitValue(d.value, d);
      }
    }
    return String(raw);
  };
  const setValue = (key: string, col: string, v: string | null) =>
    setEdits((es) => ({ ...es, [key]: { ...es[key], [col]: v } }));
  const setGhostValue = (col: string, v: string | null) =>
    setGhost((g) => ({ ...g, [col]: v }));

  /**
   * The approved list of a field, as the two things it is: what to STORE and
   * what to SHOW.
   *
   * Most entries are one string doing both jobs. The `mdllistwithtables` ones
   * are not: WellView stores the detail TABLE name and shows a caption, so
   * wvTubComp.CompSubTyp holds `wvtubcomppacker` and reads "Packer". Rendering
   * the stored string raw put a table name in front of the user on 123 of the
   * sample's rows, and writing the caption back produced a row the desktop
   * cannot map to its detail table.
   *
   * Matched case-insensitively because the data is not consistent about it —
   * the same column holds "Tubing" and "tubing", "Other" and "other", and
   * `wvTubCompPacker` alongside `wvtubcomppacker`.
   */
  const listOf = (c: WvRecordColumn) => {
    const items = c.modelList ?? [];
    const labels = items.map((i) => (typeof i === "string" ? i : i.label));
    const toStore = new Map<string, string>();
    const toShow = new Map<string, string>();
    for (const i of items) {
      if (typeof i === "string") continue;
      toStore.set(i.label.toLowerCase(), i.value);
      toShow.set(i.value.toLowerCase(), i.label);
    }
    return { labels, toStore, toShow, mapped: toStore.size > 0 };
  };
  /** Stored → what the user sees. */
  const showListValue = (c: WvRecordColumn, v: string) =>
    listOf(c).toShow.get(v.toLowerCase()) ?? v;
  /** What the user typed or picked → what gets stored. */
  const storeListValue = (c: WvRecordColumn, v: string) =>
    listOf(c).toStore.get(v.toLowerCase()) ?? v;

  /** Set a LINK column: the GUID plus its TK companion (target table name). */
  const setLink = (key: string | null, c: WvRecordColumn, idrec: string | null, targetTable: string | null) => {
    const write = (col: string, v: string | null) =>
      key === null ? setGhostValue(col, v) : setValue(key, col, v);
    write(c.column, idrec);
    if (c.link?.tkColumn) write(c.link.tkColumn, idrec ? (targetTable ?? "").toLowerCase() : null);
  };

  /** §3.11: the help text for the current field, as WellView's model states it. */
  const focusHelp = (c: WvRecordColumn) => {
    const bits = [
      c.help,
      c.globalMetric ? "Required global metric." : c.required ? "Required." : null,
      c.modelList?.length
        ? `Approved values (${c.modelList.length}), from the data model.`
        : c.library ? `Library field (${c.library.table}) — the approved list is not readable here.` : null,
      c.calculated ? "Calculated by WellView — not editable." : null,
      c.unit ? `Base unit: ${c.unit}.` : null,
      c.link ? "Linked record." : null,
      !c.library && lookupFor.has(c.column.toLowerCase()) ? "Lookup list available." : null,
    ].filter(Boolean);
    onStatus(`${c.label} (${data.table}.${c.column})${bits.length ? " — " + bits.join(" ") : ""}`);
  };

  const cellInput = (row: Row | null, key: string | null, c: WvRecordColumn) => {
    const isGhost = row === null;
    const val = isGhost ? String(ghost[c.column] ?? "") : valueOf(row, key!, c.column);

    if (!editable(c)) {
      // The desktop's colour code: green means WellView computes this field.
      if (c.calculated) {
        return (
          <span
            className="block px-1.5 py-0.5 text-[11px] bg-green-50 text-green-900 truncate cursor-help"
            title={`Calculated by WellView${c.help ? ` — ${c.help}` : ""}`}
            onMouseEnter={() => focusHelp(c)}>
            {fmtCell(val) || <span className="text-green-600/40">—</span>}
          </span>
        );
      }
      return isGhost
        ? <span className="block px-1.5 py-0.5 text-gray-300 text-[10px]">auto</span>
        : <span className="block px-1.5 py-0.5 text-gray-400 font-mono text-[10px] truncate" title={val}>{val}</span>;
    }

    // Yes/No fields get the control the manual describes, not free text.
    if (c.type === "boolean") {
      const on = val === "1" || val.toLowerCase() === "true";
      return (
        <label className="flex items-center gap-1.5 px-1.5 py-0.5 text-[11px] cursor-pointer">
          <input type="checkbox" className="h-3.5 w-3.5" checked={on}
            onFocus={() => focusHelp(c)}
            onChange={(e) => {
              const next = e.target.checked ? "1" : "0";
              if (isGhost) setGhostValue(c.column, next); else setValue(key!, c.column, next);
            }} />
          <span className={on ? "text-gray-900" : "text-gray-400"}>{on ? "Yes" : "No"}</span>
        </label>
      );
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

    // Calendar fields (§3.9): native picker, 15-minute steps. The model's
    // declared type decides; the name check covers columns it does not list.
    if (c.type === "datetime" || (!c.type && isDtTmCol(c.column))) {
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
          className={`w-full min-w-[10.5rem] px-1 py-0.5 text-[11px] border rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${
              fieldTone(c, val)
            } ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
      );
    }

    // A lookup exists when the sample-derived catalogue has values OR the model
    // says the field is Library-bound — in the latter case the values come from
    // what this database actually uses, fetched when the list is opened.
    /*
     * Three sources, and the difference matters (§3.9 Lookup List Library).
     *
     * `modelList` is the APPROVED list, stated in Peloton's own data model —
     * 22 fields carry one. `library` names one of the 754 encrypted .lib
     * archives, which cannot be read, so all the app can offer there is what
     * the database already contains. Presenting the second as if it were the
     * first is how a typo already in the data becomes a recommendation, so the
     * two are labelled differently and the approved list wins.
     */
    const approved = c.modelList?.length ? listOf(c).labels : null;
    const seeded = approved ?? lookupFor.get(c.column.toLowerCase());
    const hasLookup = !!seeded || !!c.library;
    const listId = seeded ? `wv-lu-${data.table}-${c.column}` : undefined;
    const open = hasLookup && popover?.key === (key ?? "__ghost__") && popover.col === c.column;
    return (
      <div className={hasLookup ? "relative flex items-center" : undefined}>
        <input
          value={approved ? showListValue(c, val) : val}
          list={listId}
          placeholder={isGhost ? "new…" : undefined}
          onFocus={() => focusHelp(c)}
          onChange={(e) => {
            const v = approved ? storeListValue(c, e.target.value) : e.target.value;
            if (isGhost) setGhostValue(c.column, v); else setValue(key!, c.column, v);
          }}
          className={`w-full min-w-[7rem] px-1.5 py-0.5 text-[11px] border rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${
              fieldTone(c, val)
            } ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
        {hasLookup && (
          <>
            {/* Table 3-6 item J: the ellipsis button marks a lookup list. */}
            <button type="button" tabIndex={-1} data-testid="wv-lookup-button"
              title={approved
                ? "Approved values, from WellView’s own data model."
                : c.library
                  ? `Library field — ${c.library.table}. The approved list is not readable here; this offers the values in use.`
                  : "Lookup list"}
              onClick={() => setPopover(open ? null : { key: key ?? "__ghost__", col: c.column })}
              className={`shrink-0 px-1 text-[10px] hover:text-blue-600 ${
                c.library ? "text-blue-400" : "text-gray-400"}`}>…</button>
            {seeded && (
              <datalist id={listId}>
                {seeded.map((v) => <option key={v} value={v} />)}
              </datalist>
            )}
            {open && (
              <LibraryPopover
                db={db} table={data.table} column={c.column}
                library={approved ? null : c.library ?? null}
                seeded={seeded ?? null}
                approved={!!approved}
                onPick={(v) => {
                  const stored = approved ? storeListValue(c, v) : v;
                  if (isGhost) setGhostValue(c.column, stored); else setValue(key!, c.column, stored);
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

  const rowActions = (row: Row, index?: number) => {
    const idrec = String(row.IDRec ?? "");
    return (
      <div className="flex gap-1 px-1">
        {ordered && index !== undefined && (
          <>
            <button type="button" title="Move up" disabled={busy || index === 0}
              onClick={() => moveRow(index, -1)}
              className="text-gray-400 hover:text-blue-600 text-[11px] disabled:opacity-25">▲</button>
            <button type="button" title="Move down" disabled={busy || index === data.rows.length - 1}
              onClick={() => moveRow(index, 1)}
              className="text-gray-400 hover:text-blue-600 text-[11px] disabled:opacity-25">▼</button>
          </>
        )}
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
        <span className="text-xs font-semibold text-gray-800" title={data.help}>{data.label}</span>
        <span className="text-[10px] text-gray-400 font-mono">{data.table}</span>
        <span className="text-[10px] text-gray-400 tabular-nums">{data.rows.length} record{data.rows.length === 1 ? "" : "s"}</span>
        {carriedCount > 0 && !singleRecord && (
          // The new row arrives pre-filled; say so, or a carried value reads as
          // something the user typed and forgot.
          <span className="text-[10px] text-blue-500" title="§5 Set up Day Two — the model says which fields inherit, and which of them step">
            new row carries {carriedCount} field{carriedCount === 1 ? "" : "s"} forward
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={copyDataToClipboard} disabled={data.rows.length === 0}
            title="Copy Data to Clipboard — all records with headings, for Excel"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            Copy Data
          </button>
          {/* §3.9 Paste Data from Clipboard — the inbound half, which the
              guide’s tally exercises depend on. */}
          <button type="button" onClick={() => setPasting(true)} data-testid="wv-edit-paste-open"
            title="Paste Data from Clipboard (§3.9) — a block of spreadsheet rows into this folder"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Paste Data
          </button>
          {canPaste && (
            <button type="button" onClick={() => void pasteRecord()} disabled={busy}
              title={`Paste "${clipboard!.caption}" into this folder (subfolders included)`}
              className="h-7 px-2 text-[11px] rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40">
              Paste Record
            </button>
          )}
          {ordered && data.allowInsertTop && (
            <button type="button" disabled={busy || data.rows.length < 2}
              onClick={() => void reorder([...ids()].reverse(), "Newest record put at the top")}
              title="Add Records to Top — number the list from the bottom up, so the newest record is first"
              className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Records to Top
            </button>
          )}
          {ordered && data.allowSeqInvert && (
            <button type="button" disabled={busy || data.rows.length < 2}
              onClick={() => void reorder([...ids()].reverse(), "Components inverted")}
              title="Invert Components — reverse the string, so an as-run order draws correctly on the schematic"
              className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Invert
            </button>
          )}
          <button type="button" onClick={() => { setEdits({}); setGhost(carrySeedShown); onStatus("Pending changes undone — saved records are untouched."); }}
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

      <div className="flex-1 overflow-auto" ref={gridRef}>
        {vertical ? (
          /* vertical edit mode: fields down the left, records across */
          <table className="text-[11px] border-collapse">
            <tbody>
              <tr>
                <td className="sticky left-0 bg-gray-100 px-2 py-1 border-b border-gray-200" />
                {data.rows.map((r, i) => (
                  <td key={i} className="px-2 py-1 border-b border-l border-gray-200 text-center text-gray-400">
                    #{i + 1}{rowActions(r, i)}
                  </td>
                ))}
                {!singleRecord && (
                  <td className="px-2 py-1 border-b border-l border-gray-200 text-center italic text-gray-400">new</td>
                )}
              </tr>
              {cols.map((c) => (
                <tr key={c.column}>
                  <td className={`sticky left-0 bg-gray-100 px-2 py-0.5 font-medium whitespace-nowrap border-b border-gray-100 ${
                    c.calculated ? "text-green-700" : "text-gray-600"}`}
                    title={[`${data.table}.${c.column}`, c.help, c.calculated ? "Calculated by WellView." : null]
                      .filter(Boolean).join(" — ")}>
                    {c.label}
                    {c.unit && <span className="ml-1 font-normal text-gray-400">({displayUnitLabel(c, unitSet, datumShift)})</span>}
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
              {sections.some((sec) => sec.group) && (
                // WellView's own form sections, as the guide's exercises print them.
                <tr>
                  <th className="px-1 py-0.5 border-b border-gray-200 bg-gray-200/60" />
                  {sections.map((sec, i) => (
                    <th key={i} colSpan={sec.span}
                      className="px-1.5 py-0.5 text-left text-[9px] uppercase tracking-wide font-semibold text-gray-500 bg-gray-200/60 border-b border-l border-gray-300 whitespace-nowrap">
                      {sec.group ?? ""}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                <th className="px-1 py-1 border-b border-gray-200 w-16" />
                {cols.map((c) => (
                  <th key={c.column}
                    className={`px-1.5 py-1 text-left font-medium whitespace-nowrap border-b border-gray-200 ${
                      c.calculated ? "text-green-700" : c.id || c.system ? "text-gray-400" : "text-gray-600"}`}
                    title={[`${data.table}.${c.column}`, c.help, c.calculated ? "Calculated by WellView." : null]
                      .filter(Boolean).join(" — ")}>
                    {c.label}
                    {c.globalMetric
                      ? <span className="text-cyan-600" title="Required global metric">&nbsp;◆</span>
                      : c.required ? <span className="text-amber-600" title="Required">&nbsp;*</span> : null}
                    {c.unit && <span className="ml-1 font-normal text-gray-400">({displayUnitLabel(c, unitSet, datumShift)})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r, i) => {
                const k = keyOf(r);
                const dirty = k !== null && !!edits[k] && Object.keys(edits[k]).length > 0;
                return (
                  <tr key={k ?? i} data-row={k ?? undefined}
                    className={`${i % 2 ? "bg-gray-50" : ""} ${dirty ? "outline outline-1 outline-blue-300" : ""} ${
                      k && k === focusRecord ? "bg-amber-50" : ""}`}>
                    <td className="align-middle">{rowActions(r, i)}</td>
                    {cols.map((c) => (
                      <td key={c.column} className="border-b border-gray-100 align-top"
                        data-cell={k ? `${k}|${c.column.toLowerCase()}` : undefined}>
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

      {pasting && (
        <PasteData
          columns={cols}
          unitSet={unitSet}
          datumShift={datumShift}
          onCancel={() => setPasting(false)}
          onPaste={async (rows) => {
            const res = await wvDbApi.pasteRecords(db, data.table, {
              idwell, parent: parentIdrec ?? undefined, rows,
            });
            setPasting(false);
            // onSaved is the grid’s own refresh — the folder re-reads itself.
            onSaved();
            // The server names any column it would not write. Saying so is the
            // difference between a tally that is short a field and one that
            // looks complete.
            const note = res.rejected.length
              ? ` ${res.rejected.length} column${res.rejected.length === 1 ? " was" : "s were"} not written: `
                + res.rejected.map((r) => `${r.column} (${r.why})`).join(", ")
              : "";
            onStatus(`Pasted ${res.inserted} record${res.inserted === 1 ? "" : "s"}.${note}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * The lookup window for a field bound to a WellView Library.
 *
 * The APPROVED list is not available: WellView keeps its libraries in
 * `custom/library/*.lib`, and all 754 of them are encrypted ZIP archives. So
 * this offers the values the open database actually holds for the column, and
 * says exactly that — a list of values in use must never be mistaken for the
 * sanctioned list, or a typo already in the data becomes a recommendation.
 *
 * Values are fetched when the list is opened, not with the grid: a folder can
 * carry dozens of library-bound columns and almost none get opened.
 */
function LibraryPopover({ db, table, column, library, seeded, approved, onPick, onClose }: {
  db: string;
  table: string;
  column: string;
  library: { table: string; field: string | null } | null;
  /** Values the sample-derived catalogue already knows, if any. */
  seeded: string[] | null;
  /** True when `seeded` is the APPROVED model list, not merely values in use. */
  approved?: boolean;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "column-values", table, column],
    queryFn: () => wvDbApi.columnValues(db, table, column),
    staleTime: 60_000,
  });
  // In-use values first, then anything the catalogue knows that the database
  // has not used yet — both are offers, neither is authority.
  const values = useMemo(() => {
    // The approved list stands on its own: mixing in whatever the database
    // happens to contain would put unsanctioned values beside sanctioned ones
    // with nothing to tell them apart.
    if (approved) return seeded ?? [];
    const inUse = q.data?.values ?? [];
    const extra = (seeded ?? []).filter((v) => !inUse.includes(v));
    return [...inUse, ...extra];
  }, [q.data, seeded, approved]);

  return (
    <ValuesPopover
      values={values}
      loading={approved ? false : q.isLoading}
      note={approved
        ? "The approved values, from WellView’s own data model."
        : library
          ? `Values in use in this database. The approved library (${library.table}) ships encrypted and cannot be read here.`
          : "Values in use in this database."}
      onPick={onPick}
      onClose={onClose}
    />
  );
}

/** The library lookup window: filter row on top, sortable values, click to pick. */
function ValuesPopover({ values, onPick, onClose, note, loading }: {
  values: string[]; onPick: (v: string) => void; onClose: () => void;
  /** What this list IS — shown under it, because provenance matters here. */
  note?: string;
  loading?: boolean;
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
        {loading && <div className="px-2 py-1.5 text-[11px] text-gray-400">Reading the database…</div>}
        {!loading && shown.length === 0 && (
          <div className="px-2 py-1.5 text-[11px] text-gray-400">
            {values.length === 0 ? "No value has been used for this field yet — type one." : "No match."}
          </div>
        )}
      </div>
      {note && (
        <div className="px-2 py-1 border-t border-gray-100 text-[10px] leading-snug text-gray-400">
          {note}
        </div>
      )}
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

/**
 * Paste Data from Clipboard (§3.9).
 *
 * The guide's own procedure, and the reason it matters: "Enter the tubing
 * string information by cutting and pasting from the applied Excel spreadsheet"
 * — 147 joints in that exercise — plus the casing tally and survey loads the
 * same way. Each was row-by-row typing while only the outbound half existed.
 *
 * It follows the desktop's dialog: paste the block, MAP each pasted column to a
 * column in this folder, set "Start at row" to skip a heading, then OK. Two
 * things it does that the desktop does not have to: the mapping is guessed from
 * the heading row where a name matches, and every value is converted out of the
 * user's unit set before it is sent, because the grid the block was copied from
 * shows feet where the database stores metres.
 */
function PasteData({
  columns, unitSet, datumShift, onCancel, onPaste,
}: {
  columns: WvRecordColumn[];
  unitSet: UnitSet;
  datumShift: DatumShift | null;
  onCancel: () => void;
  onPaste: (rows: Record<string, unknown>[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [startRow, setStartRow] = useState(2);
  const [map, setMap] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Columns this folder will accept — the same rule the server applies. */
  const writable = useMemo(
    () => columns.filter((c) => !c.id && !c.system && !c.tk && !c.calculated),
    [columns]);

  /** The pasted block. Tab-separated is what every spreadsheet puts on the clipboard. */
  const grid = useMemo(() => text.replace(/\r/g, "").split("\n")
    .filter((l) => l.length > 0).map((l) => l.split("\t")), [text]);
  const width = grid.reduce((n, r) => Math.max(n, r.length), 0);

  /**
   * Guess the mapping from the first row, by label or column name.
   *
   * Only ever a starting point: the dialog shows every choice and the user can
   * change any of them, because a wrong guess here writes a length into a grade.
   */
  useEffect(() => {
    if (!grid.length) return;
    const head = grid[0];
    const next: Record<number, string> = {};
    head.forEach((h, i) => {
      const k = h.trim().toLowerCase().replace(/\s+/g, "");
      const hit = writable.find((c) => c.label.toLowerCase().replace(/\s+/g, "") === k
        || c.column.toLowerCase() === k);
      if (hit) next[i] = hit.column;
    });
    setMap(next);
    // A heading row that mapped is a heading row: start at 2.
    setStartRow(Object.keys(next).length ? 2 : 1);
  }, [text, grid, writable]);

  const mapped = Object.values(map).filter(Boolean);
  const body = grid.slice(Math.max(0, startRow - 1));

  const go = async () => {
    setError(null);
    if (!mapped.length) { setError("Map at least one column first."); return; }
    setBusy(true);
    try {
      const rows = body.map((cells) => {
        const out: Record<string, unknown> = {};
        for (const [ix, col] of Object.entries(map)) {
          if (!col) continue;
          const raw = (cells[Number(ix)] ?? "").trim();
          if (raw === "") continue;
          const c = columns.find((x) => x.column === col);
          // A measured column was copied in the unit set on screen, so it is
          // converted back the way a single edited cell is.
          if (c?.unit) {
            const base = fromDisplay(raw, c, unitSet, c.applyDatum ? datumShift : null);
            out[col] = base === null ? raw : base;
          } else {
            out[col] = raw;
          }
        }
        return out;
      }).filter((r) => Object.keys(r).length > 0);
      if (!rows.length) { setError("Nothing to paste after the start row."); return; }
      await onPaste(rows);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 grid place-items-center p-4"
      data-testid="wv-paste-dialog">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-900">
          Paste Data from Clipboard
        </div>
        <div className="p-4 space-y-3 overflow-auto">
          <p className="text-[11px] text-gray-500">
            Copy a block of cells in Excel, then paste it here. Map each pasted column to a
            field in this folder — measured columns are read in the units on screen.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            data-testid="wv-paste-text" autoFocus
            placeholder="Paste here (Ctrl-V)…"
            className="w-full border border-gray-300 rounded p-2 text-[11px] font-mono" />

          {grid.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-[11px] text-gray-600">
                Start at row
                <input type="number" min={1} max={Math.max(1, grid.length)} value={startRow}
                  data-testid="wv-paste-startrow"
                  onChange={(e) => setStartRow(Math.max(1, Number(e.target.value) || 1))}
                  className="h-7 w-16 border border-gray-300 rounded px-1 text-[11px]" />
                <span className="text-gray-400">
                  {body.length} row{body.length === 1 ? "" : "s"} will be added
                </span>
              </label>

              <div className="overflow-auto border border-gray-200 rounded">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      {Array.from({ length: width }, (_, i) => (
                        <th key={i} className="px-1 py-1 text-left font-medium">
                          <select value={map[i] ?? ""} data-testid={`wv-paste-map-${i}`}
                            onChange={(e) => setMap((m) => ({ ...m, [i]: e.target.value }))}
                            className="h-7 w-full border border-gray-300 rounded px-1 text-[11px] bg-white">
                            <option value="">— skip —</option>
                            {writable.map((c) => (
                              <option key={c.column} value={c.column}>
                                {c.label}{c.unit ? ` (${displayUnitLabel(c, unitSet, datumShift)})` : ""}
                              </option>
                            ))}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.slice(0, 5).map((r, ri) => (
                      <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}>
                        {Array.from({ length: width }, (_, ci) => (
                          <td key={ci} className={`px-1.5 py-0.5 whitespace-nowrap ${
                            map[ci] ? "text-gray-800" : "text-gray-300 line-through"}`}>
                            {r[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {body.length > 5 && (
                <p className="text-[10px] text-gray-400">
                  Showing the first 5 of {body.length}.
                </p>
              )}
            </>
          )}
          {error && <p className="text-[11px] text-red-700" data-testid="wv-paste-error">{error}</p>}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2">
          <span className="text-[11px] text-gray-500">
            {mapped.length} column{mapped.length === 1 ? "" : "s"} mapped
          </span>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onCancel}
              className="h-7 px-3 text-[11px] rounded border border-gray-300 hover:bg-gray-50">
              Cancel
            </button>
            <button type="button" onClick={() => void go()} disabled={busy || !mapped.length || !body.length}
              data-testid="wv-paste-ok"
              className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
              {busy ? "Pasting…" : "OK"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
