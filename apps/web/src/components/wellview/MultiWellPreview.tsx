/**
 * On-screen previews of the multi-well reports — 15 (Problem Cost by
 * Accountable Party) and 17 (Safety Incidents).
 *
 * Both open with the SAME well list, drawn by `WellSetBlock`: a multi-well
 * report has to say which wells it covers, or a reader has no way to know
 * whether a well is absent because it had no incidents or because it was never
 * selected. The block also states, in amber, how many requested wells the
 * account may not see — a silently shorter report is a wrong report.
 */
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  Report15Payload, Report17Payload, SafetyIncidentReportRow, WellRef,
} from "../../entry/wellview.js";
import {
  HeaderGrid, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

/** The exporter looks report 15's chart up by this. */
export const PROBLEM_COST_CHART_ID = "wellview-problem-cost";

const WELL_COLUMNS: PreviewColumn<WellRef>[] = [
  { header: "Well Name", cell: (w) => w.name },
  { header: "API Number", width: "w-40", cell: (w) => w.apiUwi ?? "" },
  { header: "Field Name", width: "w-28", cell: (w) => w.field ?? "" },
  { header: "County", width: "w-24", cell: (w) => w.county ?? "" },
  { header: "State", width: "w-24", cell: (w) => w.stateProvince ?? "" },
  { header: "License No.", width: "w-28", cell: (w) => w.licenseNo ?? "" },
  { header: "Ground Elevation (m)", width: "w-24", align: "right", cell: (w) => headerValue(w.groundElevation) },
  { header: "KB Elevation (m)", width: "w-24", align: "right", cell: (w) => headerValue(w.kbElevation) },
];

/** The well set the report covers, and anything it could not cover. */
export function WellSetBlock({ wells, dropped }: { wells: WellRef[]; dropped: number }) {
  return (
    <>
      <SectionBar>Wells</SectionBar>
      <PreviewTable
        columns={WELL_COLUMNS}
        rows={wells}
        emptyText="No well selected, and none assigned to this account."
      />
      {dropped > 0 && (
        <div className="border border-t-0 border-gray-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          {dropped} requested well{dropped === 1 ? " is" : "s are"} not shown — this account is not
          assigned to {dropped === 1 ? "it" : "them"}, so {dropped === 1 ? "its" : "their"} rows are
          not in the figures below.
        </div>
      )}
    </>
  );
}

/* ══ report 15 ═══════════════════════════════════════════════════════════════ */

/** Enough distinct colours for the stack; it repeats past this, in order. */
const STACK_COLOURS = [
  "#1d4ed8", "#b45309", "#047857", "#7c3aed", "#be123c",
  "#0891b2", "#a16207", "#4d7c0f", "#9333ea", "#dc2626",
];

const CELL_COLUMNS: PreviewColumn<{
  party: string; kind: string; cost: number; lostTimeHr: number | null; count: number;
}>[] = [
  { header: "Accountable Party", width: "w-40", cell: (c) => c.party },
  { header: "Problem - Sub Type", cell: (c) => c.kind },
  { header: "Problems", width: "w-20", align: "right", cell: (c) => headerValue(c.count, "int") },
  { header: "Est Cost (Cost)", width: "w-28", align: "right", cell: (c) => money(c.cost) },
  { header: "Est Lost Time (hr)", width: "w-24", align: "right", cell: (c) => headerValue(c.lostTimeHr) },
];

export function Report15Preview({ payload }: { payload: Report15Payload }) {
  // Recharts stacks from ONE row per X value with a key per series, so the
  // (party, kind) cells are pivoted into that shape here. A kind that did not
  // occur for a party is left undefined rather than set to 0 — a zero-height
  // segment still claims a legend entry and a tooltip line.
  const data = payload.parties.map((p) => {
    const row: Record<string, string | number> = { party: p.party };
    for (const cell of payload.cells) {
      if (cell.party === p.party) row[cell.kind] = cell.cost;
    }
    return row;
  });

  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />

      <SectionBar>Problem Cost by Accountable Party</SectionBar>
      {payload.parties.length === 0 ? (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          No interval problem recorded on these wells in this range. Problems are entered on the
          daily sheet, under Events &amp; HSE.
        </div>
      ) : (
        <div id={PROBLEM_COST_CHART_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={data} margin={{ top: 4, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="party" tick={{ fontSize: 10 }} interval={0}
                label={{ value: "Accountable Party", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }} width={72}
                label={{ value: "Est Cost", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <Tooltip formatter={(v: number | string) => money(Number(v))} />
              {/* Above the plot, so the axis caption has the bottom to itself. */}
              <Legend verticalAlign="top" height={payload.kinds.length > 4 ? 38 : 20} wrapperStyle={{ fontSize: 10 }} />
              {payload.kinds.map((kind, i) => (
                <Bar
                  key={kind} dataKey={kind} name={kind} stackId="cost"
                  fill={STACK_COLOURS[i % STACK_COLOURS.length]}
                  // Capped: with two or three parties Recharts spreads the bars
                  // to fill the axis, and a chart of two 400px slabs reads as a
                  // fill pattern rather than a comparison.
                  maxBarSize={110}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <SectionBar>Problems, by party and kind</SectionBar>
      <PreviewTable
        columns={CELL_COLUMNS}
        rows={payload.cells}
        emptyText="Nothing to pivot."
      />
      <HeaderGrid rows={[payload.totals]} />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 17 ═══════════════════════════════════════════════════════════════ */

const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");

const INCIDENT_COLUMNS: PreviewColumn<SafetyIncidentReportRow>[] = [
  { header: "Type", width: "w-28", cell: (i) => i.type ?? "" },
  { header: "SubTyp", width: "w-24", cell: (i) => i.subType ?? "" },
  { header: "Date", width: "w-24", cell: (i) => i.date },
  { header: "Severity", width: "w-20", cell: (i) => i.severity ?? "" },
  { header: "Cause", width: "w-32", cell: (i) => i.cause ?? "" },
  { header: "Lost time?", width: "w-20", cell: (i) => yesNo(i.lostTime) },
  { header: "Com", cell: (i) => i.com ?? "" },
  { header: "Job Typ", width: "w-28", cell: (i) => i.jobType ?? "" },
  { header: "Well Name", width: "w-36", cell: (i) => i.wellName },
];

export function Report17Preview({ payload }: { payload: Report17Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <WellSetBlock wells={payload.wells} dropped={payload.droppedWells} />

      <SectionBar>Safety Incidents</SectionBar>
      <PreviewTable
        columns={INCIDENT_COLUMNS}
        rows={payload.incidents}
        emptyText="No safety incident recorded on these wells in this range."
      />
      <HeaderGrid rows={[payload.totals]} />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
