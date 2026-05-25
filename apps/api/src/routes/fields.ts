import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { fieldCreateSchema } from "@dd/shared/schemas";

export async function registerFieldRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.post("/fields", async (req, reply) => {
    const body = fieldCreateSchema.parse(req.body);
    const f = await prisma.field.create({ data: body });
    return reply.code(201).send(f);
  });

  /**
   * Wells in a field, each with its calculations + their station paths.
   * Used by the map well overlay (Form21.WELLDRAWING2D) and the 3D field
   * scene. We return only the columns the visualizations need to keep the
   * payload small for fields with many wells.
   */
  app.get<{ Params: { id: string } }>(
    "/fields/:id/wells-with-paths",
    async (req) => {
      const wells = await prisma.well.findMany({
        where: { fieldId: req.params.id },
        select: {
          id: true, name: true, ns: true, ew: true, msl: true, tvd: true, md: true,
          calculations: {
            select: {
              id: true, name: true, type: true,
              stations: {
                orderBy: { order: "asc" },
                select: { md: true, tvd: true, ns: true, ew: true, inc: true, azm: true },
              },
            },
          },
        },
      });
      return wells;
    }
  );

  app.put<{ Params: { id: string }; Body: Partial<{ name: string; ns: number; ew: number; msl: number }> }>(
    "/fields/:id",
    async (req, reply) => {
      try {
        const f = await prisma.field.update({ where: { id: req.params.id }, data: req.body });
        return f;
      } catch {
        return reply.code(404).send({ error: "not found" });
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/fields/:id", async (req, reply) => {
    try {
      await prisma.field.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });
}
