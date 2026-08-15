/**
 * The Data Auditor (manual §3.10 and §10.2), run over the selected wells or the
 * whole database. Each §10.2 business rule the schema supports is executed;
 * rules whose columns the converted database lacks are listed as skipped —
 * reported, never silently passed. Clicking a finding opens the Edit Data
 * window at the offending record's subject area, which is exactly how the
 * desktop auditor hands problems to the user for correction.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { wvDbApi } from "../../entry/wellviewDb.js";

interface Props {
  db: string;
  wells: string[];              // empty = all wells
  onClose: () => void;
  onOpenRecord: (idwell: string, table: string) => void;
}

/** Unit-converted floats from the .mdb conversion read as noise — round the
 *  DISPLAY to 3 decimals; the stored value is untouched. */
function fmtDetail(v: string | number | null): string {
  const n = typeof v === "number" ? v : Number(v);
  if (v !== null && v !== "" && Number.isFinite(n) && !Number.isInteger(n)) return String(Number(n.toFixed(3)));
  return String(v);
}

export function DataAudit({ db, wells, onClose, onOpenRecord }: Props) {
  const q = useQuery({
    queryKey: ["wvdb", db, "audit", wells.join(",")],
    queryFn: () => wvDbApi.audit(db, wells),
  });

  const grouped = useMemo(() => {
    const out = new Map<string, NonNullable<typeof q.data>["findings"]>();
    for (const f of q.data?.findings ?? []) {
      (out.get(f.report) ?? out.set(f.report, []).get(f.report)!).push(f);
    }
    return [...out.entries()];
  }, [q.data]);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 p-3 sm:p-8" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-4xl mx-auto max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">Data Auditor</span>
          <span className="text-xs text-gray-300">
            {wells.length ? `${wells.length} selected well${wells.length === 1 ? "" : "s"}` : "all wells"}
          </span>
          {q.data && (
            <span className="text-xs text-gray-300 tabular-nums">
              · {q.data.rulesRun} rules run · {q.data.findings.length} finding{q.data.findings.length === 1 ? "" : "s"}
            </span>
          )}
          <button type="button" onClick={onClose}
            className="ml-auto h-7 px-3 text-[11px] rounded border border-gray-600 text-gray-200 hover:bg-gray-700">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {q.isLoading && <div className="text-sm text-gray-400">Auditing…</div>}
          {q.error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {(q.error as Error).message}
            </div>
          )}
          {q.data && q.data.findings.length === 0 && (
            <div className="text-sm text-gray-500">
              No rule violations found{wells.length ? " in the selected wells" : ""} — with{" "}
              {q.data.rulesRun} of the §10.2 rules runnable on this schema.
            </div>
          )}
          {grouped.map(([report, findings]) => (
            <section key={report} className="mb-4">
              <h4 className="text-xs font-semibold text-gray-800 mb-1">
                {report} <span className="font-normal text-gray-400 tabular-nums">({findings.length})</span>
              </h4>
              <div className="border border-gray-200 rounded overflow-hidden">
                {findings.map((f, i) => (
                  <button key={`${f.ruleId}-${i}`} type="button"
                    onClick={() => onOpenRecord(f.idwell, f.table)}
                    title="Open in Edit Data"
                    className="w-full text-left px-2.5 py-1.5 text-[11px] flex flex-wrap items-baseline gap-x-3 gap-y-0.5 hover:bg-blue-50 border-b border-gray-100 last:border-b-0">
                    <span className="font-medium text-gray-900">{f.well ?? f.idwell}</span>
                    <span className="text-gray-600">{f.rule}</span>
                    <span className="text-gray-400 font-mono text-[10px]">{f.table}</span>
                    {Object.entries(f.detail).filter(([, v]) => v != null).map(([k, v]) => (
                      <span key={k} className="text-gray-500">
                        {k}=<b className="font-medium">{fmtDetail(v)}</b>
                      </span>
                    ))}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {q.data && q.data.skipped.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-2">
              Skipped (schema lacks the columns): {q.data.skipped.map((s) => s.ruleId).join(", ")}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
