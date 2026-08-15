/**
 * The Well Explorer — WellView's opening window, as a web page (manual ch. 3).
 *
 * Left side: well folders — Recently Opened Wells (last 20, kept automatically),
 * My Wells (the user's shortcuts, up to 100), All Wells, the group folders made
 * by "Group by Properties" (up to four levels, each ascending or descending),
 * and Quick Query (§3.3): pick a well-header field, type a full or partial
 * value, refresh.
 *
 * Right side: the well list. Default columns are Well Name and API/UWI as in
 * the manual; "Well List Properties" changes the displayed columns and their
 * order. Click a heading to sort (again to reverse). Ctrl/Shift select works
 * as in any list; Copy Well List puts the visible columns on the clipboard,
 * tab-separated, headings included — pasteable straight into Excel.
 *
 * Folder shortcuts, groups and column choices persist per database in
 * localStorage — the manual's "per user, per machine" behaviour, literally.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wvDbApi, type WvHeaderColumn } from "../../entry/wellviewDb.js";

type WellRow = Record<string, string | number | null>;

interface Props {
  db: string;
  /** Open a well (double-click or Open button) into the Reports/Schematic window. */
  onOpen: (idwell: string) => void;
  /** Open the Edit Data window on a well. */
  onEdit: (idwell: string) => void;
  /** Run the Data Auditor over the selected wells. */
  onAudit: (idwells: string[]) => void;
  /** Back to the Open Database window. */
  onChangeDatabase: () => void;
}

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/blocked */ }
  },
};

type Folder =
  | { kind: "recent" }
  | { kind: "my" }
  | { kind: "all" }
  | { kind: "query" }
  | { kind: "group"; path: (string | null)[] };   // value per group level, null = any

interface GroupSpec { column: string; desc: boolean }

export function WellExplorer({ db, onOpen, onEdit, onAudit, onChangeDatabase }: Props) {
  const K = (s: string) => `wv.online.${db}.${s}`;

  const [folder, setFolder] = useState<Folder>({ kind: "all" });
  const [cols, setCols] = useState<string[]>(() => store.get(K("cols"), ["WellName", "WellIDA"]));
  const [myWells, setMyWells] = useState<string[]>(() => store.get(K("my"), []));
  const [recent, setRecent] = useState<string[]>(() => store.get(K("recent"), []));
  const [groups, setGroups] = useState<GroupSpec[]>(() => store.get(K("groups"), []));
  const [sort, setSort] = useState<{ column: string; desc: boolean } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const lastClick = useRef<number | null>(null);
  const [showListProps, setShowListProps] = useState(false);
  const [showGroupDlg, setShowGroupDlg] = useState(false);
  const [copied, setCopied] = useState(false);

  // Quick Query state — applied on Refresh, like the desktop app.
  const [lookIn, setLookIn] = useState("WellName");
  const [lookFor, setLookFor] = useState("");
  const [applied, setApplied] = useState<{ lookin: string; lookfor: string } | null>(null);

  useEffect(() => { store.set(K("cols"), cols); }, [cols]);       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("my"), myWells); }, [myWells]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("recent"), recent); }, [recent]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("groups"), groups); }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerColsQ = useQuery({
    queryKey: ["wvdb", db, "header-columns"],
    queryFn: () => wvDbApi.headerColumns(db),
    staleTime: Infinity,
  });

  // Group columns must be fetched even when not displayed.
  const fetchCols = useMemo(() => {
    const set = new Set(cols);
    for (const g of groups) set.add(g.column);
    return [...set];
  }, [cols, groups]);

  const wellsQ = useQuery({
    queryKey: ["wvdb", db, "wells", fetchCols.join(","), applied?.lookin ?? "", applied?.lookfor ?? ""],
    queryFn: () => wvDbApi.wells(db, {
      cols: fetchCols,
      ...(folder.kind === "query" && applied ? { lookin: applied.lookin, lookfor: applied.lookfor } : {}),
    }),
  });

  const allWells = useMemo(() => wellsQ.data?.wells ?? [], [wellsQ.data]);
  const columns: WvHeaderColumn[] = (wellsQ.data?.columns ?? []).filter((c) => cols.includes(c.column));

  /** The rows the active folder shows, before sorting. */
  const folderRows: WellRow[] = useMemo(() => {
    const byId = new Map(allWells.map((w) => [String(w.idwell), w]));
    switch (folder.kind) {
      case "recent":
        return recent.map((id) => byId.get(id)).filter((w): w is WellRow => !!w);
      case "my":
        return myWells.map((id) => byId.get(id)).filter((w): w is WellRow => !!w);
      case "group": {
        return allWells.filter((w) =>
          folder.path.every((v, i) => v === null || String(w[groups[i]?.column] ?? "—") === v));
      }
      default:
        return allWells;
    }
  }, [folder, allWells, recent, myWells, groups]);

  const rows = useMemo(() => {
    if (!sort) return folderRows;
    const dir = sort.desc ? -1 : 1;
    return [...folderRows].sort((a, b) => {
      const av = a[sort.column], bv = b[sort.column];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [folderRows, sort]);

  /** Group-folder tree values, computed from the data itself. */
  const groupTree = useMemo(() => {
    if (!groups.length) return null;
    type GNode = { value: string; path: (string | null)[]; count: number; children: GNode[] };
    const build = (wells: WellRow[], level: number, path: (string | null)[]): GNode[] => {
      if (level >= groups.length) return [];
      const g = groups[level];
      const byValue = new Map<string, WellRow[]>();
      for (const w of wells) {
        const v = String(w[g.column] ?? "—");
        (byValue.get(v) ?? byValue.set(v, []).get(v)!).push(w);
      }
      const entries = [...byValue.entries()].sort(([a], [b]) => a.localeCompare(b) * (g.desc ? -1 : 1));
      return entries.map(([value, ws]) => {
        const p = [...path, value];
        return { value, path: p, count: ws.length, children: build(ws, level + 1, p) };
      });
    };
    return build(allWells, 0, []);
  }, [groups, allWells]);

  const idOf = (w: WellRow) => String(w.idwell);
  const nameOf = (w: WellRow) => String(w.WellName ?? w.idwell);

  function clickRow(w: WellRow, e: React.MouseEvent, index: number) {
    const id = idOf(w);
    if (e.shiftKey && lastClick.current !== null) {
      const [a, b] = [lastClick.current, index].sort((x, y) => x - y);
      setSelected(rows.slice(a, b + 1).map(idOf));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      lastClick.current = index;
    } else {
      setSelected([id]);
      lastClick.current = index;
    }
  }

  function openWell(id: string) {
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 20));
    onOpen(id);
  }

  function copyWellList() {
    const head = columns.map((c) => c.label).join("\t");
    const body = rows.map((w) => columns.map((c) => String(w[c.column] ?? "")).join("\t")).join("\n");
    void navigator.clipboard.writeText(`${head}\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const primary = selected[0] ?? null;
  const folderBtn = (active: boolean) =>
    `w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 ${
      active ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-100"}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── toolbar (§3.1) ── */}
      <div className="flex items-center gap-1 mb-2 shrink-0 flex-wrap">
        <ToolButton label="Open" hint="Open the selected well to view reports and the schematic"
          disabled={!primary} onClick={() => primary && openWell(primary)} />
        <ToolButton label="Edit Data" hint="Open the Edit Data window to change well records"
          disabled={!primary} onClick={() => primary && onEdit(primary)} />
        <ToolButton label="Data Audit" hint="Check that fields meet the §10.2 business rules"
          onClick={() => onAudit(selected)} />
        <ToolButton label="Multi Well Reports" hint="The 30-report suite runs from the Well Reports page"
          onClick={() => { window.location.href = "/well-reports"; }} />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolButton label="Change Database" hint="Back to the Open Database window" onClick={onChangeDatabase} />
        <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
          {rows.length} well{rows.length === 1 ? "" : "s"}
          {selected.length > 1 ? ` · ${selected.length} selected` : ""}
        </span>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* ── folders ── */}
        <aside className="w-64 shrink-0 border border-gray-200 rounded-lg bg-white overflow-y-auto p-1.5">
          <button type="button" className={folderBtn(folder.kind === "recent")}
            onClick={() => setFolder({ kind: "recent" })}>
            <FolderIcon /> Recently Opened Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{recent.length}</span>
          </button>
          <button type="button" className={folderBtn(folder.kind === "my")}
            onClick={() => setFolder({ kind: "my" })}>
            <FolderIcon /> My Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{myWells.length}</span>
          </button>
          <button type="button" className={folderBtn(folder.kind === "all")}
            onClick={() => setFolder({ kind: "all" })}>
            <FolderIcon /> All Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{allWells.length}</span>
          </button>

          {/* group folders */}
          {groupTree && (
            <div className="mt-1 border-t border-gray-100 pt-1">
              <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 flex items-center">
                Grouped wells
                <button type="button" className="ml-auto text-blue-600 hover:underline normal-case"
                  onClick={() => setShowGroupDlg(true)}>edit</button>
              </div>
              <GroupFolders nodes={groupTree} depth={0}
                active={folder.kind === "group" ? folder.path : null}
                onPick={(path) => setFolder({ kind: "group", path })} />
            </div>
          )}
          {!groupTree && (
            <button type="button" className="w-full text-left px-2 py-1 rounded text-[11px] text-blue-600 hover:bg-gray-50"
              onClick={() => setShowGroupDlg(true)}>
              Group by Properties…
            </button>
          )}

          {/* quick query (§3.3) */}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button type="button" className={folderBtn(folder.kind === "query")}
              onClick={() => setFolder({ kind: "query" })}>
              <SearchIcon /> Quick Query
            </button>
            {folder.kind === "query" && (
              <div className="px-2 py-1.5 space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wide text-gray-400">
                  Look in
                  <select value={lookIn} onChange={(e) => setLookIn(e.target.value)}
                    className="mt-0.5 w-full h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal">
                    {(headerColsQ.data ?? []).map((c) => (
                      <option key={c.column} value={c.column}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400">
                  Look for
                  <input value={lookFor} onChange={(e) => setLookFor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setApplied({ lookin: lookIn, lookfor: lookFor }); }}
                    placeholder="full or partial value"
                    className="mt-0.5 w-full h-7 border border-gray-300 rounded px-1.5 text-xs normal-case tracking-normal" />
                </label>
                <button type="button"
                  onClick={() => setApplied({ lookin: lookIn, lookfor: lookFor })}
                  className="h-7 px-2.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150">
                  Refresh
                </button>
                {applied && (
                  <button type="button" onClick={() => { setApplied(null); setLookFor(""); }}
                    className="ml-1.5 h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── well list ── */}
        <section className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 text-[11px]">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowListProps(true)}>
              Well List Properties…
            </button>
            <button type="button" className="text-blue-600 hover:underline" onClick={copyWellList}>
              {copied ? "Copied ✓" : "Copy Well List"}
            </button>
            <button type="button" className="text-blue-600 hover:underline"
              onClick={() => setSelected(rows.map(idOf))}>
              Select All
            </button>
            {primary && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                {myWells.includes(primary) ? (
                  <button type="button" className="text-blue-600 hover:underline"
                    onClick={() => setMyWells((m) => m.filter((x) => !selected.includes(x)))}>
                    Remove from My Wells
                  </button>
                ) : (
                  <button type="button" className="text-blue-600 hover:underline"
                    onClick={() => setMyWells((m) => [...new Set([...m, ...selected])].slice(0, 100))}>
                    Add to My Wells
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {wellsQ.isLoading ? (
              <div className="p-4 text-sm text-gray-400">Reading the database…</div>
            ) : wellsQ.error ? (
              <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {(wellsQ.error as Error).message}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">
                {folder.kind === "my" ? "No wells in My Wells yet — right side of the manual: select wells and Add to My Wells."
                  : folder.kind === "recent" ? "No wells opened yet."
                  : folder.kind === "query" ? (applied ? "No well matches that query." : "Set the query and click Refresh.")
                  : "No wells."}
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.column}
                        className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200"
                        onClick={() => setSort((s) =>
                          s?.column === c.column ? { column: c.column, desc: !s.desc } : { column: c.column, desc: false })}>
                        {c.label}
                        {sort?.column === c.column && <span className="ml-1 text-gray-400">{sort.desc ? "▾" : "▴"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w, i) => {
                    const id = idOf(w);
                    const sel = selected.includes(id);
                    return (
                      <tr key={id}
                        data-testid="wv-well-row"
                        className={`cursor-default select-none ${sel ? "bg-blue-100" : i % 2 ? "bg-gray-50 hover:bg-blue-50" : "hover:bg-blue-50"}`}
                        onClick={(e) => clickRow(w, e, i)}
                        onDoubleClick={() => openWell(id)}>
                        {columns.map((c) => (
                          <td key={c.column} className="px-2 py-1 whitespace-nowrap text-gray-800">
                            {String(w[c.column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-2 py-1 border-t border-gray-100 text-[10px] text-gray-400">
            Double-click a well to open it. Ctrl-click and Shift-click select several — Data Audit and
            Copy Well List use the selection. {primary ? `Selected: ${nameOf(rows.find((w) => idOf(w) === primary) ?? { idwell: primary })}` : ""}
          </div>
        </section>
      </div>

      {showListProps && (
        <WellListProperties
          all={headerColsQ.data ?? []}
          displayed={cols}
          onClose={() => setShowListProps(false)}
          onApply={(next) => { setCols(next); setShowListProps(false); }}
        />
      )}
      {showGroupDlg && (
        <GroupByProperties
          all={headerColsQ.data ?? []}
          groups={groups}
          onClose={() => setShowGroupDlg(false)}
          onApply={(next) => {
            setGroups(next);
            setShowGroupDlg(false);
            if (next.length === 0 && folder.kind === "group") setFolder({ kind: "all" });
          }}
        />
      )}
    </div>
  );
}

function ToolButton({ label, hint, onClick, disabled }: {
  label: string; hint: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" title={hint} onClick={onClick} disabled={disabled}
      className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">
      {label}
    </button>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5v7A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-8.5z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor"
      strokeWidth="1.6" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" />
    </svg>
  );
}

/** Nested group folders (up to four levels, per the manual). */
function GroupFolders({ nodes, depth, active, onPick }: {
  nodes: { value: string; path: (string | null)[]; count: number; children: GroupFolders_Node[] }[];
  depth: number;
  active: (string | null)[] | null;
  onPick: (path: (string | null)[]) => void;
}) {
  return (
    <div>
      {nodes.map((n) => {
        const isActive = active !== null && active.length === n.path.length && n.path.every((v, i) => active[i] === v);
        return (
          <div key={n.path.join("¦")}>
            <button type="button"
              style={{ paddingLeft: 8 + depth * 14 }}
              className={`w-full text-left pr-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 ${
                isActive ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
              onClick={() => onPick(n.path)}>
              <FolderIcon />
              <span className="truncate">{n.value}</span>
              <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{n.count}</span>
            </button>
            {n.children.length > 0 && (
              <GroupFolders nodes={n.children} depth={depth + 1} active={active} onPick={onPick} />
            )}
          </div>
        );
      })}
    </div>
  );
}
interface GroupFolders_Node { value: string; path: (string | null)[]; count: number; children: GroupFolders_Node[] }

/** §3.2 "Change Well List Columns" — the Well List Properties dialog. */
function WellListProperties({ all, displayed, onApply, onClose }: {
  all: WvHeaderColumn[];
  displayed: string[];
  onApply: (cols: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(displayed);
  const [filter, setFilter] = useState("");
  const available = all.filter((c) => !chosen.includes(c.column)
    && (!filter || c.label.toLowerCase().includes(filter.toLowerCase()) || c.column.toLowerCase().includes(filter.toLowerCase())));
  const move = (col: string, dir: -1 | 1) => setChosen((cs) => {
    const i = cs.indexOf(col);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cs.length) return cs;
    const next = [...cs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  return (
    <Dialog title="Well List Properties" onClose={onClose}>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Available</div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter…"
            className="w-full h-7 border border-gray-300 rounded px-1.5 text-xs mb-1" />
          <div className="h-56 overflow-y-auto border border-gray-200 rounded">
            {available.map((c) => (
              <button key={c.column} type="button"
                className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50"
                onDoubleClick={() => setChosen((cs) => [...cs, c.column])}
                onClick={() => setChosen((cs) => [...cs, c.column])}
                title={c.column}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Displayed (in order)</div>
          <div className="h-[15.9rem] overflow-y-auto border border-gray-200 rounded">
            {chosen.map((col) => {
              const label = all.find((c) => c.column === col)?.label ?? col;
              return (
                <div key={col} className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-gray-50">
                  <span className="truncate flex-1" title={col}>{label}</span>
                  <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => move(col, -1)}>↑</button>
                  <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => move(col, 1)}>↓</button>
                  <button type="button" className="text-red-400 hover:text-red-600"
                    onClick={() => setChosen((cs) => cs.filter((x) => x !== col))}>✕</button>
                </div>
              );
            })}
            {chosen.length === 0 && <div className="p-2 text-[11px] text-gray-400">Nothing displayed — add a column.</div>}
          </div>
        </div>
      </div>
      <DialogButtons onOk={() => onApply(chosen.length ? chosen : ["WellName"])} onCancel={onClose} />
    </Dialog>
  );
}

/** §3.2 "Add and Edit a Well Group" — group by up to four header fields. */
function GroupByProperties({ all, groups, onApply, onClose }: {
  all: WvHeaderColumn[];
  groups: GroupSpec[];
  onApply: (groups: GroupSpec[]) => void;
  onClose: () => void;
}) {
  const [levels, setLevels] = useState<GroupSpec[]>(groups.length ? groups : []);
  const setLevel = (i: number, spec: GroupSpec | null) =>
    setLevels((ls) => {
      const next = [...ls];
      if (spec === null) next.splice(i);
      else next[i] = spec;
      return next.slice(0, 4);
    });
  const rows = [...levels, ...(levels.length < 4 ? [null] : [])];
  return (
    <Dialog title="Group by Properties" onClose={onClose}>
      <p className="text-[11px] text-gray-500 mb-2">
        Group wells by any field in the well header record — up to four levels, each ascending or
        descending. Select &lt;none&gt; to remove a level.
      </p>
      <div className="space-y-1.5">
        {rows.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-12">Level {i + 1}</span>
            <select value={g?.column ?? ""}
              onChange={(e) => setLevel(i, e.target.value ? { column: e.target.value, desc: g?.desc ?? false } : null)}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white flex-1">
              <option value="">&lt;none&gt;</option>
              {all.map((c) => <option key={c.column} value={c.column}>{c.label}</option>)}
            </select>
            {g && (
              <select value={g.desc ? "desc" : "asc"}
                onChange={(e) => setLevel(i, { column: g.column, desc: e.target.value === "desc" })}
                className="h-7 border border-gray-300 rounded px-1 text-xs bg-white">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2">
        <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setLevels([])}>
          Clear All
        </button>
      </div>
      <DialogButtons onOk={() => onApply(levels)} onCancel={onClose} />
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 w-full max-w-lg p-4"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function DialogButtons({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 mt-4">
      <button type="button" onClick={onCancel}
        className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
        Cancel
      </button>
      <button type="button" onClick={onOk}
        className="h-8 px-4 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">
        OK
      </button>
    </div>
  );
}
