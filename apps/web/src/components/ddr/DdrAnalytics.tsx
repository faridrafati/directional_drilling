/**
 * DDR per-well analytics (port of the DDR-React Analytics view): the
 * drilling-progress curve (depth vs report-day) and the time distribution by
 * activity type, aggregated across every daily report of the well by the
 * /ddr/wells/:wellCode/analytics endpoint.
 */
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell, ReferenceLine, ReferenceDot,
} from "recharts";
import { api } from "../../api/client.js";

interface Analytics {
  progress: { day: number; date: string | null; depth: number; meterage: number | null; hours: number | null }[];
  timeByType: { group: string | null; type: string | null; hours: number }[];
  timeByGroup: { group: string; hours: number }[];
  summary: { reports: number; maxDepth: number | null; totalHours: number; totalDays: number | null };
}

const GROUP_COLOR: Record<string, string> = { Drilling: "#2563eb", Waiting: "#f59e0b" };

export function DdrAnalytics({ wellCode, markDate }: { wellCode: string; markDate?: string | null }) {
  const q = useQuery({
    queryKey: ["ddr", "analytics", wellCode],
    queryFn: () => api.get<Analytics>(`/ddr/wells/${encodeURIComponent(wellCode)}/analytics`),
  });
  if (q.isLoading) return <div className="text-sm text-gray-400 p-4">Loading analytics…</div>;
  const a = q.data;
  if (!a) return null;
  const s = a.summary;
  // The day of the report currently being viewed — matched by Jalali date, the
  // unique per-well key (the curve only carries depth>0 days, so a rig-up day
  // with no progress simply won't be found and we say so).
  const md = markDate?.trim();
  const marker = md ? a.progress.find((p) => (p.date ?? "").trim() === md) : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Reports" value={s.reports} />
        <Stat label="Max depth (m)" value={s.maxDepth} />
        <Stat label="Total days" value={s.totalDays} />
        <Stat label="Total hours" value={s.totalHours} />
      </div>

      <Card title="Drilling progress — depth (m) vs day">
        {a.progress.length < 2 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={a.progress} margin={{ top: 20, right: 20, left: 8, bottom: 18 }}>
                <CartesianGrid stroke="#eef2f7" />
                <XAxis dataKey="day" type="number" stroke="#475569" fontSize={11}
                  label={{ value: "Report day", position: "insideBottom", offset: -6, fontSize: 11, fill: "#475569" }} />
                <YAxis reversed stroke="#475569" fontSize={11} tickFormatter={(v: number) => v.toLocaleString()} />
                <Tooltip
                  formatter={(v: number | string) => [`${Number(v).toLocaleString()} m`, "Depth"]}
                  labelFormatter={(d: number) => {
                    const pt = a.progress.find((p) => p.day === d);
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
                  Viewed report — day {marker.day} · {marker.date} · {Number(marker.depth).toLocaleString()} m
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

      <Card title="Time distribution by activity type (hours)">
        {a.timeByType.length === 0 ? <Empty /> : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(180, a.timeByType.length * 22)}>
              <BarChart data={a.timeByType} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" stroke="#475569" fontSize={11} />
                <YAxis type="category" dataKey="type" stroke="#475569" fontSize={10} width={150} />
                <Tooltip formatter={(v: number) => [`${v} h`, "Hours"]} />
                <Bar dataKey="hours" radius={[0, 3, 3, 0]}>
                  {a.timeByType.map((r, i) => <Cell key={i} fill={GROUP_COLOR[r.group ?? ""] ?? "#64748b"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 px-3 pb-1 pt-2 text-[11px] text-gray-500">
              {a.timeByGroup.map((g) => (
                <span key={g.group} className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GROUP_COLOR[g.group] ?? "#64748b" }} />
                  {g.group}: <span className="font-medium text-gray-700">{g.hours} h</span>
                </span>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-white border border-gray-200 rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-800 tabular-nums">{value == null ? "—" : value.toLocaleString()}</div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-3 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">{title}</div>
      <div className="p-2">{children}</div>
    </div>
  );
}
function Empty() {
  return <div className="h-40 grid place-items-center text-sm text-gray-400">No data.</div>;
}
