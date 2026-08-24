/**
 * Minimum-curvature integration of a directional survey.
 *
 * WellView stores only what the tool measured — measured depth, inclination and
 * azimuth — and computes TVD, N/S, E/W, dogleg and vertical section at print
 * time. Those results are among the 1,810 fields its data model marks
 * `calculated`, and none of them exist as columns in a converted database. So a
 * survey read out of one shows a driller three numbers and withholds the fourth
 * they actually want.
 *
 * This is that computation. Minimum curvature is the industry standard method
 * and is what WellView itself uses: the wellbore between two stations is a
 * circular arc lying in the plane containing both tool-face vectors, and the
 * straight-line (balanced-tangential) increments are scaled by a ratio factor
 * that accounts for the curvature.
 *
 *     β  = arccos( cos Δinc − sin inc₁ · sin inc₂ · (1 − cos Δazi) )
 *     RF = β ≈ 0 ? 1 : (2/β)·tan(β/2)
 *     ΔTVD = (Δmd/2)(cos inc₁ + cos inc₂)·RF
 *     ΔNS  = (Δmd/2)(sin inc₁ cos azi₁ + sin inc₂ cos azi₂)·RF
 *     ΔEW  = (Δmd/2)(sin inc₁ sin azi₁ + sin inc₂ sin azi₂)·RF
 *
 * DELIBERATE LIMITS, so nothing is computed that cannot be justified:
 *  - Stations flagged `dontuse` are dropped. They are not cosmetic: the sample
 *    data interleaves bad stations at DUPLICATE measured depths, and including
 *    them yields zero-length segments and a meaningless dogleg.
 *  - Stored per-station OVERRIDES win, and carry forward — overriding a TVD and
 *    then integrating on from the computed value would discard the correction
 *    at the next station, which is the opposite of what an override means.
 *  - Declination and convergence are NOT applied. The survey header records
 *    them, but nothing states whether the stored azimuths are already corrected,
 *    and rotating an already-corrected azimuth is a silent error of a few
 *    degrees. Azimuths are used exactly as stored.
 *  - `displaceunwrapcalc` ("Unwrapped Displace") is not produced: Peloton's
 *    definition is not stated anywhere available, and a guessed one would be
 *    indistinguishable from a real number.
 */

const RAD = Math.PI / 180;

/** One surveyed station, angles in DEGREES and depths in the stored base unit. */
export interface SurveyStation {
  md: number;
  inclination: number;
  azimuth: number;
  /** Flagged bad by the user — excluded from the integration. */
  dontUse?: boolean;
  /** Stored corrections. Any present wins and carries forward. */
  tvdOverride?: number | null;
  nsOverride?: number | null;
  ewOverride?: number | null;
  dlsOverride?: number | null;
  vsOverride?: number | null;
}

/** Where the survey starts, when the header carries a tie-in. */
export interface SurveyTieIn {
  md?: number | null;
  tvd?: number | null;
  ns?: number | null;
  ew?: number | null;
  inclination?: number | null;
  azimuth?: number | null;
}

export interface SurveyOptions {
  tieIn?: SurveyTieIn | null;
  /** Vertical-section direction in degrees, from the wellbore. */
  vsDirection?: number | null;
  vsOriginNs?: number | null;
  vsOriginEw?: number | null;
}

/** The values WellView computes for a station, in the model's base units. */
export interface SurveyResult {
  md: number;
  inclination: number;
  azimuth: number;
  tvd: number;
  ns: number;
  ew: number;
  /** Horizontal distance from the origin. */
  departure: number;
  /** Dogleg severity in degrees per unit of measured depth. */
  dls: number | null;
  /** Vertical section — null when the wellbore has no VS direction. */
  vs: number | null;
  /**
   * True when `vs` was measured along a CLOSURE direction this app worked out,
   * because the wellbore carries no vertical-section direction of its own.
   * WellView does the same; the reader still has to be told which it is.
   */
  vsDirectionDerived?: boolean;
  /** Degrees of inclination / azimuth change per unit measured depth. */
  buildRate: number | null;
  turnRate: number | null;
  /** True where a stored override supplied the value instead of the maths. */
  overridden: boolean;
  /**
   * True when this station carried NO azimuth and the previous bearing was
   * assumed. TVD, DLS and build rate are still right — with a constant bearing
   * the dogleg is just the inclination change — but NS, EW, VS and departure
   * direction rest on an assumption, so a reader has to be told.
   */
  azimuthAssumed: boolean;
}

/** Signed smallest angle between two azimuths, in degrees, within ±180. */
function azimuthDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Integrate a survey. Stations may arrive unsorted; they are ordered by measured
 * depth, and any flagged `dontuse` is dropped before anything is computed.
 *
 * With no tie-in the first station is the origin, taken as vertical above
 * itself: TVD = MD, NS = EW = 0. That is the convention a survey with no tie-in
 * implies — the hole ran from surface to the first station.
 */
export function computeSurvey(
  stations: SurveyStation[],
  options: SurveyOptions = {},
): SurveyResult[] {
  // An inclination-only survey is legal — the model's own Azimuth help says
  // "For inclination only surveys, leave this field empty" — and 370 stations
  // in the sample database have no azimuth, four wells having none at all.
  // Requiring one here deleted those wells' surveys outright, so only MD and
  // inclination are required; the bearing is carried forward below.
  const used = stations
    .filter((s) => !s.dontUse && Number.isFinite(s.md) && Number.isFinite(s.inclination))
    .sort((a, b) => a.md - b.md);
  if (used.length === 0) return [];

  /** The station's own bearing, or null when it was left empty. */
  const aziOf = (s: SurveyStation): number | null =>
    Number.isFinite(s.azimuth) ? s.azimuth : null;


  const t = options.tieIn ?? null;
  const hasTieIn = t != null && t.md != null && Number.isFinite(t.md);

  // Running position, and the station the next arc starts from.
  let tvd: number;
  let ns: number;
  let ew: number;
  let prevMd: number;
  let prevInc: number;
  let prevAzi: number;

  if (hasTieIn) {
    prevMd = t!.md!;
    tvd = t!.tvd ?? t!.md!;
    ns = t!.ns ?? 0;
    ew = t!.ew ?? 0;
    prevInc = t!.inclination ?? used[0].inclination;
    prevAzi = t!.azimuth ?? aziOf(used[0]) ?? 0;
  } else {
    const first = used[0];
    prevMd = first.md;
    tvd = first.md;
    ns = 0;
    ew = 0;
    prevInc = first.inclination;
    // Never NaN: with no bearing anywhere, north is the arbitrary but stated
    // reference, and every station it touches is flagged azimuthAssumed.
    prevAzi = aziOf(first) ?? 0;
  }

  const vsDir = options.vsDirection;
  const vsOk = vsDir != null && Number.isFinite(vsDir);
  const vsOfNsEw = (n: number, e: number): number | null => {
    if (!vsOk) return null;
    const dn = n - (options.vsOriginNs ?? 0);
    const de = e - (options.vsOriginEw ?? 0);
    return dn * Math.cos(vsDir! * RAD) + de * Math.sin(vsDir! * RAD);
  };

  const out: SurveyResult[] = [];

  for (let i = 0; i < used.length; i++) {
    const s = used[i];
    const ownAzi = aziOf(s);
    const azimuthAssumed = ownAzi === null;
    const azi = ownAzi ?? prevAzi;
    const dmd = s.md - prevMd;
    let dls: number | null = null;
    let buildRate: number | null = null;
    let turnRate: number | null = null;

    // The first station of an untied survey IS the origin; there is no arc into
    // it, so it carries no dogleg and no rates.
    const isOrigin = !hasTieIn && i === 0;
    if (!isOrigin && dmd > 0) {
      const i1 = prevInc * RAD, i2 = s.inclination * RAD;
      const dAzi = azimuthDelta(prevAzi, azi) * RAD;
      // Dogleg angle, clamped: floating error can push the cosine past ±1.
      const cosB = Math.cos(i2 - i1) - Math.sin(i1) * Math.sin(i2) * (1 - Math.cos(dAzi));
      const beta = Math.acos(Math.min(1, Math.max(-1, cosB)));
      const rf = beta < 1e-9 ? 1 : (2 / beta) * Math.tan(beta / 2);
      const half = dmd / 2;

      tvd += half * (Math.cos(i1) + Math.cos(i2)) * rf;
      ns += half * (Math.sin(i1) * Math.cos(prevAzi * RAD) + Math.sin(i2) * Math.cos(azi * RAD)) * rf;
      ew += half * (Math.sin(i1) * Math.sin(prevAzi * RAD) + Math.sin(i2) * Math.sin(azi * RAD)) * rf;

      dls = (beta / RAD) / dmd;
      buildRate = (s.inclination - prevInc) / dmd;
      turnRate = azimuthDelta(prevAzi, azi) / dmd;
    }

    // A stored override replaces the computed value AND becomes the position the
    // next arc starts from — that is the whole point of correcting a station.
    let overridden = false;
    if (s.tvdOverride != null && Number.isFinite(s.tvdOverride)) { tvd = s.tvdOverride; overridden = true; }
    if (s.nsOverride != null && Number.isFinite(s.nsOverride)) { ns = s.nsOverride; overridden = true; }
    if (s.ewOverride != null && Number.isFinite(s.ewOverride)) { ew = s.ewOverride; overridden = true; }
    if (s.dlsOverride != null && Number.isFinite(s.dlsOverride)) { dls = s.dlsOverride; overridden = true; }

    const vs = s.vsOverride != null && Number.isFinite(s.vsOverride)
      ? s.vsOverride
      : vsOfNsEw(ns, ew);
    if (s.vsOverride != null && Number.isFinite(s.vsOverride)) overridden = true;

    out.push({
      md: s.md,
      inclination: s.inclination,
      azimuth: azi,
      azimuthAssumed,
      tvd,
      ns,
      ew,
      departure: Math.sqrt(ns * ns + ew * ew),
      dls,
      vs,
      buildRate,
      turnRate,
      overridden,
    });

    prevMd = s.md;
    prevInc = s.inclination;
    prevAzi = azi;
  }

  /*
   * NOBODY ENTERED A VS DIRECTION, so WellView works one out.
   *
   * "If you do not enter the Vertical Section Direction, WellView calculates a
   * Closure Direction, and the Vertical Section is then calculated along this
   * direction" — Peloton's own help. Without it the column is blank on 38 of
   * the sample's 41 surveyed wellbores, because only three carry an entered
   * direction.
   *
   * It runs here, after the integration, because closure is the bearing from
   * the first station to the last and neither position is known until the whole
   * survey has been walked. `closureOf` decides whether the survey supports one
   * at all; where it does not, the column stays blank exactly as before.
   */
  if (!vsOk) {
    const closure = closureOf(out);
    if (closure) {
      const dir = closure.direction * RAD;
      const on = options.vsOriginNs ?? 0;
      const oe = options.vsOriginEw ?? 0;
      for (const r of out) {
        r.vs = (r.ns - on) * Math.cos(dir) + (r.ew - oe) * Math.sin(dir);
        r.vsDirectionDerived = true;
      }
    }
  }

  return out;
}

/**
 * The direction a vertical section is measured along, when nobody entered one.
 *
 * Peloton's own help states the rule, and states it precisely:
 *
 *   "The Vertical Section field in the Survey Data folder is calculated along
 *    the Vertical Section Direction, which you enter in the Wellbore folder. If
 *    you do not enter the Vertical Section Direction, WellView calculates a
 *    Closure Direction, and the Vertical Section is then calculated along this
 *    direction. The Closure Direction is the azimuth that describes a straight
 *    line between the starting point of the wellbore and the end point of the
 *    wellbore."
 *
 * So: the bearing from the first station to the last. Nothing is invented here
 * except the refusals, and those are stated.
 *
 * WHEN IT REFUSES, and why each case matters more than it looks:
 *
 *  - A survey with no recorded bearing. Five of the sample's thirty surveys
 *    have a null azimuth on every station and six more on some, and the
 *    integration already flags those stations. A closure drawn through assumed
 *    bearings is a closure through an assumption.
 *  - A survey whose every azimuth is stored as EXACTLY ZERO. One survey in the
 *    sample has twenty-seven such stations with a maximum inclination of two
 *    degrees: a vertical hole whose bearings were never recorded and were
 *    written as zero rather than left blank. Nothing in the values distinguishes
 *    that from a hole that genuinely runs due north, so the null-azimuth guard
 *    cannot see it and this one is needed as well. Left alone it yields a
 *    closure direction of exactly 0.00 degrees and a fully populated vertical
 *    section column for a well that does not have one.
 *  - A hole that does not go anywhere. Below a stated inclination there is no
 *    meaningful direction to project onto, and the closure azimuth is whatever
 *    the survey noise happened to add up to.
 *
 * HOW FAR TO TRUST IT. Three wellbores in the sample carry a human-entered VS
 * direction, and they are the only check available: closure lands 0.21 and 1.27
 * degrees from the entered value on two of them, and 29.79 degrees away on the
 * third. That is the honest calibration — good, not exact — and it is why the
 * derived direction is reported as derived rather than presented as the
 * wellbore's own.
 */

/** Below this inclination a wellbore has no direction worth projecting onto. */
const VERTICAL_DEG = 5;

export interface ClosureResult {
  /** Azimuth from the first station to the last, in degrees [0, 360). */
  direction: number;
  /** Straight-line horizontal distance between them. */
  distance: number;
}

/**
 * The closure of an already-integrated survey, or null when it has none.
 *
 * @param stations the integrated result, in measured-depth order.
 */
export function closureOf(stations: SurveyResult[]): ClosureResult | null {
  if (stations.length < 2) return null;
  // A bearing anywhere in the survey was assumed: the path is not known.
  if (stations.some((s) => s.azimuthAssumed)) return null;
  // Every azimuth stored as exactly zero is an unrecorded bearing, not north.
  if (stations.every((s) => s.azimuth === 0)) return null;
  // A hole that never leaves vertical has no direction to speak of.
  if (!stations.some((s) => s.inclination >= VERTICAL_DEG)) return null;

  const a = stations[0];
  const b = stations[stations.length - 1];
  const dn = b.ns - a.ns;
  const de = b.ew - a.ew;
  const distance = Math.hypot(dn, de);
  if (!(distance > 0)) return null;

  const direction = (Math.atan2(de, dn) / RAD + 360) % 360;
  return { direction, distance };
}
