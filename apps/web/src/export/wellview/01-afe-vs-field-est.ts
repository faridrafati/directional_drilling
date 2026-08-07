/**
 * Report 01 — AFE vs Field Est vs Final Invoice, as a generated PDF.
 *
 * Built from the SAME server payload the on-screen preview renders, through the
 * shared builders in `../reportChrome.ts`, so the page and the preview cannot
 * disagree about a label, a column order, a blank cell or a computed variance.
 * Nothing is recomputed here — every number arrives from the assembler.
 *
 * Layout follows `Wellview/01_AFEvsFieldEstvsFinalInvoice.pdf` top to bottom:
 * centred title · Well Name line · 6+6 well header · job row · AFE totals row ·
 * Summary · the "Job Cost Summary" grey bar and its table · footer.
 *
 * Column widths are the sample's, scaled from its 612 pt page to our body
 * width: Cost Des is the wide elastic column, the two code columns are narrow,
 * and the five money columns are equal and right-aligned.
 */
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import { pdfMake } from "../pdfmakeSetup.js";
import {
  LETTER_PORTRAIT, PAGE_MARGINS, REPORT_STYLES,
  identityLine, labelValueGrid, money, narrativeBlock, pageFrame,
  reportFooter, reportTable, sectionBar, titleBand,
  type ReportColumn,
} from "../reportChrome.js";
import type { CostSummaryRow, Report01Payload } from "../../entry/wellview.js";

/** The sample's own column widths, in points on a 612 pt page. */
const COST_COLUMNS: ReportColumn<CostSummaryRow>[] = [
  { header: "Cost Des", width: "*", cell: (r) => r.description ?? "" },
  { header: "Code 1", width: 46, cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: 46, cell: (r) => r.code2 ?? "" },
  { header: "AFE Amt (Cost)", width: 58, align: "right", cell: (r) => money(r.afeAmount) },
  { header: "Supp Amt (Cost)", width: 58, align: "right", cell: (r) => money(r.suppAmount) },
  { header: "Fld Est (Cost)", width: 58, align: "right", cell: (r) => money(r.fieldEstimate) },
  { header: "Final Invoice (Cost)", width: 62, align: "right", cell: (r) => money(r.finalInvoice) },
  { header: "Var (AFE-Fld) (Cost)", width: 62, align: "right", cell: (r) => money(r.variance) },
];

export function buildReport01Doc(payload: Report01Payload): TDocumentDefinitions {
  return {
    pageSize: { width: LETTER_PORTRAIT[0], height: LETTER_PORTRAIT[1] },
    pageOrientation: "portrait",
    pageMargins: PAGE_MARGINS,
    info: {
      title: `${payload.title} — ${payload.wellName}`,
      subject: `AFE, field estimate and final invoice for ${payload.wellName}`,
    },
    // The frame is page furniture, so it is drawn in the background rather than
    // as content — content would push the body down on every page.
    background: () => pageFrame(),
    header: () => titleBand(payload.title),
    footer: reportFooter(payload.printedOn),
    content: [
      identityLine(payload.wellName),
      labelValueGrid(payload.header),
      labelValueGrid([payload.job]),
      labelValueGrid([payload.totals]),
      narrativeBlock("Summary", payload.summary),
      sectionBar("Job Cost Summary"),
      reportTable(COST_COLUMNS, payload.costRows),
    ],
    styles: { ...REPORT_STYLES },
    defaultStyle: { font: "Roboto", fontSize: 7.7 },
  };
}

/** `WELL_afe_vs_field_est.pdf`, with anything non-word collapsed. */
function fileName(payload: Report01Payload): string {
  const slug = (s: string) => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");
  return `${[slug(payload.wellName), "afe_vs_field_est"].filter(Boolean).join("_")}.pdf`;
}

export async function exportReport01Pdf(payload: Report01Payload): Promise<void> {
  pdfMake.createPdf(buildReport01Doc(payload)).download(fileName(payload));
}
