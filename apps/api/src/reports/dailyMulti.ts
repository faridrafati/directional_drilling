/**
 * Report 12 — Multi-well Daily Drilling Summary 2.
 *
 * One condensed block per well: who is on it, where it got to, what it cost, and
 * the day's time log. It is the morning-meeting sheet for a fleet — report 06
 * for six wells at once, with everything that does not survive being read six
 * times over stripped out.
 *
 * WHICH DAY
 * ---------
 * Each well's LATEST day, not one shared date. The sample makes this explicit:
 * its three blocks are dated 2002-04-14, 2001-06-27 and 2001-06-28 — three wells
 * whose campaigns did not overlap at all. A fleet summary answers "where is each
 * of my wells", and a well that filed nothing yesterday still has a last known
 * position. An optional `asOf` caps that: the newest day on or before it, which
 * is how you re-read the meeting from a week ago.
 *
 * A well with no day at all appears with its identity and says so, rather than
 * vanishing. A missing well reads as "not drilling"; an absent well reads as
 * nothing, and the difference matters when the list is what you check against.
 */
import type { PrismaClient } from "@prisma/client";
import { compareJalali, jalaliDaysBetween, jalaliHoursBetween, jalaliKey } from "@dd/shared";
import { printedOn, type HeaderRow, type ReportEnvelope } from "./chrome.js";
import { durationHr } from "./daily.js";
import type { ResolvedWells, WellRef } from "./multiwell.js";

const round = (v: number, dp = 2) => Number(v.toFixed(dp));

/** One line of the block's condensed time log. */
export interface MultiTimeLogRow {
  startDate: string;
  endDate: string;
  durHr: number | null;
  cumDurHr: number | null;
  code1: string | null;
  code2: string | null;
  com: string | null;
}

/** One well's block. */
export interface WellDayBlock {
  wellId: string;
  rigName: string | null;
  identity: HeaderRow;
  /** Three rows of figures, in the sample's order. */
  figures: HeaderRow[];
  /** "Rig Manager, Bob Green, 0912…; Drilling Foreman, …" — one line, as printed. */
  dailyContacts: string | null;
  operationsSummary: string | null;
  operationsNextPeriod: string | null;
  timeLog: MultiTimeLogRow[];
  /** Set when the well has filed no day; the block then prints this instead. */
  noDay: string | null;
}

export interface Report12Payload extends ReportEnvelope {
  wells: WellRef[];
  droppedWells: number;
  /** The cap the blocks were chosen under, when one was given. */
  asOf: string | null;
  blocks: WellDayBlock[];
}

/**
 * The day's own field estimate, and the running total to that day.
 *
 * Both are sliced from the job's cost sheet by `costDate` — there is no separate
 * per-day cost table, which is what keeps report 06's Day Total, report 09's
 * curve and this block agreeing.
 */
function costTo(
  items: { costDate: string | null; fieldEstimate: number | null }[],
  date: string,
): { daily: number | null; cumulative: number | null } {
  let daily = 0, cum = 0, anyDaily = false, anyCum = false;
  for (const c of items) {
    if (c.costDate === null || c.fieldEstimate === null) continue;
    const cmp = compareJalali(c.costDate, date);
    if (cmp > 0) continue;
    cum += c.fieldEstimate; anyCum = true;
    if (cmp === 0) { daily += c.fieldEstimate; anyDaily = true; }
  }
  return {
    daily: anyDaily ? round(daily) : null,
    cumulative: anyCum ? round(cum) : null,
  };
}

export async function buildReport12(
  prisma: PrismaClient,
  resolved: ResolvedWells,
  asOf: string | undefined,
): Promise<Report12Payload> {
  const wellIds = resolved.wells.map((w) => w.id);
  const cap = jalaliKey(asOf ?? null);

  const [reports, jobs, rigs] = wellIds.length === 0 ? [[], [], []] : await Promise.all([
    prisma.entryReport.findMany({
      where: { wellId: { in: wellIds } },
      select: {
        id: true, wellId: true, serialNo: true, reportDate: true, midnightDepth: true,
        description: true, opsNextPeriod: true,
        supervisors: { orderBy: { order: "asc" }, select: { jobContact: true, position: true, mobile: true } },
        operations: {
          orderBy: { order: "asc" },
          select: { fromTime: true, toTime: true, opDetail: true, opLetter: true, opCode2: true, remarks: true },
        },
      },
    }),
    prisma.job.findMany({
      where: { wellId: { in: wellIds } },
      select: {
        wellId: true, name: true,
        afes: { orderBy: { order: "asc" }, select: { afeNumber: true } },
        costItems: { select: { costDate: true, fieldEstimate: true } },
        phases: {
          orderBy: { order: "asc" },
          select: {
            phaseType1: true, phaseType2: true, actualStartDate: true, actualEndDate: true,
            plan: { select: { durMostLikelyDays: true } },
          },
        },
      },
    }),
    prisma.entryWell.findMany({
      where: { id: { in: wellIds } },
      select: { id: true, spudDate: true, rig: { select: { name: true } } },
    }),
  ]);

  const blocks: WellDayBlock[] = resolved.wells.map((well) => {
    const rig = rigs.find((r) => r.id === well.id);
    const identity: HeaderRow = [
      { label: "Well Name", value: well.name },
      { label: "API/UWI", value: well.apiUwi },
      { label: "License #", value: well.licenseNo },
    ];

    // The newest day, capped by `asOf` when one was given.
    const days = reports
      .filter((r) => r.wellId === well.id)
      .filter((r) => {
        if (cap === null) return true;
        const k = jalaliKey(r.reportDate);
        return k !== null && k <= cap;
      })
      .sort((a, b) => compareJalali(b.reportDate, a.reportDate));
    const day = days[0];

    if (!day) {
      return {
        wellId: well.id, rigName: rig?.rig.name ?? null, identity,
        figures: [], dailyContacts: null,
        operationsSummary: null, operationsNextPeriod: null, timeLog: [],
        noDay: asOf
          ? `No daily report filed on or before ${asOf}.`
          : "No daily report filed on this well yet.",
      };
    }

    const job = jobs.find((j) => j.wellId === well.id) ?? null;
    const cost = costTo(job?.costItems ?? [], day.reportDate);

    // The phase this day fell in — the last one whose actual start is on or
    // before it. Not the last one STARTED overall: re-reading an older meeting
    // must show the phase that was running then, not the one running now.
    let lastPhase: (typeof job extends null ? never : NonNullable<typeof job>["phases"][number]) | null = null;
    let plannedDaysToHere = 0, anyPlanned = false;
    for (const p of job?.phases ?? []) {
      if (p.actualStartDate === null) continue;
      if (compareJalali(p.actualStartDate, day.reportDate) > 0) break;
      lastPhase = p;
      if (p.plan?.durMostLikelyDays !== null && p.plan?.durMostLikelyDays !== undefined) {
        plannedDaysToHere += p.plan.durMostLikelyDays; anyPlanned = true;
      }
    }

    // "Ahead" is PLANNED minus ACTUAL, so a positive number means ahead of
    // schedule — which is the only reading of the word that does not need a
    // footnote.
    const phaseHours = lastPhase
      ? jalaliHoursBetween(lastPhase.actualStartDate, day.reportDate)
      : null;
    const phasePlanned = lastPhase?.plan?.durMostLikelyDays ?? null;
    const phaseDaysAhead = phaseHours === null || phasePlanned === null
      ? null : round(phasePlanned - phaseHours / 24);

    const firstPhaseStart = (job?.phases ?? []).find((p) => p.actualStartDate)?.actualStartDate ?? null;
    const jobHours = jalaliHoursBetween(firstPhaseStart, day.reportDate);
    const jobDaysAhead = jobHours === null || !anyPlanned
      ? null : round(plannedDaysToHere - jobHours / 24);

    const daysFromSpud = jalaliDaysBetween(rig?.spudDate ?? null, day.reportDate);

    let cum = 0, cumAny = false;
    const timeLog: MultiTimeLogRow[] = day.operations.map((op) => {
      const dur = durationHr(op.fromTime, op.toTime);
      if (dur !== null) { cum += dur; cumAny = true; }
      return {
        // Full datetimes, as the sample prints them: with each block on a
        // different day, a bare "00:45" does not say which day it is on.
        startDate: `${day.reportDate} ${op.fromTime ?? ""}`.trim(),
        endDate: `${day.reportDate} ${op.toTime ?? ""}`.trim(),
        durHr: dur,
        cumDurHr: dur === null ? null : round(cum),
        code1: op.opDetail ?? op.opLetter,
        code2: op.opCode2,
        com: op.remarks,
      };
    });
    void cumAny;

    return {
      wellId: well.id,
      rigName: rig?.rig.name ?? null,
      identity,
      figures: [
        [
          { label: "AFE Number", value: job?.afes[0]?.afeNumber ?? null },
          { label: "Daily Field Est Total (Cost)", value: cost.daily, kind: "money" },
          { label: "Cum Field Est To Date (Cost)", value: cost.cumulative, kind: "money" },
        ],
        [
          { label: "Report Number", value: day.serialNo, kind: "int" },
          { label: "Days From Spud (days)", value: daysFromSpud, kind: "decimal" },
          { label: "End Depth (mKB)", value: day.midnightDepth, kind: "decimal" },
        ],
        [
          {
            label: "Last Phase",
            value: lastPhase
              ? [lastPhase.phaseType1, lastPhase.phaseType2].filter(Boolean).join(", ") || null
              : null,
          },
          { label: "Phase Days Ahead (days)", value: phaseDaysAhead, kind: "decimal" },
          { label: "Job Days Ahead (days)", value: jobDaysAhead, kind: "decimal" },
        ],
      ],
      dailyContacts: day.supervisors.length === 0 ? null : day.supervisors
        .map((s) => [s.position, s.jobContact, s.mobile].map((v) => v ?? "").join(", "))
        .join("; "),
      operationsSummary: day.description,
      operationsNextPeriod: day.opsNextPeriod,
      timeLog,
      noDay: null,
    };
  });

  return {
    type: "12",
    title: "Daily Drilling Summary 2",
    wellName: `${resolved.wells.length} well${resolved.wells.length === 1 ? "" : "s"}`,
    headerVariant: "none",
    header: [],
    printedOn: printedOn(),
    wells: resolved.wells,
    droppedWells: resolved.dropped,
    asOf: asOf ?? null,
    blocks,
  };
}
