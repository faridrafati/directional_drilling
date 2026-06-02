/**
 * Part-finders + the CALCULATE pressure march, ported from
 * old_air_mud_code/Unit41.pas (ANUPARTFINDER/STRPARTFINDER/BITPARTFINDER/
 * BLNPARTFINDER at 2532–2927, CALCULATE/REPORTFILLER/DETAILFILLER/ARBITYFILLER
 * at 2928–3361).
 *
 * The Delphi read its inputs from an Access MDB; here they arrive in one typed
 * `AirMudInput` bag (see types.ts). The march itself is faithful:
 *
 *     SURFACE → BLOOIE → ANNULUS(surface↓bit) → BIT NOZZLES → DRILL STRING(bit↑surface)
 *
 * Each section's outlet pressure feeds the next. The densified `detail` profile
 * mirrors the Pascal step DL = trunc(tvdOut/100) ft, including the boundary-
 * station insertion in the annulus pass (the `memor[]` / `LL:=LL-1` replay).
 *
 * Implementation note on indexing: to track the Pascal 1-to-1 we keep the
 * `PG`/`PGD` work arrays 1-BASED (index 0 is an unused dummy), exactly like the
 * original `ARRAY [1..1500]`. Segment arrays are ordinary 0-based arrays.
 */

import {
  anp0, anp3, blp0, blp3, dpp0, dpp3, jtp0, jtp3, surPress,
} from "./physics.js";
import type {
  AirMudInput, AirMudResult, AirMudRow, AnnulusSeg, ArbitraryQuery,
  BitSpec, BlooieSpec, CalcType, StringSeg,
} from "./types.js";

/** Internal working record — the Pascal GRAPHING. */
interface GR {
  part: string;
  depth: number;
  press: number;
  gfrate: number;
  mfrate: number;
  velo: number;
  kegy: number;
}
const newGR = (): GR => ({ part: "", depth: 0, press: 0, gfrate: 0, mfrate: 0, velo: 0, kegy: 0 });

/** round(10000·x)/10000 — the Pascal depth quantisation. */
const r4 = (x: number): number => Math.round(10000 * x) / 10000;

// ───────────────────────────── part-finders ─────────────────────────────

/**
 * ANUPARTFINDER — build the densified annulus. Splits at every casing boundary
 * AND every BHA boundary so DH (hole/casing ID) and ODP (pipe OD) are constant
 * within each sub-segment; below the deepest casing the hole becomes the bit
 * diameter with open-hole roughness.
 */
export function anuPartFinder(input: AirMudInput): AnnulusSeg[] {
  const drillingDepth = input.tvdOut;

  // Casing intervals → annulus segments (DH = casing ID, ODP = 0), sorted by top.
  const cas = input.casing
    .map((c) => ({ dh: c.id, dept1: c.dTop, dept2: c.dBtm }))
    .sort((a, b) => a.dept1 - b.dept1);

  // BHA components, stacked from the bottom (last element sits at the bit).
  const n = input.bha.length;
  const bhaSeg = input.bha.map((b) => ({ odp: b.size, dept1: 0, dept2: 0 }));
  if (n > 0) {
    bhaSeg[n - 1].dept2 = r4(drillingDepth);
    bhaSeg[n - 1].dept1 = r4(bhaSeg[n - 1].dept2 - input.bha[n - 1].length);
    for (let kk = n - 2; kk >= 0; kk--) {
      bhaSeg[kk].dept2 = r4(bhaSeg[kk + 1].dept1);
      bhaSeg[kk].dept1 = r4(bhaSeg[kk].dept2 - input.bha[kk].length);
    }
  }
  bhaSeg.sort((a, b) => a.dept1 - b.dept1);

  // Collect & dedupe every boundary depth (the Pascal depth2[] list).
  const bounds = new Set<number>();
  for (const c of cas) { bounds.add(c.dept1); bounds.add(c.dept2); }
  for (const b of bhaSeg) { bounds.add(b.dept1); bounds.add(b.dept2); }
  const cuts = [...bounds].sort((a, b) => a - b);

  const out: AnnulusSeg[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const dept1 = cuts[i];
    const dept2 = cuts[i + 1];
    if (dept2 - dept1 < 1e-9) continue;
    const mid = (dept1 + dept2) / 2;

    let dh = 0;
    for (const c of cas) if (mid > c.dept1 && mid < c.dept2) dh = c.dh;
    let odp = 0;
    for (const b of bhaSeg) if (mid > b.dept1 && mid < b.dept2) odp = b.odp;

    // Cased interval uses pipe roughness; open hole uses the bit size + OH roughness.
    let eh = input.dpRough;
    if (dh === 0) { dh = input.bitSize; eh = input.ohRough; }

    out.push({
      noit: 0,
      qat: input.surfFlow, tat: input.surfTemp, gsg: input.gasSg, ssg: input.solidSg,
      molwt: input.moleWt, elev: input.elevation,
      dh, odp, eh, ep: input.dpRough, rop: input.rop, tgrd: input.geotherm,
      dept1, dept2,
      mfrate: input.mudFlow, mw: input.mudWt, mvis: input.mudVis,
    });
  }
  for (const s of out) s.noit = out.length;
  return out;
}

/**
 * STRPARTFINDER — drill-string interior segments. One per BHA component, stacked
 * from the bottom (DP = inner bore), sorted deepest-first (descending DEPT2).
 */
export function strPartFinder(input: AirMudInput): StringSeg[] {
  const drillingDepth = input.tvdOut;
  const n = input.bha.length;
  const segs: StringSeg[] = input.bha.map((b) => ({
    noit: 0,
    qat: input.surfFlow, tat: input.surfTemp, gsg: input.gasSg, molwt: input.moleWt,
    elev: input.elevation, dp: b.id, ep: input.dpRough, tgrd: input.geotherm,
    dept1: 0, dept2: 0,
    mfrate: input.mudFlow, mw: input.mudWt, mvis: input.mudVis,
  }));
  if (n > 0) {
    segs[n - 1].dept2 = r4(drillingDepth);
    segs[n - 1].dept1 = r4(segs[n - 1].dept2 - input.bha[n - 1].length);
    for (let kk = n - 2; kk >= 0; kk--) {
      segs[kk].dept2 = r4(segs[kk + 1].dept1);
      segs[kk].dept1 = r4(segs[kk].dept2 - input.bha[kk].length);
    }
  }
  segs.sort((a, b) => b.dept2 - a.dept2); // descending DEPT2
  for (const s of segs) s.noit = segs.length;
  return segs;
}

/** BITPARTFINDER — bit-nozzle spec (PBH is supplied at march time). */
export function bitPartFinder(input: AirMudInput): BitSpec {
  const jets = Array.from({ length: 15 }, (_, i) => input.nozzles[i] ?? 0);
  return {
    qat: input.surfFlow, tat: input.surfTemp, gsg: input.gasSg, molwt: input.moleWt,
    k: input.heatC, pbh: 0, tgrd: input.geotherm, depth: input.tvdOut, jets,
    mfrate: input.mudFlow, mw: input.mudWt,
  };
}

/** BLNPARTFINDER — blooie-line spec with the Pascal's hard-coded geometry. */
export function blnPartFinder(input: AirMudInput): BlooieSpec {
  return {
    qat: input.surfFlow, tat: input.surfTemp, gsg: input.gasSg, molwt: input.moleWt,
    elev: input.elevation,
    lb: 100, db: 5.625, kt: 30, kv: 0.2, valvno: 2, eb: input.dpRough,
    mfrate: input.mudFlow, mw: input.mudWt, mvis: input.mudVis, rop: input.rop,
    ssg: input.solidSg, dh: input.bitSize,
  };
}

// ─────────────────────────────── the march ───────────────────────────────

const ct = (c: CalcType): number => (c === "gas" ? 0 : 3);

/**
 * CALCULATE — the full pressure march + densified detail + (optional) arbitrary
 * point. Returns everything Form44 rendered (report grid, detail grid, the
 * shaft-power line, and the P1/P2/Q1 header), all in base USA-oilfield units.
 */
export function calculate(input: AirMudInput, arb?: ArbitraryQuery): AirMudResult {
  const CALCTYPE = ct(input.calcType);
  const BOTTOM = input.tvdOut;
  let DL = Math.trunc(input.tvdOut / 100);
  if (DL <= 0) DL = BOTTOM > 0 ? BOTTOM : 1; // guard: Pascal would loop forever otherwise

  const annulus = anuPartFinder(input);
  const strings = strPartFinder(input);
  const blnspec = blnPartFinder(input);
  const bitspec = bitPartFinder(input);

  // 1-based work arrays (index 0 = unused dummy), mirroring the Pascal.
  const PG: GR[] = [newGR()];
  const PGD: GR[] = [newGR()];
  const ensurePGD = (i: number) => { while (PGD.length <= i) PGD.push(newGR()); };
  let APG: GR | null = null;

  // ---------- SURFACE ----------
  PG[1] = newGR();
  PG[1].part = "SURFACE";
  PG[1].depth = 0;
  PG[1].press = surPress(blnspec.elev);
  ensurePGD(1); PGD[1] = { ...PG[1] };

  // ---------- BLOOIE ----------
  PG[2] = newGR();
  PG[2].part = "BLOOEY";
  PG[2].depth = 0;
  {
    const o = CALCTYPE === 0
      ? blp0(blnspec.qat, blnspec.tat, blnspec.gsg, blnspec.molwt, blnspec.elev,
             blnspec.lb, blnspec.db, blnspec.kt, blnspec.kv, blnspec.valvno, blnspec.eb)
      : blp3(blnspec.qat, blnspec.tat, blnspec.gsg, blnspec.molwt, blnspec.elev,
             blnspec.lb, blnspec.db, blnspec.kt, blnspec.kv, blnspec.valvno, blnspec.eb,
             blnspec.mfrate, blnspec.mw, blnspec.mvis, blnspec.ssg, blnspec.rop, blnspec.dh);
    PG[2].press = o.p; PG[2].gfrate = o.q; PG[2].velo = o.v; PG[2].kegy = o.k;
  }
  // Back-fill the surface gas rate (scaled by the pressure ratio).
  PG[1].gfrate = (PG[2].press / PG[1].press) * PG[2].gfrate;
  PGD[1] = { ...PG[1] };
  ensurePGD(2); PGD[2] = { ...PG[2] };

  // ---------- ANNULUS (surface → bit) ----------
  let JJ = 2;
  const jjjAnn = JJ; // = 2 (blooie index)
  const annOut = (i0: number, pgIn: number, dept1: number, dept2: number): GR => {
    const a = annulus[i0];
    const o = CALCTYPE === 0
      ? anp0(a.qat, pgIn, a.tat, a.gsg, a.ssg, a.molwt, a.elev, a.dh, a.odp, a.eh, a.ep, a.rop, a.tgrd, dept1, dept2)
      : anp3(a.qat, pgIn, a.tat, a.gsg, a.ssg, a.molwt, a.elev, a.dh, a.odp, a.eh, a.ep, a.mfrate, a.mw, a.mvis, a.rop, a.tgrd, dept1, dept2);
    const g = newGR();
    g.press = o.p; g.gfrate = o.q; g.velo = o.v; g.kegy = o.k;
    return g;
  };
  const NOITA = annulus.length;
  for (let ii = 1; ii <= NOITA; ii++) {
    JJ = JJ + 1;
    const a = annulus[ii - 1];
    const g = annOut(ii - 1, PG[JJ - 1].press, a.dept1, a.dept2);
    g.part = `ANLS(${ii})`;
    g.depth = a.dept2;
    PG[JJ] = g;
  }

  // arbitrary point inside the annulus
  if (arb && arb.part === "ANLS") {
    for (let ii = 1; ii <= NOITA; ii++) {
      const a = annulus[ii - 1];
      if (arb.depth >= a.dept1 && arb.depth <= a.dept2) {
        const g = annOut(ii - 1, PG[jjjAnn + ii - 1].press, a.dept1, arb.depth);
        g.depth = arb.depth; g.part = `ANLS(${ii})`;
        APG = g;
        break;
      }
    }
  }

  // densified annulus detail (with boundary-station insertion)
  let lidx = 3;
  let LL = 0;
  const memor: [number, number] = [1 + jjjAnn, 0];
  while (LL * DL <= BOTTOM) {
    ensurePGD(lidx);
    PGD[lidx].depth = LL * DL;
    for (let ii = 1; ii <= NOITA; ii++) {
      const a = annulus[ii - 1];
      if (LL * DL >= a.dept1 && LL * DL <= a.dept2) {
        memor[1] = ii + jjjAnn;
        const g = annOut(ii - 1, PG[jjjAnn + ii - 1].press, a.dept1, LL * DL);
        g.depth = LL * DL;
        g.part = PG[jjjAnn + ii].part;
        PGD[lidx] = g;
        if (memor[0] !== memor[1]) {
          PGD[lidx] = { ...PG[memor[0]] }; // exact previous-segment boundary station
          memor[0] = memor[1];
          LL = LL - 1;
        }
        break;
      }
    }
    LL = LL + 1;
    lidx = lidx + 1;
  }
  // exact bottom point
  for (let ii = 1; ii <= NOITA; ii++) {
    const a = annulus[ii - 1];
    if (BOTTOM >= a.dept1 && BOTTOM <= a.dept2) {
      ensurePGD(lidx);
      const g = annOut(ii - 1, PG[jjjAnn + ii - 1].press, a.dept1, BOTTOM);
      g.depth = BOTTOM;
      g.part = PG[jjjAnn + ii].part;
      PGD[lidx] = g;
      break;
    }
  }

  // ---------- BIT NOZZLES ----------
  JJ = JJ + 1;
  PG[JJ] = newGR();
  PG[JJ].depth = PG[JJ - 1].depth;
  {
    const pbh = PG[JJ - 1].press;
    const o = CALCTYPE === 0
      ? jtp0(bitspec.qat, bitspec.tat, bitspec.gsg, bitspec.molwt, input.elevation, bitspec.k,
             pbh, bitspec.tgrd, PG[JJ - 1].depth, bitspec.jets)
      : jtp3(bitspec.qat, bitspec.tat, bitspec.gsg, bitspec.molwt, input.elevation, bitspec.k,
             pbh, bitspec.tgrd, PG[JJ - 1].depth, bitspec.mfrate, bitspec.mw, bitspec.jets);
    PG[JJ].press = o.p; PG[JJ].gfrate = o.q; PG[JJ].velo = o.v; PG[JJ].kegy = o.k;
  }
  PG[JJ].part = "BIT NZL";
  lidx = lidx + 1; ensurePGD(lidx); PGD[lidx] = { ...PG[JJ] };
  lidx = lidx + 1;

  // ---------- DRILL STRING (bit → surface) ----------
  const jjjStr = JJ; // BIT index
  const strOut = (i0: number, pgIn: number, dept1: number, dept2: number): GR => {
    const s = strings[i0];
    const o = CALCTYPE === 0
      ? dpp0(s.qat, pgIn, s.tat, s.gsg, s.molwt, s.elev, s.dp, s.ep, s.tgrd, dept1, dept2)
      : dpp3(s.qat, pgIn, s.tat, s.gsg, s.molwt, s.elev, s.dp, s.ep, s.mfrate, s.mw, s.mvis, s.tgrd, dept1, dept2);
    const g = newGR();
    g.press = o.p; g.gfrate = o.q; g.velo = o.v; g.kegy = o.k;
    return g;
  };
  const NOITS = strings.length;
  for (let ii = 1; ii <= NOITS; ii++) {
    JJ = JJ + 1;
    const s = strings[ii - 1];
    const g = strOut(ii - 1, PG[JJ - 1].press, s.dept1, s.dept2);
    g.depth = s.dept1;
    g.part = `STRG(${ii})`;
    PG[JJ] = g;
  }

  // arbitrary point inside the drill string
  if (arb && arb.part === "STRG") {
    for (let ii = 1; ii <= NOITS; ii++) {
      const s = strings[ii - 1];
      if (arb.depth >= s.dept1 && arb.depth <= s.dept2) {
        const g = strOut(ii - 1, PG[jjjStr + ii - 1].press, arb.depth, s.dept2);
        g.depth = arb.depth; g.part = `STRG(${ii})`;
        APG = g;
        break;
      }
    }
  }

  // densified drill-string detail (no boundary insertion — commented out in Pascal)
  LL = 0;
  while (LL * DL <= BOTTOM) {
    ensurePGD(lidx);
    PGD[lidx].depth = BOTTOM - LL * DL;
    for (let ii = 1; ii <= NOITS; ii++) {
      const s = strings[ii - 1];
      if (BOTTOM - LL * DL >= s.dept1 && BOTTOM - LL * DL <= s.dept2) {
        const g = strOut(ii - 1, PG[jjjStr + ii - 1].press, BOTTOM - LL * DL, s.dept2);
        g.depth = BOTTOM - LL * DL;
        g.part = PG[jjjStr + ii].part;
        PGD[lidx] = g;
        break;
      }
    }
    LL = LL + 1;
    lidx = lidx + 1;
  }
  // exact surface (depth 0) point
  for (let ii = 1; ii <= NOITS; ii++) {
    const s = strings[ii - 1];
    if (0 >= s.dept1 && 0 <= s.dept2) {
      ensurePGD(lidx);
      const g = strOut(ii - 1, PG[jjjStr + ii - 1].press, 0, s.dept2);
      g.depth = 0;
      g.part = lidx - 1 >= 0 && PGD[lidx - 1] ? PGD[lidx - 1].part : PG[jjjStr + ii].part;
      PGD[lidx] = g;
      break;
    }
  }

  // shaft power of the compressor (gas runs only — Pascal computes it under CALCTYPE=0)
  let shaftPowerHp: number | null = null;
  if (CALCTYPE === 0) {
    const p2 = PGD[lidx].press;
    const sw =
      (bitspec.k / (bitspec.k - 1) / 229.17) * PG[1].press * (PG[1].gfrate / 7.48) *
      (Math.pow(p2 / PG[1].press, (bitspec.k - 1) / bitspec.k) - 1);
    shaftPowerHp = 0.01 * Math.round(100 * sw);
  }

  const report = buildRows(PG.slice(1, JJ + 1), true);
  const detail = buildRows(PGD.slice(1, lidx + 1), false);

  // arbitrary row appended to the result for callers that asked for it
  const result: AirMudResult = {
    report,
    detail,
    shaftPowerHp,
    k: 0.01 * Math.round(100 * bitspec.k),
    q1: PG[1].gfrate,
    p1: PG[1].press,
    p2: PGD[lidx].press,
  };
  if (APG) (result as AirMudResult & { arbitrary?: AirMudRow }).arbitrary = arbRow(APG);
  return result;
}

/** Density (ppg) from the kinetic-energy term — Pascal "GAS DEN" column. */
function gasDen(kegy: number, velo: number): number {
  return velo !== 0 ? (64.4 * kegy) / (velo * velo) * 0.133680555556 : NaN;
}

/** Map a list of GRAPHING records to result rows, adding ΔP and density. */
function buildRows(list: GR[], _report: boolean): AirMudRow[] {
  const rows: AirMudRow[] = [];
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (!g) continue;
    rows.push({
      part: g.part,
      depth: g.depth,
      press: g.press,
      delP: i === 0 ? 0 : g.press - list[i - 1].press,
      gfrate: g.gfrate,
      velo: g.velo,
      gasDen: gasDen(g.kegy, g.velo),
      keDen: g.kegy,
    });
  }
  // Surface row velocity is 0, so its density is back-filled from the next row
  // scaled by the pressure ratio (Pascal REPORTFILLER/DETAILFILLER tail).
  if (rows.length >= 2 && rows[0].press !== 0 && Number.isFinite(rows[1].gasDen)) {
    rows[0].gasDen = (rows[1].press / rows[0].press) * rows[1].gasDen;
  }
  return rows;
}

function arbRow(g: GR): AirMudRow {
  return {
    part: g.part,
    depth: g.depth,
    press: g.press,
    delP: NaN,
    gfrate: g.gfrate,
    velo: g.velo,
    gasDen: gasDen(g.kegy, g.velo),
    keDen: g.kegy,
  };
}
