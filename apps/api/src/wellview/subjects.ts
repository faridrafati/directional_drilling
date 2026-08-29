/**
 * WellView's SUBJECT AREAS, and which folder belongs to each.
 *
 * §3.9 Selecting Folders is explicit: "Well information in the Edit Data window
 * is grouped into subject areas. Each subject area (such as General,
 * Operations, and Geological Evaluation) contains a group of folders… When
 * entering your data, start with the first subject area, and work your way down
 * the list."
 *
 * This app showed 66 top-level folders in one flat list ordered by hidden table
 * names, so wvTestEquip / wvTestLeakOff / wvTestSSSV sat together with
 * wvTimeCurve between them — three tests split by a folder of real-time curves,
 * because "TestL" < "TimeC" < "TestS" is not how anybody thinks about a well.
 *
 * WHERE THIS LIST COMES FROM. It is the vendor's own, read out of the shipped
 * help: topic 1.174 "Subject Areas" names the eleven areas in order, and each
 * area's landing page (1.175 General, 1.182 Operations, 1.239 Wellbores…)
 * lists its folders under "see the following pages". Folder names were matched
 * to tables through the model's own labels, normalised for the differences
 * between prose and a caption — "&" against "and", a plural against a singular,
 * the app's parenthetical in "Well Header (General)". 56 of the 66 matched
 * outright; the ten below that did not are named individually, with the reason.
 *
 * The order WITHIN an area is the guide's, not alphabetical: the guide lists
 * Risers before Casing Strings before Cement, which is the order the work
 * happens in.
 */

/** The eleven areas, in the order topic 1.174 gives them. */
export const SUBJECT_AREAS: { name: string; tables: string[] }[] = [
  {
    name: "General",
    tables: [
      "wvWellHeader", "wvWellAttributes", "wvElevationHistory", "wvWellAlias",
      "wvWellStatusHistory",
      /*
       * The ten legal-survey location tables. The guide's subject-area pages
       * name none of them, because in the desktop they are not folders of their
       * own: `wvWellHeader.LegalSurveyTyp` names WHICH ONE applies to a well
       * ("wvloccarter", "wvlocoffshore" — the values are table names), so only
       * the chosen one is shown, under the header. Until this app can do that,
       * they sit with the record they describe rather than in a catch-all.
       */
      "wvLocCarter", "wvLocCongressional", "wvLocDLS", "wvLocFPS", "wvLocNE",
      "wvLocNorthSea", "wvLocNTS", "wvLocOffshore", "wvLocOhio", "wvLocTexas",
    ],
  },
  { name: "Operations", tables: ["wvJob", "wvTask", "wvInspect"] },
  { name: "Wellbores, Surveys, and Formations", tables: ["wvWellbore"] },
  {
    name: "Geological Evaluation",
    tables: ["wvGeoEval", "wvLog", "wvCore", "wvCoreSideWall", "wvWellTestRFT"],
  },
  {
    name: "Casing, Cement, and Wellheads",
    tables: ["wvRiser", "wvCas", "wvCement", "wvWellhead", "wvTestLeakOff"],
  },
  {
    name: "Tubing, Rods, and Other Equipment",
    tables: ["wvTub", "wvRod", "wvOtherStr", "wvOtherInHole"],
  },
  {
    name: "Surface Equipment",
    tables: ["wvPumpingUnit", "wvPrimeMover", "wvWHDrive", "wvSurfControlEquip"],
  },
  {
    name: "Zones, Perfs, Stims, and Swabs",
    tables: ["wvZone", "wvPerforation", "wvStimTreat", "wvSwab"],
  },
  {
    name: "Reservoir and Equipment Tests",
    tables: [
      "wvWellTestTrans", "wvWellTestPresTrav", "wvWellTestFluidLevel",
      "wvWellTestLogProd", "wvTestEquip", "wvTestSSSV", "wvWellTestProd",
      "wvWellTestInject",
    ],
  },
  {
    name: "Production Operations and Failures",
    tables: [
      "wvWellReview", "wvProblem", "wvProdSetting", "wvAnnularFluid",
      "wvChemicalInjection", "wvProduction", "wvFluidAnalysis",
    ],
  },
  {
    name: "Other",
    tables: [
      "wvOperatorHistory", "wvResponsibleTeam", "wvLegalStatus", "wvTimeCurve",
      "wvWorkingInt", "wvExtReport", "wvDepthAnnotation", "wvNote",
      "wvAttachment", "wvComment",
    ],
  },
];

/** Where the guide puts a top-level folder, or null if it names it nowhere. */
const INDEX = new Map<string, string>();
for (const a of SUBJECT_AREAS) {
  for (const t of a.tables) INDEX.set(t.toLowerCase(), a.name);
}
export const subjectAreaOf = (table: string): string | null =>
  INDEX.get(table.toLowerCase()) ?? null;

/**
 * Where a folder sorts in a flat list of all of them — the guide's order, not
 * the schema's.
 *
 * BOTH halves matter. Ranking only within an area puts every area's first
 * folder equal, and the flat list then falls back to the alphabet across areas:
 * Geological Evaluation's first folder ahead of the Well Header, when §3.9 is
 * explicit that you "start with the first subject area, and work your way down
 * the list". The area's own position is the high digits.
 */
const RANK = new Map<string, number>();
SUBJECT_AREAS.forEach((a, area) => {
  a.tables.forEach((t, i) => RANK.set(t.toLowerCase(), area * 1000 + i));
});
export const subjectRankOf = (table: string): number =>
  RANK.get(table.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

/**
 * Group the top-level folders this database actually has.
 *
 * A folder the guide does not name still has to be reachable — this converted
 * schema is not guaranteed to be the one the help was written against — so
 * anything unplaced is collected under a last group that SAYS it is unplaced,
 * rather than being dropped or filed under a guess.
 */
export function groupBySubject(tables: string[]): { name: string; tables: string[]; listed: boolean }[] {
  const have = new Set(tables.map((t) => t.toLowerCase()));
  const out: { name: string; tables: string[]; listed: boolean }[] = [];
  for (const a of SUBJECT_AREAS) {
    const mine = a.tables.filter((t) => have.has(t.toLowerCase()));
    if (mine.length) out.push({ name: a.name, tables: mine, listed: true });
  }
  const rest = tables.filter((t) => !INDEX.has(t.toLowerCase()));
  if (rest.length) {
    out.push({
      name: "Not listed in a subject area",
      tables: [...rest].sort((a, b) => a.localeCompare(b)),
      listed: false,
    });
  }
  return out;
}
