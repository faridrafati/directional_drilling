/**
 * The OIEC / WellView operation-code system, as data.
 *
 * Source: the appendix of WELLVIEW_REPORT_SPEC.md, itself extracted from
 * `Wellview/Wellview Code.pdf` (the one-page code sheet) and
 * `Wellview/Driliing Operation reporting code.pdf` (OIEC "Time Distribution
 * Procedure for Drilling & Completion Operations", Rev. 0, 02/06/2017).
 *
 * Five vocabularies plus the matrix that ties two of them together:
 *
 *   MAIN_OPERATIONS   21 activity letters A–U            (Wellview Code 1)
 *   OPERATION_DETAILS 33 detail numbers 01–33            (Wellview Code 2)
 *   MATRIX            the 437 valid letter × detail cells (Tab. 7-1)
 *   TIME_INDICATORS   P/U/T/X/N                          (procedure §3)
 *   REPORT_CODES      P/N/T/U                            (the sheet's own list)
 *   WORKING_PHASES    the 10 phases with their triggers  (Tab. 4-1)
 *
 * TWO THINGS THIS MODULE IS DELIBERATE ABOUT
 * ------------------------------------------
 * 1. The wording is VERBATIM, typos included ("Slike Line", "None-Productive").
 *    A company man codes from the printed sheet; a report that silently spells
 *    it correctly no longer matches what they are reading.
 *
 * 2. `isValidCombination` is ADVISORY. The matrix's own footnote says "Codes
 *    given in the matrix … are not firmly fixed, therefore any other
 *    combination is possible", so an unlisted pair is a warning, never a
 *    rejection — which is also why none of the Entry* code columns carry a
 *    foreign key.
 *
 * SOURCE ERRATA, resolved here once (see the spec's Errata section):
 *   1. Procedure §6 numbers its last five details [29]–[33] but its own
 *      examples use the matrix numbering. The matrix and the code sheet win:
 *      29 = Change Production Level, 30 = Redress TSV, 31 = Redress SCSSV,
 *      32 = Test SCSSV.
 *   2. Detail 33 (Well Control) exists on the sheet only — no matrix column —
 *      and §6's text for it is a copy-paste of the Test SCSSV entry.
 *   3. Matrix row A column 9 is printed "A4"; column 4 is blank for row A, so
 *      it is read as A9 and seeded as such, with the note on the cell.
 *   4. Letter U (BOP) exists only on the sheet; the matrix folds BOP into row C.
 *   5. The sheet's "Report Code" letters collide with the procedure's
 *      indicators under different meanings, so they are two separate tables.
 */
import type { PrismaClient } from "@prisma/client";

// ── Wellview Code 1 — Main Operation (21 letters) ────────────────────────────
export interface MainOperationSeed {
  code: string;
  name: string;
  /** Tab. 7-1's row label, where it differs from the sheet's wording. */
  matrixLabel?: string;
  /** False only for U: the matrix has no BOP row (it is folded into C). */
  onMatrix?: boolean;
  riglessOnly?: boolean;
  note?: string;
}

export const MAIN_OPERATIONS: readonly MainOperationSeed[] = [
  { code: "A", name: "Moving (Rig up / Rig down)" },
  { code: "B", name: "Skidding" },
  {
    code: "C", name: "Wellhead", matrixLabel: "WELL_HEAD & B.O.P.",
    note: "The matrix merges wellhead and BOP into this one row; the code sheet splits them (C / U).",
  },
  { code: "D", name: "Conductor Pipe" },
  { code: "E", name: "Drilling" },
  { code: "F", name: "Sidetrack or Re-Drilling", matrixLabel: "Side track or re-drilling" },
  { code: "G", name: "Casing/Liner Job", matrixLabel: "Casing job" },
  { code: "H", name: "Cement Job", matrixLabel: "Cementing job" },
  { code: "I", name: "Coring" },
  { code: "J", name: "Logging" },
  { code: "K", name: "Well Completion" },
  { code: "L", name: "Well Decompletion" },
  { code: "M", name: "Well Preparation" },
  { code: "N", name: "Sand Control" },
  { code: "O", name: "Well Treatment/Stimulation", matrixLabel: "Wellbore treatment" },
  { code: "P", name: "Well Test & DST", matrixLabel: "Well test & D.S.T." },
  { code: "Q", name: "Well Abandoning" },
  {
    code: "R", name: "Slike Line", riglessOnly: true,
    note: "Printed \"Slike Line\" on the source sheet (sic — slick line); kept verbatim.",
  },
  { code: "S", name: "Coiled Tubing", riglessOnly: true },
  { code: "T", name: "Artificial Lift", riglessOnly: true },
  {
    code: "U", name: "BOP", onMatrix: false,
    note: "On the one-page code sheet only. Tab. 7-1 has no U row — BOP time is coded under C.",
  },
];

// ── Wellview Code 2 — Operation Detail (33 numbers) ──────────────────────────
export interface OperationDetailSeed {
  num: number;
  name: string;
  definition?: string;
  /** False only for 33 (Well Control): on the sheet, but no matrix column. */
  onMatrix?: boolean;
  note?: string;
}

export const OPERATION_DETAILS: readonly OperationDetailSeed[] = [
  { num: 1, name: "Preparation", definition: "Time in preparation operations for the main operation (e.g. A1-P prep of rig move, B1-P prep of skidding)." },
  { num: 2, name: "Rig or Equipment Moves", definition: "Moving the rig (moving & skidding) — A2-P moving, B2-P skidding." },
  { num: 3, name: "Rotation Hours on Bottom (Drilling)", definition: "Rotating hours of bit & coring; includes surface hole for conductor pipe, pilot hole, deepening for gravel pack, sidetracking and coring (E3-P drilling, I3-P coring, F3-T sidetrack after stuck pipe)." },
  { num: 4, name: "Trips", definition: "RIH/POOH of any object: BHA, casing, conductor pipe, completion string, logs, wireline, coiled tubing (G4-P casing running, K4-P completion running)." },
  { num: 5, name: "Installation/Disassembly", definition: "Rig-up/rig-down or equipment make-up/lay-down (B5-P rig-up, J5-P rig up logging unit)." },
  { num: 6, name: "Wiper Trip & Reaming", definition: "Wiper and short trips, including reaming to bottom." },
  { num: 7, name: "Circulation", definition: "Intermediate, on-bottom, kick control and bottoms-up circulation (E7-T kick control while drilling)." },
  { num: 8, name: "Fluids Preparation", definition: "Mud, pills and slurry mixing (H8-P cement/spacer prep)." },
  { num: 9, name: "Fluids Pumping in Well", definition: "Pumping fluids into the well (H9-P slurry & spacers)." },
  { num: 10, name: "Fluids/Core Recovery (cores, DST, soil test)", definition: "Recovery of core and DST fluids (I10-P core recovery, P10-P DST fluid recovery)." },
  { num: 11, name: "Measurement (Detection) in Well", definition: "Electric logs, surveys, flow check, L.O.T., F.I.T. and build-up recording (E11-P survey, P11-P build-up)." },
  { num: 12, name: "Equipment Test", definition: "BOP, wellhead, downhole motors and tools (C12-P BOP test, K12-P packer test)." },
  { num: 13, name: "Working-on/Fishing", definition: "Jar & bumper work, equipment malfunction (DV collar, liner hanger, packer), tool positioning/removal; trip time included." },
  { num: 14, name: "Milling", definition: "Mill/drill out float collar, shoe, dressing top of liner, casing mill-out (G14-P drill out float collar & shoe)." },
  { num: 15, name: "Through Tubing Operations", definition: "Operations on a completed well with coiled tubing, slick line or e-line (K15-P string calibration)." },
  { num: 16, name: "Shoot/Perforating", definition: "Perforating/shooting including trip time; also drill-string back-off and clearing bit nozzles (P16-P casing & tubing perforation)." },
  { num: 17, name: "Plugs & Squeezes", definition: "Setting plugs and squeezing fluids, trip time included (Q17-P abandonment plugs, H17-T squeeze re-cementing)." },
  { num: 18, name: "Casing & Tubing (Cut and Recovery)", definition: "Cut and recover a casing string in hole (Q18-P for abandonment)." },
  { num: 19, name: "Various Operations in Well", definition: "In-well operations not otherwise specified." },
  { num: 20, name: "Various Operations at Surface", definition: "Surface operations not otherwise specified." },
  { num: 21, name: "Waiting in General", definition: "W.O.C., pill effect, treatments; includes the time to secure the well and to resume." },
  { num: 22, name: "Waiting Environmental Conditions", definition: "W.O.W. and daylight; includes securing and resuming time." },
  { num: 23, name: "Waiting Materials, Services, Personnel (Company's)", definition: "Includes securing and resuming time." },
  { num: 24, name: "Waiting Materials, Services, Personnel (Contractor's)", definition: "Includes securing and resuming time." },
  { num: 25, name: "Maintenance & Repair", definition: "Includes securing and resuming time." },
  { num: 26, name: "Strike", definition: "Includes securing and resuming time." },
  { num: 27, name: "Not Accurate or Not Available", definition: "Used ONLY for non-operated wells." },
  { num: 28, name: "Hole Opening", definition: "Hole enlargement — rotation hours off bottom." },
  { num: 29, name: "Change Production Level", definition: "Change of production level, or partialization." },
  { num: 30, name: "Redress T.S.V.", definition: "POOH, redress and RIH tubing safety valves." },
  { num: 31, name: "Redress S.C.S.S.V.", definition: "POOH, redress and RIH surface-controlled subsurface safety valves." },
  { num: 32, name: "Test S.C.S.S.V.", definition: "Recording the S.C.S.S.V. test." },
  {
    num: 33, name: "Well Control", onMatrix: false,
    note: "On the one-page code sheet only — Tab. 7-1 has no column 33. Procedure §6's text for [33] is a verbatim copy of the Test S.C.S.S.V. entry (a source defect), so no definition is carried here.",
  },
];

// ── Time Breakdown Matrix (Tab. 7-1) ─────────────────────────────────────────
/** Inclusive integer range — the matrix prints its waiting block as "21–28". */
const through = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Valid detail numbers per activity letter, exactly as Tab. 7-1 marks them.
 * U has no row. 437 cells in total, asserted by `buildMatrix`.
 */
export const MATRIX_ROWS: Readonly<Record<string, number[]>> = {
  // Row A column 9 is printed "A4" in the source; column 4 is blank for row A,
  // so it is read as 9 (errata 3) and carries a note on the seeded cell.
  A: [1, 2, 9, 11, 12, 15, 16, 20, ...through(21, 28), 32],
  B: [1, 2, 5, 10, 12, 20, ...through(21, 28)],
  C: [1, 2, 4, 5, 7, 8, 9, 12, 13, 17, 20, ...through(21, 28), 32],
  D: [1, 4, 5, 7, 11, 12, 13, 14, 19, 20, ...through(21, 28)],
  E: [1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 19, 20, ...through(21, 28)],
  F: [1, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, ...through(21, 28)],
  G: [1, 4, 5, 6, 7, 8, 9, 12, 13, 14, 17, 19, 20, ...through(21, 28)],
  H: [1, 2, 4, 5, 6, 7, 8, 9, 12, 13, 16, 17, 19, 20, ...through(21, 28), 29],
  I: [1, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 19, 20, ...through(21, 28)],
  J: [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 19, 20, ...through(21, 28)],
  K: [1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20, ...through(21, 28)],
  L: [1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...through(21, 28)],
  M: [1, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 16, 17, 18, 19, 20, ...through(21, 28)],
  N: [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, ...through(21, 28)],
  O: [1, 2, 4, 5, 7, 8, 9, 11, 12, 13, 15, 17, 19, 20, ...through(21, 28)],
  P: [1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 15, 16, 17, 19, 20, ...through(21, 28), 29],
  Q: [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, ...through(21, 28)],
  R: [2, 7, 8, 9, 11, 12, 15, 16, 17, 20, 21, 22, 23, 24, 26, 29, 30, 31],
  S: [2, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 29, 30, 31],
  T: [2, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 26, 29, 30, 31],
};

/** The number of marked cells Tab. 7-1 prints. A mismatch is a spec drift. */
export const MATRIX_CELL_COUNT = 437;

export interface MatrixCellSeed { letter: string; detailNum: number; note?: string }

/**
 * Flatten MATRIX_ROWS into cells, and THROW if the total is not 437.
 *
 * The assertion is the point: the row lists are hand-transcribed from a printed
 * matrix, and a dropped or doubled number would otherwise become a validation
 * rule nobody notices is wrong.
 */
export function buildMatrix(): MatrixCellSeed[] {
  const cells: MatrixCellSeed[] = [];
  for (const [letter, details] of Object.entries(MATRIX_ROWS)) {
    const seen = new Set<number>();
    for (const detailNum of details) {
      if (seen.has(detailNum)) {
        throw new Error(`Time Breakdown Matrix: row ${letter} lists detail ${detailNum} twice`);
      }
      seen.add(detailNum);
      cells.push({
        letter,
        detailNum,
        note: letter === "A" && detailNum === 9
          ? "Tab. 7-1 prints this cell as \"A4\"; column 4 is blank for row A, so it is read as A9."
          : undefined,
      });
    }
  }
  if (cells.length !== MATRIX_CELL_COUNT) {
    throw new Error(
      `Time Breakdown Matrix: built ${cells.length} cells, expected ${MATRIX_CELL_COUNT} — ` +
      "MATRIX_ROWS has drifted from Tab. 7-1",
    );
  }
  return cells;
}

// ── procedure §3 indicators, and the sheet's own report codes ────────────────
export const TIME_INDICATORS = [
  { code: "P", name: "Planned", definition: "Operations in the original well plan/objective and in the authorized budget (AFE) — including anticipated problems such as expected lost circulation." },
  { code: "U", name: "Unplanned", definition: "Operations not in the original plan or AFE; typically Exploration Dept requests — extra logging runs, an extra casing string, deepening beyond approved TD." },
  { code: "T", name: "Trouble", definition: "Any trouble delaying a PLANNED operation; includes the time to resolve it and to regain the point or depth where the event occurred." },
  { code: "X", name: "Unplanned Trouble", definition: "Trouble occurring during an UNPLANNED operation (e.g. stuck pipe while unplanned deepening); the same to-restore-point rule applies." },
  { code: "N", name: "Non-Productive Time", definition: "Listed in procedure §3 without further definition." },
] as const;

/**
 * The one-page sheet's four "Report Code" entries.
 *
 * Kept apart from TIME_INDICATORS on purpose: the letters overlap with
 * different meanings — sheet P = Productive vs procedure P = Planned, sheet
 * U = Un-Planned vs procedure U = Unplanned — and folding them together would
 * silently re-classify time.
 */
export const REPORT_CODES = [
  { code: "P", name: "Productive" },
  { code: "N", name: "None-Productive" },
  { code: "T", name: "Trouble" },
  { code: "U", name: "Un-Planned" },
] as const;

// ── Working Phases (Tab. 4-1) ────────────────────────────────────────────────
export const WORKING_PHASES = [
  {
    code: "MOVING", name: "RIG or Rigless Equipment MOVING",
    purpose: "Move the rig or rigless equipment to location (moving, positioning, rig-up).",
    startsAt: "Contract commencement",
    endsAt: "End of rig / rigless equipment testing",
  },
  {
    code: "PRELIMINARY", name: "PRELIMINARY",
    purpose: "Start drilling / completion / workover activities (conductor pipe, skidding, killing).",
    startsAt: "End of rig testing",
    endsAt: "Start of the Re-Entry / Drilling / Workover phase",
  },
  {
    code: "RE_ENTRY", name: "RE-ENTRY",
    purpose: "Restart activity on an existing well (wellhead & BOP operations, milling, plugging).",
    startsAt: "First tool ready to run in hole",
    endsAt: "RIH of the first bit to start drilling",
  },
  {
    code: "DRILLING", name: "DRILLING",
    purpose: "Reach planned depth.",
    startsAt: "RIH of the first bit to drill the phase (each drilling phase starts at RIH of its first bit)",
    endsAt: "Exploration: end of the last log / final depth. Development: end of operations on the production casing with bit-scraper on bottom",
  },
  {
    code: "WORKOVER", name: "WORKOVER",
    purpose: "Heavy: pull the completion and mechanically restore. Light: inspect / restore / modify without pulling.",
    // Tab. 4-1 prints "—" in this cell; null, never the literal dash.
    startsAt: null,
    endsAt: "Heavy: end of restoration on the production casing with bit-scraper on bottom. Light: start of well testing",
  },
  {
    code: "COMPLETION", name: "COMPLETION",
    purpose: "Configure the well completion.",
    startsAt: "First tool through the master valve",
    endsAt: "First completion: as the Drilling-end rules. Other completions: end of restoration with bit-scraper on bottom. Also: end of make-up of the production cross",
  },
  {
    code: "WELL_TESTING", name: "WELL TESTING",
    purpose: "Perform well testing.",
    startsAt: "Start of RIH of the well-testing string",
    endsAt: "D.S.T.: to start of abandonment / completion phase / drilling restart. Production test: from well start-up or start of abandonment",
  },
  {
    code: "WELL_ABANDONING", name: "WELL ABANDONING",
    purpose: "Permanent or temporary abandonment.",
    startsAt: "Start of RIH of DP / wireline / CT to set the first plug (cement, bridge, etc.)",
    endsAt: "End of operations on the well",
  },
  {
    code: "SECURE_WELL", name: "SECURE THE WELL",
    purpose: "Secure the well (RIH plugs or B.P.V., redress TSV/SCSSV, test SCSSV).",
    startsAt: "Start of RIH of the first tool",
    endsAt: "Well start-up or start of another working phase",
  },
  {
    code: "PRODUCTION_MAINTENANCE", name: "PRODUCTION MAINTENANCE",
    purpose: "Production maintenance (gradient survey, acid job, washing job).",
    startsAt: "Start of RIH of the first tool",
    endsAt: "Well start-up or start of another working phase",
  },
] as const;

// ── activity-code parsing and (advisory) validation ──────────────────────────

/** `{letter}{detail}-{indicator}`, e.g. "E3-P", "G21-P", "F3-X". */
const ACTIVITY_CODE = /^([A-U])(\d{1,2})-([PUTXN])$/i;

export interface ParsedActivityCode {
  opLetter: string;
  /** Zero-padded to two digits, matching WvOperationDetail.code. */
  opDetail: string;
  timeIndicator: string;
}

/**
 * Split a printed activity code into its three parts, or null.
 *
 * Null is the normal answer for a legacy op code — the archive is full of
 * numeric codes and the literal "INACTIVE" — so callers must treat it as
 * "not a WellView code", never as an error.
 */
export function parseActivityCode(raw: string | null | undefined): ParsedActivityCode | null {
  const m = ACTIVITY_CODE.exec((raw ?? "").trim());
  if (!m) return null;
  const detail = Number(m[2]);
  if (detail < 1 || detail > 33) return null;
  return {
    opLetter: m[1].toUpperCase(),
    opDetail: String(detail).padStart(2, "0"),
    timeIndicator: m[3].toUpperCase(),
  };
}

const MATRIX_LOOKUP = new Set(
  Object.entries(MATRIX_ROWS).flatMap(([letter, ds]) => ds.map((d) => `${letter}${d}`)),
);

/**
 * Is this letter × detail pair marked in Tab. 7-1?
 *
 * ADVISORY ONLY — the matrix footnote reads "Codes given in the matrix … are
 * not firmly fixed, therefore any other combination is possible". Callers warn;
 * nothing in this application rejects a save because of this answer.
 */
export function isValidCombination(letter: string, detail: string | number): boolean {
  const n = typeof detail === "number" ? detail : Number(detail);
  if (!Number.isFinite(n)) return false;
  return MATRIX_LOOKUP.has(`${letter.toUpperCase()}${n}`);
}

/**
 * The advisory sentence to show beside a coded time entry, or null when there
 * is nothing to say. Every branch is a warning the user may ignore.
 */
export function activityCodeWarning(
  letter: string | null | undefined,
  detail: string | null | undefined,
): string | null {
  const l = (letter ?? "").trim().toUpperCase();
  const d = (detail ?? "").trim();
  if (!l && !d) return null;
  if (!l || !d) return "An activity code needs both a main-operation letter and a detail number.";
  if (!MAIN_OPERATIONS.some((o) => o.code === l)) return `"${l}" is not one of the main-operation letters A–U.`;
  const n = Number(d);
  if (!Number.isFinite(n) || n < 1 || n > 33) return `"${d}" is not one of the operation details 01–33.`;
  if (l === "U") return "BOP (U) has no row in the Time Breakdown Matrix — the matrix codes BOP time under C.";
  if (n === 33) return "Well Control (33) is on the code sheet but has no Time Breakdown Matrix column.";
  if (!isValidCombination(l, n)) {
    return `${l}${d} is not marked in the Time Breakdown Matrix. The matrix allows other combinations, so this is only a note.`;
  }
  return null;
}

// ── seeding ─────────────────────────────────────────────────────────────────

/**
 * Upsert every code table. Idempotent and re-runnable — it never deletes, so a
 * correction to this file lands on the next boot without touching the reports
 * that already reference a code.
 *
 * Called from server.ts beside `seedAdmin`, which is how this app already
 * bootstraps reference data; there is no separate seed step to forget.
 */
export async function seedWellviewCodes(
  prisma: PrismaClient,
  log: (msg: string) => void,
): Promise<void> {
  // Built first: a drift in MATRIX_ROWS must fail before anything is written.
  const cells = buildMatrix();

  for (const [i, op] of MAIN_OPERATIONS.entries()) {
    const data = {
      name: op.name, order: i + 1, matrixLabel: op.matrixLabel ?? null,
      onMatrix: op.onMatrix ?? true, riglessOnly: op.riglessOnly ?? false,
      note: op.note ?? null,
    };
    await prisma.wvMainOperation.upsert({
      where: { code: op.code }, create: { code: op.code, ...data }, update: data,
    });
  }

  for (const d of OPERATION_DETAILS) {
    const code = String(d.num).padStart(2, "0");
    const data = {
      num: d.num, name: d.name, definition: d.definition ?? null,
      onMatrix: d.onMatrix ?? true, note: d.note ?? null,
    };
    await prisma.wvOperationDetail.upsert({
      where: { code }, create: { code, ...data }, update: data,
    });
  }

  for (const c of cells) {
    await prisma.wvMatrixCell.upsert({
      where: { letter_detailNum: { letter: c.letter, detailNum: c.detailNum } },
      create: { letter: c.letter, detailNum: c.detailNum, note: c.note ?? null },
      update: { note: c.note ?? null },
    });
  }

  for (const [i, t] of TIME_INDICATORS.entries()) {
    const data = { name: t.name, definition: t.definition, order: i + 1 };
    await prisma.wvTimeIndicator.upsert({
      where: { code: t.code }, create: { code: t.code, ...data }, update: data,
    });
  }

  for (const [i, r] of REPORT_CODES.entries()) {
    const data = { name: r.name, order: i + 1 };
    await prisma.wvReportCode.upsert({
      where: { code: r.code }, create: { code: r.code, ...data }, update: data,
    });
  }

  for (const [i, p] of WORKING_PHASES.entries()) {
    const data = {
      name: p.name, purpose: p.purpose, startsAt: p.startsAt ?? null,
      endsAt: p.endsAt, order: i + 1,
    };
    await prisma.wvWorkingPhase.upsert({
      where: { code: p.code }, create: { code: p.code, ...data }, update: data,
    });
  }

  log(
    `[wellview] codes ready — ${MAIN_OPERATIONS.length} main operations, ` +
    `${OPERATION_DETAILS.length} details, ${cells.length} matrix cells, ` +
    `${TIME_INDICATORS.length} indicators, ${WORKING_PHASES.length} working phases`,
  );
}
