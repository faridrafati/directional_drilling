/**
 * Demo data for the WellView report suite.
 *
 * Idempotent: safe to run repeatedly, and it never touches a well it did not
 * create (everything is keyed on the demo rig / well names below). Run it with
 *
 *   source ~/.nvm/nvm.sh && nvm use 24
 *   npm run db:seed:wellview
 *
 * The `.mts` extension is load-bearing: the repo root package.json declares no
 * `"type": "module"`, so a plain `.ts` here is treated as CommonJS and
 * `@dd/shared` — which publishes an ESM-only `exports` map — fails to resolve.
 *
 * WHY THE COST LINES ARE THE SAMPLE'S OWN
 * ---------------------------------------
 * The 29 rows below are transcribed from `Wellview/01_AFEvsFieldEstvsFinalInvoice.pdf`
 * verbatim. That makes the report verifiable rather than merely plausible: the
 * assembler computes the four totals from these rows, and they must come out at
 * the figures the sample prints —
 *
 *   Total AFE Amount        10,218,000.00
 *   Total AFE Supplemental     125,000.00
 *   Total Field Estimate    10,127,291.47
 *   AFE-Field Estimate         215,708.53
 *
 * If a rounding rule or a sum ever drifts, this seed catches it immediately.
 * Note the last two rows: the SAME code pair 7000/7602 appears twice, once as an
 * AFE+supplement row and once as a field-estimate-only row with a negative
 * variance. That is exactly why CostItem has no unique constraint on
 * (jobId, costCodeId).
 *
 * The cost CODES here are the vendor's demo chart of accounts, not this
 * company's — which is why the application ships with the CostCode table empty
 * and only this script fills it.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { toJalali } from "@dd/shared";

// Point at the entry database by absolute path rather than inheriting
// DATABASE_URL: apps/api/.env says "file:./dev.db", which is relative to the
// schema directory, and running this from the repo root would otherwise create
// a second, empty database beside package.json instead of failing loudly.
const DB = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/api/prisma/dev.db");
const prisma = new PrismaClient({ datasources: { db: { url: `file:${DB}` } } });

const RIG_NAME = "Demo Rig 432";
const WELL_NAME = "Sample 11 - Full Data";
const JOB_NAME = "Drilling - original";

/** [description, code1, code2, afeAmount, suppAmount, fieldEstimate, finalInvoice] */
type Line = [string, string, string, number | null, number | null, number | null, number | null];

const COST_LINES: Line[] = [
  ["Rig Operating Rate", "1200", "1210", 5_000_000, null, 4_617_116, 5_000_000],
  ["Extra Personnel", "1300", "1310", 150_000, null, 287_275, 150_000],
  ["Direct Supervision", "1300", "1350", 320_000, null, 338_715, 320_000],
  ["Supply & Transportation", "1500", "1510", 40_000, null, 62_701, 40_000],
  ["Helicopter", "1500", "1520", 100_000, null, 36_828, 100_000],
  ["Trucking Charges", "1500", "1530", 20_000, null, 30_932, 20_000],
  ["Work/Supply Boats", "1500", "1580", 1_000_000, null, 1_098_125, 1_000_000],
  ["Mud logging", "1900", "1930", 80_000, null, 74_250, 80_000],
  ["Drilling & completion fluids", "2000", "2010", 900_000, null, 1_104_247.98, 900_000],
  ["Mud Engineer", "2000", "2050", 23_000, null, 35_100, 23_000],
  ["Solids Control Equipment", "2100", "2110", 60_000, null, 15_360, 60_000],
  ["ROV services", "2300", "2310", 150_000, null, 197_100, 150_000],
  ["Miscellaneous well services", "2400", "2410", 100_000, null, 72_743.75, 100_000],
  ["Directional Drilling Services", "2600", "2620", 290_000, null, 361_133, 290_000],
  ["Subsea wellhead equipment", "2700", "2780", 350_000, 50_000, 315_832, 399_000],
  ["Casing - Conductor", "3000", "3010", 75_000, null, 71_183, 75_000],
  ["Casing - Surface", "3000", "3020", 230_000, null, 212_925, 230_000],
  ["Casing - Production", "3000", "3030", 390_000, null, 384_553, 390_000],
  ["Casing/Tubing Crew and Tools", "3000", "3095", 5_000, null, 27_484, 5_000],
  ["Cementing equipment", "3200", "3220", 30_000, null, 86_635, 30_000],
  ["Cement & cement additives", "3200", "3240", 140_000, null, 55_044, 140_000],
  ["Cementing services", "3200", "3290", 50_000, null, 44_465, 50_000],
  ["Bits, scrapers & hole openers", "3400", "3430", 190_000, null, 171_760.74, 190_000],
  ["Other Drill Tools", "3400", "3470", 45_000, null, 46_127, 45_000],
  ["Fuel", "3500", "3550", 300_000, null, 144_640, 300_000],
  ["Fees, licenses & taxes", "3800", "3810", 120_000, null, 178_209, 120_000],
  ["Overhead", "3900", "3960", 10_000, null, 6_807, 10_000],
  // The repeated code pair — see the module note.
  ["Electric logging", "7000", "7602", 50_000, 75_000, null, null],
  ["Electric logging", "7000", "7602", null, null, 50_000, null],
];

/** Which cost lines roll up into the daily header's "Mud Field Est" cell. */
const MUD_CODES = new Set(["2000/2010", "2000/2050"]);

/**
 * The job's phases, plan against actual. Depths are metres — the sample is in
 * feet and we reproduce its LAYOUT, not its units.
 *
 * Phase boundaries carry a time because report 10 prints durations to 2 dp; the
 * plan half is deliberately not a copy of the actual, so plan-vs-actual has
 * something to show.
 */
const PHASES: {
  type1: string; type2: string;
  startDay: number; startTime: string; endDay: number; endTime: string;
  startDepth: number; endDepth: number;
  planStartDepth: number; planEndDepth: number; planDays: number; planCost: number;
}[] = [
  { type1: "Mob and Rig up", type2: "Mob and Rig up", startDay: 0, startTime: "09:00", endDay: 1, endTime: "21:45", startDepth: 0, endDepth: 98.0, planStartDepth: 0, planEndDepth: 0, planDays: 1.34, planCost: 88_000 },
  { type1: "Surface", type2: "Drill-Vertical", startDay: 1, startTime: "21:45", endDay: 3, endTime: "06:45", startDepth: 98.0, endDepth: 299.0, planStartDepth: 0, planEndDepth: 299.0, planDays: 1.21, planCost: 60_000 },
  { type1: "Surface", type2: "Run and Cement Casing", startDay: 3, startTime: "06:45", endDay: 4, endTime: "12:15", startDepth: 299.0, endDepth: 299.0, planStartDepth: 299.0, planEndDepth: 299.0, planDays: 0.5, planCost: 53_000 },
  { type1: "Production", type2: "Drill-Vertical", startDay: 4, startTime: "12:15", endDay: 12, endTime: "05:15", startDepth: 299.0, endDepth: 2_012.0, planStartDepth: 299.0, planEndDepth: 2_010.0, planDays: 6.4, planCost: 220_000 },
  { type1: "Production", type2: "Drill-Deviation Control", startDay: 12, startTime: "05:15", endDay: 22, endTime: "10:45", startDepth: 2_012.0, endDepth: 2_752.0, planStartDepth: 2_010.0, planEndDepth: 2_750.0, planDays: 7.15, planCost: 320_000 },
  { type1: "Production", type2: "Log", startDay: 22, startTime: "10:45", endDay: 22, endTime: "20:45", startDepth: 2_752.0, endDepth: 2_752.0, planStartDepth: 2_750.0, planEndDepth: 2_750.0, planDays: 0.06, planCost: 35_000 },
  { type1: "Production", type2: "Run and Cement Casing", startDay: 22, startTime: "20:45", endDay: 25, endTime: "04:45", startDepth: 2_752.0, endDepth: 2_752.0, planStartDepth: 2_750.0, planEndDepth: 2_750.0, planDays: 2.0, planCost: 218_000 },
  { type1: "Mob", type2: "Demob", startDay: 25, startTime: "04:45", endDay: 25, endTime: "20:00", startDepth: 2_752.0, endDepth: 2_752.0, planStartDepth: 2_750.0, planEndDepth: 2_750.0, planDays: 0.54, planCost: 9_500 },
];

/** Jalali date `n` days after the job start, as the entry DB stores dates. */
const SPUD = new Date(2026, 3, 30);      // 2026-04-30
const day = (n: number): string => toJalali(new Date(SPUD.getTime() + n * 86_400_000));

async function main() {
  const rig = await prisma.entryRig.upsert({
    where: { name: RIG_NAME },
    create: { name: RIG_NAME, contractor: "NABORS" },
    update: { contractor: "NABORS" },
  });

  const wellData = {
    field: "Akuinu",
    client: "POGC",
    location: "Block 6, Pad 2",
    wellType: "Development",
    profile: "Deviated",
    contractor: "NABORS",
    spudDate: day(0),
    rigReleasedDate: day(26),
    rtElevation: 24.5,
    waterDepth: 31.0,
    finalForecastDepth: 2_750,
    forecastDays: 25,
    latitude: "26° 46' 39.11\" N",
    longitude: "52° 08' 11.42\" E",
    // The WellView well-header block.
    apiUwi: "0987656789",
    licenseNo: "8818838",
    stateProvince: "Bushehr",
    groundElevation: 6.0,
    casingFlangeElevation: 0.0,
    kbGroundDistance: 18.5,
    kbCasingFlangeDistance: 64.0,
    // Report 09's band adds these to the block above.
    client: "POGC",
    area: "South",
    county: "Genaveh",
    ewDistance: 800.0,
    ewRef: "E",
    nsDistance: 1_350.0,
    nsRef: "N",
  };
  const well = await prisma.entryWell.upsert({
    where: { rigId_name: { rigId: rig.id, name: WELL_NAME } },
    create: { rigId: rig.id, name: WELL_NAME, ...wellData },
    update: wellData,
  });

  // Cost codes: one row per distinct pair, so the two Electric logging lines
  // share a single code — which is the point of the pair being unique.
  const codeIds = new Map<string, string>();
  for (const [description, code1, code2] of COST_LINES) {
    const key = `${code1}/${code2}`;
    if (codeIds.has(key)) continue;
    const code = await prisma.costCode.upsert({
      where: { code1_code2: { code1, code2 } },
      create: { code1, code2, description, projectScope: "Drilling" },
      update: { description },
    });
    codeIds.set(key, code.id);
  }

  const existingJob = await prisma.job.findFirst({ where: { wellId: well.id, name: JOB_NAME } });
  const jobData = {
    order: 0,
    name: JOB_NAME,
    category: "Drilling",
    primaryJobType: "Drilling - original",
    status1: "Job Complete",
    plannedStartDate: day(0),
    startDate: day(0),
    mostLikelyPlannedEndDate: day(25),
    endDate: day(26),
    targetDepth: 2_750,
    targetFormation: "Blue Heron Shale",
    summary:
      "No major problems were encountered while drilling this well. "
      + "Note that the well was completed under budget and within the allocated number of days.",
    possCostSave: 42_000,
    possTimeSaveHr: 18,
    estProblemCost: 2_500,
    estLostTimeHr: 0.5,
  };
  const job = existingJob
    ? await prisma.job.update({ where: { id: existingJob.id }, data: jobData })
    : await prisma.job.create({ data: { wellId: well.id, ...jobData } });

  // Re-seeding replaces the job's children wholesale so a changed line list can
  // never leave a stale row behind. Only THIS demo job is touched.
  await prisma.costItem.deleteMany({ where: { jobId: job.id } });
  await prisma.jobPhase.deleteMany({ where: { jobId: job.id } });
  await prisma.afe.deleteMany({ where: { jobId: job.id } });

  const afe = await prisma.afe.create({
    data: {
      jobId: job.id, order: 0, afeNumber: "9876543",
      description: "Drilling AFE", amount: 10_218_000, approvedDate: day(-14),
    },
  });
  const supplements = await Promise.all([
    prisma.afeSupplement.create({
      data: { afeId: afe.id, order: 0, number: "9876543-S1", amount: 50_000, approvedDate: day(9) },
    }),
    prisma.afeSupplement.create({
      data: { afeId: afe.id, order: 1, number: "9876543-S2", amount: 75_000, approvedDate: day(17) },
    }),
  ]);
  // Which supplement each supplemented cost row belongs to, in row order.
  const supplementForRow = [supplements[0].id, supplements[1].id];

  const phases = [];
  for (const [i, p] of PHASES.entries()) {
    const phase = await prisma.jobPhase.create({
      data: {
        jobId: job.id, order: i,
        phaseType1: p.type1, phaseType2: p.type2,
        actualStartDate: `${day(p.startDay)} ${p.startTime}`,
        actualEndDate: `${day(p.endDay)} ${p.endTime}`,
        actualStartDepth: p.startDepth, actualEndDepth: p.endDepth,
        workingPhaseCode: p.type1 === "Mob and Rig up" || p.type1 === "Mob" ? "MOVING" : "DRILLING",
        plan: {
          create: {
            startDepth: p.planStartDepth, endDepth: p.planEndDepth,
            durMostLikelyDays: p.planDays, costMostLikely: p.planCost,
          },
        },
      },
    });
    phases.push(phase);
  }

  let supplementIndex = 0;
  for (const [i, [description, code1, code2, afeAmount, suppAmount, fieldEstimate, finalInvoice]] of COST_LINES.entries()) {
    const key = `${code1}/${code2}`;
    await prisma.costItem.create({
      data: {
        jobId: job.id,
        order: i,
        costCodeId: codeIds.get(key)!,
        // Spread the spend across the phases so the phase reports have
        // something to roll up; the totals are unaffected by the attribution.
        phaseId: phases[i % phases.length]?.id ?? null,
        supplementId: suppAmount !== null ? supplementForRow[supplementIndex++] ?? null : null,
        description,
        afeAmount, suppAmount, fieldEstimate, finalInvoice,
        category: MUD_CODES.has(key) ? "mud" : "other",
        costDate: day(Math.min(25, Math.floor((i / COST_LINES.length) * 25))),
      },
    });
  }

  // ── the well's holes and the rig's pumps (reports 06 / 07) ──────────────
  const holes = [{ name: "Original Hole", kind: "Original Hole", koMdMkb: 421.0 }];
  await prisma.entryWellbore.deleteMany({ where: { wellId: well.id } });
  const wellbores = [];
  for (const [i, h] of holes.entries()) {
    wellbores.push(await prisma.entryWellbore.create({ data: { wellId: well.id, order: i, ...h } }));
  }

  const pumpPlant = [
    { pumpNo: "1", manufacturer: "OILWELL", model: "A 1700-PT", ratingHp: 1700, rodDiaIn: 2.2441, strokeIn: 18, linerSizeIn: "6 1/2", volPerStkBbl: 0.159 },
    { pumpNo: "2", manufacturer: "OILWELL", model: "A 1700-PT", ratingHp: 1700, rodDiaIn: 2.2441, strokeIn: 18, linerSizeIn: "6 1/2", volPerStkBbl: 0.159 },
    { pumpNo: "3", manufacturer: "OILWELL", model: "A 1700-PT", ratingHp: 1700, rodDiaIn: 2.2441, strokeIn: 18, linerSizeIn: "6 1/2", volPerStkBbl: 0.159 },
  ];
  await prisma.entryMudPump.deleteMany({ where: { rigId: rig.id } });
  const pumps = [];
  for (const [i, p] of pumpPlant.entries()) {
    pumps.push(await prisma.entryMudPump.create({ data: { rigId: rig.id, order: i, ...p } }));
  }

  // ── the well-level registers reports 07 reprints per day ────────────────
  await prisma.entryIntervalLesson.deleteMany({ where: { wellId: well.id } });
  await prisma.entryKick.deleteMany({ where: { wellId: well.id } });
  await prisma.entryLostCirculation.deleteMany({ where: { wellId: well.id } });
  await prisma.entryIntervalLesson.create({
    data: {
      wellId: well.id, order: 0, lessonType: "Drilling",
      startDate: day(0), endDate: day(7),
      startDepthMkb: 300, endDepthMkb: 810,
      estCostSaving: 625, estTimeSavingHr: 8,
      comment: "Using a shock sub with this bit yielded slower than normal ROP.",
    },
  });
  await prisma.entryLostCirculation.create({
    data: {
      wellId: well.id, order: 0, startDate: day(1), endDate: day(3),
      topDepthMkb: 240, bottomDepthMkb: 268, opsInProg: "Drilling 17-1/2\" hole",
      volLostTotBbl: 86,
    },
  });

  // ── the directional plan (report 08's planned curve) ────────────────────
  // A vertical hold to the kick-off, a build to 42° through the intermediate
  // section, then tangent to TD on a 118° azimuth. NS/EW/VS are the plan
  // listing's own closure, typed as issued — the app never recomputes them.
  await prisma.wellPlanStation.deleteMany({ where: { wellId: well.id } });
  const planStations: [number, number, number, number, number, number, number, string | null][] = [
    //  md      inc    azi     tvd      ns      ew      vs   comment
    [0, 0, 0, 0, 0, 0, 0, "Surface"],
    [420, 0, 0, 420.0, 0, 0, 0, "KOP"],
    [600, 9.0, 118, 599.1, -6.6, 12.5, 14.1, null],
    [900, 24.0, 118, 887.4, -46.6, 87.6, 99.2, null],
    [1_200, 39.0, 118, 1_146.1, -128.6, 241.9, 274.0, "End of build"],
    [1_500, 42.0, 118, 1_370.9, -223.6, 420.5, 476.4, null],
    [2_000, 42.0, 118, 1_742.5, -380.7, 715.9, 811.0, null],
    [2_500, 42.0, 118, 2_114.1, -537.9, 1_011.4, 1_145.7, null],
    [2_760, 42.0, 118, 2_307.4, -619.6, 1_165.0, 1_319.7, "TD — Target A"],
  ];
  await prisma.wellPlanStation.createMany({
    data: planStations.map(([md, inc, azi, tvd, ns, ew, vs, comment], i) => ({
      wellId: well.id, order: i, md, inc, azi, tvd, ns, ew, vs, comment,
    })),
  });

  // ── the hole sections, casing strings and their cement (reports 04 / 05) ──
  await prisma.holeSection.deleteMany({ where: { wellId: well.id } });
  const sections = [
    { sectionDes: "Conductor", sizeIn: "26", actTopMkb: 0, actBtmMkb: 98 },
    { sectionDes: "Surface", sizeIn: "17 1/2", actTopMkb: 98, actBtmMkb: 299 },
    { sectionDes: "Production", sizeIn: "12 1/4", actTopMkb: 299, actBtmMkb: 2_752 },
  ];
  for (const [i, h] of sections.entries()) {
    await prisma.holeSection.create({
      data: { wellId: well.id, wellboreId: wellbores[0]?.id ?? null, order: i, ...h },
    });
  }

  await prisma.casingString.deleteMany({ where: { wellId: well.id } });
  // Tallies are given with Len AND both depths, as the sample prints them — the
  // report derives none of the three from the other two.
  const strings = [
    {
      description: "Conductor Pipe", runDate: day(0), setDepthMkb: 98.0, setTensionKn: 289,
      stringNominalOdIn: "20", stringMinDriftIn: 17.5,
      centralizers: "Two every 5th joint", scratchers: "None",
      tally: [
        { jts: 7, itemDes: "Casing Joint(s)", odIn: "20", idIn: 18.75, massPerLenKgM: 192.5, grade: "X-56", topThread: "RL-4S", topMkb: 0, btmMkb: 86.1, lenM: 86.1, pBurstPsi: 2840, pCollapsePsi: 1410 },
        { jts: 1, itemDes: "Float Shoe", odIn: "20", idIn: 18.75, massPerLenKgM: 192.5, grade: "X-56", topThread: "RL-4S", topMkb: 86.1, btmMkb: 98.0, lenM: 11.9, pBurstPsi: 2840, pCollapsePsi: 1410 },
      ],
      cement: null as null | Record<string, unknown>,
    },
    {
      description: "Surface Casing", runDate: day(1), setDepthMkb: 298.5, setTensionKn: 412,
      stringNominalOdIn: "13 3/8", stringMinDriftIn: 12.41,
      centralizers: "2/joint on shoe track.", scratchers: "None",
      tally: [
        { jts: 24, itemDes: "Casing Joint(s)", odIn: "13 3/8", idIn: 12.415, massPerLenKgM: 101.2, grade: "K-55", topThread: "BTC", topMkb: 0, btmMkb: 273.4, lenM: 273.4, pBurstPsi: 3450, pCollapsePsi: 1950 },
        { jts: 1, itemDes: "Float Collar", odIn: "13 3/8", idIn: 12.415, massPerLenKgM: 101.2, grade: "K-55", topThread: "BTC", topMkb: 273.4, btmMkb: 273.8, lenM: 0.35, pBurstPsi: 3450, pCollapsePsi: 1950 },
        { jts: 2, itemDes: "Casing Joint(s)", odIn: "13 3/8", idIn: 12.415, massPerLenKgM: 101.2, grade: "K-55", topThread: "BTC", topMkb: 273.8, btmMkb: 298.0, lenM: 24.2, pBurstPsi: 3450, pCollapsePsi: 1950 },
        { jts: 1, itemDes: "Float Shoe", odIn: "13 3/8", idIn: 12.415, massPerLenKgM: 101.2, grade: "K-55", topThread: "BTC", topMkb: 298.0, btmMkb: 298.5, lenM: 0.53, pBurstPsi: 3450, pCollapsePsi: 1950 },
      ],
      cement: {
        description: "Surface Casing Cement", startDate: day(1), endDate: day(1),
        evaluationMethod: "Temperature Log", evaluationResults: "Ran temp log to confirm TOC",
        comment: "Job was successful; full returns throughout.",
        stage: {
          topDepthMkb: 0, bottomDepthMkb: 298.0, fullReturn: true, topPlug: true, bottomPlug: true,
          qPumpInitM3Min: 1.6, qPumpFinalM3Min: 0.5, avgPumpRateM3Min: 1.2,
          finalPumpPressurePsi: 350, plugBumpPressurePsi: 1_500,
          pipeReciprocated: true, strokeM: 10.7, reciprocationRateSpm: 3,
          pipeRotated: true, pipeRpm: 18,
          taggedDepthMkb: 271.0, tagMethod: "Drill Bit",
          depthPlugDrilledOutMkb: 298.6, drillOutDiameterIn: "12 1/4", drillOutDate: day(3),
        },
        fluids: [
          {
            fluidType: "Lead", fluidDescription: "Class G + 8% bentonite", amountSacks: 340,
            cementClass: "G", volumePumpedM3: 42.5, estimatedTopMkb: 0, estimatedBtmMkb: 220.0,
            yieldLPerSack: 125, mixWaterLPerSack: 21.4, freeWaterPct: 1.2,
            densityPpg: 12.6, plasticViscosityCp: 28, thickeningTimeHr: 4.2, compressiveStrengthPsi: 980,
            additives: [
              { additive: "Kwik Seal", additiveType: "Lost Circulation Additive", concentration: "0.25 %BWOC" },
              { additive: "HR-5", additiveType: "Retarder", concentration: "0.15 %BWOC" },
            ],
          },
          {
            fluidType: "Tail", fluidDescription: "Neat", amountSacks: 120,
            cementClass: "G", volumePumpedM3: 14.8, estimatedTopMkb: 220.0, estimatedBtmMkb: 298.0,
            yieldLPerSack: 33.2, mixWaterLPerSack: 18.0, freeWaterPct: 0.4,
            densityPpg: 15.8, plasticViscosityCp: 36, thickeningTimeHr: 2.6, compressiveStrengthPsi: 1_880,
            additives: [{ additive: "CaCl2", additiveType: "Accelerator", concentration: "2 %BWOC" }],
          },
        ],
      },
    },
  ];

  for (const [i, st] of strings.entries()) {
    const { tally, cement, ...data } = st;
    const created = await prisma.casingString.create({
      data: {
        wellId: well.id, wellboreId: wellbores[0]?.id ?? null, order: i, ...data,
        components: { create: tally.map((t, k) => ({ order: k, ...t })) },
      },
    });
    if (!cement) continue;
    const { stage, fluids, ...jobData } = cement as {
      stage: Record<string, unknown>;
      fluids: (Record<string, unknown> & { additives: Record<string, unknown>[] })[];
    } & Record<string, unknown>;
    await prisma.cementJob.create({
      data: {
        casingStringId: created.id, wellboreId: wellbores[0]?.id ?? null, order: 0,
        ...(jobData as object),
        stages: {
          create: [{
            order: 0, ...(stage as object),
            fluids: {
              create: fluids.map((f, k) => {
                const { additives, ...fluid } = f;
                return {
                  order: k, ...(fluid as object),
                  additives: { create: additives.map((a, j) => ({ order: j, ...(a as object) })) },
                };
              }),
            },
          }],
        },
      },
    });
  }

  // ── the BHA run reports 02 and 03 are scoped to ─────────────────────────
  // Created before the day, because the day's drill string, bit and drilled
  // interval all point AT it — that link is what turns per-day slices into a run.
  await prisma.entryBhaRun.deleteMany({ where: { wellId: well.id } });
  const bhaRun = await prisma.entryBhaRun.create({
    data: {
      wellId: well.id, wellboreId: wellbores[0]?.id ?? null, bhaNo: 2,
      depthOutMkb: 810.0, dateOut: day(8), timeOut: "16:45",
      comment: "Pulled for bit change at section TD; jar fired twice on the way out.",
      sensors: {
        create: [
          { order: 0, sensorType: "Gamma", distFromBitM: 14.2, note: "Azimuthal" },
          { order: 1, sensorType: "Inclination", distFromBitM: 12.8 },
          { order: 2, sensorType: "Vibration", distFromBitM: 15.6, note: "Lateral and axial" },
        ],
      },
    },
  });

  // ── one fully-filled day, so reports 06 and 07 have something to print ──
  const admin = await prisma.entryUser.findFirst({ where: { role: "admin" }, orderBy: { createdAt: "asc" } });
  if (admin) await seedDay(well.id, admin.id, job.id, wellbores[0]?.id ?? null, pumps, bhaRun.id);
  if (admin) await seedProgressDays(well.id, admin.id, job.id);

  // Attach any daily reports already filed on this well, so the day-scoped
  // reports have a job to hang off.
  const attached = await prisma.entryReport.updateMany({
    where: { wellId: well.id, jobId: null }, data: { jobId: job.id },
  });

  const items = await prisma.costItem.findMany({ where: { jobId: job.id } });
  const sum = (pick: (c: typeof items[number]) => number | null) =>
    Number(items.reduce((t, c) => t + (pick(c) ?? 0), 0).toFixed(2));
  const totalAfe = sum((c) => c.afeAmount);
  const totalSupp = sum((c) => c.suppAmount);
  const totalFld = sum((c) => c.fieldEstimate);

  console.log(`well            ${well.name} (${well.id})`);
  console.log(`job             ${job.name} (${job.id})`);
  console.log(`phases          ${phases.length}`);
  console.log(`cost codes      ${codeIds.size}`);
  console.log(`cost items      ${items.length}`);
  console.log(`daily reports   ${attached.count} attached`);
  console.log("");
  console.log("totals, against the figures report 01's sample prints:");
  const check = (label: string, got: number, want: number) =>
    console.log(`  ${label.padEnd(24)} ${got.toFixed(2).padStart(14)}   expected ${want.toFixed(2).padStart(14)}   ${Math.abs(got - want) < 0.005 ? "OK" : "MISMATCH"}`);
  check("Total AFE Amount", totalAfe, 10_218_000);
  check("Total AFE Supplemental", totalSupp, 125_000);
  check("Total Field Estimate", totalFld, 10_127_291.47);
  check("AFE-Field Estimate", Number((totalAfe + totalSupp - totalFld).toFixed(2)), 215_708.53);
}

/**
 * One complete well-day — day 2 of the job, mirroring the sample's shape: a
 * 24-hour time log, a mud check, one BHA with its make-up, a drilled interval,
 * contacts, a safety meeting, a problem the log references, and an incident.
 *
 * The time log is built so its durations sum to exactly 24.00, which is what
 * report 06's "hr of 24" and report 07's problem percentage are checked against.
 */
async function seedDay(
  wellId: string, userId: string, jobId: string,
  wellboreId: string | null,
  pumps: { id: string; pumpNo: string | null }[],
  bhaRunId: string,
) {
  const reportDate = day(1);
  const existing = await prisma.entryReport.findUnique({
    where: { wellId_reportDate: { wellId, reportDate } },
  });
  // Re-seeding replaces the demo day wholesale; a crew-entered day is never
  // touched because it would have a different date.
  if (existing) await prisma.entryReport.delete({ where: { id: existing.id } });

  //  start   end    hr   code1 code2   problem  remark
  const log: [string, string, string, string, boolean, string][] = [
    ["00:00", "01:45", "04", "CSG", false, "POOH and rack back 26\" BHA"],
    ["01:45", "02:15", "01", "CSG", false, "Prepare to run 20\" casing"],
    ["02:15", "02:30", "01", "CSG", false, "Safety meeting, then run 20\" casing"],
    ["02:30", "06:15", "04", "CSG", false, "Run casing and make up wellhead"],
    ["06:15", "07:00", "05", "CSG", false, "Rig down casing equipment, run cement string"],
    ["07:00", "08:45", "04", "CSG", false, "Finish running cement string, fill casing"],
    ["08:45", "10:30", "04", "CSG", false, "Land casing"],
    ["10:30", "10:45", "05", "CSG", false, "Rig up cementing hose"],
    ["10:45", "11:15", "07", "CSG", false, "Circulate hole clean"],
    ["11:15", "12:45", "09", "CMT", false, "Cement 20\" casing"],
    ["12:45", "15:00", "04", "CMT", false, "POOH with running tools"],
    ["15:00", "15:15", "20", "CMT", false, "Clear rig floor"],
    ["15:15", "16:15", "05", "CMT", false, "Lay down 26\" drilling assembly"],
    ["16:15", "18:15", "05", "DRL", false, "Make up 17-1/2\" BHA"],
    ["18:15", "18:45", "25", "RR", true, "ROV trouble"],
    ["18:45", "20:45", "04", "DRLCMT", false, "RIH to top of cement"],
    ["20:45", "22:00", "14", "DRLCMT", false, "Drill cement and floats"],
    ["22:00", "00:00", "03", "DRLG", false, "Drill 17-1/2\" hole"],
  ];

  const report = await prisma.entryReport.create({
    data: {
      wellId, userId, jobId, serialNo: 2, reportDate, status: "submitted",
      previousDepth: 195.0, midnightDepth: 299.0, morningDepth: 240.0,
      startDepthTvd: 194.8, endDepthTvd: 298.6,
      drillingTime: 2.0, cumDrillingTime: 6.5, cumTimeLogDays: 2, daysLti: 132, daysRi: 41,
      headCount: 46, hazards: "STOP CARD: 12",
      holeSize: "17-1/2\" H.S.", formation: "Aghar", lithology: "Lst, Mrl",
      weather: "Clear", temperatureC: 31, roadCondition: "Dry", holeCondition: "Good",
      opsAtReportTime: "DRILLING 17-1/2\" HOLE",
      opsNextPeriod: "CONTINUE DRILLING 17-1/2\" HOLE",
      description: "Ran and cemented 20\" casing, made up 17-1/2\" BHA, drilled out floats and began drilling.",
      remarks: "ROV control signal lost for 30 minutes; switched to the backup system.",
      wellSiteSupt: "Sam White",
      solidControl: { create: ["Clay Jactor", "Mud Cleaner", "Shaker"].map((unit) => ({ unit })) },
      hseDrills: {
        create: [
          { type: "BOP Test", date: day(0), daysToNextCheck: 14 },
          { type: "H2S Drill", date: day(1), daysToNextCheck: 7 },
          { type: "Fire Drill", date: day(1), daysToNextCheck: 7 },
          { type: "Abandon Drill", date: day(0), daysToNextCheck: 14 },
        ],
      },
      operations: {
        create: log.map(([from, to, detail, code2, problem, remark], i) => {
          // The MAIN OPERATION letter follows what the interval was actually
          // doing, taken from its alpha code. Every row used to be stamped "G"
          // (Casing/Liner Job) because nothing grouped by letter; report 09's
          // time panel does, and a whole day under one letter is not a
          // breakdown.
          const letter = code2 === "CMT" ? "H" : code2 === "CSG" ? "G" : "E";
          return {
            order: i, fromTime: from, toTime: to,
            opCode: `${letter}${Number(detail)}-${problem ? "U" : "P"}`,
            opLetter: letter, opDetail: detail,
            timeIndicator: problem ? "U" : "P", opCode2: code2,
            isProblem: problem, probHr: problem ? 0.5 : null, problemRef: problem ? 1 : null,
            remarks: remark,
          };
        }),
      },
      intervalProblems: {
        create: [{
          order: 0, problemType: "Equipment Trouble", problemSubType: "ROV",
          startDate: reportDate, startTime: "18:15",
          startDepthMkb: 299.0, endDepthMkb: 299.0,
          accountableParty: "Contractor", estCost: 2500, estLostTimeHr: 0.5,
          comment: "Primary control signal to ROV was lost. Switched to backup system.",
        }],
      },
      safetyChecks: {
        create: [{ order: 0, time: "02:15", type: "Safety Meeting", des: "Safety meeting to run 20\" casing" }],
      },
      safetyIncidents: {
        create: [{
          order: 0, time: "18:20", category: "Near Miss", cause: "Loss of ROV control signal",
          lostTime: false,
          com: "While clearing rig floor, rig hand inadvertently released line holding back tongs. "
            + "Tongs swung forward and narrowly missed hitting driller in the shoulder.",
        }],
      },
      mudVolumes: {
        create: [
          { order: 0, action: "Mixed new mud", toWellBbl: 120 },
          { order: 1, action: "Transferred to reserve", fromWellBbl: 45 },
        ],
      },
      supervisors: {
        create: [
          { order: 0, jobContact: "Sam White", position: "Rig Supervisor", mobile: "0917-300-3991" },
          { order: 1, jobContact: "Tom Black", position: "Night Drilling Sup.", mobile: "0917-133-9427" },
          { order: 2, jobContact: "Jim Green", position: "POGC Rep.", mobile: "0917-029-9115" },
        ],
      },
      companies: {
        create: [
          { order: 0, company: "NABORS", count: 22, note: "Drilling Unit", personnelType: "Contractor", totWorkTimeHr: 264 },
          { order: 1, company: "Service companies", count: 18, note: "Service", personnelType: "Service", totWorkTimeHr: 198 },
          { order: 2, company: "POGC", count: 6, note: "Client", personnelType: "Operator", totWorkTimeHr: 72 },
        ],
      },
      mud: {
        create: {
          mudSystem: "KCl-Polymer", reportTime: "12:00", depthMkb: 299.0,
          densityMinPpg: 9.2, densityMaxPpg: 9.4, funnelVisc: 46,
          pv: 14, yp: 18, gelInitial: 6, gel10min: 11, gel30min: 14,
          filtrateMl: 5.6, filterCake32nds: 2, ph: 9.5, sandPct: 0.25, solidsPct: 9.5,
          mbt: 12.5, alkalinity: 0.7, chloride: 32000, hardnessCaPpm: 320,
          pf: 0.4, pm: 0.9, potassiumMgL: 18000, eStability: 0,
          percentWater: 88, oilPct: 0,
          wholeMudAddedBbl: 120, mudLostBbl: 34, mudLostSurfBbl: 8,
          activeMudVolBbl: 980, volMudResBbl: 1132.2,
        },
      },
      chemicals: {
        create: [
          { order: 0, material: "Barite", unit: "MT", used: 12, received: 40, stock: 128 },
          { order: 1, material: "KCl", unit: "MT", used: 4.5, received: 0, stock: 36 },
        ],
      },
      casing: {
        create: [{ order: 0, casing: "20\" Surface Casing", runDate: reportDate, depth: 298.5, joints: 26 }],
      },
      // The stack as landed — report 04 prints one row per component, deduped
      // to the newest record of each.
      wellheads: {
        create: [
          { order: 0, installDate: day(0), sizeIn: 20.75, type: "Casing Head", make: "Cameron", model: "SSMC", sn: "92355-233", wpPsi: 10_000 },
          { order: 1, installDate: day(1), sizeIn: 13.625, type: "Casing Spool", make: "Cameron", model: "SSMC", sn: "33455-352", wpPsi: 10_000 },
        ],
      },
      formationTops: {
        create: [
          { order: 0, formation: "Aghajari", progTopMd: 120, depth: 118.4 },
          { order: 1, formation: "Mishan", progTopMd: 245, depth: 248.2 },
        ],
      },
      // NS / EW / VS are carried because report 08 plots them; a station without
      // them simply does not appear on the plan view.
      surveys: {
        create: [
          { order: 0, md: 150, inc: 0.4, azi: 118, tvd: 149.98, ns: -0.2, ew: 0.5, vs: 0.5, dls: 0.1 },
          { order: 1, md: 210, inc: 0.6, azi: 120, tvd: 209.96, ns: -0.5, ew: 1.0, vs: 1.1, dls: 0.1 },
          { order: 2, md: 270, inc: 0.9, azi: 122, tvd: 269.9, ns: -0.9, ew: 1.7, vs: 1.9, dls: 0.15 },
          { order: 3, md: 299, inc: 1.1, azi: 121, tvd: 298.6, ns: -1.2, ew: 2.2, vs: 2.5, dls: 0.2 },
        ],
      },
      drillingParameters: {
        create: [{
          order: 0, wellboreId, bhaRunId,
          startMkb: 195.0, endDepthMkb: 299.0, drillTimeHr: 2.0,
          intRopMHr: 52.0, qFlowGpm: 786, wob1000Lbf: 22, rpm: 120, sppPsi: 2100,
          drillStrWtKlbf: 148, puStrWtKlbf: 162, soStrWtKlbf: 138,
          drillTq: 9.2, offBottomTorque: 6.4,
        }],
      },
      scrRates: {
        create: pumps.map((p, i) => ({
          order: i, mudPumpId: p.id, pumpNo: p.pumpNo,
          depthMkb: 299.0, strokesSpm: 30, effPct: 95, pPsi: 620, qFlowGpm: 262,
        })),
      },
      bitRuns: {
        create: [{
          order: 0, bhaRunId, bitNo: "2", bitSerialNo: "456789", size: "17 1/2", type: "SS33SGJ4",
          make: "Security", model: "SS33SGJ4", iadcCode: "115",
          nozzles: "18/18/18/18/18/18", tfa: 1.9,
          lengthM: 0.38, itemCost: 48_500, dullGrade: "1-1-NO-A-2-0-NO-TD",
          meterage: 104, hours: 2.0, wob: 22, rpm: 120,
        }],
      },
      drillStrings: {
        create: [{
          order: 0, bhaRunId, name: "17-1/2\" Drilling Assy", bhaNo: 2,
          depthInMkb: 195.0, dateIn: reportDate, objective: "Drill 17-1/2\" hole to 810 m",
          depthDrilledM: 104, drillingTimeHr: 2.0, circulatingTimeHr: 1.5,
          rotatingTimeHr: 2.0, slidingTimeHr: 0, stringWtKlbf: 148,
          note: "Made up per programme; jar placed 9 stands above the collars.",
          components: {
            create: [
              { order: 0, itemDes: "17-1/2\" Bit", odIn: 17.5, idIn: null, jts: 1, lenM: 0.38, cumLenM: 0.38, topThread: "6 5/8 REG", connections: "6 5/8 REG", gaugeIn: 17.5 },
              { order: 1, itemDes: "Float Sub", odIn: 9.5, idIn: 3.0, jts: 1, lenM: 0.85, cumLenM: 1.23, topThread: "6 5/8 REG", connections: "6 5/8 REG", massPerLenKgM: 218, driftIn: 2.81 },
              { order: 2, itemDes: "Near Bit Stabilizer", odIn: 17.375, idIn: 3.0, jts: 1, lenM: 2.1, cumLenM: 3.33, topThread: "6 5/8 REG", connections: "6 5/8 REG", massPerLenKgM: 232, gaugeIn: 17.375 },
              { order: 3, itemDes: "Drill Collar", odIn: 9.5, idIn: 3.0, jts: 6, lenM: 55.4, cumLenM: 58.73, topThread: "6 5/8 REG", connections: "6 5/8 REG", massPerLenKgM: 218, grade: "AISI 4145H", driftIn: 2.81 },
              { order: 4, itemDes: "Drilling Jar", odIn: 9.5, idIn: 3.0, jts: 1, lenM: 9.8, cumLenM: 68.53, topThread: "6 5/8 REG", connections: "6 5/8 REG", massPerLenKgM: 210 },
              { order: 5, itemDes: "Heavy Weight Drill Pipe", odIn: 5, idIn: 3.0, jts: 15, lenM: 138.5, cumLenM: 207.03, topThread: "4 1/2 IF", connections: "4 1/2 IF", massPerLenKgM: 73, grade: "S135", driftIn: 2.81 },
              { order: 6, itemDes: "Drill Pipe", odIn: 5, idIn: 4.276, jts: 10, lenM: 92.0, cumLenM: 299.03, topThread: "4 1/2 IF", connections: "4 1/2 IF", massPerLenKgM: 29.05, grade: "S135", driftIn: 4.15 },
            ],
          },
        }],
      },
    },
  });
  return report;
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());

/**
 * The rest of the job's days, in outline.
 *
 * Report 09's four panels are a JOB-wide dashboard: one showcase day gives them
 * a single bar and a single point, which proves nothing about the arithmetic.
 * These days are deliberately thin — a depth, a coded time log that sums to 24
 * hours, and a problem on two of them — because that is the shape of a real
 * job's other days beside the one somebody wrote up in full.
 *
 * Each day's log is coded with the OIEC main-operation letters the app seeds, so
 * report 09's time panel names its bars from the same table the entry editor
 * validates against. They are all E (Drilling): this stretch of the job IS the
 * 17-1/2" hole, and lost time is coded with the letter of the operation that was
 * in progress and the U indicator, not with a letter of its own.
 */
/**
 * The job's safety incidents, by day offset — report 17's whole subject.
 *
 * Written as the sample writes them: a category, sometimes a sub-type and a
 * cause, and a narrative that says what actually happened. `lostTime` is left
 * NULL on one of them on purpose — the report prints that blank rather than
 * folding it into "No", because an unanswered question is a gap in the record.
 */
const INCIDENTS: Record<number, {
  time: string; category: string; subType?: string; cause?: string;
  severity?: string; lostTime: boolean | null; com: string;
}[]> = {
  3: [{
    time: "09:40", category: "Unsafe Activity", lostTime: false,
    com: "While performing a choke drill, driller noticed that someone had left spare tools lying "
      + "on the catwalk. Driller had to clear the catwalk of debris before proceeding to the choke manifold.",
  }],
  5: [{
    time: "14:05", category: "First Aid", severity: "Minor", lostTime: false,
    com: "AD was helping to rig up drilling bails when his hand became caught in the elevator latch. "
      + "Latch cut his thumb and severed part of his fingernail, requiring bandages from the medic. No LTA.",
  }],
  7: [{
    time: "03:20", category: "Near Miss", cause: "Dropped object", lostTime: false,
    com: "While rigging up the cement head to casing, a cementing hand dropped his sledge hammer. "
      + "Hammer landed approximately 6 inches from the foot of a rig hand.",
  }],
  9: [{
    time: "11:50", category: "Illness", subType: "Poisoning", cause: "Food", lostTime: null,
    com: "Two crew reported to the medic with stomach upset after the night meal. Galley inspected; "
      + "no source confirmed. Lost-time classification pending the medic's report.",
  }],
  11: [{
    time: "22:15", category: "Unsafe Activity", lostTime: false,
    com: "Service hand testing the adjustable stabilizer was using a pipe wrench that was not rig "
      + "approved. He had retrieved the wrench from his own toolbox and it had a cracked handle.",
  }],
};

async function seedProgressDays(wellId: string, userId: string, jobId: string) {
  //   day  depth   [letter, code2, hours, problem hours, remark]
  const days: [number, number, [string, string, number, number, string][]][] = [
    [2, 512, [["E", "DRLG", 18, 0, "Drill 17-1/2\" hole"], ["E", "CIRC", 3, 0, "Circulate and condition mud"], ["E", "TRIP", 3, 0, "Wiper trip"]]],
    [3, 748, [["E", "DRLG", 21, 0, "Drill 17-1/2\" hole"], ["E", "CIRC", 3, 0, "Circulate bottoms up"]]],
    [4, 905, [["E", "DRLG", 14.5, 0, "Drill 17-1/2\" hole"], ["E", "TRIP", 4.5, 0, "POOH for bit change"], ["E", "RIGR", 5, 3.5, "Top drive fault — repair"]]],
    [5, 1_180, [["E", "DRLG", 19, 0, "Drill 17-1/2\" hole"], ["E", "TRIP", 5, 0, "RIH with new bit"]]],
    [6, 1_402, [["E", "DRLG", 20, 0, "Drill 17-1/2\" hole"], ["E", "SURV", 2, 0, "Survey and orient"], ["E", "CIRC", 2, 0, "Circulate"]]],
    [7, 1_610, [["E", "DRLG", 16, 0, "Drill 17-1/2\" hole"], ["E", "HOLE", 4, 4, "Tight hole — ream and work string"], ["E", "CIRC", 4, 0, "Circulate hole clean"]]],
    [8, 1_845, [["E", "DRLG", 22, 0, "Drill 17-1/2\" hole"], ["E", "SURV", 2, 0, "Survey"]]],
    [9, 2_090, [["E", "DRLG", 21.5, 0, "Drill 17-1/2\" hole"], ["E", "CIRC", 2.5, 0, "Circulate"]]],
    [10, 2_336, [["E", "DRLG", 20, 0, "Drill 17-1/2\" hole"], ["E", "TRIP", 4, 0, "Short trip"]]],
    [11, 2_562, [["E", "DRLG", 19, 0, "Drill 17-1/2\" hole"], ["E", "CIRC", 3, 0, "Circulate"], ["E", "SURV", 2, 0, "Survey"]]],
    // The last day changes MAIN OPERATION mid-shift: drilling stops at TD and
    // the wireline unit takes the well, which is letter J, not E.
    [12, 2_752, [["E", "DRLG", 12, 0, "Drill to TD"], ["E", "CIRC", 4, 0, "Circulate hole clean"], ["E", "TRIP", 3, 0, "POOH"], ["J", "LOG", 5, 0, "Rig up wireline and run open-hole logs"]]],
  ];

  /** "07:30" for 7.5 hours past midnight — the log is a clock, not a duration. */
  const clock = (hours: number) => {
    const total = Math.round(hours * 60) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  };

  let previous = 299.0;
  for (const [offset, depth, log] of days) {
    const reportDate = day(offset);
    const existing = await prisma.entryReport.findUnique({
      where: { wellId_reportDate: { wellId, reportDate } },
    });
    if (existing) await prisma.entryReport.delete({ where: { id: existing.id } });

    // Problems get their own register row so report 09's NPT panel has a NAME
    // to group by — the operations reference it by ordinal, exactly as the
    // daily editor's "Prob Ref #" does.
    const problems = log
      .map((entry, i) => ({ entry, i }))
      .filter(({ entry }) => entry[3] > 0);

    let elapsed = 0;
    const operations = log.map(([letter, code2, hours, probHr, remarks], i) => {
      const from = clock(elapsed);
      elapsed += hours;
      const problemIndex = problems.findIndex((p) => p.i === i);
      return {
        order: i,
        opCode: `${letter}-${probHr > 0 ? "U" : "P"}`,
        opLetter: letter,
        timeIndicator: probHr > 0 ? "U" : "P",
        opCode2: code2,
        isProblem: probHr > 0,
        probHr: probHr > 0 ? probHr : null,
        problemRef: problemIndex >= 0 ? problemIndex + 1 : null,
        fromTime: from,
        toTime: clock(elapsed),
        remarks,
      };
    });

    await prisma.entryReport.create({
      data: {
        wellId, userId, jobId, serialNo: offset + 1, reportDate, status: "submitted",
        previousDepth: previous, midnightDepth: depth,
        // Report 13's "Drilling Hrs" column and its Avg. ROP are built from
        // this, not from the coded log: it is the field that MEANS rotating
        // hours, and one source beats reconciling two.
        drillingTime: log.filter(([, code2]) => code2 === "DRLG").reduce((h, e) => h + e[2], 0),
        holeSize: "17-1/2\" H.S.",
        operations: { create: operations },
        intervalProblems: {
          create: problems.map(({ entry }, k) => ({
            order: k,
            problemType: entry[1] === "RIGR" ? "Rig Failure" : "Hole Trouble",
            problemSubType: entry[1] === "RIGR" ? "Top Drive" : "Tight Hole",
            startDate: reportDate,
            accountableParty: entry[1] === "RIGR" ? "Contractor" : "Operator",
            // Report 15 pivots on cost, so a problem without one is a bar that
            // silently is not there. The rate is the day's own trouble, priced
            // at the rig's hourly operating cost.
            estCost: Math.round(entry[3] * 4_800),
            estLostTimeHr: entry[3],
            comment: entry[4],
          })),
        },
        safetyIncidents: {
          create: (INCIDENTS[offset] ?? []).map((i, k) => ({ order: k, ...i })),
        },
        // Report 13's Personnel Hrs column adds these up across the job.
        companies: {
          create: [
            { order: 0, company: "NABORS", personnelType: "Contractor", count: 28, totWorkTimeHr: 336 },
            { order: 1, company: "POGC", personnelType: "Operator", count: 4, totWorkTimeHr: 48 },
            { order: 2, company: "Schlumberger", personnelType: "Service", count: 6, totWorkTimeHr: 72 },
          ],
        },
      },
    });
    previous = depth;
  }
  console.log(`progress days   ${days.length} light days seeded (job days 3-13)`);
}
