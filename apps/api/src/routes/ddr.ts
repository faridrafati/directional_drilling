import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ddrAvailable, listWells, listReports, getReport, getWell, getAnalytics,
  getFormationMatrix, getLithologyTable, getLithologyGraph, getMudProperties, type FormationMatrixFilters,
  getMudStock, type MudStockFilters,
  getWellPath, type WellPathFilters,
  getTimeAnalysis, type TimeAnalysisFilters,
  getTools, type ToolsFilters,
  readLithoPattern, listSearchGroups, searchOperations, searchOptions, type OpsSearchFilters,
  createSearchGroup, updateSearchGroup, deleteSearchGroup, renameCategory, deleteCategory,
  type SavedGroupInput,
} from "../ddr/db.js";

/**
 * DDR (Daily Drilling Report) read-only routes over the legacy SQLite DBs.
 * Returns 503 when the (gitignored) databases aren't present on this machine.
 */
export async function registerDdrRoutes(app: FastifyInstance) {
  const unavailable = (reply: FastifyReply) =>
    reply.code(503).send({ error: "DDR database not found on this machine" });

  app.get("/ddr/status", async () => ({ available: ddrAvailable() }));

  app.get("/ddr/search-groups", async (_req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return listSearchGroups();
  });

  // Create / modify / delete the user's own saved searches (DB.sqlite FIELDDATA).
  const badReq = (reply: FastifyReply, e: unknown) => reply.code(400).send({ error: String((e as Error)?.message ?? e) });
  app.post<{ Body: SavedGroupInput }>("/ddr/search-groups", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    try { return createSearchGroup(req.body ?? ({} as SavedGroupInput)); } catch (e) { return badReq(reply, e); }
  });
  app.put<{ Body: SavedGroupInput & { originalName: string } }>("/ddr/search-groups", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    try { return updateSearchGroup(req.body?.originalName, req.body); } catch (e) { return badReq(reply, e); }
  });
  app.delete<{ Params: { name: string } }>("/ddr/search-groups/:name", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    try { return deleteSearchGroup(decodeURIComponent(req.params.name)); } catch (e) { return badReq(reply, e); }
  });

  // Category headers: rename (moves every item under it) / delete (removes them all).
  app.put<{ Body: { oldName: string; newName: string } }>("/ddr/search-groups/category", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    try { return renameCategory(req.body?.oldName, req.body?.newName); } catch (e) { return badReq(reply, e); }
  });
  app.delete<{ Params: { name: string } }>("/ddr/search-groups/category/:name", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    try { return deleteCategory(decodeURIComponent(req.params.name)); } catch (e) { return badReq(reply, e); }
  });

  app.get("/ddr/search-options", async (_req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return searchOptions();
  });

  app.post<{ Body: OpsSearchFilters }>("/ddr/operations/search", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return searchOperations(req.body ?? {});
  });

  app.get("/ddr/wells", async (_req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return listWells();
  });

  app.get<{ Params: { wellCode: string } }>("/ddr/wells/:wellCode", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    const well = getWell(decodeURIComponent(req.params.wellCode));
    if (!well) return reply.code(404).send({ error: "well not found" });
    return well;
  });

  app.get<{ Params: { wellCode: string } }>("/ddr/wells/:wellCode/reports", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return listReports(decodeURIComponent(req.params.wellCode));
  });

  app.get<{ Params: { wellCode: string } }>("/ddr/wells/:wellCode/analytics", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getAnalytics(decodeURIComponent(req.params.wellCode));
  });

  app.post<{ Body: FormationMatrixFilters }>("/ddr/formation-matrix", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getFormationMatrix(req.body ?? {});
  });
  app.post<{ Body: FormationMatrixFilters }>("/ddr/lithology-table", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getLithologyTable(req.body ?? {});
  });
  app.post<{ Body: FormationMatrixFilters }>("/ddr/lithology-graph", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getLithologyGraph(req.body ?? {});
  });
  app.post<{ Body: FormationMatrixFilters }>("/ddr/mud-properties", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudProperties(req.body ?? {});
  });
  app.post<{ Body: MudStockFilters }>("/ddr/mud-stock", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudStock(req.body ?? {});
  });
  app.post<{ Body: WellPathFilters }>("/ddr/well-path", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getWellPath(req.body ?? {});
  });
  app.post<{ Body: TimeAnalysisFilters }>("/ddr/time-analysis", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getTimeAnalysis(req.body ?? {});
  });
  app.post<{ Body: ToolsFilters }>("/ddr/tools", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getTools(req.body ?? {});
  });

  // Lithology pattern tile (LITHO/<name>.bmp) for the stratigraphic column.
  app.get<{ Params: { name: string } }>("/ddr/litho-pattern/:name", async (req, reply) => {
    const buf = readLithoPattern(req.params.name);
    if (!buf) return reply.code(404).send({ error: "pattern not found" });
    return reply.type("image/bmp").header("Cache-Control", "public, max-age=86400").send(buf);
  });

  app.get<{ Params: { wellCode: string; serialNo: string } }>(
    "/ddr/reports/:wellCode/:serialNo",
    async (req, reply) => {
      if (!ddrAvailable()) return unavailable(reply);
      const report = getReport(decodeURIComponent(req.params.wellCode), Number(req.params.serialNo));
      if (!report) return reply.code(404).send({ error: "report not found" });
      return report;
    },
  );
}
