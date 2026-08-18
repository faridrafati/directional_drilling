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
import { wvDbApi, type WvMultiReport } from "../../entry/wellviewDb.js";
import { useUnitSet } from "../../entry/unitSet.js";
import { toDisplay, formatUnitValue, displayUnitFor } from "@dd/shared";

interface Props {
  db: string;
  wells: string[];
  wellName: (idwell: string) => string;
  onClose: () => void;
}

export function MultiReports({ db, wells, wellName, onClose }: Props) {
  const [unitSet] = useUnitSet();
  const [html, setHtml] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

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

  const runQ = useQuery({
    queryKey: ["wvdb", db, "multi-report", html, wells.join(",")],
    queryFn: () => wvDbApi.multiReport(db, html!, wells),
    enabled: !!html && wells.length > 0,
  });

  const total = (listQ.data?.reports ?? []).filter((r) => r.blocks.length > 0).length;

  /** Numbers print in the reader's unit set, exactly as every other grid. */
  const cell = (v: string | number | null, c: { unit?: string; units?: Record<string, unknown> }) => {
    if (v == null || v === "") return <span className="text-gray-300">—</span>;
    const n = Number(v);
    if (c.unit && Number.isFinite(n)) {
      const d = toDisplay(n, c as never, unitSet);
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
                <input value={filter} onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search multi-well reports…" data-testid="wv-multi-search"
                  className="w-full h-7 border border-gray-300 rounded px-2 text-xs" />
                <div className="mt-1 text-[10px] text-gray-400">{total} templates</div>
              </div>
              <div className="flex-1 overflow-auto p-1">
                {groups.map(([folder, rs]) => (
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
              {!html ? (
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
                                        ({displayUnitFor(c, unitSet)?.unit ?? c.unit})
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
                                      {cell(v, b.columns[ci])}
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
