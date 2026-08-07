/**
 * On-screen previews of reports 02 (BHA Detail) and 03 (Bit Summary).
 *
 * Both are RUN-scoped: 02 is one page per assembly, 03 is one row per assembly
 * across the whole well. Everything printed is derived server-side from the day
 * rows that carry the run's id — see `apps/api/src/reports/bha.ts`.
 */
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  BhaComponentRow, BhaParamRow, BitSummaryRow, Report02Payload, Report03Payload,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";

const COMPONENT_COLUMNS: PreviewColumn<BhaComponentRow>[] = [
  { header: "Jts", width: "w-12", align: "right", cell: (c) => headerValue(c.jts, "int") },
  { header: "Item Des", cell: (c) => c.itemDes ?? "" },
  { header: "OD (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.odIn) },
  { header: "ID (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.idIn) },
  { header: "Mass/Len (kg/m)", width: "w-20", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
  { header: "Grade", width: "w-16", cell: (c) => c.grade ?? "" },
  { header: "Drift (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.driftIn) },
  { header: "Gauge (in)", width: "w-16", align: "right", cell: (c) => headerValue(c.gaugeIn) },
  { header: "Connections", width: "w-24", cell: (c) => c.connections ?? "" },
  { header: "Len (m)", width: "w-20", align: "right", cell: (c) => headerValue(c.lenM) },
  { header: "Cum Len (m)", width: "w-20", align: "right", cell: (c) => headerValue(c.cumLenM) },
];

const PARAM_COLUMNS: PreviewColumn<BhaParamRow>[] = [
  { header: "Wellbore", width: "w-28", cell: (p) => p.wellbore ?? "" },
  { header: "Start Date", width: "w-24", cell: (p) => p.startDate ?? "" },
  { header: "End Date", width: "w-24", cell: (p) => p.endDate ?? "" },
  { header: "Drill Time (hr)", width: "w-20", align: "right", cell: (p) => headerValue(p.drillTimeHr) },
  { header: "Start (mKB)", width: "w-20", align: "right", cell: (p) => headerValue(p.startMkb) },
  { header: "End Depth (mKB)", width: "w-20", align: "right", cell: (p) => headerValue(p.endDepthMkb) },
  { header: "Int Depth (m)", width: "w-20", align: "right", cell: (p) => headerValue(p.intDepthM) },
  { header: "Int ROP (m/hr)", width: "w-20", align: "right", cell: (p) => headerValue(p.intRopMHr) },
  { header: "WOB (1000lbf)", width: "w-20", align: "right", cell: (p) => headerValue(p.wob1000Lbf) },
  { header: "RPM (rpm)", width: "w-16", align: "right", cell: (p) => headerValue(p.rpm) },
  { header: "Q Flow (gpm)", width: "w-20", align: "right", cell: (p) => headerValue(p.qFlowGpm) },
  { header: "SPP (psi)", width: "w-20", align: "right", cell: (p) => headerValue(p.sppPsi) },
];

export function Report02Preview({ payload }: { payload: Report02Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} right={payload.identityRight} />
      {payload.runCaption && (
        <div className="px-1 pb-1.5 text-[11px] text-gray-600">{payload.runCaption}</div>
      )}

      <HeaderGrid rows={[payload.runHeader]} />
      <HeaderGrid rows={[payload.bitRow]} />
      <HeaderGrid rows={[payload.stringRow]} />
      <HeaderGrid rows={[[{ label: "Nozzles (1/32\")", value: payload.nozzles }]]} />
      <HeaderGrid rows={[[{ label: "Comment", value: payload.comment }]]} />

      <SectionBar>Drill String Components</SectionBar>
      <PreviewTable
        columns={COMPONENT_COLUMNS}
        rows={payload.components}
        emptyText="No make-up recorded for this run."
      />

      <SectionBar>Bit</SectionBar>
      <PreviewTable
        columns={[
          { header: "Bit Type", cell: (b) => b.bitType ?? "" },
          { header: "Make", width: "w-24", cell: (b) => b.make ?? "" },
          { header: "Model", width: "w-24", cell: (b) => b.model ?? "" },
          { header: "Serial Number", width: "w-24", cell: (b) => b.serialNumber ?? "" },
          { header: "IADC Codes", width: "w-20", cell: (b) => b.iadcCodes ?? "" },
          { header: "Item Cost (Cost)", width: "w-24", align: "right", cell: (b) => money(b.itemCost) },
          { header: "Length (m)", width: "w-20", align: "right", cell: (b) => headerValue(b.lengthM) },
        ]}
        rows={payload.bitTypes}
        emptyText="No bit recorded on this run."
      />

      <SectionBar>Drilling Parameters</SectionBar>
      <PreviewTable
        columns={PARAM_COLUMNS}
        rows={payload.drillingParameters}
        emptyText="No drilled interval on this run."
      />

      <SectionBar>Bit Nozzles</SectionBar>
      <PreviewTable
        columns={[{ header: "Size (1/32\")", align: "right", cell: (n: number) => headerValue(n, "int") }]}
        rows={payload.bitNozzles}
        emptyText="No nozzles recorded."
      />

      <SectionBar>Sensors</SectionBar>
      <PreviewTable
        columns={[
          { header: "Sensor Type", width: "w-32", cell: (s) => s.sensorType ?? "" },
          { header: "Sensor-Bit (m)", width: "w-24", align: "right", cell: (s) => headerValue(s.distFromBitM) },
          { header: "Note", cell: (s) => s.note ?? "" },
        ]}
        rows={payload.sensors}
        emptyText="No sensors on this assembly."
      />

      <SectionBar>Mud Checks</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-24", cell: (m) => m.date ?? "" },
          { header: "Depth (mKB)", width: "w-20", align: "right", cell: (m) => headerValue(m.depthMkb) },
          { header: "Type", width: "w-28", cell: (m) => m.type ?? "" },
          { header: "Dens (ppg)", width: "w-20", align: "right", cell: (m) => headerValue(m.densPpg) },
          { header: "PV Calc (cp)", width: "w-20", align: "right", cell: (m) => headerValue(m.pvCp) },
          { header: "YP Calc (lbf/100ft²)", width: "w-20", align: "right", cell: (m) => headerValue(m.ypLbf100ft2) },
          { header: "pH", width: "w-16", align: "right", cell: (m) => headerValue(m.ph) },
          { header: "Sand (%)", width: "w-16", align: "right", cell: (m) => headerValue(m.sandPct) },
          { header: "Solids (%)", width: "w-16", align: "right", cell: (m) => headerValue(m.solidsPct) },
        ]}
        rows={payload.mudChecks}
        emptyText="No mud check while this assembly was in the hole."
      />

      {/* The sample draws a vertical schematic down the left rail. Saying so is
          better than leaving a silent gap where a picture should be. */}
      <div className="border border-gray-400 border-t-0 px-1.5 py-1.5 text-[10px] italic text-gray-400">
        The sample also prints a vertical wellbore schematic beside these blocks. It is not drawn yet —
        the shared schematic component arrives with the geological and completion reports.
      </div>

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

const BIT_COLUMNS: PreviewColumn<BitSummaryRow>[] = [
  { header: "BHA #", width: "w-14", align: "right", cell: (b) => headerValue(b.bhaNo, "int") },
  { header: "Bit Run", width: "w-16", cell: (b) => b.bitRun ?? "" },
  { header: "Size (in)", width: "w-16", cell: (b) => b.sizeIn ?? "" },
  { header: "Make", width: "w-24", cell: (b) => b.make ?? "" },
  { header: "Model", width: "w-24", cell: (b) => b.model ?? "" },
  { header: "SN", width: "w-20", cell: (b) => b.serialNo ?? "" },
  { header: "IADC Codes", width: "w-20", cell: (b) => b.iadcCodes ?? "" },
  { header: "TFA (incl Noz) (in²)", width: "w-20", align: "right", cell: (b) => headerValue(b.tfaIn2) },
  { header: "Nozzles (1/32\")", width: "w-32", cell: (b) => b.nozzles ?? "" },
  { header: "Depth In (mKB)", width: "w-20", align: "right", cell: (b) => headerValue(b.depthInMkb) },
  { header: "Depth Out (mKB)", width: "w-20", align: "right", cell: (b) => headerValue(b.depthOutMkb) },
  { header: "Drilled (m)", width: "w-20", align: "right", cell: (b) => headerValue(b.drilledM) },
  { header: "Drill Time (hr)", width: "w-20", align: "right", cell: (b) => headerValue(b.drillTimeHr) },
  { header: "BHA ROP (m/hr)", width: "w-20", align: "right", cell: (b) => headerValue(b.bhaRopMHr) },
  { header: "WOB Max (1000lbf)", width: "w-20", align: "right", cell: (b) => headerValue(b.wobMax) },
  { header: "WOB Min (1000lbf)", width: "w-20", align: "right", cell: (b) => headerValue(b.wobMin) },
  { header: "Max RPM (rpm)", width: "w-20", align: "right", cell: (b) => headerValue(b.rpmMax) },
  { header: "Min RPM (rpm)", width: "w-20", align: "right", cell: (b) => headerValue(b.rpmMin) },
  { header: "Bit Dull", width: "w-40", cell: (b) => b.bitDull ?? "" },
];

export function Report03Preview({ payload }: { payload: Report03Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} right={payload.identityRight} />
      <HeaderGrid rows={payload.header} />
      <SectionBar>Bits</SectionBar>
      <PreviewTable
        columns={BIT_COLUMNS}
        rows={payload.bits}
        emptyText="No BHA run recorded on this well yet — add one under Well data → Well registers."
      />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
