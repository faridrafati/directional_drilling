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
 * Days vs Depth: the drilling curve, from WellView's own .dvdc templates —
 * planned phase progress against what the daily reports actually recorded.
 *
 * Wellhead: the surface assembly — its own recorded picture at a size worth
 * looking at, its pressure rating, and the components and outlets bolted into
 * it. See WellheadTab for why it is a specification panel and not a stack
 * drawing: the components carry neither art nor an order to draw them in.
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
import { useUnitSet } from "../../entry/unitSet.js";
import { useDatumShift } from "../../entry/datum.js";
import { toDisplay, fromDisplay, formatUnitValue, displayUnitFor, displayUnitLabel, type DatumShift } from "@dd/shared";
import type { UnitFormat } from "@dd/shared";
import { Attachments } from "./Attachments.js";
import { PrintReport } from "./PrintReport.js";
import { wvDbApi, type WvSchematic, type WvSchematicRow,
  type WvWellhead, type WvWellheadField,
  type WvDvdSeries, type WvDvdAxis, type WvSavedReport,
  type WvReportBlockDef } from "../../entry/wellviewDb.js";

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
  const [tab, setTab] = useState<"reports" | "schematic" | "survey" | "wellhead" | "dvd">("reports");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <button type="button" onClick={onClose}
          className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          ‹ Well Explorer
        </button>
        <span className="text-sm font-semibold text-gray-900 truncate">{wellName}</span>
        <div className="ml-3 flex gap-1 border-b-0">
          {/*
            * The order is Peloton s own. peloton.appframe.ini s
            * [VisToolsSingle] numbers the five single-well visual tools:
            * report engine 1, schematic 2, wellhead 3, time tracks 4, days vs
            * depth 5. Four of those are built (time tracks has no data in any
            * export here), and they now appear in that sequence.
            *
            * Survey is this app s own addition, not one of the five, so it goes
            * after them rather than splitting Schematic from Wellhead as it did.
            */}
          {([["reports", "Reports"], ["schematic", "Schematic"], ["wellhead", "Wellhead"], ["dvd", "Days vs Depth"], ["survey", "Survey"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} data-testid={`wv-tab-${id}`}
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
        : tab === "schematic"
          ? <SchematicTab db={db} idwell={idwell} onEditTable={onEditTable} />
          : tab === "survey"
            ? <SurveyTab db={db} idwell={idwell} onEditTable={onEditTable} />
            : tab === "wellhead"
              ? <WellheadTab db={db} idwell={idwell} onEditTable={onEditTable} />
              : <DaysVsDepthTab db={db} idwell={idwell} onEditTable={onEditTable} />}
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
  const qcReports = useQueryClient();
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

  /** §9.2 My Reports — this user's own designs for this database. */
  const savedQ = useQuery({
    queryKey: ["wvdb", db, "saved-reports"],
    queryFn: () => wvDbApi.savedReports(db),
  });
  const mine = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (savedQ.data?.reports ?? []).filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [savedQ.data, query]);
  const [editing, setEditing] = useState<{ report: WvSavedReport | null } | null>(null);

  const removeReport = async (r: WvSavedReport) => {
    if (!window.confirm(`Delete the report "${r.name}"?`)) return;
    await wvDbApi.deleteReport(db, r.id);
    if (selected === `saved:${r.id}`) setSelected(null);
    await qcReports.invalidateQueries({ queryKey: ["wvdb", db, "saved-reports"] });
  };

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
          {/*
            * §9.2 My Reports — the reports this user designed, above Peloton's
            * own so they are the first thing seen. They open through the SAME
            * viewer as a shipped template because the server resolves them
            * through the same code.
            */}
          <div className="mb-2" data-testid="wv-myreports">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-1.5 text-violet-700">
              <span className="truncate">My Reports</span>
              <span className="font-normal text-gray-400 tabular-nums ml-auto">
                {mine.length}
              </span>
              <button type="button" data-testid="wv-report-new"
                onClick={() => setEditing({ report: null })}
                title="New Report (§9.2) — design a report over this database"
                className="ml-1 h-5 px-1.5 text-[10px] rounded border border-violet-300 text-violet-700 hover:bg-violet-50">
                New
              </button>
            </div>
            {!mine.length && (
              <p className="px-2 py-1 text-[10px] text-gray-400">
                None yet. New designs a report from this database&rsquo;s subject areas.
              </p>
            )}
            {/*
              * SAVED REPORTS GROUP BY THE CATEGORY THEY WERE GIVEN.
              *
              * The editor asks for a category, the server stores it and orders
              * by it, and the list rendered one flat run of names — so the
              * question was asked and the answer thrown away. The shipped 182
              * in this same sidebar have always been grouped by their folder.
              *
              * The server defaults a blank one to "Saved", so every report
              * lands under a heading and none goes missing.
              */}
            {[...mine.reduce((m, r) => {
              const k = r.category?.trim() || "Saved";
              return m.set(k, [...(m.get(k) ?? []), r]);
            }, new Map<string, typeof mine>())].map(([cat, list]) => (
              <div key={cat}>
                {/* One category and nothing to compare it with reads as noise,
                    so the heading appears only once there is a choice. */}
                {mine.length > list.length && (
                  <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wide text-gray-400">
                    {cat}
                  </div>
                )}
                {list.map((r) => (
              <div key={r.id} className="flex items-center gap-1 group">
                <button type="button" onClick={() => setSelected(`saved:${r.id}`)}
                  data-testid="wv-report-saved"
                  className={`flex-1 text-left px-2 py-1 rounded text-[11px] leading-snug ${
                    `saved:${r.id}` === selected ? "bg-violet-50 text-violet-800 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                  {r.name}
                </button>
                <button type="button" title="Edit Report (§9.2)" data-testid="wv-report-edit"
                  onClick={() => setEditing({ report: r })}
                  className="h-5 px-1 text-[10px] text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100">
                  ✎
                </button>
                <button type="button" title="Delete Report (§9.2)" data-testid="wv-report-delete"
                  onClick={() => void removeReport(r)}
                  className="h-5 px-1 text-[10px] text-gray-400 hover:text-red-700 opacity-0 group-hover:opacity-100">
                  ×
                </button>
              </div>
                ))}
              </div>
            ))}
          </div>
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
              /* A user report is never a data-entry form: those are Peloton's
                 own Job Setup / Daily Input folders. */
              isInput={!selected.startsWith("saved:") && INPUT_FOLDER.test(selected)}
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

      {editing && (
        <ReportEditor db={db} report={editing.report}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await qcReports.invalidateQueries({ queryKey: ["wvdb", db, "saved-reports"] });
          }} />
      )}
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
    /** Computed HERE from stored rows, rather than merely absent (see below). */
    derived?: boolean;
    /** The template names a table but prints no columns from it: the block's
     *  CONTENT is the thing (attached files, a chart), not a table of values. */
    contentOnly?: boolean;
    unsupported?: { field: string; reason: string }[];
    /** Derivable, but waiting on a job/day selection in the toolbar. */
    needsScope?: string[];
    columns?: { column: string; label: string; unit?: string;
      units?: Record<string, UnitFormat>;
      /** Computed here from the model equation, not stored in the database. */
      derived?: boolean; eqn?: string }[]; missing?: string[];
    rowCount?: number; truncated?: boolean; allNull?: boolean;
    /** Row filters the template declares and this block honoured (§9.2). */
    filtersApplied?: { table: string; field: string; value: string }[];
    /** …and the ones it could not, each with the reason. */
    filtersSkipped?: { table: string; field: string; value: string; why: string }[];
    rows?: (string | number | null)[][]; rowIds?: (string | null)[]; icons?: (string | null)[];
  }
  const qc = useQueryClient();
  const [unitSet] = useUnitSet();
  const { shift: datumShiftFor } = useDatumShift(db, idwell);
  const [jobId, setJobId] = useState<string>("");
  const [dayId, setDayId] = useState<string>("");
  const [zoom, setZoom] = useState(100);
  const [printing, setPrinting] = useState(false);

  // First resolve WITHOUT an anchor to learn which tables the template uses.
  const probeQ = useQuery({
    queryKey: ["wvdb", db, "template", html, idwell, "probe"],
    queryFn: () => entryApi.get<{ blocks: BlockData[]; saved?: { anchor?: string | null } }>(
      html.startsWith("saved:")
        ? wvDbApi.savedReportDataPath(db, html.slice(6), idwell)
        : wvDbApi.templateDataPath(db, html, idwell)),
    staleTime: 60_000,
  });
  const tables = (probeQ.data?.blocks ?? []).map((b) => (b.table ?? "").toLowerCase());

  /*
   * THE SAVED REPORT'S OWN ANCHOR DECIDES ITS SELECTORS.
   *
   * The guide: "The anchor table is the table the report engine uses to split
   * reports … Any data blocks that are children of the anchor table are
   * automatically filtered based on that record."
   *
   * The editor asks for an anchor, the server stores it and sends it back, and
   * the toolbar was sniffing block table names instead — so a report anchored
   * on the Job got no Job selector when its blocks happened to be wvCas, and a
   * report anchored on nothing got a Day selector anyway. The setting existed
   * and did nothing.
   *
   * Sniffing stays as the fallback: the 182 shipped templates carry no anchor
   * of their own, and that is what has always driven their selectors.
   */
  const isSaved = !!probeQ.data?.saved;
  const savedAnchor = probeQ.data?.saved?.anchor?.toLowerCase() ?? null;
  // A saved report's anchor is authoritative INCLUDING when it is none: the
  // editor's first option reads "None — one report for the whole well", so
  // falling back to sniffing there would hand back the selectors the user just
  // turned off. Only a shipped template, which has no anchor concept, sniffs.
  const usesJob = isSaved
    ? !!savedAnchor && savedAnchor.startsWith("wvjob")
    : tables.some((t) => t.startsWith("wvjob"));
  const usesDay = isSaved
    ? !!savedAnchor && savedAnchor.startsWith("wvjobreport")
    : tables.some((t) => t.startsWith("wvjobreport"));

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
    // A saved report (§9.2) comes from its own route, but returns the SAME
    // shape because the server resolves it through the same function.
    queryFn: () => entryApi.get<{
      report: string; well: { name: string };
      filters?: { table: string; field: string; value: string; label?: string }[];
      blocks: BlockData[];
    }>(html.startsWith("saved:")
      ? wvDbApi.savedReportDataPath(db, html.slice(6), idwell, anchor)
      : wvDbApi.templateDataPath(db, html, idwell, anchor)),
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

  /** Chapter 9's Print Range: the records the report is produced for. */
  const printLevel = usesDay && jobId
    ? { table: "wvJobReport", label: "Day" }
    : usesJob ? { table: "wvJob", label: "Job" } : null;
  const printRecords = (printLevel?.table === "wvJobReport" ? daysQ.data?.rows : jobsQ.data?.rows) ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {printing && (
        <PrintReport
          db={db} idwell={idwell} wellName={data?.well?.name ?? idwell} html={html}
          reportName={data?.report ?? html.replace(/\.html$/, "")}
          level={printLevel}
          records={printRecords.map((r) => ({
            idrec: String(r.IDRec), caption: anchorCaption(r),
          }))}
          initial={dayId ? [dayId] : jobId ? [jobId] : []}
          onClose={() => setPrinting(false)}
        />
      )}
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
        <button type="button" onClick={() => setPrinting(true)} data-testid="wv-print-open"
          title="Print this report — for every job or day, or only the ones you choose (ch. 9)"
          className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          Print
        </button>
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
            {/*
              * §9.2: the template's own row filter. It has to be stated, not
              * just obeyed — a drilling report that quietly hides a well's
              * completion jobs is right, but a reader who does not know it is
              * filtered will read "no rows" as "no data".
              */}
            {!!data.filters?.length && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1"
                data-testid="wv-report-filter">
                This template filters to{" "}
                {/* A template can state the same filter twice with different
                    abbreviations ("drill" and "dril"); they mean one thing. */}
                {[...new Set(data.filters.map((f) =>
                  `${f.label ?? f.field} starting "${f.value.replace(/\*+$/, "")}"`))].join(", ")}
                {" "}— rows outside it are not shown, exactly as WellView prints it.
              </p>
            )}
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
                {String(b.table).toLowerCase() === "wvattachment" ? (
                  /* The shipped "Attached Image Files" template extracts no
                     columns at all — the images ARE the content. Render the
                     files rather than an empty grid. */
                  <div className="p-2">
                    <Attachments db={db} idwell={idwell} canUpload={false} />
                  </div>
                ) : b.contentOnly ? (
                  <div className="px-3 py-2 text-[11px] text-gray-500">
                    This block prints content rather than a table of values, and the template
                    names no columns for it — WellView draws it from <b>{b.table}</b> at print time.
                  </div>
                ) : b.computed && !b.derived ? (
                  <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50">
                    {b.needsScope?.length ? (
                      <>
                        This summary can be computed here — pick{" "}
                        {b.needsScope.includes("idjob") ? "a Job" : ""}
                        {b.needsScope.includes("idjob") && b.needsScope.includes("idreport") ? " and " : ""}
                        {b.needsScope.includes("idreport") ? "a Day" : ""}
                        {b.needsScope.includes("idphase") ? "a Phase" : ""} in the toolbar above to see it.
                      </>
                    ) : (
                      <>Computed by WellView at print time — not stored in the database.</>
                    )}
                  </div>
                ) : !b.exists ? (
                  <div className="px-3 py-2 text-[11px] text-gray-400">Table not present in this database.</div>
                ) : b.contentOnly ? (
                  <div className="px-3 py-2 text-[11px] text-gray-500">
                    This block prints no columns — the template draws its content directly
                    (a chart or an image list), which this app does not reproduce.
                  </div>
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
                    {/* A derived block must never read as stored data. WellView
                        builds these when a report prints; the numbers here were
                        aggregated from the records this database does hold. */}
                    {b.derived && (
                      <div className="px-3 py-2 text-[11px] text-green-800 bg-green-50 border-b border-green-100">
                        <b>Computed here</b> from the stored records — WellView builds this table at
                        print time and does not save it.
                        {!!b.unsupported?.length && (
                          <span className="text-green-900/70">
                            {" "}Not derivable from this database:{" "}
                            {b.unsupported.map((u) => u.field).join(", ")}.
                          </span>
                        )}
                      </div>
                    )}
                    <table className="w-full text-[11px] border-collapse">
                      <thead>
                        <tr className={b.derived ? "bg-green-100/70 text-green-900" : "bg-gray-100 text-gray-600"}>
                          {b.icons && <th className="px-1 py-1 w-8" aria-label="icon" />}
                          {b.columns!.map((c) => (
                            <th key={c.column}
                              /* Green is WellView's own convention for a value
                                 it worked out rather than one somebody entered
                                 (§4.3), and the tooltip carries the equation. */
                              className={`px-2 py-1 text-left font-medium whitespace-nowrap ${
                                c.derived ? "text-green-700" : ""}`}
                              data-testid={c.derived ? "wv-derived-col" : undefined}
                              title={c.derived
                                ? `${b.table}.${c.column} — computed here: ${c.eqn ?? ""}`
                                : `${b.table}.${c.column}`}>
                              {c.label}
                              {c.unit && (
                                <span className="ml-1 font-normal text-gray-400">
                                  ({displayUnitLabel(c, unitSet, datumShiftFor)})
                                </span>
                              )}
                            </th>
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
                                const meta = b.columns?.[ci];
                                const col = meta?.column ?? null;
                                // A value whose column carries a unit is shown in
                                // the user's set; the rest print as stored.
                                const shown = (() => {
                                  if (meta?.unit && v != null && v !== "") {
                                    const n = Number(v);
                                    if (Number.isFinite(n)) {
                                      const d = toDisplay(n, meta, unitSet, datumShiftFor);
                                      if (d) return formatUnitValue(d.value, d);
                                    }
                                  }
                                  return fmt(v);
                                })();
                                // Clicking a value opens Edit Data on THAT record
                                // with the cursor in THAT field (§3.8 / Table 3-2 M).
                                return (
                                  <td key={ci} className="px-0 py-0 whitespace-nowrap text-gray-800">
                                    {b.table && rowId ? (
                                      <button type="button" data-testid="wv-report-cell"
                                        onClick={() => onEditRecord(b.table!, rowId, col)}
                                        title={`Edit ${b.columns?.[ci]?.label ?? ""} on this record`}
                                        className="w-full text-left px-2 py-0.5 hover:bg-blue-50 hover:ring-1 hover:ring-inset hover:ring-blue-300 rounded-sm">
                                        {shown || <span className="text-gray-300">—</span>}
                                      </button>
                                    ) : (
                                      <span className="block px-2 py-0.5">
                                        {shown || <span className="text-gray-300">—</span>}
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

/** §8.3 "group lists" — the kinds of downhole item a template may show. */
export type SchematicLayer =
  | "holeSizes" | "casing" | "tubing" | "rods" | "otherInHole"
  | "perforations" | "cement" | "zones" | "drillString";

export const SCHEMATIC_LAYERS: { key: SchematicLayer; label: string }[] = [
  { key: "holeSizes", label: "Hole sizes" },
  { key: "casing", label: "Casing" },
  { key: "tubing", label: "Tubing" },
  { key: "rods", label: "Rods" },
  { key: "otherInHole", label: "Other in hole" },
  { key: "perforations", label: "Perforations" },
  { key: "cement", label: "Cement" },
  // §7.2 "Drilling OD Not Visible" / "Bit Not Visible": the string in the hole
  // and the bit on its end are part of the picture a driller expects.
  { key: "drillString", label: "Drill string & bit" },
  { key: "zones", label: "Zones" },
];

const ALL_LAYERS = Object.fromEntries(
  SCHEMATIC_LAYERS.map((l) => [l.key, true]),
) as Record<SchematicLayer, boolean>;
const num = (v: string | number | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
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
  /*
   * The schematic honours Tools > Reference Datum, and the help is explicit
   * that it must: the datum lets you "view and edit all depth-based values
   * relative to an alternate datum (for example, in reports, the schematic, and
   * Edit Data window)". Leaving it out was worse than not having the feature —
   * a casing shoe read 3,739 mCF in the report and 3,745 m on the drawing of
   * the same well, with nothing on either to say which datum it came from.
   */
  const { shift: datumShift } = useDatumShift(db, idwell);
  const q = useQuery({
    queryKey: ["wvdb", db, "schematic", idwell],
    queryFn: () => wvDbApi.schematic(db, idwell),
  });
  const [dateIx, setDateIx] = useState<number | null>(null);   // null = latest
  const [playing, setPlaying] = useState(false);
  const [boreId, setBoreId] = useState<string>("");            // "" = all wellbores
  const [showProposed, setShowProposed] = useState(false);
  const [scale, setScale] = useState(1);
  /**
   * §8.3 "group lists": which kinds of downhole item the view draws. A
   * completions template shows tubing, rods and perforations; a drilling one
   * shows casing and hole sizes. Everything on by default — a template is a
   * narrowing of the full picture, not a prerequisite for seeing it.
   */
  const [layers, setLayers] = useState<Record<SchematicLayer, boolean>>(ALL_LAYERS);
  /**
   * §8.3 SmartScaling: "adjusts the view so that only equipment that appears on
   * the selected date is used in the scaling algorithm." Off, the axis spans
   * the deepest item the well ever had, so an early date draws as a sliver at
   * the top of a mostly empty track.
   */
  const [smartScaling, setSmartScaling] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const svgBox = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /**
   * §8.3 "Adding Tracks": columns of data beside the drawing, on the same depth
   * scale. MD is the depth axis the diagram already has; the other two come
   * from the deviation survey the WELLBORE is linked to (§7.2 "Deviation Survey
   * Not Visible — the deviation survey is not linked to the wellbore"), which
   * is why they are offered only when that link exists and say so when it does
   * not. The guide's other track types — depth curves over drilling parameters,
   * depth markers — are not offered rather than faked.
   */
  const [tracks, setTracks] = useState<{ tvd: boolean; incl: boolean }>({ tvd: false, incl: false });

  /**
   * Get the drawing out of the app (§3.8 "Copy a Schematic" / "Print a
   * Schematic").
   *
   * The SVG is serialised and rasterised through a canvas rather than screen-
   * grabbed, so the image is the drawing at its own resolution instead of at
   * whatever the window happened to be. Fonts and colours are inline already —
   * there is no stylesheet to lose.
   *
   * Clipboard images are not universally permitted; when the browser refuses,
   * this says so and falls back to a download rather than failing silently.
   */
  async function exportSchematic(how: "copy" | "png" | "print") {
    const svg = svgBox.current?.querySelector("svg");
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const w = Number(svg.getAttribute("width")) || 900;
    const h = Number(svg.getAttribute("height")) || 1200;

    if (how === "print") {
      const win = window.open("", "_blank", "width=900,height=1200");
      if (!win) { setCopied("popup blocked"); setTimeout(() => setCopied(null), 2500); return; }
      win.document.write(
        `<title>Schematic — ${date}</title>`
        + `<body style="margin:0;display:flex;justify-content:center">`
        + `<img src="${src}" style="max-width:100%">`);
      win.document.close();
      // Wait for the image before printing, or the sheet comes out blank.
      win.onload = () => { win.focus(); win.print(); };
      return;
    }

    const png = await new Promise<Blob | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        // Two-times for a legible print; the drawing is vector, so it costs
        // nothing but pixels.
        c.width = w * 2; c.height = h * 2;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(resolve, "image/png");
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    if (!png) { setCopied("could not render"); setTimeout(() => setCopied(null), 2500); return; }

    if (how === "png") {
      const url = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schematic-${date}.png`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      setCopied("Copied ✓");
    } catch {
      // Firefox and any non-secure context refuse image writes; say so rather
      // than leaving a button that appears to have worked.
      setCopied("clipboard refused — use PNG");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  const dates = useMemo(() => q.data?.dates ?? [], [q.data]);
  const ix = dateIx === null ? Math.max(0, dates.length - 1) : dateIx;
  const date = dates[ix] ?? "9999-12-31";

  /*
   * The deviation survey the selected wellbore is linked to.
   *
   * With no bore chosen, the first linked one stands in — a well usually has
   * one survey that matters and offering nothing at all would be less useful
   * than offering the obvious one. Whichever it is, the track header names it,
   * so the reader is never left guessing which survey a TVD came from.
   */
  const link = useMemo(() => {
    const links = q.data?.surveyLinks ?? [];
    if (boreId) return links.find((l) => l.wellbore === boreId && l.survey) ?? null;
    return links.find((l) => l.survey) ?? null;
  }, [q.data, boreId]);
  const trackQ = useQuery({
    queryKey: ["wvdb", db, "survey", link?.survey ?? ""],
    queryFn: () => wvDbApi.survey(db, link!.survey!),
    enabled: !!link?.survey && (tracks.tvd || tracks.incl),
    staleTime: 5 * 60 * 1000,
  });

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
          <label className="flex items-center gap-1 text-[11px] text-gray-600"
            title="§8.3 — scale only to what is in the hole on the selected date">
            <input type="checkbox" checked={smartScaling} data-testid="wv-sch-smart"
              onChange={(e) => setSmartScaling(e.target.checked)} />
            SmartScaling
          </label>
          {/* §8.3 Tracks: extra depth-scaled columns beside the drawing. */}
          <label className="flex items-center gap-1 text-[11px] text-gray-600"
            title={link?.survey
              ? `TVD track from the linked survey${link.surveyName ? ` "${link.surveyName}"` : ""} (§8.3)`
              : "This wellbore has no deviation survey linked (§7.2), so TVD cannot be computed"}>
            <input type="checkbox" checked={tracks.tvd} disabled={!link?.survey}
              data-testid="wv-sch-track-tvd"
              onChange={(e) => setTracks((t) => ({ ...t, tvd: e.target.checked }))} />
            TVD
          </label>
          <label className="flex items-center gap-1 text-[11px] text-gray-600"
            title={link?.survey
              ? "Inclination track from the linked survey (§8.3)"
              : "This wellbore has no deviation survey linked (§7.2)"}>
            <input type="checkbox" checked={tracks.incl} disabled={!link?.survey}
              data-testid="wv-sch-track-incl"
              onChange={(e) => setTracks((t) => ({ ...t, incl: e.target.checked }))} />
            Incl
          </label>
          <label className="flex items-center gap-1 text-[11px] text-gray-600">
            <input type="checkbox" checked={showProposed} onChange={(e) => setShowProposed(e.target.checked)} />
            Proposed
          </label>
          <button type="button" className={btn} title="Zoom out" onClick={() => setScale((z) => Math.max(0.5, z / 1.25))}>−</button>
          <button type="button" className={btn} title="Zoom full" onClick={() => setScale(1)}>Fit</button>
          <button type="button" className={btn} title="Zoom in" onClick={() => setScale((z) => Math.min(4, z * 1.25))}>+</button>
          {/*
            * §3.8 "Copy a Schematic" and "Print a Schematic". The desktop puts
            * the drawing on the clipboard so it can be pasted into a report or
            * an email; the browser equivalent is an image on the clipboard,
            * with a PNG download for the browsers that refuse clipboard images
            * and a print view for the guide's second suggestion.
            */}
          <button type="button" className={btn} data-testid="wv-sch-copy"
            title="Copy a Schematic (§3.8) — put the drawing on the clipboard as an image"
            onClick={() => void exportSchematic("copy")}>
            {copied ?? "Copy"}
          </button>
          <button type="button" className={btn} data-testid="wv-sch-png"
            title="Save the drawing as a PNG"
            onClick={() => void exportSchematic("png")}>
            PNG
          </button>
          <button type="button" className={btn} data-testid="wv-sch-print"
            title="Print a Schematic (§3.8)"
            onClick={() => void exportSchematic("print")}>
            Print
          </button>
          <button type="button" className={btn} title="Refresh — re-read the downhole data"
            onClick={() => void qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic", idwell] })}>
            Refresh
          </button>
        </div>
      </div>
      <SchematicTemplates db={db} layers={layers} setLayers={setLayers}
        smartScaling={smartScaling} setSmartScaling={setSmartScaling}
        showProposed={showProposed} setShowProposed={setShowProposed} />
      <div className="px-3 py-0.5 text-[10px] text-gray-400 border-b border-gray-50 shrink-0">
        Click an item to edit its subject area. Widths from component nominal OD;
        depths from the reference datum, which every depth here is labelled with.
      </div>
      <div className="flex-1 overflow-auto" ref={svgBox}>
        <SchematicSvg s={s} date={date} boreId={boreId || null} showProposed={showProposed}
          scale={scale} layers={layers} smartScaling={smartScaling} onEditTable={onEditTable}
          tracks={tracks} stations={trackQ.data?.stations ?? null}
          surveyName={link?.surveyName ?? null} datumShift={datumShift} />
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
function SchematicSvg({
  s, date, boreId, showProposed, scale, layers, smartScaling, onEditTable,
  tracks, stations, surveyName, datumShift,
}: {
  s: WvSchematic; date: string; boreId: string | null; showProposed: boolean;
  scale: number; layers: Record<SchematicLayer, boolean>; smartScaling: boolean;
  onEditTable: (table: string) => void;
  /** §8.3 Tracks: which extra depth-scaled columns to draw. */
  tracks?: { tvd: boolean; incl: boolean };
  /** The linked survey's stations, or null while loading / when none is linked. */
  stations?: { md: number; tvd: number; inclination: number }[] | null;
  surveyName?: string | null;
  /** Tools > Reference Datum, resolved for this well. Null while it loads. */
  datumShift?: DatumShift | null;
}) {
  /**
   * Every depth drawn here — the axis, the shoe labels, the tooltips — is one
   * measured depth in the model's base unit, so the payload's one spec converts
   * the whole diagram. One decimal: a converted depth's remaining digits are
   * noise on a drawing.
   */
  const [unitSet] = useUnitSet();
  const depthSpec = s.depth ?? {};
  const depthUnit = displayUnitLabel(depthSpec, unitSet, datumShift);
  const fmtDepth = (n: number): string => {
    const d = toDisplay(n, depthSpec, unitSet, datumShift);
    return d ? formatUnitValue(d.value, { unit: d.unit, decimals: 1 }) : String(Number(n.toFixed(1)));
  };
  /**
   * Hole and pipe SIZES are stored in metres too, and were being printed raw
   * with an inch mark after them — a 12 1/4" hole read as 0.3111499845981598".
   * The model shows them in inches as a fraction, so this says 12 1/4 in.
   */
  const sizeSpec = s.size ?? {};
  const fmtSize = (v: string | number | null | undefined): string => {
    const n = num(v);
    if (n === null) return "?";
    const d = toDisplay(n, sizeSpec, unitSet);
    return d ? `${formatUnitValue(d.value, d)} ${d.unit}` : String(n);
  };
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

  // Each set is gated by its §8.3 group list before anything is drawn or
  // measured, so a template that hides a layer also stops it from setting
  // the depth axis.
  const casings = (layers.casing ? s.casings : []).filter((c) => inHole(c, date) && boreFilter(c));
  const tubings = (layers.tubing ? s.tubings : []).filter((t) => inHole(t, date) && boreFilter(t));
  const rods = (layers.rods ? s.rods : []).filter((r) => inHole(r, date) && boreFilter(r));
  const other = (layers.otherInHole ? s.otherInHole : []).filter((o) => inHole(o, date) && boreFilter(o));
  const propCasings = showProposed ? s.casings.filter((c) => isProposed(c) && boreFilter(c)) : [];
  const propTubings = showProposed ? s.tubings.filter((t) => isProposed(t) && boreFilter(t)) : [];
  const sizes = (layers.holeSizes ? s.sizes : []).filter((z) => {
    const start = dstr(z.DtTmStart);
    return (!start || start <= date);
  });
  const perfs = (layers.perforations ? s.perforations : []).filter((p) => {
    const d = dstr(p.DtTm);
    return (!d || d <= date) && String(p.Proposed ?? "") !== "1" && boreFilter(p);
  });
  const cement = (layers.cement ? s.cement : []).filter((c) => {
    const d = dstr(c.DtTmStart);
    return (!d || d <= date) && String(c.Proposed ?? "") !== "1";
  });
  const cementStages = (layers.cement ? s.cementStages ?? [] : []).filter((c) => {
    const d = dstr(c.DtTmStart);
    return (!d || d <= date) && String(c.Proposed ?? "") !== "1";
  });

  /**
   * The depth axis.
   *
   * §8.3 SmartScaling "adjusts the view so that only equipment that appears on
   * the selected date is used in the scaling algorithm". With it OFF the axis
   * spans everything the well ever held, so stepping the history player keeps
   * one scale and the string genuinely grows down the track. With it ON the
   * axis fits the selected date, which is what you want on an early date that
   * would otherwise draw as a sliver at the top of an empty track. Off by
   * default: an axis that silently rescales under a moving picture is the
   * harder one to read.
   */
  const depthsOf = (dated: boolean): number[] => {
    const out: number[] = [];
    const strings = dated
      ? [casings, tubings, rods, other, propCasings, propTubings]
      : [s.casings, s.tubings, s.rods, s.otherInHole];
    for (const set of strings) for (const r of set) { const d = num(r.DepthBtm); if (d) out.push(d); }
    for (const z of (dated ? sizes : s.sizes)) { const d = num(z.DepthBtmActual); if (d) out.push(d); }
    for (const p of (dated ? perfs : s.perforations)) {
      const d = num(p.DepthBtm) ?? num(p.DepthTop); if (d) out.push(d);
    }
    // Zones are geology, not equipment: they are in the well whatever the date,
    // so SmartScaling does not exclude them.
    for (const z of (layers.zones ? s.zones : [])) { const d = num(z.DepthBtm); if (d) out.push(d); }
    return out;
  };
  const maxDepth = Math.max(100, ...depthsOf(smartScaling)) * 1.04;

  const H = 640, W = 560, CX = 240, TOP = 24;
  const y = (depth: number) => TOP + (depth / maxDepth) * (H - TOP - 16);

  const ods: number[] = [];
  for (const c of [...casings, ...propCasings]) { const o = num(c.maxOd); if (o) ods.push(o); }
  for (const z of sizes) { const o = num(z.Sz); if (o) ods.push(o); }
  /*
   * The scale every string's width is drawn against.
   *
   * This was `Math.max(4, ...ods)` — a floor that made sense when the number was
   * INCHES. These ODs are metres: 0.027 to 0.914 across the whole sample, so the
   * floor won every time and the scale was pinned at 4 whatever the well held.
   * Everything then drew at about a fifth of the width the layout allows, and
   * the smallest pipe hit the 4 px minimum and stopped being distinguishable.
   *
   * Fixed here rather than separately because the lateral offset below is
   * derived from these widths: two strings side by side only fit inside the
   * casing if the casing is drawn the width it should be.
   */
  const widest = ods.length ? Math.max(...ods) : 0;
  const maxOd = widest > 0 ? widest : 1;
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
        <title>{`Hole ${fmtSize(z.Sz)} — ${fmtDepth(top)}–${fmtDepth(btm)} (wvWellboreSize)`}</title>
      </rect>,
    );
  }

  // zones: green bands behind strings
  for (const [i, z] of (layers.zones ? s.zones : []).entries()) {
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

  /**
   * Where a string is drawn FROM.
   *
   * WellView stores no top for a string — the guide says to enter "the set
   * depth or bottom of the string" — so the top is summed from the components
   * that were recorded, and the payload carries it as `DepthTopCalc`.
   *
   * Drawing every string from surface put steel on the diagram that nobody
   * entered: a liner with a 3,627 m shoe and 1,609 m of pipe was drawn with
   * 2,018 m that is not there, and a 120 m isolation string at 4,220 m was
   * drawn as 4.1 km of tubing. 56 of the sample's 169 strings start below zero;
   * 30 of them by more than 50 m.
   *
   * Falls back to the surface when nothing was recorded to sum, which is the
   * old behaviour and the only honest answer when the tally is absent entirely.
   */
  const topOf = (r: WvSchematicRow): number | null => {
    const t = num(r.DepthTopCalc ?? null);
    // A metre is the threshold for "hung", not zero. A tally that sums to 0.04 m
    // short of the shoe is a rounding artefact of the joint lengths, not a
    // string hanging 4 cm down — and labelling it "hung 0.0" reads as nonsense
    // next to a real liner hung at 2,017.8.
    return t != null && t >= 1 ? t : null;
  };
  /** …and where that lands on the drawing. */
  const yTop = (r: WvSchematicRow): number => {
    const t = topOf(r);
    return t == null ? TOP : y(t);
  };

  /**
   * Which side of the hole a string was run on.
   *
   * A dual completion is two strings side by side. Both were drawn on the
   * centreline, one over the other, so Sample 07's long string to 3,209.9 m and
   * short string to 3,093.7 m — run the same day, neither pulled — read as a
   * single string. 16 strings in 6 wells are affected.
   *
   * Case-folded because the data is not consistent: "Right" appears 6 times and
   * "right" twice, "Left" 6 and "left" twice. Anything else, including absent,
   * is centre — which is what 42 of the sample's strings are, and none of them
   * may move.
   */
  const latSide = (r: WvSchematicRow): -1 | 0 | 1 => {
    const v = String(r.LatPosition ?? "").trim().toLowerCase();
    return v === "left" ? -1 : v === "right" ? 1 : 0;
  };
  /**
   * …translated into pixels, and kept INSIDE the pipe it hangs in.
   *
   * The gap is the string's own half-width plus two, so a pair never overlaps.
   * It is then bounded by the narrowest casing the string could be inside, so a
   * dual completion in a slim hole crowds the centre rather than being drawn
   * through the casing wall. No vendor rule exists for the spacing — the guide
   * says only that one string is on the left and a second on the right — so
   * this is a drawing choice, not a recorded fact.
   */
  const innerHalfW = (() => {
    const w = casings.map((c) => halfW(num(c.maxOd ?? null))).filter((n) => n > 0);
    return w.length ? Math.min(...w) : 30;
  })();
  const latDx = (r: WvSchematicRow, hw: number): number => {
    const side = latSide(r);
    if (side === 0) return 0;
    return side * Math.max(2, Math.min(hw + 2, innerHalfW - hw - 1));
  };

  // casings: pair of verticals + shoe triangles; proposed variants dashed
  const drawCasing = (c: WvSchematicRow & { maxOd?: number | null }, i: number, proposed: boolean) => {
    const btm = num(c.DepthBtm);
    if (btm == null) return;
    const hw = halfW(num(c.maxOd ?? null));
    const yb = y(btm);
    const yt = yTop(c);
    const hung = topOf(c);
    const stroke = proposed ? "#9ca3af" : "#111827";
    const dash = proposed ? "6 3" : undefined;
    items.push(
      <g key={`${proposed ? "pcas" : "cas"}${i}`} className="cursor-pointer" onClick={() => onEditTable("wvCas")}>
        <title>{`${c.Des ?? "Casing"}${proposed ? " (proposed)" : ""} — `
          + `${hung != null ? `hung ${fmtDepth(hung)} to ` : ""}shoe ${fmtDepth(btm)} (wvCas)`}</title>
        <line x1={CX - hw} y1={yt} x2={CX - hw} y2={yb} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />
        <line x1={CX + hw} y1={yt} x2={CX + hw} y2={yb} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />
        <path d={`M ${CX - hw} ${yb} l -7 0 l 7 -9 z`} fill={stroke} />
        <path d={`M ${CX + hw} ${yb} l 7 0 l -7 -9 z`} fill={stroke} />
        <text x={CX - hw - 10} y={yb + 4} fontSize="9" fill={proposed ? "#9ca3af" : "#374151"} textAnchor="end">
          {String(c.Des ?? "csg")}{proposed ? " (prop.)" : ""} @ {fmtDepth(btm)}
        </text>
      </g>,
    );
    if (proposed) return;
    /*
     * Cement on this string, drawn between the depths that were RECORDED.
     *
     * This used to be a 60-pixel strip hanging above the shoe whatever was
     * pumped — a decoration that looked like data. The depths live on the
     * STAGES (§7.2 "in the Cement Stages folder, make sure that the Top Depth
     * and Bottom Depth information is entered"), not on wvCement, which has no
     * depth column at all.
     *
     * A stage with a drill-out depth is drawn only BELOW that depth: §7.2
     * "Cement Plug Still Visible" says entering the depth drilled out to is
     * what removes the drilled part from the picture. A stage still showing
     * its full height after the plug was drilled is the complaint the guide is
     * answering.
     */
    /*
     * …AND WHICH OF THE THREE KINDS IT IS.
     *
     * The guide: "There are three types of cement: Casing cement, Plugs,
     * Squeezes … WellView draws the applicable icon on the schematic using the
     * type you select for the record."
     *
     * All three were drawn identically, as two hatched strips in the ANNULUS —
     * cement behind pipe. A plug is not behind pipe: it fills the bore, and the
     * whole reason to look at one on a schematic is that it is in the way of a
     * re-entry. A squeeze is neither: it is cement forced out through the wall
     * at an interval. 36 of the sample's 113 cement records are one of the two
     * that were being drawn as the third.
     *
     * The stored value is a table name or a caption depending on the row —
     * "casing", "Casing", "plug", "Plug", "squeeze" all occur — so it is
     * matched case-insensitively on a substring rather than compared.
     */
    const cementKind = (m: WvSchematicRow): "plug" | "squeeze" | "casing" => {
      const t = `${m.CementTyp ?? ""} ${m.CementSubTyp ?? ""}`.toLowerCase();
      if (t.includes("squeeze")) return "squeeze";
      if (t.includes("plug")) return "plug";
      return "casing";
    };

    const stages = cementStages.filter(
      (m) => String(m.IDRecString ?? "") === String(c.IDRec ?? "-"));
    stages.forEach((m, k) => {
      const top = num(m.DepthTop), btm = num(m.DepthBtm);
      if (top == null || btm == null) return;
      const drilled = num(m.DepthDrillOut);
      // Drilled out to D: only what is deeper than D is still in the hole.
      const from = drilled != null ? Math.max(top, drilled) : top;
      if (from >= btm) return;                       // wholly drilled out
      const y0 = y(from), y1 = y(btm);
      if (y1 <= y0) return;
      const kind = cementKind(m);
      const label = kind === "plug" ? "Cement plug" : kind === "squeeze" ? "Squeeze" : "Cement stage";
      items.push(
        <g key={`cem${i}-${k}`} className="cursor-pointer" onClick={() => onEditTable("wvCementStage")}>
          <title>
            {`${m.Des ?? label} — ${label.toLowerCase()}, ${fmtDepth(top)} to ${fmtDepth(btm)}`
              + (drilled != null ? `, drilled out to ${fmtDepth(drilled)}` : "")
              + ` (wvCementStage)`}
          </title>
          {kind === "plug" ? (
            /* A PLUG FILLS THE BORE, so it is drawn across it — pipe width and
               all. Drawn behind nothing: it is the thing in the way. */
            <rect x={CX - hw} y={y0} width={hw * 2} height={y1 - y0} fill="url(#cemhatch)" />
          ) : kind === "squeeze" ? (
            /* A SQUEEZE went out THROUGH the wall at this interval: hatched in
               the annulus like casing cement, but bracketed so it reads as a
               placed interval rather than a column standing on a shoe. */
            <>
              <rect x={CX + hw + 1} y={y0} width={5} height={y1 - y0} fill="url(#cemhatch)" />
              <rect x={CX - hw - 6} y={y0} width={5} height={y1 - y0} fill="url(#cemhatch)" />
              <line x1={CX - hw - 8} x2={CX + hw + 8} y1={y0} y2={y0} stroke="#b45309" strokeWidth="1.2" />
              <line x1={CX - hw - 8} x2={CX + hw + 8} y1={y1} y2={y1} stroke="#b45309" strokeWidth="1.2" />
            </>
          ) : (
            <>
              <rect x={CX + hw + 1} y={y0} width={5} height={y1 - y0} fill="url(#cemhatch)" />
              <rect x={CX - hw - 6} y={y0} width={5} height={y1 - y0} fill="url(#cemhatch)" />
            </>
          )}
          {drilled != null && (
            /* the drill-out depth, so a shortened column is legible as such */
            <line x1={CX - hw - 8} x2={CX + hw + 8} y1={y(Math.max(top, drilled))}
              y2={y(Math.max(top, drilled))} stroke="#6b7280" strokeWidth="0.8" strokeDasharray="2 2" />
          )}
        </g>,
      );
    });
    // Cement recorded with no stage depths at all still deserves a mark, but a
    // small one at the shoe — not a strip pretending to a height.
    const bare = cement.filter((m) => String(m.IDRecString ?? "") === String(c.IDRec ?? "-")
      && !stages.some((st) => String(st.IDRecParent ?? "") === String(m.IDRec ?? "-")));
    if (bare.length) {
      items.push(
        <g key={`cemb${i}`} className="cursor-pointer" onClick={() => onEditTable("wvCementStage")}>
          <title>{`Cement × ${bare.length} on ${c.Des ?? "casing"} — no stage depths recorded, so its extent is unknown (wvCement)`}</title>
          <rect x={CX + hw + 1} y={yb - 8} width={5} height={8} fill="url(#cemhatch)" opacity={0.55} />
          <rect x={CX - hw - 6} y={yb - 8} width={5} height={8} fill="url(#cemhatch)" opacity={0.55} />
        </g>,
      );
    }
  };
  casings.forEach((c, i) => drawCasing(c, i, false));
  propCasings.forEach((c, i) => drawCasing(c, i, true));

  /*
   * The drill string in the hole, and the bit on the end of it
   * (§7.2 "Drilling OD Not Visible", "Bit Not Visible").
   *
   * Its depth range comes from the drilling parameters recorded against it —
   * wvJobDrillString has no depth column — so a string that was never drilled
   * with does not appear rather than appearing at surface. The width is the
   * largest component OD, which is what the guide means by "enter the OD for
   * each applicable record".
   *
   * Drawn last so it sits over the casing it is inside, and in a warm grey that
   * reads as steel-in-hole rather than as another string of pipe.
   */
  const drillStrings = (layers.drillString ? s.drillStrings ?? [] : []).filter((r) => {
    const run = dstr(r.DtTmRun), pull = dstr(r.DtTmPull);
    // In the hole on the selected date: run on or before it, not yet pulled.
    return (!run || run <= date) && (!pull || pull > date) && String(r.Proposed ?? "") !== "1";
  });
  drillStrings.forEach((r, i) => {
    const top = num(r.DepthTop) ?? 0;
    const btm = num(r.DepthBtm);
    if (btm == null) return;
    const hw = Math.max(2.5, halfW(num(r.maxOd ?? null)) * 0.42);
    const y0 = y(Math.max(0, top)), y1 = y(btm);
    const bit = r.bit;
    const bitLen = num(bit?.Length ?? null);
    // The bit occupies the bottom of the string; give it at least a few pixels
    // so it is visible on a well kilometres deep.
    const bitPx = bitLen != null ? Math.max(6, y(btm) - y(Math.max(0, btm - bitLen))) : 8;
    items.push(
      <g key={`ds${i}`} className="cursor-pointer" onClick={() => onEditTable("wvJobDrillString")}>
        <title>
          {`${r.Des ?? "Drill string"} — ${fmtDepth(top)} to ${fmtDepth(btm)}`
            + (bit?.Des ? `, bit ${bit.Des}` : "") + " (wvJobDrillString)"}
        </title>
        <rect x={CX - hw} y={y0} width={hw * 2} height={Math.max(1, y1 - y0 - bitPx)}
          fill="#78716c" opacity={0.55} />
        {bit && (
          /* the bit: a wedge at the bottom, sized to its own OD when recorded */
          <g>
            <title>{`${bit.Des ?? "Bit"}${bit.Typ ? ` — ${bit.Typ}` : ""} (wvJobDrillBit)`}</title>
            <polygon
              points={`${CX - Math.max(hw, halfW(num(bit.Sz ?? null)) * 0.42)},${y1 - bitPx} `
                + `${CX + Math.max(hw, halfW(num(bit.Sz ?? null)) * 0.42)},${y1 - bitPx} ${CX},${y1}`}
              fill="#44403c" />
          </g>
        )}
      </g>,
    );
  });

  // tubing: blue pair, inside; proposed dashed
  const drawTubing = (t: WvSchematicRow & { maxOd?: number | null }, i: number, proposed: boolean) => {
    const btm = num(t.DepthBtm);
    if (btm == null) return;
    const hw = Math.max(3, halfW(num(t.maxOd ?? null)) * 0.55);
    const cx = CX + latDx(t, hw);
    const side = latSide(t);
    items.push(
      <g key={`${proposed ? "ptub" : "tub"}${i}`} className="cursor-pointer" onClick={() => onEditTable("wvTub")}>
        <title>{`${t.Des ?? "Tubing"}${proposed ? " (proposed)" : ""} — `
          + `${side ? `${side < 0 ? "left" : "right"}, ` : ""}`
          + `${topOf(t) != null ? `hung ${fmtDepth(topOf(t)!)} to ` : ""}${fmtDepth(btm)} (wvTub)`}</title>
        <line x1={cx - hw} y1={yTop(t)} x2={cx - hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6"
          strokeDasharray={proposed ? "5 3" : undefined} opacity={proposed ? 0.6 : 1} />
        <line x1={cx + hw} y1={yTop(t)} x2={cx + hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6"
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
      <line key={`rod${i}`} x1={CX} y1={yTop(r)} x2={CX} y2={y(btm)} stroke="#6b7280" strokeWidth="1"
        strokeDasharray="4 2" className="cursor-pointer" onClick={() => onEditTable("wvRod")}>
        <title>{`${r.Des ?? "Rod string"} — `
          + `${topOf(r) != null ? `hung ${fmtDepth(topOf(r)!)} to ` : ""}${fmtDepth(btm)} (wvRod)`}</title>
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

  // Depth axis. The ticks are chosen in the unit the reader SEES — 0, 2000,
  // 4000 ft — not in stored metres converted after the fact, which would put
  // them on 1,640.4 and 3,280.8. Each tick converts back to place its line.
  const axis: React.ReactNode[] = [];
  const shownMax = toDisplay(maxDepth, depthSpec, unitSet, datumShift)?.value ?? maxDepth;
  const step = niceStep(shownMax);
  for (let t = 0; t <= shownMax; t += step) {
    const base = fromDisplay(String(t), depthSpec, unitSet, datumShift) ?? t;
    axis.push(
      <g key={`ax${t}`}>
        <line x1={30} y1={y(base)} x2={36} y2={y(base)} stroke="#9ca3af" strokeWidth="1" />
        <text x={26} y={y(base) + 3} fontSize="9" fill="#6b7280" textAnchor="end">
          {t.toLocaleString()}
        </text>
      </g>,
    );
  }

  /*
   * §8.3 Tracks — extra columns on the SAME depth scale as the drawing.
   *
   * Each is a simple curve of the survey value against measured depth, drawn to
   * the right of the diagram so the axis it shares is obvious. The survey's own
   * MD range need not reach the deepest item on the picture, so the curve stops
   * where the survey stops rather than being extrapolated: a track that carried
   * on past its last station would be inventing a hole angle.
   */
  const trackCols: React.ReactNode[] = [];
  const wanted = [
    tracks?.tvd ? { key: "tvd", label: "TVD", get: (st: { tvd: number }) => st.tvd, spec: depthSpec } : null,
    tracks?.incl ? { key: "incl", label: "Incl°", get: (st: { inclination: number }) => st.inclination, spec: {} } : null,
  ].filter(Boolean) as { key: string; label: string; get: (st: never) => number; spec: typeof depthSpec }[];
  const TRACK_W = 66;
  const trackLeft = W - 8 - wanted.length * TRACK_W;
  wanted.forEach((t, ti) => {
    const x0 = trackLeft + ti * TRACK_W;
    const pts = (stations ?? [])
      .filter((st) => Number.isFinite(st.md) && Number.isFinite(t.get(st as never)))
      .sort((a, b) => a.md - b.md);
    const vals = pts.map((st) => t.get(st as never));
    const hi = Math.max(1, ...vals);
    trackCols.push(
      <g key={`tr${t.key}`}>
        <rect x={x0} y={TOP - 14} width={TRACK_W - 6} height={H - TOP - 2} fill="#f8fafc" stroke="#e2e8f0" />
        <text x={x0 + (TRACK_W - 6) / 2} y={TOP - 4} fontSize="9" fill="#475569" textAnchor="middle">
          {t.label}
        </text>
        {pts.length > 1 ? (
          <polyline fill="none" stroke="#0f766e" strokeWidth="1.2"
            points={pts.map((st) => {
              const v = t.get(st as never);
              const shown = t.spec.unit ? toDisplay(v, t.spec, unitSet, datumShift)?.value ?? v : v;
              const shownHi = t.spec.unit ? toDisplay(hi, t.spec, unitSet, datumShift)?.value ?? hi : hi;
              const x = x0 + 3 + (shown / (shownHi || 1)) * (TRACK_W - 12);
              return `${x},${y(Math.min(st.md, maxDepth))}`;
            }).join(" ")} />
        ) : (
          <text x={x0 + (TRACK_W - 6) / 2} y={TOP + 24} fontSize="8" fill="#94a3b8" textAnchor="middle">
            {stations ? "no stations" : "loading…"}
          </text>
        )}
        {pts.length > 1 && (
          <text x={x0 + (TRACK_W - 6) / 2} y={H - 4} fontSize="7" fill="#94a3b8" textAnchor="middle">
            0–{Math.round(t.spec.unit ? toDisplay(hi, t.spec, unitSet)?.value ?? hi : hi).toLocaleString()}
          </text>
        )}
        <title>{`${t.label} from ${surveyName ? `survey "${surveyName}"` : "the linked deviation survey"}`
          + ` — ${pts.length} stations, on the same depth scale as the drawing`}</title>
      </g>,
    );
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * scale} height={H * scale} className="mx-auto block"
      role="img" aria-label="Wellbore schematic">
      {trackCols}
      <defs>
        <pattern id="cemhatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="4" fill="#e5e7eb" />
          <line x1="0" y1="0" x2="0" y2="4" stroke="#6b7280" strokeWidth="1.2" />
        </pattern>
      </defs>
      <line x1={36} y1={TOP} x2={36} y2={H - 16} stroke="#d1d5db" strokeWidth="1" />
      {depthUnit && (
        <text x={26} y={TOP - 8} fontSize="9" fill="#9ca3af" textAnchor="end">{depthUnit}</text>
      )}
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

// ── Survey tab ────────────────────────────────────────────────────────────────
/**
 * A directional survey with the values WellView computes at print time.
 *
 * The database holds MD, inclination and azimuth; TVD, N/S, E/W, vertical
 * section, departure and the dogleg are `calculated` fields with no columns at
 * all. They are integrated by minimum curvature on the server and marked as
 * COMPUTED here — the same green the Edit Data grid gives a calculated field —
 * so nothing on this page is mistaken for something the database stores.
 */
function SurveyTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const [surveyId, setSurveyId] = useState<string>("");
  const [unitSet] = useUnitSet();
  const { shift: datumShift } = useDatumShift(db, idwell);

  const listQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvWellboreDirSurvey", idwell, null, false],
    queryFn: () => wvDbApi.records(db, "wvWellboreDirSurvey", { idwell }),
  });
  const surveys = listQ.data?.rows ?? [];
  useEffect(() => {
    if (!surveyId && surveys.length) setSurveyId(String(surveys[0].IDRec));
  }, [surveys, surveyId]);

  const q = useQuery({
    queryKey: ["wvdb", db, "survey", surveyId],
    queryFn: () => wvDbApi.survey(db, surveyId),
    enabled: !!surveyId,
  });

  /** Every survey column carries a base unit; show it in the user's set. */
  const cell = (v: number | null, col: { unit?: string; units?: Record<string, UnitFormat> }) => {
    if (v == null) return <span className="text-gray-300">—</span>;
    const d = toDisplay(v, col, unitSet, datumShift);
    return <>{d ? formatUnitValue(d.value, d) : Number(v.toFixed(2)).toLocaleString()}</>;
  };

  if (listQ.isLoading) return <div className="p-4 text-sm text-gray-400">Reading surveys…</div>;
  if (!surveys.length) {
    return (
      <div className="flex-1 grid place-items-center text-sm text-gray-400 px-6 text-center">
        This well has no directional survey. Surveys are entered under
        Wellbores → Deviation Surveys → Survey Data.
      </div>
    );
  }

  const data = q.data;
  return (
    <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-lg bg-white">
      <div className="px-2 py-1.5 border-b border-gray-100 flex items-center gap-2 flex-wrap shrink-0">
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Survey
          <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)}
            className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal max-w-[22rem]">
            {surveys.map((r) => (
              <option key={String(r.IDRec)} value={String(r.IDRec)}>
                {String(r.Des ?? r.IDRec)}{r.Definitive === "1" ? " · definitive" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="text-[11px] text-gray-500">
          {data ? `${data.stations.length} stations · ${data.method}` : ""}
        </span>
        <button type="button" onClick={() => onEditTable("wvWellboreDirSurveyData")}
          className="ml-auto h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          Edit stations
        </button>
      </div>

      {q.isLoading ? (
        <div className="p-4 text-sm text-gray-400">Computing…</div>
      ) : q.error ? (
        <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {(q.error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="px-3 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
            The shaded columns are <b>computed here</b> by minimum curvature — WellView calculates
            them at print time and stores none of them.
            {data.excludedBadStations > 0 && (
              <> {data.excludedBadStations} station{data.excludedBadStations === 1 ? "" : "s"} flagged
              &ldquo;bad survey data&rdquo; {data.excludedBadStations === 1 ? "was" : "were"} excluded.</>
            )}
            {data.assumedAzimuth > 0 && (
              <> {data.assumedAzimuth} station{data.assumedAzimuth === 1 ? "" : "s"} record no azimuth
              (an inclination-only survey); their bearing is carried from the last stated one, marked
              &deg;<sup>?</sup>. TVD, dogleg and build rate are unaffected — NS, EW and VS rest on that
              carry.</>
            )}
            {data.verticalSection && <> {data.verticalSection}.</>}
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  {data.columns.map((c) => (
                    <th key={c.key}
                      className={`px-2 py-1 text-right font-medium whitespace-nowrap ${
                        c.computed ? "text-green-700 bg-green-50" : "text-gray-600"}`}>
                      {c.label}
                      {c.unit && (
                        <span className="ml-1 font-normal text-gray-400">
                          ({displayUnitLabel(c, unitSet, datumShift)})
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stations.map((s, i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                    {data.columns.map((c) => (
                      <td key={c.key}
                        className={`px-2 py-0.5 text-right tabular-nums whitespace-nowrap ${
                          c.computed ? "bg-green-50/60 text-green-900" : "text-gray-800"}`}
                        title={s.azimuthAssumed && c.key === "azimuth"
                          ? "No azimuth recorded at this station — the last stated bearing is carried"
                          : s.overridden && c.computed ? "A stored override supplied this value" : undefined}>
                        {cell(s[c.key as keyof typeof s] as number | null, c)}
                        {s.overridden && c.key === "tvd" && <span className="ml-1 text-amber-600" title="Override">*</span>}
                        {s.azimuthAssumed && c.key === "azimuth" && (
                          <sup className="ml-0.5 text-amber-600" title="Assumed — carried from the last stated bearing">?</sup>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 py-1 border-t border-gray-100 text-[10px] text-gray-400 leading-snug">
            {data.notes.join(" ")}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Schematic templates (§8.3): a name over the settings above.
 *
 * "Users can set up a standard list of settings in the schematic templates,
 * which provide various layouts to describe different data. For example: A
 * Completions template will portray completions data." Chevron's own live in
 * custom/schematics — those folders are empty in this export, so these are the
 * app's own rather than a decoded format, and the row says so.
 */
function SchematicTemplates({
  db, layers, setLayers, smartScaling, setSmartScaling, showProposed, setShowProposed,
}: {
  db: string;
  layers: Record<SchematicLayer, boolean>;
  setLayers: (l: Record<SchematicLayer, boolean>) => void;
  smartScaling: boolean;
  setSmartScaling: (v: boolean) => void;
  showProposed: boolean;
  setShowProposed: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The template currently applied, so Update/Rename/Copy/Delete have a target. */
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["wvdb", db, "schematic-templates"],
    queryFn: () => wvDbApi.schematicTemplates(db),
  });

  const apply = (settings: Record<string, unknown>) => {
    const l = settings.layers as Record<SchematicLayer, boolean> | undefined;
    if (l) setLayers({ ...layers, ...l });
    setSmartScaling(settings.smartScaling === true);
    setShowProposed(settings.showProposed === true);
  };

  const templates = q.data?.templates ?? [];
  const current = templates.find((t) => t.id === picked) ?? null;

  /**
   * §8.3 gives Edit, Copy and Delete as three separate procedures, and the row
   * offered none of them: Save always created, so re-using a name was refused
   * with a 409 and a template could only ever be added.
   *
   * `id` present updates in place; absent creates. That is the API's own
   * contract — only the UI never used it.
   */
  const save = async (opts: { id?: string; name: string } = { name: name.trim() }) => {
    setError(null);
    setBusy(true);
    try {
      const saved = await wvDbApi.saveSchematicTemplate(db, {
        ...(opts.id ? { id: opts.id } : {}),
        name: opts.name,
        settings: { layers, smartScaling, showProposed },
      });
      await qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic-templates"] });
      setNaming(false);
      setName("");
      if (saved?.id) setPicked(saved.id);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  /** Edit a Template — write the settings now on screen back into it. */
  const update = () => { if (current) void save({ id: current.id, name: current.name }); };

  /** Copy a Template — "the copy appears with (copy) beside the name" (§8.3). */
  const copy = () => {
    if (!current) return;
    const base = `${current.name} (copy)`;
    // A second copy of the same template must not collide with the first.
    let next = base, n = 2;
    while (templates.some((t) => t.name === next)) next = `${base} ${n++}`;
    void save({ name: next });
  };

  /** Rename — the same update, with a name the user types. */
  const rename = () => {
    if (!current) return;
    const next = window.prompt("Rename this schematic template", current.name)?.trim();
    if (!next || next === current.name) return;
    void save({ id: current.id, name: next });
  };

  const remove = async () => {
    if (!current) return;
    if (!window.confirm(`Delete the schematic template "${current.name}"?`)) return;
    setError(null);
    setBusy(true);
    try {
      await wvDbApi.deleteSchematicTemplate(db, current.id);
      await qc.invalidateQueries({ queryKey: ["wvdb", db, "schematic-templates"] });
      setPicked("");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const on = Object.values(layers).filter(Boolean).length;
  return (
    <div className="px-3 py-1 border-b border-gray-100 flex items-center gap-1.5 flex-wrap shrink-0">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">Show</span>
      {SCHEMATIC_LAYERS.map((l) => (
        <label key={l.key} className="flex items-center gap-1 text-[11px] text-gray-600"
          data-testid={`wv-sch-layer-${l.key}`}>
          <input type="checkbox" checked={layers[l.key]}
            onChange={(e) => setLayers({ ...layers, [l.key]: e.target.checked })} />
          {l.label}
        </label>
      ))}
      <span className="text-[10px] text-gray-400 tabular-nums">{on}/{SCHEMATIC_LAYERS.length}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Template
          <select data-testid="wv-sch-template" value={picked}
            onChange={(e) => {
              setPicked(e.target.value);
              const t = templates.find((x) => x.id === e.target.value);
              if (t) apply(t.settings);
            }}
            className="h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal max-w-[12rem]">
            <option value="">Choose…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        {/* §8.3 Edit / Copy / Delete a Template, on whichever one is applied. */}
        {current && !naming && (
          <>
            <button type="button" onClick={update} disabled={busy} data-testid="wv-sch-update"
              title={`Edit a Template (§8.3) — save what is on screen into "${current.name}"`}
              className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              Update
            </button>
            <button type="button" onClick={rename} disabled={busy} data-testid="wv-sch-rename"
              title="Rename this template"
              className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              Rename
            </button>
            <button type="button" onClick={copy} disabled={busy} data-testid="wv-sch-copy-tpl"
              title="Copy a Template (§8.3) — the copy appears with (copy) beside the name"
              className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
              Copy
            </button>
            <button type="button" onClick={() => void remove()} disabled={busy} data-testid="wv-sch-delete"
              title="Delete a Template (§8.3)"
              className="h-7 px-2 text-[11px] rounded border border-red-200 bg-white text-red-700 hover:bg-red-50 disabled:opacity-40">
              Delete
            </button>
          </>
        )}
        {naming ? (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              placeholder="Template name" data-testid="wv-sch-name"
              className="h-7 border border-gray-300 rounded px-2 text-xs w-40" />
            <button type="button" onClick={() => void save()} disabled={!name.trim()}
              data-testid="wv-sch-save"
              className="h-7 px-2 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
              Save
            </button>
            <button type="button" onClick={() => { setNaming(false); setError(null); }}
              className="h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
          </>
        ) : (
          <button type="button" onClick={() => setNaming(true)} data-testid="wv-sch-new"
            title="Save these settings as a template (§8.3)"
            className="h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            Save as template
          </button>
        )}
        {error && <span className="text-[11px] text-red-700" data-testid="wv-sch-error">{error}</span>}
      </div>
    </div>
  );
}

/**
 * The wellhead (manual §3.8 subject area "Wellhead"), which WellView draws with
 * Peloton.Visualizer.WellView.Wellhead.dll.
 *
 * What the data will and will not support, because it decides the whole design:
 * the ASSEMBLY carries a picture — `wvWellhead.IconName` is one of the
 * "Wellhead 01".."Wellhead 08" or steel-plate images, and every one of them
 * resolves in the converted icon library. The COMPONENTS carry no icon and no
 * sequence column, and `Sect` — the only thing that hints at a position — is
 * null on 23 of the sample's 35 rows. There is nothing to stack.
 *
 * So this draws the recorded assembly image large, and lays the specification
 * out beside it: the head's rating, then each component with its make, model,
 * serial, bore, working pressures, connection sizes and ring gaskets, and the
 * outlets and their valves nested underneath. Inventing a vertical arrangement
 * of real pressure-containing equipment would look more like WellView and mean
 * less, and on a wellhead a wrong picture is worse than an honest list.
 */
function WellheadTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const qc = useQueryClient();
  const [unitSet] = useUnitSet();
  const q = useQuery({
    queryKey: ["wvdb", db, "wellheads", idwell],
    queryFn: () => wvDbApi.wellheads(db, idwell),
  });
  const [openId, setOpenId] = useState<string | null>(null);

/**
   * A recorded value, rendered the way the model says it should be read.
   *
   * The database stores a boolean as 0/1 and a date as a full ISO timestamp;
   * printing either raw turns a specification into something the reader has to
   * decode. "Proposed Wellhead? 0" in particular reads as a quantity, not as No.
   */
  const show = (f: WvWellheadField) => {
    if (f.type === "boolean") return Number(f.value) ? "Yes" : "No";
    if (f.type === "datetime") {
      const t = String(f.value);
      // Midnight is WellView's "date only"; keep the time when there is one.
      return /T00:00:00/.test(t) ? t.slice(0, 10) : t.replace("T", " ").replace(/(:\d\d)Z?$/, "");
    }
    const n = Number(f.value);
    if (f.unit && f.value !== "" && Number.isFinite(n)) {
      const d = toDisplay(n, { unit: f.unit, units: f.units as Record<string, UnitFormat> }, unitSet);
      if (d) return `${formatUnitValue(d.value, d)} ${d.unit}`;
    }
    return String(f.value);
  };

  if (q.isLoading) return <div className="p-4 text-sm text-gray-400">Reading the wellhead…</div>;
  if (q.error) {
    return <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      {(q.error as Error).message}
    </div>;
  }
  const heads: WvWellhead[] = q.data?.wellheads ?? [];
  const btn = "h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50";

  /** The label/value grid used at every level of the assembly. */
  const Spec = ({ fields, cols }: { fields: WvWellheadField[]; cols: string }) => (
    <dl className={`grid ${cols} gap-x-4 gap-y-0.5 text-[11px]`}>
      {fields.map((f) => (
        <div key={f.column} className="flex gap-1.5 min-w-0">
          <dt className="text-gray-400 shrink-0">{f.label}</dt>
          <dd className="text-gray-800 font-medium truncate" title={show(f)}>{show(f)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-white flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <span className="text-[10px] uppercase tracking-wide text-gray-400">Wellhead</span>
        <span className="text-xs text-gray-700 font-medium" data-testid="wv-wh-count">
          {heads.length} {heads.length === 1 ? "assembly" : "assemblies"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={btn} onClick={() => onEditTable("wvWellhead")}>
            Edit Data
          </button>
          <button type="button" className={btn} title="Refresh"
            onClick={() => void qc.invalidateQueries({ queryKey: ["wvdb", db, "wellheads", idwell] })}>
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-3">
        {!heads.length && (
          <div className="text-sm text-gray-400" data-testid="wv-wh-empty">
            No wellhead recorded for this well.
          </div>
        )}
        {heads.map((h) => {
          const open = openId === h.idrec;
          return (
            <section key={h.idrec} data-testid="wv-wh-head"
              className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex gap-4 p-3">
                {/* The picture WellView itself recorded for this assembly. */}
                <div className="shrink-0 w-32 flex flex-col items-center gap-1">
                  {h.icon ? (
                    <img src={`/wellview-icons/${h.icon}`} alt={h.iconName ?? "wellhead"}
                      data-testid="wv-wh-icon"
                      className="w-28 h-40 object-contain" loading="lazy" />
                  ) : (
                    <div className="w-28 h-40 border border-dashed border-gray-200 rounded flex items-center justify-center text-[10px] text-gray-300 text-center px-2">
                      no picture recorded
                    </div>
                  )}
                  {h.iconName && <span className="text-[10px] text-gray-400">{String(h.iconName)}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  {h.job && (
                    <div className="text-[11px] text-gray-500 mb-1.5" data-testid="wv-wh-job">
                      Installed on <span className="text-gray-800 font-medium">{h.job}</span>
                    </div>
                  )}
                  <Spec fields={h.fields} cols="grid-cols-2 lg:grid-cols-3" />
                  {h.components.length > 0 && (
                    <button type="button" data-testid="wv-wh-toggle"
                      onClick={() => setOpenId(open ? null : h.idrec)}
                      className="mt-2 text-[11px] text-blue-700 hover:underline">
                      {open ? "▾" : "▸"} {h.components.length} component{h.components.length === 1 ? "" : "s"}
                    </button>
                  )}
                </div>
              </div>

              {open && (
                <div className="border-t border-gray-100 bg-gray-50 p-3 space-y-2">
                  {h.components.map((c) => (
                    <div key={c.idrec} data-testid="wv-wh-comp"
                      className="bg-white border border-gray-200 rounded p-2">
                      <div className="text-[11px] font-semibold text-gray-900 mb-1">
                        {c.des ?? "Component"}
                      </div>
                      <Spec fields={c.fields.filter((f) => f.column.toLowerCase() !== "des")}
                        cols="grid-cols-2 lg:grid-cols-4" />
                      {c.outlets.map((o) => (
                        <div key={o.idrec} data-testid="wv-wh-outlet"
                          className="mt-1.5 ml-3 pl-2 border-l-2 border-gray-200">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Outlet</div>
                          <Spec fields={o.fields} cols="grid-cols-2 lg:grid-cols-4" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** The palette, so plan and actual stay distinguishable at a glance. */
const DVD_COLORS = ["#1d4ed8", "#0891b2", "#7c3aed", "#059669", "#d97706", "#dc2626"];

/**
 * Days vs Depth / Cost — the drilling curve WellView draws with
 * Peloton.DaysVsDepth.dll, from the three .dvdc templates it ships.
 *
 * Two deliberate departures from a naive reading of the template. WellView puts
 * depth and cost on two Y axes of one plot; here each Y UNIT gets its own plot,
 * because a depth line and a cost line sharing a frame invite reading one
 * against the other's scale, and the two have nothing to do with each other.
 * And the chart is scoped to a JOB — day 0 is the start of the job, so a well's
 * jobs are separate curves and are never concatenated.
 *
 * The depth axis runs downward, which is not decoration: a driller reads this
 * curve as the hole going down over time, and an upward depth axis reverses the
 * meaning of every slope on it.
 */
function DaysVsDepthTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const qc = useQueryClient();
  const [unitSet] = useUnitSet();
  const { shift: datumShift } = useDatumShift(db, idwell);
  const [job, setJob] = useState<string>("");
  const [template, setTemplate] = useState<string>("");
  const q = useQuery({
    queryKey: ["wvdb", db, "dvd", idwell, job, template],
    queryFn: () => wvDbApi.daysVsDepth(db, idwell, job || undefined, template || undefined),
  });

  /**
   * A value on an axis, in the user's unit set and from the chosen datum.
   *
   * Both depth axes carry applyDatum, so the curve moves with Tools > Reference
   * Datum exactly as the Schematic, the Survey tab and every grid do. Days and
   * cost do not, and toDisplay leaves them alone because the model says so —
   * the decision is not made here.
   */
  const conv = (v: number, a: WvDvdAxis) => {
    if (!a.unit) return v;
    const d = toDisplay(v,
      { unit: a.unit, units: a.units, applyDatum: a.applyDatum, datumMode: a.datumMode },
      unitSet, datumShift);
    return d ? d.value : v;
  };
  const axisUnit = (a: WvDvdAxis) => {
    if (!a.unit) return "";
    const u = displayUnitFor({ unit: a.unit, units: a.units }, unitSet);
    return u?.unit ?? a.unit;
  };

  if (q.isLoading) return <div className="p-4 text-sm text-gray-400">Building the curve…</div>;
  if (q.error) {
    return <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      {(q.error as Error).message}
    </div>;
  }
  const data = q.data!;
  const btn = "h-7 px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50";
  const sel = "h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 max-w-[16rem]";

  // One plot per Y unit: depth and cost do not share a scale.
  const groups = new Map<string, WvDvdSeries[]>();
  for (const s of data.series) {
    const k = s.y.unit ?? s.y.label;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(s);
  }

  return (
    <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-white flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-2 flex-wrap shrink-0">
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Job
          <select className={`${sel} normal-case tracking-normal`} data-testid="wv-dvd-job"
            value={job || data.job?.idrec || ""} onChange={(e) => setJob(e.target.value)}>
            {data.jobs.map((j) => (
              <option key={j.idrec} value={j.idrec}>
                {j.label} ({j.phases} phases, {j.reports} reports)
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
          Template
          <select className={`${sel} normal-case tracking-normal`} data-testid="wv-dvd-template"
            value={template || data.template?.id || ""} onChange={(e) => setTemplate(e.target.value)}>
            {data.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" className={btn} onClick={() => onEditTable("wvJobProgramPhase")}>
            Edit Phases
          </button>
          <button type="button" className={btn} title="Refresh"
            onClick={() => void qc.invalidateQueries({ queryKey: ["wvdb", db, "dvd", idwell] })}>
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-3 space-y-4">
        {!data.series.length && (
          <div className="text-sm text-gray-400" data-testid="wv-dvd-empty">
            {data.jobs.length
              ? "This job has no planned phases and no daily reports with time logged, so there is no curve to draw."
              : "No job on this well, so there is nothing to plot against."}
          </div>
        )}
        {[...groups.entries()].map(([key, series]) => (
          <DvdChart key={key} series={series} conv={conv} axisUnit={axisUnit}
            /* Depth reads downward; a cost axis reads upward like any other. */
            invertY={/^m$|^ft$/i.test(series[0].y.unit ?? "")} />
        ))}
        {data.unavailable.length > 0 && (
          <div className="text-[11px] text-gray-500 border-t border-gray-100 pt-2"
            data-testid="wv-dvd-unavailable">
            Not drawn — this job has no data for{" "}
            {data.unavailable.length === 1 ? "this series" : `these ${data.unavailable.length} series`}:{" "}
            <span className="text-gray-700">{data.unavailable.join("; ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One plot: every series that shares a Y unit, drawn on one pair of axes. */
function DvdChart({ series, conv, axisUnit, invertY }: {
  series: WvDvdSeries[];
  conv: (v: number, a: WvDvdAxis) => number;
  axisUnit: (a: WvDvdAxis) => string;
  invertY: boolean;
}) {
  const W = 860, H = 380, L = 74, R = 18, T = 16, B = 46;
  const pts = series.map((s) => s.points.map((p) => ({
    x: conv(p.x, s.x), y: conv(p.y, s.y), label: p.label,
  })));
  const flat = pts.flat();
  const xMax = Math.max(...flat.map((p) => p.x), 1);
  const yLo = Math.min(...flat.map((p) => p.y), 0);
  const yHi = Math.max(...flat.map((p) => p.y), 1);
  const span = yHi - yLo || 1;
  const sx = (v: number) => L + (v / xMax) * (W - L - R);
  const sy = (v: number) => {
    const f = (v - yLo) / span;
    return invertY ? T + f * (H - T - B) : H - B - f * (H - T - B);
  };
  /**
   * What to call an axis when the series on it are not all the same field.
   *
   * One plot holds "Planned End Depth" and "End Depth" together, and labelling
   * it with whichever came first tells the reader the actual line is a plan.
   * Listing all four names instead is honest but unreadable, so the axis takes
   * what the names have in COMMON — the trailing words they share, "End Depth"
   * — falling back to the unit's own name when they share nothing ("Cum Field
   * Est To Date" and "Planned Likely Cum Phase Cost" are both Cost). Each
   * series keeps its full name in the legend, which is where the detail belongs.
   */
  const axisName = (pick: (s: WvDvdSeries) => WvDvdAxis) => {
    const names = [...new Set(series.map((x) => pick(x).label))];
    if (names.length === 1) return names[0];
    const words = names.map((n) => n.split(/\s+/));
    const common: string[] = [];
    for (let i = 1; i <= Math.min(...words.map((w) => w.length)); i++) {
      const w = words[0][words[0].length - i];
      if (!words.every((x) => x[x.length - i] === w)) break;
      common.unshift(w);
    }
    if (common.length) return common.join(" ");
    const u = pick(series[0]).unit;
    return u && /^[A-Za-z]{3,}$/.test(u) ? u : names.join(" / ");
  };
  /** Don't print "Cost (Cost)" — the unit and the name are the same word. */
  const withUnit = (name: string, unit: string) =>
    !unit || name.toLowerCase() === unit.toLowerCase() ? name : `${name} (${unit})`;
  const ticks = (lo: number, hi: number, n = 5) =>
    Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  const fmt = (v: number) => formatUnitValue(v, { unit: "", decimals: Math.abs(v) >= 1000 ? 0 : 1 });

  return (
    <figure className="border border-gray-200 rounded-lg p-2" data-testid="wv-dvd-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label={series.map((s) => s.caption).join("; ")}>
        {ticks(yLo, yHi).map((v, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={L - 6} y={sy(v) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">{fmt(v)}</text>
          </g>
        ))}
        {ticks(0, xMax).map((v, i) => (
          <g key={i}>
            <line x1={sx(v)} x2={sx(v)} y1={T} y2={H - B} stroke="#f1f5f9" strokeWidth={1} />
            <text x={sx(v)} y={H - B + 14} textAnchor="middle" fontSize={10} fill="#94a3b8">{fmt(v)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#cbd5e1" />
        <line x1={L} x2={L} y1={T} y2={H - B} stroke="#cbd5e1" />
        <text x={(L + W - R) / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#475569">
          {withUnit(axisName((x) => x.x), axisUnit(series[0].x))}
        </text>
        <text x={14} y={(T + H - B) / 2} fontSize={11} fill="#475569"
          transform={`rotate(-90 14 ${(T + H - B) / 2})`} textAnchor="middle">
          {withUnit(axisName((x) => x.y), axisUnit(series[0].y))}
        </text>
        {pts.map((p, i) => (
          <polyline key={i} fill="none" strokeWidth={series[i].kind === "actual" ? 2 : 1.5}
            stroke={DVD_COLORS[i % DVD_COLORS.length]}
            /* Plan is dashed: it is an estimate and should not read as a record. */
            strokeDasharray={series[i].kind === "plan" ? "5 3" : undefined}
            points={p.map((q) => `${sx(q.x)},${sy(q.y)}`).join(" ")} />
        ))}
        {pts.map((p, i) => p.map((q, j) => (
          <circle key={`${i}-${j}`} cx={sx(q.x)} cy={sy(q.y)} r={2}
            fill={DVD_COLORS[i % DVD_COLORS.length]}>
            <title>{`${series[i].caption}\n${q.label ?? ""}\n${fmt(q.x)} ${axisUnit(series[i].x)} → ${fmt(q.y)} ${axisUnit(series[i].y)}`}</title>
          </circle>
        )))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 px-2 pt-1">
        {series.map((s, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-gray-600">
            <svg width={18} height={6}><line x1={0} x2={18} y1={3} y2={3} strokeWidth={2}
              stroke={DVD_COLORS[i % DVD_COLORS.length]}
              strokeDasharray={s.kind === "plan" ? "5 3" : undefined} /></svg>
            {s.caption}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/**
 * The report editor (§9.2 "Design Single Well Reports").
 *
 * WHAT THIS EDITS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * WellView's editor is a page designer: blocks dragged and sized on a fixed
 * sheet, master templates, fonts, colours, margins, layering. This app renders
 * a report as responsive HTML and leaves paper to the print view, so those
 * settings would have nothing to act on — offering a font picker that changed
 * nothing would be worse than not offering one.
 *
 * What it does edit is the part that decides what a report SAYS, which is the
 * same thing a decoded .afr carries: the anchor, the blocks, each block's
 * subject area, and the fields it prints in order. A saved report then goes
 * through the same resolver as Peloton's 182, so it gets the same unit
 * conversion, link captions, calculated fields and anchor scoping — not a
 * lookalike.
 */
function ReportEditor({ db, report, onClose, onSaved }: {
  db: string;
  report: WvSavedReport | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(report?.name ?? "");
  const [category, setCategory] = useState(report?.category === "My Reports" ? "" : report?.category ?? "");
  const [anchor, setAnchor] = useState(report?.definition.anchor ?? "");
  const [blocks, setBlocks] = useState<WvReportBlockDef[]>(
    report?.definition.blocks?.length
      ? report.definition.blocks.map((b) => ({ ...b, fields: [...b.fields] }))
      : [{ table: "", title: "", fields: [] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tablesQ = useQuery({
    queryKey: ["wvdb", db, "query-tables"],
    queryFn: () => wvDbApi.queryTables(db),
    staleTime: Infinity,
  });

  const setBlock = (i: number, patch: Partial<WvReportBlockDef>) =>
    setBlocks((bs) => bs.map((b, k) => (k === i ? { ...b, ...patch } : b)));

  const usable = blocks.filter((b) => b.table && b.fields.length);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await wvDbApi.saveReport(db, {
        ...(report ? { id: report.id } : {}),
        name: name.trim(),
        category: category.trim() || undefined,
        definition: { anchor: anchor || null, blocks: usable },
      });
      await onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full max-w-3xl mx-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} data-testid="wv-report-editor">
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">{report ? "Edit report" : "New report"}</span>
          <button type="button" onClick={onClose} data-testid="wv-re-close"
            className="ml-auto h-7 px-3 text-[11px] rounded bg-gray-700 hover:bg-gray-600">Close</button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-[11px] text-gray-600">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} data-testid="wv-re-name"
                placeholder="Daily cost summary"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-2 text-xs" />
            </label>
            <label className="text-[11px] text-gray-600">
              Category (optional)
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="My Reports" data-testid="wv-re-category"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-2 text-xs" />
            </label>
          </div>

          <label className="text-[11px] text-gray-600 block">
            Anchor (§9.2) — the subject area the report splits on
            <select value={anchor} onChange={(e) => setAnchor(e.target.value)}
              data-testid="wv-re-anchor"
              className="mt-0.5 w-full h-8 border border-gray-300 rounded px-1 text-xs bg-white">
              <option value="">None — one report for the whole well</option>
              <option value="wvJob">Job — one report per job</option>
              <option value="wvJobReport">Daily Operation — one report per day</option>
            </select>
          </label>

          <div>
            <p className="text-xs font-medium text-gray-800">Blocks</p>
            <p className="text-[11px] text-gray-500 mb-1.5">
              Each block prints one subject area. Fields print in the order listed — use the arrows
              to move one. Fields the app <b>computes</b> can be printed too; they are marked green
              on the report, as WellView marks them.
            </p>
            <ul className="space-y-2">
              {blocks.map((b, i) => (
                <li key={i} className="border border-gray-200 rounded p-2 space-y-1.5"
                  data-testid="wv-re-block">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select value={b.table} data-testid="wv-re-table"
                      onChange={(e) => setBlock(i, { table: e.target.value, fields: [] })}
                      className="h-8 border border-gray-300 rounded px-1 text-xs bg-white min-w-[12rem]">
                      <option value="">Subject area…</option>
                      {(tablesQ.data?.tables ?? []).map((t) => (
                        <option key={t.table} value={t.table}>{t.label}</option>
                      ))}
                    </select>
                    <input value={b.title ?? ""} onChange={(e) => setBlock(i, { title: e.target.value })}
                      placeholder="Block title (optional)" data-testid="wv-re-title"
                      className="h-8 border border-gray-300 rounded px-2 text-xs flex-1 min-w-[8rem]" />
                    <button type="button" data-testid="wv-re-block-remove"
                      onClick={() => setBlocks((bs) => bs.filter((_, k) => k !== i))}
                      disabled={blocks.length === 1} title="Remove this block"
                      className="h-8 w-8 text-xs rounded border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30">×</button>
                  </div>
                  {b.table && (
                    <ReportFields db={db} table={b.table} chosen={b.fields}
                      onChange={(fields) => setBlock(i, { fields })} />
                  )}
                </li>
              ))}
            </ul>
            <button type="button" data-testid="wv-re-block-add"
              onClick={() => setBlocks((bs) => [...bs, { table: "", title: "", fields: [] }])}
              className="mt-1.5 h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">
              Add a block
            </button>
          </div>

          <p className="text-[10px] text-gray-400 border-t border-gray-100 pt-2">
            The desktop editor also sets page size, margins, fonts, colours and master templates,
            and positions blocks on a sheet. This app renders reports as a page that reflows, and
            prints through the report&rsquo;s own Print view, so those settings are not offered
            rather than offered and ignored.
          </p>
        </div>

        <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-gray-500">
            {usable.length} block{usable.length === 1 ? "" : "s"} with fields
          </span>
          {error && <span className="text-[11px] text-red-700" data-testid="wv-re-error">{error}</span>}
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose}
              className="h-8 px-3 text-xs rounded border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="button" onClick={() => void save()} data-testid="wv-re-save"
              disabled={busy || !name.trim() || !usable.length}
              className="h-8 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
              {report ? "Save changes" : "Save report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The fields of one subject area, chosen and ORDERED.
 *
 * Order is the whole point — §9.2's editor has up/down arrows for exactly this
 * — so the chosen list is kept as a list, not a set, and the picker adds to
 * the end.
 */
function ReportFields({ db, table, chosen, onChange }: {
  db: string; table: string; chosen: string[]; onChange: (f: string[]) => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "query-fields", table],
    queryFn: () => wvDbApi.queryFields(db, table),
    enabled: !!table,
    staleTime: Infinity,
  });
  const all = q.data?.fields ?? [];
  const labelOf = (f: string) =>
    all.find((x) => x.field.toLowerCase() === f.toLowerCase())?.label ?? f;
  const move = (i: number, by: number) => {
    const next = [...chosen];
    const j = i + by;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <select value="" data-testid="wv-re-field-add"
          onChange={(e) => { if (e.target.value) onChange([...chosen, e.target.value]); }}
          className="h-8 border border-gray-300 rounded px-1 text-xs bg-white flex-1">
          <option value="">Add a field…</option>
          {all.filter((f) => !chosen.some((c) => c.toLowerCase() === f.field.toLowerCase()))
            .map((f) => <option key={f.field} value={f.field}>{f.label}</option>)}
        </select>
      </div>
      {!chosen.length && (
        <p className="text-[10px] text-gray-400">No fields yet — a block with none is not saved.</p>
      )}
      <ul className="space-y-0.5">
        {chosen.map((f, i) => (
          <li key={f} className="flex items-center gap-1 text-[11px]" data-testid="wv-re-field">
            <span className="w-5 text-gray-400 tabular-nums text-right">{i + 1}</span>
            <span className="flex-1 truncate text-gray-800">{labelOf(f)}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
              title="Move up" className="h-6 w-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === chosen.length - 1}
              title="Move down" className="h-6 w-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">↓</button>
            <button type="button" onClick={() => onChange(chosen.filter((_, k) => k !== i))}
              title="Remove" data-testid="wv-re-field-remove"
              className="h-6 w-6 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
