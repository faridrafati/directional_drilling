import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { countryCreateSchema } from "@dd/shared/schemas";

export async function registerCountryRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/countries", async (req, reply) => {
    const body = countryCreateSchema.parse(req.body);
    const c = await prisma.country.create({ data: body });
    return reply.code(201).send(c);
  });

  app.put<{ Params: { id: string }; Body: { name?: string; area?: string } }>(
    "/countries/:id",
    async (req, reply) => {
      try {
        const c = await prisma.country.update({ where: { id: req.params.id }, data: req.body });
        return c;
      } catch {
        return reply.code(404).send({ error: "not found" });
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/countries/:id", async (req, reply) => {
    try {
      await prisma.country.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });
}
