/**
 * An opened well (manual §3.8): the Reports tab and the Schematic tab.
 *
 * Reports: the 181 original WellView layouts on the left, grouped by Peloton's
 * own categories; the selected one resolves against THIS database for THIS
 * well, block by block. Clicking a block's title bar opens the Edit Data window
 * at that subject area — the web equivalent of "double-click a report field to
 * open the corresponding record".
 *
 * Schematic: drawn from the downhole subject areas exactly as §3.8 lists them —
 * wellbore sizes, casing and tubing strings, rods, other-in-hole, perforations,
 * cement and zones — honestly to depth, with string widths from the components'
 * nominal ODs. The history player steps through every date on which the
 * downhole state changed (run/pull/perforation/cement dates found in the data).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
}

export function WellWindow({ db, idwell, wellName, onClose, onEditTable }: Props) {
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
        ? <ReportsTab db={db} idwell={idwell} onEditTable={onEditTable} />
        : <SchematicTab db={db} idwell={idwell} onEditTable={onEditTable} />}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
function ReportsTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

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
    const matched = q
      ? reports.filter((r) => r.name.toLowerCase().includes(q) || r.folder_relative.toLowerCase().includes(q))
      : reports;
    const out = new Map<string, TemplateEntry[]>();
    for (const r of matched) {
      const cat = r.folder_relative.split("/")[0] || "(root)";
      (out.get(cat) ?? out.set(cat, []).get(cat)!).push(r);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [indexQ.data, query]);

  return (
    <div className="flex gap-3 flex-1 min-h-0">
      <aside className="w-72 shrink-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
        <div className="p-2 border-b border-gray-100">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…" aria-label="Search reports"
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
        </div>
        <div className="overflow-y-auto flex-1 p-1">
          {groups.map(([cat, list]) => (
            <div key={cat} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {cat} <span className="font-normal text-gray-400 tabular-nums">{list.length}</span>
              </div>
              {list.map((r) => (
                <button key={r.html} type="button" onClick={() => setSelected(r.html)}
                  className={`w-full text-left px-2 py-1 rounded text-[11px] leading-snug ${
                    r.html === selected ? "bg-blue-50 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-50"}`}>
                  {r.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
        {selected
          ? <FilledTemplate db={db} html={selected} idwell={idwell} onEditTable={onEditTable} />
          : (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 px-6 text-center">
              Select a report — it fills from this database for this well. Reports update as data is
              edited, exactly as in WellView.
            </div>
          )}
      </div>
    </div>
  );
}

/** The template resolved against the chosen database — same block renderer
 *  contract as the sample browser, plus block-title → Edit Data. */
function FilledTemplate({ db, html, idwell, onEditTable }: {
  db: string; html: string; idwell: string; onEditTable: (table: string) => void;
}) {
  interface BlockData {
    table: string | null; title: string | null; exists: boolean; computed: boolean;
    columns?: { column: string; label: string }[]; missing?: string[];
    rowCount?: number; truncated?: boolean; allNull?: boolean;
    rows?: (string | number | null)[][]; icons?: (string | null)[];
  }
  const q = useQuery({
    queryKey: ["wvdb", db, "template", html, idwell],
    queryFn: () => entryApi.get<{ report: string; well: { name: string }; blocks: BlockData[] }>(
      wvDbApi.templateDataPath(db, html, idwell)),
  });

  const fmt = (v: string | number | null): string => {
    if (v == null) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));
    const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
    if (m) return m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`;
    return v;
  };

  if (q.isLoading) return <div className="p-4 text-sm text-gray-400">Filling the report…</div>;
  if (q.error) {
    return <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
      {(q.error as Error).message}
    </div>;
  }
  const data = q.data!;
  const withRows = data.blocks.filter((b) => (b.rowCount ?? 0) > 0).length;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
      <div className="max-w-5xl mx-auto space-y-3">
        <p className="text-[11px] text-gray-500">
          <b>{data.report}</b> — {withRows} of {data.blocks.length} blocks have rows for this well.
          Click a block's title bar to edit that subject area.
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
              <div className="px-3 py-2 text-[11px] text-gray-400">No rows for this well.</div>
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
                    {b.rows!.map((r, ri) => (
                      <tr key={ri} className={ri % 2 ? "bg-gray-50" : ""}>
                        {b.icons && (
                          <td className="px-1 py-0.5 align-middle">
                            {b.icons[ri] && (
                              <img src={`/wellview-icons/${b.icons[ri]}`} alt=""
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
          </section>
        ))}
      </div>
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

function SchematicTab({ db, idwell, onEditTable }: {
  db: string; idwell: string; onEditTable: (table: string) => void;
}) {
  const q = useQuery({
    queryKey: ["wvdb", db, "schematic", idwell],
    queryFn: () => wvDbApi.schematic(db, idwell),
  });
  const [dateIx, setDateIx] = useState<number | null>(null);   // null = latest
  const [playing, setPlaying] = useState(false);
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

  return (
    <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-white flex flex-col">
      <div className="px-3 py-1.5 border-b border-gray-100 flex items-center gap-1.5 flex-wrap shrink-0">
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
        <span className="ml-auto text-[10px] text-gray-400">
          Click an item to edit its subject area. Widths from component nominal OD, depths as stored.
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <SchematicSvg s={s} date={date} onEditTable={onEditTable} />
      </div>
    </div>
  );
}

/**
 * The drawing. One vertical track, depth-true: wellbore sizes as the outer
 * grey profile, casing as black string pairs with shoe triangles, tubing blue,
 * rods thin grey, other-in-hole amber boxes, perforations as red ticks, cement
 * hatch beside the casing it belongs to, zones as green bands with names.
 */
function SchematicSvg({ s, date, onEditTable }: {
  s: WvSchematic; date: string; onEditTable: (table: string) => void;
}) {
  const casings = s.casings.filter((c) => inHole(c, date));
  const tubings = s.tubings.filter((t) => inHole(t, date));
  const rods = s.rods.filter((r) => inHole(r, date));
  const other = s.otherInHole.filter((o) => inHole(o, date));
  const sizes = s.sizes.filter((z) => {
    const start = dstr(z.DtTmStart);
    return !start || start <= date;
  });
  const perfs = s.perforations.filter((p) => {
    const d = dstr(p.DtTm);
    return (!d || d <= date) && String(p.Proposed ?? "") !== "1";
  });
  const cement = s.cement.filter((c) => {
    const d = dstr(c.DtTmStart);
    return (!d || d <= date) && String(c.Proposed ?? "") !== "1";
  });

  const depths: number[] = [];
  for (const set of [casings, tubings, rods, other]) for (const r of set) {
    const d = num(r.DepthBtm); if (d) depths.push(d);
  }
  for (const z of sizes) { const d = num(z.DepthBtmActual); if (d) depths.push(d); }
  for (const p of perfs) { const d = num(p.DepthBtm) ?? num(p.DepthTop); if (d) depths.push(d); }
  for (const z of s.zones) { const d = num(z.DepthBtm); if (d) depths.push(d); }
  const maxDepth = Math.max(100, ...depths) * 1.04;

  const H = 640, W = 560, CX = 240, TOP = 24;
  const y = (depth: number) => TOP + (depth / maxDepth) * (H - TOP - 16);

  const ods: number[] = [];
  for (const c of casings) { const o = num(c.maxOd); if (o) ods.push(o); }
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

  // casings: pair of verticals + shoe triangles, widest (shallowest shoe) outermost by OD
  for (const [i, c] of casings.entries()) {
    const btm = num(c.DepthBtm);
    if (btm == null) continue;
    const hw = halfW(num(c.maxOd));
    const yb = y(btm);
    items.push(
      <g key={`cas${i}`} className="cursor-pointer" onClick={() => onEditTable("wvCas")}>
        <title>{`${c.Des ?? "Casing"} — shoe ${fmtDepth(btm)} (wvCas)`}</title>
        <line x1={CX - hw} y1={TOP} x2={CX - hw} y2={yb} stroke="#111827" strokeWidth="2" />
        <line x1={CX + hw} y1={TOP} x2={CX + hw} y2={yb} stroke="#111827" strokeWidth="2" />
        <path d={`M ${CX - hw} ${yb} l -7 0 l 7 -9 z`} fill="#111827" />
        <path d={`M ${CX + hw} ${yb} l 7 0 l -7 -9 z`} fill="#111827" />
        <text x={CX - hw - 10} y={yb + 4} fontSize="9" fill="#374151" textAnchor="end">
          {String(c.Des ?? "csg")} @ {fmtDepth(btm)}
        </text>
      </g>,
    );
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
  }

  // tubing: blue pair, inside
  for (const [i, t] of tubings.entries()) {
    const btm = num(t.DepthBtm);
    if (btm == null) continue;
    const hw = Math.max(3, halfW(num(t.maxOd)) * 0.55);
    items.push(
      <g key={`tub${i}`} className="cursor-pointer" onClick={() => onEditTable("wvTub")}>
        <title>{`${t.Des ?? "Tubing"} — ${btm} (wvTub)`}</title>
        <line x1={CX - hw} y1={TOP} x2={CX - hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6" />
        <line x1={CX + hw} y1={TOP} x2={CX + hw} y2={y(btm)} stroke="#2563eb" strokeWidth="1.6" />
      </g>,
    );
  }

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
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="mx-auto block max-w-full h-auto"
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
