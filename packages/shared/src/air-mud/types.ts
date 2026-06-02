/**
 * Data model for the "Air & Gas Drilling" underbalanced hydraulics port.
 *
 * Pascal origin: old_air_mud_code/Unit41.pas (TForm41). The Delphi app stored
 * inputs in an Access MDB (BitRun / Casing / DrillString / FixedNozzles tables)
 * and marched a 1-D compressible pressure profile through five sections:
 *
 *     SURFACE → BLOOIE LINE → ANNULUS (surface↓bit) → BIT NOZZLES → DRILL STRING (bit↑surface)
 *
 * Each section's outlet pressure feeds the next section's inlet. Two physics
 * branches exist (CALCTYPE in the Pascal):
 *     0 = GAS         — dry gas, closed-form exponential integrals (ANP0/DPP0/…)
 *     3 = AERATED MUD — gas+liquid mist, Simpson's-rule integration over 100
 *                       steps wrapped in a bisection on outlet pressure (ANP3/…)
 * (FOAM=1 / STABLE FOAM=2 were "UNDER CONSTRUCTION" in the original and are
 * not ported.)
 *
 * EVERYTHING here is in the Pascal's internal USA-oilfield base units:
 *   length ft · diameter inch · nozzle 1/32-inch · pressure psi · flow scf/min
 *   (gas) & gpm (liquid mud) · mud weight ppg · viscosity (PV) cP-equivalent
 *   · ROP ft/hr · temperature °R (absolute) · geothermal gradient °R/ft.
 * The cnv[0..8] display-unit table from Form42 is a presentation concern and is
 * NOT modelled — results are produced in these base units and formatted by the
 * web layer.
 */

/** Which physics branch to run. Mirrors the Pascal CALCTYPE argument. */
export type CalcType = "gas" | "aerated";

/**
 * The per-run scalar inputs. In the Pascal these were one row of the `bitrun`
 * table plus a couple of hard-coded blooie-line constants; every part-finder
 * copied the same fields onto its segment records, so we keep them in one bag.
 */
export interface AirMudInput {
  /** CALCTYPE: dry gas (0) or aerated mud (3). */
  calcType: CalcType;

  // ---- gas / formation ----
  /** QAT — surface (atmospheric) gas injection rate, scf/min. (bitrun.SURFFLOW) */
  surfFlow: number;
  /** TAT — surface air temperature, °R absolute. (bitrun.SURFTEMP) */
  surfTemp: number;
  /** GSG — gas specific gravity (air = 1.0). (bitrun.GSPECGRV) */
  gasSg: number;
  /** GMOLWT — gas molecular weight, lb/lbmol (air = 28.97). (bitrun.MOLEWT) */
  moleWt: number;
  /** K — ratio of specific heats for the bit-nozzle expansion. (bitrun.HEATC) */
  heatC: number;

  // ---- cuttings / formation solids ----
  /** SSG — produced-solids (cuttings) specific gravity. (bitrun.SSPECGRV) */
  solidSg: number;
  /** ROP — predicted rate of penetration, ft/hr. (bitrun.PREDROP) */
  rop: number;

  // ---- well geometry / environment ----
  /** ELEV — surface elevation above sea level, ft (sets atmospheric pressure). (bitrun.ELEVATION) */
  elevation: number;
  /** TGRD — geothermal gradient, °R/ft. (bitrun.GEOTHERM) */
  geotherm: number;
  /** Bottom (final) measured depth being drilled, ft. (bitrun.TVDOut) */
  tvdOut: number;
  /** Open-hole wall roughness, ft (below the casing shoe). (bitrun.OHROUGH) */
  ohRough: number;
  /** Drill-pipe / casing wall roughness, ft. (bitrun.DPROUGH) */
  dpRough: number;
  /** Bit diameter, inch (open-hole annulus OD below the shoe). (bitrun.BitSize) */
  bitSize: number;

  // ---- liquid mud (aerated runs only; ignored when calcType === "gas") ----
  /** QM — liquid mud injection rate, gpm. (bitrun.MUDFLOW) */
  mudFlow: number;
  /** MW — mud weight, ppg. (bitrun.MudWt) */
  mudWt: number;
  /** MVIS — mud plastic viscosity (PV). (bitrun.PV) */
  mudVis: number;

  /** Casing program — every cased interval, in any order. */
  casing: CasingSeg[];
  /**
   * Bottom-hole assembly / drill string, ordered TOP → BOTTOM (last element
   * sits at the bit). The Pascal stacked the last DrillString row read at the
   * drilling depth and worked upward, so element order encodes vertical
   * position. Total length should equal `tvdOut`.
   */
  bha: BhaComp[];
  /** Bit nozzles, in 1/32-inch (TFA = Σ π·(d/64)² / 144). Up to 15 jets. */
  nozzles: number[];
}

/** One cased interval. ID inch; DTOP/DBTM measured depth ft. (Casing table) */
export interface CasingSeg {
  /** Casing inner diameter, inch (annulus OD inside casing). */
  id: number;
  /** Top measured depth, ft. */
  dTop: number;
  /** Bottom measured depth, ft. */
  dBtm: number;
}

/** One drill-string / BHA component. (DrillString table) */
export interface BhaComp {
  /** Outer diameter, inch (becomes the annulus inner obstruction ODP). */
  size: number;
  /** Inner bore diameter, inch (the flow path inside the string). */
  id: number;
  /** Component length, ft. */
  length: number;
  /** Free-text label (e.g. "DRILL PIPE", "DRILL COLLAR"); display only. */
  type?: string;
}

// ───────────────────────── internal segment records ─────────────────────────
// These mirror the Pascal AUPART / DPPART / BLPART / BTPART records 1:1. They
// are produced by the part-finders and consumed by CALCULATE.

/** Annulus segment — AUPART. Densified so DH (hole) and ODP (pipe) are constant. */
export interface AnnulusSeg {
  /** NOIT — number of segments in the densified annulus (same on every seg). */
  noit: number;
  qat: number; tat: number; gsg: number; ssg: number; molwt: number;
  elev: number;
  /** DH — hole (or casing) inner diameter at this depth, inch. */
  dh: number;
  /** ODP — drill-string outer diameter at this depth, inch (0 = none). */
  odp: number;
  /** EH — hole-wall roughness, ft. */
  eh: number;
  /** EP — pipe-wall roughness, ft. */
  ep: number;
  rop: number; tgrd: number;
  dept1: number; dept2: number;
  mfrate: number; mw: number; mvis: number;
}

/** Drill-string interior segment — DPPART. */
export interface StringSeg {
  noit: number;
  qat: number; tat: number; gsg: number; molwt: number; elev: number;
  /** DP — inner bore diameter, inch. */
  dp: number;
  ep: number; tgrd: number;
  dept1: number; dept2: number;
  mfrate: number; mw: number; mvis: number;
}

/** Blooie-line spec — BLPART (constants hard-coded by the Pascal part-finder). */
export interface BlooieSpec {
  qat: number; tat: number; gsg: number; molwt: number; elev: number;
  /** LB — blooie-line length, ft (Pascal const 100). */
  lb: number;
  /** DB — blooie-line diameter, inch (Pascal const 5.625). */
  db: number;
  /** KT — total fittings loss coefficient (Pascal const 30). */
  kt: number;
  /** KV — per-valve loss coefficient (Pascal const 0.2). */
  kv: number;
  /** VALVNO — number of valves (Pascal const 2). */
  valvno: number;
  /** EB — blooie-line wall roughness, ft. */
  eb: number;
  mfrate: number; mw: number; mvis: number; rop: number; ssg: number; dh: number;
}

/** Bit-nozzle spec — BTPART. */
export interface BitSpec {
  qat: number; tat: number; gsg: number; molwt: number;
  /** K — ratio of specific heats. */
  k: number;
  /** PBH — bottom-hole pressure feeding the nozzles, psi. */
  pbh: number;
  tgrd: number; depth: number;
  /** Nozzle sizes in 1/32-inch, length 15 (0 = absent). */
  jets: number[];
  mfrate: number; mw: number;
}

/** The four scalar outputs every kernel produces, in base units. */
export interface SectionResult {
  /** Pressure, psi. */
  p: number;
  /** Volumetric gas flow rate at section conditions, scf/min. */
  q: number;
  /** Mixture velocity, ft/s. */
  v: number;
  /** Kinetic-energy density term (the Pascal "K" output). */
  k: number;
}

/**
 * One row of the results — mirrors the Pascal GRAPHING record after it is
 * written into Form44's string grids. All values in base units.
 */
export interface AirMudRow {
  /** Section label, e.g. "SURFACE", "BLOOEY", "ANLS(2)", "BIT NZL", "STRG(1)". */
  part: string;
  /** Measured depth, ft. */
  depth: number;
  /** Pressure, psi. */
  press: number;
  /** Pressure change from the previous row, psi (0 on the first row). */
  delP: number;
  /** Gas flow rate, scf/min. */
  gfrate: number;
  /** Mixture velocity, ft/s. */
  velo: number;
  /** Fluid density, ppg (= 64.4·KE/v²/7.48; NaN where v = 0). */
  gasDen: number;
  /** Raw kinetic-energy density (the "K" output). */
  keDen: number;
}

/** Everything CALCULATE produces. */
export interface AirMudResult {
  /** Section-boundary report (Form44 StringGrid3) — one row per section. */
  report: AirMudRow[];
  /** Densified profile (Form44 StringGrid5) — points every TRUNC(tvdOut/100) ft. */
  detail: AirMudRow[];
  /** Shaft power of the compressor, HP (gas runs only; null for aerated). */
  shaftPowerHp: number | null;
  /** K (ratio of specific heats) echoed for the report header. */
  k: number;
  /** Surface gas flow rate Q1 after back-fill, scf/min. */
  q1: number;
  /** Surface pressure P1, psi. */
  p1: number;
  /** Final standpipe / injection pressure P2, psi. */
  p2: number;
}

/** Optional "find the values at an arbitrary depth" request (Form44 arbitrary row). */
export interface ArbitraryQuery {
  /** Which section family to probe: annulus or drill-string interior. */
  part: "ANLS" | "STRG";
  /** Measured depth to evaluate, ft. */
  depth: number;
}
