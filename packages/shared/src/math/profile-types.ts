/**
 * Profile-type codes used in Segment.profileType.
 *
 * Direct port of the integer codes assigned in:
 *   - old_delphi_code/Unit04.pas  (Form04: 8 standard profiles, codes 1-19)
 *   - old_delphi_code/Unit05.pas  (Form05: 3 hold variants, codes 21-23)
 *   - old_delphi_code/Unit06.pas  (Form06: curve menus, codes 31-103)
 *   - old_delphi_code/Unit02.pas  (Survey Station: code 36, Start: 0)
 *
 * The "starred" variants (11, 12, 13, ...) use azimuth-input mode where the
 * user specifies the target azimuth instead of letting the dispatcher pick
 * one of two candidate solutions via Form07.
 */

export const ProfileType = {
  /** Start station (first row of every calculation). Cannot be calculated. */
  START: 0,

  // ─── Form04: 8 standard profile families (Unit04.pas:Button1Click) ───
  HC3D: 1,             HC3D_STAR: 11,                    // Hold-Curve 3D → hc3dtft
  CH3D: 2,             CH3D_STAR: 12,                    // Curve-Hold 3D → ch3dffk
  HCH: 3,              HCH_STAR: 13,                     // Hold-Curve-Hold → hch
  CH: 4,                                                  // Curve-Hold (DLS-given) → ch
  D3DS: 5,             D3DS_STAR: 15,                    // 3D-S (no extra hold) → ch2dc1
  D3DS_HOLD: 6,        D3DS_HOLD_STAR: 16,               // 3D-S with hold → ch2dc2
  D3DS_HOLD2: 106,     D3DS_HOLD2_STAR: 116,             // 3D-S with hold, RG2=1 mode → ch2dc2
  D3DS_ALT: 7,         D3DS_ALT_STAR: 17,                // 3D-S alternate
  TARGET: 8,                                              // Planning target only → hoctt
  CC3D: 9,             CC3D_STAR: 19,                    // Curve-Curve 3D → cc2d

  // ─── Form05: hold variants (Unit05.pas:Button1Click) ───
  HOLD_NS:   21,        // North-South hold
  HOLD_EW:   22,        // East-West hold
  HOLD_VSEC: 23,        // Vertical-section hold

  // ─── Form06 RadioGroup1: single-curve-EOC variants (Unit06.pas:Button1Click) ───
  CURVE_E1: 31, CURVE_E2: 32, CURVE_E3: 33, CURVE_E4: 34, CURVE_E5: 35,

  // ─── Survey Station (Unit02.pas:SurveyStation1Click) ───
  SURVEY_STATION: 36,

  // ─── Form06 RadioGroup3: fly-to variants ───
  FLYTO_1: 51, FLYTO_2: 52, FLYTO_3: 53, FLYTO_4: 54, FLYTO_5: 55,

  // ─── Form06 RadioGroup2 × CheckBox combinations (multi-curve combos) ───
  //   Inclination only:  *1
  //   Azimuth only:      *2
  //   Both:              *3
  MC_60_INC: 61, MC_60_AZM: 62, MC_60_BOTH: 63,
  MC_70_INC: 71, MC_70_AZM: 72, MC_70_BOTH: 73,
  MC_80_INC: 81, MC_80_AZM: 82, MC_80_BOTH: 83,
  MC_90_INC: 91, MC_90_AZM: 92, MC_90_BOTH: 93,
  MC_100_INC: 101, MC_100_AZM: 102, MC_100_BOTH: 103,
} as const;

/** Union of all named profile-type constants. Use ProfileTypeCode from types.js
 *  for the general "any integer" form. */
export type NamedProfileType = typeof ProfileType[keyof typeof ProfileType];

/** Human-readable label, useful for the UI grid and dispatch logging. */
export function profileTypeLabel(code: number): string {
  const reverse = Object.entries(ProfileType).find(([, v]) => v === code);
  return reverse ? reverse[0] : `UNKNOWN(${code})`;
}

/** Is this code a "starred" (azimuth-input) variant? */
export function isStarredProfile(code: number): boolean {
  return [11, 12, 13, 15, 16, 17, 19, 116].includes(code);
}
