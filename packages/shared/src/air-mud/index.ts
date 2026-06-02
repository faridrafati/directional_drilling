/**
 * Air & Gas Drilling — underbalanced (gas / aerated-mist) hydraulics.
 * Port of old_air_mud_code/Unit41.pas (TForm41 core + part-finders + CALCULATE).
 */
export * from "./types.js";
export {
  btmTemp, surPress, ff, ffbl, eave, tfa,
  anp0, anp3, dpp0, dpp3, blp0, blp3, jtp0, jtp3,
} from "./physics.js";
export type { KernelOut } from "./physics.js";
export {
  anuPartFinder, strPartFinder, bitPartFinder, blnPartFinder, calculate,
} from "./compute.js";
export { DRYGAS_PRESET, AERATED_MUD_PRESET, AIR_MUD_PRESETS } from "./presets.js";
