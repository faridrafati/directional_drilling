import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerCountryRoutes } from "./routes/countries.js";
import { registerFieldRoutes } from "./routes/fields.js";
import { registerWellRoutes } from "./routes/wells.js";
import { registerCalculationRoutes } from "./routes/calculations.js";
import { registerGridRoutes } from "./routes/grids.js";
import { registerDdrRoutes } from "./routes/ddr.js";
import { registerAirmudRoutes } from "./routes/airmud.js";

const prisma = new PrismaClient();

async function main() {
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });

  await app.register(cors, { origin: true });

  // Raw text body for .grd uploads (POST /fields/:id/grids).
  app.addContentTypeParser(
    "text/plain",
    { parseAs: "string" },
    (_req, body, done) => done(null, body)
  );

  app.get("/health", async () => ({ ok: true }));

  await registerProjectRoutes(app, prisma);
  await registerCountryRoutes(app, prisma);
  await registerFieldRoutes(app, prisma);
  await registerWellRoutes(app, prisma);
  await registerCalculationRoutes(app, prisma);
  await registerGridRoutes(app, prisma);
  await registerDdrRoutes(app);
  await registerAirmudRoutes(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
