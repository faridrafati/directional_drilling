/**
 * Report 01 — AFE vs Field Est vs Final Invoice.
 *
 * Reproduces `Wellview/01_AFEvsFieldEstvsFinalInvoice.pdf`: one page, one job,
 * comparing the authorized budget (AFE + supplements) against the field cost
 * estimate and the final invoice, line by cost-code line.
 *
 * WHAT IS COMPUTED HERE, AND WHY IT IS COMPUTED AND NOT STORED
 * -----------------------------------------------------------
 * Every total on this page is a sum over the cost rows, verified against the
 * sample's own arithmetic:
 *
 *   Total AFE Amount        = Σ afeAmount          (sample: 10,218,000.00)
 *   Total AFE Supplemental  = Σ suppAmount         (sample:    125,000.00)
 *   Total Field Estimate    = Σ fieldEstimate      (sample: 10,127,291.47)
 *   AFE-Field Estimate      = AFE + Supp − Field   (sample:    215,708.53) ✓
 *   Var (AFE-Fld) per row   = afeAmount + suppAmount − fieldEstimate
 *       ✓ Subsea wellhead   350,000 + 50,000 − 315,832 =  84,168
 *       ✓ Electric logging   50,000 + 75,000 −       0 = 125,000
 *       ✓ Electric logging        0 +      0 −  50,000 = −50,000
 *
 * Storing any of them would let a total drift away from the rows it claims to
 * add up.
 *
 * BLANK IS NOT ZERO. The sample leaves money cells empty rather than printing
 * 0.00, so a row's missing amounts stay null all the way to the page. The one
 * place a null is read as zero is INSIDE a variance — but only when at least
 * one of the three inputs is present; a row with none prints no variance at all.
 */
import type { PrismaClient } from "@prisma/client";
import {
  standardWellHeader, printedOn, type HeaderRow, type ReportEnvelope,
} from "./chrome.js";

/** One printed row of the Job Cost Summary table. */
export interface CostSummaryRow {
  description: string | null;
  code1: string | null;
  code2: string | null;
  afeAmount: number | null;
  suppAmount: number | null;
  fieldEstimate: number | null;
  finalInvoice: number | null;
  /** Computed. Null when the row carries none of the three inputs. */
  variance: number | null;
}

export interface Report01Payload extends ReportEnvelope {
  job: HeaderRow;
  totals: HeaderRow;
  summary: string | null;
  costRows: CostSummaryRow[];
}

/** Σ over a nullable column; null when no row carried a value at all. */
function sumOrNull(values: (number | null)[]): number | null {
  let any = false;
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    any = true;
    total += v;
  }
  // Money is summed in floating point; round to the cent the page prints so
  // 4,617,116.00 + … does not surface as …0000001.
  return any ? Number(total.toFixed(2)) : null;
}

export async function buildReport01(
  prisma: PrismaClient,
  jobId: string,
): Promise<Report01Payload | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      well: true,
      afes: { orderBy: { order: "asc" }, include: { supplements: true } },
      costItems: {
        orderBy: { order: "asc" },
        include: { costCode: true },
      },
    },
  });
  if (!job) return null;

  const rows: CostSummaryRow[] = job.costItems.map((c) => {
    const { afeAmount, suppAmount, fieldEstimate } = c;
    const anyInput = [afeAmount, suppAmount, fieldEstimate].some((v) => v !== null);
    return {
      // The row's own description wins over the code's — the sample prints an
      // uncoded row's text with no code cells beside it.
      description: c.description ?? c.costCode?.description ?? null,
      code1: c.costCode?.code1 ?? null,
      code2: c.costCode?.code2 ?? null,
      afeAmount, suppAmount, fieldEstimate,
      finalInvoice: c.finalInvoice,
      variance: anyInput
        ? Number((((afeAmount ?? 0) + (suppAmount ?? 0) - (fieldEstimate ?? 0)).toFixed(2)))
        : null,
    };
  });

  const totalAfe = sumOrNull(rows.map((r) => r.afeAmount));
  const totalSupp = sumOrNull(rows.map((r) => r.suppAmount));
  const totalFieldEst = sumOrNull(rows.map((r) => r.fieldEstimate));
  const totalVariance = [totalAfe, totalSupp, totalFieldEst].some((v) => v !== null)
    ? Number((((totalAfe ?? 0) + (totalSupp ?? 0) - (totalFieldEst ?? 0)).toFixed(2)))
    : null;

  // The sample prints ONE AFE number in its totals block. A job may carry
  // several (a re-AFE'd sidetrack), so the primary — order 0 — is the one that
  // prints, and any others are listed after it rather than silently dropped.
  const afeNumbers = job.afes.map((a) => a.afeNumber).filter((n): n is string => !!n);

  return {
    type: "01",
    title: "AFE vs Field Est vs Final Invoice",
    wellName: job.well.name,
    headerVariant: "standard",
    header: standardWellHeader(job.well),
    printedOn: printedOn(),
    job: [
      { label: "Job Category", value: job.category },
      { label: "Primary Job Type", value: job.primaryJobType },
      { label: "Start Date", value: job.startDate },
      { label: "End Date", value: job.endDate },
      { label: "Status 1", value: job.status1 },
    ],
    totals: [
      { label: "AFE Number", value: afeNumbers.join(", ") || null },
      { label: "Total AFE Amount (Cost)", value: totalAfe, kind: "money" },
      { label: "Total AFE Supplemental Amount (Cost)", value: totalSupp, kind: "money" },
      { label: "Total Field Estimate (Cost)", value: totalFieldEst, kind: "money" },
      { label: "AFE-Field Estimate (Cost)", value: totalVariance, kind: "money" },
    ],
    summary: job.summary,
    costRows: rows,
  };
}
