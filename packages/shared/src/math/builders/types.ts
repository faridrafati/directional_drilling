/**
 * Common types for 2D trajectory builders.
 *
 * Each builder solves a 2D wellbore-design problem in the vertical plane:
 * inputs are the previous-station inclination (theta1) and a 2D target
 * (tgtx = horizontal distance, tgty = vertical depth). Outputs are:
 *   - keyPoints: the geometric milestones (KOP, EOC, Target, ...)
 *   - stations:  the densified path sampled every `ppf` units of MD
 *   - ok:        false when the geometry is infeasible
 *
 * Builders work in the 2D plane: ns = 0, only ew and tvd are meaningful.
 * The dispatcher (see ../dispatcher.ts) handles 3D ↔ 2D projection.
 *
 * All distances are in the project's storage length unit; all angles in radians.
 * Pascal source: old_delphi_code/Unit02.pas.
 */

import type { Station } from "../../types.js";

/** Default densification step: one station every PPF units of MD. */
export const DEFAULT_PPF = 100;

export interface BuilderResult {
  ok: boolean;
  keyPoints: KeyPoint[];
  stations: Station[];
  reason?: string;
}

/** A geometric milestone in the design (KOP, EOC, Target, etc.). */
export type KeyPoint = Station;

/** Allocate a Station with all numeric fields zeroed and a default comment. */
export function emptyStation(): Station {
  return {
    comment: "",
    md: 0, inc: 0, azm: 0, tvd: 0, vsec: 0,
    ns: 0, ew: 0, dls: 0, tf: 0, br: 0, tr: 0, dmd: 0,
    order: 0, typ: 0,
  };
}

/** Convenience: clone a Station. */
export function cloneStation(s: Station): Station {
  return { ...s };
}
