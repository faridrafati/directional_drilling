/**
 * Rig-side daily report ENTRY routes — the writable counterpart to /ddr/*.
 *
 * A company man signs in, sees only the wells an admin assigned to them, and
 * fills the DR.xls form day by day. Everything is stored in the app's own SQLite
 * (Entry* models) — the legacy DDR databases stay read-only.
 *
 *   /entry/auth/*            login · me · change password
 *   /entry/wells             the wells I may report on
 *   /entry/wells/:id/reports the day list for one well
 *   /entry/reports*          create · read · save · submit · reopen · delete
 *   /entry/admin/*           rigs · wells · users · assignments   (admin only)
 *
 * Saving a report replaces its child rows wholesale inside one transaction: the
 * form posts the complete sheet every time, which keeps the client trivial and
 * makes a save idempotent.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  hashPassword, verifyPassword, issueToken, requireUser, requireAdmin,
} from "../entry/auth.js";
import { allowedWellIds as scopedWellIds, mayUseWell as canUseWell } from "../entry/access.js";
import { wellRegistryOptions } from "../ddr/db.js";

// ── coercion helpers: the form posts strings, blanks mean "not recorded" ─────
const blank = (v: unknown) => v === "" || v === null || v === undefined;
const num = z.preprocess(
  (v) => (blank(v) ? null : typeof v === "string" ? (v.trim() === "" ? null : Number(v)) : v),
  z.number().finite().nullable(),
).default(null);
const str = z.preprocess(
  (v) => (blank(v) ? null : String(v).trim() === "" ? null : String(v).trim()),
  z.string().nullable(),
).default(null);
const int0 = z.preprocess((v) => (blank(v) ? 0 : Number(v)), z.number().int()).default(0);
// Like `int0`, but a blank stays null — Prisma rejects a float on an Int column,
// so a nullable integer field must never go through `num`.
const intOrNull = z.preprocess(
  (v) => (blank(v) ? null : String(v).trim() === "" ? null : Number(v)),
  z.number().int().nullable(),
).default(null);
/** A tri-state flag: unanswered stays null — it is not the same as "no". */
const boolOrNull = z.preprocess(
  (v) => (blank(v) ? null : typeof v === "string" ? v === "true" || v === "Yes" : !!v),
  z.boolean().nullable(),
).default(null);
/** A flag that is simply on or off; absent means off. */
const bool0 = z.preprocess(
  (v) => (blank(v) ? false : typeof v === "string" ? v === "true" : !!v),
  z.boolean(),
).default(false);

/** Jalali (Shamsi) date as the legacy DBs store it: "1404/05/09". */
const jalali = z.string().regex(/^\d{3,4}\/\d{1,2}\/\d{1,2}$/, "date must be Jalali YYYY/MM/DD");

const bitRunSchema = z.object({
  order: int0, bitNo: str, bitSerialNo: str, size: str, type: str, iadcCode: str,
  nozzles: str, tfa: num,
  // ── a.json drill_strings[].bit additions ──
  make: str, model: str, bitRevs: num,
  meterage: num, hours: num, wob: num, rpm: num, torque: str,
  dullGrade: str, reasonPulled: str, pumpType: str, pumpOutput: num, pumpPressure: num,
  annularVelocity: num, hsi: num, cmtDrilled: str, washAndRun: str,
  bitChangeIn: str, bitChangeOut: str,
  // Report 06 prints the bit's own length on the drill-string block.
  lengthM: num,
});
/** One item in a string's make-up — a.json `drill_strings[].components`. */
const drillStringComponentSchema = z.object({
  order: int0, itemDes: str, serv: str, sn: str, odIn: num, idIn: num,
  jts: intOrNull, lenM: num, cumLenM: num, topThread: str, com: str,
});
/**
 * a.json `drill_strings` — one entry per BHA run in the day, components nested.
 *
 * Replaces the flat BHA list: a day can run two BHAs, and a flat list cannot say
 * which components made up which string, nor carry the per-BHA header figures
 * (depth in, date in, objective, its own drilling/circulating/rotating/sliding
 * hours). Those hours are this string's own — not the day's.
 */
const drillStringSchema = z.object({
  order: int0, name: str, bhaNo: intOrNull, depthInMkb: num, dateIn: str,
  objective: str, depthDrilledM: num, drillingTimeHr: num, circulatingTimeHr: num,
  rotatingTimeHr: num, slidingTimeHr: num, stringWtKlbf: num, note: str,
  components: z.array(drillStringComponentSchema).default([]),
});
const drillPipeSchema = z.object({ order: int0, size: str, grade: str, lengthM: num });
const toolSchema = z.object({ kind: z.enum(["jar", "mwd", "dhMotor"]), type: str, size: str, serialNo: str, hours: num });
/**
 * Mud check — the DR.xls block and a.json `mud_information`, de-duplicated.
 *
 * Four pairs measured the same thing twice and were collapsed onto the a.json
 * name + unit:
 *   maxWeight/minWeight (sg) + densityPpg (single) → densityMinPpg/densityMaxPpg
 *     The RANGE won: 91% of the 62k archive checks record min and max, which a
 *     single density cannot express. It is carried in a.json's unit (ppg), and a
 *     PEDC report giving one density simply fills both ends.
 *   tempF → tFlowlineC (°C) · waterLoss → filtrateMl · calcium → hardnessCaPpm
 * Every other DR.xls-only field stays — neither standard is a superset.
 */
const mudSchema = z.object({
  mudSystem: str, densityMinPpg: num, densityMaxPpg: num,
  reportTime: str, funnelVisc: num,
  pv: num, yp: num, gelInitial: num, gel10min: num, fan600: num, fan300: num,
  ph: num, alkalinity: num, hpht: num, airFoam: num, oilPct: num,
  oilWaterRatio: str, eStability: num, kcl: num, mbt: num, pf: num, mf: num,
  chloride: num, solidsPct: num,
  // ── a.json mud_information additions (all numeric) ──
  depthMkb: num, tFlowlineC: num, filtrateMl: num,
  vis3rpm: num, vis6rpm: num, percentWater: num, lowGravitySolidsPct: num,
  hardnessCaPpm: num, mudLostBbl: num, activeMudVolBbl: num, volMudResBbl: num,
  // ── reports 06 / 07 mud-check cells ──
  filterCake32nds: num, sandPct: num, gel30min: num, pm: num, potassiumMgL: num,
  wholeMudAddedBbl: num, mudLostSurfBbl: num,
}).nullable().default(null);
const solidControlSchema = z.object({
  unit: z.string().min(1), hours: num, underFlow: num, overFlow: num, feed: num, cons: num, fprs: num,
});
const chemicalSchema = z.object({
  order: int0, material: str, unit: str, used: num, received: num, stock: num,
  outstanding: num, requested: num, sent: num,
});
/** a.json `casing_string`. `depth` is set_depth_mkb — the shoe; `topMkb` the hanger. */
const casingSchema = z.object({
  order: int0, casing: str, depth: num, joints: num, runDate: str, topMkb: num, com: str,
});
/** a.json `wellhead_component` — the stack as installed, one row per spool/head. */
const wellheadSchema = z.object({
  order: int0, installDate: str, sizeIn: num, type: str, make: str,
  model: str, sn: str, wpPsi: num, com: str,
});
/** a.json `well_control_scr` — slow circulation rates, one row per pump / rate. */
const scrRateSchema = z.object({
  order: int0, pumpNo: str, depthMkb: num, strokesSpm: num, effPct: num, pPsi: num, qFlowGpm: num,
  // The rig pump this reading belongs to — 06 / 07 print one block per pump.
  mudPumpId: str,
});
/** a.json `support_vessels` — offshore only. */
const supportVesselSchema = z.object({
  order: int0, vesselName: str, vesselType: str, arrivalDate: str, departureDate: str, note: str,
});
/**
 * a.json `formation_integrity_test` — an OBJECT, not a table: at most one FIT/LOT
 * per day. Same 1:1 shape as `mud`, so it saves through the same path.
 */
const fitSchema = z.object({
  testType: str, testDate: str, lastCasingStringRun: str, depthMkb: num, tvdMkb: num,
  appliedSurfacePressurePsi: num, fluidDensityPpg: num, volumePumpedBbl: num,
  leakOffPressurePsi: num, leakOffEqDensityPpg: num,
}).nullable().default(null);
/** a.json `marine_conditions` — offshore only, one object per day (1:1 like `mud`). */
const marineSchema = z.object({
  swellHtM: num, visibilityKm: num, windDir: str, windSpdKnots: num, tHighC: num,
  waveHtM: num, com: str,
}).nullable().default(null);
/**
 * a.json `formations`. `depth` is final_top_md_mkb — where the top actually came
 * in; `progTopMd` is where it was prognosed. Prognosed-vs-actual is the point of
 * the block, so the two never merge.
 */
const formationTopSchema = z.object({
  order: int0, formation: str, depth: num, secondDepth: num, type: str,
  progTopMd: num, finalTopTvd: num, thickM: num, drilledRopMHr: num, lithDes: str,
});
/** a.json `supervisors_contact` — whoever is on tour, roles vary per rig. */
const supervisorSchema = z.object({ order: int0, jobContact: str, position: str, mobile: str });
/** a.json `onboard_companies` — the POB breakdown behind the header head count. */
const companySchema = z.object({
  order: int0, company: str, count: intOrNull, note: str,
  // Report 07's Personnel Log groups by type and totals the hours worked.
  personnelType: str, totWorkTimeHr: num,
});
/** a.json `hse_drill_schedule` — fixed four-row set, blank rows still print. */
const hseDrillSchema = z.object({ type: z.string().min(1), date: str, daysToNextCheck: num });
/** a.json `bulk_material` — rig bulks in MT / liter / m³ (not mud additives). */
const bulkMaterialSchema = z.object({
  order: int0, supplyItemDes: str, unitLabel: str, consumed: num, received: num,
  returned: num, onLoc: num, note: str,
});
const surveySchema = z.object({
  order: int0, md: num, inc: num, azi: num, tvd: num, ns: num, ew: num, vs: num,
  dls: num, build: num,
});
/** a.json "drilling_parameters" — one row per drilled interval. */
const drillingParameterSchema = z.object({
  order: int0, startMkb: num, endDepthMkb: num, drillTimeHr: num, slideTimeHr: num,
  circTimeHr: num, intRopMHr: num, drillTq: num, rpm: num, qFlowGpm: num,
  sppPsi: num, wob1000Lbf: num,
  // ── reports 06 / 07 columns ──
  wellboreId: str,
  drillStrWtKlbf: num, puStrWtKlbf: num, soStrWtKlbf: num, offBottomTorque: num,
  qGasInjM3Min: num, tInjC: num, pBhAnnPsi: num, tBhC: num,
  pSurfAnnulusPsi: num, tSurfAnnulusC: num, qLiqReturnGpm: num, qGasReturnM3Min: num,
});
const timeSchema = z.object({ order: int0, group: str, type: str, activity: str, hours: num });
const operationSchema = z.object({
  order: int0, opCode: str, fromTime: str, toTime: str, remarks: str,
  // ── OIEC coding (advisory) + report 07's problem columns ──
  opLetter: str, opDetail: str, timeIndicator: str, opCode2: str,
  isProblem: bool0, probHr: num, problemRef: intOrNull,
});

/** Report 07's "Drilling Mud Volumes" — what MOVED, not the pit state. */
const mudVolumeSchema = z.object({ order: int0, action: str, toWellBbl: num, fromWellBbl: num });
/** Report 06's "Safety Checks" sidebar — one row per check on the day. */
const safetyCheckSchema = z.object({ order: int0, time: str, type: str, des: str });
/** Report 07 page 2's "Safety Incidents". */
const safetyIncidentSchema = z.object({
  order: int0, time: str, category: str, type: str, subType: str, cause: str,
  lostTime: boolOrNull, severity: str,
});
/** Report 07 page 2's "Interval Problems"; the time log references these by ordinal. */
const intervalProblemSchema = z.object({
  order: int0, problemType: str, problemSubType: str, startDate: str, startTime: str,
  startDepthMkb: num, endDepthMkb: num, accountableParty: str,
  estCost: num, estLostTimeHr: num, comment: str,
});

/** The whole sheet, as the form posts it on save. */
const reportSaveSchema = z.object({
  morningDepth: num, midnightDepth: num, previousDepth: num, endDepthTvd: num,
  drillingTime: num, cumDrillingTime: num,
  // Day counters carried on the header band. cumTimeLogDays is elapsed DAYS on
  // the well — not to be confused with cumDrillingTime, which is hours.
  cumTimeLogDays: num, daysLti: num, headCount: num, hazards: str,
  holeSize: str, formation: str, lithology: str,
  lastCasing: str, linerLap: str, kop: str, wellSiteSupt: str, opnSupt: str,
  progEng: str, geologist: str, toolPusher1: str, toolPusher2: str,
  formationLoss: num, mudLossUnit: num, mudGains: num,
  // ── reports 06 / 07 header cells ──
  weather: str, roadCondition: str, holeCondition: str, temperatureC: num,
  startDepthTvd: num, remarks: str, daysRi: num,
  // The three narrative fields of a.json `operations`: what the rig is doing
  // right now, the 24-hour summary (`description`), and the plan ahead.
  opsAtReportTime: str, description: str, opsNextPeriod: str,
  windSpeedDir: str, waveVisible: str, freshWater: num, fuel: num,
  bitRuns: z.array(bitRunSchema).default([]),
  drillStrings: z.array(drillStringSchema).default([]),
  drillString: z.array(drillPipeSchema).default([]),
  tools: z.array(toolSchema).default([]),
  mud: mudSchema,
  solidControl: z.array(solidControlSchema).default([]),
  chemicals: z.array(chemicalSchema).default([]),
  casing: z.array(casingSchema).default([]),
  wellheads: z.array(wellheadSchema).default([]),
  scrRates: z.array(scrRateSchema).default([]),
  supportVessels: z.array(supportVesselSchema).default([]),
  fit: fitSchema,
  marine: marineSchema,
  formationTops: z.array(formationTopSchema).default([]),
  surveys: z.array(surveySchema).default([]),
  drillingParameters: z.array(drillingParameterSchema).default([]),
  timeBreakdown: z.array(timeSchema).default([]),
  operations: z.array(operationSchema).default([]),
  supervisors: z.array(supervisorSchema).default([]),
  companies: z.array(companySchema).default([]),
  hseDrills: z.array(hseDrillSchema).default([]),
  bulkMaterials: z.array(bulkMaterialSchema).default([]),
  mudVolumes: z.array(mudVolumeSchema).default([]),
  safetyChecks: z.array(safetyCheckSchema).default([]),
  safetyIncidents: z.array(safetyIncidentSchema).default([]),
  intervalProblems: z.array(intervalProblemSchema).default([]),
});

const wellSchema = z.object({
  rigId: z.string().min(1), name: z.string().min(1), field: str, legacyWellCode: str,
  location: str, wellType: str, profile: str, reservoir: str, contractor: str,
  client: str,
  spudDate: str, rigReleasedDate: str, rtElevation: num, waterDepth: num,
  finalForecastDepth: num, forecastDays: num,
  // Typed once per well: coordinates stay TEXT so the DMS reads exactly as printed.
  latitude: str, longitude: str, elevationNote: str, comment: str,
  // ── the WellView header band every report in the suite prints ──
  // These were added with the Tier 0 schema and seeded, but there was nowhere to
  // TYPE them: the well form stopped at the DR.xls fields, so a user could not
  // fill the block their own reports print. They are ordinary optional fields —
  // a well with none of them still saves.
  apiUwi: str, licenseNo: str, stateProvince: str, area: str, county: str,
  groundElevation: num, casingFlangeElevation: num,
  kbGroundDistance: num, kbCasingFlangeDistance: num,
  ewDistance: num, ewRef: str, nsDistance: num, nsRef: str,
  active: z.boolean().default(true),
});

/** Every child relation, in the shape the detail endpoint returns. */
const REPORT_INCLUDE = {
  bitRuns: { orderBy: { order: "asc" } },
  drillStrings: {
    orderBy: { order: "asc" },
    include: { components: { orderBy: { order: "asc" } } },
  },
  drillString: { orderBy: { order: "asc" } },
  tools: true,
  mud: true,
  solidControl: true,
  chemicals: { orderBy: { order: "asc" } },
  casing: { orderBy: { order: "asc" } },
  wellheads: { orderBy: { order: "asc" } },
  scrRates: { orderBy: { order: "asc" } },
  supportVessels: { orderBy: { order: "asc" } },
  fit: true,
  marine: true,
  formationTops: { orderBy: { order: "asc" } },
  surveys: { orderBy: { order: "asc" } },
  drillingParameters: { orderBy: { order: "asc" } },
  timeBreakdown: { orderBy: { order: "asc" } },
  operations: { orderBy: { order: "asc" } },
  supervisors: { orderBy: { order: "asc" } },
  companies: { orderBy: { order: "asc" } },
  hseDrills: { orderBy: { type: "asc" } },   // fixed row set — no order column
  bulkMaterials: { orderBy: { order: "asc" } },
  mudVolumes: { orderBy: { order: "asc" } },
  safetyChecks: { orderBy: { order: "asc" } },
  safetyIncidents: { orderBy: { order: "asc" } },
  intervalProblems: { orderBy: { order: "asc" } },
  well: { include: { rig: true } },
  user: { select: { id: true, username: true, fullName: true } },
} as const;

export async function registerEntryRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const badReq = (reply: FastifyReply, e: unknown) =>
    reply.code(400).send({ error: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String((e as Error)?.message ?? e) });

  const publicUser = { id: true, username: true, fullName: true, role: true, active: true, mustChangePassword: true, createdAt: true } as const;

  // The rule itself lives in ../entry/access.ts — the job and report-data routes
  // guard on the same one, and a second copy would be a second place to drift.
  const allowedWellIds = (req: FastifyRequest) => scopedWellIds(prisma, req);
  const mayUseWell = (req: FastifyRequest, wellId: string) => canUseWell(prisma, req, wellId);

  // ══ auth ═════════════════════════════════════════════════════════════════
  app.post<{ Body: { username?: string; password?: string } }>("/entry/auth/login", async (req, reply) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const user = await prisma.entryUser.findUnique({ where: { username } });
    // Same message either way — never reveal whether the username exists.
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: "wrong username or password" });
    }
    const { token, expiresAt } = issueToken(user);
    return {
      token, expiresAt,
      user: {
        id: user.id, username: user.username, fullName: user.fullName,
        role: user.role, mustChangePassword: user.mustChangePassword,
      },
    };
  });

  app.get("/entry/auth/me", { preHandler: requireUser }, async (req, reply) => {
    const user = await prisma.entryUser.findUnique({
      where: { id: req.entryUser!.sub }, select: publicUser,
    });
    if (!user || !user.active) return reply.code(401).send({ error: "not signed in" });
    const wells = await listWellsFor(req);
    return { user, wells };
  });

  app.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
    "/entry/auth/password", { preHandler: requireUser }, async (req, reply) => {
      const next = String(req.body?.newPassword ?? "");
      if (next.length < 6) return reply.code(400).send({ error: "new password must be at least 6 characters" });
      const user = await prisma.entryUser.findUnique({ where: { id: req.entryUser!.sub } });
      if (!user || !verifyPassword(String(req.body?.currentPassword ?? ""), user.passwordHash)) {
        return reply.code(403).send({ error: "current password is wrong" });
      }
      await prisma.entryUser.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(next), mustChangePassword: false },
      });
      return { ok: true };
    });

  // ══ wells I may report on ════════════════════════════════════════════════
  async function listWellsFor(req: FastifyRequest) {
    const ids = await allowedWellIds(req);
    return prisma.entryWell.findMany({
      where: ids === "all" ? {} : { id: { in: ids } },
      include: { rig: true, _count: { select: { reports: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }
  app.get("/entry/wells", { preHandler: requireUser }, async (req) => listWellsFor(req));

  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/reports", { preHandler: requireUser }, async (req, reply) => {
      if (!(await mayUseWell(req, req.params.wellId))) return reply.code(403).send({ error: "not your well" });
      return prisma.entryReport.findMany({
        where: { wellId: req.params.wellId },
        orderBy: { serialNo: "desc" },
        select: {
          id: true, serialNo: true, reportDate: true, status: true, morningDepth: true,
          midnightDepth: true, previousDepth: true, updatedAt: true, submittedAt: true,
          user: { select: { username: true, fullName: true } },
        },
      });
    });

  // ══ reports ══════════════════════════════════════════════════════════════
  app.post<{ Body: { wellId?: string; reportDate?: string; serialNo?: number } }>(
    "/entry/reports", { preHandler: requireUser }, async (req, reply) => {
      try {
        const wellId = z.string().min(1).parse(req.body?.wellId);
        const reportDate = jalali.parse(req.body?.reportDate);
        if (!(await mayUseWell(req, wellId))) return reply.code(403).send({ error: "not your well" });

        // Continue the well's day sequence, and carry yesterday's midnight depth
        // into "previous depth" the way the paper form does.
        const last = await prisma.entryReport.findFirst({
          where: { wellId }, orderBy: { serialNo: "desc" },
          select: { serialNo: true, midnightDepth: true, cumDrillingTime: true },
        });
        const serialNo = req.body?.serialNo ?? (last?.serialNo ?? 0) + 1;
        const created = await prisma.entryReport.create({
          data: {
            wellId, userId: req.entryUser!.sub, serialNo, reportDate,
            previousDepth: last?.midnightDepth ?? null,
            morningDepth: last?.midnightDepth ?? null,
            // The three fixed solid-control units always exist on the sheet.
            solidControl: { create: ["Clay Jactor", "Mud Cleaner", "Shaker"].map((unit) => ({ unit })) },
            // Likewise the four HSE drills: they print blank when undrilled, so
            // a new day must open with the block already there.
            hseDrills: {
              create: ["BOP Test", "H2S Drill", "Fire Drill", "Abandon Drill"].map((type) => ({ type })),
            },
          },
          include: REPORT_INCLUDE,
        });
        return reply.code(201).send(created);
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") {
          return reply.code(409).send({ error: "a report already exists for that day (or serial no.) on this well" });
        }
        return badReq(reply, e);
      }
    });

  app.get<{ Params: { id: string } }>("/entry/reports/:id", { preHandler: requireUser }, async (req, reply) => {
    const r = await prisma.entryReport.findUnique({ where: { id: req.params.id }, include: REPORT_INCLUDE });
    if (!r) return reply.code(404).send({ error: "not found" });
    if (!(await mayUseWell(req, r.wellId))) return reply.code(403).send({ error: "not your well" });
    return r;
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    "/entry/reports/:id", { preHandler: requireUser }, async (req, reply) => {
      const existing = await prisma.entryReport.findUnique({ where: { id: req.params.id } });
      if (!existing) return reply.code(404).send({ error: "not found" });
      if (!(await mayUseWell(req, existing.wellId))) return reply.code(403).send({ error: "not your well" });
      if (existing.status === "submitted" && req.entryUser!.role !== "admin") {
        return reply.code(409).send({ error: "this report is submitted — ask an admin to reopen it" });
      }
      let body: z.infer<typeof reportSaveSchema>;
      try { body = reportSaveSchema.parse(req.body); } catch (e) { return badReq(reply, e); }

      const { bitRuns, drillStrings, drillString, tools, mud, solidControl, chemicals,
        casing, wellheads, scrRates, supportVessels, fit, marine,
        formationTops, surveys, drillingParameters, timeBreakdown,
        operations, supervisors, companies, hseDrills, bulkMaterials,
        mudVolumes, safetyChecks, safetyIncidents, intervalProblems,
        ...header } = body;
      const id = existing.id;

      // Replace-all: the form always posts the complete sheet.
      await prisma.$transaction([
        prisma.entryReport.update({ where: { id }, data: header }),
        prisma.entryBitRun.deleteMany({ where: { reportId: id } }),
        // Components hang off the string, not the report — they cascade with it.
        prisma.entryDrillString.deleteMany({ where: { reportId: id } }),
        prisma.entryDrillPipe.deleteMany({ where: { reportId: id } }),
        prisma.entryTool.deleteMany({ where: { reportId: id } }),
        prisma.entryMud.deleteMany({ where: { reportId: id } }),
        prisma.entrySolidControl.deleteMany({ where: { reportId: id } }),
        prisma.entryChemical.deleteMany({ where: { reportId: id } }),
        prisma.entryCasingRun.deleteMany({ where: { reportId: id } }),
        prisma.entryWellheadComponent.deleteMany({ where: { reportId: id } }),
        prisma.entryScrRate.deleteMany({ where: { reportId: id } }),
        prisma.entrySupportVessel.deleteMany({ where: { reportId: id } }),
        prisma.entryFit.deleteMany({ where: { reportId: id } }),
        prisma.entryMarine.deleteMany({ where: { reportId: id } }),
        prisma.entryFormationTop.deleteMany({ where: { reportId: id } }),
        prisma.entrySurvey.deleteMany({ where: { reportId: id } }),
        prisma.entryDrillingParameter.deleteMany({ where: { reportId: id } }),
        prisma.entryTimeEntry.deleteMany({ where: { reportId: id } }),
        prisma.entryOperation.deleteMany({ where: { reportId: id } }),
        prisma.entrySupervisor.deleteMany({ where: { reportId: id } }),
        prisma.entryOnboardCompany.deleteMany({ where: { reportId: id } }),
        prisma.entryHseDrill.deleteMany({ where: { reportId: id } }),
        prisma.entryBulkMaterial.deleteMany({ where: { reportId: id } }),
        prisma.entryMudVolume.deleteMany({ where: { reportId: id } }),
        prisma.entrySafetyCheck.deleteMany({ where: { reportId: id } }),
        prisma.entrySafetyIncident.deleteMany({ where: { reportId: id } }),
        prisma.entryIntervalProblem.deleteMany({ where: { reportId: id } }),
        prisma.entryBitRun.createMany({ data: bitRuns.map((r) => ({ ...r, reportId: id })) }),
        // Nested children rule out a flat createMany — one create per string.
        ...drillStrings.map(({ components, ...s }) =>
          prisma.entryDrillString.create({
            data: { ...s, reportId: id, components: { create: components } },
          })),
        prisma.entryDrillPipe.createMany({ data: drillString.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryTool.createMany({ data: tools.map((r) => ({ ...r, reportId: id })) }),
        ...(mud ? [prisma.entryMud.create({ data: { ...mud, reportId: id } })] : []),
        prisma.entrySolidControl.createMany({ data: solidControl.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryChemical.createMany({ data: chemicals.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryCasingRun.createMany({ data: casing.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryWellheadComponent.createMany({ data: wellheads.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryScrRate.createMany({ data: scrRates.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySupportVessel.createMany({ data: supportVessels.map((r) => ({ ...r, reportId: id })) }),
        // 1:1 like `mud` above — a null block just leaves the row deleted.
        ...(fit ? [prisma.entryFit.create({ data: { ...fit, reportId: id } })] : []),
        ...(marine ? [prisma.entryMarine.create({ data: { ...marine, reportId: id } })] : []),
        prisma.entryFormationTop.createMany({ data: formationTops.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySurvey.createMany({ data: surveys.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryDrillingParameter.createMany({ data: drillingParameters.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryTimeEntry.createMany({ data: timeBreakdown.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryOperation.createMany({ data: operations.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySupervisor.createMany({ data: supervisors.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryOnboardCompany.createMany({ data: companies.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryHseDrill.createMany({ data: hseDrills.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryBulkMaterial.createMany({ data: bulkMaterials.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryMudVolume.createMany({ data: mudVolumes.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySafetyCheck.createMany({ data: safetyChecks.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySafetyIncident.createMany({ data: safetyIncidents.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryIntervalProblem.createMany({ data: intervalProblems.map((r) => ({ ...r, reportId: id })) }),
      ]);

      // ── keep the BHA runs in step with what was just typed ──────────────
      //
      // Reports 02 and 03 are scoped to a RUN, but the crew never creates one:
      // they type a BHA number on the drill-strings tab, day after day. So the
      // run is derived from that — one per (well, bhaNo) — and the day's string,
      // its bit and its drilled intervals are pointed at it.
      //
      // Upsert, never delete: a run carries its own facts (depth out, the
      // sensors, the run comment) that no day row holds, and blanking a number
      // for one day must not throw them away.
      const strings = await prisma.entryDrillString.findMany({
        where: { reportId: id }, orderBy: { order: "asc" },
        select: { id: true, order: true, bhaNo: true },
      });
      const runByOrder = new Map<number, string>();
      for (const st of strings) {
        if (st.bhaNo === null) continue;
        const run = await prisma.entryBhaRun.upsert({
          where: { wellId_bhaNo: { wellId: existing.wellId, bhaNo: st.bhaNo } },
          create: { wellId: existing.wellId, bhaNo: st.bhaNo },
          update: {},
        });
        await prisma.entryDrillString.update({ where: { id: st.id }, data: { bhaRunId: run.id } });
        runByOrder.set(st.order, run.id);
      }
      if (runByOrder.size) {
        // A bit row belongs to the string typed beside it — the sheet is filled
        // top to bottom, so the ordinals line up.
        const bits = await prisma.entryBitRun.findMany({
          where: { reportId: id }, select: { id: true, order: true },
        });
        for (const b of bits) {
          const runId = runByOrder.get(b.order) ?? (runByOrder.size === 1 ? [...runByOrder.values()][0] : null);
          if (runId) await prisma.entryBitRun.update({ where: { id: b.id }, data: { bhaRunId: runId } });
        }
        // A drilled interval is only attributed when the day ran ONE assembly;
        // with two, the daily rows do not record which was in the hole.
        if (runByOrder.size === 1) {
          await prisma.entryDrillingParameter.updateMany({
            where: { reportId: id }, data: { bhaRunId: [...runByOrder.values()][0] },
          });
        }
      }

      return prisma.entryReport.findUnique({ where: { id }, include: REPORT_INCLUDE });
    });

  app.post<{ Params: { id: string } }>("/entry/reports/:id/submit", { preHandler: requireUser }, async (req, reply) => {
    const r = await prisma.entryReport.findUnique({ where: { id: req.params.id } });
    if (!r) return reply.code(404).send({ error: "not found" });
    if (!(await mayUseWell(req, r.wellId))) return reply.code(403).send({ error: "not your well" });
    return prisma.entryReport.update({
      where: { id: r.id }, data: { status: "submitted", submittedAt: new Date() }, include: REPORT_INCLUDE,
    });
  });

  // Reopening a locked day is an admin action (the paper form is signed off).
  app.post<{ Params: { id: string } }>("/entry/reports/:id/reopen", { preHandler: requireAdmin }, async (req, reply) => {
    const r = await prisma.entryReport.findUnique({ where: { id: req.params.id } });
    if (!r) return reply.code(404).send({ error: "not found" });
    return prisma.entryReport.update({
      where: { id: r.id }, data: { status: "draft", submittedAt: null }, include: REPORT_INCLUDE,
    });
  });

  app.delete<{ Params: { id: string } }>("/entry/reports/:id", { preHandler: requireUser }, async (req, reply) => {
    const r = await prisma.entryReport.findUnique({ where: { id: req.params.id } });
    if (!r) return reply.code(404).send({ error: "not found" });
    if (!(await mayUseWell(req, r.wellId))) return reply.code(403).send({ error: "not your well" });
    if (r.status === "submitted" && req.entryUser!.role !== "admin") {
      return reply.code(409).send({ error: "submitted reports can only be deleted by an admin" });
    }
    await prisma.entryReport.delete({ where: { id: r.id } });
    return reply.code(204).send();
  });

  // ══ admin: rigs · wells · users · assignments ════════════════════════════
  app.get("/entry/admin/rigs", { preHandler: requireAdmin }, async () =>
    prisma.entryRig.findMany({ include: { wells: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }));

  app.post<{ Body: { name?: string; contractor?: string } }>(
    "/entry/admin/rigs", { preHandler: requireAdmin }, async (req, reply) => {
      try {
        const name = z.string().min(1).parse(req.body?.name?.trim());
        return reply.code(201).send(await prisma.entryRig.create({
          data: { name, contractor: req.body?.contractor?.trim() || null },
        }));
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return reply.code(409).send({ error: "a rig with that name already exists" });
        return badReq(reply, e);
      }
    });

  app.delete<{ Params: { id: string } }>("/entry/admin/rigs/:id", { preHandler: requireAdmin }, async (req, reply) => {
    try { await prisma.entryRig.delete({ where: { id: req.params.id } }); return reply.code(204).send(); }
    catch { return reply.code(404).send({ error: "not found" }); }
  });

  /**
   * Pick-lists for the well form: the company's legacy lookup tables, unioned
   * with whatever is already on the registered wells — so a value typed once is
   * offered from then on, and the lists still work with no legacy DB present.
   */
  app.get("/entry/admin/well-options", { preHandler: requireAdmin }, async () => {
    const legacy = wellRegistryOptions();
    const used = await prisma.entryWell.findMany({
      select: { field: true, location: true, wellType: true, profile: true, reservoir: true, contractor: true },
    });
    const merge = (from: string[], pick: (w: (typeof used)[number]) => string | null) => {
      const seen = new Map<string, string>();   // lowercase key → first spelling wins
      for (const v of [...from, ...used.map(pick)]) {
        const t = (v ?? "").trim();
        if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b));
    };
    return {
      fields: merge(legacy.fields, (w) => w.field),
      locations: merge(legacy.locations, (w) => w.location),
      wellTypes: merge(legacy.wellTypes, (w) => w.wellType),
      profiles: merge(legacy.profiles, (w) => w.profile),
      reservoirs: merge(legacy.reservoirs, (w) => w.reservoir),
      contractors: merge(legacy.contractors, (w) => w.contractor),
      rigs: (await prisma.entryRig.findMany({ select: { name: true } })).map((r) => r.name).sort(),
    };
  });

  app.get("/entry/admin/wells", { preHandler: requireAdmin }, async () =>
    prisma.entryWell.findMany({
      include: { rig: true, _count: { select: { reports: true, assignments: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }));

  app.post<{ Body: unknown }>("/entry/admin/wells", { preHandler: requireAdmin }, async (req, reply) => {
    try {
      const data = wellSchema.parse(req.body);
      return reply.code(201).send(await prisma.entryWell.create({ data, include: { rig: true } }));
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") return reply.code(409).send({ error: "that rig already has a well with this name" });
      return badReq(reply, e);
    }
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    "/entry/admin/wells/:id", { preHandler: requireAdmin }, async (req, reply) => {
      try {
        const data = wellSchema.partial().parse(req.body);
        return await prisma.entryWell.update({ where: { id: req.params.id }, data, include: { rig: true } });
      } catch (e) { return badReq(reply, e); }
    });

  app.delete<{ Params: { id: string } }>("/entry/admin/wells/:id", { preHandler: requireAdmin }, async (req, reply) => {
    try { await prisma.entryWell.delete({ where: { id: req.params.id } }); return reply.code(204).send(); }
    catch { return reply.code(404).send({ error: "not found" }); }
  });

  app.get("/entry/admin/users", { preHandler: requireAdmin }, async () =>
    prisma.entryUser.findMany({
      select: { ...publicUser, assignments: { include: { well: { include: { rig: true } } } } },
      orderBy: { username: "asc" },
    }));

  app.post<{ Body: { username?: string; fullName?: string; password?: string; role?: string; wellIds?: string[] } }>(
    "/entry/admin/users", { preHandler: requireAdmin }, async (req, reply) => {
      try {
        const username = z.string().min(2).parse(req.body?.username?.trim());
        const password = z.string().min(6, "password must be at least 6 characters").parse(req.body?.password);
        const role = req.body?.role === "admin" ? "admin" : "companyman";
        const user = await prisma.entryUser.create({
          data: {
            username, role, fullName: req.body?.fullName?.trim() || username,
            passwordHash: hashPassword(password), mustChangePassword: true,
            assignments: { create: (req.body?.wellIds ?? []).map((wellId) => ({ wellId })) },
          },
          select: { ...publicUser, assignments: { include: { well: true } } },
        });
        return reply.code(201).send(user);
      } catch (e) {
        if ((e as { code?: string }).code === "P2002") return reply.code(409).send({ error: "that username is taken" });
        return badReq(reply, e);
      }
    });

  app.put<{ Params: { id: string }; Body: { fullName?: string; role?: string; active?: boolean; password?: string; wellIds?: string[] } }>(
    "/entry/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
      const id = req.params.id;
      const target = await prisma.entryUser.findUnique({ where: { id } });
      if (!target) return reply.code(404).send({ error: "not found" });
      const b = req.body ?? {};
      // Don't let the last active admin lock everyone out.
      if ((b.role && b.role !== "admin") || b.active === false) {
        if (target.role === "admin") {
          const admins = await prisma.entryUser.count({ where: { role: "admin", active: true } });
          if (admins <= 1) return reply.code(409).send({ error: "this is the last active admin" });
        }
      }
      try {
        const data: Record<string, unknown> = {};
        if (b.fullName !== undefined) data.fullName = b.fullName.trim();
        if (b.role !== undefined) data.role = b.role === "admin" ? "admin" : "companyman";
        if (b.active !== undefined) data.active = !!b.active;
        if (b.password) {
          z.string().min(6, "password must be at least 6 characters").parse(b.password);
          data.passwordHash = hashPassword(b.password);
          data.mustChangePassword = true;
        }
        if (b.wellIds) {
          await prisma.entryAssignment.deleteMany({ where: { userId: id } });
          await prisma.entryAssignment.createMany({ data: b.wellIds.map((wellId) => ({ userId: id, wellId })) });
        }
        return await prisma.entryUser.update({
          where: { id }, data,
          select: { ...publicUser, assignments: { include: { well: { include: { rig: true } } } } },
        });
      } catch (e) { return badReq(reply, e); }
    });

  app.delete<{ Params: { id: string } }>("/entry/admin/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const target = await prisma.entryUser.findUnique({ where: { id: req.params.id } });
    if (!target) return reply.code(404).send({ error: "not found" });
    if (target.role === "admin" && await prisma.entryUser.count({ where: { role: "admin", active: true } }) <= 1) {
      return reply.code(409).send({ error: "this is the last active admin" });
    }
    if (await prisma.entryReport.count({ where: { userId: target.id } })) {
      return reply.code(409).send({ error: "this user has filed reports — deactivate the account instead" });
    }
    await prisma.entryUser.delete({ where: { id: target.id } });
    return reply.code(204).send();
  });

  // Cross-well overview for the office side.
  app.get("/entry/admin/reports", { preHandler: requireAdmin }, async () =>
    prisma.entryReport.findMany({
      orderBy: [{ updatedAt: "desc" }], take: 500,
      select: {
        id: true, serialNo: true, reportDate: true, status: true, midnightDepth: true,
        updatedAt: true, submittedAt: true,
        well: { select: { id: true, name: true, field: true, rig: { select: { name: true } } } },
        user: { select: { username: true, fullName: true } },
      },
    }));
}
