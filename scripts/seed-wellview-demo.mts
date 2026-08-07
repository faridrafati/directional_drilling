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

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
