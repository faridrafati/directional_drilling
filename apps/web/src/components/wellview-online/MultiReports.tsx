/**
 * Multi-well reports — WellView's `custom/reports multi/*.afm` templates.
 *
 * The counterpart to the single-well Reports tab: one table printed across the
 * wells picked in the Well Explorer. "Bit Performance" over a campaign, "Cost
 * Summary by Vendor" over an asset, "Drilling Problems" over a year.
 *
 * The selection is explicit and always shown. A report that quietly widened to
 * every well in the database would look exactly like a correct one, so the
 * well count leads the header and an empty selection returns nothing.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { wvDbApi, type WvMultiReport, type WvXlReport } from "../../entry/wellviewDb.js";
import { useUnitSet } from "../../entry/unitSet.js";
import { useDatum } from "../../entry/datum.js";
import {
  toDisplay, formatUnitValue, displayUnitFor, displayUnitLabel, datumShift,
  type DatumShift, type WellElevations,
} from "@dd/shared";

interface Props {
  db: string;
  wells: string[];
  wellName: (idwell: string) => string;
  onClose: () => void;
}

export function MultiReports({ db, wells, wellName, onClose }: Props) {
  const [unitSet] = useUnitSet();
  // Tools > Reference Datum. The offset is per ROW here, not per screen.
  const [datum] = useDatum();
  const [html, setHtml] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  /** WellView ships two kinds here: .afm reports and .afmxl Excel extracts. */
  const [kind, setKind] = useState<"report" | "extract">("report");

  const listQ = useQuery({
    queryKey: ["wvdb", db, "reports-multi"],
    queryFn: () => wvDbApi.multiReports(db),
    staleTime: Infinity,
  });

  /** Runnable templates, grouped by their folder as WellView files them. */
  const groups = useMemo(() => {
    const all = (listQ.data?.reports ?? []).filter((r) => r.blocks.length > 0);
    const needle = filter.trim().toLowerCase();
    const shown = needle
      ? all.filter((r) => `${r.folder} ${r.name}`.toLowerCase().includes(needle))
      : all;
    const by = new Map<string, WvMultiReport[]>();
    for (const r of shown) {
      const k = r.folder || "(root)";
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(r);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [listQ.data, filter]);

  const xlListQ = useQuery({
    queryKey: ["wvdb", db, "reports-xl"],
    queryFn: () => wvDbApi.xlReports(db),
    staleTime: Infinity,
  });

  const xlGroups = useMemo(() => {
    const all = xlListQ.data?.reports ?? [];
    const needle = filter.trim().toLowerCase();
    const shown = needle ? all.filter((r) => `${r.folder} ${r.name}`.toLowerCase().includes(needle)) : all;
    const by = new Map<string, WvXlReport[]>();
    for (const r of shown) {
      const k = r.folder || "(root)";
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(r);
    }
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [xlListQ.data, filter]);

  const xlQ = useQuery({
    queryKey: ["wvdb", db, "xl-extract", html, wells.join(",")],
    queryFn: () => wvDbApi.xlExtract(db, html!, wells),
    enabled: kind === "extract" && !!html && wells.length > 0,
  });

  /** The extract as CSV — the file WellView would have handed to Excel. */
  const downloadCsv = () => {
    const r = xlQ.data;
    if (!r) return;
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = [r.columns.map((c) => esc(c.label)).join(","),
      ...r.rows.map((row) => row.map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${r.name.replace(/[^\w.-]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runQ = useQuery({
    queryKey: ["wvdb", db, "multi-report", html, wells.join(",")],
    queryFn: () => wvDbApi.multiReport(db, html!, wells),
    enabled: kind === "report" && !!html && wells.length > 0,
  });

  const total = (listQ.data?.reports ?? []).filter((r) => r.blocks.length > 0).length;

  /**
   * The datum offset for ONE row, which is the only scope it can have here.
   *
   * A multi-well report spans wells, so there is no single shift for the grid:
   * every row is a different well with its own kelly bushing. The elevations
   * travel with the payload and are resolved per row.
   */
  const shiftFor = (elev: Record<string, WellElevations> | undefined, idwell: string | undefined):
    DatumShift | null => {
    if (datum === "OrigKB") return datumShift({}, "OrigKB");
    const e = idwell ? elev?.[idwell] : undefined;
    return e ? datumShift(e, datum) : null;
  };

  /**
   * Numbers print in the reader's unit set and from the chosen datum, exactly
   * as every other grid.
   *
   * The `*` is WellView's own: "If you view multi well reports for wells that
   * do not have the reference datum selected, then the * symbol appears in
   * place of the relative depth." It is shown rather than the stored value
   * because a KB depth printed in a column headed `mCF`, among rows that really
   * are in CF, is worse than an admitted gap.
   */
  const cell = (
    v: string | number | null,
    c: { unit?: string; units?: Record<string, unknown>; applyDatum?: boolean },
    shift?: DatumShift | null,
  ) => {
    if (v == null || v === "") return <span className="text-gray-300">—</span>;
    const n = Number(v);
    if (c.unit && Number.isFinite(n)) {
      if (c.applyDatum && datum !== "OrigKB" && !shift?.resolved) {
        return <span className="text-amber-600" title={
          shift?.reason ?? `This well has no ${datum} elevation, so its depths cannot be re-referenced.`
        }>*</span>;
      }
      const d = toDisplay(n, c as never, unitSet, shift);
      if (d) return formatUnitValue(d.value, d);
    }
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    return m ? (m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`) : String(v);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">Multi-Well Reports</span>
          <span className="text-xs text-gray-300" data-testid="wv-multi-wellcount">
            {wells.length === 0
              ? "no wells selected"
              : `${wells.length} well${wells.length === 1 ? "" : "s"} selected`}
          </span>
          <button type="button" onClick={onClose} data-testid="wv-multi-close"
            className="ml-auto h-7 px-3 text-[11px] rounded bg-gray-700 hover:bg-gray-600">Close</button>
        </div>

        {wells.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">
            Select one or more wells in the Well Explorer, then reopen this window. A multi-well
            report prints across the wells you choose — it never runs over the whole database
            by default.
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex">
            {/* ── template list ── */}
            <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col min-h-0">
              <div className="p-2 border-b border-gray-100">
                <div className="flex gap-1 mb-1.5">
                  {(["report", "extract"] as const).map((k) => (
                    <button key={k} type="button" data-testid={`wv-multi-kind-${k}`}
                      onClick={() => { setKind(k); setHtml(null); }}
                      className={`flex-1 h-6 text-[11px] rounded border ${
                        kind === k ? "bg-blue-600 text-white border-blue-600"
                                   : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}>
                      {k === "report" ? "Reports" : "Excel extracts"}
                    </button>
                  ))}
                </div>
                <input value={filter} onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search multi-well reports…" data-testid="wv-multi-search"
                  className="w-full h-7 border border-gray-300 rounded px-2 text-xs" />
                <div className="mt-1 text-[10px] text-gray-400">
                  {kind === "report" ? `${total} templates`
                    : `${xlListQ.data?.reports.length ?? 0} extracts · data only`}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-1">
                {kind === "extract" && xlGroups.map(([folder, rs]) => (
                  <div key={folder} className="mb-2">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">{folder}</div>
                    {rs.map((r) => (
                      <button key={r.html} type="button" data-testid="wv-xl-report"
                        onClick={() => setHtml(r.html)}
                        className={`w-full text-left px-2 py-1 rounded text-xs ${
                          html === r.html ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-100"}`}>
                        {r.name}
                        {r.filterUnread && (
                          <span className="ml-1 text-[9px] text-amber-600" title="Carries a filter this reader cannot decode">filter?</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
                {kind === "report" && groups.map(([folder, rs]) => (
                  <div key={folder} className="mb-2">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">{folder}</div>
                    {rs.map((r) => (
                      <button key={r.html} type="button" data-testid="wv-multi-report"
                        onClick={() => setHtml(r.html)}
                        className={`w-full text-left px-2 py-1 rounded text-xs ${
                          html === r.html ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-100"}`}>
                        {r.name}
                        {r.formatVersion === 2 && (
                          <span className="ml-1 text-[9px] text-amber-600" title="An older (v2.0) template">v2</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* ── output ── */}
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {kind === "extract" ? (
                !html ? (
                  <p className="text-sm text-gray-500">Choose an Excel extract on the left.</p>
                ) : xlQ.isLoading ? (
                  <p className="text-sm text-gray-400">Extracting over {wells.length} wells…</p>
                ) : xlQ.error ? (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    {(xlQ.error as Error).message}
                  </div>
                ) : xlQ.data ? (
                  <>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-sm font-semibold text-gray-800">{xlQ.data.name}</h2>
                      <span className="text-[11px] text-gray-400 font-mono">{xlQ.data.table}</span>
                      <button type="button" onClick={downloadCsv} data-testid="wv-xl-csv"
                        disabled={!xlQ.data.rowCount}
                        className="ml-auto h-7 px-3 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                        Download CSV
                      </button>
                    </div>
                    {xlQ.data.notes.map((n, i) => (
                      <div key={i} className="mt-1.5 px-3 py-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded">
                        {n}
                      </div>
                    ))}
                    {xlQ.data.applied.length > 0 && (
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        Filter applied: {xlQ.data.applied.map((c) => `${c.field} starts with “${c.value}”`).join("; ")}.
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 mt-1.5 mb-2">
                      {xlQ.data.rowCount} row{xlQ.data.rowCount === 1 ? "" : "s"} over {xlQ.data.wells} well
                      {xlQ.data.wells === 1 ? "" : "s"}
                      {xlQ.data.truncated ? ` · showing the first ${xlQ.data.rows.length}` : ""}
                      {xlQ.data.missing.length ? ` · not in this database: ${xlQ.data.missing.join(", ")}` : ""}
                    </p>
                    {xlQ.data.rowCount === 0 ? (
                      <p className="text-sm text-gray-400">No rows for the selected wells.</p>
                    ) : (
                      <div className="overflow-x-auto border border-gray-200 rounded">
                        <table className="w-full text-[11px] border-collapse">
                          <thead>
                            <tr className="bg-gray-100 text-gray-600">
                              {xlQ.data.columns.map((c) => (
                                <th key={c.column} className={`px-2 py-1 text-left font-medium whitespace-nowrap ${
                                  c.computed ? "text-green-700 bg-green-50" : ""}`}>
                                  {c.label}
                                  {c.unit && (
                                    <span className="ml-1 font-normal text-gray-400">
                                      ({displayUnitFor(c, unitSet)?.unit ?? c.unit})
                                    </span>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {xlQ.data.rows.map((row, ri) => (
                              <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}>
                                {row.map((v, ci) => (
                                  <td key={ci} className="px-2 py-0.5 whitespace-nowrap text-gray-800">
                                    {cell(v, xlQ.data!.columns[ci])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : null
              ) : !html ? (
                <p className="text-sm text-gray-500">Choose a report on the left.</p>
              ) : runQ.isLoading ? (
                <p className="text-sm text-gray-400">Running over {wells.length} wells…</p>
              ) : runQ.error ? (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {(runQ.error as Error).message}
                </div>
              ) : runQ.data ? (
                <>
                  <h2 className="text-sm font-semibold text-gray-800">{runQ.data.name}</h2>
                  <p className="text-[11px] text-gray-500 mb-2">
                    {runQ.data.wells} well{runQ.data.wells === 1 ? "" : "s"}:{" "}
                    {wells.slice(0, 4).map(wellName).join(", ")}
                    {wells.length > 4 ? ` and ${wells.length - 4} more` : ""}
                  </p>
                  {runQ.data.blocks.map((b, i) => (
                    <section key={`${b.table}-${i}`} className="mb-4 border border-gray-200 rounded">
                      <div className="px-2 py-1 bg-gray-800 text-white text-[11px] font-semibold flex items-baseline gap-2">
                        <span>{b.title || b.table}</span>
                        <span className="font-normal text-gray-300 font-mono text-[10px]">{b.table}</span>
                        {b.rowCount > 0 && (
                          <span className="ml-auto font-normal text-gray-300 tabular-nums">
                            {b.truncated ? `first ${b.rows.length} of ${b.rowCount}` : `n = ${b.rowCount}`}
                          </span>
                        )}
                      </div>
                      {b.schemaDrift && (
                        <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50">{b.schemaDrift}</div>
                      )}
                      {b.printTimeNote && (
                        <div className="px-3 py-2 text-[11px] text-gray-600 bg-gray-50">{b.printTimeNote}</div>
                      )}
                      {!b.exists ? (
                        <div className="px-3 py-2 text-[11px] text-gray-400">Table not present in this database.</div>
                      ) : b.rowCount === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-gray-400">
                          No rows for the selected wells.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] border-collapse">
                            <thead>
                              <tr className="bg-gray-100 text-gray-600">
                                {b.columns.map((c) => (
                                  <th key={c.column} className="px-2 py-1 text-left font-medium whitespace-nowrap"
                                    title={c.fromWell ? "From the well header" : `${b.table}.${c.column}`}>
                                    {c.label}
                                    {c.unit && (
                                      <span className="ml-1 font-normal text-gray-400">
                                        ({displayUnitLabel(c, unitSet, { datum, resolved: true })})
                                      </span>
                                    )}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {b.rows.map((row, ri) => (
                                <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}>
                                  {row.map((v, ci) => (
                                    <td key={ci} className="px-2 py-0.5 whitespace-nowrap text-gray-800">
                                      {cell(v, b.columns[ci],
                                        shiftFor(runQ.data?.elevations, b.rowWells?.[ri]))}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {b.missing.length > 0 && !b.schemaDrift && (
                        <div className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-100">
                          Not in this database: {b.missing.join(", ")}
                        </div>
                      )}
                    </section>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
