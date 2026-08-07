/**
 * DDR per-well analytics, cut along the a.json (PEDC/POGC DDR) vocabulary.
 *
 *   progress            → drilling-progress curve, depth mKB vs report day
 *   operations_24hr     → code_1: hours per OPERATION CODE, busiest first
 *                         code_2: P / NP — DERIVED here, the archive has no flag
 *   formations          → prog_top_md_mkb vs final_top_md_mkb
 *
 * Plus one block a.json has no vocabulary for: the archive's own TimeAnalysis
 * breakdown (hours per activity type). It is the well's OTHER record of where
 * the time went — per day rather than per logged operation — and is shown so
 * the office keeps a number the old view had.
 *
 * Everything is aggregated across every daily report of the well by
 * /ddr/wells/:wellCode/analytics.
 */
import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, ReferenceLine, ReferenceDot,
} from "recharts";
import { api } from "../../api/client.js";
import { useQuery } from "@tanstack/react-query";

/** a.json operations_24hr.code_2 — P (productive) / NP (non-productive). */
type Pnp = "P" | "NP" | null;

interface OpCode { code: string; desc: string | null; hours: number; rows: number; pnp: Pnp }

interface Analytics {
  progress: { day: number; date: string | null; depth: number; meterage: number | null; hours: number | null }[];
  /** Archive TimeAnalysis, summed per activity type across the well — no a.json block. */
  timeByType: { group: string | null; type: string | null; hours: number }[];
  timeByGroup: { group: string; hours: number }[];
  /** a.json operations_24hr.code_1 — OperationAnalysis rows via the Operations lookup. */
  timeByOperation: OpCode[];
  /** a.json operations_24hr.code_2 — inferred, never stored. */
  pnp: {
    source: "operation-code definitions" | "activity groups";
    productiveHours: number;
    nonProductiveHours: number;
    unclassifiedHours: number;
    totalHours: number;
    topNonProductive: OpCode[];
    unclassifiedCodes: OpCode[];
    activityGroup: { drillingHours: number; waitingHours: number };
    untimedRows: number;
  };
  /** a.json formations — final (actual) top only; the prognosed top has no archive column. */
  formations: { name: string | null; progTopMd: number | null; finalTopMd: number | null; subseaDepth: string | null }[];
  summary: { reports: number; maxDepth: number | null; totalHours: number; totalDays: number | null };
}

/** P = blue (primary), NP = amber (accent), unclassified = slate. */
const PNP_COLOR: Record<string, string> = { P: "#2563eb", NP: "#f59e0b", "": "#94a3b8" };
const PNP_LABEL: Record<string, string> = { P: "Productive (P)", NP: "Non-productive (NP)", "": "Unclassified" };

const num = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = (part: number, total: number) => (total > 0 ? `${Math.round((part / total) * 100)}%` : "—");

export function DdrAnalytics({ wellCode, markDate }: { wellCode: string; markDate?: string | null }) {
  const q = useQuery({
    queryKey: ["ddr", "analytics", wellCode],
    queryFn: () => api.get<Analytics>(`/ddr/wells/${encodeURIComponent(wellCode)}/analytics`),
  });
  const a = q.data;
  // code → definition, for the operation-code chart tooltip.
  const descByCode = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of a?.timeByOperation ?? []) if (r.desc) m.set(r.code, r.desc);
    return m;
  }, [a?.timeByOperation]);
  // TimeAnalysis rows, keyed for the category axis. Activity types are keyed by
  // (group, type) in the archive, so one type NAME can occur under two groups —
  // those get the group prefixed rather than silently sharing a bar.
  const typeRows = useMemo(() => {
    const rows = a?.timeByType ?? [];
    const seen = new Map<string, number>();
    for (const r of rows) { const k = r.type || "—"; seen.set(k, (seen.get(k) ?? 0) + 1); }
    return rows.map((r) => {
      const k = r.type || "—";
      return { ...r, label: (seen.get(k) ?? 0) > 1 && r.group ? `${r.group} · ${k}` : k };
    });
  }, [a?.timeByType]);

  if (q.isLoading) return <div className="text-sm text-gray-400 p-4">Loading analytics…</div>;
  if (!a) return null;
  const s = a.summary;
  const p = a.pnp;
  // The day of the report currently being viewed — matched by Jalali date, the
  // unique per-well key (the curve only carries depth>0 days, so a rig-up day
  // with no progress simply won't be found and we say so).
  const md = markDate?.trim();
  const marker = md ? a.progress.find((x) => (x.date ?? "").trim() === md) : undefined;
  const ops = a.timeByOperation;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Reports" value={s.reports} />
        <Stat label="Max depth (mKB)" value={s.maxDepth} />
        <Stat label="Total days" value={s.totalDays} />
        <Stat label="Total hours (hr)" value={s.totalHours} />
      </div>

      <Card title="Drilling progress — depth (mKB) vs report day">
        {a.progress.length < 2 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={a.progress} margin={{ top: 20, right: 20, left: 8, bottom: 18 }}>
                <CartesianGrid stroke="#eef2f7" />
                <XAxis dataKey="day" type="number" stroke="#475569" fontSize={11}
                  label={{ value: "Report day", position: "insideBottom", offset: -6, fontSize: 11, fill: "#475569" }} />
                <YAxis reversed stroke="#475569" fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} />
                <Tooltip
                  formatter={(v: number | string) => [`${Number(v).toLocaleString()} mKB`, "Depth"]}
                  labelFormatter={(d: number) => {
                    const pt = a.progress.find((x) => x.day === d);
                    return pt ? `Day ${d} · ${pt.date ?? ""}` : `Day ${d}`;
                  }}
                />
                <Line type="monotone" dataKey="depth" stroke="#1e40af" strokeWidth={2} dot={false} isAnimationActive={false} />
                {/* Mark the day of the report being viewed on the full curve. */}
                {marker && (
                  <ReferenceLine x={marker.day} stroke="#dc2626" strokeDasharray="4 3" ifOverflow="extendDomain"
                    label={{ value: marker.date ?? `Day ${marker.day}`, position: "top", fontSize: 10, fill: "#b91c1c" }} />
                )}
                {marker && (
                  <ReferenceDot x={marker.day} y={marker.depth} r={5} fill="#dc2626" stroke="#fff" strokeWidth={1.5} isFront ifOverflow="visible" />
                )}
              </LineChart>
            </ResponsiveContainer>
            {marker ? (
              <div className="px-3 pb-1 pt-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block bg-red-600" />
                  Viewed report — day {marker.day} · {marker.date} · {Number(marker.depth).toLocaleString()} mKB
                </span>
              </div>
            ) : md ? (
              <div className="px-3 pb-1 pt-2 text-[11px] text-gray-400">
                Viewed report ({md}) has no recorded depth — not plotted on the curve.
              </div>
            ) : null}
          </>
        )}
      </Card>

      {/* ── a.json operations_24hr.code_1 ────────────────────────────────── */}
      <Card
        title="24 Hrs Operation Report — hours by operation code"
        note="a.json operations_24hr.code_1"
      >
        {ops.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, ops.length * 22)}>
              <BarChart data={ops} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" stroke="#475569" fontSize={11}
                  label={{ value: "hr", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="code" stroke="#475569" fontSize={10} width={62} />
                <Tooltip
                  formatter={(v: number) => [`${num(v)} hr`, "Logged"]}
                  labelFormatter={(code: string) => {
                    const d = descByCode.get(code);
                    return d ? `${code} — ${d.length > 110 ? `${d.slice(0, 110)}…` : d}` : code;
                  }}
                />
                <Bar dataKey="hours" radius={[0, 3, 3, 0]} isAnimationActive={false}>
                  {ops.map((r, i) => <Cell key={i} fill={PNP_COLOR[r.pnp ?? ""]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Legend />
            <div className="px-3 pb-1 pt-2 text-[11px] text-gray-400">
              Hours are each log row&rsquo;s from&nbsp;→&nbsp;to span (a.json dur_hr, which the archive keeps as a
              time pair, not a number).
              {p.untimedRows > 0 && ` ${p.untimedRows.toLocaleString()} log row${p.untimedRows === 1 ? "" : "s"} carry no time and are excluded.`}
            </div>
          </>
        )}
      </Card>

      {/* ── a.json operations_24hr.code_2 — INFERRED ─────────────────────── */}
      <Card
        title="Productive vs non-productive"
        note="a.json operations_24hr.code_2 — inferred"
      >
        <Inferred>
          The archive stores no P/NP flag, so this split is derived — by one of two routes, and this well used
          the one named here.
          {p.source === "operation-code definitions"
            ? " Read off the operation-code definitions: a definition opening “Lost time due to …” is NP; one opening “Time actually spent …”, “All operation(s) …” (including “All the operations for rig down / moving”) or “All repair …” is P. Every other wording stays unclassified."
            : " No operation row on this well carries a usable time, so the operation-code definitions cannot be used at all: the split falls back to the coarser ActivityGroups signal (01 Drilling → P, 02 Waiting → NP)."}
        </Inferred>

        {p.totalHours <= 0 ? <Empty /> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-2 pt-2">
              <Stat label="NPT total (hr)" value={p.nonProductiveHours} accent />
              <Stat label="NPT share" text={pct(p.nonProductiveHours, p.totalHours)} accent />
              <Stat label="Productive (hr)" value={p.productiveHours} />
              <Stat label="Unclassified (hr)" value={p.unclassifiedHours} />
            </div>

            <div className="px-2 pt-3">
              <div className="flex h-4 w-full rounded-sm overflow-hidden bg-gray-100">
                {(["P", "NP", ""] as const).map((k) => {
                  const h = k === "P" ? p.productiveHours : k === "NP" ? p.nonProductiveHours : p.unclassifiedHours;
                  const w = p.totalHours > 0 ? (h / p.totalHours) * 100 : 0;
                  return w > 0
                    ? <div key={k} style={{ width: `${w}%`, background: PNP_COLOR[k] }} title={`${PNP_LABEL[k]} — ${num(h)} hr`} />
                    : null;
                })}
              </div>
              <Legend />
              <div className="pb-1 pt-1 text-[11px] text-gray-400">
                Shares are of the {num(p.totalHours)} hr of logged operation time, not of calendar time.
              </div>
            </div>

            <div className="px-2 pt-2">
              <SubTitle>Top non-productive codes</SubTitle>
              {p.topNonProductive.length === 0 ? (
                <div className="px-1.5 py-2 text-[11px] text-gray-400">
                  No operation code on this well is defined as lost time.
                </div>
              ) : (
                <OpTable rows={p.topNonProductive} total={p.totalHours} />
              )}
            </div>

            {p.unclassifiedCodes.length > 0 && (
              <div className="px-2 pt-3">
                <SubTitle>Unclassified codes — definition says neither</SubTitle>
                <OpTable rows={p.unclassifiedCodes} total={p.totalHours} />
              </div>
            )}

            <div className="px-3 pb-1 pt-3 text-[11px] text-gray-500 border-t border-gray-100 mt-3">
              Cross-check, the archive&rsquo;s other (per-day, not per-code) signal — ActivityGroups:
              <span className="ml-1 font-medium text-gray-700">01 Drilling {num(p.activityGroup.drillingHours)} hr</span>
              <span className="text-gray-400"> · </span>
              <span className="font-medium text-gray-700">02 Waiting {num(p.activityGroup.waitingHours)} hr</span>
            </div>
          </>
        )}
      </Card>

      {/* ── archive TimeAnalysis — the well's other time record ──────────── */}
      <Card title="Time distribution by activity type" note="archive TimeAnalysis — no a.json block">
        {typeRows.length === 0 ? (
          <NotRecordedBlock>No time breakdown is recorded in the archive for this well.</NotRecordedBlock>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, typeRows.length * 22)}>
              <BarChart data={typeRows} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" stroke="#475569" fontSize={11}
                  label={{ value: "hr", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "#94a3b8" }} />
                <YAxis type="category" dataKey="label" stroke="#475569" fontSize={10} width={150} />
                <Tooltip
                  formatter={(v: number) => [`${num(v)} hr`, "Logged"]}
                  labelFormatter={(label: string) => {
                    const g = typeRows.find((r) => r.label === label)?.group;
                    return g && !label.startsWith(g) ? `${g} — ${label}` : label;
                  }}
                />
                <Bar dataKey="hours" fill="#64748b" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <div className="px-3 pb-1 pt-2 text-[11px] text-gray-400">
              The archive&rsquo;s own time breakdown (TimeAnalysis), summed over every report of the well. It is
              filed per DAY and per activity, not per logged operation, so it is a coarser record than the
              operation-code chart above and the two totals need not agree.
            </div>
          </>
        )}
      </Card>

      {/* ── a.json formations ────────────────────────────────────────────── */}
      <Card title="Formations — prognosed vs actual top" note="a.json formations">
        {a.formations.length === 0 ? (
          <NotRecordedBlock>No formation top is recorded in the archive for this well.</NotRecordedBlock>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-1.5 py-1 text-left font-medium">Formation</th>
                    <th className="px-1.5 py-1 text-right font-medium whitespace-nowrap">Prog. top (mKB)</th>
                    <th className="px-1.5 py-1 text-right font-medium whitespace-nowrap">Final top (mKB)</th>
                    <th className="px-1.5 py-1 text-right font-medium whitespace-nowrap">Subsea (D07)</th>
                  </tr>
                </thead>
                <tbody>
                  {a.formations.map((f, i) => (
                    <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
                      <td className="px-1.5 py-0.5 whitespace-nowrap">{f.name ?? "—"}</td>
                      <td className="px-1.5 py-0.5 text-right"><NotRecorded /></td>
                      <td className="px-1.5 py-0.5 text-right tabular-nums font-medium text-gray-800">{num(f.finalTopMd, 2)}</td>
                      <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-500">{f.subseaDepth ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-3 pb-1 pt-2 text-[11px] text-gray-400">
              a.json prints the prognosed top beside the final one. D07 stores the final (actual) top only — the
              prognosed top, the TVD, the thickness and the drilled ROP are not recorded in the archive.
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, text, accent }: { label: string; value?: number | null; text?: string; accent?: boolean }) {
  return (
    <div className={`border rounded px-3 py-2 ${accent ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
      <div className={`text-[10px] uppercase tracking-wide ${accent ? "text-amber-700" : "text-gray-400"}`}>{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${accent ? "text-amber-900" : "text-gray-800"}`}>
        {text ?? (value == null ? "—" : value.toLocaleString())}
      </div>
    </div>
  );
}
function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-3 py-2 border-b border-gray-100 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {note && <span className="text-[10px] uppercase tracking-wide text-gray-400 shrink-0">{note}</span>}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1.5 pb-1">{children}</div>;
}
/** Amber banner — this block is DERIVED, not read off the archive. */
function Inferred({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-2 mt-1 mb-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
      <span className="font-semibold uppercase tracking-wide text-[10px] mr-1">Derived</span>
      {children}
    </div>
  );
}
/** The archive never captured this field — distinct from "the crew left it blank". */
function NotRecorded() {
  return <span className="text-[10px] italic text-gray-400" title="This field has no column in the archive">not recorded</span>;
}
function NotRecordedBlock({ children }: { children: React.ReactNode }) {
  return <div className="h-24 grid place-items-center text-[11px] italic text-gray-400 px-3 text-center">{children}</div>;
}
function Legend() {
  return (
    <div className="flex flex-wrap gap-4 px-3 pb-1 pt-2 text-[11px] text-gray-500">
      {(["P", "NP", ""] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: PNP_COLOR[k] }} />
          {PNP_LABEL[k]}
        </span>
      ))}
    </div>
  );
}
function OpTable({ rows, total }: { rows: OpCode[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="px-1.5 py-1 text-left font-medium w-16">Code</th>
            <th className="px-1.5 py-1 text-left font-medium">Definition (Operations lookup)</th>
            <th className="px-1.5 py-1 text-right font-medium whitespace-nowrap">Hours (hr)</th>
            <th className="px-1.5 py-1 text-right font-medium whitespace-nowrap">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} className="border-t border-gray-100">
              <td className="px-1.5 py-0.5 font-medium text-gray-800 whitespace-nowrap">{r.code}</td>
              <td className="px-1.5 py-0.5 text-gray-600">{r.desc ?? "—"}</td>
              <td className="px-1.5 py-0.5 text-right tabular-nums font-medium text-gray-800">{num(r.hours)}</td>
              <td className="px-1.5 py-0.5 text-right tabular-nums text-gray-500">{pct(r.hours, total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Empty() {
  return <div className="h-40 grid place-items-center text-sm text-gray-400">No data.</div>;
}
