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
  aggressiveness, depthOfCutIn, drillingStrength, efficiencyRatio,
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
  breakEvenRopMHr, breakEvenMeters,
} from "./cost.js";

export {
  wearAvg, wearPerHour, wearPer100m, isSevereDull, isFailureReason,
  FAILURE_REASON_CODES,
} from "./wear.js";
export { buildRoadmap, wearCautionCutoff, cautionCutoffs, MIN_RUNS, MIN_BEST, MSE_CV_FLOOR } from "./roadmap.js";
export type { RoadmapRun, RoadmapRow, Band, ZoneFlag } from "./roadmap.js";
export {
  apparentCcsFromMse, binghamFit, dExponent, dcExponent, familiesForUcs,
  UCS_BANDS, MSE_CCS_RATIO, CCS_UCS_RATIO,
} from "./strength.js";
export type { ApparentStrength, BinghamResult, UcsBand } from "./strength.js";
export {
  bymPredict, bymFit, bymSurface, gridOver,
  BYM_BOUNDS, BYM_MIN_RUNS, BYM_MIN_SPREAD, bymReliability,
} from "./bym.js";
export type { BymRun, BymCoeffs, BymFit, BymRefusal, SurfaceCell } from "./bym.js";
export { bestComposite, ropBands, MIN_BAND_RUNS } from "./benchmark.js";
export type { WellTrack, CompositePoint, RopBand } from "./benchmark.js";
export { parseBitSizeInches, bitClass } from "./bit.js";
export type { BitClass } from "./bit.js";
