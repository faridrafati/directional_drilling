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
  | "curve"     // Form06
  | "survey";   // Form08/Form09

interface Option { code: number; label: string; description?: string }

const FAMILIES: Record<Family, { title: string; options: Option[] }> = {
  standard: {
    title: "Standard profiles",
    options: [
      { code: ProfileType.HC3D, label: "Hold-Curve 3D*", description: "Hold then curve to target (HC3DTFT)" },
      { code: ProfileType.HC3D_STAR, label: "Hold-Curve 3D* (azm input)", description: "Same, with target azimuth pinned" },
      { code: ProfileType.CH3D, label: "Curve-Hold 3D*", description: "Curve then hold to target (CH3DFFK)" },
      { code: ProfileType.CH3D_STAR, label: "Curve-Hold 3D* (azm input)" },
      { code: ProfileType.HCH, label: "Hold-Curve-Hold", description: "Two holds with a curve in the middle" },
      { code: ProfileType.HCH_STAR, label: "Hold-Curve-Hold (azm input)" },
      { code: ProfileType.CH, label: "Curve-Hold (DLS solver)", description: "Curve solves final inclination from DLS" },
      { code: ProfileType.D3DS, label: "3D-S", description: "Curve-Hold-Curve (CH2DC1)" },
      { code: ProfileType.D3DS_HOLD, label: "3D-S with final hold (CH2DC2)" },
      { code: ProfileType.CC3D, label: "Curve-Curve 3D" },
      { code: ProfileType.TARGET, label: "Planning Target only (HOCTT)" },
    ],
  },
  hold: {
    title: "Hold variants",
    options: [
      { code: ProfileType.HOLD_NS,   label: "Hold (North-South reference)" },
      { code: ProfileType.HOLD_EW,   label: "Hold (East-West reference)" },
      { code: ProfileType.HOLD_VSEC, label: "Hold (Vertical section reference)" },
    ],
  },
  curve: {
    title: "Single curve variants",
    options: [
      { code: ProfileType.CURVE_E1, label: "Curve EOC #1" },
      { code: ProfileType.CURVE_E2, label: "Curve EOC #2" },
      { code: ProfileType.CURVE_E3, label: "Curve EOC #3" },
      { code: ProfileType.CURVE_E4, label: "Curve EOC #4" },
      { code: ProfileType.CURVE_E5, label: "Curve EOC #5" },
      { code: ProfileType.FLYTO_1, label: "Fly-to #1" },
      { code: ProfileType.FLYTO_2, label: "Fly-to #2" },
      { code: ProfileType.FLYTO_3, label: "Fly-to #3" },
    ],
  },
  survey: {
    title: "Survey / Target",
    options: [
      { code: ProfileType.SURVEY_STATION, label: "Survey Station" },
      { code: ProfileType.TARGET,          label: "Planning Target" },
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
