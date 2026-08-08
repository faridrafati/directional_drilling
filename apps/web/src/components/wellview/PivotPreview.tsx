/**
 * On-screen previews of the two pivot reports — 13 (Drilling KPIs) and 16
 * (Phase Summary Pivot).
 *
 * Both samples are Excel pivot tables printed to PDF, and both keep that shape
 * here: the filter block above the grid, the grid, and a Grand Total line set
 * off from the body. The Grand Total is a REPORTED row, not a rendered footer —
 * it comes from the payload, computed from the wells rather than by adding up
 * the column, so the on-screen figure and the exported one cannot diverge.
 *
 * A blank cell means "not recorded". None of these columns prints 0 for a
 * missing figure — a well with no problem hours entered and a well with
 * genuinely zero problem hours are different statements.
 */
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  KpiRow, PhasePivotRow, Report13Payload, Report16Payload,
} from "../../entry/wellview.js";
import {
  PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle, SectionBar,
  type PreviewColumn,
} from "./ReportPreview.js";
import { WellSetBlock } from "./MultiWellPreview.js";
import type { HeaderRow } from "../../entry/wellview.js";

/**
 * The pivot's filter block — WellView prints it above every pivot grid.
 *
 * Rendered as label/value pairs down the left, the way the sample stacks them,
 * rather than as the wide header band the single-well reports use: these are
 * FILTERS, and a reader scans them as a list of conditions.
 */
function FilterBlock({ filters }: { filters: HeaderRow }) {
  return (
    <div className="border border-gray-400 border-t-0">
      {filters.map((f, i) => (
        <div key={i} className="flex border-b border-gray-300 last:border-b-0">
          <div className="w-56 shrink-0 px-1.5 py-0.5 text-[10px] text-gray-500 border-r border-gray-300">
            {f.label}
          </div>
          <div className="px-1.5 py-0.5 text-[11px] text-gray-900">
            {headerValue(f.value, f.kind) || " "}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The Grand Total, set off from the body as the sample sets it off. */
function TotalRow({ cells }: { cells: { text: string; align?: "right"; width?: string }[] }) {
  return (
    <div className="flex border border-gray-400 border-t-0 bg-gray-100 font-semibold">
      {cells.map((c, i) => (
        <div
          key={i}
          className={`px-1.5 py-1 text-[11px] text-gray-900 border-r border-gray-300 last:border-r-0 truncate ${c.width ?? "flex-1"} ${c.align === "right" ? "text-right tabular-nums" : ""}`}
        >
          {c.text || " "}
        </div>
      ))}
    </div>
  );
}

/* ══ report 13 ═══════════════════════════════════════════════════════════════ */

const KPI_COLUMNS: PreviewColumn<KpiRow>[] = [
  { header: "Well Name", width: "w-44", cell: (r) => r.wellName },
  { header: "AFE+Supp Amt", width: "w-28", align: "right", cell: (r) => money(r.afeSuppAmt) },
  { header: "Field Est", width: "w-28", align: "right", cell: (r) => money(r.fieldEst) },
  { header: "AFE-Field Est", width: "w-28", align: "right", cell: (r) => money(r.afeLessFieldEst) },
  { header: "Cost/Depth", width: "w-24", align: "right", cell: (r) => headerValue(r.costPerDepth) },
  { header: "Drilled Total Depth (mKB)", width: "w-24", align: "right", cell: (r) => headerValue(r.drilledTotalDepth) },
  { header: "Total Time Log Hrs", width: "w-24", align: "right", cell: (r) => headerValue(r.totalTimeLogHr) },
  { header: "Total Problem Hrs", width: "w-24", align: "right", cell: (r) => headerValue(r.totalProblemHr) },
  { header: "% Problem Time", width: "w-24", align: "right", cell: (r) => headerValue(r.pctProblemTime) },
  { header: "Drilling Hrs", width: "w-24", align: "right", cell: (r) => headerValue(r.drillingHr) },
  { header: "Avg. ROP (m/hr)", width: "w-24", align: "right", cell: (r) => headerValue(r.avgRopMHr) },
  { header: "Personnel Hrs", width: "w-24", align: "right", cell: (r) => headerValue(r.personnelHr) },
];

/** The Grand Total, in the same order and format as the columns above it. */
export function kpiTotalCells(r: KpiRow) {
  return [
    { text: r.wellName, width: "w-44" },
    { text: money(r.afeSuppAmt), align: "right" as const, width: "w-28" },
    { text: money(r.fieldEst), align: "right" as const, width: "w-28" },
    { text: money(r.afeLessFieldEst), align: "right" as const, width: "w-28" },
    { text: headerValue(r.costPerDepth), align: "right" as const, width: "w-24" },
    { text: headerValue(r.drilledTotalDepth), align: "right" as const, width: "w-24" },
    { text: headerValue(r.totalTimeLogHr), align: "right" as const, width: "w-24" },
    { text: headerValue(r.totalProblemHr), align: "right" as const, width: "w-24" },
    { text: headerValue(r.pctProblemTime), align: "right" as const, width: "w-24" },
    { text: headerValue(r.drillingHr), align: "right" as const, width: "w-24" },
    { text: headerValue(r.avgRopMHr), align: "right" as const, width: "w-24" },
    { text: headerValue(r.personnelHr), align: "right" as const, width: "w-24" },
  ];
}

export function Report13Preview({ payload }: { payload: Report13Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <SectionBar>Filters</SectionBar>
      <FilterBlock filters={payload.filters} />
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />

      <SectionBar>Data</SectionBar>
      <PreviewTable
        columns={KPI_COLUMNS}
        rows={payload.rows}
        emptyText="No well in the set."
      />
      {payload.rows.length > 0 && <TotalRow cells={kpiTotalCells(payload.grandTotal)} />}

      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        The Grand Total&rsquo;s ratios are re-derived from the summed numerator and denominator, not
        averaged down the column — averaging would weight a three-day well the same as a thirty-day
        one, which is how a fleet ROP comes out faster than every rig in it.
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 16 ═══════════════════════════════════════════════════════════════ */

const PIVOT_COLUMNS: PreviewColumn<PhasePivotRow>[] = [
  { header: "Job Category", width: "w-32", cell: (r) => r.jobCategory },
  { header: "Phase Type 1", width: "w-40", cell: (r) => r.phaseType1 },
  { header: "Phase Type 2", width: "w-48", cell: (r) => r.phaseType2 },
  { header: "Count", width: "w-20", align: "right", cell: (r) => headerValue(r.count, "int") },
  { header: "Avg", width: "w-24", align: "right", cell: (r) => headerValue(r.avg) },
  { header: "Min", width: "w-24", align: "right", cell: (r) => headerValue(r.min) },
  { header: "Max", width: "w-24", align: "right", cell: (r) => headerValue(r.max) },
  { header: "StdDev", width: "w-24", align: "right", cell: (r) => headerValue(r.stdDev) },
  { header: "Sum", width: "w-24", align: "right", cell: (r) => headerValue(r.sum) },
];

export function pivotTotalCells(r: PhasePivotRow) {
  return [
    { text: r.jobCategory, width: "w-32" },
    { text: r.phaseType1, width: "w-40" },
    { text: r.phaseType2, width: "w-48" },
    { text: headerValue(r.count, "int"), align: "right" as const, width: "w-20" },
    { text: headerValue(r.avg), align: "right" as const, width: "w-24" },
    { text: headerValue(r.min), align: "right" as const, width: "w-24" },
    { text: headerValue(r.max), align: "right" as const, width: "w-24" },
    { text: headerValue(r.stdDev), align: "right" as const, width: "w-24" },
    { text: headerValue(r.sum), align: "right" as const, width: "w-24" },
  ];
}

export function Report16Preview({ payload }: { payload: Report16Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <SectionBar>Filters</SectionBar>
      <FilterBlock filters={payload.filters} />
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />

      <SectionBar>Phase duration (days), across the well set</SectionBar>
      <PreviewTable
        columns={PIVOT_COLUMNS}
        rows={payload.rows}
        emptyText="No phase with both an actual start and an actual end — the pivot measures what was recorded, and a phase with one date has no duration."
      />
      {payload.rows.length > 0 && <TotalRow cells={pivotTotalCells(payload.grandTotal)} />}

      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        StdDev is the POPULATION deviation, and blank where a group has one phase — a single
        observation cannot support a claim about spread. Count is how many phases were MEASURED: a
        phase missing either date is not counted rather than counted as zero days.
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
