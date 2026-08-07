/**
 * Reports browser — pick a well, then a day.
 *
 * The rest of this page is built around SEARCH: you describe what you are
 * looking for and it finds the days that match. This tab is the other half of
 * the job — you already know the well and roughly the date, and you just want
 * that report open. Field → Well → the well's day list → click.
 *
 * It is a picker, not a viewer: clicking a day calls `onOpenReport`, which opens
 * the same Form / Tables / Analytics overlay every other tab uses. No report
 * rendering is duplicated here.
 *
 * Dates are Jalali (Shamsi) "YYYY/MM/DD" exactly as the archive stores them, so
 * they sort lexicographically and the date filter is a plain string compare.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { JalaliDatePicker } from "./JalaliDatePicker.js";

interface SearchOptions {
  fields: string[];
  wells: { code: string; name: string; field: string | null }[];
}
/** One row of `GET /ddr/wells/:code/reports` (L04, newest first). */
interface ReportRow {
  serialNo: number;
  date: string | null;
  fromPoint: number | null;
  toPoint: number | null;
  morningDepth: number | null;
  totalMeter: number | null;
  totalHours: number | null;
  engineer: string | null;
  description: string | null;
}

const fmt = (v: unknown): string =>
  v == null || v === "" ? "—" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);

/** The day's drilled interval — the archive keeps from/to, not the difference. */
const meterage = (r: ReportRow): number | null =>
  r.fromPoint != null && r.toPoint != null ? Number((r.toPoint - r.fromPoint).toFixed(2)) : r.totalMeter;

const SELECT =
  "min-h-[44px] sm:min-h-[36px] w-full px-2 text-base sm:text-sm border border-gray-300 rounded-md " +
  "bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400";
const LABEL = "block text-[11px] uppercase tracking-wide text-gray-500 mb-1";

export function DdrReportBrowser({ onOpenReport }: {
  onOpenReport: (wellCode: string, serialNo: number, date: string | null) => void;
}) {
  const [field, setField] = useState("");
  const [wellCode, setWellCode] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /** The well whose own date span has already been written into the pickers.
   *  Guards the effect below so a user narrowing the window is not overwritten
   *  every time the day list re-renders. */
  const appliedRangeFor = useRef("");

  const optsQ = useQuery({
    queryKey: ["ddr", "search-options"],
    queryFn: () => api.get<SearchOptions>("/ddr/search-options"),
    staleTime: 5 * 60_000,
  });

  // Wells are scoped to the chosen field, as everywhere else on this page. With
  // no field picked every well is offered — 842 of them, so the select stays
  // searchable by typing rather than forcing a field choice first.
  const wells = useMemo(() => {
    const all = optsQ.data?.wells ?? [];
    const scoped = field ? all.filter((w) => w.field === field) : all;
    const nameCount = new Map<string, number>();
    for (const w of scoped) {
      const n = w.name || w.code;
      nameCount.set(n, (nameCount.get(n) ?? 0) + 1);
    }
    // Well NAMES are not unique (DA-008 and DA-009 are both "DANAN-008"), so a
    // duplicate name carries its code to stay tellable apart. The value is the
    // code either way — that is what the report endpoints key on.
    return scoped.map((w) => {
      const n = w.name || w.code;
      return { code: w.code, label: (nameCount.get(n) ?? 0) > 1 ? `${n} (${w.code})` : n };
    });
  }, [optsQ.data, field]);

  const daysQ = useQuery({
    queryKey: ["ddr", "browse-days", wellCode],
    queryFn: () => api.get<ReportRow[]>(`/ddr/wells/${encodeURIComponent(wellCode)}/reports`),
    enabled: !!wellCode,
  });

  /**
   * Re-point the date window at the well that is actually selected.
   *
   * Without this a window left over from the previous well silently filters the
   * new one to nothing — pick a 1389 well after a 1395 one and the list reads
   * "no reports in that date window" for a well that has hundreds. Showing the
   * well's own first and last report date instead makes the span visible and
   * gives a sane starting point to narrow from.
   */
  useEffect(() => {
    if (!wellCode || !daysQ.data) return;
    if (appliedRangeFor.current === wellCode) return;   // already applied; leave manual edits alone
    appliedRangeFor.current = wellCode;
    const dates = daysQ.data.map((r) => (r.date ?? "").trim()).filter(Boolean).sort();
    setDateFrom(dates[0] ?? "");
    setDateTo(dates[dates.length - 1] ?? "");
  }, [wellCode, daysQ.data]);

  // Jalali dates sort lexicographically, so the window is a string compare.
  const days = useMemo(() => {
    const rows = daysQ.data ?? [];
    const from = dateFrom.trim(), to = dateTo.trim();
    if (!from && !to) return rows;
    return rows.filter((r) => {
      const d = (r.date ?? "").trim();
      // An undated report cannot be judged against a window, and the window is
      // now pre-filled with the well's own span — so excluding them would hide
      // real reports the moment a well is picked. They stay visible with a "—"
      // date and are counted separately in the header.
      if (!d) return true;
      return (!from || d >= from) && (!to || d <= to);
    });
  }, [daysQ.data, dateFrom, dateTo]);

  /** Reports the archive stored without a date — they cannot be windowed. */
  const undated = useMemo(
    () => (daysQ.data ?? []).filter((r) => !(r.date ?? "").trim()).length,
    [daysQ.data],
  );

  const clear = () => {
    appliedRangeFor.current = "";
    setField(""); setWellCode(""); setDateFrom(""); setDateTo("");
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* Pickers */}
      <div className="shrink-0 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={LABEL} htmlFor="ddr-browse-field">Field</label>
            <select id="ddr-browse-field" className={SELECT} value={field}
              onChange={(e) => { setField(e.target.value); setWellCode(""); setDateFrom(""); setDateTo(""); }}>
              <option value="">All fields</option>
              {(optsQ.data?.fields ?? []).map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="ddr-browse-well">
              Well no.{field ? ` · in ${field}` : ""}
            </label>
            <select id="ddr-browse-well" className={SELECT} value={wellCode}
              disabled={!wells.length}
              onChange={(e) => { setWellCode(e.target.value); setDateFrom(""); setDateTo(""); }}>
              <option value="">{wells.length ? `Select a well (${wells.length})` : "No wells"}</option>
              {wells.map((w) => <option key={w.code} value={w.code}>{w.label}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Date from</label>
            <JalaliDatePicker value={dateFrom} onChange={setDateFrom} placeholder="1395/01/06" className="w-full" />
          </div>
          <div>
            <label className={LABEL}>Date to</label>
            <JalaliDatePicker value={dateTo} onChange={setDateTo} placeholder="1395/12/29" className="w-full" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <p className="text-[11px] text-gray-500">
            Pick a well to list its daily reports, then click a day to open the full report.
            The dates start at that well's own first and last report — narrow them to focus
            on a section.
          </p>
          <button onClick={clear}
            className="min-h-[44px] sm:min-h-[32px] px-3 text-sm sm:text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
            Clear
          </button>
        </div>
      </div>

      {/* Day list */}
      <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 shrink-0 text-sm text-gray-600">
          {!wellCode
            ? "No well selected."
            : daysQ.isLoading
              ? "Loading the day list…"
              : <>
                  Daily reports · <b>{days.length}</b>
                  {daysQ.data && days.length !== daysQ.data.length ? ` of ${daysQ.data.length}` : ""}
                  {undated > 0 ? <span className="text-gray-400"> · {undated} undated, always shown</span> : null}
                </>}
        </div>
        <div className="overflow-auto flex-1 min-h-0">
          {!wellCode ? (
            <p className="p-8 text-center text-sm text-gray-500">
              Choose a field and a well above to see that well's reports.
            </p>
          ) : days.length === 0 && !daysQ.isLoading ? (
            <p className="p-8 text-center text-sm text-gray-500">
              {daysQ.data?.length
                ? "No reports on this well inside that date window."
                : "This well has no daily reports in the archive."}
            </p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0">
                <tr>
                  {["#", "Date", "Morning depth", "From", "To", "Meterage", "Hours", "Engineer", "Summary"].map((h) => (
                    <th key={h} className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((r) => (
                  <tr key={r.serialNo}
                    onClick={() => onOpenReport(wellCode, r.serialNo, r.date)}
                    title="Open this day's full report"
                    className="cursor-pointer hover:bg-blue-50/50 transition-colors duration-100">
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums text-gray-500">{r.serialNo}</td>
                    <td className="border border-gray-200 px-2 py-1 tabular-nums font-medium text-blue-700 whitespace-nowrap">{fmt(r.date)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(r.morningDepth)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(r.fromPoint)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(r.toPoint)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(meterage(r))}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{fmt(r.totalHours)}</td>
                    <td className="border border-gray-200 px-2 py-1 whitespace-nowrap">{fmt(r.engineer)}</td>
                    <td className="border border-gray-200 px-2 py-1 max-w-[28rem] truncate" title={r.description ?? undefined}>
                      {fmt(r.description)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
