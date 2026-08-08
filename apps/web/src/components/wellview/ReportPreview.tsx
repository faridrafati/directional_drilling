/**
 * On-screen preview of a WellView report.
 *
 * The screen twin of `apps/web/src/export/reportChrome.ts`: the same payload,
 * the same blocks in the same order, the same blank-is-blank rule. Where the
 * export returns pdfmake `Content`, this returns JSX — and both take their
 * labels, their column order and every computed number from the server payload,
 * so the preview cannot promise something the PDF then prints differently.
 *
 * Number formatting is shared with the export (`money`, `headerValue`), for the
 * same reason.
 */
import { headerValue, money } from "../../export/reportChrome.js";
import type { CostSummaryRow, HeaderRow, Report01Payload } from "../../entry/wellview.js";

/** The centred report title. */
export function PreviewTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center text-[15px] font-bold text-gray-900 py-2">{children}</div>
  );
}

/** "Well Name:  <name>", with an optional right-hand identity. */
export function IdentityLine({ wellName, right }: { wellName: string; right?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5">
      <div className="text-[12px] font-bold text-gray-900 truncate">
        <span className="text-gray-500 font-semibold">Well Name:&nbsp;&nbsp;</span>
        {wellName}
      </div>
      {right && <div className="text-[12px] font-bold text-gray-900 shrink-0">{right}</div>}
    </div>
  );
}

/**
 * A label-over-value grid — the WellView header, job and totals blocks.
 *
 * Empty cells print as labelled blanks, exactly as the samples do: a header
 * that collapses when a well is half-filled is no longer the same document.
 */
export function HeaderGrid({ rows }: { rows: HeaderRow[] }) {
  return (
    <div className="border border-gray-400 border-b-0">
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid border-b border-gray-400"
          style={{ gridTemplateColumns: row.map((c) => `${c.span ?? 1}fr`).join(" ") }}
        >
          {row.map((cell, j) => (
            <div key={j} className="min-w-0 px-1.5 py-0.5 border-r border-gray-300 last:border-r-0">
              <div className="text-[9px] leading-tight text-gray-500 truncate" title={cell.label}>
                {cell.label}
              </div>
              <div
                className={`text-[11px] leading-tight text-gray-900 truncate ${typeof cell.value === "number" ? "text-right tabular-nums" : ""}`}
                title={headerValue(cell.value, cell.kind)}
              >
                {/* The cell's OWN kind, not the default. Dropping it printed every
                    whole-number header — a tally's joint count, a daily report
                    number — as "8.00", because `headerValue` falls back to money
                    for any number that does not say otherwise. */}
                {headerValue(cell.value, cell.kind) || " "}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The grey section band above a table. */
export function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#dedede] border border-gray-400 border-t-0 px-1.5 py-1 text-[11px] font-bold text-gray-900">
      {children}
    </div>
  );
}

/** A labelled free-text block. */
export function NarrativeBlock({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="border border-gray-400 border-t-0">
      <div className="px-1.5 pt-0.5 text-[9px] leading-tight text-gray-500">{label}</div>
      <div className="px-1.5 pb-1 text-[11px] leading-snug text-gray-900 whitespace-pre-wrap min-h-[1.2em]">
        {text ?? " "}
      </div>
    </div>
  );
}

/** One preview table column — the screen twin of `ReportColumn`. */
export interface PreviewColumn<T> {
  header: string;
  align?: "left" | "right";
  /** Tailwind width class; omit for the elastic column. */
  width?: string;
  cell: (row: T) => string;
}

export function PreviewTable<T>({ columns, rows, emptyText }: {
  columns: PreviewColumn<T>[];
  rows: readonly T[];
  emptyText: string;
}) {
  return (
    <div className="overflow-x-auto border border-gray-400 border-t-0">
      <table className="w-full text-[11px] border-collapse">
        <thead className="bg-[#dedede]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.header}
                className={`px-1.5 py-1 text-[9px] font-bold text-gray-900 border-r border-gray-300 last:border-r-0 whitespace-nowrap ${c.align === "right" ? "text-right" : "text-left"} ${c.width ?? ""}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-1.5 py-2 text-[11px] italic text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-300">
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={`px-1.5 py-0.5 border-r border-gray-200 last:border-r-0 align-top ${c.align === "right" ? "text-right tabular-nums" : ""}`}
                >
                  {c.cell(r) || " "}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The footer strip, matching the PDF's. */
export function PreviewFooter({ printedOn }: { printedOn: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-1 pt-1.5 text-[10px] text-gray-500">
      <span>Page 1/1</span>
      <span>Report Printed:&nbsp;&nbsp;&nbsp;{printedOn}</span>
    </div>
  );
}

/** The white sheet a preview sits on, sized like the printed page. */
export function PreviewSheet({ children, wide }: {
  children: React.ReactNode;
  /** For the landscape reports — their PDFs are wider than letter portrait, and
   *  a preview pinched to 850px would wrap columns the printed page does not. */
  wide?: boolean;
}) {
  return (
    <div className={`bg-white border border-gray-300 shadow-sm mx-auto p-3 ${wide ? "max-w-[1180px]" : "max-w-[850px]"}`}>
      {children}
    </div>
  );
}

// ── report 01 ───────────────────────────────────────────────────────────────

const COST_COLUMNS: PreviewColumn<CostSummaryRow>[] = [
  { header: "Cost Des", cell: (r) => r.description ?? "" },
  { header: "Code 1", width: "w-16", cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: "w-16", cell: (r) => r.code2 ?? "" },
  { header: "AFE Amt (Cost)", width: "w-24", align: "right", cell: (r) => money(r.afeAmount) },
  { header: "Supp Amt (Cost)", width: "w-24", align: "right", cell: (r) => money(r.suppAmount) },
  { header: "Fld Est (Cost)", width: "w-24", align: "right", cell: (r) => money(r.fieldEstimate) },
  { header: "Final Invoice (Cost)", width: "w-24", align: "right", cell: (r) => money(r.finalInvoice) },
  { header: "Var (AFE-Fld) (Cost)", width: "w-24", align: "right", cell: (r) => money(r.variance) },
];

export function Report01Preview({ payload }: { payload: Report01Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.job]} />
      <HeaderGrid rows={[payload.totals]} />
      <NarrativeBlock label="Summary" text={payload.summary} />
      <SectionBar>Job Cost Summary</SectionBar>
      <PreviewTable
        columns={COST_COLUMNS}
        rows={payload.costRows}
        emptyText="No cost lines on this job yet — add them in Well Data → AFE &amp; Costs."
      />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
