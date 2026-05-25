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

/**
 * Descriptive name for each profile-type code, e.g. "Hold-Curve 3D" instead
 * of the bare enum key "HC3D". These are the labels the original Pascal
 * Form04 / Form05 / Form06 dialogs showed next to each radio button (see
 * old_delphi_code/Unit04.dfm:RadioGroup1.Items, Unit05.dfm:Button1Click etc.)
 * — ported as-is for UI consistency with the legacy app.
 *
 * "★ Azm" suffix marks the starred (azimuth-input) variants — Form04's
 * "Use Azimuth" checkbox toggles between the inc-input and azm-input forms.
 */
const PROFILE_NAMES: Record<number, string> = {
  [ProfileType.START]: "Start",

  // Standard profiles (Unit04.pas)
  [ProfileType.HC3D]:           "Hold-Curve 3D",
  [ProfileType.HC3D_STAR]:      "Hold-Curve 3D ★ Azm",
  [ProfileType.CH3D]:           "Curve-Hold 3D",
  [ProfileType.CH3D_STAR]:      "Curve-Hold 3D ★ Azm",
  [ProfileType.HCH]:            "Hold-Curve-Hold",
  [ProfileType.HCH_STAR]:       "Hold-Curve-Hold ★ Azm",
  [ProfileType.CH]:             "Curve-Hold (DLS-given)",
  [ProfileType.D3DS]:           "3D-S",
  [ProfileType.D3DS_STAR]:      "3D-S ★ Azm",
  [ProfileType.D3DS_HOLD]:      "3D-S + Hold",
  [ProfileType.D3DS_HOLD_STAR]: "3D-S + Hold ★ Azm",
  [ProfileType.D3DS_HOLD2]:     "3D-S + Hold (Mode II)",
  [ProfileType.D3DS_HOLD2_STAR]:"3D-S + Hold (Mode II) ★ Azm",
  [ProfileType.D3DS_ALT]:       "3D-S Alternate",
  [ProfileType.D3DS_ALT_STAR]:  "3D-S Alternate ★ Azm",
  [ProfileType.TARGET]:         "Planning Target",
  [ProfileType.CC3D]:           "Curve-Curve 3D",
  [ProfileType.CC3D_STAR]:      "Curve-Curve 3D ★ Azm",

  // Form05 hold variants
  [ProfileType.HOLD_NS]:        "Hold (N-S)",
  [ProfileType.HOLD_EW]:        "Hold (E-W)",
  [ProfileType.HOLD_VSEC]:      "Hold (VSEC)",

  // Form06 RG1: single-curve EOC variants
  [ProfileType.CURVE_E1]: "Curve EOC — MD + Inc + DLS",
  [ProfileType.CURVE_E2]: "Curve EOC — MD + Azm + DLS",
  [ProfileType.CURVE_E3]: "Curve EOC — Inc + Azm + DLS",
  [ProfileType.CURVE_E4]: "Curve EOC — Inc + TVD + DLS",
  [ProfileType.CURVE_E5]: "Curve EOC — Inc + Azm + TVD",

  [ProfileType.SURVEY_STATION]: "Survey Station",

  // Form06 RG3: fly-to variants
  [ProfileType.FLYTO_1]: "Fly-To — at MD",
  [ProfileType.FLYTO_2]: "Fly-To — at TVD",
  [ProfileType.FLYTO_3]: "Fly-To — at DMD",
  [ProfileType.FLYTO_4]: "Fly-To — at Inc",
  [ProfileType.FLYTO_5]: "Fly-To — at Azm",

  // Form06 RG2 × CheckBox: multi-curve combos. Group constraint × sub-rate.
  //   60s: MD given     | 1=BR only, 2=TR only, 3=both
  //   70s: TVD given
  //   80s: DMD given
  //   90s: INC given
  //  100s: AZM given
  [ProfileType.MC_60_INC]:  "MC — MD + BR",
  [ProfileType.MC_60_AZM]:  "MC — MD + TR",
  [ProfileType.MC_60_BOTH]: "MC — MD + BR + TR",
  [ProfileType.MC_70_INC]:  "MC — TVD + BR",
  [ProfileType.MC_70_AZM]:  "MC — TVD + TR",
  [ProfileType.MC_70_BOTH]: "MC — TVD + BR + TR",
  [ProfileType.MC_80_INC]:  "MC — DMD + BR",
  [ProfileType.MC_80_AZM]:  "MC — DMD + TR",
  [ProfileType.MC_80_BOTH]: "MC — DMD + BR + TR",
  [ProfileType.MC_90_INC]:  "MC — Inc + BR",
  [ProfileType.MC_90_AZM]:  "MC — Inc + TR",
  [ProfileType.MC_90_BOTH]: "MC — Inc + BR + TR",
  [ProfileType.MC_100_INC]:  "MC — Azm + BR",
  [ProfileType.MC_100_AZM]:  "MC — Azm + TR",
  [ProfileType.MC_100_BOTH]: "MC — Azm + BR + TR",
};

/**
 * Human-readable label for a profile code, e.g. `1 → "Hold-Curve 3D"`.
 * Falls back to the bare enum key (or "UNKNOWN(code)") so the UI is never
 * blank for codes we haven't mapped yet.
 */
export function profileTypeLabel(code: number): string {
  const named = PROFILE_NAMES[code];
  if (named) return named;
  const reverse = Object.entries(ProfileType).find(([, v]) => v === code);
  return reverse ? reverse[0] : `UNKNOWN(${code})`;
}

/**
 * Short code label (e.g. "HC3D"), useful where vertical space is tight (PDF
 * report header, etc.). Same as the original Pascal Form04 "Title" column.
 */
export function profileTypeCode(code: number): string {
  const reverse = Object.entries(ProfileType).find(([, v]) => v === code);
  return reverse ? reverse[0] : `UNKNOWN(${code})`;
}

/** Is this code a "starred" (azimuth-input) variant? */
export function isStarredProfile(code: number): boolean {
  return [11, 12, 13, 15, 16, 17, 19, 116].includes(code);
}
