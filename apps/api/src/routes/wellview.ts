/**
 * WellView report suite — the well-level (job / AFE / cost) entry API.
 *
 *   /entry/wellview/codes        the seeded operation-code tables (pick-lists)
 *   /entry/wells/:wellId/jobs    the jobs on one well
 *   /entry/jobs                  create
 *   /entry/jobs/:id              read · save · delete
 *   /entry/cost-codes            the company chart of accounts   (admin)
 *
 * Registered separately from entry.ts because it is a different GRAIN: the daily
 * routes there are per-report, these are per-job. Both sit behind the same entry
 * token and the same well-access rule (../entry/access.ts).
 *
 * SAVE DOCTRINE — id-stable upsert, NOT the daily editor's replace-all
 * ------------------------------------------------------------------
 * `PUT /entry/reports/:id` deletes every child row and re-creates it, which is
 * safe there because nothing points INTO a daily child row. A job is different:
 * a CostItem carries `phaseId` and `afeLineId`. Delete-and-recreate would mint
 * new phase ids on every save and orphan every cost row that referenced one.
 *
 * So the job save keeps ids: rows the client posts with an id are updated, rows
 * whose id is no longer posted are deleted, rows with a new id are created. The
 * client mints a cuid for a row it just added (the columns are
 * `String @id @default(cuid())`, so a supplied id is perfectly valid), which is
 * what lets a cost row reference a phase created in the SAME save.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireAdmin } from "../entry/auth.js";
import { mayUseWell } from "../entry/access.js";

// ── coercion helpers, identical in behaviour to routes/entry.ts ──────────────
// A blank input means "not recorded" and must land as null, never as 0 or "".
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
/**
 * Tri-state yes/no. Unanswered is NOT "no": report 04 prints a blank cell for a
 * question nobody answered and "No" for one answered no, and the difference is
 * the whole point of the column.
 */
const bool = z.preprocess(
  (v) => (blank(v) ? null : v === "true" || v === true ? true : v === "false" || v === false ? false : null),
  z.boolean().nullable(),
).default(null);

/** A client-minted cuid on a new row, or the stored id on an existing one. */
const rowId = z.preprocess(
  (v) => (blank(v) ? null : String(v).trim() || null),
  z.string().nullable(),
).default(null);

/**
 * Jalali "YYYY/MM/DD", optionally with a time — phase boundaries carry one
 * because report 10's durations are printed to 2 dp off 09:00 / 21:45 marks.
 * Kept as a WARNING-free plain string field: the same looseness as the daily
 * routes, so nothing that already saves stops saving.
 */
const jalaliish = str;

const jobPhasePlanSchema = z.object({
  startDepth: num, endDepth: num, durMostLikelyDays: num, costMostLikely: num,
}).nullable().default(null);

const jobPhaseSchema = z.object({
  id: rowId, order: int0,
  phaseType1: str, phaseType2: str,
  actualStartDate: jalaliish, actualEndDate: jalaliish,
  actualStartDepth: num, actualEndDepth: num,
  workingPhaseCode: str,
  plan: jobPhasePlanSchema,
});

const afeSupplementSchema = z.object({
  id: rowId, order: int0, number: str, amount: num, approvedDate: jalaliish,
});
const afeLineSchema = z.object({
  id: rowId, order: int0, costCodeId: str, description: str, amount: num,
});
const afeSchema = z.object({
  id: rowId, order: int0, afeNumber: str, description: str, amount: num,
  approvedDate: jalaliish,
  supplements: z.array(afeSupplementSchema).default([]),
  lines: z.array(afeLineSchema).default([]),
});

const costItemSchema = z.object({
  id: rowId, order: int0,
  phaseId: str, costCodeId: str, afeLineId: str, supplementId: str,
  description: str,
  afeAmount: num, suppAmount: num, fieldEstimate: num, finalInvoice: num,
  category: str, costDate: jalaliish,
});

const jobHeaderSchema = z.object({
  order: int0, name: str, category: str, primaryJobType: str, secondaryJobType: str,
  status1: str,
  plannedStartDate: jalaliish, startDate: jalaliish,
  minPlannedEndDate: jalaliish, mostLikelyPlannedEndDate: jalaliish,
  maxPlannedEndDate: jalaliish, endDate: jalaliish,
  targetDepth: num, targetFormation: str, summary: str,
  possCostSave: num, possTimeSaveHr: num, estProblemCost: num, estLostTimeHr: num,
});

/** The whole job sheet, as the Well Data editor posts it. */
const jobSaveSchema = jobHeaderSchema.extend({
  phases: z.array(jobPhaseSchema).default([]),
  afes: z.array(afeSchema).default([]),
  costItems: z.array(costItemSchema).default([]),
});

// ── well- and rig-level registers (reports 06 / 07) ─────────────────────────
/**
 * The well's holes. Id-stable like the job sheet, not replace-all: the daily
 * drilling-parameter rows point at these, and re-minting the ids on every save
 * would silently unlink every interval from its hole.
 */
const wellboreSchema = z.object({
  id: rowId, order: int0, name: str, kind: str, koMdMkb: num,
});
/** Reports 07's well-level registers. Nothing points INTO these, so they save
 *  replace-all, exactly like a daily child table. */
const lessonSchema = z.object({
  order: int0, lessonType: str, startDate: str, endDate: str,
  startDepthMkb: num, endDepthMkb: num, estCostSaving: num, estTimeSavingHr: num, comment: str,
});
const kickSchema = z.object({
  order: int0, kickDate: str, kickTime: str, kickDepthMkb: num,
  controlDate: str, controlTime: str, controlDepthMkb: num, kickClass: str, killNotes: str,
});
const lostCirculationSchema = z.object({
  order: int0, startDate: str, topDepthMkb: num, bottomDepthMkb: num,
  opsInProg: str, volLostTotBbl: num, endDate: str,
});
/**
 * The run-level facts no day row holds. The run itself is created by the daily
 * save from the BHA number the crew types, so this NEVER creates or deletes one
 * — it only fills in what belongs to the run as a whole.
 */
const bhaRunSchema = z.object({
  id: z.string().min(1),
  wellboreId: str, depthOutMkb: num, dateOut: str, timeOut: str, comment: str,
  sensors: z.array(z.object({
    order: int0, sensorType: str, distFromBitM: num, note: str,
  })).default([]),
});
const registersSchema = z.object({
  wellbores: z.array(wellboreSchema).default([]),
  bhaRuns: z.array(bhaRunSchema).default([]),
  lessons: z.array(lessonSchema).default([]),
  kicks: z.array(kickSchema).default([]),
  lostCirculation: z.array(lostCirculationSchema).default([]),
});
/** The rig's mud pumps. Id-stable for the same reason as the wellbores: the
 *  day's slow-circulation readings hang off them. */
const mudPumpSchema = z.object({
  id: rowId, order: int0, pumpNo: str, manufacturer: str, model: str,
  ratingHp: num, rodDiaIn: num, strokeIn: num, linerSizeIn: str, volPerStkBbl: num,
});

// ── casing, cement and hole sections (reports 04 / 05) ─────────────────────
/**
 * The hole the string was run in. Nothing points into these, so replace-all.
 */
const holeSectionSchema = z.object({
  order: int0, wellboreId: str, sectionDes: str, sizeIn: str,
  actTopMkb: num, actBtmMkb: num,
});
const casingComponentSchema = z.object({
  order: int0, jts: num, itemDes: str, odIn: str, idIn: num,
  massPerLenKgM: num, grade: str, topThread: str,
  topMkb: num, btmMkb: num, lenM: num, pBurstPsi: num, pCollapsePsi: num,
});
const cementAdditiveSchema = z.object({
  order: int0, additive: str, additiveType: str, concentration: str,
});
const cementFluidSchema = z.object({
  order: int0, fluidType: str, fluidDescription: str, amountSacks: num,
  cementClass: str, volumePumpedM3: num, estimatedTopMkb: num, estimatedBtmMkb: num,
  yieldLPerSack: num, mixWaterLPerSack: num, freeWaterPct: num, densityPpg: num,
  plasticViscosityCp: num, thickeningTimeHr: num, compressiveStrengthPsi: num,
  additives: z.array(cementAdditiveSchema).default([]),
});
const cementStageSchema = z.object({
  order: int0, topDepthMkb: num, bottomDepthMkb: num, fullReturn: bool,
  volCementM3: num, topPlug: bool, bottomPlug: bool,
  qPumpInitM3Min: num, qPumpFinalM3Min: num, avgPumpRateM3Min: num,
  finalPumpPressurePsi: num, plugBumpPressurePsi: num,
  pipeReciprocated: bool, strokeM: num, reciprocationRateSpm: num,
  pipeRotated: bool, pipeRpm: num,
  taggedDepthMkb: num, tagMethod: str,
  depthPlugDrilledOutMkb: num, drillOutDiameterIn: str, drillOutDate: jalaliish,
  fluids: z.array(cementFluidSchema).default([]),
});
const cementJobSchema = z.object({
  order: int0, wellboreId: str, description: str,
  startDate: jalaliish, endDate: jalaliish,
  evaluationMethod: str, evaluationResults: str, comment: str,
  stages: z.array(cementStageSchema).default([]),
});
/**
 * A casing string. Id-stable, NOT replace-all: a daily casing-run row carries
 * `casingStringId`, and re-minting the id on every save would silently unlink
 * the day the string was run from the string itself.
 */
const casingStringSchema = z.object({
  id: rowId, order: int0, wellboreId: str, description: str, runDate: jalaliish,
  setDepthMkb: num, setTensionKn: num, stringNominalOdIn: str, stringMinDriftIn: num,
  centralizers: str, scratchers: str,
  components: z.array(casingComponentSchema).default([]),
  cementJobs: z.array(cementJobSchema).default([]),
});
const casingSaveSchema = z.object({
  holeSections: z.array(holeSectionSchema).default([]),
  strings: z.array(casingStringSchema).default([]),
});

const costCodeSchema = z.object({
  id: rowId,
  // NOT .min(1): the admin grid keeps spare blank rows on screen like every
  // other table in this app, and a spare row must not 400 the whole save. Rows
  // with nothing in them are dropped below.
  code1: str, code2: str, description: str, projectScope: str,
  active: z.preprocess((v) => (v === undefined ? true : !!v), z.boolean()).default(true),
});

/** Everything a job detail endpoint returns, in print order. */
const JOB_INCLUDE = {
  phases: { orderBy: { order: "asc" }, include: { plan: true } },
  afes: {
    orderBy: { order: "asc" },
    include: {
      supplements: { orderBy: { order: "asc" } },
      lines: { orderBy: { order: "asc" }, include: { costCode: true } },
    },
  },
  costItems: { orderBy: { order: "asc" }, include: { costCode: true } },
  well: { include: { rig: true } },
} as const;

export async function registerWellviewRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const badReq = (reply: FastifyReply, e: unknown) =>
    reply.code(400).send({
      error: e instanceof z.ZodError
        ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        : String((e as Error)?.message ?? e),
    });

  const mayUse = (req: FastifyRequest, wellId: string) => mayUseWell(prisma, req, wellId);

  /** Load a job and check the caller may see its well. */
  async function loadJob(req: FastifyRequest, reply: FastifyReply, id: string) {
    const job = await prisma.job.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!job) { reply.code(404).send({ error: "not found" }); return null; }
    if (!(await mayUse(req, job.wellId))) { reply.code(403).send({ error: "not your well" }); return null; }
    return job;
  }

  // ══ code tables — the pick-lists behind the time-log coding ══════════════
  app.get("/entry/wellview/codes", { preHandler: requireUser }, async () => {
    const [mainOperations, operationDetails, matrix, timeIndicators, reportCodes, workingPhases] =
      await Promise.all([
        prisma.wvMainOperation.findMany({ orderBy: { order: "asc" } }),
        prisma.wvOperationDetail.findMany({ orderBy: { num: "asc" } }),
        prisma.wvMatrixCell.findMany({ orderBy: [{ letter: "asc" }, { detailNum: "asc" }] }),
        prisma.wvTimeIndicator.findMany({ orderBy: { order: "asc" } }),
        prisma.wvReportCode.findMany({ orderBy: { order: "asc" } }),
        prisma.wvWorkingPhase.findMany({ orderBy: { order: "asc" } }),
      ]);
    // The matrix goes over the wire as one letter → details map rather than 437
    // rows: the client only ever asks "is this pair marked" and "what may follow
    // this letter", and both are O(1) on the map.
    const validDetails: Record<string, number[]> = {};
    for (const cell of matrix) (validDetails[cell.letter] ??= []).push(cell.detailNum);
    return { mainOperations, operationDetails, validDetails, timeIndicators, reportCodes, workingPhases };
  });

  // ══ jobs ═════════════════════════════════════════════════════════════════
  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/jobs", { preHandler: requireUser }, async (req, reply) => {
      if (!(await mayUse(req, req.params.wellId))) return reply.code(403).send({ error: "not your well" });
      return prisma.job.findMany({
        where: { wellId: req.params.wellId },
        orderBy: { order: "asc" },
        include: {
          afes: { orderBy: { order: "asc" }, select: { id: true, afeNumber: true, order: true } },
          _count: { select: { phases: true, costItems: true, reports: true } },
        },
      });
    });

  app.post<{ Body: { wellId?: string; name?: string; category?: string } }>(
    "/entry/jobs", { preHandler: requireUser }, async (req, reply) => {
      try {
        const wellId = z.string().min(1).parse(req.body?.wellId);
        if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
        const last = await prisma.job.findFirst({
          where: { wellId }, orderBy: { order: "desc" }, select: { order: true },
        });
        const created = await prisma.job.create({
          data: {
            wellId,
            order: (last?.order ?? -1) + 1,
            name: req.body?.name?.trim() || null,
            category: req.body?.category?.trim() || null,
          },
          include: JOB_INCLUDE,
        });
        return reply.code(201).send(created);
      } catch (e) { return badReq(reply, e); }
    });

  app.get<{ Params: { id: string } }>("/entry/jobs/:id", { preHandler: requireUser }, async (req, reply) => {
    const job = await loadJob(req, reply, req.params.id);
    return job ?? undefined;
  });

  app.put<{ Params: { id: string }; Body: unknown }>(
    "/entry/jobs/:id", { preHandler: requireUser }, async (req, reply) => {
      const existing = await loadJob(req, reply, req.params.id);
      if (!existing) return undefined;

      let body: z.infer<typeof jobSaveSchema>;
      try { body = jobSaveSchema.parse(req.body); } catch (e) { return badReq(reply, e); }
      const { phases, afes, costItems, ...header } = body;
      const jobId = existing.id;

      // Ids the client is keeping. Anything stored under this job that is NOT in
      // these sets was removed in the editor and is deleted; everything else is
      // updated in place, so the phase / AFE-line ids a cost row points at stay
      // valid across the save.
      const keptPhaseIds = phases.map((p) => p.id).filter((x): x is string => !!x);
      const keptAfeIds = afes.map((a) => a.id).filter((x): x is string => !!x);
      const keptSuppIds = afes.flatMap((a) => a.supplements.map((s) => s.id)).filter((x): x is string => !!x);
      const keptLineIds = afes.flatMap((a) => a.lines.map((l) => l.id)).filter((x): x is string => !!x);
      const keptCostIds = costItems.map((c) => c.id).filter((x): x is string => !!x);

      await prisma.$transaction(async (tx) => {
        await tx.job.update({ where: { id: jobId }, data: header });

        // Cost rows first: they reference phases and AFE lines, and deleting a
        // phase only nulls the reference (SetNull) — it never takes the cost
        // with it, which is the whole point of that onDelete rule.
        await tx.costItem.deleteMany({ where: { jobId, id: { notIn: keptCostIds.length ? keptCostIds : ["-"] } } });
        await tx.jobPhase.deleteMany({ where: { jobId, id: { notIn: keptPhaseIds.length ? keptPhaseIds : ["-"] } } });
        await tx.afe.deleteMany({ where: { jobId, id: { notIn: keptAfeIds.length ? keptAfeIds : ["-"] } } });

        for (const p of phases) {
          const { id, plan, ...phaseData } = p;
          const saved = id
            ? await tx.jobPhase.upsert({
              where: { id },
              create: { id, jobId, ...phaseData },
              update: phaseData,
            })
            : await tx.jobPhase.create({ data: { jobId, ...phaseData } });
          // 1:1 — a blanked plan is removed rather than kept as an all-null row
          // that would print as a fabricated zero on report 10.
          if (plan) {
            await tx.jobPhasePlan.upsert({
              where: { jobPhaseId: saved.id },
              create: { jobPhaseId: saved.id, ...plan },
              update: plan,
            });
          } else {
            await tx.jobPhasePlan.deleteMany({ where: { jobPhaseId: saved.id } });
          }
        }

        for (const a of afes) {
          const { id, supplements, lines, ...afeData } = a;
          const saved = id
            ? await tx.afe.upsert({ where: { id }, create: { id, jobId, ...afeData }, update: afeData })
            : await tx.afe.create({ data: { jobId, ...afeData } });
          await tx.afeSupplement.deleteMany({
            where: { afeId: saved.id, id: { notIn: keptSuppIds.length ? keptSuppIds : ["-"] } },
          });
          await tx.afeLine.deleteMany({
            where: { afeId: saved.id, id: { notIn: keptLineIds.length ? keptLineIds : ["-"] } },
          });
          for (const s of supplements) {
            const { id: sid, ...data } = s;
            if (sid) await tx.afeSupplement.upsert({ where: { id: sid }, create: { id: sid, afeId: saved.id, ...data }, update: data });
            else await tx.afeSupplement.create({ data: { afeId: saved.id, ...data } });
          }
          for (const l of lines) {
            const { id: lid, ...data } = l;
            if (lid) await tx.afeLine.upsert({ where: { id: lid }, create: { id: lid, afeId: saved.id, ...data }, update: data });
            else await tx.afeLine.create({ data: { afeId: saved.id, ...data } });
          }
        }

        for (const c of costItems) {
          const { id, ...data } = c;
          if (id) await tx.costItem.upsert({ where: { id }, create: { id, jobId, ...data }, update: data });
          else await tx.costItem.create({ data: { jobId, ...data } });
        }
      });

      return prisma.job.findUnique({ where: { id: jobId }, include: JOB_INCLUDE });
    });

  app.delete<{ Params: { id: string } }>("/entry/jobs/:id", { preHandler: requireUser }, async (req, reply) => {
    const job = await loadJob(req, reply, req.params.id);
    if (!job) return undefined;
    await prisma.job.delete({ where: { id: job.id } });
    return reply.code(204).send();
  });

  /**
   * Attach a well's existing daily reports to a job.
   *
   * The bridge column ships null on every report that predates jobs, and there
   * is no safe SQL rule to guess an attribution — so it is an explicit action,
   * scoped to the days that are not already attached to some other job.
   */
  app.post<{ Params: { id: string } }>(
    "/entry/jobs/:id/attach-reports", { preHandler: requireUser }, async (req, reply) => {
      const job = await loadJob(req, reply, req.params.id);
      if (!job) return undefined;
      const { count } = await prisma.entryReport.updateMany({
        where: { wellId: job.wellId, jobId: null },
        data: { jobId: job.id },
      });
      return { attached: count };
    });

  // ══ well- and rig-level registers ════════════════════════════════════════
  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/registers", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      const well = await prisma.entryWell.findUnique({ where: { id: wellId }, select: { rigId: true } });
      if (!well) return reply.code(404).send({ error: "not found" });
      const [wellbores, bhaRuns, lessons, kicks, lostCirculation, mudPumps] = await Promise.all([
        prisma.entryWellbore.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
        prisma.entryBhaRun.findMany({
          where: { wellId }, orderBy: { bhaNo: "asc" },
          include: {
            sensors: { orderBy: { order: "asc" } },
            // The run's name lives on its day rows; the master is thin.
            drillStrings: { select: { name: true }, take: 1 },
          },
        }),
        prisma.entryIntervalLesson.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
        prisma.entryKick.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
        prisma.entryLostCirculation.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
        // The pumps belong to the RIG, not the well — served here so the well's
        // editor can show them without a second round trip.
        prisma.entryMudPump.findMany({ where: { rigId: well.rigId }, orderBy: { order: "asc" } }),
      ]);
      return {
        wellbores,
        bhaRuns: bhaRuns.map((r) => ({
          id: r.id, bhaNo: r.bhaNo, name: r.drillStrings[0]?.name ?? null,
          wellboreId: r.wellboreId, depthOutMkb: r.depthOutMkb,
          dateOut: r.dateOut, timeOut: r.timeOut, comment: r.comment,
          sensors: r.sensors.map((s) => ({
            order: s.order, sensorType: s.sensorType, distFromBitM: s.distFromBitM, note: s.note,
          })),
        })),
        lessons, kicks, lostCirculation, mudPumps, rigId: well.rigId,
      };
    });

  app.put<{ Params: { wellId: string }; Body: unknown }>(
    "/entry/wells/:wellId/registers", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      let body: z.infer<typeof registersSchema>;
      try { body = registersSchema.parse(req.body); } catch (e) { return badReq(reply, e); }

      const keptWellbores = body.wellbores.map((w) => w.id).filter((x): x is string => !!x);
      await prisma.$transaction(async (tx) => {
        // Wellbores keep their ids; the daily intervals reference them.
        await tx.entryWellbore.deleteMany({
          where: { wellId, id: { notIn: keptWellbores.length ? keptWellbores : ["-"] } },
        });
        for (const w of body.wellbores) {
          const { id, ...data } = w;
          if (id) await tx.entryWellbore.upsert({ where: { id }, create: { id, wellId, ...data }, update: data });
          else await tx.entryWellbore.create({ data: { wellId, ...data } });
        }
        // The registers have no inbound references — replace-all is safe and
        // keeps them behaving exactly like the daily tables.
        await tx.entryIntervalLesson.deleteMany({ where: { wellId } });
        await tx.entryKick.deleteMany({ where: { wellId } });
        await tx.entryLostCirculation.deleteMany({ where: { wellId } });
        if (body.lessons.length) await tx.entryIntervalLesson.createMany({ data: body.lessons.map((r) => ({ ...r, wellId })) });
        if (body.kicks.length) await tx.entryKick.createMany({ data: body.kicks.map((r) => ({ ...r, wellId })) });
        if (body.lostCirculation.length) await tx.entryLostCirculation.createMany({ data: body.lostCirculation.map((r) => ({ ...r, wellId })) });

        // The runs themselves come from the daily save; this only fills in the
        // facts that belong to the run as a whole. Scoped to this well so a
        // posted id cannot reach another one.
        for (const r of body.bhaRuns) {
          const { id, sensors, ...data } = r;
          const updated = await tx.entryBhaRun.updateMany({ where: { id, wellId }, data });
          if (!updated.count) continue;
          await tx.entryBhaSensor.deleteMany({ where: { bhaRunId: id } });
          if (sensors.length) {
            await tx.entryBhaSensor.createMany({ data: sensors.map((x) => ({ ...x, bhaRunId: id })) });
          }
        }
      });
      return reply.code(204).send();
    });

  app.put<{ Params: { rigId: string }; Body: unknown }>(
    "/entry/rigs/:rigId/mud-pumps", { preHandler: requireUser }, async (req, reply) => {
      const { rigId } = req.params;
      // A rig is reachable through any well the caller may use.
      const wells = await prisma.entryWell.findMany({ where: { rigId }, select: { id: true } });
      const allowed = await Promise.all(wells.map((w) => mayUse(req, w.id)));
      if (!allowed.some(Boolean)) return reply.code(403).send({ error: "not your rig" });

      let pumps: z.infer<typeof mudPumpSchema>[];
      try { pumps = z.object({ pumps: z.array(mudPumpSchema).default([]) }).parse(req.body).pumps; }
      catch (e) { return badReq(reply, e); }

      const kept = pumps.map((p) => p.id).filter((x): x is string => !!x);
      await prisma.$transaction(async (tx) => {
        // Id-stable: EntryScrRate rows point at these pumps.
        await tx.entryMudPump.deleteMany({ where: { rigId, id: { notIn: kept.length ? kept : ["-"] } } });
        for (const p of pumps) {
          const { id, ...data } = p;
          if (id) await tx.entryMudPump.upsert({ where: { id }, create: { id, rigId, ...data }, update: data });
          else await tx.entryMudPump.create({ data: { rigId, ...data } });
        }
      });
      return prisma.entryMudPump.findMany({ where: { rigId }, orderBy: { order: "asc" } });
    });

  /** The well's BHA runs, for report 02's picker. */
  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/bha-runs", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      const runs = await prisma.entryBhaRun.findMany({
        where: { wellId },
        orderBy: { bhaNo: "asc" },
        // The run's NAME lives on its day rows, not on the master — the master
        // is deliberately thin (see apps/api/src/reports/bha.ts).
        include: { drillStrings: { select: { name: true, depthInMkb: true }, take: 1 } },
      });
      return runs.map((r) => ({
        id: r.id,
        bhaNo: r.bhaNo,
        name: r.drillStrings[0]?.name ?? null,
        depthInMkb: r.drillStrings[0]?.depthInMkb ?? null,
        depthOutMkb: r.depthOutMkb,
      }));
    });

  /** The well's casing strings, for report 04's picker. */
  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/casing-strings", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      return prisma.casingString.findMany({
        where: { wellId }, orderBy: { order: "asc" },
        select: { id: true, description: true, setDepthMkb: true, runDate: true },
      });
    });

  // ══ casing, cement and hole sections (reports 04 / 05) ═══════════════════
  app.get<{ Params: { wellId: string } }>(
    "/entry/wells/:wellId/casing", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      const [holeSections, strings] = await Promise.all([
        prisma.holeSection.findMany({ where: { wellId }, orderBy: { order: "asc" } }),
        prisma.casingString.findMany({
          where: { wellId }, orderBy: { order: "asc" },
          include: {
            components: { orderBy: { order: "asc" } },
            cementJobs: {
              orderBy: { order: "asc" },
              include: {
                stages: {
                  orderBy: { order: "asc" },
                  include: {
                    fluids: {
                      orderBy: { order: "asc" },
                      include: { additives: { orderBy: { order: "asc" } } },
                    },
                  },
                },
              },
            },
          },
        }),
      ]);
      return { holeSections, strings };
    });

  app.put<{ Params: { wellId: string }; Body: unknown }>(
    "/entry/wells/:wellId/casing", { preHandler: requireUser }, async (req, reply) => {
      const { wellId } = req.params;
      if (!(await mayUse(req, wellId))) return reply.code(403).send({ error: "not your well" });
      let body: z.infer<typeof casingSaveSchema>;
      try { body = casingSaveSchema.parse(req.body); } catch (e) { return badReq(reply, e); }

      const kept = body.strings.map((s) => s.id).filter((x): x is string => !!x);
      await prisma.$transaction(async (tx) => {
        // Hole sections carry no inbound references — replace-all.
        await tx.holeSection.deleteMany({ where: { wellId } });
        if (body.holeSections.length) {
          await tx.holeSection.createMany({ data: body.holeSections.map((h) => ({ ...h, wellId })) });
        }

        await tx.casingString.deleteMany({
          where: { wellId, id: { notIn: kept.length ? kept : ["-"] } },
        });
        for (const s of body.strings) {
          const { id, components, cementJobs, ...data } = s;
          const stringId = id
            ? (await tx.casingString.upsert({
                where: { id }, create: { id, wellId, ...data }, update: data,
              })).id
            : (await tx.casingString.create({ data: { wellId, ...data } })).id;

          // The tally and the cement hang off the string and nothing hangs off
          // them, so within a string it is the daily editor's replace-all.
          await tx.casingComponent.deleteMany({ where: { casingStringId: stringId } });
          if (components.length) {
            await tx.casingComponent.createMany({
              data: components.map((c) => ({ ...c, jts: c.jts === null ? null : Math.round(c.jts), casingStringId: stringId })),
            });
          }
          await tx.cementJob.deleteMany({ where: { casingStringId: stringId } });
          for (const j of cementJobs) {
            const { stages, ...jobData } = j;
            const job = await tx.cementJob.create({ data: { casingStringId: stringId, ...jobData } });
            for (const st of stages) {
              const { fluids, ...stageData } = st;
              const stage = await tx.cementStage.create({ data: { cementJobId: job.id, ...stageData } });
              for (const f of fluids) {
                const { additives, ...fluidData } = f;
                const fluid = await tx.cementFluid.create({ data: { cementStageId: stage.id, ...fluidData } });
                if (additives.length) {
                  await tx.cementFluidAdditive.createMany({
                    data: additives.map((a) => ({ ...a, cementFluidId: fluid.id })),
                  });
                }
              }
            }
          }
        }
      });
      return reply.code(204).send();
    });

  // ══ cost codes (admin) ═══════════════════════════════════════════════════
  app.get("/entry/cost-codes", { preHandler: requireUser }, async () =>
    prisma.costCode.findMany({ orderBy: [{ code1: "asc" }, { code2: "asc" }] }));

  app.put<{ Body: unknown }>("/entry/cost-codes", { preHandler: requireAdmin }, async (req, reply) => {
    let rows: z.infer<typeof costCodeSchema>[];
    try {
      rows = z.object({ codes: z.array(costCodeSchema).default([]) }).parse(req.body).codes;
    } catch (e) { return badReq(reply, e); }

    // Drop the grid's spare blank rows before doing anything, the same way the
    // daily editor prunes — a row with no code and no description is not data.
    const filled = rows.filter((r) => r.code1 || r.code2 || r.description);
    const missing = filled.find((r) => !r.code1 || !r.code2 || !r.description);
    if (missing) {
      return reply.code(400).send({
        error: `every cost code needs a Code 1, a Code 2 and a description — check "${missing.code1 ?? ""}/${missing.code2 ?? ""}"`,
      });
    }
    const pairs = filled.map((r) => `${r.code1}/${r.code2}`);
    const dupe = pairs.find((p, i) => pairs.indexOf(p) !== i);
    if (dupe) return reply.code(409).send({ error: `cost code ${dupe} is listed twice` });

    const kept = filled.map((r) => r.id).filter((x): x is string => !!x);
    try {
      await prisma.$transaction(async (tx) => {
        // A code still referenced by an AFE line or a cost row is deactivated,
        // never deleted — the reports that print it must keep printing it.
        const removable = await tx.costCode.findMany({
          where: { id: { notIn: kept.length ? kept : ["-"] } },
          select: { id: true, _count: { select: { afeLines: true, costItems: true } } },
        });
        const orphan = removable.filter((c) => !c._count.afeLines && !c._count.costItems).map((c) => c.id);
        const inUse = removable.filter((c) => c._count.afeLines || c._count.costItems).map((c) => c.id);
        if (orphan.length) await tx.costCode.deleteMany({ where: { id: { in: orphan } } });
        if (inUse.length) await tx.costCode.updateMany({ where: { id: { in: inUse } }, data: { active: false } });
        for (const r of filled) {
          const data = {
            code1: r.code1!, code2: r.code2!, description: r.description!,
            projectScope: r.projectScope, active: r.active,
          };
          if (r.id) await tx.costCode.upsert({ where: { id: r.id }, create: { id: r.id, ...data }, update: data });
          else await tx.costCode.create({ data });
        }
      });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        return reply.code(409).send({ error: "two rows share the same Code 1 / Code 2 pair" });
      }
      return badReq(reply, e);
    }
    return prisma.costCode.findMany({ orderBy: [{ code1: "asc" }, { code2: "asc" }] });
  });
}
