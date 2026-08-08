/**
 * The WellView report-data route group.
 *
 *   GET /entry/report-data/catalog        what can be generated, for the picker
 *   GET /entry/report-data/:type?...      one report's assembled payload
 *
 * One assembler per report under this folder, each returning ONE typed JSON
 * payload. The web app renders that payload twice — as the on-screen preview and
 * as the pdfmake export — from the same shared builders, so the two can never
 * disagree about a column, a unit or a computed total.
 *
 * These read the entry DB, so they sit behind the same entry-token auth as the
 * rest of `/entry/*`, and behind the same well-access rule.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { requireUser } from "../entry/auth.js";
import { mayUseWell } from "../entry/access.js";
import { buildReport01 } from "./01-afe-vs-field-est.js";
import { buildDailyReport } from "./daily.js";
import { buildReport02, buildReport03 } from "./bha.js";
import { buildReport10, buildReport11 } from "./phases.js";
import { buildReport04, buildReport05 } from "./casing.js";
import { buildReport08 } from "./directional.js";
import { buildReport09 } from "./summary.js";
import { buildReport15, buildReport17, resolveWells } from "./multiwell.js";

/** How a report is parameterized — the picker builds itself from this. */
export type ReportParam = "well" | "job" | "date" | "dateRange" | "bhaRun" | "casingString" | "wells";

export interface CatalogEntry {
  type: string;
  title: string;
  /** The picker groups by this, as the sample folder does. */
  category: "Daily" | "Engineering" | "Cost & Multi-well" | "Geology" | "Completion";
  params: ReportParam[];
  /** Which export buttons to offer. */
  exports: ("pdf" | "xlsx")[];
  /** False until the assembler and renderer exist — the card shows as pending. */
  available: boolean;
  /** One line for the card. */
  blurb: string;
}

/**
 * All 30 reports, in the sample folder's order.
 *
 * The unavailable ones are listed on purpose: the catalog is the plan made
 * visible, so it is obvious what exists and what is still to come rather than
 * the page looking finished at four reports.
 */
export const REPORT_CATALOG: CatalogEntry[] = [
  { type: "01", title: "AFE vs Field Est vs Final Invoice", category: "Cost & Multi-well", params: ["well", "job"], exports: ["pdf"], available: true, blurb: "Authorized budget against field estimate and final invoice, by cost code." },
  { type: "02", title: "BHA Detail", category: "Engineering", params: ["well", "bhaRun"], exports: ["pdf"], available: true, blurb: "One page per BHA run: header, bit, components, parameters, nozzles, sensors." },
  { type: "03", title: "Bit Summary", category: "Engineering", params: ["well", "job"], exports: ["pdf"], available: true, blurb: "Every bit run on the well, one row each." },
  { type: "04", title: "Casing, Liner and Cement", category: "Engineering", params: ["well", "casingString"], exports: ["pdf"], available: true, blurb: "One string: tally, cement job, stages, fluids, additives." },
  { type: "05", title: "Casing Summary", category: "Engineering", params: ["well"], exports: ["pdf"], available: true, blurb: "Every casing string with its component tally." },
  { type: "06", title: "Daily Drilling", category: "Daily", params: ["well", "date"], exports: ["pdf"], available: true, blurb: "The one-page morning report." },
  { type: "07", title: "Daily Drilling — Detail", category: "Daily", params: ["well", "date"], exports: ["pdf"], available: true, blurb: "The legal-size daily report: problems, lessons, kicks, losses, incidents." },
  { type: "08", title: "Directional Plot — Plan vs Actual", category: "Engineering", params: ["well"], exports: ["pdf"], available: true, blurb: "The planned trajectory against the surveys actually shot, in plan and vertical section." },
  { type: "09", title: "Drilling Summary 1", category: "Engineering", params: ["well", "job"], exports: ["pdf"], available: true, blurb: "The one-sheet dashboard: time by code, cost by description, NPT and depth-vs-days." },
  { type: "10", title: "Phases — Plan vs Actual", category: "Engineering", params: ["well", "job"], exports: ["pdf"], available: true, blurb: "Each phase planned against actual, with the days-and-cost graph." },
  { type: "11", title: "Phase Summary Graph", category: "Engineering", params: ["well", "job"], exports: ["pdf"], available: true, blurb: "Phase durations and costs as bars." },
  { type: "12", title: "Daily Drilling Summary 2", category: "Cost & Multi-well", params: ["wells", "date"], exports: ["pdf"], available: false, blurb: "One block per well for a single day." },
  { type: "13", title: "Drilling KPIs", category: "Cost & Multi-well", params: ["wells"], exports: ["pdf", "xlsx"], available: false, blurb: "The KPI pivot." },
  { type: "14", title: "Drilling Offsets", category: "Cost & Multi-well", params: ["wells"], exports: ["pdf"], available: false, blurb: "Days-vs-depth and cost curves for offset wells." },
  { type: "15", title: "Problem Cost by Accountable Party", category: "Cost & Multi-well", params: ["wells", "dateRange"], exports: ["pdf"], available: true, blurb: "Problem cost pivoted on who it is charged to, stacked by problem kind." },
  { type: "16", title: "Phase Summary Pivot", category: "Cost & Multi-well", params: ["wells"], exports: ["pdf", "xlsx"], available: false, blurb: "Phase days and cost across wells." },
  { type: "17", title: "Safety Incidents", category: "Cost & Multi-well", params: ["wells", "dateRange"], exports: ["pdf"], available: true, blurb: "Every incident across the selected wells, oldest first." },
  { type: "18", title: "Daily Geological", category: "Geology", params: ["well", "date"], exports: ["pdf"], available: false, blurb: "The day's geology: tops, lithology, samples, gas and shows." },
  { type: "19", title: "Formation Performance", category: "Geology", params: ["well"], exports: ["pdf"], available: false, blurb: "Drilling performance per formation." },
  { type: "20", title: "Geological Program", category: "Geology", params: ["well", "job"], exports: ["pdf"], available: false, blurb: "The prognosed programme and its sampling requirements." },
  { type: "21", title: "Geological Schematic", category: "Geology", params: ["well"], exports: ["pdf"], available: false, blurb: "Formation, lithology, mud and casing tracks against depth." },
  { type: "22", title: "Complete Well Summary", category: "Completion", params: ["well", "job"], exports: ["pdf"], available: false, blurb: "The whole well dossier." },
  { type: "23", title: "Daily Completion and Workover", category: "Completion", params: ["well", "date"], exports: ["pdf"], available: false, blurb: "The daily completion report with its schematic." },
  { type: "24", title: "Downhole Well Profile", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "Casing, tubing, rods and perforations against depth." },
  { type: "25", title: "Cost of Failure by Type", category: "Completion", params: ["wells"], exports: ["pdf", "xlsx"], available: false, blurb: "Failure cost pivot and graphs." },
  { type: "26", title: "Perforations", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "Every perforation run with its statuses." },
  { type: "27", title: "Production & Maintenance History", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "Production periods against maintenance events." },
  { type: "28", title: "Schematic — Current", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "The wellbore as it stands." },
  { type: "29", title: "Schematic — Proposed vs Actual", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "Proposed beside actual." },
  { type: "30", title: "Well Summary", category: "Completion", params: ["well"], exports: ["pdf"], available: false, blurb: "The well's whole life on two pages." },
];

export async function registerReportRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get("/entry/report-data/catalog", { preHandler: requireUser }, async () => REPORT_CATALOG);

  app.get<{ Params: { type: string }; Querystring: { wellId?: string; jobId?: string; date?: string; bhaRunId?: string; casingStringId?: string; wellIds?: string; from?: string; to?: string } }>(
    "/entry/report-data/:type", { preHandler: requireUser }, async (req, reply) => {
      const { type } = req.params;
      const entry = REPORT_CATALOG.find((r) => r.type === type);
      if (!entry) return reply.code(404).send({ error: `no report "${type}"` });
      if (!entry.available) {
        return reply.code(501).send({ error: `${entry.title} is not built yet` });
      }

      switch (type) {
        case "01": return jobReport(req, reply, (jobId) => buildReport01(prisma, jobId));
        case "10": return jobReport(req, reply, (jobId) => buildReport10(prisma, jobId));
        case "11": return jobReport(req, reply, (jobId) => buildReport11(prisma, jobId));
        case "06": return dayReport(req, reply, (id) => buildDailyReport(prisma, id, false));
        case "07": return dayReport(req, reply, (id) => buildDailyReport(prisma, id, true));
        case "02": {
          const bhaRunId = (req.query.bhaRunId ?? "").trim();
          if (!bhaRunId) return reply.code(400).send({ error: "this report needs a bhaRunId" });
          const run = await prisma.entryBhaRun.findUnique({ where: { id: bhaRunId }, select: { wellId: true } });
          if (!run) return reply.code(404).send({ error: "no such BHA run" });
          if (!(await mayUseWell(prisma, req, run.wellId))) return reply.code(403).send({ error: "not your well" });
          return (await buildReport02(prisma, bhaRunId)) ?? reply.code(404).send({ error: "no such BHA run" });
        }
        case "04": {
          const casingStringId = (req.query.casingStringId ?? "").trim();
          if (!casingStringId) return reply.code(400).send({ error: "this report needs a casingStringId" });
          const str = await prisma.casingString.findUnique({ where: { id: casingStringId }, select: { wellId: true } });
          if (!str) return reply.code(404).send({ error: "no such casing string" });
          if (!(await mayUseWell(prisma, req, str.wellId))) return reply.code(403).send({ error: "not your well" });
          return (await buildReport04(prisma, casingStringId)) ?? reply.code(404).send({ error: "no such casing string" });
        }
        case "05": {
          const wellId = (req.query.wellId ?? "").trim();
          if (!wellId) return reply.code(400).send({ error: "this report needs a wellId" });
          if (!(await mayUseWell(prisma, req, wellId))) return reply.code(403).send({ error: "not your well" });
          return (await buildReport05(prisma, wellId)) ?? reply.code(404).send({ error: "no such well" });
        }
        case "15":
          return buildReport15(
            prisma, await wellSet(req, req.query.wellIds), dateRange(req.query.from, req.query.to),
          );
        case "17":
          return buildReport17(
            prisma, await wellSet(req, req.query.wellIds), dateRange(req.query.from, req.query.to),
          );
        case "08": {
          const wellId = (req.query.wellId ?? "").trim();
          if (!wellId) return reply.code(400).send({ error: "this report needs a wellId" });
          if (!(await mayUseWell(prisma, req, wellId))) return reply.code(403).send({ error: "not your well" });
          return (await buildReport08(prisma, wellId)) ?? reply.code(404).send({ error: "no such well" });
        }
        case "09": return jobReport(req, reply, (jobId) => buildReport09(prisma, jobId));
        case "03": {
          const wellId = (req.query.wellId ?? "").trim();
          if (!wellId) return reply.code(400).send({ error: "this report needs a wellId" });
          if (!(await mayUseWell(prisma, req, wellId))) return reply.code(403).send({ error: "not your well" });
          return (await buildReport03(prisma, wellId, req.query.jobId)) ?? reply.code(404).send({ error: "no such well" });
        }
        default: return reply.code(501).send({ error: `${entry.title} is not built yet` });
      }
    });

  /**
   * Shared preamble for a DAY-scoped report. The client may pass the report id
   * straight through, or a wellId + date pair — the reports page picks a day
   * from a list, which is the pair.
   */
  async function dayReport<T>(
    req: FastifyRequest<{ Querystring: { wellId?: string; date?: string; reportId?: string } }>,
    reply: FastifyReply,
    build: (reportId: string) => Promise<T | null>,
  ) {
    const { wellId, date } = req.query;
    let id = (req.query.reportId ?? "").trim();
    if (!id) {
      if (!wellId || !date) return reply.code(400).send({ error: "this report needs a wellId and a date" });
      const found = await prisma.entryReport.findFirst({
        where: { wellId, reportDate: date }, select: { id: true },
      });
      if (!found) return reply.code(404).send({ error: `no report filed for ${date}` });
      id = found.id;
    }
    const report = await prisma.entryReport.findUnique({ where: { id }, select: { wellId: true } });
    if (!report) return reply.code(404).send({ error: "no such report" });
    if (!(await mayUseWell(prisma, req, report.wellId))) {
      return reply.code(403).send({ error: "not your well" });
    }
    const payload = await build(id);
    if (!payload) return reply.code(404).send({ error: "no such report" });
    return payload;
  }

  /**
   * The well set for a multi-well report.
   *
   * `wellIds` is a comma-separated list; an empty one means "every well I may
   * use". Authorization happens INSIDE `resolveWells` — a stale id in the list
   * is dropped rather than failing the whole request, and the payload reports
   * how many were dropped so the page can say so.
   */
  async function wellSet(req: FastifyRequest, wellIds: string | undefined) {
    const ids = (wellIds ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return resolveWells(prisma, req, ids);
  }

  /** The optional Jalali from/to a multi-well report is filtered by. */
  function dateRange(from: string | undefined, to: string | undefined) {
    return { from: (from ?? "").trim() || undefined, to: (to ?? "").trim() || undefined };
  }

  /** Shared preamble for every job-scoped report: resolve, then authorize. */
  async function jobReport<T>(
    req: FastifyRequest<{ Querystring: { jobId?: string } }>,
    reply: FastifyReply,
    build: (jobId: string) => Promise<T | null>,
  ) {
    const jobId = (req.query.jobId ?? "").trim();
    if (!jobId) return reply.code(400).send({ error: "this report needs a jobId" });
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { wellId: true } });
    if (!job) return reply.code(404).send({ error: "no such job" });
    if (!(await mayUseWell(prisma, req, job.wellId))) {
      return reply.code(403).send({ error: "not your well" });
    }
    const payload = await build(jobId);
    if (!payload) return reply.code(404).send({ error: "no such job" });
    return payload;
  }
}
