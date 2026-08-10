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
  CasingBlock, CementBlock, PerforationBlock, Report22Payload, Report23Payload,
  Report24Payload, Report26Payload, Report28Payload, Report29Payload, Report30Payload,
  RodBlock, StimulationBlock, TubingBlock, TubingDayRow,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { SchematicLegend, WellboreSchematic } from "./WellboreSchematic.js";

const yesNo = (v: boolean | null) => (v === null ? "" : v ? "Yes" : "No");

/** The tubing tally, in the shape reports 22, 24 and 30 all print it. */
/**
 * A casing string and the tally underneath it — the shape the samples print and
 * report 05 already prints on its own. A string header with no tally says what
 * was run but not what it was made of, which is the question the block exists
 * to answer.
 */
function CasingBlocks({ blocks }: { blocks: CasingBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No casing string recorded — enter one under Well data → Casing.
      </div>
    );
  }
  return (
    <>
      {blocks.map((c, i) => (
        <div key={i}>
          <SectionBar>{c.caption}</SectionBar>
          <HeaderGrid rows={[c.header]} />
          <PreviewTable
            columns={[
              { header: "OD (in)", width: "w-24", cell: (k) => k.odIn ?? "" },
              { header: "Item Des", width: "w-44", cell: (k) => k.itemDes ?? "" },
              { header: "Btm (mKB)", width: "w-28", align: "right", cell: (k) => headerValue(k.btmMkb) },
              { header: "Jts", width: "w-16", align: "right", cell: (k) => headerValue(k.jts, "int") },
              { header: "ID (in)", width: "w-24", align: "right", cell: (k) => headerValue(k.idIn, "in3") },
              { header: "Wt (kg/m)", width: "w-24", align: "right", cell: (k) => headerValue(k.massPerLenKgM) },
              { header: "Grade", width: "w-20", cell: (k) => k.grade ?? "" },
              { header: "Top Thread", cell: (k) => k.topThread ?? "" },
            ] as PreviewColumn<CasingBlock["components"][number]>[]}
            rows={c.components} emptyText="No tally entered for this string." />
        </div>
      ))}
    </>
  );
}

/** A cement job: who pumped it, then a stage and its fluids for each stage. */
function CementBlocks({ blocks }: { blocks: CementBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No cement job recorded — enter one under Well data → Casing.
      </div>
    );
  }
  return (
    <>
      {blocks.map((c, i) => (
        <div key={i}>
          <SectionBar>{c.caption}</SectionBar>
          <HeaderGrid rows={[c.header]} />
          {c.stages.map((st, k) => (
            <div key={k}>
              <HeaderGrid rows={[st.stage]} />
              <PreviewTable
                columns={[
                  { header: "Fluid", width: "w-24", cell: (f) => f.fluidType ?? "" },
                  { header: "Class", width: "w-20", cell: (f) => f.cementClass ?? "" },
                  { header: "Amount (sacks)", width: "w-32", align: "right", cell: (f) => headerValue(f.amountSacks) },
                  { header: "Yield (L/sack)", width: "w-32", align: "right", cell: (f) => headerValue(f.yieldLPerSack) },
                  { header: "Mix H2O (L/sack)", width: "w-32", align: "right", cell: (f) => headerValue(f.mixWaterLPerSack) },
                  { header: "Vol Pumped (m³)", width: "w-32", align: "right", cell: (f) => headerValue(f.volumePumpedM3) },
                  { header: "Fluid Des", cell: (f) => f.fluidDescription ?? "" },
                ] as PreviewColumn<CementBlock["stages"][number]["fluids"][number]>[]}
                rows={st.fluids} emptyText="No fluid recorded for this stage." />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** A rod string and its make-up — the same shape as a tubing string. */
function RodBlocks({ blocks }: { blocks: RodBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No rod string recorded — a flowing well has none.
      </div>
    );
  }
  return (
    <>
      {blocks.map((r, i) => (
        <div key={i}>
          <SectionBar>{r.caption}</SectionBar>
          <HeaderGrid rows={[r.header]} />
          <PreviewTable
            columns={[
              { header: "Item Description", width: "w-48", cell: (c) => c.itemDes ?? "" },
              { header: "OD Nominal (in)", width: "w-32", cell: (c) => c.odNominalIn ?? "" },
              { header: "Weight/Length (kg/m)", width: "w-36", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
              { header: "Grade", width: "w-28", cell: (c) => c.grade ?? "" },
              { header: "Joints", width: "w-20", align: "right", cell: (c) => headerValue(c.joints, "int") },
              { header: "Length (m)", width: "w-28", align: "right", cell: (c) => headerValue(c.lenM) },
              { header: "Top Depth (mKB)", width: "w-32", align: "right", cell: (c) => headerValue(c.topMkb) },
              { header: "Bottom Depth (mKB)", align: "right", cell: (c) => headerValue(c.btmMkb) },
            ] as PreviewColumn<RodBlock["components"][number]>[]}
            rows={r.components} emptyText="No rod entered for this string." />
        </div>
      ))}
    </>
  );
}

/** A stimulation and the stages pumped into it. */
function StimulationBlocks({ blocks }: { blocks: StimulationBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
        No stimulation recorded — enter one under Well data → Completion.
      </div>
    );
  }
  return (
    <>
      {blocks.map((st, i) => (
        <div key={i}>
          <SectionBar>{st.caption}</SectionBar>
          <HeaderGrid rows={[st.header]} />
          <PreviewTable
            columns={[
              { header: "Stg #", width: "w-20", align: "right", cell: (g) => headerValue(g.stageNo, "int") },
              { header: "Stage Type", width: "w-44", cell: (g) => g.stageType ?? "" },
              { header: "Top Depth (mKB)", width: "w-36", align: "right", cell: (g) => headerValue(g.topDepthMkb) },
              { header: "Bottom Depth (mKB)", width: "w-36", align: "right", cell: (g) => headerValue(g.bottomDepthMkb) },
              { header: "Clean Volume Pumped (m³)", align: "right", cell: (g) => headerValue(g.cleanVolPumpedM3) },
            ] as PreviewColumn<StimulationBlock["stages"][number]>[]}
            rows={st.stages} emptyText="No stage recorded." />
        </div>
      ))}
    </>
  );
}

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
          { header: "WP (psi)", width: "w-28", align: "right", cell: (w) => headerValue(w.wpPsi) },
          { header: "Service", width: "w-28", cell: (w) => w.service ?? "" },
          { header: "WP Top (psi)", width: "w-28", align: "right", cell: (w) => headerValue(w.wpTopPsi) },
          { header: "Top Ring Gasket", width: "w-32", cell: (w) => w.topRingGasket ?? "" },
          { header: "Bore Min (in)", align: "right", cell: (w) => headerValue(w.boreMinIn, "in3") },
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

      <SectionBar>Rod Strings</SectionBar>
      <RodBlocks blocks={payload.rodStrings} />


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

      {/* TWO pictures, not one overlaid: the same well with a different STRING
          in it. Overlaying a designed completion on the one that was run would
          put two items at the same depth with no way to tell which is which —
          and the differences between them are the whole report. */}
      <div className="border border-gray-400 border-t-0 bg-white p-2 flex gap-4 overflow-x-auto">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 pb-0.5">
            Proposed (as designed)
          </div>
          <WellboreSchematic payload={payload.proposed} reportType="29-proposed" width={330} height={440} />
        </div>
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 pb-0.5">
            Actual (as run)
          </div>
          <WellboreSchematic payload={payload.actual} reportType="29" width={330} height={440} />
        </div>
      </div>
      <SchematicLegend />
      <HeaderGrid rows={[payload.comparison]} />
      <div className="border border-t-0 border-gray-400 px-2 py-1 text-[11px] text-gray-500 leading-snug">
        Both sides are the same hole and the same casing — what differs is the completion string
        inside them. Mark a tubing string as <em>proposed</em> under Well data → Completion to draw it
        on the left.
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
          { header: "Geologic Age", width: "w-28", cell: (f) => f.geologicAge ?? "" },
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
      <CasingBlocks blocks={payload.casingStrings} />

      <SectionBar>Cement</SectionBar>
      <CementBlocks blocks={payload.cementJobs} />

      <SectionBar>Other In Hole</SectionBar>
      <PreviewTable
        columns={[
          { header: "OD (in)", width: "w-24", cell: (o) => o.odIn ?? "" },
          { header: "Des", width: "w-56", cell: (o) => o.des ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (o) => headerValue(o.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (o) => headerValue(o.btmMkb) },
          { header: "ID (in)", width: "w-24", align: "right", cell: (o) => headerValue(o.idIn, "in3") },
          { header: "Make", width: "w-32", cell: (o) => o.make ?? "" },
          { header: "Model", cell: (o) => o.model ?? "" },
        ] as PreviewColumn<Report22Payload["otherInHole"][number]>[]}
        rows={payload.otherInHole} emptyText="Nothing else in the hole." />

      <SectionBar>Wellhead</SectionBar>
      {payload.wellheadMaster ? <HeaderGrid rows={[payload.wellheadMaster]} /> : (
        <div className="bg-white border border-gray-400 border-t-0 px-2 py-3 text-[11px] text-gray-400">
          No wellhead recorded.
        </div>
      )}
      <PreviewTable
        columns={[
          { header: "Make", width: "w-28", cell: (w) => w.make ?? "" },
          { header: "Model", width: "w-24", cell: (w) => w.model ?? "" },
          { header: "Section", width: "w-20", cell: (w) => w.section ?? "" },
          { header: "Top Conn Typ", width: "w-36", cell: (w) => w.topConnType ?? "" },
          { header: "Top Sz (in)", width: "w-24", align: "right", cell: (w) => headerValue(w.topSizeIn, "in3") },
          { header: "Btm Conn Typ", width: "w-36", cell: (w) => w.btmConnType ?? "" },
          { header: "Btm Sz (in)", width: "w-24", align: "right", cell: (w) => headerValue(w.btmSizeIn, "in3") },
          { header: "Des", width: "w-44", cell: (w) => w.des ?? "" },
          { header: "WP (psi)", align: "right", cell: (w) => headerValue(w.wpPsi) },
        ] as PreviewColumn<Report22Payload["wellheadComponents"][number]>[]}
        rows={payload.wellheadComponents} emptyText="No wellhead component recorded." />

      <SectionBar>General Notes</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (n) => n.date ?? "" },
          { header: "Com", cell: (n) => n.com ?? "" },
        ] as PreviewColumn<Report22Payload["generalNotes"][number]>[]}
        rows={payload.generalNotes} emptyText="No note recorded." />

      {payload.jobs.map((j, i) => (
        <div key={`job-${i}`}>
          <SectionBar>{j.caption}</SectionBar>
          <HeaderGrid rows={[j.header, j.money]} />
          {j.summary && (
            <div className="bg-white border border-gray-400 border-t-0 px-2 py-1 text-[11px] leading-snug">
              <span className="text-gray-500">Summary: </span>{j.summary}
            </div>
          )}
          <HeaderGrid rows={[j.savings]} />
          <PreviewTable
            columns={[
              { header: "Phase Type 1", width: "w-56", cell: (ph) => ph.phaseType ?? "" },
              { header: "Planned Likely Phase Cost", width: "w-40", align: "right", cell: (ph) => money(ph.plannedCost) },
              { header: "Pl Cum Days ML", width: "w-32", align: "right", cell: (ph) => headerValue(ph.plCumDaysMl) },
              { header: "Planned End Depth (mKB)", align: "right", cell: (ph) => headerValue(ph.plannedEndDepthMkb) },
            ] as PreviewColumn<Report22Payload["jobs"][number]["phases"][number]>[]}
            rows={j.phases} emptyText="No phase planned." />
          <PreviewTable
            columns={[
              { header: "Contact Name", width: "w-40", cell: (c) => c.contactName ?? "" },
              { header: "Company", width: "w-40", cell: (c) => c.company ?? "" },
              { header: "Title", width: "w-40", cell: (c) => c.title ?? "" },
              { header: "Office", width: "w-32", cell: (c) => c.office ?? "" },
              { header: "Mobile", cell: (c) => c.mobile ?? "" },
            ] as PreviewColumn<Report22Payload["jobs"][number]["contacts"][number]>[]}
            rows={j.contacts} emptyText="No contact recorded." />
        </div>
      ))}

      {payload.bhas.map((b, i) => (
        <div key={`bha-${i}`}>
          <SectionBar>{b.caption}</SectionBar>
          <HeaderGrid rows={[b.header, b.figures]} />
          <div className="bg-white border border-gray-400 border-t-0 px-2 py-1 text-[11px] leading-snug">
            <span className="text-gray-500">String Components: </span>
            {b.stringComponents || <span className="text-gray-400">none recorded</span>}
          </div>
        </div>
      ))}

      <SectionBar>Logs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (l) => l.date ?? "" },
          { header: "Type", width: "w-48", cell: (l) => l.type ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (l) => headerValue(l.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (l) => headerValue(l.btmMkb) },
          { header: "Logging Company", cell: (l) => l.company ?? "" },
        ] as PreviewColumn<Report22Payload["logs"][number]>[]}
        rows={payload.logs} emptyText="No log run recorded." />

      <SectionBar>Bottom Hole Cores</SectionBar>
      <PreviewTable
        columns={[
          { header: "Core #", width: "w-20", cell: (c) => c.coreNo ?? "" },
          { header: "Type", width: "w-36", cell: (c) => c.type ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (c) => headerValue(c.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (c) => headerValue(c.btmMkb) },
          { header: "Recov (m)", width: "w-28", align: "right", cell: (c) => headerValue(c.recoveredM) },
          { header: "Wellbore", cell: (c) => c.wellbore ?? "" },
        ] as PreviewColumn<Report22Payload["cores"][number]>[]}
        rows={payload.cores} emptyText="No core cut." />

      <SectionBar>Leak Off and Formation Integrity Tests</SectionBar>
      <PreviewTable
        columns={[
          { header: "Test Date", width: "w-28", cell: (t) => t.testDate ?? "" },
          { header: "Last Casing String Run", width: "w-56", cell: (t) => t.lastCasingStringRun ?? "" },
          { header: "P Surf Applied (psi)", width: "w-32", align: "right", cell: (t) => headerValue(t.pSurfAppliedPsi) },
          { header: "Depth (mKB)", width: "w-28", align: "right", cell: (t) => headerValue(t.depthMkb) },
          { header: "Dens Fluid (lb/gal)", width: "w-32", align: "right", cell: (t) => headerValue(t.fluidDensityPpg) },
          { header: "Leak off?", cell: (t) => yesNo(t.leakedOff) },
        ] as PreviewColumn<Report22Payload["leakOffTests"][number]>[]}
        rows={payload.leakOffTests} emptyText="No pressure test recorded." />

      <SectionBar>Schematic Annotations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Depth (mKB)", width: "w-32", align: "right", cell: (a) => headerValue(a.depthMkb) },
          { header: "Annotation", cell: (a) => a.annotation ?? "" },
        ] as PreviewColumn<Report22Payload["annotations"][number]>[]}
        rows={payload.annotations} emptyText="No annotation." />

      <SectionBar>Production Failures</SectionBar>
      <PreviewTable
        columns={[
          { header: "Failure Date", width: "w-28", cell: (f) => f.date ?? "" },
          { header: "Failure Des", width: "w-56", cell: (f) => f.failureDes ?? "" },
          { header: "Fail Typ", width: "w-28", cell: (f) => f.failureType ?? "" },
          { header: "Cause", width: "w-44", cell: (f) => f.cause ?? "" },
          { header: "Failed Item", width: "w-36", cell: (f) => f.failedItem ?? "" },
          { header: "Resolved Date", width: "w-28", cell: (f) => f.resolvedDate ?? "" },
          { header: "Est Fail (Cost)", align: "right", cell: (f) => money(f.cost) },
        ] as PreviewColumn<Report22Payload["productionFailures"][number]>[]}
        rows={payload.productionFailures} emptyText="No production failure recorded." />

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
          <div className="bg-white border border-gray-400 border-t-0 px-2 py-1 text-[11px]">
            <span className="text-gray-500">Cementing Company: </span>
            {j.company ?? <span className="text-gray-400">not recorded</span>}
          </div>
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

      <SectionBar>Other In Hole</SectionBar>
      <PreviewTable
        columns={[
          { header: "Des", width: "w-56", cell: (o) => o.des ?? "" },
          { header: "Top (mKB)", width: "w-32", align: "right", cell: (o) => headerValue(o.topMkb) },
          { header: "Btm (mKB)", width: "w-32", align: "right", cell: (o) => headerValue(o.btmMkb) },
          { header: "Run Date", width: "w-32", cell: (o) => o.runDate ?? "" },
          { header: "Pull Date", cell: (o) => o.pullDate ?? "" },
        ] as PreviewColumn<Report30Payload["otherInHole"][number]>[]}
        rows={payload.otherInHole} emptyText="Nothing else in the hole." />

      <SectionBar>Zones</SectionBar>
      <PreviewTable
        columns={[
          { header: "Zone Name", width: "w-48", cell: (z) => z.name ?? "" },
          { header: "Top (mKB)", width: "w-32", align: "right", cell: (z) => headerValue(z.topMkb) },
          { header: "Btm (mKB)", width: "w-32", align: "right", cell: (z) => headerValue(z.btmMkb) },
          { header: "Current Status", width: "w-40", cell: (z) => z.status ?? "" },
          { header: "Cur Stat Date", cell: (z) => z.statusDate ?? "" },
        ] as PreviewColumn<Report30Payload["zones"][number]>[]}
        rows={payload.zones} emptyText="No zone recorded." />

      <SectionBar>Perforations</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (p) => p.date ?? "" },
          { header: "Type", width: "w-28", cell: (p) => p.type ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (p) => headerValue(p.btmMkb) },
          { header: "Zone", width: "w-40", cell: (p) => p.zone ?? "" },
          { header: "Shot Dens (shots/m)", width: "w-32", align: "right", cell: (p) => headerValue(p.shotDensityPerM) },
          { header: "Phasing (°)", width: "w-28", align: "right", cell: (p) => headerValue(p.phasingDeg) },
          { header: "Current Status", cell: (p) => p.status ?? "" },
        ] as PreviewColumn<Report30Payload["perforations"][number]>[]}
        rows={payload.perforations} emptyText="No perforation recorded." />

      <SectionBar>Stimulations &amp; Treatments</SectionBar>
      <StimulationBlocks blocks={payload.stimulations} />

      <SectionBar>Logs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (l) => l.date ?? "" },
          { header: "Top (mKB)", width: "w-32", align: "right", cell: (l) => headerValue(l.topMkb) },
          { header: "Btm (mKB)", width: "w-32", align: "right", cell: (l) => headerValue(l.btmMkb) },
          { header: "Type", width: "w-56", cell: (l) => l.type ?? "" },
          { header: "Cased?", cell: (l) => yesNo(l.cased) },
        ] as PreviewColumn<Report30Payload["logs"][number]>[]}
        rows={payload.logs} emptyText="No log run recorded." />

      <SectionBar>Tubing Strings</SectionBar>
      <TubingBlocks blocks={payload.tubingStrings} />

      <SectionBar>Rod Strings</SectionBar>
      <RodBlocks blocks={payload.rodStrings} />

      <SectionBar>Rod Pumps</SectionBar>
      {payload.rodPumps.length === 0 ? (
        <div className="border border-t-0 border-gray-400 px-2 py-2 text-[11px] text-gray-400">
          No rod pump recorded — a flowing well has none.
        </div>
      ) : <HeaderGrid rows={payload.rodPumps} />}

      <SectionBar>Swabs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Date", width: "w-28", cell: (w) => w.date ?? "" },
          { header: "Swab Comp", width: "w-44", cell: (w) => w.swabCompany ?? "" },
          { header: "Zone", width: "w-40", cell: (w) => w.zone ?? "" },
          { header: "Total Vol (bbl)", width: "w-32", align: "right", cell: (w) => headerValue(w.totalVolBbl) },
          { header: "Total Oil (bbl)", width: "w-32", align: "right", cell: (w) => headerValue(w.totalOilBbl) },
          { header: "Total BSW (bbl)", align: "right", cell: (w) => headerValue(w.totalBswBbl) },
        ] as PreviewColumn<Report30Payload["swabs"][number]>[]}
        rows={payload.swabs} emptyText="No swab run recorded." />

      <SectionBar>Jobs</SectionBar>
      <PreviewTable
        columns={[
          { header: "Start Date", width: "w-28", cell: (j) => j.startDate ?? "" },
          { header: "End Date", width: "w-28", cell: (j) => j.endDate ?? "" },
          { header: "Job Typ", width: "w-44", cell: (j) => j.jobType ?? "" },
          { header: "Job SubTyp", width: "w-40", cell: (j) => j.jobSubType ?? "" },
          { header: "Summary", cell: (j) => j.summary ?? "" },
        ] as PreviewColumn<Report30Payload["jobs"][number]>[]}
        rows={payload.jobs} emptyText="No job recorded." />

      <SectionBar>Attachments</SectionBar>
      <PreviewTable
        columns={[
          { header: "Des", width: "w-96", cell: (a) => a.des ?? "" },
          { header: "Kind", width: "w-32", cell: (a) => a.kind ?? "" },
          { header: "Date", cell: (a) => a.date ?? "" },
        ] as PreviewColumn<Report30Payload["attachments"][number]>[]}
        rows={payload.attachments} emptyText="No attachment recorded." />

      <HeaderGrid rows={[payload.totals]} />
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

/* ══ 23 — Daily Completion and Workover ══════════════════════════════════════ */

/** The two tubing tables differ only in the name of their time column. */
const TUBING_DAY_COLUMNS = (timeHeader: string): PreviewColumn<TubingDayRow>[] => [
  { header: timeHeader, width: "w-28", cell: (t) => t.time ?? "" },
  { header: "Tubing Description", width: "w-56", cell: (t) => t.description ?? "" },
  { header: "Set Depth (mKB)", width: "w-32", align: "right", cell: (t) => headerValue(t.setDepthMkb) },
  { header: "String Max Nominal OD (in)", width: "w-36", cell: (t) => t.maxNominalOdIn ?? "" },
  { header: "Weight/Length (kg/m)", width: "w-36", align: "right", cell: (t) => headerValue(t.massPerLenKgM) },
  { header: "String Grade", cell: (t) => t.grade ?? "" },
];

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
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (l) => headerValue(l.btmMkb) },
          { header: "Cased?", cell: (l) => yesNo(l.cased) },
        ] as PreviewColumn<Report23Payload["logs"][number]>[]}
        rows={payload.logs} emptyText="No log run on this day." />

      {/* What went IN and what came OUT today. Each is the register filtered to
          this day — the same rows read against another day are another report. */}
      <SectionBar>Tubing Run</SectionBar>
      <PreviewTable columns={TUBING_DAY_COLUMNS("Run Time")} rows={payload.tubingRun}
        emptyText="No tubing run on this day." />

      <SectionBar>Tubing Pulled</SectionBar>
      <PreviewTable columns={TUBING_DAY_COLUMNS("Pull Time")} rows={payload.tubingPulled}
        emptyText="No tubing pulled on this day." />

      <SectionBar>Other in Hole Run (Bridge Plugs, etc)</SectionBar>
      <PreviewTable
        columns={[
          { header: "Run Time", width: "w-28", cell: (o) => o.time ?? "" },
          { header: "Des", width: "w-64", cell: (o) => o.des ?? "" },
          { header: "OD (in)", width: "w-24", cell: (o) => o.odIn ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (o) => headerValue(o.topMkb) },
          { header: "Btm (mKB)", align: "right", cell: (o) => headerValue(o.btmMkb) },
        ] as PreviewColumn<Report23Payload["otherInHoleRun"][number]>[]}
        rows={payload.otherInHoleRun} emptyText="Nothing run in the hole on this day." />

      <SectionBar>Other in Hole Pulled (Bridge Plugs, etc)</SectionBar>
      <PreviewTable
        columns={[
          { header: "Pull Time", width: "w-28", cell: (o) => o.time ?? "" },
          { header: "Des", width: "w-64", cell: (o) => o.des ?? "" },
          { header: "Top (mKB)", width: "w-28", align: "right", cell: (o) => headerValue(o.topMkb) },
          { header: "Btm (mKB)", width: "w-28", align: "right", cell: (o) => headerValue(o.btmMkb) },
          { header: "OD (in)", cell: (o) => o.odIn ?? "" },
        ] as PreviewColumn<Report23Payload["otherInHolePulled"][number]>[]}
        rows={payload.otherInHolePulled} emptyText="Nothing pulled from the hole on this day." />

      <SectionBar>Cement</SectionBar>
      <PreviewTable
        columns={[
          { header: "Start Time", width: "w-28", cell: (c) => c.startTime ?? "" },
          { header: "Des", width: "w-56", cell: (c) => c.des ?? "" },
          { header: "Type", width: "w-28", cell: (c) => c.type ?? "" },
          { header: "String", width: "w-44", cell: (c) => c.string ?? "" },
          { header: "Cement Comp", cell: (c) => c.company ?? "" },
        ] as PreviewColumn<Report23Payload["cementOnDay"][number]>[]}
        rows={payload.cementOnDay} emptyText="No cement pumped on this day." />

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
