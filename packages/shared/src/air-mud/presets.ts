/**
 * Built-in sample wells, transcribed from the original Access databases shipped
 * with the Delphi app (old_air_mud_code/DRYGAS.mdb and "AREATED MUD.mdb").
 *
 * Both describe the same hole (well "11", bit "12", casing "13", BHA "14"):
 *   • 8.01" casing 0–7000 ft, then 7.875" open hole to 10050 ft TD
 *   • a 5-component string (drill collar at the bit), total length 10050 ft
 * They differ only in the fluid: DRYGAS injects dry air; AERATED_MUD adds
 * 231 gpm of 10-ppg / 30-PV mud. The BHA is listed TOP → BOTTOM in primary-key
 * order, so the drill collar lands at the bit (matching the Delphi TTable read
 * order).
 */
import type { AirMudInput } from "./types.js";

/** Shared geometry for well "11" (identical between the two sample DBs). */
const CASING_11 = [
  { id: 8.01, dTop: 0, dBtm: 6650 },
  { id: 8.01, dTop: 6650, dBtm: 7000 },
];
const BHA_14 = [
  { size: 4.5, id: 3.82, length: 6699, type: "DRILL PIPE" },
  { size: 6.62, id: 5.52, length: 351, type: "DRILL PIPE" },
  { size: 4.5, id: 3.82, length: 2375, type: "DRILL PIPE" },
  { size: 6.62, id: 5.52, length: 125, type: "DRILL PIPE" },
  { size: 6.75, id: 2.81, length: 500, type: "DRILL COLLAR" },
];

/** Dry-gas drilling sample (DRYGAS.mdb). */
export const DRYGAS_PRESET: AirMudInput = {
  calcType: "gas",
  surfFlow: 8737.21232,
  surfTemp: 504.0,
  gasSg: 1.0,
  moleWt: 28.97,
  heatC: 1.4,
  solidSg: 2.7,
  rop: 60,
  elevation: 4000,
  geotherm: 0.01,
  tvdOut: 10050,
  ohRough: 0.01,
  dpRough: 0.00015,
  bitSize: 7.875,
  mudFlow: 0,
  mudWt: 0,
  mudVis: 0,
  casing: CASING_11.map((c) => ({ ...c })),
  bha: BHA_14.map((b) => ({ ...b })),
  nozzles: [22.4, 22.4, 22.4],
};

/** Aerated-mud (mist) drilling sample ("AREATED MUD.mdb"). */
export const AERATED_MUD_PRESET: AirMudInput = {
  calcType: "aerated",
  surfFlow: 9447.85887,
  surfTemp: 519.67,
  gasSg: 1.0,
  moleWt: 28.97,
  heatC: 1.4,
  solidSg: 2.7,
  rop: 60,
  elevation: 4000,
  geotherm: 0.01,
  tvdOut: 10050,
  ohRough: 0.01,
  dpRough: 0.00015,
  bitSize: 7.875,
  mudFlow: 231,
  mudWt: 10,
  mudVis: 30,
  casing: CASING_11.map((c) => ({ ...c })),
  bha: BHA_14.map((b) => ({ ...b })),
  nozzles: [11, 11, 11],
};

/**
 * Preset registry for the sample-well loader dropdown. Labels are the source
 * `.mdb` dataset names (not fluid types) so the loader reads as "load this
 * example well", distinct from the form's Fluid-model toggle (`calcType`).
 */
export const AIR_MUD_PRESETS: { id: string; label: string; input: AirMudInput }[] = [
  { id: "drygas", label: "DRYGAS sample", input: DRYGAS_PRESET },
  { id: "aerated", label: "AREATED MUD sample", input: AERATED_MUD_PRESET },
];
