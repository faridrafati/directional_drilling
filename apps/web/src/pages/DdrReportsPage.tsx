/**
 * Daily Drilling Reports — unified page.
 *
 * The Remarks & Summary search IS the page: a cross-well keyword/facet search
 * with two views (REMARKS = one row per operation, SUMMARY = one row per day).
 * Clicking any result row opens that day's full daily drilling report in an
 * overlay — the DR.xls-layout form, the raw joined section tables, or the
 * well's analytics — merging the old separate "Reports" browser into one place.
 *
 * Reads the legacy Access→SQLite DBs directly via the @dd/api /ddr/* routes (no
 * migration, no Supabase). Dates are Jalali (Shamsi) strings as stored.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { exportDdrPdf, exportDdrXlsx, type DdrWellInfo } from "../export/ddr.js";
import { DrReportForm } from "../components/ddr/DrReportForm.js";
import { DdrAnalytics } from "../components/ddr/DdrAnalytics.js";
import { DdrRemarksSearch } from "../components/ddr/DdrRemarksSearch.js";
import { FormationLithology } from "../components/ddr/FormationLithology.js";
import { MudProperties } from "../components/ddr/MudProperties.js";
import { MudStock } from "../components/ddr/MudStock.js";

type Row = Record<string, unknown>;

interface DdrReportDetail {
  header: Row;
  bit: Row[];
  mud: Row[];
  directional: Row[];
  casing: Row[];
  formationTops: Row[];
  operations: Row[];
  bha: Row[];
  timeAnalysis: Row[];
}
interface DdrReport { serialNo: number; date: string | null }
type ReportRef = { wellCode: string; serialNo: number; date: string | null };
type ModalView = "form" | "tables" | "analytics";

const humanize = (k: string) =>
  k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();

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
  const [tab, setTab] = useState<"search" | "litho" | "mud" | "stock">("search");

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
    <div className="h-full flex flex-col p-4 sm:p-6">
      <div className="w-full max-w-[1700px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-4 shrink-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Daily Drilling Reports</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Search operations &amp; daily summaries across every well, then click a row to open its full
            report. Reading the legacy DDR databases directly. Dates are Jalali (Shamsi).
          </p>
        </div>

        {statusQ.data && !statusQ.data.available && (
          <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            The DDR SQLite databases were not found on this machine — search and reports are unavailable.
          </div>
        )}

        <div className="flex gap-1 border-b border-gray-200 mb-3 shrink-0">
          {([["search", "Reports & Search"], ["litho", "Formation & Lithology"], ["mud", "Mud Properties"], ["stock", "Mud Stock"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${tab === id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
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
        ) : (
          <MudStock
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
            <div className="inline-flex rounded border border-gray-300 overflow-hidden">
              {(["form", "tables", "analytics"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setView(m)}
                  className={`px-2.5 h-7 text-xs capitalize ${view === m ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
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
              className="ml-1 h-7 w-7 grid place-items-center rounded hover:bg-gray-100 text-gray-500 text-xl leading-none"
              title="Close (Esc)"
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
              className="h-7 border border-gray-300 rounded px-1.5 text-xs bg-white"
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

/** Friendly labels for the L04 header fields most worth surfacing. */
const HEADER_FIELDS: [string, string][] = [
  ["WellCode", "Well"], ["SerialNo", "Report #"], ["DrillingDate", "Date (Jalali)"],
  ["FromPoint", "From (m)"], ["ToPoint", "To (m)"], ["MorningDepth", "Morning depth (m)"],
  ["TotalMeter", "Total (m)"], ["TotalDRHour", "Total DR hours"], ["DrillingTime", "Drilling time"],
  ["EngName", "Engineer"], ["WellSiteSupt", "Wellsite supt"], ["OPNSupt", "Opn supt"],
  ["ProgEng", "Program eng"], ["Geologist", "Geologist"], ["HoleSizeCode", "Hole size"],
  ["FWater", "Fresh water"], ["Fuel", "Fuel"], ["WindSpeed_Dir", "Wind"], ["WaveVisible", "Wave / vis"],
];

function ReportDetail({ well, detail }: { well: DdrWellInfo | null; detail: DdrReportDetail }) {
  const h = detail.header;
  return (
    <div className="space-y-4">
      {well && <WellInfo well={well} />}
      <div className="bg-white border border-gray-200 rounded p-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {HEADER_FIELDS.filter(([k]) => h[k] != null && h[k] !== "").map(([k, label]) => (
            <div key={k}>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
              <div className="text-sm text-gray-800">{fmt(h[k])}</div>
            </div>
          ))}
        </div>
        {!!h.Lithology && <Field label="Lithology" value={String(h.Lithology)} />}
        {!!h.Description && <Field label="Operations narrative" value={String(h.Description)} />}
      </div>

      <SectionTable title="Bit records" rows={detail.bit} />
      <SectionTable title="Mud properties" rows={detail.mud} />
      <SectionTable title="Directional surveys" rows={detail.directional} />
      <SectionTable title="BHA" rows={detail.bha} />
      <SectionTable title="Casing" rows={detail.casing} />
      <SectionTable title="Formation tops" rows={detail.formationTops} />
      <SectionTable title="Operations log" rows={detail.operations} />
      <SectionTable title="Time analysis" rows={detail.timeAnalysis} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm text-gray-700 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

/** Render any section's rows as a table; redundant join keys are dropped. */
function SectionTable({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows || rows.length === 0) return null;
  const HIDE = new Set(["WellCode", "SerialNo", "fDate"]);
  const cols = Object.keys(rows[0]).filter((k) => !HIDE.has(k));
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-3 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">
        {title} <span className="text-gray-400 font-normal">({rows.length})</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr className="text-gray-500 text-left">
              {cols.map((c) => (
                <th key={c} className="font-medium px-2 py-1.5 whitespace-nowrap">{humanize(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
                {cols.map((c) => {
                  // Long free-text columns wrap and show in full.
                  const wide = c === "Remarks" || c === "Description" || c === "Specification" || c === "Activity";
                  return (
                    <td
                      key={c}
                      className={`px-2 py-1 text-gray-700 align-top ${wide ? "whitespace-pre-wrap break-words min-w-[280px]" : "whitespace-nowrap max-w-[280px] truncate"}`}
                      title={wide ? undefined : fmt(r[c])}
                    >
                      {fmt(r[c])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Resolved A01 well-master summary shown atop the report. */
const WELL_INFO_FIELDS: [string, string][] = [
  ["field", "Field"], ["rig", "Rig"], ["contractor", "Contractor"], ["wellType", "Type"],
  ["profile", "Profile"], ["spudDate", "Spud"], ["tdReachedDate", "TD reached"],
  ["totalDepth", "TD (m)"], ["tvd", "TVD (m)"], ["reservoir", "Reservoir"],
  ["location", "Location"], ["rigDays", "Rig days"],
];
function WellInfo({ well }: { well: DdrWellInfo }) {
  const items = WELL_INFO_FIELDS.filter(([k]) => well[k] != null && well[k] !== "");
  return (
    <div className="bg-blue-50/60 border border-blue-200 rounded p-3">
      <div className="text-sm font-semibold text-blue-900 mb-1.5">
        {String(well.name ?? well.wellCode)}
        {well.farsiName ? <span className="font-normal text-blue-700"> · {String(well.farsiName)}</span> : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
        {items.map(([k, label]) => (
          <div key={k}>
            <div className="text-[10px] uppercase tracking-wide text-blue-400">{label}</div>
            <div className="text-xs text-gray-800">{fmt(well[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-2 h-7 text-xs rounded bg-green-700 text-white hover:bg-green-800">
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
      className="h-7 min-w-[28px] px-1.5 grid place-items-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
    >
      {children}
    </button>
  );
}

function Loading({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-gray-400 px-2 py-4">{children}</div>;
}
