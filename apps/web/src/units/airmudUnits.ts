/**
 * Air & Gas Drilling — display unit systems (port of Form42 / Unit42.pas `cnv[]`).
 *
 * The compute and the stored `AirMudInput` / `AirMudResult` are ALWAYS in USA
 * oilfield base units; this module converts only at the UI boundary (form
 * inputs, result tables, charts, exports). Each quantity lists unit options with
 * a factor to an SI reference; the stored base value sits in one of those
 * options (`storedBase`, index 0 unless noted). Factors are standard physical
 * constants (the original kept them in an Access table we can't read here).
 *
 *   display = base  × si[storedBase] / si[selected]
 *   base    = value × si[selected]   / si[storedBase]
 */
import type { AirMudRow } from "@dd/shared/air-mud";

export type Quantity = "length" | "diameter" | "nozzle" | "pressure" | "density" | "temp" | "flow";

interface UnitOpt { name: string; si: number; }

export const UNITS: Record<Quantity, { label: string; units: UnitOpt[] }> = {
  length:   { label: "Depth / length", units: [{ name: "ft", si: 0.3048 }, { name: "m", si: 1 }] },
  diameter: { label: "Hole / pipe size", units: [{ name: "in", si: 25.4 }, { name: "mm", si: 1 }] },
  nozzle:   { label: "Nozzle size", units: [{ name: "1/32 in", si: 0.79375 }, { name: "mm", si: 1 }] },
  pressure: { label: "Pressure", units: [
    { name: "psi", si: 6.894757 }, { name: "kPa", si: 1 }, { name: "atm", si: 101.325 },
    { name: "bar", si: 100 }, { name: "kg/cm²", si: 98.0665 },
  ] },
  density:  { label: "Mud weight", units: [
    { name: "ppg", si: 119.8264 }, { name: "kg/m³", si: 1 }, { name: "sg", si: 1000 },
    { name: "lb/ft³", si: 16.01846 }, { name: "g/cm³", si: 1000 },
  ] },
  temp:     { label: "Temperature", units: [{ name: "°R", si: 5 / 9 }, { name: "K", si: 1 }] },
  flow:     { label: "Flow rate", units: [
    { name: "gpm", si: 0.003785412 }, { name: "m³/min", si: 1 }, { name: "L/min", si: 0.001 },
    { name: "L/s", si: 0.06 }, { name: "bbl/min", si: 0.1589873 }, { name: "ft³/min", si: 0.02831685 },
    { name: "Imp gpm", si: 0.004546092 },
  ] },
};

/** Index of the flow unit the GAS rate is stored in (scf/min ≈ ft³/min). */
export const GAS_FLOW_BASE = 5;

export type UnitSel = Record<Quantity, number>;

export interface UnitSystem { id: string; label: string; sel: UnitSel; }

/** The four named systems from the Delphi Form42 RadioGroup1 (+ Custom = anything else). */
export const SYSTEMS: UnitSystem[] = [
  { id: "usa",      label: "USA",      sel: { length: 0, diameter: 0, nozzle: 0, pressure: 0, density: 0, temp: 0, flow: 0 } },
  { id: "iranian",  label: "Iranian",  sel: { length: 1, diameter: 0, nozzle: 0, pressure: 0, density: 3, temp: 0, flow: 0 } },
  { id: "canadian", label: "Canadian", sel: { length: 1, diameter: 1, nozzle: 1, pressure: 1, density: 1, temp: 1, flow: 1 } },
  { id: "russian",  label: "Russian",  sel: { length: 1, diameter: 1, nozzle: 1, pressure: 2, density: 4, temp: 1, flow: 2 } },
];

export const DEFAULT_SEL: UnitSel = { ...SYSTEMS[0].sel };

/** Label of the named system matching `sel`, else "Custom". */
export function systemLabel(sel: UnitSel): string {
  const m = SYSTEMS.find((s) => (Object.keys(s.sel) as Quantity[]).every((q) => s.sel[q] === sel[q]));
  return m ? m.label : "Custom";
}

export function unitName(q: Quantity, sel: UnitSel): string {
  return UNITS[q].units[sel[q]]?.name ?? UNITS[q].units[0].name;
}

export function disp(q: Quantity, sel: UnitSel, base: number, storedBase = 0): number {
  const u = UNITS[q].units;
  return (base * u[storedBase].si) / u[sel[q]].si;
}
export function toBase(q: Quantity, sel: UnitSel, value: number, storedBase = 0): number {
  const u = UNITS[q].units;
  return (value * u[sel[q]].si) / u[storedBase].si;
}

/**
 * Trim floating-point conversion noise while preserving real precision: keep up
 * to `n` significant figures (10 by default, so base-unit inputs like 8737.21232
 * round-trip unchanged, while 3063.2399999996 collapses to 3063.24).
 */
export function sig(v: number, n = 10): number {
  if (!Number.isFinite(v) || v === 0) return v;
  return parseFloat(v.toPrecision(n));
}

// ── result-row columns ──────────────────────────────────────────────────────
// velocity (ft/s) converts by length with a per-time suffix; KE term is unitless.
interface ColUnit { q: Quantity; storedBase?: number; perTime?: string; }
const ROW_COL: Partial<Record<keyof AirMudRow, ColUnit>> = {
  depth: { q: "length" },
  press: { q: "pressure" },
  delP: { q: "pressure" },
  gfrate: { q: "flow", storedBase: GAS_FLOW_BASE },
  velo: { q: "length", perTime: "s" },
  gasDen: { q: "density" },
};

/** Convert a result-row column value from base to the selected display unit. */
export function dispCol(key: keyof AirMudRow, sel: UnitSel, base: number): number {
  const c = ROW_COL[key];
  return c ? disp(c.q, sel, base, c.storedBase ?? 0) : base;
}
/** Unit label for a result-row column ("" if dimensionless). */
export function colUnit(key: keyof AirMudRow, sel: UnitSel): string {
  const c = ROW_COL[key];
  if (!c) return "";
  return c.perTime ? `${unitName(c.q, sel)}/${c.perTime}` : unitName(c.q, sel);
}

// ── geothermal gradient (°R/ft → temp/length) ───────────────────────────────
function geoFactor(sel: UnitSel): number {
  const t = UNITS.temp.units, l = UNITS.length.units;
  return (t[0].si / t[sel.temp].si) * (l[sel.length].si / l[0].si);
}
export function dispGeotherm(sel: UnitSel, base: number): number { return base * geoFactor(sel); }
export function toBaseGeotherm(sel: UnitSel, value: number): number { return value / geoFactor(sel); }
export function geothermUnit(sel: UnitSel): string {
  return `${unitName("temp", sel)}/${unitName("length", sel)}`;
}
