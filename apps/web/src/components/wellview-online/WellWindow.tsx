/**
 * An opened well (manual §3.8): the Reports tab and the Schematic tab.
 *
 * Reports: the 181 original WellView layouts on the left, grouped by Peloton's
 * own categories; the selected one resolves against THIS database for THIS
 * well, block by block. The report toolbar carries the manual's subject-area
 * list boxes — pick a Job, then a Daily Operation — which scope every block
 * that hangs off that record (the server joins the IDRecParent chain), plus
 * Refresh and a zoom control. Clicking a block's title bar or double-clicking
 * a data row opens the Edit Data window at that subject area.
 *
 * Schematic: drawn from the downhole subject areas exactly as §3.8 lists them —
 * wellbore sizes, casing and tubing strings, rods, other-in-hole, perforations,
 * cement and zones — honestly to depth, with string widths from the components'
 * nominal ODs. The history player steps through every date on which the
 * downhole state changed. The wellbore selector follows §10.4: items above the
 * selected bore's kickoff point render regardless of which wellbore they belong
 * to. Zoom In/Out/Full and a proposed-strings toggle (ch. 4 planning) included.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { entryApi } from "../../entry/client.js";
import { wvDbApi, type WvSchematic, type WvSchematicRow } from "../../entry/wellviewDb.js";

interface TemplateEntry {
  name: string;
  html: string;
  folder_relative: string;
  paper: string;
  blocks: { table: string; title: string | null }[];
}

interface Props {
  db: string;
  idwell: string;
  wellName: string;
  onClose: () => void;
  /** Open Edit Data at a table (from a report block or a schematic item). */
  onEditTable: (table: string | null) => void;
  /** Open Edit Data on a specific record, cursor in the given column. */
  onEditRecord: (table: string, idrec: string, column: string | null) => void;
}

export function WellWindow({ db, idwell, wellName, onClose, onEditTable, onEditRecord }: Props) {
  const [tab, setTab] = useState<"reports" | "schematic">("reports");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <button type="button" onClick={onClose}
          className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          ‹ Well Explorer
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate">{wellName}</span>
        <div className="ml-3 flex gap-1 border-b-0">
          {([["reports", "Reports"], ["schematic", "Schematic"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)}
              className={`px-3 h-8 text-xs rounded-t-md border ${tab === id
                ? "bg-white border-gray-300 border-b-white font-medium text-blue-700"
                : "bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => onEditTable(null)}
          className="ml-auto h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">
          Edit Data
        </button>
      </div>

      {tab === "reports"
        ? <ReportsTab db={db} idwell={idwell} onEditTable={onEditTable} onEditRecord={onEditRecord} />
        : <SchematicTab db={db} idwell={idwell} onEditTable={onEditTable} />}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
/**
 * WellView keeps its DATA-ENTRY layouts in "Job Setup", "General Input" and
 * "Daily Input" folders — the guide calls them input reports and works through
 * them chapter by chapter ("Use the Job Setup input report to create a new Job
 * record"). Everything else — the *Summary folders, Asset History, Failure
 * Analysis, Phase Analysis, Master Templates — is printed output.
 */
const INPUT_FOLDER = /(Job Setup|General Input|Daily Input)/i;
const isInputReport = (r: { html: string }) => INPUT_FOLDER.test(r.html);

function ReportsTab({ db, idwell, onEditTable, onEditRecord }: {
  db: string;
  idwell: string;
  onEditTable: (table: string) => void;
  onEditRecord: (table: string, idrec: string, column: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  /** Show only the input reports — "where do I enter data?" in one click. */
  const [entryOnly, setEntryOnly] = useState(false);

  const indexQ = useQuery({
    queryKey: ["wellview", "templates", "index"],
    queryFn: async (): Promise<{ report_count: number; reports: TemplateEntry[] }> => {
      const res = await fetch("/wellview-templates/reports.json");
      if (!res.ok) throw new Error("Templates not exported — run scripts/wellview-afr/afr_export.py.");
      return res.json();
    },
    staleTime: Infinity,
  });

  const groups = useMemo(() => {
    const reports = indexQ.data?.reports ?? [];
    const q = query.trim().toLowerCase();
    const matched = reports.filter((r) => {
      if (entryOnly && !isInputReport(r)) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.folder_relative.toLowerCase().includes(q);
    });
    // Group by WellView's OWN folder, not just the top category: the app should
    // show "Drilling / Daily Input" as its own group because that folder is
    // where the daily data-entry forms live.
    const out = new Map<string, TemplateEntry[]>();
    for (const r of matched) {
      const folder = r.html.split("/").slice(0, -1).join(" / ") || "(root)";
      (out.get(folder) ?? out.set(folder, []).get(folder)!).push(r);
    }
    // Entry folders first — that is the order the training guide works in.
    return [...out.entries()].sort(([a], [b]) => {
      const ea = INPUT_FOLDER.test(a) ? 0 : 1;
      const eb = INPUT_FOLDER.test(b) ? 0 : 1;
      return ea - eb || a.localeCompare(b);
    });
  }, [indexQ.data, query, entryOnly]);

  return (
    <div className="flex gap-3 flex-1 min-h-0">
      <aside className="w-72 shrink-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
        <div className="p-2 border-b border-gray-100 space-y-1.5">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…" aria-label="Search reports"
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
          <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
            <input type="checkbox" className="h-3.5 w-3.5" checked={entryOnly}
              data-testid="wv-entry-only"
              onChange={(e) => setEntryOnly(e.target.checked)} />
            Data-entry forms only
          </label>
        </div>
        <div className="overflow-y-auto flex-1 p-1">
          {groups.map(([folder, list]) => {
            const entry = INPUT_FOLDER.test(folder);
            return (
              <div key={folder} className="mb-2">
                <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 ${
                  entry ? "text-emerald-700" : "text-gray-500"}`}>
                  {entry && <PencilIcon />}
                  <span className="truncate">{folder}</span>
                  <span className="font-normal text-gray-400 tabular-nums ml-auto">{list.length}</span>
                </div>
                {list.map((r) => (
                  <button key={r.html} type="button" onClick={() => setSelected(r.html)}
                    data-testid={`wv-report-${entry ? "input" : "output"}`}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] leading-snug ${
                      r.html === selected ? "bg-blue-50 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                    {r.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      <div className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
        {selected
          ? <FilledTemplate db={db} html={selected} idwell={idwell}
              isInput={INPUT_FOLDER.test(selected)}
              onEditTable={onEditTable} onEditRecord={onEditRecord} />
          : (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 px-6 text-center max-w-md mx-auto">
              <div>
                <p>Select a report — it fills from this database for this well.</p>
                <p className="mt-2 text-[11px]">
                  The <b className="text-emerald-700">Job Setup</b>,{" "}
                  <b className="text-emerald-700">General Input</b> and{" "}
                  <b className="text-emerald-700">Daily Input</b> folders are WellView&rsquo;s data-entry
                  forms: open one, press <b>New</b> to add a record, or click any value to edit it.
                </p>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

/** Entry-folder marker: these layouts are forms, not printed output. */
function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" />
    </svg>
  );
}

/** Caption for a job/day record in the anchor selectors. */
function anchorCaption(row: Record<string, string | number | null>): string {
  for (const k of ["DtTmStart", "DtTm", "Des", "JobTyp1", "Com"]) {
    const v = row[k];
    if (v != null && v !== "") {
      const s = String(v);
      const m = s.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
      if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
      return s.slice(0, 42);
    }
  }
  return String(row.IDRec ?? "record").slice(0, 12);
}

/** The template resolved against the chosen database — same block renderer
 *  contract as the sample browser, plus the manual's report-toolbar controls. */
function FilledTemplate({ db, html, idwell, isInput, onEditTable, onEditRecord }: {
  db: string;
  html: string;
  idwell: string;
  /** An input report is an entry surface: it gets the New button. */
  isInput: boolean;
  onEditTable: (table: string) => void;
  onEditRecord: (table: string, idrec: string, column: string | null) => void;
}) {
  interface BlockData {
    table: string | null; title: string | null; exists: boolean; computed: boolean;
    columns?: { column: string; label: string }[]; missing?: string[];
    rowCount?: number; truncated?: boolean; allNull?: boolean;
    rows?: (string | number | null)[][]; rowIds?: (string | null)[]; icons?: (string | null)[];
  }
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string>("");
  const [dayId, setDayId] = useState<string>("");
  const [zoom, setZoom] = useState(100);

  // First resolve WITHOUT an anchor to learn which tables the template uses.
  const probeQ = useQuery({
    queryKey: ["wvdb", db, "template", html, idwell, "probe"],
    queryFn: () => entryApi.get<{ blocks: BlockData[] }>(wvDbApi.templateDataPath(db, html, idwell)),
    staleTime: 60_000,
  });
  const tables = (probeQ.data?.blocks ?? []).map((b) => (b.table ?? "").toLowerCase());
  const usesJob = tables.some((t) => t.startsWith("wvjob"));
  const usesDay = tables.some((t) => t.startsWith("wvjobreport"));

  // §3.8 "Select a Report": the Jobs / Daily Operation Reports list boxes.
  const jobsQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvJob", idwell, null, false],
    queryFn: () => wvDbApi.records(db, "wvJob", { idwell }),
    enabled: usesJob,
  });
  const daysQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvJobReport", idwell, jobId || null, false],
    queryFn: () => wvDbApi.records(db, "wvJobReport", { idwell, parent: jobId || undefined }),
    enabled: usesDay && !!jobId,
  });
  useEffect(() => { setDayId(""); }, [jobId]);

  const anchor = dayId
    ? { table: "wvJobReport", idrec: dayId }
    : jobId ? { table: "wvJob", idrec: jobId } : null;

  const q = useQuery({
    queryKey: ["wvdb", db, "template", html, idwell, anchor?.table ?? "", anchor?.idrec ?? ""],
    queryFn: () => entryApi.get<{ report: string; well: { name: string }; blocks: BlockData[] }>(
      wvDbApi.templateDataPath(db, html, idwell, anchor)),
  });

  const fmt = (v: string | number | null): string => {
    if (v == null) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
    const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
    if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
    return v;
  };

  const data = q.data;
  const withRows = (data?.blocks ?? []).filter((b) => (b.rowCount ?? 0) > 0).length;

  /**
   * What New creates. The guide's example is unambiguous — on the Job Setup
   * report, "click the New button to create a new Job record" — i.e. the
   * report's own primary subject area, which is its first block that resolves
   * to a real table. A well-header banner block is a caption, not the record
   * being added, so it is skipped.
   */
  const newBlock = (data?.blocks ?? probeQ.data?.blocks ?? [])
    .find((b) => b.exists && b.table && b.table.toLowerCase() !== "wvwellheader");
  const newTarget = newBlock?.table ?? null;
  const newTargetLabel = newBlock?.title ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* the report toolbar (§3.8 Table 3-2): anchors, refresh, zoom */}
      <div className="px-2 py-1.5 border-b border-gray-100 flex items-center gap-2 flex-wrap shrink-0">
        {usesJob && (
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            Job
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal max-w-[15rem]">
              <option value="">All jobs</option>
              {(jobsQ.data?.rows ?? []).map((r) => (
                <option key={String(r.IDRec)} value={String(r.IDRec)}>{anchorCaption(r)}</option>
              ))}
            </select>
          </label>
        )}
        {usesDay && jobId && (
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            Daily operation
            <select value={dayId} onChange={(e) => setDayId(e.target.value)}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal max-w-[13rem]">
              <option value="">All days</option>
              {(daysQ.data?.rows ?? []).map((r) => (
                <option key={String(r.IDRec)} value={String(r.IDRec)}>{anchorCaption(r)}</option>
              ))}
            </select>
          </label>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {isInput && newTarget && (
            // §3.8 "Add a New Record": the New button opens Edit Data on the
            // report's own subject area with a blank record ready.
            <button type="button" data-testid="wv-report-new"
              onClick={() => onEditTable(newTarget)}
              title={`New record in ${newTargetLabel ?? newTarget}`}
              className="h-7 px-2.5 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700">
              New {newTargetLabel ?? ""}
            </button>
          )}
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            Zoom
            <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800">
              {[75, 90, 100, 110, 125, 150].map((z) => <option key={z} value={z}>{z}%</option>)}
            </select>
          </label>
          <button type="button"
            onClick={() => void qc.invalidateQueries({ queryKey: ["wvdb", db, "template", html] })}
            title="Refresh — re-read this report from the database"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            Refresh
          </button>
        </div>
      </div>

      {q.isLoading ? (
        <div className="p-4 text-sm text-gray-400">Filling the report…</div>
      ) : q.error ? (
        <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {(q.error as Error).message}
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
          <div className="max-w-5xl mx-auto space-y-3" style={{ zoom: zoom / 100 }}>
            <p className="text-[11px] text-gray-500">
              <b>{data.report}</b> — {withRows} of {data.blocks.length} blocks have rows
              {anchor ? " for this selection" : " for this well"}.{" "}
              {isInput
                ? "Click any value to edit it, or press New to add a record."
                : "Click a block\u2019s title bar to open that subject area in Edit Data."}
            </p>
            {data.blocks.map((b, i) => (
              <section key={`${b.table}-${i}`} className="bg-white border border-gray-200 rounded">
                <button type="button"
                  onClick={() => b.table && b.exists && onEditTable(b.table)}
                  disabled={!b.table || !b.exists}
                  title={b.exists ? "Open in Edit Data" : undefined}
                  className="w-full px-2 py-1 bg-gray-800 text-white text-[11px] font-semibold flex items-baseline gap-2 rounded-t disabled:cursor-default enabled:hover:bg-gray-700 text-left">
                  <span>{b.title || b.table}</span>
                  <span className="font-normal text-gray-300 font-mono text-[10px]">{b.table}</span>
                  {b.exists && (b.rowCount ?? 0) > 0 && (
                    <span className="ml-auto font-normal text-gray-300 tabular-nums">
                      {b.truncated ? `first ${b.rows?.length} of ${b.rowCount} rows` : `n = ${b.rowCount}`}
                    </span>
                  )}
                </button>
                {b.computed ? (
                  <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50">
                    Computed by WellView at print time — not stored in the database.
                  </div>
                ) : !b.exists ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400">Table not present in this database.</div>
                ) : (b.columns?.length ?? 0) === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400">
                    None of this block's columns exist in the stored table.
                  </div>
                ) : (b.rowCount ?? 0) === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400">
                    No rows {anchor ? "for this selection" : "for this well"}.
                  </div>
                ) : b.allNull ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400">
                    {b.rowCount} row{b.rowCount === 1 ? "" : "s"}, but every printed column is empty on all of them.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-600">
                          {b.icons && <th className="px-1 py-1 w-8" aria-label="icon" />}
                          {b.columns!.map((c) => (
                            <th key={c.column} className="px-2 py-1 text-left font-medium whitespace-nowrap"
                              title={`${b.table}.${c.column}`}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {b.rows!.map((r, ri) => {
                          const rowId = b.rowIds?.[ri] ?? null;
                          return (
                            <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}
                              onDoubleClick={() => b.table && (rowId
                                ? onEditRecord(b.table, rowId, null)
                                : onEditTable(b.table))}>
                              {b.icons && (
                                <td className="px-1 py-0.5 align-middle">
                                  {b.icons[ri] && (
                                    <img src={`/wellview-icons/${b.icons[ri]}`} alt=""
                                      className="w-5 h-5 object-contain" loading="lazy" />
                                  )}
                                </td>
                              )}
                              {r.map((v, ci) => {
                                const col = b.columns?.[ci]?.column ?? null;
                                // Clicking a value opens Edit Data on THAT record
                                // with the cursor in THAT field (§3.8 / Table 3-2 M).
                                return (
                                  <td key={ci} className="px-0 py-0 whitespace-nowrap text-gray-800">
                                    {b.table && rowId ? (
                                      <button type="button" data-testid="wv-report-cell"
                                        onClick={() => onEditRecord(b.table!, rowId, col)}
                                        title={`Edit ${b.columns?.[ci]?.label ?? ""} on this record`}
                                        className="w-full text-left px-2 py-0.5 hover:bg-blue-50 hover:ring-1 hover:ring-inset hover:ring-blue-300 rounded-sm">
                                        {fmt(v) || <span className="text-gray-300">—</span>}
                                      </button>
                                    ) : (
                                      <span className="block px-2 py-0.5">
                                        {fmt(v) || <span className="text-gray-300">—</span>}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Schematic tab ─────────────────────────────────────────────────────────────
const num = (v: string | number | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
/** Depth labels: metres to one decimal — unit-converted floats are noise. */
const fmtDepth = (n: number): string => String(Number(n.toFixed(1)));
const dstr = (v: string | number | null | undefined): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;

/** Is this string in the hole on `date`? Run on/before it, not yet pulled. */
function inHole(row: WvSchematicRow, date: string): boolean {
  const run = dstr(row.DtTmRun);
  const pull = dstr(row.DtTmPull);
  if (run && run > date) return false;
  if (pull && pull <= date) return false;
  if (!run && String(row.ProposedRun ?? "") === "1") return false;   // proposed only
  return true;
}
const isProposed = (row: WvSchematicRow): boolean =>
  !dstr(row.DtTmRun) && String(row.ProposedRun ?? "") === "1";

function SchematicTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wvdb", db, "schematic", idwell],
    queryFn: () => wvDbApi.schematic(db, idwell),
  });
  const [dateIx, setDateIx] = useState<number | null>(null);   // null = latest
  const [playing, setPlaying] = useState(false);
  const [boreId, setBoreId] = useState<string>("");            // "" = all wellbores
  const [showProposed, setShowProposed] = useState(false);
  const [scale, setScale] = useState(1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const dates = useMemo(() => q.data?.dates ?? [], [q.data]);
  const ix = dateIx === null ? Math.max(0, dates.length - 1) : dateIx;
  const date = dates[ix] ?? "9999-12-31";

  // History player (§3.8): AutoPlay steps through the dates, loops off the end.
  useEffect(() => {
    if (!playing) { if (timer.current) clearInterval(timer.current); timer.current = null; return; }
    timer.current = setInterval(() => {
      setDateIx((i) => {
        const cur = i === null ? dates.length - 1 : i;
        return cur >= dates.length - 1 ? 0 : cur + 1;
      });
    }, 900);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, dates.length]);

  if (q.isLoading) return <div className="p-4 text-sm text-gray-400">Reading downhole data…</div>;
  if (q.error) {
    return <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      {(q.error as Error).message}
    </div>;
  }
  const s = q.data!;
  const btn = "h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40";
  const bores = s.wellbores;

  return (
    <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-white flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-1.5 flex-wrap shrink-0">
        {/* §10.4: pick the wellbore; items above its kickoff always render */}
        {bores.length > 1 && (
          <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400 mr-1">
            Wellbore
            <select value={boreId} onChange={(e) => setBoreId(e.target.value)}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal max-w-[13rem]">
              <option value="">All wellbores</option>
              {bores.map((b) => (
                <option key={String(b.IDRec)} value={String(b.IDRec)}>
                  {String(b.Des ?? b.IDRec).slice(0, 40)}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">History player</span>
        <button type="button" className={btn} title="First date" disabled={!dates.length}
          onClick={() => { setPlaying(false); setDateIx(0); }}>⏮</button>
        <button type="button" className={btn} title="Previous date" disabled={!dates.length || ix <= 0}
          onClick={() => { setPlaying(false); setDateIx(Math.max(0, ix - 1)); }}>‹</button>
        <button type="button" className={btn} title={playing ? "Pause" : "AutoPlay"} disabled={dates.length < 2}
          onClick={() => setPlaying((p) => !p)}>{playing ? "⏸" : "▶"}</button>
        <button type="button" className={btn} title="Next date" disabled={!dates.length || ix >= dates.length - 1}
          onClick={() => { setPlaying(false); setDateIx(Math.min(dates.length - 1, ix + 1)); }}>›</button>
        <button type="button" className={btn} title="Last date" disabled={!dates.length}
          onClick={() => { setPlaying(false); setDateIx(null); }}>⏭</button>
        <span className="text-xs text-gray-700 font-medium tabular-nums ml-1">
          {dates.length ? `${date} (${ix + 1}/${dates.length})` : "no dated items"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[11px] text-gray-600">
            <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} />
            Proposed
          </label>
          <button type="button" className={btn} title="Zoom out" onClick={() => setScale((z) => Math.max(0.5, z / 1.25))}>−</button>
          <button type="button" className={btn} title="Zoom full" onClick={() => setScale(1)}>Fit</button>
          <button type="button" className={btn} title="Zoom in" onClick={() => setScale((z) => Math.min(4, z * 1.25))}>+</button>
          <button type="button" className={btn} title="Refresh — re-read the downhole data"
            onClick={() => void qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic", idwell] })}>
            Refresh
          </button>
        </div>
      </div>
      <div className="px-3 py-0.5 text-[10px] text-gray-400 border-b border-gray-50 shrink-0">
        Click an item to edit its subject area. Widths from component nominal OD, depths as stored.
      </div>
      <div className="flex-1 overflow-auto">
        <SchematicSvg s={s} date={date} boreId={boreId || null} showProposed={showProposed}
          scale={scale} onEditTable={onEditTable} />
      </div>
    </div>
  );
}

/**
 * The drawing. One vertical track, depth-true: wellbore sizes as the outer
 * grey profile, casing as black string pairs with shoe triangles, tubing blue,
 * rods thin grey, other-in-hole amber boxes, perforations as red ticks, cement
 * hatch beside the casing it belongs to, zones as green bands with names.
 * Proposed strings (ch. 4 planning) draw dashed when the toggle is on.
 */
function SchematicSvg({ s, date, boreId, showProposed, scale, onEditTable }: {
  s: WvSchematic; date: string; boreId: string | null; showProposed: boolean;
  scale: number; onEditTable: (table: string) => void;
}) {
  /**
   * §10.4 wellbore filter. The selected bore's ancestor chain is kept (a bore
   * whose IDRecParent equals its own IDRec — or is empty — is the original
   * hole); an item on another bore still renders when it sits entirely above
   * the selected bore's kickoff point.
   */
  const boreFilter = useMemo(() => {
    if (!boreId) return () => true;
    const byId = new Map(s.wellbores.map((b) => [String(b.IDRec), b]));
    const chain = new Set<string>();
    let cur = byId.get(boreId);
    let kickoff: number | null = null;
    for (let hops = 0; cur && hops < 10; hops++) {
      chain.add(String(cur.IDRec));
      const k = num(cur.KickOffDepth);
      if (kickoff === null && k != null) kickoff = k;
      const parent = String(cur.IDRecParent ?? "");
      if (!parent || parent === String(cur.IDRec)) break;
      cur = byId.get(parent);
    }
    const ko = num(byId.get(boreId)?.KickOffDepth);
    return (row: WvSchematicRow): boolean => {
      const link = String(row.IDRecWellBore ?? "");
      if (!link || chain.has(link)) return true;
      // above the kickoff point → always shown, per the manual
      if (ko != null) {
        const btm = num(row.DepthBtm) ?? num(row.DepthBtmActual);
        if (btm != null && btm <= ko) return true;
      }
      return false;
    };
  }, [boreId, s.wellbores]);

  const casings = s.casings.filter((c) => inHole(c, date) && boreFilter(c));
  const tubings = s.tubings.filter((t) => inHole(t, date) && boreFilter(t));
  const rods = s.rods.filter((r) => inHole(r, date) && boreFilter(r));
  const other = s.otherInHole.filter((o) => inHole(o, date) && boreFilter(o));
  const propCasings = showProposed ? s.casings.filter((c) => isProposed(c) && boreFilter(c)) : [];
  const propTubings = showProposed ? s.tubings.filter((t) => isProposed(t) && boreFilter(t)) : [];
  const sizes = s.sizes.filter((z) => {
    const start = dstr(z.DtTmStart);
    return (!start || start <= date);
  });
  const perfs = s.perforations.filter((p) => {
    const d = dstr(p.DtTm);
    return (!d || d <= date) && String(p.Proposed ?? "") !== "1" && boreFilter(p);
  });
  const cement = s.cement.filter((c) => {
    const d = dstr(c.DtTmStart);
    return (!d || d <= date) && String(c.Proposed ?? "") !== "1";
  });

  const depths: number[] = [];
  for (const set of [casings, tubings, rods, other, propCasings, propTubings]) for (const r of set) {
    const d = num(r.DepthBtm); if (d) depths.push(d);
  }
  for (const z of sizes) { const d = num(z.DepthBtmActual); if (d) depths.push(d); }
  for (const p of perfs) { const d = num(p.DepthBtm) ?? num(p.DepthTop); if (d) depths.push(d); }
  for (const z of s.zones) { const d = num(z.DepthBtm); if (d) depths.push(d); }
  const maxDepth = Math.max(100, ...depths) * 1.04;

  const H = 640, W = 560, CX = 240, TOP = 24;
  const y = (depth: number) => TOP + (depth / maxDepth) * (H - TOP - 16);

  const ods: number[] = [];
  for (const c of [...casings, ...propCasings]) { const o = num(c.maxOd); if (o) ods.push(o); }
  for (const z of sizes) { const o = num(z.Sz); if (o) ods.push(o); }
  const maxOd = Math.max(4, ...ods);
  const halfW = (od: number | null) => (od ? Math.max(4, (od / maxOd) * 90) : 30);

  const items: React.ReactNode[] = [];

  // wellbore sizes: outer profile, light grey, widest first
  const sortedSizes = [...sizes].sort((a, b) => (num(b.Sz) ?? 0) - (num(a.Sz) ?? 0));
  for (const [i, z] of sortedSizes.entries()) {
    const top = num(z.DepthTopActual) ?? 0;
    const btm = num(z.DepthBtmActual);
    if (btm == null) continue;
    const hw = halfW(num(z.Sz)) + 6;
    items.push(
      <rect key={`size${i}`} x={CX - hw} y={y(top)} width={hw * 2} height={Math.max(1, y(btm) - y(top))}
        fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"
        className="cursor-pointer" onClick={() => onEditTable("wvWellboreSize")}>
        <title>{`Hole ${z.Sz ?? "?"}" — ${fmtDepth(top)}–${fmtDepth(btm)} (wvWellboreSize)`}</title>
      </rect>,
    );
  }

  // zones: green bands behind strings
  for (const [i, z] of s.zones.entries()) {
    const top = num(z.DepthTop), btm = num(z.DepthBtm);
    if (top == null || btm == null) continue;
    items.push(
      <g key={`zone${i}`} className="cursor-pointer" onClick={() => onEditTable("wvZone")}>
        <rect x={CX + 108} y={y(top)} width={10} height={Math.max(2, y(btm) - y(top))}
          fill="#86efac" stroke="#22c55e" strokeWidth="0.5" opacity="0.85">
          <title>{`Zone ${z.ZoneName ?? ""} ${fmtDepth(top)}–${fmtDepth(btm)} (wvZone)`}</title>
        </rect>
        <text x={CX + 122} y={y((top + btm) / 2) + 3} fontSize="9" fill="#15803d">{String(z.ZoneName ?? "")}</text>
      </g>,
    );
  }

  // casings: pair of verticals + shoe triangles; proposed variants dashed
  const drawCasing = (c: WvSchematicRow & { maxOd?: number | null }, i: number, proposed: boolean) => {
    const btm = num(c.DepthBtm);
    if (btm == null) return;
    const hw = halfW(num(c.maxOd ?? null));
    const yb = y(btm);
    const stroke = proposed ? "#9ca3af" : "#111827";
    const dash = proposed ? "6 3" : undefined;
    items.push(
      <g key={`${proposed ? "pcas" : "cas"}${i}`} className="cursor-pointer" onClick={() => onEditTable("wvCas")}>
        <title>{`${c.Des ?? "Casing"}${proposed ? " (proposed)" : ""} — shoe ${fmtDepth(btm)} (wvCas)`}</title>
        <line x1={CX - hw} y1={TOP} x2={CX - hw} y2={yb} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />
        <line x1={CX + hw} y1={TOP} x2={CX + hw} y2={yb} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />
        <path d={`M ${CX - hw} ${yb} l -7 0 l 7 -9 z`} fill={stroke} />
        <path d={`M ${CX + hw} ${yb} l 7 0 l -7 -9 z`} fill={stroke} />
        <text x={CX - hw - 10} y={yb + 4} fontSize="9" fill={proposed ? "#9ca3af" : "#374151"} textAnchor="end">
          {String(c.Des ?? "csg")}{proposed ? " (prop.)" : ""} @ {fmtDepth(btm)}
        </text>
      </g>,
    );
    if (proposed) return;
    // cement for this string: hatch strip outside the casing lines
    const cem = cement.filter((m) => String(m.IDRecString ?? "") === String(c.IDRec ?? "-"));
    if (cem.length) {
      items.push(
        <g key={`cem${i}`} className="cursor-pointer" onClick={() => onEditTable("wvCement")}>
          <title>{`Cement × ${cem.length} on ${c.Des ?? "casing"} (wvCement)`}</title>
          <rect x={CX + hw + 1} y={Math.max(TOP, yb - 60)} width={5} height={Math.min(60, yb - TOP)} fill="url(#cemhatch)" />
          <rect x={CX - hw - 6} y={Math.max(TOP, yb - 60)} width={5} height={Math.min(60, yb - TOP)} fill="url(#cemhatch)" />
        </g>,
      );
    }
  };
  casings.forEach((c, i) => drawCasing(c, i, false));
  propCasings.forEach((c, i) => drawCasing(c, i, true));

  // tubing: blue pair, inside; proposed dashed
  const drawTubing = (t: WvSchematicRow & { maxOd?: number | null }, i: number, proposed: boolean) => {
    const btm = num(t.DepthBtm);
    if (btm == null) return;
    const hw = Math.max(3, halfW(num(t.maxOd ?? null)) * 0.55);
    items.push(
      <g key={`${proposed ? "ptub" : "tub"}${i}`} className="cursor-pointer" onClick={() => onEditTable("wvTub")}>
        <title>{`${t.Des ?? "Tubing"}${proposed ? " (proposed)" : ""} — ${btm} (wvTub)`}</title>
        <line x1={CX - hw} y1={TOP} x2={CX - hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6"
          strokeDasharray={proposed ? "5 3" : undefined} opacity={proposed ? 0.6 : 1} />
        <line x1={CX + hw} y1={TOP} x2={CX + hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6"
          strokeDasharray={proposed ? "5 3" : undefined} opacity={proposed ? 0.6 : 1} />
      </g>,
    );
  };
  tubings.forEach((t, i) => drawTubing(t, i, false));
  propTubings.forEach((t, i) => drawTubing(t, i, true));

  // rods: single thin line down the middle
  for (const [i, r] of rods.entries()) {
    const btm = num(r.DepthBtm);
    if (btm == null) continue;
    items.push(
      <line key={`rod${i}`} x1={CX} y1={TOP} x2={CX} y2={y(btm)} stroke="#6b7280" strokeWidth="1"
        strokeDasharray="4 2" className="cursor-pointer" onClick={() => onEditTable("wvRod")}>
        <title>{`${r.Des ?? "Rod string"} — ${btm} (wvRod)`}</title>
      </line>,
    );
  }

  // other in hole: amber boxes at depth
  for (const [i, o] of other.entries()) {
    const top = num(o.DepthTop), btm = num(o.DepthBtm) ?? top;
    if (top == null) continue;
    items.push(
      <rect key={`oih${i}`} x={CX - 8} y={y(top)} width={16} height={Math.max(5, y(btm ?? top) - y(top))}
        fill="#f59e0b" stroke="#b45309" strokeWidth="0.5" rx="2"
        className="cursor-pointer" onClick={() => onEditTable("wvOtherInHole")}>
        <title>{`${o.Des ?? "Other in hole"} ${fmtDepth(top)}${btm && btm !== top ? `–${fmtDepth(btm)}` : ""} (wvOtherInHole)`}</title>
      </rect>,
    );
  }

  // perforations: red ticks either side
  for (const [i, p] of perfs.entries()) {
    const top = num(p.DepthTop), btm = num(p.DepthBtm) ?? top;
    if (top == null) continue;
    const y1 = y(top), y2 = Math.max(y(btm ?? top), y1 + 3);
    const ticks: React.ReactNode[] = [];
    for (let yy = y1; yy <= y2; yy += 6) {
      ticks.push(<path key={`l${yy}`} d={`M ${CX - 26} ${yy} l -7 3 l 7 3`} stroke="#dc2626" strokeWidth="1.4" fill="none" />);
      ticks.push(<path key={`r${yy}`} d={`M ${CX + 26} ${yy} l 7 3 l -7 3`} stroke="#dc2626" strokeWidth="1.4" fill="none" />);
    }
    items.push(
      <g key={`perf${i}`} className="cursor-pointer" onClick={() => onEditTable("wvPerforation")}>
        <title>{`Perforation ${fmtDepth(top)}–${fmtDepth(btm ?? top)} (wvPerforation)`}</title>
        {ticks}
      </g>,
    );
  }

  // depth axis
  const axis: React.ReactNode[] = [];
  const step = niceStep(maxDepth);
  for (let d = 0; d <= maxDepth; d += step) {
    axis.push(
      <g key={`ax${d}`}>
        <line x1={30} y1={y(d)} x2={36} y2={y(d)} stroke="#9ca3af" strokeWidth="1" />
        <text x={26} y={y(d) + 3} fontSize="9" fill="#6b7280" textAnchor="end">{fmtDepth(d)}</text>
      </g>,
    );
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * scale} height={H * scale} className="mx-auto block"
      role="img" aria-label="Wellbore schematic">
      <defs>
        <pattern id="cemhatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="#e5e7eb" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="#6b7280" strokeWidth="1.2" />
        </pattern>
      </defs>
      <line x1={36} y1={TOP} x2={36} y2={H - 16} stroke="#d1d5db" strokeWidth="1" />
      {axis}
      {/* ground line */}
      <line x1={60} y1={TOP} x2={W - 20} y2={TOP} stroke="#92400e" strokeWidth="2" />
      {items}
      {casings.length === 0 && tubings.length === 0 && sizes.length === 0 && (
        <text x={CX} y={H / 2} fontSize="12" fill="#9ca3af" textAnchor="middle">
          No downhole items in the hole on this date.
        </text>
      )}
    </svg>
  );
}

function niceStep(max: number): number {
  const raw = max / 8;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}
