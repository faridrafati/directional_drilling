/**
 * The chrome every WellView report shares: the well-header block and the page
 * footer.
 *
 * Built SERVER-side, as data, so the on-screen preview and the pdfmake export
 * render the same rows from the same payload and cannot disagree about a label,
 * a unit or which cells are blank. The client decides how to draw a
 * `HeaderRow[]`; it never decides what is in one.
 *
 * The 30 samples use several header forms. They differ only in WHICH cells
 * appear and how many rows they occupy, so one `HeaderCell` shape covers all of
 * them and each report names its variant.
 *
 * UNITS: the samples are US-unit (ftKB, ft). We reproduce the label TEXT and the
 * column order and print our own unit token — mKB, m — because the values are
 * metric. Nothing here converts a number.
 */
import { toJalali } from "@dd/shared";

/**
 * One printed cell: a label with its value beneath. A null value prints blank.
 *
 * `kind` is how the ASSEMBLER declares what a number means, so the renderers do
 * not have to guess from its type. They did guess once — `Number.isInteger` —
 * and printed the sample's "10,218,000.00" as "10,218,000", because the value
 * happened to be a round number. Money and measurements always carry two
 * decimals on these reports; a count never does.
 */
export interface HeaderCell {
  label: string;
  value: string | number | null;
  /**
   * "money" and "decimal" both print thousands separators and two decimals;
   * they are distinguished so a currency column can diverge later without
   * touching every measurement. "int" prints no decimals. "in3" prints THREE —
   * a casing ID or drift is quoted to a thousandth of an inch, and rounding
   * 12.415 to 12.42 loses the very digit a drift check turns on. Default for a
   * number is "decimal"; a string is always "text".
   */
  kind?: "money" | "decimal" | "int" | "in3" | "text";
  /** Cells this one spans in its row. Default 1. */
  span?: number;
}
export type HeaderRow = HeaderCell[];

/** The header forms the samples actually use. */
export type HeaderVariant =
  | "standard"      // 01, 04, 05 — 6 + 6, drilling elevations
  | "dailyDrilling" // 06, 07     — 3 × 6, with the cost and weather cells
  | "wellJob"       // 10, 11     — well row, then a job row
  | "none";         // 02, 15, 17, 19, 20, 25 — identity line only

/** What every report's envelope carries. */
export interface ReportEnvelope {
  /** The `NN` prefix of the sample this reproduces. */
  type: string;
  /** Printed title. Empty for the samples that print none (13, 15, 16, 25). */
  title: string;
  /** The bold identity line above the header block, e.g. the well name. */
  wellName: string;
  /** Right-hand side of the identity line, where a report has one. */
  identityRight?: string | null;
  headerVariant: HeaderVariant;
  header: HeaderRow[];
  /** Jalali "YYYY/MM/DD" — the footer's "Report Printed". */
  printedOn: string;
}

/** The well columns every header variant draws from. */
export interface WellHeaderSource {
  name: string;
  field: string | null;
  apiUwi: string | null;
  licenseNo: string | null;
  stateProvince: string | null;
  location: string | null;
  profile: string | null;
  groundElevation: number | null;
  casingFlangeElevation: number | null;
  kbGroundDistance: number | null;
  kbCasingFlangeDistance: number | null;
  spudDate: string | null;
  rigReleasedDate: string | null;
}

/**
 * The 6 + 6 header of reports 01, 04 and 05, in printed order.
 *
 * Empty cells are KEPT, not dropped: the sample prints "Surface Legal Location"
 * and "Ground Elevation" as labelled blanks, and a header that silently shrinks
 * when a well is half-filled stops being the same document.
 */
export function standardWellHeader(w: WellHeaderSource): HeaderRow[] {
  return [
    [
      { label: "API/UWI", value: w.apiUwi },
      { label: "Surface Legal Location", value: w.location },
      { label: "Field Name", value: w.field },
      { label: "License #", value: w.licenseNo },
      { label: "State/Province", value: w.stateProvince },
      { label: "Well Configuration Type", value: w.profile },
    ],
    [
      { label: "Ground Elevation (m)", value: w.groundElevation, kind: "decimal" },
      { label: "Casing Flange Elevation (m)", value: w.casingFlangeElevation, kind: "decimal" },
      { label: "KB-Ground Distance (m)", value: w.kbGroundDistance, kind: "decimal" },
      { label: "KB-Casing Flange Distance (m)", value: w.kbCasingFlangeDistance, kind: "decimal" },
      { label: "Spud Date", value: w.spudDate },
      { label: "Rig Release Date", value: w.rigReleasedDate },
    ],
  ];
}

/** Today, as the footer prints it. Jalali, like every other date in this app. */
export function printedOn(now: Date = new Date()): string {
  return toJalali(now);
}
