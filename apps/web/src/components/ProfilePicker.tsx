/**
 * Profile-type picker modal.
 *
 * Replaces the tabbed Form04/Form05/Form06/Form08/Form09 dialogs from the
 * Delphi original. Profile families are grouped by tab; each option carries
 * its integer code as defined in @dd/shared.ProfileType.
 */
import { useState } from "react";
import { ProfileType } from "@dd/shared";

type Family =
  | "standard"  // Form04
  | "hold"      // Form05
  | "curve"     // Form06 RG1/RG3 — single-curve EOC + fly-to
  | "multi"     // Form06 RG2 × CB    — multi-curve combos (BR/TR)
  | "survey";   // Form08/Form09

interface Option { code: number; label: string; description?: string }

const FAMILIES: Record<Family, { title: string; options: Option[] }> = {
  standard: {
    title: "Standard profiles",
    options: [
      { code: ProfileType.HC3D,           label: "Hold-Curve 3D",                  description: "Vertical hold, then curve to target. User gives target Inc + TVD/NS/EW. (HC3DTFT)" },
      { code: ProfileType.HC3D_STAR,      label: "Hold-Curve 3D ★ Azm input",      description: "Same as HC3D but target azimuth is pinned by the user instead of inclination." },
      { code: ProfileType.CH3D,           label: "Curve-Hold 3D",                  description: "Curve first, then hold to target. User gives target Inc + TVD/NS/EW. (CH3DFFK)" },
      { code: ProfileType.CH3D_STAR,      label: "Curve-Hold 3D ★ Azm input",      description: "Same as CH3D with target azimuth as user input." },
      { code: ProfileType.HCH,            label: "Hold-Curve-Hold",                description: "Hold + curve + hold. User gives target Inc + TVD/NS/EW + DLS." },
      { code: ProfileType.HCH_STAR,       label: "Hold-Curve-Hold ★ Azm input",    description: "Same as HCH with target azimuth instead of inclination." },
      { code: ProfileType.CH,             label: "Curve-Hold (DLS-given)",         description: "Curve solves final inclination from given DLS; followed by hold to target." },
      { code: ProfileType.D3DS,           label: "3D-S",                           description: "Curve-Hold-Curve to target. User gives target Inc + TVD/NS/EW + per-curve DLS. (CH2DC1)" },
      { code: ProfileType.D3DS_STAR,      label: "3D-S ★ Azm input",               description: "Same as 3D-S with target azimuth as user input." },
      { code: ProfileType.D3DS_HOLD,      label: "3D-S + Hold",                    description: "3D-S with a trailing hold; mid-inclination solved from quadratic. (CH2DC2 mode I)" },
      { code: ProfileType.D3DS_HOLD_STAR, label: "3D-S + Hold ★ Azm input",        description: "Same as 3D-S + Hold with target azimuth." },
      { code: ProfileType.D3DS_HOLD2,     label: "3D-S + Hold (Mode II)",          description: "3D-S + Hold where the mid-inc is user-given and DMD is solved." },
      { code: ProfileType.D3DS_HOLD2_STAR,label: "3D-S + Hold (Mode II) ★ Azm",    description: "Same as Mode II with target azimuth." },
      { code: ProfileType.CC3D,           label: "Curve-Curve 3D",                 description: "Two back-to-back arcs; each curve has its own Inc + DLS." },
      { code: ProfileType.CC3D_STAR,      label: "Curve-Curve 3D ★ Azm input",     description: "Same as CC3D with target azimuth as user input." },
      { code: ProfileType.TARGET,         label: "Planning Target only",           description: "Single arc that flies to the target with the minimum DLS. (HOCTT)" },
    ],
  },
  hold: {
    title: "Hold variants",
    options: [
      { code: ProfileType.HOLD_NS,   label: "Hold (N-S reference)",   description: "Straight hold; user gives MD only. Inc/azm inherited from previous row." },
      { code: ProfileType.HOLD_EW,   label: "Hold (E-W reference)",   description: "Straight hold targeted by TVD." },
      { code: ProfileType.HOLD_VSEC, label: "Hold (Vertical section)", description: "Straight hold targeted by along-hole length (DMD)." },
    ],
  },
  curve: {
    title: "Single curve variants",
    options: [
      { code: ProfileType.CURVE_E1, label: "Curve EOC — given MD + Inc + DLS",  description: "User supplies measured depth, target inclination, and DLS. Builder solves the target azimuth (two candidates; defaults to the −sqrt branch like Pascal Form07)." },
      { code: ProfileType.CURVE_E2, label: "Curve EOC — given MD + Azm + DLS",  description: "User supplies measured depth, target azimuth, and DLS. Builder solves the target inclination." },
      { code: ProfileType.CURVE_E3, label: "Curve EOC — given Inc + Azm + DLS", description: "User supplies target inclination, target azimuth, and DLS. Builder solves the MD (closed form)." },
      { code: ProfileType.CURVE_E4, label: "Curve EOC — given Inc + TVD + DLS", description: "User supplies target inclination, target TVD, and DLS. Builder solves both target azimuth and MD." },
      { code: ProfileType.CURVE_E5, label: "Curve EOC — given Inc + Azm + TVD", description: "User supplies all three angles + TVD. Builder solves DLS from the chord-midpoint identity." },
      { code: ProfileType.FLYTO_1,  label: "Fly-to — at given MD",              description: "Curve continues from previous orientation using prev.TF + DLS. User gives the end MD." },
      { code: ProfileType.FLYTO_2,  label: "Fly-to — at given TVD",             description: "Same as Fly-to #1 but user gives target TVD; the builder bisects MD until the TVD matches." },
      { code: ProfileType.FLYTO_3,  label: "Fly-to — at given DMD",             description: "Same fly-to with along-hole length DMD as the constraint." },
      { code: ProfileType.FLYTO_4,  label: "Fly-to — at given Inc",             description: "User supplies the target inclination + DLS; quadratic solves the DMD." },
      { code: ProfileType.FLYTO_5,  label: "Fly-to — at given Azm",             description: "User supplies the target azimuth + DLS; closed-form solves the DMD." },
    ],
  },
  multi: {
    title: "Multi-curve combos",
    options: [
      // 60s: MD given     × {BR, TR, both}
      { code: ProfileType.MC_60_INC,  label: "Multi-curve — MD + BR",         description: "Linear build rate over a given MD interval. Inc changes at constant BR; azm holds." },
      { code: ProfileType.MC_60_AZM,  label: "Multi-curve — MD + TR",         description: "Linear turn rate over a given MD interval. Azm changes at constant TR; inc holds." },
      { code: ProfileType.MC_60_BOTH, label: "Multi-curve — MD + BR + TR",    description: "Combined build + turn over a given MD interval." },
      // 70s: TVD given
      { code: ProfileType.MC_70_INC,  label: "Multi-curve — TVD + BR",        description: "Linear build rate until target TVD is reached (TVD-based bisection — not yet implemented in the dispatcher)." },
      { code: ProfileType.MC_70_AZM,  label: "Multi-curve — TVD + TR",        description: "Linear turn rate until target TVD (TVD-based; not yet implemented)." },
      { code: ProfileType.MC_70_BOTH, label: "Multi-curve — TVD + BR + TR",   description: "Combined rates until target TVD (TVD-based; not yet implemented)." },
      // 80s: DMD given
      { code: ProfileType.MC_80_INC,  label: "Multi-curve — DMD + BR",        description: "Linear build rate over a given along-hole length (DMD)." },
      { code: ProfileType.MC_80_AZM,  label: "Multi-curve — DMD + TR",        description: "Linear turn rate over a given DMD." },
      { code: ProfileType.MC_80_BOTH, label: "Multi-curve — DMD + BR + TR",   description: "Combined rates over a given DMD." },
      // 90s: INC given
      { code: ProfileType.MC_90_INC,  label: "Multi-curve — Inc + BR",        description: "Build at the given BR until the target inclination is reached." },
      { code: ProfileType.MC_90_AZM,  label: "Multi-curve — Inc + TR",        description: "Turn at the given TR while inclination is constrained — non-vertical only." },
      { code: ProfileType.MC_90_BOTH, label: "Multi-curve — Inc + BR + TR",   description: "Combined BR + TR until target inclination." },
      // 100s: AZM given
      { code: ProfileType.MC_100_INC, label: "Multi-curve — Azm + BR",        description: "Build until target azimuth is reached. Non-vertical only (azm needs an inclined wellbore)." },
      { code: ProfileType.MC_100_AZM, label: "Multi-curve — Azm + TR",        description: "Turn at the given TR until target azimuth." },
      { code: ProfileType.MC_100_BOTH,label: "Multi-curve — Azm + BR + TR",   description: "Combined rates until target azimuth." },
    ],
  },
  survey: {
    title: "Survey / Target",
    options: [
      { code: ProfileType.SURVEY_STATION, label: "Survey Station", description: "Single recorded survey: MD + Inc + Azm. The dispatcher builds the connecting arc using min-curvature." },
      { code: ProfileType.TARGET,         label: "Planning Target", description: "Same as the Target in the standard family — flies to the user-given TVD/NS/EW." },
    ],
  },
};

interface Props {
  onSelect: (profileType: number) => void;
  onCancel: () => void;
  /** "create" = picker opened by "+ Add row"; show a hint that this step is required.
   *  "edit"   = changing the profile of an existing row. */
  mode?: "create" | "edit";
}

export function ProfilePickerModal({ onSelect, onCancel, mode = "edit" }: Props) {
  const [family, setFamily] = useState<Family>("standard");
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          bg-white shadow-xl flex flex-col
          w-full h-[95vh] sm:h-[85vh] sm:max-h-[800px] sm:w-[860px] sm:max-w-[95vw]
          sm:rounded-lg rounded-t-2xl
        "
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="font-semibold text-gray-900">
            {mode === "create" ? "Select a profile type first" : "Select a profile type"}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 -m-1 p-1 rounded"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {mode === "create" && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-800 flex-shrink-0">
            ℹ️ A new segment row will be created with the profile you choose. The
            editable cells depend on which profile family this is.
          </div>
        )}

        <div className="flex border-b border-gray-200 overflow-x-auto -mx-px flex-shrink-0">
          {(Object.keys(FAMILIES) as Family[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFamily(f); setSelected(null); }}
              className={`px-4 py-3 text-sm border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
                family === f
                  ? "border-blue-600 text-blue-700 font-medium bg-blue-50/40"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {FAMILIES[f].title}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <div className="grid grid-cols-1 gap-2">
            {FAMILIES[family].options.map((opt) => (
              <label
                key={opt.code}
                className={`flex items-start gap-3 p-3 border rounded cursor-pointer ${
                  selected === opt.code
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="profile"
                  checked={selected === opt.code}
                  onChange={() => setSelected(opt.code)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{opt.label}</div>
                  {opt.description && (
                    <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
                  )}
                </div>
                <code className="text-xs text-gray-400">#{opt.code}</code>
              </label>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-sm rounded-md bg-gray-100 hover:bg-gray-200 active:bg-gray-300 min-w-[88px]"
          >
            Cancel
          </button>
          <button
            onClick={() => selected !== null && onSelect(selected)}
            disabled={selected === null}
            className="px-4 py-2.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 min-w-[88px]"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
