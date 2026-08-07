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
import { registerEntryRoutes } from "./routes/entry.js";
import { seedAdmin } from "./entry/auth.js";
import { registerWellviewRoutes } from "./routes/wellview.js";
import { registerReportRoutes } from "./reports/index.js";
import { seedWellviewCodes } from "./wellview/codes.js";

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

  // Tolerate an empty application/json body (Fastify 400s on it by default).
  // Action endpoints like POST /entry/reports/:id/submit have nothing to send,
  // and fetch() still labels the request application/json.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      const text = (body as string).trim();
      if (!text) return done(null, {});
      try {
        done(null, JSON.parse(text));
      } catch {
        const err = Object.assign(new Error("invalid JSON body"), { statusCode: 400 });
        done(err, undefined);
      }
    }
  );

  app.get("/health", async () => ({ ok: true }));

  await registerProjectRoutes(app, prisma);
  await registerCountryRoutes(app, prisma);
  await registerFieldRoutes(app, prisma);
  await registerWellRoutes(app, prisma);
  await registerCalculationRoutes(app, prisma);
  await registerGridRoutes(app, prisma);
  // Prisma: the ROP-optimization endpoint blends in rig-entered drilling parameters.
  await registerDdrRoutes(app, prisma);
  await registerAirmudRoutes(app);
  // Rig-side report entry (the only authenticated part of the API).
  await registerEntryRoutes(app, prisma);
  // WellView report suite: the well-level job/AFE/cost entry API and the report
  // assemblers. Same entry token, same well-access rule as /entry/* above.
  await registerWellviewRoutes(app, prisma);
  await registerReportRoutes(app, prisma);
  await seedAdmin(prisma, (msg) => app.log.info(msg));
  // The WellView operation-code tables. Idempotent upserts, same bootstrap
  // pattern as the admin account — no separate seed step to forget.
  await seedWellviewCodes(prisma, (msg) => app.log.info(msg));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
