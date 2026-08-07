/**
 * Browse days — the day list of the wells picked in the Reports & Search sidebar.
 *
 * The rest of that tab is built around SEARCH: you describe what you are looking
 * for and it finds the days that match. This view is the other half of the job —
 * you already know the well and roughly the date, and you just want that report
 * open. It is the THIRD view on the tab's toggle (Remarks · Summary · Browse
 * days) and owns no pickers of its own: the fields, the wells and the date window
 * are the sidebar's, so nothing is duplicated and the selection carries over
 * between searching and browsing.
 *
 * It is a picker, not a viewer: clicking a day calls `onOpenReport`, which opens
 * the same Form / Tables / Analytics overlay every other tab uses. No report
 * rendering is duplicated here.
 *
 * Dates are Jalali (Shamsi) "YYYY/MM/DD" exactly as the archive stores them, so
 * they sort lexicographically and the date window is a plain string compare.
 */
import { useEffect, useMemo, type MutableRefObject } from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "../../api/client.js";
import { useDdrSelection } from "./ddrSelection.js";

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
/** A day row with the well it came from — names are not unique, codes are. */
interface DayRow extends ReportRow { wellCode: string; wellLabel: string }

export interface BrowseWell { code: string; label: string }

/**
 * One day list per well is one request, so a whole field's worth of wells would
 * be hundreds of them. The selection is capped here and the cap is stated on
 * screen — the wells past it are NOT fetched, and never silently dropped.
 */
export const MAX_BROWSE_WELLS = 8;

const fmt = (v: unknown): string =>
  v == null || v === "" ? "—" : typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : String(v);

/** The day's drilled interval — the archive keeps from/to, not the difference. */
const meterage = (r: ReportRow): number | null =>
  r.fromPoint != null && r.toPoint != null ? Number((r.toPoint - r.fromPoint).toFixed(2)) : r.totalMeter;

const TH = "bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600 whitespace-nowrap";
const TD = "border border-gray-200 px-2 py-1";

export function DdrBrowseDays({ wells, onOpenReport, appliedRangeFor }: {
  wells: BrowseWell[];
  onOpenReport?: (wellCode: string, serialNo: number, date: string | null) => void;
  /**
   * The well selection whose own date span has already been written into the
   * shared date pickers. It lives in the parent tab so switching Remarks ⇄
   * Browse does not re-apply the span over a window the user has narrowed by
   * hand; see the effect below.
   */
  appliedRangeFor: MutableRefObject<string>;
}) {
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useDdrSelection();   // the sidebar's own window

  const shown = useMemo(() => wells.slice(0, MAX_BROWSE_WELLS), [wells]);
  const selectionKey = shown.map((w) => w.code).join("|");

  const dayQs = useQueries({
    queries: shown.map((w) => ({
      queryKey: ["ddr", "browse-days", w.code],
      queryFn: () => api.get<ReportRow[]>(`/ddr/wells/${encodeURIComponent(w.code)}/reports`),
      staleTime: 5 * 60_000,
    })),
  });
  const pending = dayQs.some((q) => q.isPending);
  const error = dayQs.find((q) => q.error)?.error;
  // A signature of what has actually arrived — the query array itself is a new
  // object on every render, so it is not a usable dependency.
  const dataSig = dayQs.map((q) => q.dataUpdatedAt).join("|");

  /** Every selected well's days, well by well in the order they were picked. */
  const all = useMemo<DayRow[]>(
    () => shown.flatMap((w, i) =>
      (dayQs[i]?.data ?? []).map((r) => ({ ...r, wellCode: w.code, wellLabel: w.label }))),
    [shown, dataSig],   // dataSig stands in for dayQs, a fresh array on every render
  );

  /**
   * Re-point the date window at the wells that are actually selected.
   *
   * Without this a window left over from the previous well silently filters the
   * new one to nothing — pick a 1389 well after a 1395 one and the list reads
   * "no reports in that date window" for a well that has hundreds. Writing the
   * selection's own first and last report date into the SHARED pickers is the
   * honest fix: it is the very sidebar the user is looking at, so the change is
   * visible rather than hidden state, and it gives a sane span to narrow from.
   *
   * Guarded by a ref keyed on the selection, so a window the user narrows
   * afterwards survives every later render (and the view toggle).
   */
  useEffect(() => {
    if (!selectionKey) { appliedRangeFor.current = ""; return; }
    if (appliedRangeFor.current === selectionKey) return;  // already applied; leave manual edits alone
    // Wait for EVERY well, and treat a failure as "not arrived". An errored
    // query is not pending in React Query v5, so gating on `pending` alone would
    // apply the span of the wells that happened to load and mark the selection
    // done — and when the failed one retried and succeeded, the guard would
    // short-circuit and leave its days filtered out by the other well's window.
    // That is precisely the bug this effect exists to prevent.
    if (pending || dayQs.some((q) => q.error)) return;
    const dates = all.map((r) => (r.date ?? "").trim()).filter(Boolean).sort();
    // Nothing dated came back (every report undated, or an empty well). Writing
    // then would CLEAR a window shared with Tools / Well Path / Mud Stock / ROP,
    // silently discarding a range the user set on another tab — and marking the
    // selection applied would stop a later retry from ever fixing it.
    if (!dates.length) return;
    appliedRangeFor.current = selectionKey;
    setDateFrom(dates[0]);
    setDateTo(dates[dates.length - 1]);
  }, [selectionKey, pending, dayQs, all, appliedRangeFor, setDateFrom, setDateTo]);

  // Jalali dates sort lexicographically, so the window is a string compare.
  const days = useMemo(() => {
    const from = dateFrom.trim(), to = dateTo.trim();
    if (!from && !to) return all;
    return all.filter((r) => {
      const d = (r.date ?? "").trim();
      // An undated report cannot be judged against a window, and the window is
      // pre-filled with the selection's own span — so excluding them would hide
      // real reports the moment a well is picked. They stay visible with a "—"
      // date and are counted separately in the header.
      if (!d) return true;
      return (!from || d >= from) && (!to || d <= to);
    });
  }, [all, dateFrom, dateTo]);

  /** Reports the archive stored without a date — they cannot be windowed. */
  const undated = useMemo(() => all.filter((r) => !(r.date ?? "").trim()).length, [all]);

  const multi = shown.length > 1;
  const capped = wells.length > shown.length;

  return (
    <div className="bg-white border border-gray-200 rounded flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 text-sm text-gray-600 shrink-0 flex items-center justify-between gap-2 flex-wrap">
        <span>
          {!shown.length
            ? "No well selected."
            : pending
              ? "Loading the day list…"
              : <>
                  Daily reports · <b>{days.length.toLocaleString()}</b>
                  {days.length !== all.length ? ` of ${all.length.toLocaleString()}` : ""}
                  {multi ? <span className="text-gray-400"> · {shown.length} wells</span> : null}
                  {undated > 0 ? <span className="text-gray-400"> · {undated} undated, always shown</span> : null}
                </>}
        </span>
        {onOpenReport && days.length > 0 && (
          <span className="text-[11px] text-gray-400 whitespace-nowrap">Click a row to open its daily report →</span>
        )}
      </div>

      {capped && (
        <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 text-[11px] text-amber-700 bg-amber-50">
          {wells.length} wells selected — browsing the first {shown.length} ({shown.map((w) => w.label).join(", ")}).
          The rest were not fetched; narrow the Wells filter to browse them.
        </div>
      )}
      {error != null && (
        <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 text-[11px] text-red-600">{String(error)}</div>
      )}

      <div className="overflow-auto flex-1 min-h-0">
        {!shown.length ? (
          <p className="p-8 text-center text-sm text-gray-500">
            Pick one or more wells in the sidebar to list their daily reports.
          </p>
        ) : pending ? null : days.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            {/* Never assert what the archive holds off a request that failed —
                the error strip above says the fetch broke, not that the well is
                empty. */}
            {error != null
              ? "Could not load the day list — see the error above."
              : all.length
                ? multi
                  ? "No reports on these wells inside that date window."
                  : "No reports on this well inside that date window."
                : multi
                  ? "None of the selected wells has a daily report in the archive."
                  : "This well has no daily reports in the archive."}
          </p>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0">
              <tr>
                {["#", ...(multi ? ["Well"] : []), "Date", "Morning depth", "From", "To", "Meterage", "Hours", "Engineer", "Summary"]
                  .map((h) => <th key={h} className={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {days.map((r) => (
                <tr key={`${r.wellCode}-${r.serialNo}`}
                  onClick={onOpenReport ? () => onOpenReport(r.wellCode, r.serialNo, r.date) : undefined}
                  title={onOpenReport ? "Open this day's full report" : undefined}
                  className={onOpenReport ? "cursor-pointer hover:bg-blue-50/50 transition-colors duration-100" : undefined}>
                  <td className={`${TD} text-right tabular-nums text-gray-500`}>{r.serialNo}</td>
                  {multi && <td className={`${TD} whitespace-nowrap text-gray-600`} title={r.wellCode}>{r.wellLabel}</td>}
                  <td className={`${TD} tabular-nums font-medium text-blue-700 whitespace-nowrap`}>{fmt(r.date)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmt(r.morningDepth)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmt(r.fromPoint)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmt(r.toPoint)}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmt(meterage(r))}</td>
                  <td className={`${TD} text-right tabular-nums`}>{fmt(r.totalHours)}</td>
                  <td className={`${TD} whitespace-nowrap`}>{fmt(r.engineer)}</td>
                  <td className={`${TD} max-w-[28rem] truncate`} title={r.description ?? undefined}>{fmt(r.description)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
