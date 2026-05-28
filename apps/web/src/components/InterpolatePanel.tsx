/**
 * "Find point between stations" — interpolation lookup over the calculated
 * stations. The user picks ONE known parameter (MD, Inc, Azm, TVD, VSEC, NS,
 * EW, DLS, TF, BR, TR or DMD) and types its value; the panel finds every
 * segment of the densified trajectory whose value brackets the target, then
 * linearly interpolates all the OTHER parameters at that point.
 *
 * Values are handled in DISPLAY units (degrees, °/100·len, length) to match
 * the Calculated Stations table. Angles convert via rad2deg; azimuth/tool-face
 * are compass-normalised. Non-monotonic parameters (EW, NS, Inc, …) can match
 * at several depths, so all matches are listed.
 */
import { useCallback, useMemo, useState } from "react";
import { rad2deg } from "@dd/shared";
import type { StationRow } from "../api/client.js";

type Key = "md" | "inc" | "azm" | "tvd" | "vsec" | "ns" | "ew" | "dls" | "tf" | "br" | "tr" | "dmd";
const KEYS: Key[] = ["md", "inc", "azm", "tvd", "vsec", "ns", "ew", "dls", "tf", "br", "tr", "dmd"];

/** Normalize a compass-style degree value into [0, 360°). 360° → 0°. */
function normDeg(deg: number): number {
  if (!Number.isFinite(deg)) return deg;
  const x = deg - 360 * Math.floor(deg / 360);
  return x >= 360 ? 0 : x;
}

interface Props {
  stations: StationRow[];
  lengthUnit: string;
  /** Reproject NS/EW to the table's current vertical-section azimuth. */
  projectVsec: (ns: number, ew: number) => number;
  onClose: () => void;
}

export function InterpolatePanel({ stations, lengthUnit, projectVsec, onClose }: Props) {
  const params: { key: Key; label: string; unit: string; digits: number }[] = [
    { key: "md", label: "MD", unit: lengthUnit, digits: 2 },
    { key: "inc", label: "Inc", unit: "°", digits: 2 },
    { key: "azm", label: "Azm", unit: "°", digits: 2 },
    { key: "tvd", label: "TVD", unit: lengthUnit, digits: 2 },
    { key: "vsec", label: "VSEC", unit: lengthUnit, digits: 2 },
    { key: "ns", label: "NS", unit: lengthUnit, digits: 2 },
    { key: "ew", label: "EW", unit: lengthUnit, digits: 2 },
    { key: "dls", label: "DLS", unit: `°/100${lengthUnit}`, digits: 3 },
    { key: "tf", label: "TF", unit: "°", digits: 2 },
    { key: "br", label: "BR", unit: `°/100${lengthUnit}`, digits: 3 },
    { key: "tr", label: "TR", unit: `°/100${lengthUnit}`, digits: 3 },
    { key: "dmd", label: "DMD", unit: lengthUnit, digits: 2 },
  ];
  const labelOf = (k: Key) => params.find((p) => p.key === k)!;

  const [key, setKey] = useState<Key>("ew");
  const [valueStr, setValueStr] = useState("");

  /** Station value for a key, in display units. */
  const disp = useCallback((s: StationRow, k: Key): number => {
    switch (k) {
      case "md": return s.md;
      case "inc": return rad2deg(s.inc);
      case "azm": return normDeg(rad2deg(s.azm));
      case "tvd": return s.tvd;
      case "vsec": return projectVsec(s.ns, s.ew);
      case "ns": return s.ns;
      case "ew": return s.ew;
      case "dls": return Math.abs(rad2deg(s.dls)) * 100;
      case "tf": return normDeg(rad2deg(s.tf));
      case "br": return rad2deg(s.br) * 100;
      case "tr": return rad2deg(s.tr) * 100;
      case "dmd": return s.dmd;
    }
  }, [projectVsec]);

  // Range of the chosen parameter across all stations (guidance for the user).
  const range = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (const s of stations) {
      const v = disp(s, key);
      if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    }
    return Number.isFinite(lo) ? { lo, hi } : null;
  }, [stations, key, disp]);

  const target = Number(valueStr);
  const results = useMemo(() => {
    if (valueStr.trim() === "" || !Number.isFinite(target)) return [];
    const out: Record<Key, number>[] = [];
    for (let i = 0; i < stations.length - 1; i++) {
      const A = stations[i], B = stations[i + 1];
      const a = disp(A, key), b = disp(B, key);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) continue;
      if (target < Math.min(a, b) || target > Math.max(a, b)) continue;
      const t = (target - a) / (b - a);
      const vals = {} as Record<Key, number>;
      for (const k of KEYS) vals[k] = disp(A, k) + (disp(B, k) - disp(A, k)) * t;
      out.push(vals);
    }
    // Dedupe near-equal MD (target landing exactly on a station boundary
    // matches both adjacent segments).
    const dedup: Record<Key, number>[] = [];
    for (const r of out) if (!dedup.some((d) => Math.abs(d.md - r.md) < 1e-6)) dedup.push(r);
    return dedup;
  }, [stations, key, valueStr, target, disp]);

  const fmt = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : "—");
  const showResults = valueStr.trim() !== "" && Number.isFinite(target);

  return (
    <div className="mb-4 border border-blue-200 bg-blue-50/50 rounded-lg p-3">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="font-medium text-gray-800">Find point between stations:</span>
        <select
          value={key}
          onChange={(e) => setKey(e.target.value as Key)}
          className="border border-gray-300 rounded px-2 py-1 bg-white"
        >
          {params.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span className="text-gray-500">=</span>
        <input
          type="number"
          value={valueStr}
          onChange={(e) => setValueStr(e.target.value)}
          placeholder="value"
          autoFocus
          className="w-32 border border-gray-300 rounded px-2 py-1 text-right"
        />
        <span className="text-xs text-gray-500">{labelOf(key).unit}</span>
        {range && (
          <span className="text-xs text-gray-400">
            range {fmt(range.lo, labelOf(key).digits)} … {fmt(range.hi, labelOf(key).digits)}
          </span>
        )}
        <button
          onClick={onClose}
          className="ml-auto w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 leading-none"
          title="Close"
        >
          ×
        </button>
      </div>

      {showResults && (
        results.length > 0 ? (
          <div className="mt-2 overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr className="bg-white">
                  <th className="border border-gray-200 px-2 py-1 text-left">#</th>
                  {params.map((p) => (
                    <th
                      key={p.key}
                      className={`border border-gray-200 px-2 py-1 text-right ${p.key === key ? "bg-blue-100 text-blue-800" : ""}`}
                    >
                      {p.label}
                      <div className="font-normal text-[9px] text-gray-400">{p.unit}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className="bg-white">
                    <td className="border border-gray-200 px-2 py-1 text-gray-500 tabular-nums">{i + 1}</td>
                    {params.map((p) => (
                      <td
                        key={p.key}
                        className={`border border-gray-200 px-2 py-1 text-right tabular-nums ${p.key === key ? "bg-blue-50 font-medium" : ""}`}
                      >
                        {fmt(r[p.key], p.digits)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {results.length > 1 && (
              <p className="text-[11px] text-amber-700 mt-1">
                {results.length} points match — {labelOf(key).label} is non-monotonic along the path.
              </p>
            )}
            <p className="text-[11px] text-gray-400 mt-1">
              Linearly interpolated between the two bracketing calculated stations.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-2">
            No point found for {labelOf(key).label} = {valueStr}
            {range ? ` — values range ${fmt(range.lo, labelOf(key).digits)} … ${fmt(range.hi, labelOf(key).digits)} across the calculated stations.` : "."}
          </p>
        )
      )}
    </div>
  );
}
