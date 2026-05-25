/**
 * Per-profile milestone row layout.
 *
 * Direct port of `Unit04.pas:Button1Click` (Form04) and `Unit06.pas` — each
 * profile inserts a fixed sequence of "key points" into the segment grid.
 * In our model we keep ONE editable segment row per profile and render the
 * milestones as read-only display rows below it.
 *
 *   HC3D / CH3D    → 2 milestones: KOP + EOC (Target)
 *   HCH            → 3: KOP + EOC + Target
 *   CH             → 2: EOC + Target
 *   3D-S (no hold) → 3: EOC #1 + KOP #2 + EOC Target
 *   3D-S (with hold) → 4: EOC #1 + KOP #2 + EOC #2 + Target
 *   CC3D           → 2: EOC #1 + EOC #2
 *   Hold / Survey  → 1: Target
 *   Curve / Fly-to → 1: EOC
 *   Target only    → 1: Target
 */
import { ProfileType } from "@dd/shared";

const MILESTONES: Record<number, string[]> = {
  [ProfileType.HC3D]:           ["KOP (Hold-Curve 3D*)", "EOC (Target)"],
  [ProfileType.HC3D_STAR]:      ["KOP (Hold-Curve 3D*)", "EOC (Target)"],
  [ProfileType.CH3D]:           ["EOC (Curve-Hold 3D*)", "Target"],
  [ProfileType.CH3D_STAR]:      ["EOC (Curve-Hold 3D*)", "Target"],
  [ProfileType.HCH]:            ["KOP (Computed)", "EOC", "Target"],
  [ProfileType.HCH_STAR]:       ["KOP (Computed)", "EOC", "Target"],
  [ProfileType.CH]:             ["EOC (Curve-Hold)", "Target"],
  [ProfileType.D3DS]:           ["EOC #1 (3D*-S)", "KOP #2", "EOC-Target"],
  [ProfileType.D3DS_STAR]:      ["EOC #1 (3D*-S)", "KOP #2", "EOC-Target"],
  [ProfileType.D3DS_HOLD]:      ["EOC #1 (2D-S)", "KOP #2", "EOC #2", "Target"],
  [ProfileType.D3DS_HOLD_STAR]: ["EOC #1 (2D-S)", "KOP #2", "EOC #2", "Target"],
  [ProfileType.D3DS_HOLD2]:     ["EOC #1 (2D-S)", "KOP #2", "EOC #2", "Target"],
  [ProfileType.D3DS_HOLD2_STAR]:["EOC #1 (2D-S)", "KOP #2", "EOC #2", "Target"],
  [ProfileType.CC3D]:           ["EOC #1 (Curve Curve 3D*)", "EOC #2"],
  [ProfileType.CC3D_STAR]:      ["EOC #1 (Curve Curve 3D*)", "EOC #2"],
  [ProfileType.TARGET]:         ["Target"],
  [ProfileType.HOLD_NS]:        ["Target"],
  [ProfileType.HOLD_EW]:        ["Target"],
  [ProfileType.HOLD_VSEC]:      ["Target"],
  [ProfileType.SURVEY_STATION]: ["Survey Station"],
};

for (const code of [
  ProfileType.CURVE_E1, ProfileType.CURVE_E2, ProfileType.CURVE_E3,
  ProfileType.CURVE_E4, ProfileType.CURVE_E5,
  ProfileType.FLYTO_1, ProfileType.FLYTO_2, ProfileType.FLYTO_3,
  ProfileType.FLYTO_4, ProfileType.FLYTO_5,
]) MILESTONES[code] = ["EOC"];

for (const base of [60, 70, 80, 90, 100]) {
  MILESTONES[base + 1] = ["EOC"];
  MILESTONES[base + 2] = ["EOC"];
  MILESTONES[base + 3] = ["EOC"];
}

/** Returns the names of milestones this profile spawns (in order). */
export function profileMilestones(profileType: number): string[] {
  return MILESTONES[profileType] ?? ["EOC"];
}
