import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { projectCreateSchema, projectUpdateSchema } from "@dd/shared/schemas";
import { z } from "zod";

export async function registerProjectRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/projects", async () => {
    return prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, units: true, createdAt: true, updatedAt: true },
    });
  });

  app.get<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        countries: {
          include: {
            fields: {
              include: {
                wells: {
                  include: { calculations: true },
                },
                grids: { select: { id: true, name: true, filename: true } },
              },
            },
          },
        },
      },
    });
    if (!project) return reply.code(404).send({ error: "not found" });
    return project;
  });

  app.post("/projects", async (req, reply) => {
    const body = projectCreateSchema.parse(req.body);
    const project = await prisma.project.create({
      data: { name: body.name, units: JSON.stringify(body.units) },
    });
    return reply.code(201).send(project);
  });

  app.put<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    const body = projectUpdateSchema.parse(req.body);
    try {
      const project = await prisma.project.update({
        where: { id: req.params.id },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.units && { units: JSON.stringify(body.units) }),
        },
      });
      return project;
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  app.delete<{ Params: { id: string } }>("/projects/:id", async (req, reply) => {
    try {
      await prisma.project.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  /**
   * JSON-based import — bulk-create the Country / Field / Well / Calculation
   * tree for a project. Replaces what the .mdb importer would do (see
   * PHASE5_NOTES.md). The web UI converts CSVs into this shape client-side
   * with Papa Parse, then POSTs to here.
   *
   * Idempotent within a single call: clears every existing country in the
   * project first, then re-creates from the input. We intentionally don't
   * partial-merge — that lets users iterate on their CSVs without leaving
   * orphans behind.
   */
  app.post<{ Params: { id: string } }>("/projects/:id/import", async (req, reply) => {
    const body = importSchema.parse(req.body);
    const projectId = req.params.id;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return reply.code(404).send({ error: "project not found" });

    // Wipe existing children so re-imports don't pile up.
    await prisma.country.deleteMany({ where: { projectId } });

    let countries = 0, fields = 0, wells = 0, calculations = 0, segments = 0;
    for (const country of body.countries) {
      const c = await prisma.country.create({
        data: { projectId, name: country.name, area: country.area },
      });
      countries++;
      for (const field of country.fields ?? []) {
        const f = await prisma.field.create({
          data: {
            countryId: c.id, name: field.name,
            ns: field.ns, ew: field.ew, msl: field.msl,
          },
        });
        fields++;
        for (const well of field.wells ?? []) {
          const w = await prisma.well.create({
            data: {
              fieldId: f.id, name: well.name,
              ns: well.ns, ew: well.ew, msl: well.msl,
              wellType: well.wellType, tvd: well.tvd, md: well.md,
              comment: well.comment,
            },
          });
          wells++;
          for (const calc of well.calculations ?? []) {
            const cc = await prisma.calculation.create({
              data: { wellId: w.id, name: calc.name, type: calc.type },
            });
            calculations++;
            if (calc.segments && calc.segments.length > 0) {
              await prisma.segment.createMany({
                data: calc.segments.map((s) => ({ ...s, calculationId: cc.id })),
              });
              segments += calc.segments.length;
            }
          }
        }
      }
    }
    return reply.code(201).send({
      ok: true,
      counts: { countries, fields, wells, calculations, segments },
    });
  });
}

// ─── Import schema ────────────────────────────────────────────────────────
const importSegmentSchema = z.object({
  order: z.number().int(),
  profileType: z.number().int(),
  comment: z.string().nullable().optional(),
  md: z.number(), inc: z.number(), azm: z.number(), tvd: z.number(),
  vsec: z.number(), ns: z.number(), ew: z.number(),
  dls: z.number(), tf: z.number(), br: z.number(), tr: z.number(), dmd: z.number(),
  surveyTools: z.string().nullable().optional(),
});

const importCalculationSchema = z.object({
  name: z.string(),
  type: z.enum(["WellDesign", "SurveyEditor"]),
  segments: z.array(importSegmentSchema).optional(),
});

const importWellSchema = z.object({
  name: z.string(),
  ns: z.number().nullable().optional(),
  ew: z.number().nullable().optional(),
  msl: z.number().nullable().optional(),
  wellType: z.string().nullable().optional(),
  tvd: z.number().nullable().optional(),
  md: z.number().nullable().optional(),
  comment: z.string().nullable().optional(),
  calculations: z.array(importCalculationSchema).optional(),
});

const importFieldSchema = z.object({
  name: z.string(),
  ns: z.number().nullable().optional(),
  ew: z.number().nullable().optional(),
  msl: z.number().nullable().optional(),
  wells: z.array(importWellSchema).optional(),
});

const importCountrySchema = z.object({
  name: z.string(),
  area: z.string().nullable().optional(),
  fields: z.array(importFieldSchema).optional(),
});

const importSchema = z.object({
  countries: z.array(importCountrySchema),
});
