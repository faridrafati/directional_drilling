/**
 * On-screen previews of the geology reports — 18 (Daily Geological), 19
 * (Formation Performance) and 20 (the Geological Program).
 *
 * The three print the same formation register from three sides, so the register
 * has THREE column sets here rather than one: 20 shows what was predicted, 19
 * shows predicted against drilled, and 18 shows the register as it stands. A
 * single shared table would have to print every column on every report, and the
 * programme page would carry eight as-drilled columns that are empty by
 * definition before spud.
 */
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  DrilledIntervalRow, FormationRow, GasShowRow, GeoLithologyRow, GeoLogRunRow,
  GeoMudCheckRow, GeoSampleRow, GeoTimeLogRow, OilShowRow,
  Report18Payload, Report19Payload, Report20Payload,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

/** The exporter looks report 19's profile plot up by this. */
export const FORMATION_PROFILE_ID = "wellview-formation-profile";

/* ── the register, in the three shapes the three reports need ─────────────── */

/** Report 18: identity, prognosis top and the drilled tops, side by side. */
const FORMATION_ALL: PreviewColumn<FormationRow>[] = [
  { header: "Formation Name", width: "w-40", cell: (f) => f.name ?? "" },
  { header: "Element Type", width: "w-28", cell: (f) => f.elementType ?? "" },
  { header: "Lith Des", width: "w-28", cell: (f) => f.lithDes ?? "" },
  { header: "Prog Depth Top SS (m)", width: "w-28", align: "right", cell: (f) => headerValue(f.progDepthTopSs) },
  { header: "Prog Top TVD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.progTopTvd) },
  { header: "Drill Top MD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.drillTopMd) },
  { header: "Drill Top (TVD) (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.drillTopTvd) },
];

/** Report 19: drilled against final, with what it cost in rate and pressure. */
const FORMATION_PERFORMANCE: PreviewColumn<FormationRow>[] = [
  { header: "Formation Name", width: "w-40", cell: (f) => f.name ?? "" },
  { header: "Layer Name", width: "w-28", cell: (f) => f.layerName ?? "" },
  { header: "Drill Top MD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.drillTopMd) },
  { header: "Drill Btm MD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.drillBtmMd) },
  { header: "Final Top MD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.finalTopMd) },
  { header: "Final Btm MD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.finalBtmMd) },
  { header: "ROP (m/hr)", width: "w-24", align: "right", cell: (f) => headerValue(f.ropMHr) },
  { header: "P Frac (ppg)", width: "w-24", align: "right", cell: (f) => headerValue(f.pFracPpg) },
  { header: "P Pore (ppg)", width: "w-24", align: "right", cell: (f) => headerValue(f.pPorePpg) },
  { header: "T (°C)", width: "w-20", align: "right", cell: (f) => headerValue(f.temperatureC) },
];

/** Report 20: the prognosis alone — the as-drilled columns are empty before spud. */
const FORMATION_PROGNOSIS: PreviewColumn<FormationRow>[] = [
  { header: "Formation Name", width: "w-40", cell: (f) => f.name ?? "" },
  { header: "Lith Des", width: "w-28", cell: (f) => f.lithDes ?? "" },
  { header: "Element Type", width: "w-28", cell: (f) => f.elementType ?? "" },
  { header: "Prog Depth Top SS (m)", width: "w-28", align: "right", cell: (f) => headerValue(f.progDepthTopSs) },
  { header: "Prog Top TVD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.progTopTvd) },
  { header: "Prog Depth Btm SS (m)", width: "w-28", align: "right", cell: (f) => headerValue(f.progDepthBtmSs) },
  { header: "Prog Btm TVD (mKB)", width: "w-28", align: "right", cell: (f) => headerValue(f.progBtmTvd) },
  { header: "P Pore (ppg)", width: "w-24", align: "right", cell: (f) => headerValue(f.pPorePpg) },
  { header: "P Frac (ppg)", width: "w-24", align: "right", cell: (f) => headerValue(f.pFracPpg) },
  { header: "T (°C)", width: "w-20", align: "right", cell: (f) => headerValue(f.temperatureC) },
  { header: "H2S Conc (%)", width: "w-24", align: "right", cell: (f) => headerValue(f.h2sConcPct) },
];

/* ══ report 18 ═══════════════════════════════════════════════════════════════ */

const TIME_LOG: PreviewColumn<GeoTimeLogRow>[] = [
  { header: "Start Time", width: "w-24", cell: (t) => t.startTime ?? "" },
  { header: "End Time", width: "w-24", cell: (t) => t.endTime ?? "" },
  { header: "Dur (hr)", width: "w-20", align: "right", cell: (t) => headerValue(t.durHr) },
  { header: "Cum Dur (hr)", width: "w-24", align: "right", cell: (t) => headerValue(t.cumDurHr) },
  { header: "Code 1", width: "w-20", cell: (t) => t.code1 ?? "" },
  { header: "Code 2", width: "w-24", cell: (t) => t.code2 ?? "" },
  { header: "Com", cell: (t) => t.com ?? "" },
];

const MUD_CHECKS: PreviewColumn<GeoMudCheckRow>[] = [
  { header: "Type", width: "w-32", cell: (m) => m.type ?? "" },
  { header: "Time", width: "w-20", cell: (m) => m.time ?? "" },
  { header: "Depth (mKB)", width: "w-28", align: "right", cell: (m) => headerValue(m.depthMkb) },
  { header: "Dens (ppg)", width: "w-24", align: "right", cell: (m) => headerValue(m.densPpg) },
  { header: "PV OR (cp)", width: "w-24", align: "right", cell: (m) => headerValue(m.pvCp) },
  { header: "YP Calc", width: "w-24", align: "right", cell: (m) => headerValue(m.ypPa) },
  { header: "Filtrate (mL/30min)", width: "w-28", align: "right", cell: (m) => headerValue(m.filtrateMl) },
  { header: "pH", width: "w-20", align: "right", cell: (m) => headerValue(m.ph) },
];

const SAMPLES: PreviewColumn<GeoSampleRow>[] = [
  { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Vol Ca (%)", width: "w-24", align: "right", cell: (r) => headerValue(r.volCaPct) },
  { header: "Vol Mg (%)", width: "w-24", align: "right", cell: (r) => headerValue(r.volMgPct) },
  { header: "Com", cell: (r) => r.com ?? "" },
];

const LITHOLOGY: PreviewColumn<GeoLithologyRow>[] = [
  { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Des", cell: (r) => r.des ?? "" },
  { header: "Vol (%)", width: "w-24", align: "right", cell: (r) => headerValue(r.volPct) },
  { header: "Type", width: "w-28", cell: (r) => r.type ?? "" },
  { header: "Type Code", width: "w-24", cell: (r) => r.typeCode ?? "" },
];

const OIL_SHOWS: PreviewColumn<OilShowRow>[] = [
  { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Show Quality", width: "w-32", cell: (r) => r.showQuality ?? "" },
  { header: "Show Origin", width: "w-32", cell: (r) => r.showOrigin ?? "" },
  { header: "Show Type", cell: (r) => r.showType ?? "" },
];

const GAS_SHOWS: PreviewColumn<GasShowRow>[] = [
  { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Show Type", width: "w-32", cell: (r) => r.showType ?? "" },
  { header: "Total Gas Avg (%)", width: "w-28", align: "right", cell: (r) => headerValue(r.totalGasAvgPct) },
  { header: "Total Gas Min (%)", width: "w-28", align: "right", cell: (r) => headerValue(r.totalGasMinPct) },
  { header: "Total Gas Max (%)", width: "w-28", align: "right", cell: (r) => headerValue(r.totalGasMaxPct) },
];

const LOG_RUNS: PreviewColumn<GeoLogRunRow>[] = [
  { header: "Time", width: "w-20", cell: (r) => r.time ?? "" },
  { header: "Run #", width: "w-20", cell: (r) => r.runNo ?? "" },
  { header: "Type", width: "w-40", cell: (r) => r.type ?? "" },
  { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
  { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
  { header: "Logging Company", cell: (r) => r.loggingCompany ?? "" },
];

export function Report18Preview({ payload }: { payload: Report18Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      {payload.identityRight && (
        <div className="text-right text-[11px] text-gray-700 mb-0.5">{payload.identityRight}</div>
      )}
      <IdentityLine wellName={payload.wellName} />
      {payload.depthLine && (
        <div className="text-right text-[11px] text-gray-700 mb-1">{payload.depthLine}</div>
      )}
      <HeaderGrid rows={payload.header} />

      <SectionBar>Daily Summary</SectionBar>
      <HeaderGrid rows={[payload.dailySummary]} />
      <HeaderGrid rows={payload.gas} />
      <HeaderGrid rows={payload.narrative} />

      <SectionBar>Time Log</SectionBar>
      <PreviewTable columns={TIME_LOG} rows={payload.timeLog} emptyText="No interval logged." />

      <SectionBar>Mud Checks</SectionBar>
      <PreviewTable columns={MUD_CHECKS} rows={payload.mudChecks} emptyText="No mud check on this day." />
      {payload.mudCheckLimitation && (
        <div className="border border-t-0 border-gray-400 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          A day holds one mud check in this application. Where a rig runs a morning and an evening
          check, only the recorded one appears — the sample&rsquo;s own day prints two.
        </div>
      )}

      {payload.bhaBlocks.map((b, i) => (
        <div key={i}>
          <SectionBar>{b.caption}</SectionBar>
          <HeaderGrid rows={[b.header]} />
          <PreviewTable
            columns={[
              { header: "End Depth (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.endDepthMkb) },
              { header: "TVD End (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.tvdEndMkb) },
              { header: "Cum Depth (m)", width: "w-28", align: "right", cell: (r) => headerValue(r.cumDepthM) },
              { header: "Cum Drill Time (hr)", width: "w-28", align: "right", cell: (r) => headerValue(r.cumDrillTimeHr) },
              { header: "Int ROP (m/hr)", width: "w-24", align: "right", cell: (r) => headerValue(r.intRopMHr) },
              { header: "RPM (rpm)", width: "w-24", align: "right", cell: (r) => headerValue(r.rpm) },
              { header: "WOB (1000lbf)", width: "w-24", align: "right", cell: (r) => headerValue(r.wob1000Lbf) },
              { header: "Wellbore", cell: (r) => r.wellbore ?? "" },
            ] as PreviewColumn<typeof b.intervals[number]>[]}
            rows={b.intervals}
            emptyText="No drilled interval on this BHA today."
          />
        </div>
      ))}

      <SectionBar>All Formations</SectionBar>
      <PreviewTable
        columns={FORMATION_ALL} rows={payload.formations}
        emptyText="No formation registered — enter them under Well data → Geology."
      />

      <SectionBar>Sample Descriptions</SectionBar>
      <PreviewTable columns={SAMPLES} rows={payload.sampleDescriptions} emptyText="No cuttings described today." />

      <SectionBar>Lithology</SectionBar>
      <PreviewTable columns={LITHOLOGY} rows={payload.lithology} emptyText="No lithology logged today." />

      <SectionBar>Oil Shows</SectionBar>
      <PreviewTable columns={OIL_SHOWS} rows={payload.oilShows} emptyText="No oil show today." />

      <SectionBar>Gas Shows</SectionBar>
      <PreviewTable columns={GAS_SHOWS} rows={payload.gasShows} emptyText="No gas show today." />

      <SectionBar>Logs</SectionBar>
      <PreviewTable columns={LOG_RUNS} rows={payload.logRuns} emptyText="No log run today." />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 19 ═══════════════════════════════════════════════════════════════ */

const INTERVALS: PreviewColumn<DrilledIntervalRow>[] = [
  { header: "Start (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.startMkb) },
  { header: "End Depth (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.endDepthMkb) },
  { header: "Int Depth (m)", width: "w-28", align: "right", cell: (r) => headerValue(r.intDepthM) },
  { header: "Drill Time (hr)", width: "w-28", align: "right", cell: (r) => headerValue(r.drillTimeHr) },
  { header: "Int ROP (m/hr)", width: "w-28", align: "right", cell: (r) => headerValue(r.intRopMHr) },
  { header: "Date", cell: (r) => r.date },
];

export function Report19Preview({ payload }: { payload: Report19Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />

      {payload.wellboreBlocks.map((b, i) => (
        <div key={i}>
          <SectionBar>{b.caption}</SectionBar>
          <HeaderGrid rows={[b.header]} />
          <SectionBar>Drilling Parameters</SectionBar>
          <PreviewTable columns={INTERVALS} rows={b.intervals} emptyText="No drilled interval on this hole." />
        </div>
      ))}

      <SectionBar>Formations</SectionBar>
      <PreviewTable
        columns={FORMATION_PERFORMANCE} rows={payload.formations}
        emptyText="No formation registered — enter them under Well data → Geology."
      />

      <SectionBar>ROP against depth</SectionBar>
      {payload.profile.length === 0 ? (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-4 text-[11px] text-gray-400">
          No formation has a drilled top and a rate, so there is no profile to draw.
        </div>
      ) : (
        <div id={FORMATION_PROFILE_ID} className="bg-white border border-gray-400 border-t-0 p-2">
          <ResponsiveContainer width="100%" height={320}>
            {/* Depth DOWN the Y axis, rate across — a driller reads a rate
                profile the way they read the hole, top to bottom. */}
            <LineChart data={payload.profile} margin={{ top: 4, right: 16, bottom: 18, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" />
              <XAxis
                type="number" dataKey="ropMHr" tick={{ fontSize: 10 }}
                label={{ value: "ROP (m/hr)", position: "insideBottom", offset: -2, fontSize: 10 }}
              />
              <YAxis
                type="number" dataKey="depth" reversed tick={{ fontSize: 10 }} width={72}
                label={{ value: "Drill Top (mKB)", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: number | string) => headerValue(Number(v))}
                labelFormatter={(_l, p) => (p?.[0]?.payload as { name?: string } | undefined)?.name ?? ""}
              />
              <Legend verticalAlign="top" height={20} wrapperStyle={{ fontSize: 10 }} />
              <Line
                type="linear" dataKey="depth" name="Formation top vs ROP"
                stroke="#1d4ed8" dot={{ r: 3 }} isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ report 20 ═══════════════════════════════════════════════════════════════ */

export function Report20Preview({ payload }: { payload: Report20Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />

      <SectionBar>Wellbores</SectionBar>
      <PreviewTable
        columns={[
          { header: "Wellbore Name", width: "w-40", cell: (w) => w.name ?? "" },
          { header: "Profile Type", width: "w-32", cell: (w) => w.profileType ?? "" },
          { header: "Parent Wellbore", width: "w-32", cell: (w) => w.parentWellbore ?? "" },
          { header: "Proposed Deviation Survey", cell: (w) => w.proposedSurvey ?? "" },
        ] as PreviewColumn<Report20Payload["wellbores"][number]>[]}
        rows={payload.wellbores}
        emptyText="No wellbore recorded — add them under Well data → Well registers."
      />

      <SectionBar>Formations</SectionBar>
      <PreviewTable
        columns={FORMATION_PROGNOSIS} rows={payload.formations}
        emptyText="No formation prognosed — enter them under Well data → Geology."
      />

      <SectionBar>Jobs</SectionBar>
      {payload.jobs.length === 0 ? (
        <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
          No job on this well.
        </div>
      ) : (
        <HeaderGrid rows={payload.jobs} />
      )}

      <SectionBar>Geological Objective</SectionBar>
      <div className="border border-t-0 border-gray-400 px-2 py-1.5 text-[11px] text-gray-900 leading-snug whitespace-pre-wrap min-h-[24px]">
        {payload.geologicalObjective ?? ""}
      </div>

      <SectionBar>Geological Sampling Requirements</SectionBar>
      <PreviewTable
        columns={[
          { header: "Top Des", width: "w-36", cell: (r) => r.topDes ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
          { header: "Btm Des", width: "w-36", cell: (r) => r.btmDes ?? "" },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
          { header: "Wellbore", width: "w-32", cell: (r) => r.wellbore ?? "" },
          { header: "Rqd By", width: "w-32", cell: (r) => r.rqdBy ?? "" },
          { header: "Sampled By", width: "w-32", cell: (r) => r.sampledBy ?? "" },
          { header: "Com", cell: (r) => r.com ?? "" },
        ] as PreviewColumn<Report20Payload["samplingRequirements"][number]>[]}
        rows={payload.samplingRequirements}
        emptyText="Nothing requested — enter it under Well data → Geology."
      />

      <SectionBar>Job Contacts</SectionBar>
      <PreviewTable
        columns={[
          { header: "Company", width: "w-40", cell: (c) => c.company ?? "" },
          { header: "Contact Name", width: "w-36", cell: (c) => c.contactName ?? "" },
          { header: "Title", width: "w-40", cell: (c) => c.title ?? "" },
          { header: "Mobile", width: "w-32", cell: (c) => c.mobile ?? "" },
          { header: "E-mail", width: "w-48", cell: (c) => c.email ?? "" },
          { header: "Note", cell: (c) => c.note ?? "" },
        ] as PreviewColumn<Report20Payload["contacts"][number]>[]}
        rows={payload.contacts}
        emptyText="No contact recorded — enter them on the job's Contacts tab."
      />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/** Re-exported so the PDF builder formats money identically to the page. */
export { money };
