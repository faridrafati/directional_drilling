import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { wellCreateSchema } from "@dd/shared/schemas";

export async function registerWellRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/wells", async (req, reply) => {
    const body = wellCreateSchema.parse(req.body);
    const w = await prisma.well.create({ data: body });
    return reply.code(201).send(w);
  });

  app.put<{
    Params: { id: string };
    Body: Partial<{ name: string; ns: number; ew: number; tvd: number; fieldId: string }>;
  }>(
    "/wells/:id",
    async (req, reply) => {
      try {
        // Whitelist fields. `fieldId` lets the sidebar tree move a well
        // to a different field ("change sub items branch").
        const { name, ns, ew, tvd, fieldId } = req.body;
        const data: { name?: string; ns?: number; ew?: number; tvd?: number; fieldId?: string } = {};
        if (name    !== undefined) data.name = name;
        if (ns      !== undefined) data.ns = ns;
        if (ew      !== undefined) data.ew = ew;
        if (tvd     !== undefined) data.tvd = tvd;
        if (fieldId !== undefined) data.fieldId = fieldId;
        const w = await prisma.well.update({ where: { id: req.params.id }, data });
        return w;
      } catch {
        return reply.code(404).send({ error: "not found" });
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/wells/:id", async (req, reply) => {
    try {
      await prisma.well.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });
}
