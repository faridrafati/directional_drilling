import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { parseGrd, gridToBytes, gridFromBytes, gridRange, type GrdFile } from "@dd/grd";
import { volumeBetween } from "@dd/grd/volume";
import { z } from "zod";

export async function registerGridRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // List grids for a field.
  app.get<{ Params: { fieldId: string } }>(
    "/fields/:fieldId/grids",
    async (req) => {
      return prisma.gridFile.findMany({
        where: { fieldId: req.params.fieldId },
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, filename: true,
          xmin: true, xmax: true, ymin: true, ymax: true,
          xinc: true, yinc: true, ncol: true, nrow: true,
          units: true, errorVal: true,
        },
      });
    }
  );

  // Upload a .grd: accepts the file as a raw text body (Content-Type: text/plain).
  // Multipart support also works via @fastify/multipart but text/plain is simpler
  // and fits the small grid sizes we typically deal with.
  app.post<{
    Params: { fieldId: string };
    Querystring: { name?: string; filename?: string };
    Body: string;
  }>(
    "/fields/:fieldId/grids",
    { bodyLimit: 50 * 1024 * 1024 },
    async (req, reply) => {
      const text = typeof req.body === "string" ? req.body : String(req.body ?? "");
      if (!text) return reply.code(400).send({ error: "empty body" });
      let grid: GrdFile;
      try {
        grid = parseGrd(text);
      } catch (e) {
        return reply.code(400).send({ error: "parse error", message: String(e) });
      }
      const bytes = Buffer.from(gridToBytes(grid));
      const name = req.query.name ?? req.query.filename ?? "grid";
      const filename = req.query.filename ?? `${name}.grd`;
      const row = await prisma.gridFile.create({
        data: {
          fieldId: req.params.fieldId,
          name, filename,
          xmin: grid.xmin, xmax: grid.xmax,
          ymin: grid.ymin, ymax: grid.ymax,
          xinc: grid.xinc, yinc: grid.yinc,
          ncol: grid.ncol, nrow: grid.nrow,
          units: grid.units,
          errorVal: grid.errorValue,
          data: bytes,
        },
        select: {
          id: true, name: true, filename: true,
          xmin: true, xmax: true, ymin: true, ymax: true,
          xinc: true, yinc: true, ncol: true, nrow: true,
          units: true, errorVal: true,
        },
      });
      const { min, max } = gridRange(grid);
      return reply.code(201).send({ ...row, valueMin: min, valueMax: max });
    }
  );

  // Get grid data (raw Float32Array bytes as base64) + metadata.
  app.get<{ Params: { id: string } }>("/grids/:id", async (req, reply) => {
    const row = await prisma.gridFile.findUnique({ where: { id: req.params.id } });
    if (!row) return reply.code(404).send({ error: "not found" });
    const grid = gridFromBytes(
      {
        errorValue: row.errorVal, xmin: row.xmin, xmax: row.xmax, ymin: row.ymin, ymax: row.ymax,
        xinc: row.xinc, yinc: row.yinc, ncol: row.ncol, nrow: row.nrow,
        units: row.units as GrdFile["units"],
      },
      new Uint8Array(row.data)
    );
    const { min, max } = gridRange(grid);
    return {
      id: row.id, name: row.name, filename: row.filename,
      xmin: row.xmin, xmax: row.xmax, ymin: row.ymin, ymax: row.ymax,
      xinc: row.xinc, yinc: row.yinc, ncol: row.ncol, nrow: row.nrow,
      units: row.units, errorVal: row.errorVal,
      valueMin: min, valueMax: max,
      data: Buffer.from(row.data).toString("base64"),
    };
  });

  app.delete<{ Params: { id: string } }>("/grids/:id", async (req, reply) => {
    try {
      await prisma.gridFile.delete({ where: { id: req.params.id } });
      return reply.code(204).send();
    } catch {
      return reply.code(404).send({ error: "not found" });
    }
  });

  // Volume between two horizons.
  const volumeBodySchema = z.object({
    bottomId: z.string(),
    topId: z.string(),
    method: z.enum(["sum", "simpson"]).default("sum"),
  });

  app.post("/grids/volume", async (req, reply) => {
    const body = volumeBodySchema.parse(req.body);
    const [bot, top] = await Promise.all([
      prisma.gridFile.findUnique({ where: { id: body.bottomId } }),
      prisma.gridFile.findUnique({ where: { id: body.topId } }),
    ]);
    if (!bot || !top) return reply.code(404).send({ error: "grid not found" });
    const bg = gridFromBytes(
      { errorValue: bot.errorVal, xmin: bot.xmin, xmax: bot.xmax, ymin: bot.ymin, ymax: bot.ymax,
        xinc: bot.xinc, yinc: bot.yinc, ncol: bot.ncol, nrow: bot.nrow, units: bot.units as GrdFile["units"] },
      new Uint8Array(bot.data)
    );
    const tg = gridFromBytes(
      { errorValue: top.errorVal, xmin: top.xmin, xmax: top.xmax, ymin: top.ymin, ymax: top.ymax,
        xinc: top.xinc, yinc: top.yinc, ncol: top.ncol, nrow: top.nrow, units: top.units as GrdFile["units"] },
      new Uint8Array(top.data)
    );
    try {
      const result = volumeBetween(bg, tg, body.method);
      return { ...result, units: `${bot.units}³` };
    } catch (e) {
      return reply.code(400).send({ error: String(e) });
    }
  });
}
