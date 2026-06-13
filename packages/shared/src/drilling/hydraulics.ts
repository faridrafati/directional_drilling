/**
 * Bit hydraulics — total flow area, nozzle pressure drop, hydraulic horsepower,
 * HSI (hydraulic horsepower per square inch of bit), and jet impact force.
 *
 * Field units: mud weight ppg · flow gpm · area in² · pressure psi · power hp ·
 * force lbf. HSI measures bottom-hole cleaning; ROP improves with HSI only when
 * cuttings removal — not formation strength — limits penetration.
 */
import { bitArea } from "./mse.js";

/** Default nozzle discharge coefficient. */
export const CD_DEFAULT = 0.95;
/** Nozzle pressure-drop constant for ρ ppg, Q gpm, TFA in² → psi. */
const DP_CONST = 8.311e-5;
/** Hydraulic horsepower divisor for ΔP psi × Q gpm → hp. */
const HHP_DIV = 1714;
/** Jet-impact-force constant for Q gpm, ρ ppg, ΔP psi → lbf. */
const JET_CONST = 0.01823;

/** Total flow area from nozzle sizes (each in 1/32"): Σ π/4·(n/32)²  [in²]. */
export function tfaFromNozzles(sizes32: number[]): number {
  let tfa = 0;
  for (const n of sizes32) {
    if (Number.isFinite(n) && n > 0) { const d = n / 32; tfa += (Math.PI / 4) * d * d; }
  }
  return tfa;
}

/**
 * Nozzle (bit) pressure drop ΔPᵦ [psi]:
 *   ΔPᵦ = 8.311e-5 · ρ · Q² / (Cd² · TFA²)
 * ρ ppg, Q gpm, TFA in². Returns `null` when TFA or flow are non-positive.
 */
export function nozzlePressureDrop(opts: {
  rhoPpg: number; qGpm: number; tfaIn2: number; cd?: number;
}): number | null {
  const cd = opts.cd ?? CD_DEFAULT;
  if (!(opts.tfaIn2 > 0) || !(opts.qGpm > 0) || !(opts.rhoPpg > 0)) return null;
  return (DP_CONST * opts.rhoPpg * opts.qGpm * opts.qGpm) / (cd * cd * opts.tfaIn2 * opts.tfaIn2);
}

/** Bit hydraulic horsepower [hp]: HHPᵦ = ΔPᵦ · Q / 1714. */
export function bitHHP(dPbPsi: number, qGpm: number): number {
  return (dPbPsi * qGpm) / HHP_DIV;
}

/** Hydraulic horsepower per in² of bit area [hp/in²]: HSI = HHPᵦ / Aᵦ. */
export function hsi(hhp: number, dIn: number): number | null {
  if (!(dIn > 0)) return null;
  return hhp / bitArea(dIn);
}

/** Jet impact force [lbf]: Fⱼ = 0.01823 · Cd · Q · √(ρ · ΔPᵦ). */
export function jetImpact(opts: {
  qGpm: number; rhoPpg: number; dPbPsi: number; cd?: number;
}): number {
  const cd = opts.cd ?? CD_DEFAULT;
  return JET_CONST * cd * opts.qGpm * Math.sqrt(opts.rhoPpg * opts.dPbPsi);
}

/**
 * Convenience: HSI [hp/in²] straight from nozzle hydraulics. Computes ΔPᵦ then
 * HHPᵦ then HSI. Returns `null` when any input makes the chain undefined.
 */
export function hsiFromHydraulics(opts: {
  tfaIn2: number; qGpm: number; rhoPpg: number; dIn: number; cd?: number;
}): number | null {
  const dPb = nozzlePressureDrop(opts);
  if (dPb == null) return null;
  return hsi(bitHHP(dPb, opts.qGpm), opts.dIn);
}
