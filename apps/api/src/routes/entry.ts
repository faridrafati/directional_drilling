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

/** Jalali (Shamsi) date as the legacy DBs store it: "1404/05/09". */
const jalali = z.string().regex(/^\d{3,4}\/\d{1,2}\/\d{1,2}$/, "date must be Jalali YYYY/MM/DD");

const bitRunSchema = z.object({
  order: int0, bitNo: str, bitSerialNo: str, size: str, type: str, iadcCode: str,
  nozzles: str, tfa: num, meterage: num, hours: num, wob: num, rpm: num, torque: str,
  dullGrade: str, reasonPulled: str, pumpType: str, pumpOutput: num, pumpPressure: num,
  annularVelocity: num, hsi: num, cmtDrilled: str, washAndRun: str,
  bitChangeIn: str, bitChangeOut: str,
});
const bhaSchema = z.object({ order: int0, assemblyNo: str, lengthM: num, specification: str });
const drillPipeSchema = z.object({ order: int0, size: str, grade: str, lengthM: num });
const toolSchema = z.object({ kind: z.enum(["jar", "mwd", "dhMotor"]), type: str, size: str, serialNo: str, hours: num });
const mudSchema = z.object({
  mudSystem: str, maxWeight: num, minWeight: num, reportTime: str, funnelVisc: num,
  pv: num, yp: num, gelInitial: num, gel10min: num, fan600: num, fan300: num,
  ph: num, alkalinity: num, waterLoss: num, hpht: num, airFoam: num, oilPct: num,
  oilWaterRatio: str, eStability: num, kcl: num, mbt: num, pf: num, mf: num,
  chloride: num, calcium: num, solidsPct: num, tempF: num,
}).nullable().default(null);
const solidControlSchema = z.object({
  unit: z.string().min(1), hours: num, underFlow: num, overFlow: num, feed: num, cons: num, fprs: num,
});
const chemicalSchema = z.object({
  order: int0, material: str, unit: str, used: num, received: num, stock: num,
  outstanding: num, requested: num, sent: num,
});
const casingSchema = z.object({ order: int0, casing: str, depth: num, joints: num });
const formationTopSchema = z.object({ order: int0, formation: str, depth: num, secondDepth: num, type: str });
const surveySchema = z.object({ order: int0, md: num, inc: num, azi: num, tvd: num, ns: num, ew: num, dls: num });
const timeSchema = z.object({ order: int0, group: str, type: str, activity: str, hours: num });
const operationSchema = z.object({ order: int0, opCode: str, fromTime: str, toTime: str, remarks: str });

/** The whole sheet, as the form posts it on save. */
const reportSaveSchema = z.object({
  morningDepth: num, midnightDepth: num, previousDepth: num, drillingTime: num,
  cumDrillingTime: num, holeSize: str, formation: str, lithology: str,
  lastCasing: str, linerLap: str, kop: str, wellSiteSupt: str, opnSupt: str,
  progEng: str, geologist: str, toolPusher1: str, toolPusher2: str,
  formationLoss: num, mudLossUnit: num, mudGains: num,
  description: str, windSpeedDir: str, waveVisible: str, freshWater: num, fuel: num,
  bitRuns: z.array(bitRunSchema).default([]),
  bha: z.array(bhaSchema).default([]),
  drillString: z.array(drillPipeSchema).default([]),
  tools: z.array(toolSchema).default([]),
  mud: mudSchema,
  solidControl: z.array(solidControlSchema).default([]),
  chemicals: z.array(chemicalSchema).default([]),
  casing: z.array(casingSchema).default([]),
  formationTops: z.array(formationTopSchema).default([]),
  surveys: z.array(surveySchema).default([]),
  timeBreakdown: z.array(timeSchema).default([]),
  operations: z.array(operationSchema).default([]),
});

const wellSchema = z.object({
  rigId: z.string().min(1), name: z.string().min(1), field: str, legacyWellCode: str,
  location: str, wellType: str, profile: str, reservoir: str, contractor: str,
  spudDate: str, rigReleasedDate: str, rtElevation: num, waterDepth: num,
  finalForecastDepth: num, forecastDays: num, active: z.boolean().default(true),
});

/** Every child relation, in the shape the detail endpoint returns. */
const REPORT_INCLUDE = {
  bitRuns: { orderBy: { order: "asc" } },
  bha: { orderBy: { order: "asc" } },
  drillString: { orderBy: { order: "asc" } },
  tools: true,
  mud: true,
  solidControl: true,
  chemicals: { orderBy: { order: "asc" } },
  casing: { orderBy: { order: "asc" } },
  formationTops: { orderBy: { order: "asc" } },
  surveys: { orderBy: { order: "asc" } },
  timeBreakdown: { orderBy: { order: "asc" } },
  operations: { orderBy: { order: "asc" } },
  well: { include: { rig: true } },
  user: { select: { id: true, username: true, fullName: true } },
} as const;

export async function registerEntryRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const badReq = (reply: FastifyReply, e: unknown) =>
    reply.code(400).send({ error: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String((e as Error)?.message ?? e) });

  const publicUser = { id: true, username: true, fullName: true, role: true, active: true, mustChangePassword: true, createdAt: true } as const;

  /** Wells this caller may touch — everything for an admin, assignments otherwise. */
  async function allowedWellIds(req: FastifyRequest): Promise<string[] | "all"> {
    if (req.entryUser!.role === "admin") return "all";
    const rows = await prisma.entryAssignment.findMany({
      where: { userId: req.entryUser!.sub }, select: { wellId: true },
    });
    return rows.map((r) => r.wellId);
  }
  async function mayUseWell(req: FastifyRequest, wellId: string): Promise<boolean> {
    const ids = await allowedWellIds(req);
    return ids === "all" || ids.includes(wellId);
  }

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

      const { bitRuns, bha, drillString, tools, mud, solidControl, chemicals,
        casing, formationTops, surveys, timeBreakdown, operations, ...header } = body;
      const id = existing.id;

      // Replace-all: the form always posts the complete sheet.
      await prisma.$transaction([
        prisma.entryReport.update({ where: { id }, data: header }),
        prisma.entryBitRun.deleteMany({ where: { reportId: id } }),
        prisma.entryBhaItem.deleteMany({ where: { reportId: id } }),
        prisma.entryDrillPipe.deleteMany({ where: { reportId: id } }),
        prisma.entryTool.deleteMany({ where: { reportId: id } }),
        prisma.entryMud.deleteMany({ where: { reportId: id } }),
        prisma.entrySolidControl.deleteMany({ where: { reportId: id } }),
        prisma.entryChemical.deleteMany({ where: { reportId: id } }),
        prisma.entryCasingRun.deleteMany({ where: { reportId: id } }),
        prisma.entryFormationTop.deleteMany({ where: { reportId: id } }),
        prisma.entrySurvey.deleteMany({ where: { reportId: id } }),
        prisma.entryTimeEntry.deleteMany({ where: { reportId: id } }),
        prisma.entryOperation.deleteMany({ where: { reportId: id } }),
        prisma.entryBitRun.createMany({ data: bitRuns.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryBhaItem.createMany({ data: bha.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryDrillPipe.createMany({ data: drillString.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryTool.createMany({ data: tools.map((r) => ({ ...r, reportId: id })) }),
        ...(mud ? [prisma.entryMud.create({ data: { ...mud, reportId: id } })] : []),
        prisma.entrySolidControl.createMany({ data: solidControl.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryChemical.createMany({ data: chemicals.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryCasingRun.createMany({ data: casing.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryFormationTop.createMany({ data: formationTops.map((r) => ({ ...r, reportId: id })) }),
        prisma.entrySurvey.createMany({ data: surveys.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryTimeEntry.createMany({ data: timeBreakdown.map((r) => ({ ...r, reportId: id })) }),
        prisma.entryOperation.createMany({ data: operations.map((r) => ({ ...r, reportId: id })) }),
      ]);
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
