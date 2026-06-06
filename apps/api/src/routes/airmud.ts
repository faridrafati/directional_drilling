import type { FastifyInstance } from "fastify";
import { airmudAvailable, listAirmudSamples } from "../airmud/db.js";

/**
 * Air & Gas Drilling sample wells, read from the converted SQLite databases.
 * Returns [] when the (gitignored) sample DBs aren't present — the web page
 * then falls back to its built-in @dd/shared presets.
 */
export async function registerAirmudRoutes(app: FastifyInstance) {
  app.get("/airmud/samples", async () => (airmudAvailable() ? listAirmudSamples() : []));
}
