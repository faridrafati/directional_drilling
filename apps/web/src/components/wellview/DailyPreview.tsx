/**
 * On-screen preview of reports 06 (Daily Drilling) and 07 (Detail).
 *
 * One component for both, as with the assembler: 07 is 06 plus more, and two
 * previews would drift. `payload.detail` being present is what switches it.
 *
 * The sample's layout is a wide left column (time log, mud checks, drill
 * strings, drilling parameters) beside a narrow right sidebar (contacts, rig,
 * pumps, additives, safety checks, wellbores) — reproduced here with a grid, and
 * stacked on a narrow screen because a two-column report is unreadable at 375px.
 */
import { headerValue, money } from "../../export/reportChrome.js";
import type { DailyPayload, DrillingParamRow, TimeLogRow } from "../../entry/wellview.js";
import {
  HeaderGrid, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

/** A sub-heading inside a section — the sample's block captions. */
function BlockCaption({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-100 border border-gray-400 border-t-0 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
      {children}
    </div>
  );
}

const TIME_LOG_06: PreviewColumn<TimeLogRow>[] = [
  { header: "Start Time", width: "w-16", cell: (r) => r.startTime ?? "" },
  { header: "End Time", width: "w-16", cell: (r) => r.endTime ?? "" },
  { header: "Dur (hr)", width: "w-14", align: "right", cell: (r) => headerValue(r.durHr) },
  { header: "Cum Dur (hr)", width: "w-16", align: "right", cell: (r) => headerValue(r.cumDurHr) },
  { header: "Code 1", width: "w-14", cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: "w-16", cell: (r) => r.code2 ?? "" },
  { header: "Com", cell: (r) => r.com ?? "" },
];

const TIME_LOG_07: PreviewColumn<TimeLogRow>[] = [
  { header: "Start Time", width: "w-16", cell: (r) => r.startTime ?? "" },
  { header: "Dur (hr)", width: "w-14", align: "right", cell: (r) => headerValue(r.durHr) },
  { header: "Cum Dur (hr)", width: "w-16", align: "right", cell: (r) => headerValue(r.cumDurHr) },
  { header: "End Time", width: "w-16", cell: (r) => r.endTime ?? "" },
  { header: "Code 1", width: "w-14", cell: (r) => r.code1 ?? "" },
  { header: "Code 2", width: "w-16", cell: (r) => r.code2 ?? "" },
  // Yes / blank, never "No": the sample leaves a clean interval's cell empty.
  { header: "Problem ?", width: "w-14", cell: (r) => (r.isProblem ? "Yes" : "") },
  { header: "Prob Hrs (hr)", width: "w-14", align: "right", cell: (r) => headerValue(r.probHr) },
  { header: "Prob Ref #", width: "w-14", align: "right", cell: (r) => headerValue(r.probRef, "int") },
  { header: "Com", cell: (r) => r.com ?? "" },
];

const PARAMS_06: PreviewColumn<DrillingParamRow>[] = [
  { header: "Wellbore", width: "w-28", cell: (r) => r.wellbore ?? "" },
  { header: "Start (mKB)", width: "w-20", align: "right", cell: (r) => headerValue(r.startMkb) },
  { header: "End Depth (mKB)", width: "w-20", align: "right", cell: (r) => headerValue(r.endDepthMkb) },
  { header: "Cum Depth (m)", width: "w-20", align: "right", cell: (r) => headerValue(r.cumDepthM) },
  { header: "Cum Drill Time (hr)", width: "w-20", align: "right", cell: (r) => headerValue(r.cumDrillTimeHr) },
  { header: "Int ROP (m/hr)", width: "w-20", align: "right", cell: (r) => headerValue(r.intRopMHr) },
  { header: "Q Flow (gpm)", width: "w-20", align: "right", cell: (r) => headerValue(r.qFlowGpm) },
  { header: "WOB (1000lbf)", width: "w-20", align: "right", cell: (r) => headerValue(r.wob1000Lbf) },
  { header: "RPM (rpm)", width: "w-16", align: "right", cell: (r) => headerValue(r.rpm) },
  { header: "SPP (psi)", width: "w-20", align: "right", cell: (r) => headerValue(r.sppPsi) },
  { header: "Drill Str Wt (1000lbf)", width: "w-20", align: "right", cell: (r) => headerValue(r.drillStrWtKlbf) },
  { header: "PU Str Wt (1000lbf)", width: "w-20", align: "right", cell: (r) => headerValue(r.puStrWtKlbf) },
  { header: "Drill Tq", width: "w-16", align: "right", cell: (r) => headerValue(r.drillTq) },
];

const PARAMS_07: PreviewColumn<DrillingParamRow>[] = [
  ...PARAMS_06,
  { header: "SO Str Wt (1000lbf)", width: "w-20", align: "right", cell: (r) => headerValue(r.soStrWtKlbf) },
  { header: "Off Bottom Torque", width: "w-20", align: "right", cell: (r) => headerValue(r.offBottomTorque) },
];

export function DailyPreview({ payload }: { payload: DailyPayload }) {
  const d = payload.detail;
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <div className="flex items-baseline justify-between gap-3 px-1 pb-1">
        <div className="text-[12px] font-bold text-gray-900 truncate">
          <span className="text-gray-500 font-semibold">Well Name:&nbsp;&nbsp;</span>
          {payload.wellName}
        </div>
      </div>
      <HeaderGrid rows={[payload.titleFields]} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={payload.operations} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-0 lg:gap-2 mt-2">
        {/* ── wide left column ── */}
        <div className="min-w-0">
          <SectionBar>
            Time Log
            {payload.timeLogTotalHr !== null && (
              <span className="float-right font-normal text-gray-600">
                {headerValue(payload.timeLogTotalHr)} hr of 24
              </span>
            )}
          </SectionBar>
          <PreviewTable
            columns={d ? TIME_LOG_07 : TIME_LOG_06}
            rows={payload.timeLog}
            emptyText="No operations logged on this day."
          />

          <SectionBar>Mud Checks</SectionBar>
          {payload.mudChecks.length === 0 ? (
            <Empty>No mud check on this day.</Empty>
          ) : payload.mudChecks.map((c, i) => (
            <div key={i}>
              <BlockCaption>{c.caption}</BlockCaption>
              <HeaderGrid rows={c.fields} />
            </div>
          ))}

          <SectionBar>Drill Strings</SectionBar>
          {payload.drillStrings.length === 0 ? (
            <Empty>No drill string on this day.</Empty>
          ) : payload.drillStrings.map((s, i) => (
            <div key={i}>
              <BlockCaption>{s.caption}</BlockCaption>
              <HeaderGrid rows={[s.fields]} />
              {d ? (
                <>
                  <BlockCaption>Drill String Components</BlockCaption>
                  <PreviewTable
                    columns={[
                      { header: "Item Des", cell: (c) => c.itemDes ?? "" },
                      { header: "Jts", width: "w-12", align: "right", cell: (c) => headerValue(c.jts, "int") },
                      { header: "OD (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.odIn, "decimal") },
                      { header: "ID (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.idIn, "decimal") },
                      { header: "Len (m)", width: "w-20", align: "right", cell: (c) => headerValue(c.lenM) },
                      { header: "Top Thread", width: "w-20", cell: (c) => c.topThread ?? "" },
                    ]}
                    rows={s.tally}
                    emptyText="No components recorded."
                  />
                </>
              ) : (
                <LabelledText label="String Components" text={s.components} />
              )}
              <LabelledText label="Comment" text={s.comment} />
            </div>
          ))}

          <SectionBar>Drilling Parameters</SectionBar>
          <PreviewTable
            columns={d ? PARAMS_07 : PARAMS_06}
            rows={payload.drillingParameters}
            emptyText="No drilled interval on this day."
          />

          {d && (
            <>
              <SectionBar>Drilling Mud Volumes</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Action", cell: (v) => v.action ?? "" },
                  { header: "To well (bbl)", width: "w-24", align: "right", cell: (v) => headerValue(v.toWellBbl) },
                  { header: "From well (bbl)", width: "w-24", align: "right", cell: (v) => headerValue(v.fromWellBbl) },
                  { header: "Cum to Well (bbl)", width: "w-24", align: "right", cell: (v) => headerValue(v.cumToWellBbl) },
                  { header: "Cum from Well (bbl)", width: "w-24", align: "right", cell: (v) => headerValue(v.cumFromWellBbl) },
                ]}
                rows={d.mudVolumes}
                emptyText="No mud moved on this day."
              />

              <SectionBar>Hydraulic Calculations</SectionBar>
              <HeaderGrid rows={d.hydraulics} />

              <SectionBar>Kicks</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Kick Date", width: "w-24", cell: (k) => k.kickDate ?? "" },
                  { header: "Kick Depth (mKB)", width: "w-24", align: "right", cell: (k) => headerValue(k.kickDepthMkb) },
                  { header: "Control Date", width: "w-24", cell: (k) => k.controlDate ?? "" },
                  { header: "Control Depth (mKB)", width: "w-24", align: "right", cell: (k) => headerValue(k.controlDepthMkb) },
                  { header: "Kick Class", width: "w-20", cell: (k) => k.kickClass ?? "" },
                  { header: "Kill Notes", cell: (k) => k.killNotes ?? "" },
                ]}
                rows={d.kicks}
                emptyText="No kick covering this day."
              />

              <SectionBar>Lost Circulation</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Start Date", width: "w-24", cell: (l) => l.startDate ?? "" },
                  { header: "Top Depth (mKB)", width: "w-24", align: "right", cell: (l) => headerValue(l.topDepthMkb) },
                  { header: "Bottom Depth (mKB)", width: "w-24", align: "right", cell: (l) => headerValue(l.bottomDepthMkb) },
                  { header: "Ops In Prog", cell: (l) => l.opsInProg ?? "" },
                  { header: "Vol Lost Tot (bbl)", width: "w-24", align: "right", cell: (l) => headerValue(l.volLostTotBbl) },
                  { header: "End Date", width: "w-24", cell: (l) => l.endDate ?? "" },
                ]}
                rows={d.lostCirculation}
                emptyText="No losses covering this day."
              />
            </>
          )}
        </div>

        {/* ── narrow right sidebar ── */}
        <div className="min-w-0">
          {d && (
            <>
              <SectionBar>Counters</SectionBar>
              <HeaderGrid rows={d.counters} />
            </>
          )}

          <SectionBar>Daily Contacts</SectionBar>
          <PreviewTable
            columns={[
              { header: "Job Contact", cell: (c) => c.jobContact ?? "" },
              { header: "Mobile", width: "w-28", cell: (c) => c.mobile ?? "" },
            ]}
            rows={payload.contacts}
            emptyText="No contacts on this day."
          />

          {d && (
            <>
              <SectionBar>Personnel Log</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Type", cell: (p) => p.type ?? "" },
                  { header: "Count", width: "w-16", align: "right", cell: (p) => headerValue(p.count, "int") },
                  { header: "Tot Work Time (hr)", width: "w-20", align: "right", cell: (p) => headerValue(p.totWorkTimeHr) },
                ]}
                rows={d.personnelLog}
                emptyText="No personnel recorded."
              />

              <SectionBar>Safety Check Summary</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Type", cell: (s) => s.type },
                  { header: "Last Date", width: "w-24", cell: (s) => s.lastDate ?? "" },
                  { header: "Next Date", width: "w-24", cell: (s) => s.nextDate ?? "" },
                ]}
                rows={d.safetyCheckSummary}
                emptyText="No drill schedule."
              />
            </>
          )}

          <SectionBar>Rigs</SectionBar>
          <HeaderGrid rows={payload.rigs} />

          <SectionBar>{d ? "Mud Pumps" : "Pumps"}</SectionBar>
          {payload.pumps.length === 0 ? (
            <Empty>No pump readings on this day.</Empty>
          ) : payload.pumps.map((p, i) => (
            <div key={i}>
              <BlockCaption>{p.caption}</BlockCaption>
              <HeaderGrid rows={p.fields} />
            </div>
          ))}

          <SectionBar>Mud Additive Amounts</SectionBar>
          <PreviewTable
            columns={[
              { header: "Des", cell: (a) => a.des ?? "" },
              { header: "Field Est (Cost/unit)", width: "w-24", align: "right", cell: (a) => money(a.fieldEstPerUnit) },
              { header: "Consumed", width: "w-20", align: "right", cell: (a) => headerValue(a.consumed) },
            ]}
            rows={payload.mudAdditives}
            emptyText="No additives consumed."
          />

          {!d && (
            <>
              <SectionBar>Safety Checks</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Time", width: "w-14", cell: (s) => s.time ?? "" },
                  { header: "Type", width: "w-24", cell: (s) => s.type ?? "" },
                  { header: "Des", cell: (s) => s.des ?? "" },
                ]}
                rows={payload.safetyChecks}
                emptyText="No safety check on this day."
              />

              <SectionBar>Wellbores</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Wellbore Name", cell: (w) => w.name ?? "" },
                  { header: "KO MD (mKB)", width: "w-24", align: "right", cell: (w) => headerValue(w.koMdMkb) },
                ]}
                rows={payload.wellbores}
                emptyText="No wellbore recorded."
              />
            </>
          )}

          {d && (
            <>
              <SectionBar>Survey Data</SectionBar>
              <PreviewTable
                columns={[
                  { header: "MD (mKB)", width: "w-20", align: "right", cell: (s) => headerValue(s.mdMkb) },
                  { header: "Incl (°)", width: "w-16", align: "right", cell: (s) => headerValue(s.inc) },
                  { header: "Azm (°)", width: "w-16", align: "right", cell: (s) => headerValue(s.azm) },
                  { header: "TVD (mKB)", width: "w-20", align: "right", cell: (s) => headerValue(s.tvdMkb) },
                ]}
                rows={d.surveys}
                emptyText="No survey on this day."
              />

              <SectionBar>Last 5 Formations</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Formation Name", cell: (f) => f.name ?? "" },
                  { header: "Prog Top MD (mKB)", width: "w-24", align: "right", cell: (f) => headerValue(f.progTopMd) },
                  { header: "Drill Top MD (mKB)", width: "w-24", align: "right", cell: (f) => headerValue(f.drillTopMd) },
                ]}
                rows={d.lastFormations}
                emptyText="No formation top on this day."
              />

              <SectionBar>Last Casing String</SectionBar>
              <PreviewTable
                columns={[
                  { header: "Casing Description", cell: (c) => c.description ?? "" },
                  { header: "Run Date", width: "w-24", cell: (c) => c.runDate ?? "" },
                  { header: "Set Depth (mKB)", width: "w-24", align: "right", cell: (c) => headerValue(c.setDepthMkb) },
                ]}
                rows={d.lastCasing}
                emptyText="No casing in hole."
              />
            </>
          )}
        </div>
      </div>

      {/* ── report 07 page 2 ── */}
      {d && (
        <div className="mt-3">
          <SectionBar>Interval Problems</SectionBar>
          <PreviewTable
            columns={[
              { header: "Problem Type", width: "w-32", cell: (p) => p.problemType ?? "" },
              { header: "Problem Sub Type", width: "w-28", cell: (p) => p.problemSubType ?? "" },
              { header: "Start Date", width: "w-24", cell: (p) => p.startDate ?? "" },
              { header: "Start Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.startDepthMkb) },
              { header: "End Depth (mKB)", width: "w-24", align: "right", cell: (p) => headerValue(p.endDepthMkb) },
              { header: "Accountable Party", width: "w-28", cell: (p) => p.accountableParty ?? "" },
              { header: "Est Cost (Cost)", width: "w-24", align: "right", cell: (p) => money(p.estCost) },
              { header: "Est Lost Time (hr)", width: "w-20", align: "right", cell: (p) => headerValue(p.estLostTimeHr) },
              { header: "Comment", cell: (p) => p.comment ?? "" },
            ]}
            rows={d.problems}
            emptyText="No problem on this day."
          />

          <SectionBar>Interval Lessons</SectionBar>
          <PreviewTable
            columns={[
              { header: "Lesson Type", width: "w-28", cell: (l) => l.lessonType ?? "" },
              { header: "Start Date", width: "w-24", cell: (l) => l.startDate ?? "" },
              { header: "End Date", width: "w-24", cell: (l) => l.endDate ?? "" },
              { header: "Start Depth (mKB)", width: "w-24", align: "right", cell: (l) => headerValue(l.startDepthMkb) },
              { header: "End Depth (mKB)", width: "w-24", align: "right", cell: (l) => headerValue(l.endDepthMkb) },
              { header: "Est Cost Saving (Cost)", width: "w-24", align: "right", cell: (l) => money(l.estCostSaving) },
              { header: "Est Time Saving (hr)", width: "w-20", align: "right", cell: (l) => headerValue(l.estTimeSavingHr) },
              { header: "Comment", cell: (l) => l.comment ?? "" },
            ]}
            rows={d.lessons}
            emptyText="No lesson covering this day."
          />

          <SectionBar>Safety Incidents</SectionBar>
          <PreviewTable
            columns={[
              { header: "Time", width: "w-14", cell: (s) => s.time ?? "" },
              { header: "Category", width: "w-24", cell: (s) => s.category ?? "" },
              { header: "Type", width: "w-24", cell: (s) => s.type ?? "" },
              { header: "SubTyp", width: "w-24", cell: (s) => s.subType ?? "" },
              { header: "Cause", cell: (s) => s.cause ?? "" },
              // Blank, not "No": the sample leaves the cell empty when unanswered.
              { header: "Lost time?", width: "w-16", cell: (s) => (s.lostTime === null ? "" : s.lostTime ? "Yes" : "No") },
              { header: "Severity", width: "w-20", cell: (s) => s.severity ?? "" },
            ]}
            rows={d.incidents}
            emptyText="No incident on this day."
          />
        </div>
      )}

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-gray-400 border-t-0 px-1.5 py-1.5 text-[11px] italic text-gray-400">
      {children}
    </div>
  );
}

/** A full-width labelled free-text row, e.g. the string's component list. */
function LabelledText({ label, text }: { label: string; text: string | null }) {
  return (
    <div className="border border-gray-400 border-t-0">
      <div className="px-1.5 pt-0.5 text-[9px] leading-tight text-gray-500">{label}</div>
      <div className="px-1.5 pb-1 text-[11px] leading-snug text-gray-900 whitespace-pre-wrap min-h-[1.2em]">
        {text ?? " "}
      </div>
    </div>
  );
}
