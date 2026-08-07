/**
 * Daily Drilling Reports — unified page.
 *
 * Reports & Search IS the page: a cross-well keyword/facet search with three
 * views over one sidebar — REMARKS (one row per operation), SUMMARY (one row per
 * day) and BROWSE DAYS (no search at all: every daily report of the wells picked
 * in the sidebar). Clicking any row opens that day's full daily drilling report
 * in an overlay — the DR.xls-layout form, the raw joined section tables, or the
 * well's analytics. The old separate "Browse Reports" tab is that third view.
 *
 * Reads the legacy Access→SQLite DBs directly via the @dd/api /ddr/* routes (no
 * migration, no Supabase). Dates are Jalali (Shamsi) strings as stored.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../api/client.js";
import {
  exportDdrPdf, exportDdrXlsx,
  mudWeightRangePpg,
  type DdrWellInfo, type DdrReportDetail, type EquipmentItem,
} from "../export/ddr.js";
import { DrReportForm } from "../components/ddr/DrReportForm.js";
import { DdrAnalytics } from "../components/ddr/DdrAnalytics.js";
import { DdrRemarksSearch } from "../components/ddr/DdrRemarksSearch.js";
import { FormationLithology } from "../components/ddr/FormationLithology.js";
import { MudProperties } from "../components/ddr/MudProperties.js";
import { MudStock } from "../components/ddr/MudStock.js";
import { WellPath } from "../components/ddr/WellPath.js";
import { TimeAnalysis } from "../components/ddr/TimeAnalysis.js";
import { Tools } from "../components/ddr/Tools.js";
import { RopOptimization } from "../components/ddr/RopOptimization.js";
import { DdrSelectionProvider } from "../components/ddr/ddrSelection.js";

type Row = Record<string, unknown>;

interface DdrReport { serialNo: number; date: string | null }
type ReportRef = { wellCode: string; serialNo: number; date: string | null };
type ModalView = "form" | "tables" | "analytics";

/**
 * Jalali (Shamsi) "YYYY/MM/DD" → a serial day number (Birashk j2d), used only
 * for date ordering and elapsed-day differences within one well's reports (a
 * span of months to a couple of years, where this is exact).
 */
const idiv = (a: number, b: number) => Math.floor(a / b);
function jalaliDayNum(date: string | null | undefined): number | null {
  const m = (date ?? "").trim().match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = +m[1] + 1595, jm = +m[2], jd = +m[3];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  return -355668 + 365 * jy + idiv(jy, 33) * 8 + idiv((jy % 33) + 3, 4)
    + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
}

const fmt = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
};

export function DdrReportsPage() {
  const [report, setReport] = useState<ReportRef | null>(null);
  const [view, setView] = useState<ModalView>("form");
  const [tab, setTab] = useState<"search" | "litho" | "mud" | "stock" | "path" | "time" | "tools" | "rop">("search");

  const statusQ = useQuery({
    queryKey: ["ddr", "status"],
    queryFn: () => api.get<{ available: boolean }>("/ddr/status"),
  });
  const detailQ = useQuery({
    queryKey: ["ddr", "detail", report?.wellCode, report?.serialNo],
    queryFn: () =>
      api.get<DdrReportDetail>(`/ddr/reports/${encodeURIComponent(report!.wellCode)}/${report!.serialNo}`),
    enabled: !!report,
    placeholderData: keepPreviousData, // smooth date-to-date navigation (no flash)
    staleTime: 0,
    refetchOnMount: "always", // always re-fetch on open so the report can't show a stale shape
  });
  const wellQ = useQuery({
    queryKey: ["ddr", "well", report?.wellCode],
    queryFn: () => api.get<DdrWellInfo>(`/ddr/wells/${encodeURIComponent(report!.wellCode)}`),
    enabled: !!report,
  });

  return (
    <DdrSelectionProvider>
    <div className="h-full flex flex-col p-4 sm:p-6">
      <div className="w-full max-w-[1700px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-4 shrink-0">
          <div className="border-l-[3px] border-amber-500 pl-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Daily Drilling Reports</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Search operations &amp; daily summaries across every well, then click a row to open its full
              report. Reading the legacy DDR databases directly. Dates are Jalali (Shamsi).
            </p>
          </div>
        </div>

        {statusQ.data && !statusQ.data.available && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg shadow-sm text-sm text-red-700">
            The DDR SQLite databases were not found on this machine — search and reports are unavailable.
          </div>
        )}

        <div className="flex gap-1 border-b border-gray-200 mb-3 shrink-0">
          {([["search", "Reports & Search"], ["litho", "Formation & Lithology"], ["mud", "Mud Properties"], ["stock", "Mud Stock"], ["path", "Well Path"], ["time", "Time Analysis"], ["tools", "Tools"], ["rop", "ROP Optimization"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors duration-150 ${tab === id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "search" ? (
          <DdrRemarksSearch
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : tab === "litho" ? (
          <FormationLithology />
        ) : tab === "mud" ? (
          <MudProperties
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : tab === "stock" ? (
          <MudStock
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : tab === "path" ? (
          <WellPath
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : tab === "time" ? (
          <TimeAnalysis
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : tab === "tools" ? (
          <Tools
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        ) : (
          <RopOptimization
            onOpenReport={(wellCode, serialNo, date) => { setReport({ wellCode, serialNo, date }); setView("form"); }}
          />
        )}
      </div>

      {report && (
        <ReportModal
          report={report}
          view={view}
          setView={setView}
          detail={detailQ.data ?? null}
          well={wellQ.data ?? null}
          loading={detailQ.isLoading}
          onNavigate={setReport}
          onClose={() => setReport(null)}
        />
      )}
    </div>
    </DdrSelectionProvider>
  );
}

/** Full-report overlay opened from a search row (Form / Tables / Analytics). */
function ReportModal({ report, view, setView, detail, well, loading, onNavigate, onClose }: {
  report: ReportRef;
  view: ModalView;
  setView: (v: ModalView) => void;
  detail: DdrReportDetail | null;
  well: DdrWellInfo | null;
  loading: boolean;
  onNavigate: (ref: ReportRef) => void;
  onClose: () => void;
}) {
  // Every daily report of this well, in date order — drives the Shamsi date
  // picker and the first/prev/next/last navigation.
  const reportsQ = useQuery({
    queryKey: ["ddr", "reports", report.wellCode],
    queryFn: () => api.get<DdrReport[]>(`/ddr/wells/${encodeURIComponent(report.wellCode)}/reports`),
  });
  const list = useMemo(() => {
    const arr = (reportsQ.data ?? []).slice();
    arr.sort((a, b) => {
      const da = jalaliDayNum(a.date), db = jalaliDayNum(b.date);
      if (da != null && db != null) return da - db;
      return (a.serialNo ?? 0) - (b.serialNo ?? 0);
    });
    return arr;
  }, [reportsQ.data]);
  const total = list.length;
  const idx = list.findIndex((r) => r.serialNo === report.serialNo);
  const go = (r?: DdrReport) => { if (r) onNavigate({ wellCode: report.wellCode, serialNo: r.serialNo, date: r.date }); };
  const startNum = jalaliDayNum(list[0]?.date);
  const dayFrom = (d: string | null) => {
    const n = jalaliDayNum(d);
    return startNum != null && n != null ? n - startNum + 1 : null;
  };
  const dayFromStart = dayFrom(report.date) ?? (idx >= 0 ? idx + 1 : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dateLabel = report.date;
  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/40 p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 w-full sm:max-w-[1200px] h-full sm:h-[90vh] sm:rounded-lg shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-200 bg-white shrink-0">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">
              {String(well?.name ?? report.wellCode)}
              <span className="text-gray-400 font-normal"> · {report.wellCode}</span>
            </div>
            <div className="text-[11px] text-gray-500">
              Report #{report.serialNo}{dateLabel ? ` · ${fmt(dateLabel)}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
              {(["form", "tables", "analytics"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setView(m)}
                  className={`px-2.5 h-7 text-xs capitalize transition-colors duration-150 ${view === m ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            {detail && well && (
              <>
                <ExportBtn onClick={() => void exportDdrPdf(well, detail)}>PDF</ExportBtn>
                <ExportBtn onClick={() => void exportDdrXlsx(well, detail)}>Excel</ExportBtn>
              </>
            )}
            <button
              onClick={onClose}
              className="ml-1 h-7 w-7 grid place-items-center rounded-md hover:bg-gray-100 text-gray-500 text-xl leading-none transition-colors duration-150"
              title="Close (Esc)"
              aria-label="Close report"
            >
              ×
            </button>
          </div>
        </div>

        {/* Shamsi date navigator — jump to any operation date, or step
            first/prev/next/last, with the day count from the well's first report. */}
        {total > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5 border-b border-gray-200 bg-white shrink-0">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 mr-0.5">Date</span>
            <NavBtn onClick={() => go(list[0])} disabled={idx <= 0} title="First date">⏮</NavBtn>
            <NavBtn onClick={() => go(list[idx - 1])} disabled={idx <= 0} title="Previous date">◀</NavBtn>
            <select
              value={report.serialNo}
              onChange={(e) => go(list.find((r) => r.serialNo === Number(e.target.value)))}
              className="h-7 border border-gray-300 rounded-md px-1.5 text-xs bg-white"
              title="Jump to any date in this well's operations"
            >
              {list.map((r) => (
                <option key={r.serialNo} value={r.serialNo}>{r.date ?? `#${r.serialNo}`}</option>
              ))}
            </select>
            <NavBtn onClick={() => go(list[idx + 1])} disabled={idx < 0 || idx >= total - 1} title="Next date">▶</NavBtn>
            <NavBtn onClick={() => go(list[total - 1])} disabled={idx >= total - 1} title="Last date">⏭</NavBtn>
            {dayFromStart != null && (
              <span
                className="ml-2 text-xs text-gray-500"
                title="“Day N from start” = calendar days since this well’s first report (first report = Day 1). “report X of M” = the report’s position in the list. They match only when reports were filed every day with no gaps."
              >
                Day <span className="font-semibold text-gray-700">{dayFromStart}</span> from start
                <span className="text-gray-400"> · report {idx >= 0 ? idx + 1 : "?"} of {total}</span>
              </span>
            )}
          </div>
        )}

        <div className="overflow-auto flex-1 min-h-0 p-4">
          {view === "analytics"
            ? <DdrAnalytics wellCode={report.wellCode} markDate={report.date} />
            : loading || !detail
              ? <Loading>Loading report…</Loading>
              : view === "form"
                ? <DrReportForm well={well} detail={detail} />
                : <ReportDetail well={well} detail={detail} />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TABLES view — the archive report re-cut as the office form (a.json).
 *
 * a.json (“PEDC/POGC Daily Drilling Report”) prints 21 blocks in a fixed order.
 * All 21 are rendered here, every time, in that order, with a.json’s block
 * titles, column labels and units — the same vocabulary the rig-side entry
 * module (/ddr-entry) speaks. This is the raw-rows counterpart of the Form
 * view: one table per block, one row per archive record.
 *
 * The legacy archive was captured on a different sheet (DR.xls), so much of
 * what the form asks for was never recorded at all. Two distinct empties:
 *   n/r — the archive has no source for that field: it was never captured
 *   —   — the archive has the field, but this report left it blank
 * Neither blocks nor columns are ever dropped, and nothing is guessed to fill
 * one: the office has to see what the form asks for beside what the archive
 * actually kept.
 * ═══════════════════════════════════════════════════════════════════════════ */

const NR_TEXT = "not recorded in the archive";

/** One a.json column. No `get`/`cell` ⇒ no archive source ⇒ every cell is n/r. */
interface Col {
  key: string;                       // a.json property name
  label: string;                     // a.json label
  unit?: string;                     // a.json unit
  title?: string;                    // provenance / caveat, on the header cell
  wide?: boolean;                    // free text: wraps instead of truncating
  /** The cell text is a.json's OWN printed label (a fixed row the form prints
   *  blank), not a value any report supplied — styled so it can't read as
   *  archive data, and the column is not counted as sourced. */
  fixed?: boolean;
  get?: (r: Row) => unknown;
  cell?: (r: Row) => React.ReactNode;
}
/** One field of an a.json object block (same two empties as `Col`). */
interface Fld {
  label: string;
  unit?: string;
  title?: string;
  wide?: boolean;                    // narrative: full width, wraps
  value?: unknown;
  nr?: boolean;                      // no archive source
}

const numOf = (x: unknown): number | null => {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n: number) => Number(n.toFixed(2));


/** "HH:MM" → minutes past midnight. Hours may run past 24: the archive logs the
 *  00:00–06:00 morning extension of the next day as 24:00–07:00. */
function minutesOf(x: unknown): number | null {
  const m = String(x ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = +m[1], mm = +m[2];
  return hh <= 48 && mm < 60 ? hh * 60 + mm : null;
}
/** a.json's `dur_hr`, derived from the archive's start/end clock times (the
 *  archive stores the pair, never the number). A zero or nonsense span stays
 *  blank rather than printing as 0 — the archive writes 00:00→00:00 when the
 *  time was simply never filled in. Same rule as the API's time analytics. */
function durationHr(from: unknown, to: unknown): number | null {
  const a = minutesOf(from), b = minutesOf(to);
  if (a == null || b == null) return null;
  const d = b - a < 0 ? b - a + 1440 : b - a;
  return d <= 0 || d > 1440 ? null : round2(d / 60);
}

/** The n/r marker: this field is not on the archive's form at all. */
function Nr() {
  return <span className="text-amber-600/80 italic" title={NR_TEXT}>n/r</span>;
}
function Val({ v, title }: { v: unknown; title?: string }) {
  const t = fmt(v);
  return <span title={title ?? (t.length > 20 ? t : undefined)} className={t === "—" ? "text-gray-300" : undefined}>{t}</span>;
}
/** One body cell: the archive's value, a.json's own fixed label, or the n/r
 *  marker when the column has no archive source at all. */
function CellValue({ col, row }: { col: Col; row: Row }) {
  if (col.cell) return <>{col.cell(row)}</>;
  if (!col.get) return <Nr />;
  if (col.fixed) {
    return <span className="text-gray-400" title="Printed by the form itself — not a value the archive holds">{fmt(col.get(row))}</span>;
  }
  return <Val v={col.get(row)} />;
}

/** Block frame: a.json's printed order (§n), its title, and the row count. */
function SectionShell({ n, title, count, unsourced, note, children }: {
  n: number; title: string; count?: number; unsourced?: boolean;
  note?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="flex items-baseline gap-2 px-3 py-1.5 border-b border-gray-100">
        <span className="text-[10px] font-semibold text-blue-600 tabular-nums shrink-0">§{n}</span>
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {count != null && <span className="text-xs text-gray-400">({count})</span>}
        {unsourced && (
          <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {NR_TEXT}
          </span>
        )}
      </div>
      {note && <div className="px-3 pt-1.5 text-[11px] leading-snug text-gray-400">{note}</div>}
      {children}
    </div>
  );
}

/** Sub-heading inside a block: a nested a.json table, or an "archive only"
 *  group holding what the archive kept but a.json has no field for. */
function SubHead({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pt-2 pb-0.5 text-[10px] uppercase tracking-wide text-gray-400">{children}</div>;
}

/** Array block: a.json's columns, always all of them, one row per record. */
function RowTable({ cols, rows, emptyText }: { cols: Col[]; rows: Row[]; emptyText: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr className="text-left align-bottom">
            {cols.map((c) => {
              const sourced = !!(c.get || c.cell) && !c.fixed;
              return (
                <th
                  key={c.key}
                  title={c.title ?? (sourced ? undefined : NR_TEXT)}
                  className={`font-medium px-2 py-1.5 whitespace-nowrap ${sourced ? "text-gray-500" : "text-amber-700/60"}`}
                >
                  {c.label}
                  {c.unit ? <span className="ml-1 font-normal text-gray-400">({c.unit})</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="px-2 py-2 text-[11px] italic text-amber-700/80 bg-amber-50/40">
                {emptyText}
              </td>
            </tr>
          ) : rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`px-2 py-1 text-gray-700 align-top ${c.wide ? "whitespace-pre-wrap break-words min-w-[260px]" : "whitespace-nowrap max-w-[260px] truncate"}`}
                >
                  <CellValue col={c} row={r} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Object block (header grid, mud information, marine…): a.json's label/value
 *  rows, kept dense — the printed form lays these out as label/value bands. */
function FieldGrid({ fields }: { fields: Fld[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-gray-100">
      {fields.map((f) => (
        <div
          key={f.label}
          className={`border-b border-r border-gray-100 px-2 py-1 min-w-0 ${f.wide ? "sm:col-span-2 lg:col-span-3" : "flex items-baseline gap-2"}`}
        >
          <span
            className={`text-[10px] uppercase tracking-wide shrink-0 ${f.nr ? "text-amber-700/60" : "text-gray-400"} ${f.wide ? "block" : "w-[46%]"}`}
            title={f.title ?? (f.nr ? NR_TEXT : undefined)}
          >
            {f.label}{f.unit ? ` (${f.unit})` : ""}
          </span>
          <span className={`text-xs text-gray-800 min-w-0 ${f.wide ? "block whitespace-pre-wrap break-words" : "flex-1 truncate"}`}>
            {f.nr ? <Nr /> : <Val v={f.value} title={f.title} />}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── a.json column sets ──────────────────────────────────────────────────────

const SUPERVISOR_COLS: Col[] = [
  { key: "job_contact", label: "Job contact", get: (r) => r.job_contact },
  { key: "position", label: "Position", get: (r) => r.position },
];
const COMPANY_COLS: Col[] = [
  { key: "company", label: "Company" },
  { key: "count", label: "Count" },
  { key: "note", label: "Note", wide: true },
];
const HSE_COLS: Col[] = [
  // The four drill names are a.json's own fixed row labels, not archive data:
  // `fixed` keeps them out of the sourced (gray) styling, so no cell in this
  // block reads as something a report supplied.
  { key: "type", label: "Type", get: (r) => r.type, fixed: true, title: "a.json prints these four drill types on every report — the form's own labels" },
  { key: "date", label: "Date" },
  { key: "days_to_next_check", label: "Days to next check", unit: "days" },
];
/** a.json prints this row set even when blank. */
const HSE_ROWS: Row[] = [{ type: "BOP Test" }, { type: "H2S Drill" }, { type: "Fire Drill" }, { type: "Abandon Drill" }];
const BULK_COLS: Col[] = [
  { key: "supply_item_des", label: "Supply item" },
  { key: "unit_label", label: "Unit", title: "MT, liter, m³" },
  { key: "consumed", label: "Consumed" },
  { key: "received", label: "Received" },
  { key: "returned", label: "Returned" },
  { key: "on_loc", label: "On loc." },
  { key: "note", label: "Note", wide: true },
];
const FORMATION_COLS: Col[] = [
  { key: "formation_name", label: "Formation", get: (r) => r["Formation"] },
  { key: "prog_top_md_mkb", label: "Prog. top MD", unit: "mKB" },
  { key: "final_top_md_mkb", label: "Final top MD", unit: "mKB", get: (r) => r["Depth (m)"], title: "Archive D07 formation top (MD)" },
  { key: "final_top_tvd_mkb", label: "Final top TVD", unit: "mKB" },
  { key: "thick_m", label: "Thick", unit: "m" },
  { key: "drilled_rop_m_hr", label: "Drilled ROP", unit: "m/hr" },
  { key: "lith_des", label: "Lithology", wide: true },
];
const SURVEY_COLS: Col[] = [
  { key: "md_mkb", label: "MD", unit: "mKB", get: (r) => r["MD (m)"] },
  { key: "incl_deg", label: "Incl", unit: "°", get: (r) => r["Inc (°)"] },
  { key: "azm_deg", label: "Azm", unit: "°", get: (r) => r["Azi (°)"] },
  { key: "tvd_mkb", label: "TVD", unit: "mKB", get: (r) => r["TVD (m)"] },
  { key: "ns_m", label: "N/S", unit: "m", get: (r) => r["N/S"] },
  { key: "ew_m", label: "E/W", unit: "m", get: (r) => r["E/W"] },
  { key: "vs_m", label: "VS", unit: "m", get: (r) => r["VS"], title: "Archive M04 vertical section — recorded on some wells only" },
  { key: "dls_deg_30m", label: "DLS", unit: "°/30m", get: (r) => r["DLS"] },
  { key: "build_deg_30m", label: "Build", unit: "°/30m" },
];
/** a.json's `com`: first line is the activity, ">>" lines are its sub-notes. */
function OpsCom({ row }: { row: Row }) {
  const activity = fmt(row["Operation"]);
  const text = String(row["Remarks"] ?? "").trim();
  const lines = text ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  return (
    <div className="min-w-0">
      {activity !== "—" && <div className="font-medium text-gray-800">{activity}</div>}
      {lines.map((l, i) => (
        l.startsWith(">>")
          ? <div key={i} className="pl-3 text-gray-500">{l}</div>
          : <div key={i}>{l}</div>
      ))}
      {activity === "—" && lines.length === 0 && <span className="text-gray-300">—</span>}
    </div>
  );
}
const OPS_COLS: Col[] = [
  { key: "start_time", label: "Start", unit: "HH:MM", get: (r) => r["From"] },
  { key: "dur_hr", label: "Dur", unit: "hr", cell: (r) => <Val v={durationHr(r["From"], r["To"])} title="Derived from the archive's start → end times" />, title: "Derived from the archive's start → end times" },
  { key: "end_time", label: "End", unit: "HH:MM", get: (r) => r["To"] },
  { key: "code_1", label: "Code 1", get: (r) => r["Op"], title: "Archive operation code" },
  { key: "code_2", label: "Code 2", title: "P / NP — no archive column tags a logged row productive / non-productive. The Analytics view infers the split from the operation-code wording; a raw row is left as recorded." },
  { key: "com", label: "Comment", wide: true, cell: (r) => <OpsCom row={r} /> },
];
const STRING_COLS: Col[] = [
  { key: "string_no", label: "String", get: (r) => r.string_no, title: "a.json nests the bit record and components inside their drill string" },
  { key: "drill_string_name", label: "Name" },
  { key: "bha_no", label: "BHA no.", get: (r) => r.bha_no },
  // NOT the L05 bit-run start depth: L05 rows are per DAY, so a run spanning
  // days restarts at that day's depth — which is not the depth the string went
  // in hole. The run interval is kept on the note line instead.
  { key: "depth_in_mkb", label: "Depth in", unit: "mKB" },
  { key: "date_in", label: "Date in" },
  { key: "bha_objective", label: "BHA objective" },
  { key: "depth_drilled_m", label: "Depth drilled", unit: "m", get: (r) => r.depth_drilled_m, title: "Archive L05 bit meterage" },
  { key: "drilling_time_hr", label: "Drilling time", unit: "hr", get: (r) => r.drilling_time_hr, title: "Archive L05 bit hours" },
  { key: "circulating_time_hr", label: "Circ. time", unit: "hr" },
  { key: "rotating_time_hr", label: "Rot. time", unit: "hr" },
  { key: "sliding_time_hr", label: "Slide time", unit: "hr" },
  {
    key: "note", label: "Note", wide: true, cell: (r) => <NoteCell text={r.note} extra={r.note_extra} />,
    title: "Archive BHA make-up specification (free text), plus the figures a.json has no column for",
  },
];
/** a.json free-text cell: the archive's text, then the archive-only figures
 *  that a.json's block has no column for, kept as a quiet second line. */
function NoteCell({ text, extra }: { text: unknown; extra: unknown }) {
  const t = fmt(text), x = extra == null || extra === "" ? null : String(extra);
  return (
    <div className="min-w-0">
      {t !== "—" || !x ? <div className="whitespace-pre-wrap break-words">{t}</div> : null}
      {x && <div className="text-gray-500">{x}</div>}
    </div>
  );
}
const BIT_COLS: Col[] = [
  { key: "string_no", label: "String", get: (r) => r.string_no },
  { key: "size_in", label: "Size", unit: "in", get: (r) => r["Bit size"] },
  { key: "model", label: "Model", get: (r) => r["Bit type"] },
  { key: "iadc_codes", label: "IADC code", get: (r) => r["IADC code"] },
  { key: "make", label: "Make" },
  { key: "serial_number", label: "Serial no.", get: (r) => r["Bit ser.no."] },
  { key: "bit_run", label: "Bit run", get: (r) => r["Bit #"] },
  { key: "nozzles_32nds", label: "Nozzles", unit: "1/32 in", get: (r) => r["Nozzles"] },
  { key: "tfa_in2", label: "TFA", unit: "in²", get: (r) => r["TFA"] },
  { key: "bit_revs", label: "Bit revs" },
  {
    key: "iadc_bit_dull", label: "IADC dull", unit: "I-O-D-L-B-G-O-R",
    cell: (r) => <Val v={r["Dull (IADC)"]} title={`The archive keeps the first 7 positions; the 8th (reason pulled) is a separate field: ${fmt(r["Reason pulled"])}`} />,
    title: "8-position dull grade — the archive stores 7 positions plus a separate 'reason pulled'",
  },
];
const COMPONENT_COLS: Col[] = [
  { key: "item_des", label: "Item", get: (r) => r.item_des },
  { key: "serv", label: "Serv." },
  { key: "sn", label: "SN", get: (r) => r.sn },
  { key: "od_in", label: "OD", unit: "in", get: (r) => r.od_in },
  { key: "id_in", label: "ID", unit: "in" },
  { key: "jts", label: "Jts" },
  { key: "len_m", label: "Length", unit: "m" },
  { key: "cum_len_m", label: "Cum. length", unit: "m" },
  { key: "com", label: "Comment", wide: true, get: (r) => r.com },
];
const DRILLING_PARAM_COLS: Col[] = [
  { key: "start_mkb", label: "Start", unit: "mKB" },
  { key: "end_depth_mkb", label: "End depth", unit: "mKB" },
  { key: "drill_time_hr", label: "Drill time", unit: "hr" },
  { key: "slide_time_hr", label: "Slide time", unit: "hr" },
  { key: "circ_time_hr", label: "Circ. time", unit: "hr" },
  { key: "int_rop_m_hr", label: "Int. ROP", unit: "m/hr" },
  // a.json gives drill_tq no unit and no description — none is invented here.
  { key: "drill_tq", label: "Drill torque" },
  { key: "rpm", label: "RPM" },
  { key: "q_flow_gpm", label: "Q flow", unit: "gpm" },
  { key: "spp_psi", label: "SPP", unit: "psi" },
  { key: "wob_1000lbf", label: "WOB", unit: "1000 lbf" },
];
const ADDITIVE_COLS: Col[] = [
  { key: "des", label: "Description", get: (r) => r["Material"] },
  { key: "units", label: "Units", get: (r) => r["Unit"] },
  { key: "consumed", label: "Consumed", get: (r) => r["Used"] },
  { key: "rec", label: "Received", get: (r) => r["Rec."] },
  { key: "on_loc", label: "On loc.", get: (r) => r["Stock"] },
];
const CASING_COLS: Col[] = [
  { key: "csg_des", label: "Casing", get: (r) => r["Casing"] },
  { key: "run_date", label: "Run date" },
  { key: "top_mkb", label: "Top", unit: "mKB" },
  { key: "set_depth_mkb", label: "Set depth", unit: "mKB", get: (r) => r["Depth (m)"] },
  {
    key: "com", label: "Comment", wide: true,
    cell: (r) => <NoteCell text={r["Remarks"]} extra={numOf(r["Joints"]) != null ? `${fmt(r["Joints"])} joints` : null} />,
    title: "Archive casing remarks, plus the joint count a.json has no column for",
  },
];
const WELLHEAD_COLS: Col[] = [
  { key: "install_date", label: "Install date" },
  { key: "size_in", label: "Size", unit: "in" },
  { key: "type", label: "Type" },
  { key: "make", label: "Make" },
  { key: "wp_psi", label: "Working pressure", unit: "psi" },
  { key: "com", label: "Comment", wide: true },
];
const SCR_COLS: Col[] = [
  { key: "pump_no", label: "Pump no." },
  { key: "depth_mkb", label: "Depth", unit: "mKB" },
  { key: "strokes_spm", label: "Strokes", unit: "spm" },
  { key: "eff_pct", label: "Efficiency", unit: "%" },
  { key: "p_psi", label: "Pressure", unit: "psi" },
  { key: "q_flow_gpm", label: "Q flow", unit: "gpm" },
];
const VESSEL_COLS: Col[] = [
  { key: "vessel_name", label: "Vessel" },
  { key: "vessel_type", label: "Type" },
  { key: "arrival_date", label: "Arrival" },
  { key: "departure_date", label: "Departure" },
  { key: "note", label: "Note", wide: true },
];

/** a.json's supervisors_contact rows, derived from the L04 name columns. */
const SUPERVISOR_ROLES: [string, string][] = [
  ["WellSiteSupt", "Well Site Superintendent"],
  ["OPNSupt", "Operations Superintendent"],
  ["ProgEng", "Programme Engineer"],
  ["Geologist", "Geologist"],
  ["Cont_T_Push1", "Contractor Toolpusher (1)"],
  ["Cont_T_Push2", "Contractor Toolpusher (2)"],
];

/** Jar / DH-motor → an a.json BHA component row (the archive keeps them in
 *  their own per-day tables, with type, size, serial no. and hours).
 *
 *  A row exists for the day whenever the tool table has ANY row for it, even
 *  one where type, size, serial and hours are all null — printing that would be
 *  an entirely blank component, so it is dropped rather than listed. */
const toolComponent = (name: string, t?: EquipmentItem | null): Row[] =>
  !t || [t.type, t.size, t.sn, t.hrs].every((x) => x == null || x === "")
    ? []
    : [{
      item_des: name,
      sn: t.sn,
      od_in: t.size,
      com: [t.type ? String(t.type) : null, numOf(t.hrs) != null ? `${fmt(t.hrs)} hr` : null]
        .filter(Boolean).join(" · ") || null,
    }];

function ReportDetail({ well, detail }: { well: DdrWellInfo | null; detail: DdrReportDetail }) {
  const h = detail.header;
  const w = (k: string): unknown => (well ? well[k] : null);
  const mud0: Row = detail.mud[0] ?? {};

  const progress = numOf(h.Meterage), drillHours = numOf(h.DrillingTime);
  const avgRop = progress != null && drillHours != null && drillHours > 0 ? round2(progress / drillHours) : null;
  const geology = [h.Formation, h.Lithology].filter((x) => x != null && x !== "").map(String).join(" · ") || null;
  const groundLevel = numOf(w("groundLevel"));

  const supervisors: Row[] = SUPERVISOR_ROLES
    .filter(([k]) => h[k] != null && String(h[k]).trim() !== "")
    .map(([k, position]) => ({ job_contact: h[k], position }));

  // a.json nests {string header, bit record, components} per drill string; the
  // archive keeps them in three unrelated per-day tables (BottomHoleAssembly,
  // L05 bit runs, DrillString + the tool tables), so they are paired by
  // position and printed as the three sub-tables.
  const strings: Row[] = Array.from({ length: Math.max(detail.bha.length, detail.bit.length) }, (_, i) => {
    const a: Row = detail.bha[i] ?? {}, b: Row = detail.bit[i] ?? {};
    // Length / weight / drag are archive-only figures (a.json's string block has
    // no column for them) — kept on the note line rather than dropped.
    const extra = [
      numOf(a["Length (m)"]) != null ? `Length ${fmt(a["Length (m)"])} m` : null,
      numOf(a["Weight"]) != null ? `weight ${fmt(a["Weight"])}` : null,
      numOf(a["Drag up"]) != null || numOf(a["Drag down"]) != null
        ? `drag up/down ${fmt(a["Drag up"])} / ${fmt(a["Drag down"])}` : null,
      // The day's bit-run interval — kept here rather than as "depth in", which
      // it is not (see STRING_COLS.depth_in_mkb).
      numOf(b["From (m)"]) != null || numOf(b["To (m)"]) != null
        ? `bit run ${fmt(b["From (m)"])} – ${fmt(b["To (m)"])} m this day` : null,
    ].filter(Boolean).join(" · ");
    return {
      string_no: i + 1,
      bha_no: a["Assembly #"] ?? null,
      depth_drilled_m: b["Bit meterage"] ?? null,
      drilling_time_hr: b["Bit hrs"] ?? null,
      note: a["Specification"] ?? null,
      note_extra: extra || null,
    };
  });
  const bitRows: Row[] = detail.bit.map((b, i) => ({ ...b, string_no: i + 1 }));
  const components: Row[] = [
    ...toolComponent("Jar", detail.equipment?.jar),
    ...toolComponent("DH motor", detail.equipment?.dhMotor),
    ...(detail.drillString ?? []).map((d) => ({
      item_des: "Drill pipe", sn: null, od_in: d.size,
      com: d.grade != null && d.grade !== "" ? `Grade ${String(d.grade)}` : null,
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="text-[11px] leading-snug text-gray-500 bg-white border border-gray-200 rounded px-3 py-2">
        The office form (a.json) in its printed order — all 21 blocks, with its labels and units.
        <span className="text-amber-700"> <span className="italic">n/r</span> = {NR_TEXT}</span>: the field was
        never captured by the legacy sheet, as opposed to <span className="text-gray-400">—</span>, which is a
        field the archive has but this report left blank.
      </div>

      {/* §1 */}
      <SectionShell n={1} title="Top identification grid">
        <FieldGrid fields={[
          { label: "Field name", value: w("field") },
          { label: "Client", value: w("company") },
          { label: "Well type", value: w("wellType") },
          { label: "Water depth", unit: "m", value: w("waterDepth") },
          { label: "Latitude", nr: true },
          { label: "Longitude", nr: true },
          { label: "Rig number", value: w("rig") },
          { label: "Contractor", value: w("contractor") },
          { label: "Original KB elevation", unit: "m", value: w("rtElevation"), title: "Archive A01 RT level above sea" },
          { label: "Other elevation note", value: groundLevel != null ? `Ground level (m): ${groundLevel}` : null },
          { label: "Comment", nr: true },
          { label: "Spud date", value: w("spudDate") },
          { label: "Cum. time log", unit: "days", nr: true, title: `The archive logs cumulative drilling HOURS, not days (L04 total DR hours: ${fmt(h.TotalDRHour)})` },
          { label: "Days since LTI", nr: true },
          { label: "Kick-off depth", unit: "mKB", value: h.KOP },
          { label: "Last casing string", value: h.LastCasing },
          { label: "Ops category", value: h.HoleSizeCode, title: "Archive hole-size section, e.g. 24\" H.S." },
          { label: "Current geology", value: geology, title: "Archive: deepest formation top at the day's depth · L04 lithology" },
          { label: "Mud type", value: mud0["Mud type"] },
          { label: "Last mud check density", unit: "lb/gal (ppg)", value: mudWeightRangePpg(mud0["Min wt"], mud0["Max wt"]), title: `Archive N01 min/max weight as recorded: ${fmt(mud0["Min wt"])} / ${fmt(mud0["Max wt"])} — unit inferred from magnitude (pcf on most reports)` },
          { label: "Head count", unit: "POB", nr: true },
          { label: "Hazards", nr: true },
          { label: "Start depth", unit: "mKB", value: h.FromPoint },
          { label: "End depth", unit: "mKB", value: h.ToPoint },
          { label: "End depth TVD", unit: "mKB", nr: true },
          { label: "Depth progress", unit: "m", value: h.Meterage },
          { label: "Drilling hours", unit: "hr", value: h.DrillingTime },
          { label: "Avg ROP", unit: "m/hr", value: avgRop, title: "Derived: depth progress ÷ drilling hours" },
        ]} />
        {/* What the archive holds that a.json's grid has no field for — kept
            here rather than dropped, so the office reads every number the old
            well-info header showed. */}
        <SubHead>Archive only — well-master and header figures a.json does not name</SubHead>
        <FieldGrid fields={[
          { label: "Well name (Farsi)", value: w("farsiName"), title: "Archive A01 Farsi well name" },
          { label: "TD reached", value: w("tdReachedDate"), title: "Archive A01 date TD was reached (Jalali)" },
          { label: "Well total depth", unit: "m", value: w("totalDepth"), title: "Archive A01 well total — the WELL's final MD, not this report's depth" },
          { label: "Well TVD", unit: "m", value: w("tvd"), title: "Archive A01 well total — the WELL's final TVD, not this report's depth" },
          { label: "Total meter (as recorded)", unit: "m", value: h.TotalMeter, title: "Archive L04 TotalMeter exactly as stored; the depth progress above is derived (end − start depth), which is what the sheet prints" },
        ]} />
      </SectionShell>

      {/* §2 */}
      <SectionShell n={2} title="Operations" note="The archive keeps one narrative per day — a.json asks for three.">
        <FieldGrid fields={[
          { label: "At report time", nr: true, wide: true },
          { label: "Summary (24 hr)", value: h.Description, wide: true },
          { label: "Next report period", nr: true, wide: true },
        ]} />
      </SectionShell>

      {/* §3 */}
      <SectionShell n={3} title="Supervisors Contact" count={supervisors.length}
        note="Derived from the archive's per-role name columns on the report header.">
        <RowTable cols={SUPERVISOR_COLS} rows={supervisors} emptyText="No names on this report" />
      </SectionShell>

      {/* §4 */}
      <SectionShell n={4} title="On-Board Companies" unsourced>
        <RowTable cols={COMPANY_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §5 — a.json prints this fixed row set even when blank. */}
      <SectionShell n={5} title="HSE Drill Schedule" unsourced
        note="The archive has no HSE drill record at all — the four rows below are the ones a.json prints on every report, blank or not.">
        <RowTable cols={HSE_COLS} rows={HSE_ROWS} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §6 */}
      <SectionShell n={6} title="Bulk Material" unsourced>
        <RowTable cols={BULK_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §7 */}
      <SectionShell n={7} title="Formations" count={detail.formationTops.length}
        note="The archive keeps formation tops per WELL, not per report day — this is the well's whole geological column.">
        <RowTable cols={FORMATION_COLS} rows={detail.formationTops} emptyText="No formation tops recorded for this well" />
      </SectionShell>

      {/* §8 */}
      <SectionShell n={8} title="Directional Survey" count={detail.directional.length}>
        <RowTable cols={SURVEY_COLS} rows={detail.directional} emptyText="No survey stations on this report" />
      </SectionShell>

      {/* §9 */}
      <SectionShell n={9} title="24 Hrs Operation Report" count={detail.operations.length}
        note="Durations are derived from the archive's start/end clock times.">
        <RowTable cols={OPS_COLS} rows={detail.operations} emptyText="No operations logged on this report" />
      </SectionShell>

      {/* §10 */}
      <SectionShell n={10} title="6 Hrs Morning Report" unsourced>
        <FieldGrid fields={[
          { label: "Remarks date", nr: true },
          { label: "Raw text", nr: true, wide: true },
          { label: "Blocks (HH:MM – HH:MM)", nr: true, wide: true },
        ]} />
      </SectionShell>

      {/* §11 */}
      <SectionShell n={11} title="Drill Strings" count={strings.length}
        note="a.json nests a bit record and a component list inside each string; the archive keeps BHAs, bit runs, drill pipe and tools in separate per-day tables, paired here by position.">
        <SubHead>String header</SubHead>
        <RowTable cols={STRING_COLS} rows={strings} emptyText="No drill string on this report" />
        <SubHead>Bit record <span className="normal-case tracking-normal">(a.json <code>drill_strings[].bit</code>)</span></SubHead>
        <RowTable cols={BIT_COLS} rows={bitRows} emptyText="No bit record on this report" />
        <SubHead>Components <span className="normal-case tracking-normal">(a.json <code>drill_strings[].components</code>) — recorded per day, not per string; the BHA make-up itself is the free-text note above</span></SubHead>
        <RowTable cols={COMPONENT_COLS} rows={components} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §12 */}
      <SectionShell n={12} title="Drilling Parameters" unsourced
        note="The archive records WOB / RPM / flow per BIT RUN, not per drilled interval, so a.json's interval rows have no source.">
        <RowTable cols={DRILLING_PARAM_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §13 */}
      <SectionShell n={13} title="Mud Information"
        note="One check per day. The archive also keeps Fann 600/300, ALK, PF/MF, HPHT and electrical stability — a.json's block has no column for them.">
        <FieldGrid fields={[
          { label: "Depth", unit: "mKB", value: mud0["To (m)"], title: "Archive N01 interval end depth" },
          { label: "Type", value: mud0["Mud type"] },
          { label: "Density", unit: "lb/gal (ppg)", value: mudWeightRangePpg(mud0["Min wt"], mud0["Max wt"]), title: `Archive N01 min/max weight as recorded: ${fmt(mud0["Min wt"])} / ${fmt(mud0["Max wt"])} — the day is a range, not one value; unit inferred from magnitude` },
          // a.json asks for °C. The archive's N01.ReturnTemperature is the DR.xls
          // return temperature in °F (values run 100–150), so it is shown as
          // recorded and labelled °F — relabelling it °C would be a silent
          // 100°F→"100°C" lie, and converting it would invent precision the
          // archive never had.
          { label: "T flowline", unit: "°F", value: mud0["Temp"], title: "Archive N01 return temperature, in °F as the DR.xls sheet recorded it. a.json asks for °C; shown unconverted." },
          { label: "Funnel viscosity", unit: "s/qt", value: mud0["Visc (s)"] },
          { label: "PV (calc.)", unit: "cP", value: mud0["PV"], title: "Derived by the archive layer from Fann 600/300" },
          { label: "YP (calc.)", unit: "lbf/100ft²", value: mud0["YP"], title: "Derived by the archive layer from Fann 600/300" },
          { label: "Filtrate", unit: "ml/30min", value: mud0["Water loss"] },
          { label: "Vis 3 rpm", nr: true, title: "The archive keeps the Fann 600/300 pair only" },
          { label: "Vis 6 rpm", nr: true, title: "The archive keeps the Fann 600/300 pair only" },
          { label: "Gel 10 sec", unit: "lbf/100ft²", value: mud0["Initial gel"] },
          { label: "Gel 10 min", unit: "lbf/100ft²", value: mud0["10min gel"] },
          { label: "Water", unit: "%", nr: true },
          { label: "Oil", unit: "%", value: mud0["Oil %"] },
          { label: "Solids", unit: "%", value: mud0["Solids %"] },
          { label: "Low-gravity solids", unit: "%", nr: true },
          { label: "MBT", unit: "lb/bbl", value: mud0["MBT"] },
          { label: "pH", value: mud0["pH"] },
          { label: "Chlorides", unit: "mg/l", value: mud0["Salinity"] },
          { label: "Hardness (Ca)", unit: "ppm", value: mud0["Ca"] },
          { label: "KCl", unit: "lb/bbl", value: mud0["KCl"] },
          { label: "Mud lost to hole", unit: "bbl", value: h.FormationLoss, title: "Archive N05 total losses to formation" },
          { label: "Active mud volume", unit: "bbl", nr: true },
          { label: "Mud in reserve", unit: "bbl", nr: true },
        ]} />
      </SectionShell>

      {/* §14 */}
      <SectionShell n={14} title="Mud Additive Balance" count={(detail.chemicals ?? []).length}
        note="The archive also tracks outstanding / requested / sent quantities; a.json's balance keeps consumed, received and on-location only.">
        <RowTable cols={ADDITIVE_COLS} rows={detail.chemicals ?? []} emptyText="No additive movements on this report" />
      </SectionShell>

      {/* §15 */}
      <SectionShell n={15} title="Casing String" count={detail.casing.length}
        note="Every string in hole as of this report date, deepest last.">
        <RowTable cols={CASING_COLS} rows={detail.casing} emptyText="No casing in hole on this report" />
      </SectionShell>

      {/* §16 */}
      <SectionShell n={16} title="Wellhead Component" unsourced>
        <RowTable cols={WELLHEAD_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §17 */}
      <SectionShell n={17} title="Well Control — SCR" unsourced>
        <RowTable cols={SCR_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §18 */}
      <SectionShell n={18} title="Formation Integrity Test" unsourced>
        <FieldGrid fields={[
          { label: "Test type", nr: true },
          { label: "Test date", nr: true },
          { label: "Last casing string run", nr: true },
          { label: "Depth", unit: "mKB", nr: true },
          { label: "TVD", unit: "mKB", nr: true },
          { label: "Applied surface pressure", unit: "psi", nr: true },
          { label: "Fluid density", unit: "lb/gal (ppg)", nr: true },
          { label: "Volume pumped", unit: "bbl", nr: true },
          { label: "Leak-off pressure", unit: "psi", nr: true },
          { label: "Leak-off equiv. density", unit: "lb/gal (ppg)", nr: true },
        ]} />
      </SectionShell>

      {/* §19 — the archive's two free-text weather strings are NOT a.json's typed
          fields: "15 kt NW" is speed AND direction, and the wave/visibility
          string is not a comment. Both are shown as themselves, below. */}
      <SectionShell n={19} title="Marine Conditions"
        note="The archive wrote the weather as two free-text strings on the report header, so none of a.json's typed knots / metres / km cells has a source and neither string can be split into them.">
        <FieldGrid fields={[
          { label: "Swell height", unit: "m", nr: true },
          { label: "Visibility", unit: "km", nr: true },
          { label: "Wind direction", nr: true },
          { label: "Wind speed", unit: "knots", nr: true },
          { label: "T high", unit: "°C", nr: true },
          { label: "Wave height", unit: "m", nr: true },
          { label: "Comment", nr: true, wide: true },
        ]} />
        <SubHead>Archive only — the same readings as free text on the DR.xls sheet</SubHead>
        <FieldGrid fields={[
          { label: "Wind speed / direction", value: h.WindSpeed_Dir, title: "Archive L04 free text, as recorded" },
          { label: "Wave / visibility", value: h.WaveVisible, title: "Archive L04 free text, as recorded" },
        ]} />
      </SectionShell>

      {/* §20 */}
      <SectionShell n={20} title="Support Vessels" unsourced>
        <RowTable cols={VESSEL_COLS} rows={[]} emptyText={NR_TEXT} />
      </SectionShell>

      {/* §21 */}
      <SectionShell n={21} title="General Notes" unsourced>
        <FieldGrid fields={[
          { label: "Raw text", nr: true, wide: true },
          { label: "Material request — new", nr: true },
          { label: "Material request — outstanding", nr: true },
          { label: "Received", nr: true },
          { label: "Sent", nr: true },
          { label: "Vessel remaining on-board", nr: true },
          { label: "Rig / contractor shortages", nr: true },
        ]} />
      </SectionShell>
    </div>
  );
}

function ExportBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-2 h-7 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150">
      {children}
    </button>
  );
}

function NavBtn({ onClick, disabled, title, children }: {
  onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-7 min-w-[28px] px-1.5 grid place-items-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-40 disabled:cursor-default"
    >
      {children}
    </button>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-400 px-2 py-4">{children}</div>;
}
