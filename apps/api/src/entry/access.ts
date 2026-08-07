/**
 * Who may touch which well.
 *
 * An admin sees every well; a company man sees only the wells assigned to them.
 * This rule guards `/entry/reports/*` and now `/entry/jobs/*` and the report
 * assemblers too, so it lives here rather than inside one route module's
 * closure — a second copy would be a second place for the rule to drift.
 */
import type { FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";

/** The caller's well ids, or "all" for an admin. */
export async function allowedWellIds(
  prisma: PrismaClient,
  req: FastifyRequest,
): Promise<string[] | "all"> {
  if (req.entryUser!.role === "admin") return "all";
  const rows = await prisma.entryAssignment.findMany({
    where: { userId: req.entryUser!.sub },
    select: { wellId: true },
  });
  return rows.map((r) => r.wellId);
}

export async function mayUseWell(
  prisma: PrismaClient,
  req: FastifyRequest,
  wellId: string,
): Promise<boolean> {
  const ids = await allowedWellIds(prisma, req);
  return ids === "all" || ids.includes(wellId);
}

/** A Prisma `where` fragment scoping a query to the caller's wells. */
export async function wellScope(
  prisma: PrismaClient,
  req: FastifyRequest,
): Promise<{ id?: { in: string[] } }> {
  const ids = await allowedWellIds(prisma, req);
  return ids === "all" ? {} : { id: { in: ids } };
}
