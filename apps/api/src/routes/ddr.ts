import type { FastifyInstance, FastifyReply } from "fastify";
import type { PrismaClient } from "@prisma/client";
// Same classifier the archive path uses, so an entered bit lands in the same
// PDC / roller series as its L05 equivalent.
import { bitClass } from "@dd/shared/drilling";
import {
  ddrAvailable, listWells, listReports, getReport, getWell, getAnalytics,
  getFormationMatrix, getLithologyTable, getLithologyGraph, getMudProperties, type FormationMatrixFilters,
  getFormationPrognosis, type FormationPrognosisFilters,
  getMudStock, type MudStockFilters,
  getMudPlanning, type MudPlanningFilters,
  getMudProgram, type MudProgramFilters,
  getWellPath, getWellPathOptions, type WellPathFilters,
  getTimeAnalysis, type TimeAnalysisFilters,
  getTools, type ToolsFilters,
  getRopOptimization, type RopOptimizationFilters,
  readLithoPattern, listSearchGroups, searchOperations, searchOptions, getFacetOptions, type OpsSearchFilters,
  createSearchGroup, updateSearchGroup, deleteSearchGroup, renameCategory, deleteCategory,
  type SavedGroupInput,
} from "../ddr/db.js";

/**
 * DDR (Daily Drilling Report) read-only routes over the legacy SQLite DBs.
 * Returns 503 when the (gitignored) databases aren't present on this machine.
 *
 * Exception: the ROP-optimization endpoint also serves operating points entered
 * on the rig (Entry* models in the app's own SQLite), which exist independently
 * of the legacy archive — see enteredRopPoints below.
 */
export async function registerDdrRoutes(app: FastifyInstance, prisma: PrismaClient) {
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

  // Facet value lists scoped to the selected fields/wells (bit sizes, mud types,
  // materials, activity types). Null lists when nothing is selected → UI falls
  // back to the global search-options lists.
  app.post<{ Body: { fields?: string[]; wells?: string[] } }>("/ddr/facet-options", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getFacetOptions(req.body ?? {});
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
  app.post<{ Body: FormationPrognosisFilters }>("/ddr/formation-prognosis", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getFormationPrognosis(req.body ?? {});
  });
  app.post<{ Body: FormationMatrixFilters }>("/ddr/mud-properties", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudProperties(req.body ?? {});
  });
  app.post<{ Body: MudStockFilters }>("/ddr/mud-stock", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudStock(req.body ?? {});
  });
  app.post<{ Body: MudPlanningFilters }>("/ddr/mud-planning", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudPlanning(req.body ?? {});
  });
  app.post<{ Body: MudProgramFilters }>("/ddr/mud-program", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getMudProgram(req.body ?? {});
  });
  app.post<{ Body: WellPathFilters }>("/ddr/well-path", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getWellPath(req.body ?? {});
  });
  app.get("/ddr/well-path-options", async (_req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getWellPathOptions();
  });
  app.post<{ Body: TimeAnalysisFilters }>("/ddr/time-analysis", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getTimeAnalysis(req.body ?? {});
  });
  app.post<{ Body: ToolsFilters }>("/ddr/tools", async (req, reply) => {
    if (!ddrAvailable()) return unavailable(reply);
    return getTools(req.body ?? {});
  });
  // Legacy bit records (L05) + the drilling parameters typed on the rig. The
  // entered points live in this API's own DB, so they're still returned when the
  // legacy archive is absent — only a selection with NEITHER source 503s.
  app.post<{ Body: RopOptimizationFilters }>("/ddr/rop-optimization", async (req, reply) => {
    const f = req.body ?? {};
    const entered = await enteredRopPoints(prisma, f);

    if (!ddrAvailable()) {
      if (!entered.length) return unavailable(reply);
      return {
        points: entered,
        bitSizes: sortBitSizes(entered.map((p) => String(p.bitSize))),
        truncated: false, total: entered.length,
        note: `Legacy DDR database not on this machine — showing ${entered.length} operating point${entered.length === 1 ? "" : "s"} entered on the rig.`,
      };
    }

    const legacy = getRopOptimization(f);
    // Tag the archive points in place (no copy of a 20k array); consumers that
    // don't know about `source` are unaffected.
    const legacyPoints = (legacy.points as Record<string, unknown>[] | undefined) ?? [];
    for (const p of legacyPoints) p.source = "legacy";
    if (!entered.length) return legacy;

    const legacySizes = (legacy.bitSizes as string[] | undefined) ?? [];
    const legacyTotal = typeof legacy.total === "number" ? legacy.total : legacyPoints.length;
    const legacyNote = typeof legacy.note === "string" && legacy.note ? legacy.note : null;
    return {
      ...legacy,
      points: [...legacyPoints, ...entered],
      bitSizes: sortBitSizes([...legacySizes, ...entered.map((p) => String(p.bitSize))]),
      total: legacyTotal + entered.length,
      // Only carry a note when there is something to say — the viewer shows the
      // note INSTEAD of the record counts.
      ...(legacyNote
        ? { note: `${legacyNote} Plus ${entered.length} point${entered.length === 1 ? "" : "s"} entered on the rig.` }
        : {}),
    };
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

// ── Entered operating points for the ROP-Optimization tab ────────────────────
// The rig types one drilling-parameter row per drilled interval (a finer
// granularity than a bit record), so each row with WOB + RPM + interval ROP is a
// usable operating point for the same WOB×RPM→ROP analysis. They're appended to
// the legacy scatter, tagged `source: "entered"`, and carry only the fields they
// really have — bit identity / MSE / hydraulics stay null, which keeps them out
// of the IADC economics & advisor rollups (those skip points without an IADC).

const txt = (v: unknown): string => String(v ?? "").trim();
const lc = (v: unknown): string => txt(v).toLowerCase();
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Sidetrack family key. The legacy side runs every picked well through
 * expandSidetracks() (ddr/db.ts), which groups A01 codes by the base left after
 * stripping the trailing Leg/ST suffixes — so AB-011, AB-011Leg1 and AB-011ST1
 * are ONE physical well. Matching EntryWell.legacyWellCode exactly would drop
 * every rig sheet filed against a sidetrack of the picked well.
 *
 * Same rule, applied by base instead of by A01 lookup: the entered points must
 * still resolve when the legacy archive isn't on this machine (the /ddr/rop-
 * optimization route serves them with no DDR database at all), and comparing
 * bases is exactly what family membership means. `|| c` mirrors wellFamilies()'
 * guard for a code that is nothing but a suffix.
 */
const wellFamilyKey = (v: unknown): string => {
  const c = lc(v);
  return c.replace(/(?:(?:leg|st)\d+)+$/i, "") || c;
};

// Hole/bit-size normalisation — a local mirror of ddr/db.ts's (private) one, so
// an entered "12 1/4" lands on the same `12-1/4"` series as the archive points.
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function sizeValue(raw: unknown): number | null {
  const t = txt(raw).replace(/[^0-9./ -]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = t.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/);   // 12 1/4 | 12-1/4
  if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);                  // 1/4
  if (m) return +m[1] / +m[2];
  m = t.match(/^(\d+(?:\.\d+)?)$/);                     // 26 | 8.5
  if (m) return +m[1];
  return null;
}
function normSize(raw: unknown): string {
  const v = sizeValue(raw);
  if (v == null) return txt(raw);
  const whole = Math.floor(v + 1e-9);
  let n = Math.round((v - whole) * 32);
  if (n >= 32) return `${whole + 1}"`;
  if (n === 0) return `${whole}"`;
  let d = 32;
  const g = gcd(n, d); n /= g; d /= g;
  return `${whole}-${n}/${d}"`;
}
/** Dedupe + order bit sizes largest-first, as getRopOptimization does. */
function sortBitSizes(sizes: string[]): string[] {
  return [...new Set(sizes.filter(Boolean))]
    .sort((a, b) => (sizeValue(b) ?? -1) - (sizeValue(a) ?? -1) || a.localeCompare(b));
}

async function enteredRopPoints(
  prisma: PrismaClient,
  f: RopOptimizationFilters,
): Promise<Record<string, unknown>[]> {
  const clean = (a?: string[]) => (a ?? []).map(lc).filter(Boolean);
  const wells = new Set(clean(f.wells));      // legacy well codes
  // Compared by sidetrack family, not literally — see wellFamilyKey.
  const wellKeys = new Set([...wells].map(wellFamilyKey));
  const fields = new Set(clean(f.fields));
  // "Nothing selected" must mean the same thing on both sides. resolveWellSet()
  // resolves a well set from mud types too, so bailing on well/field alone would
  // return the archive half of a mud-only selection and none of the rig half.
  // With only mud types picked, every entered well is in scope and the mud filter
  // below does the narrowing.
  const mudPicked = clean(f.mudTypes).length > 0;
  if (!wells.size && !fields.size && !mudPicked) return [];

  // Case-insensitive matching over the (small) entered-well table — SQLite has
  // no case-insensitive `in`, so the intersection is done here.
  const entryWells = await prisma.entryWell.findMany({
    where: { active: true },
    select: { id: true, name: true, field: true, legacyWellCode: true },
  });
  const matched = entryWells.filter((w) =>
    (!wellKeys.size || wellKeys.has(wellFamilyKey(w.legacyWellCode))) &&
    (!fields.size || fields.has(lc(w.field))));
  if (!matched.length) return [];

  const sizeFilter = new Set((f.holeSizes ?? []).map((x) => normSize(x)).filter(Boolean));
  const dateFrom = txt(f.dateFrom), dateTo = txt(f.dateTo);
  // Every facet the sidebar sends has to gate BOTH sources. Filtering only the
  // archive would append unfiltered rig rows into the same arrays that feed
  // screenOutliers(), buildGrid()/bestCell() and the KPIs — i.e. the "Optimal
  // window" would be recommended off data the user had filtered out.
  const formationFilter = new Set(clean(f.formations));
  const mudFilter = new Set(clean(f.mudTypes));
  // Treat undefined / null / "" as "not set" — Number("") is 0 (finite), and the
  // sidebar posts "" for an empty box, which would otherwise turn an absent
  // filter into a bogus [0,0] window and drop every entered interval on the
  // default query. Same coercion as depthFormationGate() in ddr/db.ts.
  const numOrNaN = (v: unknown) => (v === undefined || v === null || String(v).trim() === "" ? NaN : Number(v));
  const depthFrom = numOrNaN(f.depthFrom), depthTo = numOrNaN(f.depthTo);
  const hasDepthWindow = Number.isFinite(depthFrom) || Number.isFinite(depthTo);
  const reports = await prisma.entryReport.findMany({
    where: {
      wellId: { in: matched.map((w) => w.id) },
      // Only sheets the company man has signed off: a draft is half-typed by
      // definition, and the office side treats "submitted" as fit to analyse.
      status: "submitted",
      // Jalali "YYYY/MM/DD" sorts lexicographically, exactly as the legacy query filters.
      ...(dateFrom ? { reportDate: { gte: dateFrom } } : {}),
      ...(dateTo ? { reportDate: { lte: dateTo } } : {}),
    },
    select: {
      wellId: true, reportDate: true, holeSize: true, formation: true,
      drillingParameters: {
        select: {
          order: true, startMkb: true, endDepthMkb: true, intRopMHr: true, rpm: true,
          wob1000Lbf: true,
          // Needed as the DENOMINATOR of the footage/hours rollups — see below.
          drillTimeHr: true,
        },
        orderBy: { order: "asc" },
      },
      bitRuns: { select: { size: true, type: true, iadcCode: true }, orderBy: { order: "asc" }, take: 1 },
      mud: { select: { mudSystem: true } },
    },
  });

  const wellById = new Map(matched.map((w) => [w.id, w]));
  const out: Record<string, unknown>[] = [];
  for (const r of reports) {
    if (!r.drillingParameters.length) continue;
    const w = wellById.get(r.wellId);
    if (!w) continue;
    const rawSize = txt(r.holeSize) || txt(r.bitRuns[0]?.size);
    const bitSize = rawSize ? (normSize(rawSize) || rawSize) : "—";
    if (sizeFilter.size && !sizeFilter.has(bitSize)) continue;
    if (mudFilter.size && !mudFilter.has(lc(r.mud?.mudSystem))) continue;
    // The rig types the formation free-hand ("GACHSARAN") where the archive
    // resolves a D07 lookup ("Gachsaran"). The FILTER folds case here; the
    // by-formation rollup folds it again on the client (aggregateByFormation),
    // which is what keeps the two spellings from splitting into two rows.
    // The value itself is emitted as typed.
    const formation = txt(r.formation) || null;
    if (formationFilter.size && !formationFilter.has(lc(formation))) continue;
    // Bit-class evidence for this report's day: only the classifier's real
    // inputs count. No bit run, or a run with neither field filled in, ⇒ null.
    const iadcCode = txt(r.bitRuns[0]?.iadcCode), bitType = txt(r.bitRuns[0]?.type);
    const cls = iadcCode || bitType ? bitClass({ iadc: iadcCode, type: bitType }) : null;
    for (const d of r.drillingParameters) {
      const wob = num(d.wob1000Lbf), rpm = num(d.rpm), rop = num(d.intRopMHr);
      // A contour point needs all three axes; same magnitude guard as the archive.
      if (wob == null || rpm == null || rop == null) continue;
      if (wob <= 0 || rpm <= 0 || rop <= 0) continue;
      if (wob > 200 || rpm > 600 || rop > 500) continue;
      // Depth window: the interval must overlap it, mirroring the archive's
      // per-record gate on the bit's measured depth.
      if (hasDepthWindow) {
        const lo = num(d.startMkb), hi = num(d.endDepthMkb) ?? lo;
        if (lo == null) continue;                                   // no depth to judge
        if (Number.isFinite(depthTo) && lo > depthTo) continue;
        if (Number.isFinite(depthFrom) && (hi ?? lo) < depthFrom) continue;
      }
      out.push({
        wob: Number(wob.toFixed(1)), rpm: Number(rpm.toFixed(0)), rop: Number(rop.toFixed(2)),
        bitSize, topFormation: formation,
        wellCode: txt(w.legacyWellCode) || w.name, name: w.name, field: w.field ?? null,
        date: txt(r.reportDate) || null,
        // No legacy L04 day to open from a row click, and no bit-level meterage
        // or engineering inputs on a parameter row.
        serialNo: null,
        // meters must be populated: the Section/formation rollups sum
        // `p.meters ?? 0` while the Progress view derives `to - from`, so a null
        // here would make the two views report different footage for one row.
        from: num(d.startMkb), to: num(d.endDepthMkb),
        // meters and bitHour are emitted as a PAIR or not at all. The Section /
        // formation rollups compute overallRop = Σmeters ÷ Σhours, so footage
        // without its hours would inflate every mixed selection (legacy 3000 m /
        // 100 h = 30 m/hr becomes 3900 / 100 = 39 with 900 entered metres).
        // The interval's own drillTimeHr is the matching denominator.
        ...(() => {
          const lo = num(d.startMkb), hi = num(d.endDepthMkb), hrs = num(d.drillTimeHr);
          const m = lo != null && hi != null && hi > lo ? Number((hi - lo).toFixed(2)) : null;
          return m != null && hrs != null && hrs > 0
            ? { meters: m, bitHour: Number(hrs.toFixed(2)) }
            : { meters: null, bitHour: null };
        })(),
        // iadc STAYS NULL. groupByIadc() skips points without one, which is what
        // keeps these out of the per-IADC economics and the Bit Advisor: a
        // drilled interval is ~20 m against a legacy bit run's ~300 m, so mixing
        // them would collapse avgMeters and blow up the modelled cost/metre that
        // drives the ranking.
        iadc: null,
        // Tri-state. bitClass() defaults to "roller" when it is given nothing,
        // so a report with NO bit run at all (or one carrying neither an IADC
        // code nor a type) would be charted and counted as roller-cone — which
        // is the PDC-vs-roller comparison this tab exists for. Only classify on
        // real evidence; null means "unclassified", and the viewer gives those
        // points their own facet option rather than dropping them.
        bitClass: cls,
        make: null, diaIn: null,
        mse: null, mseEstimated: false, hsi: null, hsiSource: null,
        tfa: null, nozzles: null, flow: null, spp: null, mudWeight: null,
        dullInner: null, dullOuter: null, dullGrade: null, dullTitle: null,
        // NB: bitHour is set by the meters/bitHour spread above — do not re-declare
        // it here, a later key in the same literal silently overrides the spread.
        reasonCode: null, reasonLabel: null,
        source: "entered",
      });
    }
  }
  return out;
}
