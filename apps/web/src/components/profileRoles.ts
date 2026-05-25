/**
 * Per-profile "role" sequence + per-row editable-cell policy.
 *
 * Direct port of `Unit02.pas:rowcolor` (lines 145-419) and the inline
 * `romat[ii+k, col]` writes in `Form04.Button1Click` for the 3D-S-with-hold
 * variants (jj=6/16/106/116).
 *
 * Pascal model:
 *   - Each profile inserts N rows starting at index `ii+1` (with ii = count
 *     of non-empty rows BEFORE the new profile).
 *   - rowcolor sets `romat[row, col] := true` for editable cells. The grid
 *     paints those yellow; everything else is computed.
 *
 * Our model:
 *   - Profile groups N persisted rows (positions 0..N-1).
 *   - `position k of group` = Pascal `ii + k + 1` = k-th new row.
 *
 * Pascal column → our key:
 *   1 MD, 2 Inc, 3 Azm, 4 TVD, 6 NS, 7 EW, 8 DLS, 12 DMD.
 *   Pascal cols 5/9/10/11 (VSEC/TF/BR/TR) aren't in our grid; multi-curve
 *   combos (jj=61..103) that only touch BR/TR therefore have empty masks.
 *
 * Pascal also sets cells on rows BEFORE the new group (`romat[ii, ...]`,
 * `romat[ii-1, ...]`). Those would let the user edit the PREVIOUS group's
 * last row mid-flow — confusing in our group-scoped UX, so we drop them.
 * Where Pascal relied on this for input (like CH's DLS), we promote the cell
 * into the new group so the profile is self-sufficient.
 */
import { ProfileType } from "@dd/shared";
import type { EditableKey } from "./editPolicy.js";

export type RoleName = string;

/** The ordered list of rows each profile inserts (Pascal Form04/06 names). */
const ROLES: Record<number, RoleName[]> = {
  // Standard profiles — Unit04.pas:Button1Click
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
]) ROLES[code] = ["EOC"];
for (const base of [60, 70, 80, 90, 100]) {
  ROLES[base + 1] = ["EOC"];
  ROLES[base + 2] = ["EOC"];
  ROLES[base + 3] = ["EOC"];
}

/**
 * Per-profile editable cells, indexed by (position in group, column).
 * Each row of the outer array is one role; the inner array is the list of
 * editable column keys for THAT role.
 *
 * Pascal source line numbers (Unit02.pas:rowcolor):
 *   HC3D  jj=1  L158  romat[ii+1, 2/4/6/7]
 *   HC3D* jj=11 L165  romat[ii+1, 3/4/6/7]
 *   CH3D  jj=2  L172  romat[ii+1, 2/4/6/7]
 *   CH3D* jj=12 L179  romat[ii+1, 3/4/6/7]
 *   HCH   jj=3  L186  romat[ii+1, 8]  romat[ii+2, 2/4/6/7]
 *   HCH*  jj=13 L194  romat[ii+1, 8]  romat[ii+2, 3/4/6/7]
 *   CH    jj=4  L202  romat[ii+1, 4/6/7]   (+ ii's col 8 — promoted to pos 0)
 *   3D-S  jj=5  L209  romat[ii+2, 2/4/6/7/8]
 *   3D-S* jj=15 L218  romat[ii+2, 3/4/6/7/8]
 *   3D-S-H jj=6      Form04.Button1Click inline:
 *                    romat[ii+2, 8]   romat[ii+3, 2/4/6/7]
 *   3D-S-H* jj=16    romat[ii+2, 8]   romat[ii+3, 3/4/6/7]
 *   3D-S-H2 jj=106   adds romat[ii+3, 12]
 *   3D-S-H2*jj=116
 *   3D-S-A jj=7  L235  romat[ii+2, 2/4/6/7/8]
 *   3D-S-A*jj=17 L244  romat[ii+2, 3/4/6/7/8]
 *   TARGET jj=8  L253  romat[ii, 4/6/7]  → pos 0 in our 1-row group
 *   CC3D  jj=9  L259  romat[ii+1, 2/3/8] (+ ii col 2/8 — promoted to pos 0)
 *   CC3D* jj=19 L267  romat[ii+1, 2/3/8] (+ ii col 3/8 — promoted to pos 0)
 *   HOLD_NS  jj=21 L275  romat[ii, 1]  → pos 0
 *   HOLD_EW  jj=22 L279  romat[ii, 4]
 *   HOLD_VSEC jj=23 L283  romat[ii, 12]
 *   CURVE_E1 jj=31 L287  romat[ii, 1/2/8]
 *   CURVE_E2 jj=32 L293  romat[ii, 1/3/8]
 *   CURVE_E3 jj=33 L299  romat[ii, 2/3/8]
 *   CURVE_E4 jj=34 L305  romat[ii, 2/4/8]
 *   CURVE_E5 jj=35 L311  romat[ii, 2/3/4]
 *   SURVEY   jj=36 L317  romat[ii, 1/2/3]
 *   FLYTO_1  jj=51 L323  romat[ii, 1/8]
 *   FLYTO_2  jj=52 L329  romat[ii, 4/8]
 *   FLYTO_3  jj=53 L335  romat[ii, 12/8]
 *   FLYTO_4  jj=54 L341  romat[ii, 2/8]
 *   FLYTO_5  jj=55 L347  romat[ii, 3/8]
 *   Multi-curve 61..103: BR (col 10) / TR (col 11) only — not in grid.
 */
const ROW_EDITS: Record<number, EditableKey[][]> = {
  // 2-row standard profiles (KOP/EOC | EOC/Target): only the LAST row is user-input.
  [ProfileType.HC3D]:           [[], ["inc", "tvd", "ns", "ew"]],
  [ProfileType.HC3D_STAR]:      [[], ["azm", "tvd", "ns", "ew"]],
  [ProfileType.CH3D]:           [[], ["inc", "tvd", "ns", "ew"]],
  [ProfileType.CH3D_STAR]:      [[], ["azm", "tvd", "ns", "ew"]],

  // HCH 3-row: middle row (EOC) gets DLS, last row (Target) gets target coords.
  [ProfileType.HCH]:            [[], ["dls"], ["inc", "tvd", "ns", "ew"]],
  [ProfileType.HCH_STAR]:       [[], ["dls"], ["azm", "tvd", "ns", "ew"]],

  // CH 2-row: per user preference (more intuitive than the literal Pascal
  // mapping which put TVD/NS/EW on EOC and DLS on the previous row's slot):
  //   pos 0 = EOC  → user sets the curve's DLS
  //   pos 1 = Target → user sets target TVD/NS/EW
  // The CH solver still works the same — it just reads DLS from the EOC sibling
  // and the target coords from the Target row (see dispatcher.ts CH branch).
  [ProfileType.CH]:             [["dls"], ["tvd", "ns", "ew"]],

  // 3-row 3D-S (CH2DC1 = curve-hold-curve). Each arc gets its own DLS row:
  //   pos 0 (EOC #1)     = DLS₁  (first curve)
  //   pos 1 (KOP #2)     = (computed, no input)
  //   pos 2 (EOC-Target) = target XYZ + Inc/Azm + DLS₂ (second curve)
  // If the user only fills one DLS, the dispatcher uses it for both arcs
  // (matches Pascal's single-DLS-for-both behaviour).
  [ProfileType.D3DS]:           [["dls"], [], ["inc", "tvd", "ns", "ew", "dls"]],
  [ProfileType.D3DS_STAR]:      [["dls"], [], ["azm", "tvd", "ns", "ew", "dls"]],
  [ProfileType.D3DS_ALT]:       [["dls"], [], ["inc", "tvd", "ns", "ew", "dls"]],
  [ProfileType.D3DS_ALT_STAR]:  [["dls"], [], ["azm", "tvd", "ns", "ew", "dls"]],

  // 4-row 3D-S with hold (CH2DC2). Same first-arc-DLS pattern as above plus
  // EOC#2 still owns DLS₂; Target row gets target coords and (for *_HOLD2) DMD.
  [ProfileType.D3DS_HOLD]:      [["dls"], [], ["dls"], ["inc", "tvd", "ns", "ew"]],
  [ProfileType.D3DS_HOLD_STAR]: [["dls"], [], ["dls"], ["azm", "tvd", "ns", "ew"]],
  // *_HOLD2 (jj=106/116) additionally has DMD editable on Target.
  [ProfileType.D3DS_HOLD2]:     [["dls"], [], ["dls"], ["inc", "tvd", "ns", "ew", "dmd"]],
  [ProfileType.D3DS_HOLD2_STAR]:[["dls"], [], ["dls"], ["azm", "tvd", "ns", "ew", "dmd"]],

  // CC3D 2-row: Pascal puts INC+DLS on prev row (promoted to pos 0 in our model)
  // and INC/AZM/DLS on EOC#1 (which is pos 1 in our model). Pascal Button1Click
  // inserts EOC#1 + EOC#2 — and rowcolor only references ii+1 (= EOC#1). The
  // EOC#2 / target curvature is implied. In our group-scoped UX, each curve
  // needs its own inputs, so we mirror Pascal's intent: pos 0 = first curve's
  // exit angles + DLS, pos 1 = second curve's exit angles + DLS.
  [ProfileType.CC3D]:           [["inc", "dls"], ["inc", "azm", "dls"]],
  [ProfileType.CC3D_STAR]:      [["azm", "dls"], ["inc", "azm", "dls"]],

  // Single-row profiles where Pascal sets cells on `romat[ii, ...]` — those
  // are the previous group's last row in Pascal; in our model we put them on
  // position 0 of the single-row group (which IS the row the user is adding).
  [ProfileType.TARGET]:         [["tvd", "ns", "ew"]],
  [ProfileType.HOLD_NS]:        [["md"]],
  [ProfileType.HOLD_EW]:        [["tvd"]],
  [ProfileType.HOLD_VSEC]:      [["dmd"]],

  // Curve EOC variants — Form06.Button1Click codes 31..35
  [ProfileType.CURVE_E1]: [["md", "inc", "dls"]],
  [ProfileType.CURVE_E2]: [["md", "azm", "dls"]],
  [ProfileType.CURVE_E3]: [["inc", "azm", "dls"]],
  [ProfileType.CURVE_E4]: [["inc", "tvd", "dls"]],
  [ProfileType.CURVE_E5]: [["inc", "azm", "tvd"]],

  [ProfileType.SURVEY_STATION]: [["md", "inc", "azm"]],

  [ProfileType.FLYTO_1]: [["md",  "dls"]],
  [ProfileType.FLYTO_2]: [["tvd", "dls"]],
  [ProfileType.FLYTO_3]: [["dmd", "dls"]],
  [ProfileType.FLYTO_4]: [["inc", "dls"]],
  [ProfileType.FLYTO_5]: [["azm", "dls"]],

  // Multi-curve combos (jj=61..103) now have BR/TR exposed as editable —
  // each variant picks ONE constraint from {MD, TVD, DMD, INC, AZM} (by group)
  // plus BR/TR (by sub-type) per Pascal Unit02.pas:5087-5186.
};
for (const base of [60, 70, 80, 90, 100]) {
  const groupKey: EditableKey =
    base === 60 ? "md" :
    base === 70 ? "tvd" :
    base === 80 ? "dmd" :
    base === 90 ? "inc" :
                  "azm";
  ROW_EDITS[base + 1] = [[groupKey, "br", "dls"]];
  ROW_EDITS[base + 2] = [[groupKey, "tr", "dls"]];
  ROW_EDITS[base + 3] = [[groupKey, "br", "tr", "dls"]];
}

/** Ordered roles for this profile (the rows it spawns). */
export function profileRoles(profileType: number): RoleName[] {
  return ROLES[profileType] ?? ["EOC"];
}

/**
 * Is `key` editable on the row with this `role` for this `profileType`?
 * Pascal rule of thumb: colored cell → user input; non-colored → computed.
 *
 * `null` role = the START row (segment index 0). Per `Unit02.pas:rowcolor`
 * jj=0 (line 149), the START allows MD/Inc/Azm/TVD/NS/EW.
 */
export function isEditableForRole(
  profileType: number,
  role: RoleName | null,
  key: EditableKey
): boolean {
  // Comment is always editable — never overwritten by the dispatcher.
  if (key === "comment") return true;

  // START row (no milestone role).
  if (role == null) {
    if (profileType === ProfileType.START) {
      return ["md", "inc", "azm", "tvd", "ns", "ew"].includes(key);
    }
    return false;
  }

  const roles = profileRoles(profileType);
  const position = roles.indexOf(role);
  if (position < 0) return false;

  const editsByPosition = ROW_EDITS[profileType];
  if (!editsByPosition || !editsByPosition[position]) return false;
  return editsByPosition[position].includes(key);
}
