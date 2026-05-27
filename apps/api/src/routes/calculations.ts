import type { FastifyInstance } from "fastify";
import type { PrismaClient, Segment as PrismaSegment, Prisma } from "@prisma/client";
import { calculationCreateSchema, segmentBulkReplaceSchema } from "@dd/shared/schemas";
import { dispatch } from "@dd/shared/math";
import type { Segment } from "@dd/shared";
import { z } from "zod";

const calculateBodySchema = z
  .object({
    azimuthChoice: z.union([z.literal(1), z.literal(2)]).optional(),
  })
  .optional();

/**
 * Compare a persisted Segment row against an incoming payload segment. Used
 * to figure out which orders changed during /segments PUT so we only invalidate
 * the stations/keypoints that are actually stale.
 *
 * `comment` and `surveyTools` are skipped — they're descriptive metadata that
 * don't affect the dispatcher's output, so changing them shouldn't blow away
 * computed values.
 */
type IncomingSegment = {
  order: number; profileType: number; milestoneRole?: string | null;
  md: number; inc: number; azm: number; tvd: number; vsec: number;
  ns: number; ew: number; dls: number; tf: number; br: number; tr: number; dmd: number;
};
function segmentEquals(a: PrismaSegment, b: IncomingSegment): boolean {
  if (a.profileType !== b.profileType) return false;
  if ((a.milestoneRole ?? null) !== (b.milestoneRole ?? null)) return false;
  const numFields = ["md","inc","azm","tvd","vsec","ns","ew","dls","tf","br","tr","dmd"] as const;
  for (const k of numFields) {
    if (Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > 1e-9) return false;
  }
  return true;
}

export async function registerCalculationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/calculations", async (req, reply) => {
    const body = calculationCreateSchema.parse(req.body);
    const c = await prisma.calculation.create({ data: body });
    return reply.code(201).send(c);
  });

  app.get<{ Params: { id: string } }>("/calculations/:id", async (req, reply) => {
    const c = await prisma.calculation.findUnique({
      where: { id: req.params.id },
      include: {
        segments: { orderBy: { order: "asc" } },
        stations: { orderBy: { order: "asc" } },
        keypoints: { orderBy: [{ segmentOrder: "asc" }, { roleIndex: "asc" }] },
        well: {
          include: {
            field: {
              include: {
                country: {
                  include: { project: { select: { id: true, name: true, units: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!c) return reply.code(404).send({ error: "not found" });
    return c;
  });

  app.delete<{ Params: { id: string } }>("/calculations/:id", async (req, reply) => {
    try {
      await prisma.calculation.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  /**
   * Replace all segments for a calculation in one transaction.
   *
   * Smart-diff stations + keypoints so that ADDING a row at the end doesn't
   * blank out every previously-calculated value:
   *
   *   1. Load the existing segments.
   *   2. Walk the new payload by `order`; find the SMALLEST order whose
   *      segment differs (changed/added) or was removed.
   *   3. Wipe stations + keypoints with `segmentOrder >= firstStaleOrder`.
   *      Rows before that order keep their last-Calculate values.
   *
   * Why "first changed order onwards" instead of just the changed row:
   * subsequent rows depend on the running world state at the end of the
   * previous row, so if row N changes, rows N+1..end are also stale.
   *
   * Special cases:
   *   - Pure append: existing orders all match, only new orders appear →
   *     firstStaleOrder = first new order → only new rows are blank.
   *   - Pure delete: an order is missing in the new payload →
   *     firstStaleOrder = that missing order → rows after it are wiped too
   *     (their world state depended on the deleted segment).
   *   - Edit-profile (renumbers everything from 0) → most orders' data
   *     differs → firstStaleOrder = the edit point → behaves like the old
   *     full-wipe but only from the edit onwards.
   */
  app.post<{ Params: { id: string } }>("/calculations/:id/segments", async (req, reply) => {
    const body = segmentBulkReplaceSchema.parse(req.body);
    const calcId = req.params.id;

    const existing = await prisma.segment.findMany({
      where: { calculationId: calcId },
      orderBy: { order: "asc" },
    });
    const existingByOrder = new Map(existing.map((s) => [s.order, s]));

    let firstStaleOrder = Number.POSITIVE_INFINITY;
    for (const newSeg of body.segments) {
      const old = existingByOrder.get(newSeg.order);
      if (!old || !segmentEquals(old, newSeg)) {
        firstStaleOrder = Math.min(firstStaleOrder, newSeg.order);
      }
    }
    const newOrders = new Set(body.segments.map((s) => s.order));
    for (const ord of existingByOrder.keys()) {
      if (!newOrders.has(ord)) {
        firstStaleOrder = Math.min(firstStaleOrder, ord);
      }
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.segment.deleteMany({ where: { calculationId: calcId } }),
    ];
    if (Number.isFinite(firstStaleOrder)) {
      ops.push(
        prisma.station.deleteMany({
          where: { calculationId: calcId, segmentOrder: { gte: firstStaleOrder } },
        }),
        prisma.keypoint.deleteMany({
          where: { calculationId: calcId, segmentOrder: { gte: firstStaleOrder } },
        }),
      );
    }
    ops.push(
      prisma.segment.createMany({
        data: body.segments.map((s) => ({ ...s, calculationId: calcId })),
      }),
    );
    await prisma.$transaction(ops);
    return reply.code(204).send();
  });

  /**
   * Run the trajectory builders for this calculation: read its segments,
   * dispatch them through the math package, and persist the resulting stations.
   */
  app.post<{ Params: { id: string } }>("/calculations/:id/calculate", async (req, reply) => {
    const calcId = req.params.id;
    const body = calculateBodySchema.parse(req.body ?? {});
    const calc = await prisma.calculation.findUnique({
      where: { id: calcId },
      include: { segments: { orderBy: { order: "asc" } } },
    });
    if (!calc) return reply.code(404).send({ error: "not found" });

    // Cast Prisma rows into the shared Segment shape (milestoneRole flows
    // through so the dispatcher can group rows of the same profile).
    const segments: Segment[] = calc.segments.map((s) => ({
      comment: s.comment ?? "",
      md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd, vsec: s.vsec,
      ns: s.ns, ew: s.ew, dls: s.dls, tf: s.tf, br: s.br, tr: s.tr, dmd: s.dmd,
      order: s.order, typ: s.profileType,
      milestoneRole: s.milestoneRole,
    }));

    const result = dispatch(segments, body?.azimuthChoice ? { azimuthChoice: body.azimuthChoice } : {});

    // Persist stations and keyPoints. Both are wiped on every Calculate so
    // the database matches the latest dispatch result exactly.
    //
    //   stations  – the dense path (every ~100ft for charting / 3D)
    //   keypoints – exact milestone values (KOP/EOC/Target) from each builder's
    //               analytic equations, indexed by segmentOrder + roleIndex.
    const kpRows = result.keypoints.flatMap((g) =>
      g.points.map((p, k) => ({
        calculationId: calcId,
        segmentOrder: g.segmentOrder,
        roleIndex: k,
        comment: p.comment,
        md: p.md, inc: p.inc, azm: p.azm, tvd: p.tvd, vsec: p.vsec,
        ns: p.ns, ew: p.ew, dls: p.dls, tf: p.tf, br: p.br, tr: p.tr, dmd: p.dmd,
      }))
    );
    await prisma.$transaction([
      prisma.station.deleteMany({ where: { calculationId: calcId } }),
      prisma.keypoint.deleteMany({ where: { calculationId: calcId } }),
      prisma.station.createMany({
        data: result.stations.map((s, idx) => ({
          calculationId: calcId,
          order: idx,
          segmentOrder: s.order,
          comment: s.comment, md: s.md, inc: s.inc, azm: s.azm, tvd: s.tvd, vsec: s.vsec,
          ns: s.ns, ew: s.ew, dls: s.dls, tf: s.tf, br: s.br, tr: s.tr, dmd: s.dmd,
        })),
      }),
      ...(kpRows.length > 0
        ? [prisma.keypoint.createMany({ data: kpRows })]
        : []),
    ]);

    return reply.send({
      ok: result.ok,
      stationCount: result.stations.length,
      errors: result.errors,
      // Per-group 2-azm ambiguity report (Pascal Form07). When non-empty
      // the client pops a modal letting the user pick branch 1 vs branch 2.
      azmCandidates: result.azmCandidates,
    });
  });
}
