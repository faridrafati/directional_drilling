/**
 * DrillBit analytics — the calculation engine behind the ROP-optimization tab.
 * ROP/MSE (Teale 1965), bit hydraulics & HSI, drilling cost-per-metre, and the
 * statistical fits (power-law, Spearman) that drive the auto-interpretations.
 *
 * References: Teale (1965); Bourgoyne & Young (1974); Eren & Ozbayoglu (2010);
 * Hegde & Gray (2017). All functions are pure and field-unit documented.
 */
export {
  linearFit, powerLawFit, spearman, mean, median, quantile, iqrFence,
} from "./stats.js";
export type { LinearFit, PowerLawFit, IqrFence } from "./stats.js";

export {
  bitArea, psiToMPa, estimateTorque, mseTeale, founderPoint, founderAtConstantRpm, MU_DEFAULT,
} from "./mse.js";
export type { MseInput, Founder, FounderCurvePoint, FounderAtRpm } from "./mse.js";

export {
  tonnesToLbf, knmToFtLbf, mhrToFthr, klbToTonnes,
  LBF_PER_TONNE, FTLBF_PER_KNM, FT_PER_M,
} from "./units.js";

export {
  tfaFromNozzles, nozzlePressureDrop, bitHHP, hsi, jetImpact, hsiFromHydraulics, CD_DEFAULT,
} from "./hydraulics.js";

export {
  rigUsdPerHr, tripHours, costPerMeter, tripAdjustedRop, HANDLING_HR_DEFAULT,
} from "./cost.js";

export { parseBitSizeInches, bitClass } from "./bit.js";
export type { BitClass } from "./bit.js";
