/**
 * EIV ("Analyzing EMI Logs") — LAS parsing + multi-pad resistivity image
 * pipeline. Port of old_eiv_code/Source (Unit3.pas core + dialogs).
 */
export * from "./types.js";
export { parseLas } from "./parser.js";
export {
  buildTensor, buildModel, buildModelAsync, computeStats, computeStatsForRows,
  defaultParams, matAt, pointForValue, colorForPoint, bandColor, padRowAverages,
} from "./compute.js";
export type { ColorBand } from "./compute.js";
export { mergeLasFiles, mergeAndParse } from "./merge.js";
