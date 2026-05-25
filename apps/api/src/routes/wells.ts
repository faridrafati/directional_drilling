import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { wellCreateSchema } from "@dd/shared/schemas";

export async function registerWellRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/wells", async (req, reply) => {
    const body = wellCreateSchema.parse(req.body);
    const w = await prisma.well.create({ data: body });
    return reply.code(201).send(w);
  });

  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/wells/:id",
    async (req, reply) => {
      try {
        const w = await prisma.well.update({ where: { id: req.params.id }, data: req.body });
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
