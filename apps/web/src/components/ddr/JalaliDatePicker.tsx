/**
 * Lightweight Jalali (Shamsi) calendar date picker — no external dependencies.
 * Accepts/emits "YYYY/MM/DD" Jalali strings (matching the DDR data). The
 * Jalali↔Gregorian conversion is the jalaali-js algorithm (with TRUNCATING
 * div/mod — `Math.trunc`, not `Math.floor`, which matters for negative args),
 * used only to align the day grid under the correct weekday.
 */
import { useEffect, useRef, useState } from "react";

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.trunc(a / b) * b;

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const gy = jy + 621;
  let leapJ = -14, jp = breaks[0], jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}
function toGregorian(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1);
}
const isLeap = (jy: number) => jalCal(jy).leap === 0;
const monthLen = (jy: number, jm: number) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeap(jy) ? 30 : 29);

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
const WD = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"]; // Persian week starts Saturday

function parse(s: string) {
  const m = s.trim().match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  return m ? { jy: +m[1], jm: +m[2], jd: +m[3] } : null;
}

export function JalaliDatePicker({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  /** Width/flex class for the field wrapper. Defaults to a fixed w-36; pass e.g.
   *  "flex-1 min-w-0" so two pickers share a narrow sidebar row without overflow. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sel = parse(value);
  const [view, setView] = useState(() => (sel ? { jy: sel.jy, jm: sel.jm } : { jy: 1395, jm: 1 }));

  useEffect(() => {
    const p = parse(value);
    if (p) setView({ jy: p.jy, jm: p.jm });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const len = monthLen(view.jy, view.jm);
  const g = toGregorian(view.jy, view.jm, 1);
  const firstWd = (new Date(g.gy, g.gm - 1, g.gd).getDay() + 1) % 7; // Persian week: Sat = 0
  const setMonth = (delta: number) => setView((v) => {
    let jm = v.jm + delta, jy = v.jy;
    if (jm < 1) { jm = 12; jy -= 1; }
    if (jm > 12) { jm = 1; jy += 1; }
    return { jy, jm };
  });

  return (
    <div className={`relative ${className ?? "w-36"}`} ref={ref}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full h-9 border border-gray-300 rounded px-2 text-sm"
      />
      {open && (
        <div className="absolute z-50 mt-1 w-60 bg-white border border-gray-300 rounded shadow-lg p-2 text-xs">
          <div className="flex items-center justify-between gap-1 mb-1">
            <button type="button" onClick={() => setMonth(-1)} className="px-2 py-0.5 rounded hover:bg-gray-100 text-gray-600">‹</button>
            <div className="flex items-center gap-1">
              <select value={view.jm} onChange={(e) => setView((v) => ({ ...v, jm: +e.target.value }))} className="border border-gray-300 rounded px-1 py-0.5">
                {MONTHS.map((mn, i) => <option key={i} value={i + 1}>{mn}</option>)}
              </select>
              <input type="number" value={view.jy} onChange={(e) => setView((v) => ({ ...v, jy: +e.target.value || v.jy }))} className="w-16 border border-gray-300 rounded px-1 py-0.5" />
            </div>
            <button type="button" onClick={() => setMonth(1)} className="px-2 py-0.5 rounded hover:bg-gray-100 text-gray-600">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400 mb-0.5">
            {WD.map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {Array.from({ length: firstWd }, (_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: len }, (_, i) => {
              const d = i + 1;
              const isSel = !!sel && sel.jy === view.jy && sel.jm === view.jm && sel.jd === d;
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => { onChange(`${view.jy}/${pad(view.jm)}/${pad(d)}`); setOpen(false); }}
                  className={`h-6 rounded ${isSel ? "bg-blue-600 text-white" : "hover:bg-blue-50 text-gray-700"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-1 pt-1 border-t border-gray-100">
            <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-[11px] text-gray-500 hover:underline">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
