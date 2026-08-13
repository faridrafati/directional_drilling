/**
 * A WellView template FILLED with the sample database, block by block.
 *
 * The layout view (iframe) shows what the .afr template looks like empty; this
 * view resolves the same parsed blocks against `wv9.0 Sample.mdb` (converted to
 * SQLite) for one selected well and shows the rows that WellView would print.
 *
 * It deliberately does NOT try to reproduce Peloton's exact print layout —
 * that is what the layout view is for. This is the DATA: every block in
 * template order, its interpreted column captions, and its rows, with the
 * honest states spelled out (computed-at-print-time tables, columns the
 * database lacks, capped row counts). Component rows carry their schematic
 * icon from the Component-icons library when the description matches one.
 */
import { useQuery } from "@tanstack/react-query";
import { entryApi } from "../../entry/client.js";

interface BlockData {
  table: string | null;
  title: string | null;
  exists: boolean;
  computed: boolean;
  columns?: { column: string; label: string }[];
  missing?: string[];
  rowCount?: number;
  truncated?: boolean;
  allNull?: boolean;
  rows?: (string | number | null)[][];
  icons?: (string | null)[];
}
interface TemplateData {
  report: string;
  well: { idwell: string; name: string };
  blocks: BlockData[];
}

/** ISO timestamps read naturally; midnight-only stamps read as dates. */
function fmt(v: string | number | null): string {
  if (v == null) return "";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
  }
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
  if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
  return v;
}

export function SampleFilledTemplate({ html, well }: { html: string; well: string }) {
  const q = useQuery({
    queryKey: ["wellview", "sample", "template", html, well],
    queryFn: () =>
      entryApi.get<TemplateData>(
        `/wellview/sample/template-data?html=${encodeURIComponent(html)}&well=${encodeURIComponent(well)}`,
      ),
    staleTime: Infinity,
  });

  if (q.isLoading) return <div className="p-4 text-sm text-gray-400">Reading the sample database…</div>;
  if (q.error) {
    return (
      <div className="m-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
        {(q.error as Error).message}
      </div>
    );
  }
  const data = q.data!;
  const withRows = data.blocks.filter((b) => (b.rowCount ?? 0) > 0).length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
      <div className="max-w-5xl mx-auto space-y-3">
        <p className="text-[11px] text-gray-500">
          <b>{data.report}</b> filled from the sample database for <b>{data.well.name}</b> —{" "}
          {withRows} of {data.blocks.length} blocks have rows for this well. Data shown exactly as
          stored; blocks WellView computes at print time are marked, not simulated.
        </p>

        {data.blocks.map((b, i) => (
          <section key={`${b.table}-${i}`} className="bg-white border border-gray-200 rounded">
            <div className="px-2 py-1 bg-gray-800 text-white text-[11px] font-semibold flex items-baseline gap-2">
              <span>{b.title || b.table}</span>
              <span className="font-normal text-gray-300 font-mono text-[10px]">{b.table}</span>
              {b.exists && (b.rowCount ?? 0) > 0 && (
                <span className="ml-auto font-normal text-gray-300 tabular-nums">
                  {b.truncated ? `first ${b.rows?.length} of ${b.rowCount} rows` : `n = ${b.rowCount}`}
                </span>
              )}
            </div>

            {b.computed ? (
              <div className="px-3 py-2 text-[11px] text-amber-700 bg-amber-50">
                Computed by WellView at print time — this table is not stored in the database.
              </div>
            ) : !b.exists ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                Table not present in the sample database.
              </div>
            ) : (b.columns?.length ?? 0) === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                None of this block's columns exist in the stored table
                {b.missing?.length ? ` (${b.missing.join(", ")})` : ""}.
              </div>
            ) : (b.rowCount ?? 0) === 0 ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">No rows for this well.</div>
            ) : b.allNull ? (
              <div className="px-3 py-2 text-[11px] text-gray-400">
                {b.rowCount} row{b.rowCount === 1 ? "" : "s"} for this well, but the{" "}
                {b.columns!.length} column{b.columns!.length === 1 ? "" : "s"} this template prints
                ({b.columns!.map((c) => c.label).join(", ")}) {b.rowCount === 1 ? "is" : "are"} empty
                on all of them.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600">
                      {b.icons && <th className="px-1 py-1 w-8" aria-label="icon" />}
                      {b.columns!.map((c) => (
                        <th key={c.column} className="px-2 py-1 text-left font-medium whitespace-nowrap"
                          title={`${b.table}.${c.column}`}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows!.map((r, ri) => (
                      <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}>
                        {b.icons && (
                          <td className="px-1 py-0.5 align-middle">
                            {b.icons[ri] && (
                              <img src={`/wellview-icons/${b.icons[ri]}`} alt="" title="matched schematic icon"
                                className="w-5 h-5 object-contain" loading="lazy" />
                            )}
                          </td>
                        )}
                        {r.map((v, ci) => (
                          <td key={ci} className="px-2 py-0.5 whitespace-nowrap text-gray-800">
                            {fmt(v) || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {b.exists && (b.missing?.length ?? 0) > 0 && (b.columns?.length ?? 0) > 0 && (
              <div className="px-2 py-1 text-[10px] text-gray-400 border-t border-gray-100">
                Not in the stored table: {b.missing!.join(", ")}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
