/**
 * Core domain types for the directional drilling application.
 * Storage rule: all angles in radians, all distances in the project's chosen length unit.
 * Convert only at the UI boundary.
 */

/** 3D vector in survey coordinates: north-south, east-west, true vertical depth. */
export interface Vec3 {
  ns: number;
  ew: number;
  tvd: number;
}

/** A survey-station-style point with inclination and azimuth (radians). */
export interface SurveyAngles {
  inc: number;
  azm: number;
}

/** Profile-type integer code used by `wlpt.typ` in the Delphi original.
 *  See math/profile-types.ts for the named constants. */
export type ProfileTypeCode = number;

/**
 * A survey station — one sampled point along the wellbore.
 * Mirrors the `branch` record in Delphi (Unit02.pas).
 */
export interface Station {
  comment: string;
  md: number;
  inc: number; // radians
  azm: number; // radians
  tvd: number;
  vsec: number;
  ns: number;
  ew: number;
  dls: number; // radians per unit length
  tf: number;  // radians
  br: number;  // radians per unit length
  tr: number;  // radians per unit length
  dmd: number;
  order: number;
  typ: ProfileTypeCode;
  /** Pascal-style milestone role (KOP / EOC / Target / ...). Set on Segments;
   *  null/undefined on densified stations from the builder. */
  milestoneRole?: string | null;
}

/**
 * A user-defined segment of the well design — the input to trajectory calculation.
 * Same shape as Station but conceptually distinct (inputs vs computed densification).
 */
export type Segment = Station;

/**
 * Result of a trajectory builder: key milestones plus the densified path.
 */
export interface TrajectoryResult {
  ok: boolean;
  keyPoints: Station[]; // KOP / EOC / Target etc.
  stations: Station[];  // densified at ~100ft/30m
  reason?: string;      // when !ok
}

/** A named container of segments and resulting stations. */
export interface Calculation {
  id: string;
  name: string;
  type: "WellDesign" | "SurveyEditor";
  segments: Segment[];
  stations: Station[];
}
