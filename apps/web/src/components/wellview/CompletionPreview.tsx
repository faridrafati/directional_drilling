/**
 * On-screen previews of the completion reports — 22, 23, 24, 26, 28, 29 and 30.
 *
 * Six of the seven are built around the shared `WellboreSchematic`, so the
 * picture is drawn by ONE component and only its size changes: a rail on 24, a
 * page on 28, twice side by side on 29. Report 30 is the one without a picture
 * — it is the register, printed.
 *
 * Report 29 draws the proposed and the actual on TWO schematics rather than one
 * with two colours. They are different wells until the bit reaches TD, they do
 * not share a depth extent, and overlaying them would put a prognosed formation
 * top and a drilled one on the same band with no way to tell which is which.
 */
import { headerValue, money } from "../../export/reportChrome.js";
import type {
  PerforationBlock, Report22Payload, Report23Payload, Report24Payload,
  Report26Payload, Report28Payload, Report29Payload, Report30Payload, TubingBlock,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { SchematicLegend, WellboreSchematic } from "./WellboreSchematic.js";

const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");

/** The tubing tally, in the shape reports 22, 24 and 30 all print it. */
function TubingBlocks({ blocks }: { blocks: TubingBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No tubing string recorded — enter one under Well data → Completion.
      </div>
    );
  }
  return (
    <>
      {blocks.map((t, i) => (
        <div key={i}>
          <SectionBar>{t.caption}</SectionBar>
          <HeaderGrid rows={[t.header]} />
          <PreviewTable
            columns={[
              { header: "Item Des", width: "w-40", cell: (c) => c.itemDes ?? "" },
              { header: "Jts", width: "w-16", align: "right", cell: (c) => headerValue(c.jts, "int") },
              { header: "Make", width: "w-28", cell: (c) => c.make ?? "" },
              { header: "Model", width: "w-28", cell: (c) => c.model ?? "" },
              { header: "OD (in)", width: "w-24", cell: (c) => c.odIn ?? "" },
              { header: "ID (in)", width: "w-24", align: "right", cell: (c) => headerValue(c.idIn, "in3") },
              { header: "Wt (kg/m)", width: "w-24", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
              { header: "Grade", width: "w-20", cell: (c) => c.grade ?? "" },
              { header: "Len (m)", width: "w-24", align: "right", cell: (c) => headerValue(c.lenM) },
              { header: "Top (mKB)", width: "w-24", align: "right", cell: (c) => headerValue(c.topMkb) },
              { header: "Btm (mKB)", width: "w-24", align: "right", cell: (c) => headerValue(c.btmMkb) },
              { header: "SN", cell: (c) => c.serialNo ?? "" },
            ] as PreviewColumn<TubingBlock["components"][number]>[]}
            rows={t.components}
            emptyText="No component on this string."
          />
        </div>
      ))}
    </>
  );
}

/** One perforation, header rows then its status history. */
function PerforationBlocks({ blocks }: { blocks: PerforationBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No perforation recorded — enter them under Well data → Completion.
      </div>
    );
  }
  return (
    <>
      {blocks.map((p, i) => (
        <div key={i}>
          <HeaderGrid rows={p.header} />
          <SectionBar>Perforation Statuses</SectionBar>
          <PreviewTable
            columns={[
              { header: "Date", width: "w-28", cell: (st) => st.date ?? "" },
              { header: "Status", width: "w-32", cell: (st) => st.status ?? "" },
              { header: "Com", cell: (st) => st.com ?? "" },
            ] as PreviewColumn<PerforationBlock["statuses"][number]>[]}
            rows={p.statuses}
            emptyText="No status recorded."
          />
        </div>
      ))}
    </>
  );
}

/* ══ 24 — Downhole Well Profile ══════════════════════════════════════════════ */

export function Report24Preview({ payload }: { payload: Report24Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.completionHeader]} />
      <SectionBar>{payload.caption}</SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="24" width={620} height={420} />
      <SchematicLegend />

      <SectionBar>Wellhead</SectionBar>
      <PreviewTable
        columns={[
          { header: "Des", width: "w-48", cell: (w) => w.des ?? "" },
          { header: "Make", width: "w-32", cell: (w) => w.make ?? "" },
          { header: "Model", width: "w-32", cell: (w) => w.model ?? "" },
          { header: "SN", width: "w-32", cell: (w) => w.sn ?? "" },
          { header: "WP Top (psi)", align: "right", cell: (w) => headerValue(w.wpTopPsi) },
        ] as PreviewColumn<Report24Payload["wellhead"][number]>[]}
        rows={payload.wellhead} emptyText="No wellhead component recorded."
      />

      <SectionBar>Casing Strings</SectionBar>
      <PreviewTable
        columns={[
          { header: "Csg Des", width: "w-48", cell: (c) => c.description ?? "" },
          { header: "OD (in)", width: "w-24", cell: (c) => c.odIn ?? "" },
          { header: "Wt/Len (kg/m)", width: "w-28", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
          { header: "Grade", width: "w-24", cell: (c) => c.grade ?? "" },
          { header: "Top Thread", width: "w-28", cell: (c) => c.topThread ?? "" },
          { header: "Set Depth (mKB)", align: "right", cell: (c) => headerValue(c.setDepthMkb) },
        ] as PreviewColumn<Report24Payload["casingStrings"][number]>[]}
        rows={payload.casingStrings} emptyText="No casing string recorded."
      />

      <SectionBar>Perforations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (p) => p.date ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.btmMkb) },
          { header: "Zone", cell: (p) => p.zone ?? "" },
        ] as PreviewColumn<Report24Payload["perforations"][number]>[]}
        rows={payload.perforations} emptyText="No perforation recorded." />

      <SectionBar>Tubing Strings</SectionBar>
      <TubingBlocks blocks={payload.tubingStrings} />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 26 — Perforations ═══════════════════════════════════════════════════════ */

export function Report26Preview({ payload }: { payload: Report26Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.completionHeader]} />
      <SectionBar>{payload.caption}</SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="26" width={620} height={400} />
      <SchematicLegend />

      <SectionBar>Perforations</SectionBar>
      <PerforationBlocks blocks={payload.perforations} />
      <HeaderGrid rows={[payload.totals]} />
      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        &ldquo;Currently open&rdquo; is read off the END of each perforation&rsquo;s status history,
        not stored beside it — a squeeze recorded in 2015 is why a zone is dead, and a stored current
        state would go stale the first time somebody forgot to update it.
      </div>
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 28 — Schematic, Current ═════════════════════════════════════════════════ */

export function Report28Preview({ payload }: { payload: Report28Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.completionHeader]} />

      <SectionBar>Most Recent Job</SectionBar>
      {payload.mostRecentJob
        ? <HeaderGrid rows={[payload.mostRecentJob]} />
        : (
          <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
            No job on this well.
          </div>
        )}

      <SectionBar>
        {[payload.totalDepthLine, payload.caption].filter(Boolean).join("   ·   ")}
      </SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="28" width={680} height={520} />
      <SchematicLegend />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 29 — Schematic, Proposed vs Actual ══════════════════════════════════════ */

export function Report29Preview({ payload }: { payload: Report29Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <SectionBar>{payload.caption}</SectionBar>

      {/* TWO pictures, not one overlaid. They are different wells until the bit
          reaches TD, they do not share a depth extent, and overlaying them would
          put a prognosed top and a drilled one on the same band with no way to
          tell which is which. */}
      <div className="border border-gray-400 border-t-0 bg-white p-2 flex gap-4 overflow-x-auto">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 pb-0.5">
            Proposed
          </div>
          <WellboreSchematic payload={payload.proposed} reportType="29-proposed" width={330} height={440} />
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 pb-0.5">
            Actual
          </div>
          <WellboreSchematic payload={payload.actual} reportType="29" width={330} height={440} />
        </div>
      </div>
      <SchematicLegend />
      <HeaderGrid rows={[payload.comparison]} />
      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        The proposed side carries the prognosis and the plan&rsquo;s total depth, not a casing scheme:
        this application does not store a designed casing programme, and drawing the ACTUAL casing on
        the proposed side would make the comparison meaningless.
      </div>
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 22 — Complete Well Summary ══════════════════════════════════════════════ */

export function Report22Preview({ payload }: { payload: Report22Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.identity} />

      <SectionBar>{payload.caption}</SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="22" width={640} height={440} />
      <SchematicLegend />

      <SectionBar>Wellbore</SectionBar>
      <HeaderGrid rows={[payload.wellbore]} />

      <SectionBar>Hole Sections</SectionBar>
      <PreviewTable
        columns={[
          { header: "Size (in)", width: "w-28", cell: (h) => h.sizeIn ?? "" },
          { header: "Act Top (mKB)", width: "w-32", align: "right", cell: (h) => headerValue(h.actTopMkb) },
          { header: "Act Btm (mKB)", align: "right", cell: (h) => headerValue(h.actBtmMkb) },
        ] as PreviewColumn<Report22Payload["holeSections"][number]>[]}
        rows={payload.holeSections} emptyText="No hole section recorded." />

      <SectionBar>Plug Back Total Depths</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (p) => p.date ?? "" },
          { header: "Depth (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.depthMkb) },
          { header: "Method", width: "w-32", cell: (p) => p.method ?? "" },
          { header: "Com", cell: (p) => p.com ?? "" },
        ] as PreviewColumn<Report22Payload["plugBacks"][number]>[]}
        rows={payload.plugBacks} emptyText="Nothing plugged back." />

      <SectionBar>Formations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Formation Name", width: "w-44", cell: (f) => f.name ?? "" },
          { header: "Element Type", width: "w-32", cell: (f) => f.elementType ?? "" },
          { header: "H2S Conc (%)", width: "w-28", align: "right", cell: (f) => headerValue(f.h2sConcPct) },
          { header: "Final Top MD (mKB)", width: "w-32", align: "right", cell: (f) => headerValue(f.finalTopMd) },
          { header: "Final Top TVD (mKB)", align: "right", cell: (f) => headerValue(f.finalTopTvd) },
        ] as PreviewColumn<Report22Payload["formations"][number]>[]}
        rows={payload.formations} emptyText="No formation registered." />

      <SectionBar>Deviation Surveys</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (d) => d.date ?? "" },
          { header: "Des", width: "w-48", cell: (d) => d.des ?? "" },
          { header: "Prop?", width: "w-20", cell: (d) => yesNo(d.proposed) },
          { header: "Definitive?", cell: (d) => yesNo(d.definitive) },
        ] as PreviewColumn<Report22Payload["deviationSurveys"][number]>[]}
        rows={payload.deviationSurveys} emptyText="No survey recorded." />

      <SectionBar>Reservoirs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Res Name", width: "w-44", cell: (r) => r.name ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (r) => headerValue(r.btmMkb) },
          { header: "Res Datum Depth (m)", align: "right", cell: (r) => headerValue(r.datumDepthM) },
        ] as PreviewColumn<Report22Payload["reservoirs"][number]>[]}
        rows={payload.reservoirs} emptyText="No reservoir recorded." />

      <SectionBar>Casing Strings</SectionBar>
      <PreviewTable
        columns={[
          { header: "String", width: "w-56", cell: (c) => c.caption },
          { header: "Run Date", width: "w-28", cell: (c) => c.runDate ?? "" },
          { header: "Centralizers", width: "w-44", cell: (c) => c.centralizers ?? "" },
          { header: "Scratchers", width: "w-32", cell: (c) => c.scratchers ?? "" },
          { header: "Drift Min (in)", align: "right", cell: (c) => headerValue(c.minDriftIn, "in3") },
        ] as PreviewColumn<Report22Payload["casingStrings"][number]>[]}
        rows={payload.casingStrings} emptyText="No casing string recorded." />

      <SectionBar>Tubing Strings</SectionBar>
      <TubingBlocks blocks={payload.tubingStrings} />

      <SectionBar>Perforations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (p) => p.date ?? "" },
          { header: "Zone", width: "w-40", cell: (p) => p.zone ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.topMkb) },
          { header: "Btm (mKB)", align: "right", cell: (p) => headerValue(p.btmMkb) },
        ] as PreviewColumn<Report22Payload["perforations"][number]>[]}
        rows={payload.perforations} emptyText="No perforation recorded." />

      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 30 — Well Summary ═══════════════════════════════════════════════════════ */

export function Report30Preview({ payload }: { payload: Report30Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.identity} />
      <HeaderGrid rows={[payload.elevations]} />

      <SectionBar>Directions To Well</SectionBar>
      <div className="border border-t-0 border-gray-400 px-2 py-1.5 text-[11px] text-gray-900 leading-snug whitespace-pre-wrap min-h-[24px]">
        {payload.directionsToWell ?? ""}
      </div>

      <SectionBar>Wellheads</SectionBar>
      <PreviewTable
        columns={[
          { header: "Type", width: "w-40", cell: (w) => w.type ?? "" },
          { header: "Make", width: "w-32", cell: (w) => w.make ?? "" },
          { header: "WP (psi)", width: "w-28", align: "right", cell: (w) => headerValue(w.wpPsi) },
          { header: "Service", cell: (w) => w.service ?? "" },
        ] as PreviewColumn<Report30Payload["wellhead"][number]>[]}
        rows={payload.wellhead} emptyText="No wellhead component recorded." />

      <SectionBar>Wellbores</SectionBar>
      <PreviewTable
        columns={[
          { header: "Wellbore Name", width: "w-44", cell: (w) => w.name ?? "" },
          { header: "Parent Wellbore", width: "w-40", cell: (w) => w.parent ?? "" },
          { header: "Profile", width: "w-32", cell: (w) => w.profile ?? "" },
          { header: "KO MD (mKB)", align: "right", cell: (w) => headerValue(w.koMdMkb) },
        ] as PreviewColumn<Report30Payload["wellbores"][number]>[]}
        rows={payload.wellbores} emptyText="No wellbore recorded." />

      <SectionBar>Casing Strings</SectionBar>
      <PreviewTable
        columns={[
          { header: "Csg Des", width: "w-44", cell: (c) => c.description ?? "" },
          { header: "Run Date", width: "w-28", cell: (c) => c.runDate ?? "" },
          { header: "OD (in)", width: "w-24", cell: (c) => c.odIn ?? "" },
          { header: "ID (in)", width: "w-24", align: "right", cell: (c) => headerValue(c.idIn, "in3") },
          { header: "Wt/Len (kg/m)", width: "w-28", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
          { header: "Grade", width: "w-24", cell: (c) => c.grade ?? "" },
          { header: "Set Depth (mKB)", align: "right", cell: (c) => headerValue(c.setDepthMkb) },
        ] as PreviewColumn<Report30Payload["casingStrings"][number]>[]}
        rows={payload.casingStrings} emptyText="No casing string recorded." />

      <SectionBar>Cement</SectionBar>
      {payload.cementJobs.length === 0 ? (
        <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
          No cement job recorded.
        </div>
      ) : payload.cementJobs.map((j, i) => (
        <div key={i}>
          <SectionBar>{j.caption}</SectionBar>
          <HeaderGrid rows={[j.stage]} />
          <PreviewTable
            columns={[
              { header: "Fluid Description", width: "w-56", cell: (f) => f.description ?? "" },
              { header: "Fluid Type", width: "w-32", cell: (f) => f.type ?? "" },
              { header: "Amount (sacks)", width: "w-32", align: "right", cell: (f) => headerValue(f.amountSacks) },
              { header: "Class", cell: (f) => f.cementClass ?? "" },
            ] as PreviewColumn<Report30Payload["cementJobs"][number]["fluids"][number]>[]}
            rows={j.fluids} emptyText="No fluid recorded on this stage." />
        </div>
      ))}

      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 23 — Daily Completion and Workover ══════════════════════════════════════ */

export function Report23Preview({ payload }: { payload: Report23Payload }) {
  return (
    <PreviewSheet wide>
      <PreviewTitle>{payload.title}</PreviewTitle>
      {payload.identityRight && (
        <div className="text-right text-[11px] text-gray-700 mb-0.5">{payload.identityRight}</div>
      )}
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      <HeaderGrid rows={[payload.completionHeader]} />

      <SectionBar>{payload.caption}</SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="23" width={560} height={380} />
      <SchematicLegend />

      <HeaderGrid rows={payload.jobHeader} />
      <SectionBar>Daily Readings</SectionBar>
      <HeaderGrid rows={[payload.dailyReadings]} />

      <SectionBar>Daily Contacts</SectionBar>
      <PreviewTable
        columns={[
          { header: "Job Contact", width: "w-48", cell: (c) => c.jobContact ?? "" },
          { header: "Title", width: "w-40", cell: (c) => c.title ?? "" },
          { header: "Mobile", cell: (c) => c.mobile ?? "" },
        ] as PreviewColumn<Report23Payload["contacts"][number]>[]}
        rows={payload.contacts} emptyText="No contact on this day." />

      <SectionBar>Time Log</SectionBar>
      <PreviewTable
        columns={[
          { header: "Start Time", width: "w-24", cell: (t) => t.startTime ?? "" },
          { header: "End Time", width: "w-24", cell: (t) => t.endTime ?? "" },
          { header: "Dur (hr)", width: "w-20", align: "right", cell: (t) => headerValue(t.durHr) },
          { header: "Code 1", width: "w-20", cell: (t) => t.code1 ?? "" },
          { header: "Code 2", width: "w-28", cell: (t) => t.code2 ?? "" },
          { header: "Com", cell: (t) => t.com ?? "" },
        ] as PreviewColumn<Report23Payload["timeLog"][number]>[]}
        rows={payload.timeLog} emptyText="No interval logged." />

      <SectionBar>Report Fluids Summary</SectionBar>
      <PreviewTable
        columns={[
          { header: "Fluid", width: "w-56", cell: (f) => f.fluid ?? "" },
          { header: "To well (bbl)", width: "w-32", align: "right", cell: (f) => headerValue(f.toWellBbl) },
          { header: "From well (bbl)", align: "right", cell: (f) => headerValue(f.fromWellBbl) },
        ] as PreviewColumn<Report23Payload["fluids"][number]>[]}
        rows={payload.fluids} emptyText="No fluid moved on this day." />

      <SectionBar>Safety Checks</SectionBar>
      <PreviewTable
        columns={[
          { header: "Time", width: "w-20", cell: (c) => c.time ?? "" },
          { header: "Des", width: "w-56", cell: (c) => c.des ?? "" },
          { header: "Type", width: "w-32", cell: (c) => c.type ?? "" },
          { header: "Com", cell: (c) => c.com ?? "" },
        ] as PreviewColumn<Report23Payload["safetyChecks"][number]>[]}
        rows={payload.safetyChecks} emptyText="No safety check on this day." />

      <SectionBar>Logs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Time", width: "w-20", cell: (l) => l.time ?? "" },
          { header: "Type", width: "w-40", cell: (l) => l.type ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (l) => headerValue(l.topMkb) },
          { header: "Btm (mKB)", align: "right", cell: (l) => headerValue(l.btmMkb) },
        ] as PreviewColumn<Report23Payload["logs"][number]>[]}
        rows={payload.logs} emptyText="No log run on this day." />

      <SectionBar>Perforations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (p) => p.date ?? "" },
          { header: "Zone", width: "w-40", cell: (p) => p.zone ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.btmMkb) },
          { header: "Current Status", cell: (p) => p.status ?? "" },
        ] as PreviewColumn<Report23Payload["perforations"][number]>[]}
        rows={payload.perforations}
        emptyText="Nothing perforated on or before this day." />

      <SectionBar>Stimulations &amp; Treatments</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (st) => st.date ?? "" },
          { header: "Time", width: "w-20", cell: (st) => st.time ?? "" },
          { header: "Zone", width: "w-40", cell: (st) => st.zone ?? "" },
          { header: "Type", width: "w-28", cell: (st) => st.type ?? "" },
          { header: "Delivery Mode", width: "w-32", cell: (st) => st.deliveryMode ?? "" },
          { header: "Stim/Treat Company", cell: (st) => st.company ?? "" },
        ] as PreviewColumn<Report23Payload["stimulations"][number]>[]}
        rows={payload.stimulations}
        emptyText="Nothing treated on or before this day." />

      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        The perforations and treatments listed are those done ON OR BEFORE this day. A workover sheet
        that lists a perforation shot next week is a plan, not a record.
      </div>
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/** Re-exported so the PDF builders format money identically to the page. */
export { money };
