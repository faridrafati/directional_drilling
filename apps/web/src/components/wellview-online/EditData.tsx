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
import { wvDbApi, type WvRecordColumn, type WvRecords, type WvTreeNode, type WvSubjectArea } from "../../entry/wellviewDb.js";
import { usePicklistCatalog } from "../../entry/picklists.js";
import { useUnitSet, type UnitSet } from "../../entry/unitSet.js";
import { useDatumShift } from "../../entry/datum.js";
import { toDisplay, fromDisplay, displayUnitLabel, formatUnitValue, formatUnitList, unitDescription } from "@dd/shared";
import type { DatumShift } from "@dd/shared";
import { Attachments } from "./Attachments.js";
import { InventoryTransfer } from "./InventoryTransfer.js";

/**
 * One record as it travels.
 *
 * `number[]` is the odd one out: a calculated LIST field — a bit's nozzles —
 * whose values arrive in the model's base unit so the client can render them in
 * the user's. It only ever appears on a calculated column, which is read-only
 * everywhere in this component, so no editing path has to handle it.
 */
type Row = Record<string, string | number | number[] | null>;

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
  /**
   * The Explorer selection this window was opened on. With more than one, the
   * title bar offers them — §3.9's "you can then choose from that list of wells
   * when editing data".
   */
  wells?: { idwell: string; name: string }[];
}

export function EditData({
  db, idwell, wellName, wells, initialTable, initialRecord, initialColumn, clipboard, onClipboard, onClose,
}: Props) {
  /*
   * SELECT WELLS (§3.9, and 9.0's Edit Data Enhancements).
   *
   * "To edit data for a selection of wells, select multiple wells from the well
   * list… You can then choose from that list of wells when editing data" —
   * "making it easier for such tasks as copying between wells".
   *
   * The window took one `idwell` and had no way back to the Explorer without
   * closing, so Copy Record here and Paste Record there meant shutting the
   * window between them. The clipboard already survives that; the switch is
   * what was missing.
   */
  const [well, setWell] = useState(idwell);
  useEffect(() => { setWell(idwell); }, [idwell]);
  const wellList = wells ?? [];
  const currentName = wellList.find((w) => w.idwell === well)?.name ?? wellName;
  const qc = useQueryClient();
  const [table, setTable] = useState<string | null>(initialTable ?? "wvWellHeader");
  const [vertical, setVertical] = useState(false);
  /*
   * THE WELL HEADER IS ALWAYS VERTICAL, because it is always one record.
   *
   * The guide says so outright — "Since a well can have only have one well
   * header record, the well header always displays in vertical edit mode"
   * (its typo, not mine) — and this window opens on wvWellHeader by default,
   * so the first screen of every Edit Data session was 105 columns laid across
   * a single row that had to be scrolled end to end. Vertical mode already
   * renders this table correctly and already freezes the label column; the fix
   * is to stop offering the wrong one.
   */
  const forcedVertical = (table ?? "").toLowerCase() === "wvwellheader";
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

  /*
   * §3.9 SHOW CALCULATED FOLDERS.
   *
   * WellView's wv*Calc tables are built when a report prints and stored
   * nowhere — zero of the model's 101 exist in either converted database. This
   * app derives 29 of them, and until now they could be reached ONLY through a
   * report template that binds one, which left four computable here and
   * openable from nowhere. Off by default, as the desktop hides them.
   */
  const [showCalc, setShowCalc] = useState(false);
  const treeQ = useQuery({
    queryKey: ["wvdb", db, "tree", well, showCalc],
    queryFn: () => wvDbApi.tree(db, well, showCalc),
  });
  const tree = useMemo(() => treeQ.data?.tree ?? [], [treeQ.data]);
  /** The derived folders on offer, so the pane knows which kind it is showing. */
  const calcTables = useMemo(() => {
    const out = new Set<string>();
    const walk = (ns: WvTreeNode[]) => {
      for (const n of ns) { if (n.derived && n.children.length === 0) out.add(n.table.toLowerCase()); walk(n.children); }
    };
    walk(tree);
    return out;
  }, [tree]);

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
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "tree", well] });
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "template"] });
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic", well] });
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
          {wellList.length > 1 ? (
            /*
             * §3.9: "You can then choose from that list of wells when editing
             * data." Switching saves what is pending first, as leaving a folder
             * does, and clears the parent picks — a job record chosen on one
             * well means nothing on another.
             */
            <select value={well} data-testid="wv-edit-well"
              title="The wells selected in the Explorer. Copy a record here and paste it into the same folder on another."
              onChange={(e) => {
                const next = e.target.value;
                void (async () => {
                  const ok = (await flushRef.current?.()) ?? true;
                  if (!ok) return;
                  setParentPick({});
                  setStatus(null);
                  setWell(next);
                })();
              }}
              className="h-7 max-w-[22rem] px-1 text-[11px] rounded border border-gray-600 bg-gray-700 text-gray-100">
              {wellList.map((w) => (
                <option key={w.idwell} value={w.idwell}>{w.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-gray-300 truncate">{currentName}</span>
          )}
          <label className="ml-auto flex items-center gap-1 text-[11px] text-gray-300">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            Show System Fields
          </label>
          <label className="flex items-center gap-1 text-[11px] text-gray-300"
            title="Show Calculated Folders — WellView works these out when a report prints and stores none of them. They are read-only here, and every figure is derived from records this database does hold.">
            <input type="checkbox" checked={showCalc} data-testid="wv-edit-showcalc"
              onChange={(e) => {
                setShowCalc(e.target.checked);
                // Leaving a derived folder by hiding it would strand the pane.
                if (!e.target.checked && calcTables.has((table ?? "").toLowerCase())) {
                  setTable("wvWellHeader");
                }
              }} />
            Show Calculated Folders
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
            disabled={forcedVertical} data-testid="wv-edit-mode"
            title={forcedVertical
              ? "A well has one header record, so it always shows in vertical mode."
              : "Change Edit Mode — horizontal reads left to right, vertical top to bottom"}
            className="h-7 px-2 text-[11px] rounded border border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {vertical || forcedVertical ? "Vertical" : "Horizontal"} mode
          </button>
          <button type="button" onClick={saveAndExit} data-testid="wv-edit-save-exit"
            className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500">
            Save and Exit
          </button>
        </div>

        {showInventory && (
          <InventoryTransfer db={db} toWell={well} toWellName={currentName}
            onClose={() => setShowInventory(false)} />
        )}
        {showAttach && (
          /* Files stored in the database against this well. Scoped to the
             folder in view when one is open, so uploading from the Casing
             folder attaches to casing rather than to the well at large. */
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 max-h-72 overflow-y-auto shrink-0">
            <Attachments db={db} idwell={well} table={table ?? undefined} />
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          {/* folder tree */}
          <aside className="w-72 shrink-0 border-r border-gray-200 overflow-y-auto p-1.5 bg-gray-50">
            {treeQ.isLoading && <div className="p-2 text-xs text-gray-400">Reading the schema…</div>}
            <SubjectTree nodes={tree} subjects={treeQ.data?.subjects ?? []}
              active={table} onPick={pickFolder} />
          </aside>

          {/* records */}
          <section className="flex-1 min-w-0 flex flex-col min-h-0">
            {table && calcTables.has(table.toLowerCase()) ? (
              <CalcFolder key={`${well}-${table}`} db={db} idwell={well} table={table} onStatus={setStatus} />
            ) : table && treeQ.data ? (
              <FolderRecords
                key={`${well}-${table}-${chain.length}-${showSystem}`}
                db={db} idwell={well} table={table} chain={chain}
                vertical={vertical || forcedVertical} showSystem={showSystem}
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

/**
 * The folder tree — grouped into subject areas, and openable and closable.
 *
 * §3.9 Selecting Folders states both: "Well information in the Edit Data window
 * is grouped into subject areas… Click to expand a subject area or folder to
 * see its subfolders. Click to collapse a subject area or folder."
 *
 * Neither existed. Sixty-six top-level folders were listed flat and ordered by
 * hidden table names, with every subfolder of every one of them expanded at
 * once — 199 rows on this database before a single record is looked at.
 *
 * What is open on arrival is the area and the ancestors of the SELECTED folder,
 * and nothing else: the tree opens on the record the user came to see, rather
 * than on all of it.
 */
function SubjectTree({ nodes, subjects, active, onPick }: {
  nodes: WvTreeNode[];
  subjects: WvSubjectArea[];
  active: string | null;
  onPick: (t: string) => void;
}) {
  const byTable = new Map(nodes.map((n) => [n.table.toLowerCase(), n]));
  /** The area holding the selected folder, which is the one to open on arrival. */
  const homeArea = useMemo(() => {
    const holds = (n: WvTreeNode): boolean =>
      n.table.toLowerCase() === (active ?? "").toLowerCase() || n.children.some(holds);
    for (const a of subjects) {
      if (a.tables.some((t) => { const n = byTable.get(t.toLowerCase()); return n ? holds(n) : false; })) {
        return a.name;
      }
    }
    return subjects[0]?.name ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, nodes, active]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (name: string) => open[name] ?? name === homeArea;

  if (!subjects.length) {
    return <FolderTree nodes={nodes} depth={0} active={active} onPick={onPick} />;
  }
  return (
    <div>
      {subjects.map((a) => {
        const mine = a.tables.map((t) => byTable.get(t.toLowerCase())).filter(Boolean) as WvTreeNode[];
        if (!mine.length) return null;
        const shown = isOpen(a.name);
        const holding = mine.reduce((n, x) => n + (x.count ?? 0), 0);
        return (
          <div key={a.name} className="mb-0.5">
            <button type="button" data-testid="wv-subject"
              onClick={() => setOpen((o) => ({ ...o, [a.name]: !shown }))}
              title={a.listed
                ? `${a.name} — a subject area of the WellView database`
                : "Folders this database has that the user guide's subject areas do not name. "
                  + "They are here so they stay reachable."}
              className={`w-full text-left px-1.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 ${
                a.listed ? "text-gray-700 hover:bg-gray-200" : "text-gray-400 italic hover:bg-gray-200"}`}>
              <span className="w-3 text-gray-400">{shown ? "▾" : "▸"}</span>
              <span className="truncate">{a.name}</span>
              {holding > 0 && (
                <span className="ml-auto text-[10px] text-gray-400 tabular-nums font-normal">{holding}</span>
              )}
            </button>
            {shown && <FolderTree nodes={mine} depth={1} active={active} onPick={onPick} />}
          </div>
        );
      })}
    </div>
  );
}

function FolderTree({ nodes, depth, active, onPick }: {
  nodes: WvTreeNode[]; depth: number; active: string | null; onPick: (t: string) => void;
}) {
  /*
   * A folder opens when it, or something under it, is the folder in view.
   * Anything else stays shut until it is clicked — the guide's own behaviour,
   * and the difference between a list of 199 rows and a list of a dozen.
   */
  const holds = (n: WvTreeNode): boolean =>
    n.table.toLowerCase() === (active ?? "").toLowerCase() || n.children.some(holds);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <div>
      {nodes.map((n) => {
        const shown = open[n.table] ?? holds(n);
        return (
        <div key={n.table}>
          <button type="button"
            style={{ paddingLeft: 6 + depth * 14 }}
            className={`w-full text-left pr-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 ${
              active?.toLowerCase() === n.table.toLowerCase()
                ? "bg-blue-100 text-blue-900 font-medium"
                : (n.count ?? 0) > 0 || n.needs?.length
                  ? "text-gray-800 hover:bg-gray-100"
                  : "text-gray-400 hover:bg-gray-100"}`}
            title={n.needs?.length
              ? `${n.table} — summarises one ${n.needs.includes("idreport") ? "daily report" : "job"}; `
                + "how many rows depends on which one"
              : n.table}
            disabled={n.derived === true && n.children.length > 0}
            onClick={() => onPick(n.table)}>
            {/* §3.9 "Click to expand a folder to see its subfolders." Its own
                control, so opening a folder and selecting it stay separate. */}
            {n.children.length > 0 ? (
              <span role="button" tabIndex={-1} data-testid="wv-folder-toggle"
                title={shown ? "Collapse" : `Expand — ${n.children.length} subfolders`}
                onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [n.table]: !shown })); }}
                className="w-3 shrink-0 text-gray-400 hover:text-gray-700">
                {shown ? "▾" : "▸"}
              </span>
            ) : <span className="w-3 shrink-0" />}
            <FolderGlyph filled={(n.count ?? 0) > 0} />
            <span className="truncate">{n.label}</span>
            {/*
              * A derived folder that summarises one job has no count until a
              * job is chosen, and "0" would read as an empty folder. It says
              * what it is waiting for instead.
              */}
            {n.count == null && n.needs?.length ? (
              <span className="ml-auto text-[10px] text-gray-400 italic">
                per {n.needs.includes("idreport") ? "report" : "job"}
              </span>
            ) : (n.count ?? 0) > 0 ? (
              <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{n.count}</span>
            ) : null}
          </button>
          {n.children.length > 0 && shown && (
            <FolderTree nodes={n.children} depth={depth + 1} active={active} onPick={onPick} />
          )}
        </div>
        );
      })}
    </div>
  );
}

/**
 * One derived cell, in the unit set the rest of the window is reading in.
 *
 * The same conversion the editable grid uses. A number left in base units under
 * a heading that says feet is the failure this whole path is careful about.
 */
function calcCell(
  v: unknown,
  c: WvRecordColumn,
  unitSet: string,
  datumShift: DatumShift | null,
): string {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (c.unit && Number.isFinite(n)) {
    const d = toDisplay(n, { unit: c.unit, units: c.units, applyDatum: c.applyDatum, datumMode: c.datumMode },
      unitSet, datumShift);
    if (d) return formatUnitValue(d.value, d);
  }
  return fmtCell(String(v));
}

/**
 * A CALCULATED FOLDER (§3.9 Show Calculated Folders).
 *
 * WellView builds these tables when a report prints and stores nothing, so
 * there is no record to edit and no ghost row to add one with. What this shows
 * is the derivation's output, marked as derived, with the provenance the
 * derivation itself carries: which stored tables the figures come from, how
 * they were checked, and which of the model's own fields this app deliberately
 * does not fill.
 *
 * Eighteen of the twenty-nine summarise ONE job or ONE daily report. Until one
 * is chosen there is nothing to summarise — which is not the same as an empty
 * folder, so the pane asks for the selection rather than drawing a blank table.
 */
function CalcFolder({ db, idwell, table, onStatus }: {
  db: string;
  idwell: string;
  table: string;
  onStatus: (s: string | null) => void;
}) {
  const [job, setJob] = useState("");
  const [report, setReport] = useState("");
  useEffect(() => { setJob(""); setReport(""); onStatus(null); }, [table]);

  const q = useQuery({
    queryKey: ["wvdb", db, "records", table, idwell, job, report],
    queryFn: () => wvDbApi.records(db, table, {
      idwell, ...(job ? { job } : {}), ...(report ? { report } : {}),
    }),
  });
  const data = q.data;
  const needs = data?.needs ?? [];
  const wantsJob = needs.includes("idjob") || needs.includes("idreport") || !!job;
  const wantsReport = needs.includes("idreport") || (!!report && !!job);

  const jobsQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvJob", idwell, false],
    queryFn: () => wvDbApi.records(db, "wvJob", { idwell }),
    enabled: wantsJob,
  });
  const reportsQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvJobReport", idwell, job, false],
    queryFn: () => wvDbApi.records(db, "wvJobReport", { idwell, parent: job }),
    enabled: wantsReport && !!job,
  });

  const [unitSet] = useUnitSet();
  const { shift: datumShift } = useDatumShift(db, idwell);
  const cols = data?.columns ?? [];
  const rows = (data?.rows ?? []) as Row[];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-xs font-semibold text-gray-800" title={data?.help}>{data?.label ?? table}</span>
        <span className="text-[10px] text-gray-400 font-mono">{table}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
          title="WellView computes this table when a report prints and stores none of it. Every value here was worked out from records this database does hold.">
          derived — read-only
        </span>
        {data?.total != null && (
          <span className="text-[10px] text-gray-400 tabular-nums" data-testid="wv-calc-count">
            {data.total} record{data.total === 1 ? "" : "s"}
          </span>
        )}
        {wantsJob && (
          <label className="flex items-center gap-1 text-[10px] text-gray-500 ml-2">
            Job
            <select value={job} data-testid="wv-calc-job"
              onChange={(e) => { setJob(e.target.value); setReport(""); }}
              className="h-6 px-1 text-[11px] rounded border border-gray-300 max-w-[16rem]">
              <option value="">— choose —</option>
              {(jobsQ.data?.rows ?? []).map((r) => (
                <option key={String(r.IDRec)} value={String(r.IDRec)}>
                  {recordCaption(r as Row)}
                </option>
              ))}
            </select>
          </label>
        )}
        {wantsReport && (
          <label className="flex items-center gap-1 text-[10px] text-gray-500">
            Daily report
            <select value={report} data-testid="wv-calc-report" disabled={!job}
              onChange={(e) => setReport(e.target.value)}
              className="h-6 px-1 text-[11px] rounded border border-gray-300 max-w-[16rem] disabled:opacity-40">
              <option value="">— choose —</option>
              {(reportsQ.data?.rows ?? []).map((r) => (
                <option key={String(r.IDRec)} value={String(r.IDRec)}>
                  {recordCaption(r as Row)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {q.isLoading && <div className="p-4 text-sm text-gray-400">Working it out…</div>}
        {!q.isLoading && data?.unavailable && (
          <div className="m-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
            {data.unavailable}
          </div>
        )}
        {!q.isLoading && !!needs.length && (
          /* Not an empty folder — a summary with nothing chosen to summarise. */
          <div className="m-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-900"
            data-testid="wv-calc-needs">
            This summary is worked out for one {needs.includes("idreport") ? "daily report" : "job"} at a
            time. Choose {needs.includes("idreport") ? "a job and then a daily report" : "a job"} above and
            it will be computed. It is not empty — there is nothing selected to summarise yet.
          </div>
        )}
        {!q.isLoading && !needs.length && !data?.unavailable && rows.length === 0 && (
          <div className="p-4 text-sm text-gray-400">
            Nothing to summarise here — the records this is worked out from
            ({(data?.sources ?? []).join(", ") || "its source tables"}) hold nothing for this selection.
          </div>
        )}
        {rows.length > 0 && (
          <table className="text-[11px] border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-gray-100 px-2 py-1 border-b border-gray-200 text-right text-gray-400 font-normal">#</th>
                {cols.map((c) => (
                  <th key={c.column} title={c.help}
                    className="bg-gray-100 px-2 py-1 border-b border-gray-200 text-left font-medium text-emerald-800 whitespace-nowrap">
                    {c.label}
                    {c.unit && (
                      <span className="text-gray-400 font-normal">
                        {" "}({displayUnitLabel(c, unitSet, datumShift)})
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="odd:bg-white even:bg-gray-50/60">
                  <td className="sticky left-0 bg-inherit px-2 py-0.5 border-b border-gray-100 text-right text-gray-400 tabular-nums">
                    {i + 1}
                  </td>
                  {cols.map((c) => (
                    <td key={c.column} className="px-2 py-0.5 border-b border-gray-100 whitespace-nowrap text-gray-700">
                      {calcCell(r[c.column], c, unitSet, datumShift)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* The provenance travels with the numbers, as it does on a report. */}
        {(data?.verifiedBy || (data?.unsupported?.length ?? 0) > 0) && (
          <div className="m-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-[10px] text-gray-500 space-y-1">
            {!!data?.sources?.length && (
              <p><b>Worked out from:</b> {data.sources.join(", ")}.</p>
            )}
            {data?.verifiedBy && <p><b>Checked by:</b> {data.verifiedBy}</p>}
            {!!data?.unsupported?.length && (
              <div>
                <p><b>Fields WellView declares that this does not fill:</b></p>
                <ul className="list-disc pl-4">
                  {data.unsupported.map((u) => (
                    <li key={u.field}><span className="font-mono">{u.field}</span> — {u.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
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

  /*
   * FIND (§3.9 Finding Data) lives HERE rather than in the grid, because the
   * filtering is the server's: "Some Edit Data folders contain a large number
   * of records" is exactly the case a client-side find fails, the read being
   * capped at 500 and folders of 2,389 existing.
   */
  const [find, setFind] = useState("");
  useEffect(() => { setFind(""); }, [table, parentIdrec]);

  /*
   * The grid registers its own save-on-leave with the window; this keeps a
   * second handle on it so a find can save first.
   *
   * Narrowing the folder is leaving part of it, and §3.9's rule for leaving is
   * that pending changes are saved. A row edited and then filtered out would
   * otherwise sit in state the user can no longer see.
   */
  const gridFlush = useRef<(() => Promise<boolean>) | null>(null);
  const registerBoth = (fn: (() => Promise<boolean>) | null) => {
    gridFlush.current = fn;
    registerFlush(fn);
  };
  const applyFind = (term: string) => {
    void (async () => {
      const ok = (await gridFlush.current?.()) ?? true;
      if (ok) setFind(term);
    })();
  };

  const recordsQ = useQuery({
    queryKey: ["wvdb", db, "records", table, idwell, parentIdrec, showSystem, find],
    queryFn: () => wvDbApi.records(db, table, {
      idwell, parent: parentIdrec ?? undefined, system: showSystem,
      ...(find ? { find } : {}),
    }),
    enabled: true,
  });

  const data = recordsQ.data;
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["wvdb", db, "records", table] });
    onDirty();
  };

  /*
   * A BROKEN PARENT CHAIN IS NOT THE SAME AS AN EMPTY FOLDER, and this used to
   * treat them as one.
   *
   * When an ancestor folder has no record, this returned "add the parent record
   * first" and fetched nothing. Usually right. But wvComment holds nine rows in
   * the sample database whose IDRecParent points at wvJobSafetyIncident records
   * that are NOT in this export — so the subject tree counts five on this well
   * and the pane said the well had none. Both cannot be true.
   *
   * The rows win. They are shown, with a notice saying what is actually wrong,
   * because data nobody can reach is the thing this whole exercise is about.
   * The original message still stands when the folder really is empty.
   */
  if (ancestors.length && chainBroken && !(recordsQ.data?.rows.length) && !find) {
    const broken = ancestorQueries.find((a) => !a.idrec);
    return (
      <div className="p-4 text-sm text-gray-500">
        <b>{chain[chain.length - 1]?.label}</b> records belong to a record in{" "}
        <b>{broken?.label}</b>, and this well has none yet — add the parent record first, the way the
        manual has you work down the subject areas in order.
      </div>
    );
  }
  const orphaned = ancestors.length > 0 && chainBroken && !!recordsQ.data?.rows.length;

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

      {orphaned && (
        <div className="px-3 py-1.5 text-[11px] text-amber-800 bg-amber-50 border-b border-amber-200 shrink-0"
          data-testid="wv-edit-orphaned">
          These records name a parent in{" "}
          <b>{ancestorQueries.find((a) => !a.idrec)?.label ?? "another folder"}</b>{" "}
          that is not in this database, so nothing links to them. They are shown here because they
          exist; they cannot be reached the ordinary way.
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
          onSaved={refresh} onStatus={onStatus} registerFlush={registerBoth}
          find={find} onFind={applyFind}
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

/**
 * A field that gets the comments editor rather than a one-line input.
 *
 * 9.0: "Text fields that are 100 characters or more can now function as a
 * comments field that opens to a larger edit window." `stringlong` fields
 * declare no length at all and are comments fields by their type.
 */
const COMMENTS_FIELD_CHARS = 100;
export const isCommentsField = (c: { type?: string; size?: number }): boolean =>
  c.type === "stringlong"
  || (c.type === "string" && (c.size ?? 0) >= COMMENTS_FIELD_CHARS);

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
function RecordsGrid({ db, idwell, data, vertical, showIds, parentIdrec, clipboard, onClipboard, onSaved, onStatus, registerFlush, find, onFind, focusRecord, focusColumn }: {
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
  /** The find term in force (§3.9 Finding Data); "" when the whole folder shows. */
  find: string;
  onFind: (term: string) => void;
  focusRecord: string | null;
  focusColumn: string | null;
}) {
  // TK companions are managed with their link column and never rendered.
  // Fields the data model marks hidden appear only under "Show All Fields",
  // which is what the desktop's toggle does.
  /*
   * The stored columns AND the calculated ones.
   *
   * The server has always sent `computedColumns` — the model-calculated fields
   * these rows carry, which have no column in the database because WellView
   * works them out when a report prints. Nothing on this side ever read them,
   * so a folder's green cells were invisible however many of them this app
   * learned to compute: a contractor's score, a bit's total flow area, a zone's
   * current status all arrived in the row and had no heading to appear under.
   *
   * They need no special rendering. `calculated` already means read-only, green
   * and tooltipped throughout this component; it simply had nothing to act on.
   */
  const visible = [...data.columns, ...(data.computedColumns ?? [])].filter((c) =>
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
  }, [data.columns, data.computedColumns, data.fieldGroups, showIds]);

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
  const [fieldInfo, setFieldInfo] = useState(false);
  /** What is typed in the Find box, which is not yet what is being found. */
  const [findDraft, setFindDraft] = useState(find);
  useEffect(() => { setFindDraft(find); }, [find]);
  /** The record whose copy is being configured, and what to call the action. */
  const [choosing, setChoosing] = useState<
    { table: string; idrec: string; caption: string; verb: string; paste: boolean } | null>(null);
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
    /*
     * A TRUNCATED FOLDER HAS NO "PREVIOUS RECORD" to carry from.
     *
     * The seed copies the last row that was READ, and in a folder capped at 500
     * that is row 500 of 2,389 — not the record a user just finished, and not
     * the one WellView would carry from. Seeding from it would put a plausible
     * wrong date and depth into a new record, which is worse than an empty one.
     */
    if (data.truncated) return {} as Row;
    /*
     * NEITHER HAS A FILTERED ONE. With a find running the last row on screen is
     * the last MATCH, not the last record — carrying from it would seed a new
     * record from whichever row happened to contain the search term.
     */
    if (find) return {} as Row;
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
      // A list-valued CALCULATED field is never carried forward — nothing
      // calculated is editable, so there is nothing to seed.
      if (Array.isArray(v)) continue;
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
      if (tk != null && tk !== "" && !Array.isArray(tk)) seed[tkCol] = tk;
    }
    return seed;
  }, [data.rows, data.columns, find]);
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

  /*
   * §3.11 SELECTING RECORDS — the gate for multi-delete, multi-copy and
   * Copy Selected Data.
   *
   * The guide is specific about the gesture and it is not a row click: "To
   * select one record, click the record number column in vertical or horizontal
   * view." / "To select multiple records, click the record number column and
   * drag to select." 9.0's own enhancement list adds the keyboard: "You can
   * select multiple records when deleting as well as copying and pasting. To
   * highlight the rows, use the Ctrl and Shift keys." And the shortcut table
   * binds "Select all the records — Ctrl+A".
   *
   * The NUMBER COLUMN is the hit target for a reason that survives the port: a
   * row here can carry a hundred inputs, and a row-wide handler would fight
   * every one of them for focus and text selection.
   *
   * The shift/ctrl model is the Explorer's, ported rather than rewritten —
   * WellExplorer.clickRow has done exactly this since the well list gained
   * multi-select, and two selection models that behave differently in the same
   * app is a worse outcome than either.
   */
  const [selected, setSelected] = useState<string[]>([]);
  const lastClick = useRef<number | null>(null);
  const dragging = useRef(false);

  /*
   * An IDRec survives a refresh; a POSITION does not. So the selection is
   * dropped whenever the folder changes underneath it — a different table, a
   * different parent record, or a save that re-read the rows. Keeping it would
   * let a bulk action address rows that had moved.
   */
  useEffect(() => { setSelected([]); lastClick.current = null; }, [data.table, parentIdrec]);

  /*
   * Ctrl+A — "Select all the records", from the shortcut table.
   *
   * Bound on the window but ignored whenever the focus is in a field, because
   * inside a text box Ctrl+A means select the text and taking that away would
   * be a worse trade than the shortcut is worth.
   */
  useEffect(() => {
    if (singleRecord) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "a") return;
      const el = document.activeElement;
      const tag = el?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      setSelected(data.rows.map((r) => String(r.IDRec ?? "")).filter(Boolean));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data.rows, singleRecord]);

  const selectableRows = singleRecord ? [] : data.rows;
  const idOfRow = (r: Row) => String(r.IDRec ?? "");

  function clickRow(row: Row, e: React.MouseEvent, index: number) {
    if (singleRecord) return;
    const id = idOfRow(row);
    if (!id) return;
    if (e.shiftKey && lastClick.current !== null) {
      const [a, b] = [lastClick.current, index].sort((x, y) => x - y);
      setSelected(selectableRows.slice(a, b + 1).map(idOfRow).filter(Boolean));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      lastClick.current = index;
    } else {
      setSelected([id]);
      lastClick.current = index;
    }
  }

  /** "click the record number column and drag to select" — the guide's words. */
  function dragOver(index: number) {
    if (!dragging.current || singleRecord) return;
    const start = lastClick.current;
    if (start === null) return;
    const [a, b] = [start, index].sort((x, y) => x - y);
    setSelected(selectableRows.slice(a, b + 1).map(idOfRow).filter(Boolean));
  }

  /**
   * The rows a row-action applies to.
   *
   * A selection wins over the row whose button was pressed — but only when that
   * row is IN it. Pressing Delete on an unselected row while three others are
   * selected means delete THIS one; anything else would act on records the user
   * is not pointing at.
   */
  const targetsFor = (row: Row): string[] => {
    const id = idOfRow(row);
    return selected.length > 1 && selected.includes(id) ? selected : [id];
  };

  const selectedRows = () => data.rows.filter((r) => selected.includes(idOfRow(r)));


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
    queryKey: ["wvdb", db, "linkcands", data.table, idwell, parentIdrec, linkTables.join(",")],
    enabled: linkTables.length > 0,
    queryFn: async () => {
      const out: Record<string, { idrec: string; caption: string }[]> = {};
      for (const t of linkTables) {
        // Every row in this folder hangs off the same parent, so the folder's
        // parent is the scope a sibling link is confined to.
        try {
          out[t] = (await wvDbApi.linkCandidates(db, t, idwell, data.table, parentIdrec)).candidates;
        } catch { out[t] = []; }
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

  /**
   * Duplicate — but ask what comes with it first.
   *
   * §3.11: "a window allows you to choose the child tables that you want to
   * copy." Duplicating a casing string used to drag 222 tally rows with no way
   * to say no.
   */
  function duplicate(row: Row) {
    if (singleRecord) {
      onStatus("A well has exactly one header record — create a new well from the Well Explorer instead.");
      return;
    }
    const idrec = String(row.IDRec ?? "");
    if (!idrec) return;
    setChoosing({
      table: data.table, idrec, caption: recordCaption(row), verb: "Duplicate", paste: false,
    });
  }

  async function runCopy(childTables: string[]) {
    const c = choosing;
    if (!c) return;
    setChoosing(null);
    setBusy(true);
    try {
      const res = await wvDbApi.copyRecord(db, c.table, c.idrec, {
        ...(c.paste ? { idwell, ...(parentIdrec ? { parent: parentIdrec } : {}) } : {}),
        childTables,
        // §3.11 "Each new record has the word *COPY* in its name."
        mark: true,
      });
      onSaved();
      const kids = res.copied - 1;
      onStatus(`${c.paste ? `Pasted "${c.caption}"` : "Record duplicated"} — `
        + `${res.copied} record${res.copied === 1 ? "" : "s"} copied`
        + (kids > 0 ? ` (${kids} from subfolders).` : " (the record alone).")
        // Marked, or honestly not: 78 of the 229 tables that declare a record
        // name are named by a date or a depth, which cannot hold a word.
        + (res.markedColumn
          ? " The new record is marked *COPY*."
          : " Its name is not a text field, so it could not be marked *COPY*."));
    } catch (e) {
      onStatus(`${c.verb} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Paste Record — the same choice as Duplicate, since it is the same copy. */
  function pasteRecord() {
    if (!clipboard) return;
    setChoosing({
      table: clipboard.table, idrec: clipboard.idrec,
      caption: clipboard.caption, verb: "Paste", paste: true,
    });
  }

  /**
   * PASTE INTO CURRENT RECORD (§3.11).
   *
   * "To paste into an existing record, select the record and choose Paste into
   * Current Record." The record keeps its IDRec, so everything pointing at it
   * goes on pointing at it — which is exactly what the workaround this replaces
   * (paste new, delete old) breaks.
   *
   * Confirmed first, because it overwrites a record that already holds data and
   * there is no undo. The confirmation names the record being overwritten and
   * the one it is taking its values from; "are you sure?" over two unnamed
   * records is not a question anybody can answer.
   */
  async function pasteIntoRecord(row: Row) {
    if (!clipboard) return;
    const idrec = String(row.IDRec ?? "");
    if (!idrec) return;
    if (idrec === clipboard.idrec) {
      onStatus("That is the record on the clipboard — a record cannot be pasted into itself.");
      return;
    }
    const ok = window.confirm(
      `Replace the field values of "${recordCaption(row)}" with those of "${clipboard.caption}"?\n\n`
      + "The record keeps its own place in the folder and everything linked to it stays linked. "
      + "Records in its subfolders are not touched.\n\nThis cannot be undone.");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await wvDbApi.pasteIntoRecord(db, data.table, idrec, clipboard.idrec);
      setEdits({});
      onSaved();
      onStatus(`Pasted "${clipboard.caption}" into this record — ${res.fields} fields replaced. `
        + "Its subfolder records are unchanged."
        + (res.skipped.length
          // A link GUID means nothing on another well; say which ones stood.
          ? ` ${res.skipped.length} link${res.skipped.length === 1 ? "" : "s"} kept their own `
            + `value (${res.skipped.map((x) => x.label).join(", ")}) — they point at records on `
            + "the well the copy came from."
          : ""));
    } catch (e) {
      onStatus(`Paste into record failed: ${e instanceof Error ? e.message : String(e)}`);
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
  /**
   * Delete — one record, or every selected one.
   *
   * 9.0's own enhancement list: "You can select multiple records when deleting
   * as well as copying and pasting." So the preflight runs for EVERY target
   * before anything is deleted, and the confirmation states the whole cost. A
   * per-record prompt for a fifty-row selection is not a safeguard, it is a
   * way of getting the safeguard dismissed.
   *
   * If ANY target is still referenced the whole delete is refused. A partial
   * delete leaves the user having confirmed one number and received another.
   */
  async function remove(row: Row) {
    const targets = targetsFor(row).filter(Boolean);
    if (!targets.length) return;
    setBusy(true);
    try {
      const pres = [];
      for (const id of targets) pres.push({ id, pre: await wvDbApi.deletePreflight(db, data.table, id) });

      const blocked = pres.filter((p) => !p.pre.canDelete);
      if (blocked.length) {
        const held = blocked[0].pre.referencedBy
          .map((r) => `${r.count} ${r.label} (${r.column})`)
          .join(", ");
        onStatus(targets.length === 1
          ? `Not deleted — this record is still linked from ${held}. `
            + "Clear those links first, then delete it."
          : `Not deleted — ${blocked.length} of the ${targets.length} selected records `
            + `are still linked from other folders. Nothing was deleted.`);
        return;
      }

      // One tally over the whole selection, so the number confirmed is the
      // number that happens.
      const total = pres.reduce((n, p) => n + p.pre.records, 0);
      const kids = new Map<string, number>();
      for (const p of pres) {
        for (const c of p.pre.children) kids.set(c.label, (kids.get(c.label) ?? 0) + c.count);
      }
      const lines = kids.size
        ? [...kids].map(([label, count]) => `  • ${count} ${label}`).join("\n")
        : "  • nothing in its subfolders";
      const head = targets.length === 1
        ? "Delete this record and everything under it?"
        : `Delete ${targets.length} selected records and everything under them?`;
      const ok = window.confirm(
        `${head}\n\n${lines}\n\n${total} record${total === 1 ? "" : "s"} in total. This cannot be undone.`);
      if (!ok) return;

      let removed = 0;
      for (const id of targets) removed += (await wvDbApi.remove(db, data.table, id)).removed;
      setSelected([]);
      onSaved();
      onStatus(`Deleted ${removed} record${removed === 1 ? "" : "s"} (including subfolders).`);
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
  /**
   * Reordering needs the WHOLE folder, and a truncated read is not it.
   *
   * The route renumbers from the list it is given, so sending the first 500 of
   * 2,389 would write sequence 1..500 over records that are not the first 500
   * of anything — silently rearranging a string. Refused in the UI rather than
   * left to fail at the server, so the button explains instead of erroring.
   *
   * No folder in either shipped database reaches this: the largest sequenced
   * one is wvCasCompTally at 222. It is guarded because the two folders that DO
   * exceed the cap could as easily have been sequenced.
   */
  async function reorder(order: string[], what: string) {
    /*
     * A find shows PART of the folder, and part of a folder cannot be
     * renumbered: the order sent would name the matches only, and the records
     * filtered out would keep sequence numbers belonging to positions that no
     * longer exist. The server refuses a partial order for the same reason;
     * this says so before the call rather than after it.
     */
    if (find) {
      onStatus(`Not reordered — only the ${data.rows.length} records matching "${find}" are shown. `
        + "Clear the find first: reordering part of a folder would renumber the wrong records.");
      return;
    }
    if (data.truncated) {
      onStatus(`Not reordered — this folder holds ${data.total} records and only the `
        + `first ${data.rows.length} are loaded. Reordering part of a folder would renumber `
        + "the wrong records.");
      return;
    }
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
  /**
   * Insert Records (§3.9): "When you are working with a string component or a
   * tally, you can insert new records instead of adding them to the end of the
   * list. To insert a record above the current record, select the existing
   * record and click the button."
   *
   * Select-then-click is the guide's own gesture, and the selection it needs is
   * the one already built for multi-delete and Copy Selected Data. The record
   * is created blank and immediately: there is nowhere for a ghost row to sit
   * in the middle of a folder, and the position is the point of the command.
   *
   * The guide's own warning is passed on rather than paraphrased — renumbering
   * a string is visible on the schematic straight away.
   */
  async function insertAbove() {
    /*
     * AS MANY ROWS AS ARE SELECTED, above the topmost of them.
     *
     * 9.0: "A new Insert command allows you to add ONE OR MORE rows above the
     * current row in a sequenced table." The same chapter frames this grid as
     * Excel's — "Moving between records and fields is similar to working in
     * Microsoft Excel" — where selecting three rows and inserting gives three.
     */
    const chosen = data.rows
      .map((r, i) => ({ id: String(r.IDRec ?? ""), i }))
      .filter((x) => selected.includes(x.id));
    if (!chosen.length) return;
    const target = chosen[0].id;
    const at = chosen[0].i;
    const count = chosen.length;
    setBusy(true);
    try {
      // Pending edits first: this re-reads the folder, and anything unsaved
      // would be reconciled against rows that had moved.
      if (dirtyCount > 0 && !(await saveAll())) return;
      const res = await wvDbApi.insert(db, data.table, {
        idwell, ...(parentIdrec ? { parent: parentIdrec } : {}),
        values: {}, insertBefore: target, insertCount: count,
      });
      setSelected([]);
      onSaved();
      const made = res.inserted ?? 1;
      onStatus(`${made} blank record${made === 1 ? "" : "s"} inserted above record ${at + 1} — `
        + `the records below moved down ${made === 1 ? "one" : `${made} places`}. `
        + "This changes how strings and tally information draw on the schematic."
        // Rows the user did not edit were written, so the user is told.
        + (res.renumbered
          ? ` This folder's ${res.renumbered} records had no sequence numbers at all; `
            + "they have been numbered in the order they were already in, so that a record can be "
            + "placed among them."
          : ""));
    } catch (e) {
      onStatus(`Insert failed: ${e instanceof Error ? e.message : String(e)}`);
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
    // §3.11 Copy Selected Data: a selection narrows what is copied. With none,
    // the whole folder — which is what Copy Data has always meant.
    const source = selected.length ? selectedRows() : data.rows;
    const body = source.map((r) => {
      const k = keyOf(r);
      return cols.map((c) => {
        const v = k ? valueOf(r, k, c.column) : String(r[c.column] ?? "");
        // A record link shows its caption on screen; a 32-hex GUID in the
        // spreadsheet is not the same information, it is no information.
        return c.link && v ? captionOfLink(v) ?? v : v;
      }).join("\t");
    }).join("\n");
    void navigator.clipboard.writeText(`${head}\n${body}`).then(
      () => onStatus(selected.length
        ? `Copied ${source.length} selected record${source.length === 1 ? "" : "s"} to the clipboard, headings included.`
        : find
          // A find copies the MATCHES, and the message has to say so — the
          // spreadsheet that comes out is not the folder.
          ? `Copied ${data.rows.length}${data.truncated ? ` of the ${data.total}` : ""} `
            + `record${data.rows.length === 1 ? "" : "s"} matching "${find}" to the clipboard, `
            + `headings included — not the other ${(data.folderTotal ?? 0) - data.rows.length} in this folder.`
          : data.truncated
            ? `Copied the first ${data.rows.length} of ${data.total} records to the clipboard, `
              + "headings included — the folder is larger than one read."
            : `Copied ${data.rows.length} record${data.rows.length === 1 ? "" : "s"} to the clipboard, headings included.`),
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
    /*
     * The CALCULATED columns are looked up too, not just the stored ones.
     *
     * Missing them meant a value rendered raw under a converted heading: a
     * contractor's Score/Max printed 0.7 in a column headed "(%)", which reads
     * as seven tenths of one per cent. The heading was converted because it is
     * built from the column metadata; the value was not because the metadata
     * was never found.
     */
    const c = data.columns.find((x) => x.column === col)
      ?? data.computedColumns?.find((x) => x.column === col);
    // A list-valued calculated field converts item by item — the unit is on the
    // ITEM, because a one-item list is a bare number a column unit would
    // convert twice.
    if (Array.isArray(raw)) {
      return formatUnitList(raw, { unit: c?.itemUnit, units: c?.itemUnits }, unitSet);
    }
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
    /*
     * CTRL+F2 — "Looking up Database Entries", and it works on any free-text
     * field, not only the ones with a library behind them.
     *
     * The guide: "To view all entries that have been previously entered into a
     * field, press Ctrl + F2. The database lookup list is not well specific; it
     * contains all of the entries in the database for a specific field." That
     * is a different thing from the approved library — it is what people have
     * actually typed, offered so the next person types the same.
     *
     * 603 free-text fields have no lookup of any kind today. The route that
     * serves them already exists and already ignores idwell, which is exactly
     * the "not well specific" the guide describes; only this gate was shut.
     *
     * Refused on anything a value cannot be stored into or chosen for: a
     * calculated field is green and read-only, a key or TK column is identity,
     * and a link column has its own record picker.
     */
    const canDbLookup = (c.type === "string" || c.type === "stringlong")
      && !c.calculated && !c.id && !c.system
      && !/^idrec/i.test(c.column) && !/tk$/i.test(c.column) && !c.link;
    const listId = seeded ? `wv-lu-${data.table}-${c.column}` : undefined;
    const open = (hasLookup || canDbLookup)
      && popover?.key === (key ?? "__ghost__") && popover.col === c.column;

    /*
     * A LONG TEXT FIELD GETS A TEXTAREA, and this is data loss, not comfort.
     *
     * An <input type=text> does not merely hide the rest of a long value — the
     * HTML value-sanitization algorithm STRIPS carriage returns and line feeds
     * from it. Measured in Chromium: "line one\r\nline two\nline three" comes
     * back out of an input as "line oneline twoline three". So opening one of
     * these cells and typing a single character welds the paragraphs together,
     * and saveAll writes the flattened string back over the original.
     *
     * 869 stored values across 24 columns contain a newline; 563 of them are
     * wvJobReportTimeLog.Com, the most-edited folder in the product. The
     * longest value in the sample is 1,819 characters.
     *
     * Driven by the model's own `stringlong`, which 165 fields declare — and by
     * the DECLARED LENGTH, which is 9.0's own rule for this: "Text fields that
     * are 100 characters or more can now function as a comments field that
     * opens to a larger edit window" (Edit Data Enhancements). The model states
     * that length as `physicalsize` and the data-model builder used to drop it,
     * so nothing here could tell a 10-character code from a 255-character note.
     *
     * That rule is not decoration, it closes the last hole in this one. Of the
     * 25 columns in the sample database holding a value with a newline in it,
     * 24 are `stringlong`; the twenty-fifth is wvProblem.actiontaken — a
     * `string` of 255, "What actions were taken to remedy the problem" — whose
     * single multi-line value an <input> would have flattened.
     *
     * 214 string fields are 100 or more. Still NOT all 2,031: a 50-character
     * name in a textarea would make horizontal mode unreadable for no gain.
     *
     * The guide corroborates the shape: its Edit Data shortcut list binds
     * Ctrl+Tab to "Insert an indent (extra spaces) in a comments field", which
     * only means anything in a multi-line editor.
     */
    if (isCommentsField(c)) {
      return (
        <textarea
          rows={1}
          value={val}
          /*
           * THE ONLY FIELDS WORTH SPELL-CHECKING.
           *
           * The guide describes a field-level, on-demand spell check with
           * Ignore and Change — which is what a browser already gives, from a
           * dictionary the user can extend. WellView shipped its own word list
           * (Peloton.Dictionary.dct) and this app deliberately does not use it:
           * it is licensed for distribution only with the C1SpellChecker
           * component, and measured against this database's own free text it
           * would flag 12.9% of words, almost all of them correct — tbg, rih,
           * csg, jts, bha, toh, mkb, kPa, Schlumberger, Cardium.
           *
           * The browser's dictionary has the same blind spot, and until now the
           * app never said anything about spellcheck, so it ran on every cell
           * by default — including the ones holding "S", "6" and
           * "100/04-14-018-25W4/00". It is switched on HERE, where prose
           * actually lives, and off everywhere else.
           */
          spellCheck
          placeholder={isGhost ? "new…" : undefined}
          onFocus={(e) => { focusHelp(c); e.currentTarget.rows = 6; }}
          onBlur={(e) => { e.currentTarget.rows = 1; }}
          onChange={(e) => {
            if (isGhost) setGhostValue(c.column, e.target.value);
            else setValue(key!, c.column, e.target.value);
          }}
          data-testid="wv-cell-long"
          className={`w-full min-w-[7rem] px-1.5 py-0.5 text-[11px] border rounded resize-y
            focus:bg-white focus:border-blue-400 focus:outline-none ${
              fieldTone(c, val)
            } ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
      );
    }

    /*
     * `relative` whenever a popover CAN open here, not only when the field
     * carries a library. The popover is positioned `absolute top-full`, so
     * without a positioned ancestor it resolves against the page and lands at
     * the top-left corner of the document instead of under the cell.
     */
    return (
      <div className={hasLookup || canDbLookup ? "relative flex items-center" : undefined}>
        <input
          value={approved ? showListValue(c, val) : val}
          list={listId}
          /*
           * Not prose: a code, a grade, a serial, a well identifier. 2,031 of
           * the model's fields are this shape and squiggling them is noise.
           * See the stringlong branch above for the whole reasoning.
           */
          spellCheck={false}
          placeholder={isGhost ? "new…" : undefined}
          onFocus={() => focusHelp(c)}
          onKeyDown={(e) => {
            // The guide's own binding. Unclaimed by the browser, and the only
            // keystroke this grid listens for besides Escape.
            if (canDbLookup && e.ctrlKey && e.key === "F2") {
              e.preventDefault();
              setPopover(open ? null : { key: key ?? "__ghost__", col: c.column });
            }
          }}
          onChange={(e) => {
            const v = approved ? storeListValue(c, e.target.value) : e.target.value;
            if (isGhost) setGhostValue(c.column, v); else setValue(key!, c.column, v);
          }}
          className={`w-full min-w-[7rem] px-1.5 py-0.5 text-[11px] border rounded
            focus:bg-white focus:border-blue-400 focus:outline-none ${
              fieldTone(c, val)
            } ${isGhost ? "italic text-gray-600" : "text-gray-900"}`}
        />
        {(hasLookup || canDbLookup) && (
          <>
            {/* Table 3-6 item J: the ellipsis button marks a lookup list. It
                stays on the fields that HAVE one — a free-text field reached by
                Ctrl+F2 gets no permanent affordance, because offering values in
                use as though they were a list would blur the two. */}
            {hasLookup && (
              <button type="button" tabIndex={-1} data-testid="wv-lookup-button"
                title={approved
                  ? "Approved values, from WellView’s own data model."
                  : c.library
                    ? `Library field — ${c.library.table}. The approved list is not readable here; this offers the values in use.`
                    : "Lookup list"}
                onClick={() => setPopover(open ? null : { key: key ?? "__ghost__", col: c.column })}
                className={`shrink-0 px-1 text-[10px] hover:text-blue-600 ${
                  c.library ? "text-blue-400" : "text-gray-400"}`}>…</button>
            )}
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

  const canPaste = clipboard && clipboard.db === db
    && clipboard.table.toLowerCase() === data.table.toLowerCase() && !singleRecord;

  const rowActions = (row: Row, index?: number) => {
    const idrec = String(row.IDRec ?? "");
    return (
      <div className="flex gap-1 px-1">
        {ordered && index !== undefined && (
          <>
            <button type="button"
              title={find ? "Clear the find to reorder — only the matching records are shown" : "Move up"}
              disabled={busy || index === 0 || !!find}
              onClick={() => moveRow(index, -1)}
              className="text-gray-400 hover:text-blue-600 text-[11px] disabled:opacity-25">▲</button>
            <button type="button"
              title={find ? "Clear the find to reorder — only the matching records are shown" : "Move down"}
              disabled={busy || index === data.rows.length - 1 || !!find}
              onClick={() => moveRow(index, 1)}
              className="text-gray-400 hover:text-blue-600 text-[11px] disabled:opacity-25">▼</button>
          </>
        )}
        <button type="button" title="Copy Record — paste into this folder on any well, choosing which subfolders travel" disabled={busy || !idrec}
          onClick={() => {
            onClipboard({ db, table: data.table, idrec, caption: recordCaption(row), label: data.label });
            onStatus(`Copied "${recordCaption(row)}" — open the same folder anywhere and Paste Record.`);
          }}
          className="text-gray-400 hover:text-blue-600 text-[11px]">⎘</button>
        <button type="button" title="Duplicate Record — choose which subfolders come with it" disabled={busy}
          data-testid="wv-row-duplicate"
          onClick={() => void duplicate(row)}
          className="text-gray-400 hover:text-blue-600 text-[11px]">⧉</button>
        {canPaste && clipboard!.idrec !== idrec && (
          <button type="button" data-testid="wv-row-paste-into" disabled={busy}
            title={`Paste into Current Record — replace this record's fields with those of `
              + `"${clipboard!.caption}", keeping its IDRec, its place in the folder and `
              + "everything linked to it"}
            onClick={() => void pasteIntoRecord(row)}
            className="text-gray-400 hover:text-blue-600 text-[11px]">⇲</button>
        )}
        <button type="button" title="Delete Record (subfolder records go with it)" disabled={busy}
          onClick={() => void remove(row)}
          className="text-gray-400 hover:text-red-600 text-[11px]">✕</button>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-xs font-semibold text-gray-800" title={data.help}>{data.label}</span>
        <span className="text-[10px] text-gray-400 font-mono">{data.table}</span>
        {/*
          * The count says what is HERE, and admits when that is not all of it.
          * The report path next door has always been honest about this —
          * "first N of M rows" — and a folder is no different.
          */}
        {/*
          * The count says what is HERE, and with a find running that is TWO
          * numbers, not one: the matches, and the folder they were found in.
          * "9 records" on a filtered 629-row folder is a false statement about
          * the folder.
          */}
        <span className={`text-[10px] tabular-nums ${data.truncated ? "text-amber-700" : "text-gray-400"}`}
          data-testid="wv-edit-count"
          title={data.truncated
            ? `${find ? `${data.total} records match this find` : `This folder holds ${data.total} records`}. `
              + `The first ${data.rows.length} are shown; editing, copying and reordering apply to those.`
            : find
              ? "Find matches the values as they are STORED. A depth held in metres "
                + "will not match a number typed in feet."
              : undefined}>
          {find
            ? (data.truncated
              ? `first ${data.rows.length} of ${data.total} matches, in ${data.folderTotal ?? data.total} records`
              : `${data.rows.length} of ${data.folderTotal ?? data.rows.length} record${(data.folderTotal ?? 0) === 1 ? "" : "s"} match`)
            : data.truncated
              ? `first ${data.rows.length} of ${data.total} records`
              : `${data.rows.length} record${data.rows.length === 1 ? "" : "s"}`}
        </span>
        {carriedCount > 0 && !singleRecord && (
          // The new row arrives pre-filled; say so, or a carried value reads as
          // something the user typed and forgot.
          <span className="text-[10px] text-blue-500" title="§5 Set up Day Two — the model says which fields inherit, and which of them step">
            new row carries {carriedCount} field{carriedCount === 1 ? "" : "s"} forward
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {/*
            * §3.9 Finding Data: "To find data, enter the data in the Find box in
            * the toolbar and click the button."
            *
            * Enter does it too — a search box that only answers to a mouse is a
            * search box nobody uses. The term is applied on submit rather than
            * per keystroke because applying it saves any pending edit first, and
            * saving on every letter typed is not a trade worth making.
            */}
          {!singleRecord && (
            <form className="flex items-center gap-1"
              onSubmit={(e) => { e.preventDefault(); onFind(findDraft.trim()); }}>
              <input type="search" value={findDraft} spellCheck={false}
                data-testid="wv-edit-find"
                onChange={(e) => setFindDraft(e.target.value)}
                placeholder="Find"
                title="Find (§3.9) — show only the records in this folder holding this text. Searches every field of every record, not only the ones loaded."
                className="h-7 w-28 px-2 text-[11px] rounded border border-gray-300 focus:border-blue-400 focus:outline-none" />
              <button type="submit" disabled={findDraft.trim() === find}
                className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Find
              </button>
              {find && (
                <button type="button" data-testid="wv-edit-find-clear"
                  onClick={() => { setFindDraft(""); onFind(""); }}
                  title={`Showing only records matching "${find}" — clear to see the whole folder`}
                  className="h-7 px-2 text-[11px] rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
                  Clear
                </button>
              )}
            </form>
          )}
          {/* §3.11 Field Information — the database names and types behind the
              captions. Enabled even on an empty folder: it describes the FIELDS,
              which exist whether or not any record does. */}
          {/*
            * §3.11 "To select all the records in a folder, choose Select All
            * Records from the Tools menu. To cancel the selected records,
            * choose Deselect Records." Ctrl+A does the first, per the shortcut
            * table, scoped to this grid.
            *
            * The label counts what would ACTUALLY be selected. A folder larger
            * than one read holds 500 of its rows here, and "Select all" on a
            * 2,389-row folder that then deletes 500 would be a lie told by a
            * button.
            */}
          {!singleRecord && data.rows.length > 0 && (
            <button type="button" data-testid="wv-edit-selectall"
              onClick={() => (selected.length
                ? setSelected([])
                : setSelected(data.rows.map((r) => String(r.IDRec ?? "")).filter(Boolean)))}
              title={find
                ? `Select the ${data.rows.length} shown — ${data.total} of this folder's `
                  + `${data.folderTotal ?? data.total} records match "${find}"`
                : data.truncated
                  ? `Select the ${data.rows.length} records loaded here — the folder holds ${data.total}`
                  : "Select All Records (Ctrl+A)"}
              className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
              {selected.length
                ? `Deselect (${selected.length})`
                : data.truncated ? `Select ${data.rows.length} loaded` : "Select all"}
            </button>
          )}
          <button type="button" onClick={() => setFieldInfo(true)} data-testid="wv-edit-fieldinfo"
            title="Field Information — the database name, type and unit of every field in this folder"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Fields
          </button>
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
              title={`Paste as New Record — add "${clipboard!.caption}" to this folder as a new `
                + "record, choosing which subfolders travel. It is marked *COPY*."}
              className="h-7 px-2 text-[11px] rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-40">
              {/* §3.11 names two paste commands and they do different things. */}
              Paste as New
            </button>
          )}
          {ordered && (
            <button type="button" data-testid="wv-edit-insert"
              disabled={busy || selected.length === 0 || !!find || data.rows.length === 0}
              onClick={() => void insertAbove()}
              title={find
                ? "Clear the find to insert — a new record is blank, so it would not match it"
                : selected.length === 1
                  ? "Insert Records (§3.9) — a new blank record ABOVE the selected one. "
                    + "This can change how strings and tallies draw on the schematic."
                  : selected.length
                    // "one or more rows above the current row" — as many as are
                    // selected, the way a spreadsheet does it.
                    ? `Insert Records — ${selected.length} blank records above the first of the `
                      + `${selected.length} selected`
                    : "Insert Records — click a record number to select it, and the new record goes above it"}
              className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              {selected.length > 1 ? `Insert ${selected.length}` : "Insert"}
            </button>
          )}
          {ordered && data.allowInsertTop && (
            <button type="button" disabled={busy || data.rows.length < 2 || !!find}
              onClick={() => void reorder([...ids()].reverse(), "Newest record put at the top")}
              title="Add Records to Top — number the list from the bottom up, so the newest record is first"
              className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Records to Top
            </button>
          )}
          {ordered && data.allowSeqInvert && (
            <button type="button" disabled={busy || data.rows.length < 2 || !!find}
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
                  /* "To select one record, click the record number column in
                     vertical or horizontal view" — the number cell IS the hit
                     target, in both modes. */
                  <td key={i}
                    className={`px-2 py-1 border-b border-l border-gray-200 text-center ${
                      selected.includes(String(r.IDRec ?? "")) ? "bg-blue-100" : ""}`}>
                    {/*
                      * THE NUMBER is the hit target, not the cell. The cell also
                      * holds Copy, Duplicate and Delete, and a click anywhere in
                      * it would land on whichever of those it hit — selecting by
                      * clicking a row can never be allowed to duplicate it.
                      */}
                    <span data-testid="wv-rownum" role="button" tabIndex={-1}
                      onMouseDown={(e) => { dragging.current = true; clickRow(r, e, i); }}
                      onMouseEnter={() => dragOver(i)}
                      onMouseUp={() => { dragging.current = false; }}
                      title="Click to select; Shift for a range, Ctrl to add"
                      className={`inline-block px-1 select-none cursor-pointer rounded ${
                        selected.includes(String(r.IDRec ?? ""))
                          ? "text-blue-900 font-medium" : "text-gray-400 hover:bg-gray-200"}`}>
                      #{i + 1}
                    </span>
                    {rowActions(r, i)}
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
                    {c.unit && (
                      /* Peloton's own words for the unit, which ship in the
                         vendor table and were never shown. "ft³/sack" is
                         "Cubic feet per 100 pound sack" — the distinction that
                         once made every cement volume 6.383% wrong. */
                      <span className="ml-1 font-normal text-gray-400"
                        title={unitDescription(displayUnitLabel(c, unitSet, datumShift)) ?? undefined}>
                        ({displayUnitLabel(c, unitSet, datumShift)})
                      </span>
                    )}
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
                {/*
                  * The corner cell must out-stack the sticky header row it sits
                  * in (z-10 above), or the frozen gutter scrolls under the
                  * headings instead of over the rows.
                  */}
                <th className="px-1 py-1 border-b border-gray-200 w-16 sticky left-0 z-20 bg-gray-100" />
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
                    {c.unit && (
                      /* Peloton's own words for the unit, which ship in the
                         vendor table and were never shown. "ft³/sack" is
                         "Cubic feet per 100 pound sack" — the distinction that
                         once made every cement volume 6.383% wrong. */
                      <span className="ml-1 font-normal text-gray-400"
                        title={unitDescription(displayUnitLabel(c, unitSet, datumShift)) ?? undefined}>
                        ({displayUnitLabel(c, unitSet, datumShift)})
                      </span>
                    )}
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
                    {/*
                      * RECORD NUMBERS AND A FROZEN GUTTER, which 1.012 lists as
                      * two of 9.0's Edit Data enhancements: "When you scroll
                      * right or down through records, the first column or row is
                      * frozen" and "Each record is assigned a number."
                      *
                      * Vertical mode has had both all along; horizontal — the
                      * DEFAULT mode — had neither, so scrolling a 105-column
                      * well header sideways left nothing to say which record a
                      * row was. The number is also the guide's own selection hit
                      * target ("To select one record, click the record number
                      * column"), so it has to exist before selection can.
                      *
                      * The stripe is repeated on the cell because it is set on
                      * the <tr>, and a sticky child needs its own opaque
                      * background or the scrolled rows show through it.
                      */}
                    <td className={`align-middle sticky left-0 z-10 whitespace-nowrap ${
                      selected.includes(k ?? "")
                        ? "bg-blue-100"
                        : k && k === focusRecord ? "bg-amber-50" : i % 2 ? "bg-gray-50" : "bg-white"}`}>
                      {/* The number alone selects — the row actions share this
                          cell, and a click that hit Duplicate instead would be
                          a destructive surprise. */}
                      <span data-testid="wv-rownum" role="button" tabIndex={-1}
                        onMouseDown={(e) => { dragging.current = true; clickRow(r, e, i); }}
                        onMouseEnter={() => dragOver(i)}
                        onMouseUp={() => { dragging.current = false; }}
                        title="Click to select; Shift for a range, Ctrl to add"
                        className={`tabular-nums pl-1 pr-0.5 select-none cursor-pointer rounded ${
                          selected.includes(k ?? "")
                            ? "text-blue-900 font-medium" : "text-gray-400 hover:bg-gray-200"}`}>
                        {i + 1}
                      </span>
                      {rowActions(r, i)}
                    </td>
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

      {choosing && (
        <CopyChooser
          db={db} table={choosing.table} idrec={choosing.idrec}
          caption={choosing.caption} verb={choosing.verb}
          onCancel={() => setChoosing(null)}
          onCopy={(childTables) => void runCopy(childTables)}
        />
      )}

      {fieldInfo && (
        <FieldInfo
          table={data.table}
          columns={data.columns}
          computed={data.computedColumns ?? []}
          unitSet={unitSet}
          datumShift={datumShift}
          onStatus={onStatus}
          onClose={() => setFieldInfo(false)}
        />
      )}

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
/**
 * Field Information (§3.11) — what every field in this folder actually IS.
 *
 * The guide: "The Field Information command allows you to view the database
 * names and type of data for all the fields in a folder. You can also copy this
 * information to the Clipboard and paste it into a different application. Note:
 * This command is usually used by application administrators."
 *
 * Every column here already travels with the folder — the /records payload has
 * carried column, label, type, unit, group, help, calculated, required and the
 * carry-forward flags since it was written. Nothing is fetched; this is a
 * rendering of what the grid already holds, which is why it can list the
 * calculated fields beside the stored ones and say which is which.
 *
 * The database NAME is the point of it. Everywhere else in this app a field is
 * its caption; an administrator writing a query or reading a report definition
 * needs `wvJobDrillString.BitNo`, and this is the only screen that gives it.
 */
function FieldInfo({ table, columns, computed, unitSet, datumShift, onClose, onStatus }: {
  table: string;
  columns: WvRecordColumn[];
  computed: WvRecordColumn[];
  unitSet: string;
  datumShift?: DatumShift | null;
  onClose: () => void;
  onStatus: (s: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const all = [
      ...columns.map((c) => ({ c, kind: "stored" as const })),
      ...computed.map((c) => ({ c, kind: "computed" as const })),
    ];
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter(({ c }) =>
      c.column.toLowerCase().includes(q)
      || (c.label ?? "").toLowerCase().includes(q)
      || (c.group ?? "").toLowerCase().includes(q));
  }, [columns, computed, filter]);

  /** The flags the desktop colours a cell for, named rather than coloured. */
  const notesOf = (c: WvRecordColumn, kind: "stored" | "computed") => {
    const out: string[] = [];
    /*
     * The identity columns carry no type, unit or section because the model
     * does not describe them — they are WellView's own plumbing, not user
     * fields. Saying so is the difference between "this row has no metadata"
     * and "we failed to find any": an administrator reading this screen to
     * write a query needs to know idwell and IDRecParent are exactly what they
     * look like.
     */
    if (c.id) out.push("key");
    if (c.system) out.push("system");
    if (c.tk) out.push("link target table");
    if (kind === "computed" || c.calculated) out.push("calculated");
    if (c.required) out.push("required");
    if (c.globalMetric) out.push("global metric");
    if (c.carryForward) {
      out.push(c.carryForwardIncrement
        ? `carried forward +${c.carryForwardIncrement}`
        : "carried forward");
    }
    if (c.library) out.push(`library: ${c.library.table}`);
    if (c.modelList) out.push("approved list");
    if (c.link) out.push("record link");
    if (c.hiddenByDefault) out.push("hidden by default");
    return out;
  };

  const HEAD = ["Database name", "Caption", "Type", "Unit", "Section", "Notes"];
  const asRow = ({ c, kind }: { c: WvRecordColumn; kind: "stored" | "computed" }) => [
    `${table}.${c.column}`,
    c.label ?? "",
    kind === "computed" ? `${c.type ?? "double"} (computed)` : c.type ?? "",
    c.unit ? displayUnitLabel(c, unitSet, datumShift) : "",
    c.group ?? "",
    notesOf(c, kind).join("; "),
  ];

  const copy = () => {
    // The guide's own second half: "copy this information to the Clipboard and
    // paste it into a different application." Tab-separated, headings included,
    // the same shape Copy Data already uses.
    const text = [HEAD.join("\t"), ...rows.map((r) => asRow(r).join("\t"))].join("\n");
    void navigator.clipboard.writeText(text).then(
      () => onStatus(`Copied ${rows.length} field${rows.length === 1 ? "" : "s"} to the clipboard, headings included.`),
      () => onStatus("The browser refused clipboard access."),
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/30 grid place-items-center p-4"
      data-testid="wv-fieldinfo-dialog" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Field Information</h2>
          <code className="text-[11px] text-gray-500">{table}</code>
          <input value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="filter…" spellCheck={false} data-testid="wv-fieldinfo-filter"
            className="ml-auto h-7 w-40 border border-gray-300 rounded px-2 text-[11px]" />
          <button type="button" onClick={copy} data-testid="wv-fieldinfo-copy"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Copy
          </button>
          <button type="button" onClick={onClose} data-testid="wv-fieldinfo-close"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Close
          </button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-gray-100 text-gray-600">
              <tr>
                {HEAD.map((h) => (
                  <th key={h} className="text-left font-medium px-2 py-1 border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, kind }, i) => (
                <tr key={`${kind}-${c.column}`} className={i % 2 ? "bg-gray-50" : ""}
                  data-testid="wv-fieldinfo-row">
                  {/* The database name, which is the whole reason this screen
                      exists — every other screen shows the caption. */}
                  <td className="px-2 py-0.5 font-mono text-gray-800 whitespace-nowrap">
                    {table}.{c.column}
                  </td>
                  <td className={`px-2 py-0.5 ${kind === "computed" ? "text-green-700" : "text-gray-800"}`}>
                    {c.label}
                  </td>
                  <td className="px-2 py-0.5 text-gray-500 whitespace-nowrap">
                    {kind === "computed" ? `${c.type ?? "double"} (computed)` : c.type}
                  </td>
                  <td className="px-2 py-0.5 text-gray-500 whitespace-nowrap"
                    title={c.unit ? unitDescription(displayUnitLabel(c, unitSet, datumShift)) ?? undefined : undefined}>
                    {c.unit ? displayUnitLabel(c, unitSet, datumShift) : ""}
                  </td>
                  <td className="px-2 py-0.5 text-gray-500">{c.group ?? ""}</td>
                  <td className="px-2 py-0.5 text-gray-500">{notesOf(c, kind).join("; ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-3 text-[11px] text-gray-400">No field matches that filter.</p>
          )}
        </div>
        <div className="px-4 py-1.5 border-t border-gray-100 text-[10px] text-gray-500">
          {columns.length} stored field{columns.length === 1 ? "" : "s"}
          {computed.length > 0 && `, ${computed.length} computed`}
          {" — the unit shown is the one this folder is currently displaying."}
        </div>
      </div>
    </div>
  );
}

/**
 * §3.11 "a window allows you to choose the child tables that you want to copy".
 *
 * 9.0's What's New is explicit that this replaced the older behaviour: "In
 * WellView 8.0/8.1, when you copied a record, all the child records were
 * included in the copy… You could not exclude any child records from the copy,
 * such as the drill parameters."
 *
 * The COUNTS are what make it a decision rather than a guess. "Copy this drill
 * string without its 54 drilling parameters" can be reasoned about; "without
 * its drilling parameters" cannot. They are this record's counts, not the
 * folder's — a casing string with 222 tally rows and one with none are
 * different propositions.
 *
 * Unchecking a table disables everything beneath it, because an unchosen table
 * prunes its whole subtree: a grandchild whose parent was not copied has
 * nothing to hang off. Showing those still tickable would promise something
 * the server correctly refuses to do.
 */
function CopyChooser({ db, table, idrec, caption, verb, onCancel, onCopy }: {
  db: string;
  table: string;
  idrec: string;
  caption: string;
  /** "Duplicate" or "Copy" — the same choice serves both. */
  verb: string;
  onCancel: () => void;
  onCopy: (childTables: string[]) => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "copy-preview", table, idrec],
    queryFn: () => wvDbApi.copyPreview(db, table, idrec),
  });
  const kids = q.data?.children ?? [];
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  // Everything, until the user says otherwise — the default this replaces.
  const picked = chosen ?? new Set(kids.map((k) => k.table.toLowerCase()));

  /** A row is unavailable when any ancestor of it is unchecked. */
  const blocked = (t: { table: string; parent: string }): boolean => {
    let parent = t.parent.toLowerCase();
    for (let hop = 0; hop < 10; hop++) {
      if (parent === table.toLowerCase()) return false;
      if (!picked.has(parent)) return true;
      const up = kids.find((k) => k.table.toLowerCase() === parent);
      if (!up) return false;
      parent = up.parent.toLowerCase();
    }
    return false;
  };

  const toggle = (t: string) => {
    const next = new Set(picked);
    const lc = t.toLowerCase();
    if (next.has(lc)) next.delete(lc); else next.add(lc);
    setChosen(next);
  };

  const willCopy = kids
    .filter((k) => picked.has(k.table.toLowerCase()) && !blocked(k))
    .reduce((n, k) => n + k.count, 0);

  return (
    <div className="fixed inset-0 z-40 bg-black/30 grid place-items-center p-4"
      data-testid="wv-copy-chooser" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">{verb} record</h2>
          <p className="text-[11px] text-gray-500 truncate">{caption}</p>
        </div>
        <div className="px-4 py-2 overflow-auto">
          {q.isLoading && <p className="text-[11px] text-gray-400">Reading what it would carry…</p>}
          {!q.isLoading && kids.length === 0 && (
            <p className="text-[11px] text-gray-500">This record has no subfolders — only the record is copied.</p>
          )}
          {kids.map((k) => {
            const off = blocked(k);
            return (
              <label key={k.table}
                className={`flex items-center gap-2 py-0.5 text-[11px] ${off ? "opacity-40" : ""}`}
                style={{ paddingLeft: `${k.depth * 14}px` }}
                data-testid="wv-copy-child">
                <input type="checkbox" className="h-3.5 w-3.5"
                  checked={picked.has(k.table.toLowerCase()) && !off}
                  disabled={off}
                  onChange={() => toggle(k.table)} />
                <span className={k.count ? "text-gray-800" : "text-gray-400"}>{k.label}</span>
                <span className="text-gray-400 tabular-nums">
                  {k.count === 0 ? "none" : k.count}
                </span>
                {off && <span className="text-gray-400 italic">— its parent is not being copied</span>}
              </label>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2">
          <button type="button" onClick={() => setChosen(new Set(kids.map((k) => k.table.toLowerCase())))}
            className="text-[11px] text-blue-600 hover:underline">All</button>
          <button type="button" onClick={() => setChosen(new Set())}
            className="text-[11px] text-blue-600 hover:underline">None</button>
          <span className="text-[10px] text-gray-500 ml-2" data-testid="wv-copy-count">
            {willCopy} subfolder record{willCopy === 1 ? "" : "s"} will be copied
          </span>
          <button type="button" onClick={onCancel}
            className="ml-auto h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" data-testid="wv-copy-ok"
            onClick={() => onCopy(kids
              .filter((k) => picked.has(k.table.toLowerCase()) && !blocked(k))
              .map((k) => k.table))}
            className="h-7 px-3 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500">
            {verb}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      note={(approved
        ? "The approved values, from WellView’s own data model."
        : library
          ? `Values in use in this database. The approved library (${library.table}) ships encrypted and cannot be read here.`
          : "Values in use in this database.")
        // A list that stopped at 500 and said nothing would read as complete.
        + (!approved && q.data?.truncated ? " Showing the first 500." : "")}
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
        {/*
          * TWO DIFFERENT EMPTY STATES, and they used to share one sentence.
          *
          * "enter the linked folder first" is only true when there IS a folder
          * and it is empty. When no target table could be resolved at all,
          * `targets` is [] and `every` is vacuously true — so the message
          * appeared on sixteen columns whose folders were already full, naming
          * a cause that was false and an action that could not help.
          */}
        {!targets.length ? (
          <div className="px-2 py-1.5 text-[11px] text-amber-700">
            This app cannot tell which folder this link points at, so it has
            nothing to offer. The GUID can still be typed if you have it.
          </div>
        ) : targets.every((t) => !(cands[t] ?? []).length) ? (
          <div className="px-2 py-1.5 text-[11px] text-gray-400">
            No records yet in {targets.length === 1 ? "that folder" : "those folders"} for
            this well — {targets.join(", ")}. Enter one there first.
          </div>
        ) : null}
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
          {/* A block of spreadsheet cells — codes, numbers and identifiers. */}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            spellCheck={false}
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
