/**
 * Metric ⇄ API field-unit converters for the drilling calculations (spec §4).
 * Inputs on Iranian rigs are metric (tonnes, kN·m, m/hr); the canonical
 * oilfield formulas (Teale MSE, hydraulics) run in API units.
 */

/** lbf per metric tonne (1000 kgf). */
export const LBF_PER_TONNE = 2204.62;
/** ft·lbf per kN·m. */
export const FTLBF_PER_KNM = 737.562;
/** ft per m. */
export const FT_PER_M = 3.28084;

/** Weight on bit: metric tonnes → lbf. */
export function tonnesToLbf(tonnes: number): number {
  return tonnes * LBF_PER_TONNE;
}

/** Torque: kN·m → ft·lbf. */
export function knmToFtLbf(knm: number): number {
  return knm * FTLBF_PER_KNM;
}

/** Rate: m/hr → ft/hr. */
export function mhrToFthr(mhr: number): number {
  return mhr * FT_PER_M;
}

/** Weight on bit: klbf (1000 lbf, the legacy DB unit) → metric tonnes. */
export function klbToTonnes(klb: number): number {
  return (klb * 1000) / LBF_PER_TONNE;
}
