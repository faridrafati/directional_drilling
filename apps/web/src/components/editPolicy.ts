/**
 * Per-profile-type editable-cell policy.
 *
 * Port of `rowcolor` in old_delphi_code/Unit02.pas:145-419 (the big switch
 * that sets `romat[ii,col]` flags). The Delphi original highlights editable
 * cells in yellow and read-only cells in white in `DBGrid2DrawColumnCell`.
 *
 * We map each profile-type code to the set of column keys the user is
 * allowed to edit on a single-row segment. Anything not in the set is
 * displayed as read-only (filled by the dispatcher when Calculate runs).
 *
 * The original Delphi spawned 1-3 key-point rows per profile and had a
 * different mask per row; our model uses ONE row per user-supplied "target",
 * so the mask collapses to "what does the user have to supply for this
 * profile to be calculable".
 */
import { ProfileType } from "@dd/shared";
import type { SegmentRow } from "../api/client.js";

/** All numeric column keys that ever appear in the grid. */
export type EditableKey = Extract<
  keyof SegmentRow,
  "comment" | "md" | "inc" | "azm" | "tvd" | "vsec" | "ew" | "ns" | "dls" | "tf" | "dmd" | "br" | "tr"
>;

// VSEC and TF are display-only (dispatcher post-pass fills them), so they're
// never in any profile's edit mask — but the EditableKey type must include
// them so the grid component can read+render those columns uniformly.
const ALL: EditableKey[] = ["comment", "md", "inc", "azm", "tvd", "vsec", "ew", "ns", "dls", "tf", "dmd", "br", "tr"];

const POLICY: Record<number, EditableKey[]> = {
  // START row: user sets the wellhead position + initial inclination/azimuth.
  [ProfileType.START]: ["comment", "md", "inc", "azm", "tvd", "ns", "ew"],

  // Holds: user only sets MD (the length); inc/azm are inherited from prev.
  [ProfileType.HOLD_NS]:   ["comment", "md"],
  [ProfileType.HOLD_EW]:   ["comment", "md"],
  [ProfileType.HOLD_VSEC]: ["comment", "md"],

  // Survey station: user gives MD + final inclination.
  [ProfileType.SURVEY_STATION]: ["comment", "md", "inc"],

  // Single-curve fly-to-target — user gives target XYZ; HOCTT solves.
  [ProfileType.TARGET]: ["comment", "tvd", "ns", "ew"],

  // HC3D / CH3D — user gives target XYZ + final inclination (or azimuth for *).
  [ProfileType.HC3D]:       ["comment", "inc", "tvd", "ns", "ew"],
  [ProfileType.HC3D_STAR]:  ["comment", "azm", "tvd", "ns", "ew"],
  [ProfileType.CH3D]:       ["comment", "inc", "tvd", "ns", "ew"],
  [ProfileType.CH3D_STAR]:  ["comment", "azm", "tvd", "ns", "ew"],

  // HCH — DLS is also user-controlled (the curve radius).
  [ProfileType.HCH]:        ["comment", "inc", "tvd", "ns", "ew", "dls"],
  [ProfileType.HCH_STAR]:   ["comment", "azm", "tvd", "ns", "ew", "dls"],

  // CH — DLS-driven, inc is computed from the quadratic.
  [ProfileType.CH]:         ["comment", "tvd", "ns", "ew", "dls"],

  // 3D-S family: target + final inc + dls (and optional dmd for the *2 variants).
  [ProfileType.D3DS]:       ["comment", "inc", "tvd", "ns", "ew", "dls"],
  [ProfileType.D3DS_STAR]:  ["comment", "azm", "tvd", "ns", "ew", "dls"],
  [ProfileType.D3DS_HOLD]:  ["comment", "inc", "tvd", "ns", "ew", "dls", "dmd"],
  [ProfileType.D3DS_HOLD_STAR]:  ["comment", "azm", "tvd", "ns", "ew", "dls", "dmd"],
  [ProfileType.D3DS_HOLD2]:      ["comment", "inc", "tvd", "ns", "ew", "dls", "dmd"],
  [ProfileType.D3DS_HOLD2_STAR]: ["comment", "azm", "tvd", "ns", "ew", "dls", "dmd"],

  // Curve-Curve 3D — chains two arcs, no target needed.
  [ProfileType.CC3D]:       ["comment", "inc", "dls"],
  [ProfileType.CC3D_STAR]:  ["comment", "azm", "dls"],

  // Single-curve EOC variants (Form06 RadioGroup1 codes 31..35).
  [ProfileType.CURVE_E1]: ["comment", "inc", "dls"],
  [ProfileType.CURVE_E2]: ["comment", "inc", "dls"],
  [ProfileType.CURVE_E3]: ["comment", "inc", "dls"],
  [ProfileType.CURVE_E4]: ["comment", "inc", "dls"],
  [ProfileType.CURVE_E5]: ["comment", "inc", "dls"],

  // Fly-to variants.
  [ProfileType.FLYTO_1]: ["comment", "inc", "dls"],
  [ProfileType.FLYTO_2]: ["comment", "inc", "dls"],
  [ProfileType.FLYTO_3]: ["comment", "inc", "dls"],
  [ProfileType.FLYTO_4]: ["comment", "inc", "dls"],
  [ProfileType.FLYTO_5]: ["comment", "inc", "dls"],
};

// Multi-curve combos (Form06 RadioGroup2 × CheckBox): inc-only / azm-only / both.
//   *1 → BR (build rate), *2 → TR (turn rate), *3 → both
//   Per group, user also picks ONE constraint:
//     6x  user gives MD     (curve-by-MD)
//     7x  user gives TVD    (bisection — not yet implemented)
//     8x  user gives DMD    (curve-by-DMD)
//     9x  user gives target INC  (BR drives length)
//    10x  user gives target AZM  (TR drives length)
for (const base of [60, 70, 80, 90, 100]) {
  const groupKey: EditableKey =
    base === 60 ? "md" :
    base === 70 ? "tvd" :
    base === 80 ? "dmd" :
    base === 90 ? "inc" :
                  "azm";
  POLICY[base + 1] = ["comment", groupKey, "br", "dls"];
  POLICY[base + 2] = ["comment", groupKey, "tr", "dls"];
  POLICY[base + 3] = ["comment", groupKey, "br", "tr", "dls"];
}

/** Returns the set of column keys the user can edit for this profile type. */
export function editableColumns(profileType: number): Set<EditableKey> {
  const list = POLICY[profileType];
  if (!list) {
    // Unknown profile → permissive default so the user isn't stuck. They get
    // a runtime feasibility error from the dispatcher instead.
    return new Set(ALL);
  }
  return new Set(list);
}

/** Convenience for the grid: is this (profile, column) cell user-editable? */
export function isEditable(profileType: number, key: EditableKey): boolean {
  return editableColumns(profileType).has(key);
}
