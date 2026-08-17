/**
 * Report 10's plan ENVELOPE.
 *
 * The chart used to draw one planned curve — the most-likely case — while the
 * guide has the user "review the minimum, maximum and ML curves for depth and
 * cost versus days" (§4.5), and Chevron's own Days-vs-Depth templates
 * (custom/daysvdepthcost) define all three.
 *
 * The bounds accumulate exactly as the likely curve does, which is the part
 * worth pinning: a cumulative column that resets, double-counts, or emits 0 for
 * "not planned" would draw a band that looks authoritative and is wrong. Each
 * bound also stays null until a plan actually carries one, so a plan with only a
 * most-likely value contributes no band rather than a band collapsed onto the
 * likely line.
 *
 * Runs against the seeded dev database; skips when it is absent.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildReport10 } from "./phases.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = join(HERE, "..", "..", "prisma", "dev.db");

const ready = existsSync(DB);
const d = describe.skipIf(!ready);

let prisma: PrismaClient;
beforeAll(() => { prisma = new PrismaClient(); });
afterAll(async () => { await prisma?.$disconnect(); });

/** A job whose phases carry a planned envelope, or null if the seed lacks one. */
async function envelopeJobId(): Promise<string | null> {
  const phase = await prisma.jobPhase.findFirst({
    where: { plan: { durMinDays: { not: null } } },
    select: { jobId: true },
  });
  return phase?.jobId ?? null;
}

d("report 10 — the plan envelope", () => {
  it("accumulates min and max exactly as it accumulates the likely case", async () => {
    const jobId = await envelopeJobId();
    if (!jobId) return;                      // seed carries no envelope — nothing to assert

    const report = await buildReport10(prisma, jobId);
    expect(report).not.toBeNull();
    const rows = report!.phases;
    expect(rows.length).toBeGreaterThan(1);

    // Re-derive the cumulative columns from the per-phase plan and compare.
    const plans = await prisma.jobPhase.findMany({
      where: { jobId }, orderBy: { order: "asc" }, include: { plan: true },
    });
    let min = 0, max = 0, ml = 0;
    plans.forEach((p, i) => {
      min += p.plan?.durMinDays ?? 0;
      max += p.plan?.durMaxDays ?? 0;
      ml += p.plan?.durMostLikelyDays ?? 0;
      expect(rows[i].cumDurMinDays).toBeCloseTo(Math.round(min * 100) / 100, 6);
      expect(rows[i].cumDurMaxDays).toBeCloseTo(Math.round(max * 100) / 100, 6);
      expect(rows[i].cumDurMlDays).toBeCloseTo(Math.round(ml * 100) / 100, 6);
    });

    // Every cumulative column rises — a band that dips would mean a reset.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cumDurMinDays!).toBeGreaterThanOrEqual(rows[i - 1].cumDurMinDays!);
      expect(rows[i].cumDurMaxDays!).toBeGreaterThanOrEqual(rows[i - 1].cumDurMaxDays!);
      expect(rows[i].cumPlannedCostMin!).toBeGreaterThanOrEqual(rows[i - 1].cumPlannedCostMin!);
      expect(rows[i].cumPlannedCostMax!).toBeGreaterThanOrEqual(rows[i - 1].cumPlannedCostMax!);
    }

    // The envelope brackets the likely case — that is what makes it an envelope.
    const last = rows[rows.length - 1];
    expect(last.cumDurMinDays!).toBeLessThanOrEqual(last.cumDurMlDays!);
    expect(last.cumDurMaxDays!).toBeGreaterThanOrEqual(last.cumDurMlDays!);
    expect(last.cumPlannedCostMin!).toBeLessThanOrEqual(last.cumPlannedCost!);
    expect(last.cumPlannedCostMax!).toBeGreaterThanOrEqual(last.cumPlannedCost!);
  });

  it("gives the chart its own day axis per bound", async () => {
    const jobId = await envelopeJobId();
    if (!jobId) return;
    const report = await buildReport10(prisma, jobId);
    const chart = report!.chart;
    expect(chart.length).toBeGreaterThan(1);

    // The min plan reaches a given depth on an EARLIER day than the max plan —
    // plotting both on the likely curve's axis was the bug this guards.
    const withBoth = chart.filter((p) => p.planDaysMin != null && p.planDaysMax != null);
    expect(withBoth.length).toBeGreaterThan(0);
    for (const p of withBoth) expect(p.planDaysMin!).toBeLessThanOrEqual(p.planDaysMax!);

    // The depth series the bounds are drawn against is the planned end depth,
    // so a point with a bound must carry a depth to plot it at.
    expect(chart.some((p) => p.plannedEndDepth != null)).toBe(true);
  });

  it("omits the band when a plan has only a most-likely value", async () => {
    // A phase plan with no min/max must not fabricate one.
    const bare = await prisma.jobPhase.findFirst({
      where: { plan: { is: { durMinDays: null, durMostLikelyDays: { not: null } } } },
      select: { jobId: true },
    });
    if (!bare) return;
    const report = await buildReport10(prisma, bare.jobId);
    const rows = report!.phases;
    // Some row must carry a likely value with no min beside it.
    expect(rows.some((r) => r.cumDurMlDays !== null && r.cumDurMinDays === null)).toBe(true);
  });
});
