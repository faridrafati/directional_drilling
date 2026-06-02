/**
 * Verbatim port of the Air & Gas Drilling pressure-drop kernels from
 * old_air_mud_code/Unit41.pas (lines 408–797). Each Pascal `PROCEDURE … VAR
 * ANP,ANQ,ANV,ANK:REAL` becomes a pure function returning {p,q,v,k}.
 *
 * Pascal → TS operator notes (do NOT "simplify" these — they are faithful):
 *   sqr(x)      = x*x         (Pascal square, NOT square root)
 *   SQRT(x)     = Math.sqrt   POWER(x,y) = Math.pow   Log10 = Math.log10
 *   EXP = Math.exp   PI = Math.PI
 * Constants kept exactly as written, including the inconsistent gravity values
 * (32.17 vs 32.174) and the magic 448.815 (scf/min flow scaling), 144 (psi→psf),
 * 62.4 (water lb/ft³), 7.48 (gal/ft³), 0.0006267 (PV→lb·s/ft²).
 *
 * Everything is in base USA-oilfield units (see types.ts).
 */

/** Pascal sqr — square, x·x. */
const sqr = (x: number): number => x * x;

/** BTMTEMP — temperature at depth: surface temp + gradient·depth (°R). */
export function btmTemp(tg: number, depth: number, tempgrad: number): number {
  return tg + tempgrad * depth;
}

/** SURPRESS — atmospheric pressure at a surface elevation (ft), psia. */
export function surPress(elev: number): number {
  return 14.696 * Math.pow(1 - (elev * 2.25577) / 3.281 / 100000, 5.25588);
}

/** FF — Nikuradse fully-rough friction factor for an annulus/pipe (closed form). */
export function ff(d1: number, d2: number, eave: number): number {
  return sqr(1 / (2 * Math.log10((d1 - d2) / eave) + 1.14));
}

/** FFBL — Colebrook/Jain explicit friction factor (used by the mist integrals). */
export function ffbl(re: number, id: number, eave: number): number {
  return sqr(1 / (-1.8 * Math.log10(Math.pow(eave / 3.7 / id, 1.11) + 6.9 / re)));
}

/** EAVE — area-weighted average wall roughness of two concentric surfaces. */
export function eave(e1: number, d1: number, e2: number, d2: number): number {
  return (
    (e1 * (Math.PI / 4) * d1 * d1 + e2 * (Math.PI / 4) * d2 * d2) /
    ((Math.PI / 4) * d1 * d1 + (Math.PI / 4) * d2 * d2)
  );
}

/** TFA — total flow area of the bit nozzles, ft². Jets in 1/32-inch, length 15. */
export function tfa(jets: number[]): number {
  let sum = 0;
  for (let ii = 0; ii < 15; ii++) sum += Math.PI * sqr((jets[ii] ?? 0) / 64);
  return sum / 144;
}

export interface KernelOut {
  p: number;
  q: number;
  v: number;
  k: number;
}

/** ANP0 — dry-gas annulus pressure march (closed-form exponential). */
export function anp0(
  qat: number, pg: number, tat: number, gsg: number, ssg: number, molwt: number,
  elev: number, dh: number, odp: number, eh: number, ep: number, rop: number,
  tempgrad: number, dept1: number, dept2: number,
): KernelOut {
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  pg = pg * 144;
  const tav = (btmTemp(tat, dept1, tempgrad) + btmTemp(tat, dept2, tempgrad)) / 2;
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  dh = dh / 12;
  const wdots = (Math.PI / 4) * dh * dh * 62.4 * ssg * (rop / 3600);
  odp = odp / 12;
  const aac = (gsg / r) * (1 + wdots / wdotg);
  const bac =
    (ff(dh, odp, eave(eh, dh, ep, odp)) / (2 * 32.174 * (dh - odp))) *
    (r / gsg) * (r / gsg) *
    (wdotg / (Math.PI / 4) / (dh * dh - odp * odp)) *
    (wdotg / (Math.PI / 4) / (dh * dh - odp * odp));
  let anp = Math.sqrt(
    (pg * pg + bac * tav * tav) * Math.exp((2 * aac * (dept2 - dept1)) / tav) - bac * tav * tav,
  );
  let anq = (pat / anp) * qat * btmTemp(tat, dept2, tempgrad) / tat;
  const anv = anq / ((Math.PI / 4) * (dh * dh - odp * odp));
  const ank = (sqr(anv) * anp * gsg) / btmTemp(tat, dept2, tempgrad) / r / 32.17 / 2;
  anp = anp / 144;
  anq = anq * 448.815;
  return { p: anp, q: anq, v: anv, k: ank };
}

/** ANP3 — aerated-mud annulus march (Simpson integration + bisection on outlet P). */
export function anp3(
  qat: number, pg: number, tat: number, gsg: number, ssg: number, molwt: number,
  elev: number, dh: number, odp: number, eh: number, ep: number, qm: number,
  mw: number, mvis: number, rop: number, tempgrad: number, dept1: number, dept2: number,
): KernelOut {
  const anlent = dept2 - dept1;
  const gvis = 0.012;
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  pg = pg * 144;
  const tav = (btmTemp(tat, dept1, tempgrad) + btmTemp(tat, dept2, tempgrad)) / 2;
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  qm = (qm * 231) / 12 / 12 / 12 / 60;
  const wdotm = qm * mw * 7.48;
  dh = dh / 12;
  const wdots = (Math.PI / 4) * dh * dh * 62.4 * ssg * (rop / 3600);
  const wdott = wdotg + wdotm + wdots;
  const rog = (pg * gsg) / tav / 32.17 / r;
  odp = odp / 12;
  const aann = (Math.PI / 4) * (dh * dh - odp * odp);
  const rom = (mw * 7.48) / 32.17;
  const nuum = (mvis * 0.0006267) / 30 / rom;
  const nuug = (gvis * 0.0006267) / 30 / rog;
  const nuut = (nuug * wdotg + nuum * wdotm) / (wdotg + wdotm);
  const velt = ((qat * pat) / pg * tav / tat + qm) / aann;

  let anp: number, anq: number, anv: number;

  if (anlent === 0) {
    // Zero-length segment: outlet = inlet (matches the Pascal ANLENT=0 branch).
    anp = pg;
    anq = (pat / anp) * qat * tav / tat + qm;
    anv = anq / aann;
  } else {
    const anpvalues: [number, number, number] = [pg, 0, 1000 * pg];
    anpvalues[1] = anpvalues[2];
    anp = pg; anq = 0; anv = 0;
    let simsum = 2 * anlent;
    while (Math.abs(simsum - anlent) * 100000 > anlent) {
      if (simsum > anlent) anpvalues[2] = anpvalues[1];
      else anpvalues[0] = anpvalues[1];
      anpvalues[1] = 0.5 * (anpvalues[0] + anpvalues[2]);
      const anpl = pg;
      const hh = 100;
      simsum = 0;
      for (let ii = 0; ii <= hh; ii++) {
        let simcof: number;
        if (ii === 0 || ii === hh) simcof = 1;
        else simcof = ii % 2 === 1 ? 4 : 2;
        anp = anpl + (ii / hh) * (anpvalues[1] - anpl);
        anq = (pat / anp) * qat * tav / tat + qm;
        anv = anq / aann;
        const gamamix = wdott / anq;
        const re = (velt * (dh - odp)) / nuut;
        const func =
          (2 * 32.17 * (dh - odp)) /
          (gamamix * (2 * 32.17 * (dh - odp) + anv * anv * ffbl(re, dh - odp, eave(eh, dh, ep, odp))));
        simsum += (simcof * func * (anpvalues[1] - anpl)) / (3 * hh);
      }
    }
  }
  const ank = (sqr(anv) * anp * gsg) / btmTemp(tat, dept2, tempgrad) / r / 32.17 / 2;
  return { p: anp / 144, q: anq * 448.815, v: anv, k: ank };
}

/** DPP0 — dry-gas drill-string interior march (closed form). */
export function dpp0(
  qat: number, pg: number, tat: number, gsg: number, molwt: number, elev: number,
  dp: number, ep: number, tempgrad: number, dept1: number, dept2: number,
): KernelOut {
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  pg = pg * 144;
  const tav = (btmTemp(tat, dept1, tempgrad) + btmTemp(tat, dept2, tempgrad)) / 2;
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  dp = dp / 12;
  const aac = gsg / r;
  const bac =
    (ff(dp, 0, ep) / (2 * 32.174)) *
    (r / gsg) * (r / gsg) *
    (wdotg / (Math.PI / 4) / (dp * dp * dp)) *
    (wdotg / (Math.PI / 4) / (dp * dp));
  let dpp = Math.sqrt(
    (pg * pg + bac * tav * tav * (Math.exp((2 * aac * (dept2 - dept1)) / tav) - 1)) /
      Math.exp((2 * aac * (dept2 - dept1)) / tav),
  );
  let dpq = (pat / dpp) * qat * btmTemp(tat, dept2, tempgrad) / tat;
  const dpv = dpq / ((Math.PI / 4) * (dp * dp));
  const dpk = (sqr(dpv) * dpp * gsg) / btmTemp(tat, dept2, tempgrad) / r / 32.17 / 2;
  dpp = dpp / 144;
  dpq = dpq * 448.815;
  return { p: dpp, q: dpq, v: dpv, k: dpk };
}

/** DPP3 — aerated-mud drill-string interior march (Simpson + bisection). */
export function dpp3(
  qat: number, pg: number, tat: number, gsg: number, molwt: number, elev: number,
  dp: number, _ep: number, qm: number, mw: number, mvis: number, tempgrad: number,
  dept1: number, dept2: number,
): KernelOut {
  const es = 0.00015;
  const dplent = Math.abs(dept2 - dept1);
  const gvis = 0.012;
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  pg = pg * 144;
  const tav = (btmTemp(tat, dept1, tempgrad) + btmTemp(tat, dept2, tempgrad)) / 2;
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  qm = (qm * 231) / 12 / 12 / 12 / 60;
  const wdotm = qm * mw * 7.48;
  const wdott = wdotg + wdotm;
  dp = dp / 12;
  const rog = (pg * gsg) / tav / 32.17 / r;
  const adp = (Math.PI / 4) * (dp * dp);
  const rom = (mw * 7.48) / 32.17;
  const nuum = (mvis * 0.0006267) / 30 / rom;
  const nuug = (gvis * 0.0006267) / 30 / rog;
  const nuut = (nuug * wdotg + nuum * wdotm) / (wdotg + wdotm);
  // (The Pascal computes VELT here but never uses it: DPP3's per-step Reynolds
  //  number is rebuilt from DPVI inside the Simpson loop, unlike BLP3 which
  //  uses a constant inlet VELT. Dropping the dead local preserves behaviour.)

  let dpp: number, dpq: number, dpv: number;

  if (dplent === 0) {
    // Zero-length: outlet = inlet. (The Pascal lacked this guard and read an
    // uninitialised VAR param here; the integral's limit at length 0 is the
    // inlet pressure, matching how DPP0 and ANP3 behave.)
    dpp = pg;
  } else {
    const dpvalues: [number, number, number] = [pg, 0, 1000 * pg];
    dpvalues[1] = dpvalues[2];
    dpp = pg;
    let simsum = 2 * dplent;
    while (Math.abs(simsum - dplent) * 100000 > dplent) {
      if (simsum > dplent) dpvalues[2] = dpvalues[1];
      else dpvalues[0] = dpvalues[1];
      dpvalues[1] = 0.5 * (dpvalues[0] + dpvalues[2]);
      const dppl = pg;
      const hh = 100;
      simsum = 0;
      for (let ii = 0; ii <= hh; ii++) {
        let simcof: number;
        if (ii === 0 || ii === hh) simcof = 1;
        else simcof = ii % 2 === 1 ? 4 : 2;
        dpp = dppl + (ii / hh) * (dpvalues[1] - dppl);
        const dpqi = (pat / dpp) * qat * tav / tat + qm;
        const dpvi = dpqi / adp;
        const gamamix = wdott / dpqi;
        const re = (dpvi * dp) / nuut;
        const func = (2 * 32.17 * dp) / (gamamix * (2 * 32.17 * dp - dpvi * dpvi * ffbl(re, dp, es)));
        simsum += (simcof * func * (dpvalues[1] - dppl)) / (3 * hh);
      }
    }
    dpp = 2 * pg - dpp;
  }
  dpq = (pat / dpp) * qat * tav / tat + qm;
  dpv = dpq / adp;
  const dpk = (sqr(dpv) * dpp * gsg) / btmTemp(tat, dept2, tempgrad) / r / 32.17 / 2;
  return { p: dpp / 144, q: dpq * 448.815, v: dpv, k: dpk };
}

/** BLP0 — dry-gas blooie line (closed-form fittings + friction loss). */
export function blp0(
  qat: number, tat: number, gsg: number, molwt: number, elev: number, lb: number,
  db: number, kt: number, kv: number, valvno: number, ep: number,
): KernelOut {
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  db = db / 12;
  const abl = (Math.PI * db * db) / 4;
  // NB: the Pascal writes "…/GSG/ABL*ABL" — the /ABL and *ABL cancel (left→right).
  let blp = Math.sqrt(
    (ff(db, 0, ep) * (lb / db) + kt + valvno * kv) *
      ((sqr(wdotg) * r * tat) / 32.174 / gsg / abl * abl) +
      sqr(pat),
  );
  let blq = (pat / blp) * qat;
  const blv = blq / ((Math.PI / 4) * (db * db));
  const blk = (sqr(blv) * blp * gsg) / tat / r / 32.17;
  blp = blp / 144;
  blq = blq * 448.815;
  return { p: blp, q: blq, v: blv, k: blk };
}

/** BLP3 — aerated-mud blooie line (Simpson + bisection over the line length). */
export function blp3(
  qat: number, tat: number, gsg: number, molwt: number, elev: number, lb: number,
  db: number, kt: number, kv: number, _valvno: number, _ep: number, qm: number,
  mw: number, mvis: number, ssg: number, rop: number, dh: number,
): KernelOut {
  const gvis = 0.012;
  const es = 0.0005;
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(elev);
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  db = db / 12;
  const abl = (Math.PI * db * db) / 4;
  qm = (qm * 231) / 12 / 12 / 12 / 60;
  const wdotm = qm * mw * 7.48;
  dh = dh / 12;
  const wdots = (62.4 * ssg * Math.PI) / 4 * dh * dh * (rop / 3600);
  const wdott = wdotg + wdotm + wdots;
  const rom = (mw * 7.48) / 32.17;
  const nuum = (mvis * 0.0006267) / 30 / rom;
  const nuug = (gvis * 0.0006267) / 30 / (gamagat / 32.17);
  const nuut = (nuug * wdotg + nuum * wdotm) / (wdotg + wdotm);
  const velt = (qat + qm) / abl;

  const blvalues: [number, number, number] = [pat, 0, 100 * pat];
  blvalues[1] = blvalues[2];
  let blp = pat;
  let blq = 0;
  let blv = 0;
  let gamamix = 0;
  let simsum = 2 * lb;
  while (Math.abs(simsum - lb) * 100000 > lb) {
    if (simsum > lb) blvalues[2] = blvalues[1];
    else blvalues[0] = blvalues[1];
    blvalues[1] = 0.5 * (blvalues[0] + blvalues[2]);
    const bll = pat;
    const hh = 100;
    simsum = 0;
    for (let ii = 0; ii <= hh; ii++) {
      let simcof: number;
      if (ii === 0 || ii === hh) simcof = 1;
      else simcof = ii % 2 === 1 ? 4 : 2;
      blp = bll + (ii / hh) * (blvalues[1] - bll);
      blq = (pat / blp) * qat;
      blv = blq / ((Math.PI / 4) * (db * db));
      gamamix = wdott / (blq + qm);
      const re = (velt * db) / nuut;
      const func = (2 * 32.17 * db) / (gamamix * blv * blv * ffbl(re, db, es));
      simsum += (simcof * func * (blvalues[1] - bll)) / (3 * hh);
    }
  }
  blp = blp + (gamamix * (2 * kv + kt) * blv * blv) / 2 / 32.17;
  const blk = (sqr(blv) * blp * gsg) / tat / r / 32.17;
  blp = blp / 144;
  blq = blq * 448.815;
  return { p: blp, q: blq, v: blv, k: blk };
}

/** JTP0 — dry-gas bit nozzles (choked/unchoked compressible expansion). */
export function jtp0(
  qat: number, tat: number, gsg: number, molwt: number, _elev: number, k: number,
  pbh: number, tempgrad: number, depth: number, jets: number[],
): KernelOut {
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(_elev);
  const tjt = btmTemp(tat, depth, tempgrad);
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  let wdotg = gamagat * qat;
  pbh = 144 * pbh;
  const gamag = (pbh * gsg) / tjt / r;
  const pc = pbh / Math.pow(2 / (k + 1), k / (k - 1));
  wdotg = gamagat * qat;
  const ta = tfa(jets);
  let jtpre =
    (wdotg * Math.sqrt(btmTemp(tat, depth, tempgrad))) / ta /
    Math.sqrt((32.17 * k * gsg) / r * Math.pow(2 / (k + 1), (k + 1) / (k - 1)));
  if (jtpre < pc) {
    jtpre =
      pbh *
      Math.pow(1 + sqr(wdotg / ta) / (2 * 32.17 * pbh * gamag * (k / (k - 1))), k / (k - 1));
  }
  let btp = jtpre;
  let btq = (pat / btp) * qat * btmTemp(tat, depth, tempgrad) / tat;
  const btv = btq / ta;
  const btk = (sqr(btv) * btp * gsg) / btmTemp(tat, depth, tempgrad) / r / 32.17 / 2;
  btp = btp / 144;
  btq = btq * 448.815;
  return { p: btp, q: btq, v: btv, k: btk };
}

/** JTP3 — aerated-mud bit nozzles (incompressible mixture orifice + PBH). */
export function jtp3(
  qat: number, tat: number, gsg: number, molwt: number, _elev: number, _k: number,
  pbh: number, tempgrad: number, depth: number, qm: number, mw: number, jets: number[],
): KernelOut {
  const noc = 0.81;
  const r = 1545.349 / molwt / gsg;
  const pat = 144 * surPress(_elev);
  const tjt = btmTemp(tat, depth, tempgrad);
  const gamagat = (pat * gsg) / tat / r;
  qat = qat / 448.815;
  const wdotg = gamagat * qat;
  qm = (qm * 231) / 12 / 12 / 12 / 60;
  const wdotm = qm * mw * 7.48;
  const wdott = wdotg + wdotm;
  pbh = 144 * pbh;
  const ta = tfa(jets);
  const noq = (pat / pbh) * qat * tjt / tat + qm;
  const gamamix = wdott / noq;
  const jtpre = sqr(wdott / noc / ta) / 2 / 32.17 / gamamix;
  let btp = jtpre;
  let btq = (pat / btp) * qat * btmTemp(tat, depth, tempgrad) / tat;
  const btv = btq / ta;
  const btk = (sqr(btv) * btp * gsg) / btmTemp(tat, depth, tempgrad) / r / 32.17 / 2;
  btp = btp / 144 + pbh / 144;
  btq = btq * 448.815;
  return { p: btp, q: btq, v: btv, k: btk };
}
