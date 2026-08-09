/**
 * On-screen previews of reports 04 (Casing, Liner and Cement) and 05 (Casing
 * Summary).
 *
 * 05 is every string on the well, 04 is one string in full. The tally is the
 * same block in both — rendered by one component here, as it is assembled by one
 * function on the server, so the column set cannot drift between them.
 */
import { headerValue } from "../../export/reportChrome.js";
import type {
  CasingComponentRow, CasingStringBlock, Report04Payload, Report05Payload,
} from "../../entry/wellview.js";
import {
  HeaderGrid, IdentityLine, PreviewFooter, PreviewSheet, PreviewTable, PreviewTitle,
  SectionBar, type PreviewColumn,
} from "./ReportPreview.js";
import { SchematicLegend, WellboreSchematic } from "./WellboreSchematic.js";

const TALLY_COLUMNS: PreviewColumn<CasingComponentRow>[] = [
  { header: "Jts", width: "w-12", align: "right", cell: (c) => headerValue(c.jts, "int") },
  { header: "Item Des", width: "w-28", cell: (c) => c.itemDes ?? "" },
  { header: "OD (in)", width: "w-20", cell: (c) => c.odIn ?? "" },
  { header: "ID (in)", width: "w-20", align: "right", cell: (c) => headerValue(c.idIn, "in3") },
  { header: "Wt (kg/m)", width: "w-20", align: "right", cell: (c) => headerValue(c.massPerLenKgM) },
  { header: "Grade", width: "w-16", cell: (c) => c.grade ?? "" },
  { header: "Top Thread", width: "w-20", cell: (c) => c.topThread ?? "" },
  { header: "Top (mKB)", width: "w-24", align: "right", cell: (c) => headerValue(c.topMkb) },
  { header: "Btm (mKB)", width: "w-24", align: "right", cell: (c) => headerValue(c.btmMkb) },
  { header: "Len (m)", width: "w-24", align: "right", cell: (c) => headerValue(c.lenM) },
  { header: "P Burst (psi)", width: "w-20", align: "right", cell: (c) => headerValue(c.pBurstPsi) },
  { header: "P Collapse (psi)", width: "w-20", align: "right", cell: (c) => headerValue(c.pCollapsePsi) },
];

/** One string: its caption, its properties line, its tally and the roll-up. */
function StringBlock({ block }: { block: CasingStringBlock }) {
  return (
    <>
      <SectionBar>{block.caption}</SectionBar>
      <HeaderGrid rows={[block.properties]} />
      <PreviewTable
        columns={TALLY_COLUMNS}
        rows={block.components}
        emptyText="No tally recorded for this string."
      />
      <HeaderGrid rows={[block.totals]} />
    </>
  );
}

export function Report05Preview({ payload }: { payload: Report05Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} />
      <HeaderGrid rows={payload.header} />
      {payload.strings.length === 0 ? (
        <div className="border border-gray-400 border-t-0 px-1.5 py-2 text-[11px] italic text-gray-400">
          No casing string recorded on this well — add one under Well data → Casing &amp; cement.
        </div>
      ) : payload.strings.map((s, i) => <StringBlock key={i} block={s} />)}
      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}

export function Report04Preview({ payload }: { payload: Report04Payload }) {
  return (
    <PreviewSheet>
      <PreviewTitle>{payload.title}</PreviewTitle>
      <IdentityLine wellName={payload.wellName} right={payload.identityRight} />
      <HeaderGrid rows={payload.header} />
      {payload.runCaption && (
        <div className="px-1 py-1 text-[11px] text-gray-600">{payload.runCaption}</div>
      )}

      <SectionBar>Wellbore</SectionBar>
      <HeaderGrid rows={[payload.wellbore]} />

      <SectionBar>Sections</SectionBar>
      <PreviewTable
        columns={[
          { header: "Section Des", cell: (h) => h.sectionDes ?? "" },
          { header: "Size (in)", width: "w-24", cell: (h) => h.sizeIn ?? "" },
          { header: "Act Top (mKB)", width: "w-28", align: "right", cell: (h) => headerValue(h.actTopMkb) },
          { header: "Act Btm (mKB)", width: "w-28", align: "right", cell: (h) => headerValue(h.actBtmMkb) },
        ]}
        rows={payload.sections}
        emptyText="No hole section recorded."
      />

      <SectionBar>Wellhead</SectionBar>
      <PreviewTable
        columns={[
          { header: "Des", cell: (w) => w.des ?? "" },
          { header: "Make", width: "w-28", cell: (w) => w.make ?? "" },
          { header: "Model", width: "w-28", cell: (w) => w.model ?? "" },
          { header: "SN", width: "w-24", cell: (w) => w.sn ?? "" },
          { header: "WP Top (psi)", width: "w-24", align: "right", cell: (w) => headerValue(w.wpTopPsi) },
        ]}
        rows={payload.wellhead}
        emptyText="No wellhead component recorded."
      />

      <SectionBar>Last Mud Check</SectionBar>
      <HeaderGrid rows={[payload.lastMudCheck]} />

      <SectionBar>Casing</SectionBar>
      <StringBlock block={payload.casing} />

      {payload.cement ? (
        <>
          <SectionBar>Cement</SectionBar>
          <HeaderGrid rows={payload.cement.header} />
          {payload.cement.stages.map((st, i) => (
            <div key={i}>
              <SectionBar>Cement Stage {i + 1}</SectionBar>
              <HeaderGrid rows={st.header} />
              {st.fluids.map((f, j) => (
                <div key={j}>
                  <SectionBar>Cement Fluid {j + 1}</SectionBar>
                  <HeaderGrid rows={f.fluid} />
                  <PreviewTable
                    columns={[
                      { header: "Add", cell: (a) => a.additive ?? "" },
                      { header: "Type", width: "w-48", cell: (a) => a.additiveType ?? "" },
                      { header: "Conc", width: "w-28", cell: (a) => a.concentration ?? "" },
                    ]}
                    rows={f.additives}
                    emptyText="No additives in this fluid."
                  />
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <SectionBar>Cement</SectionBar>
          <div className="border border-gray-400 border-t-0 px-1.5 py-2 text-[11px] italic text-gray-400">
            No cement job recorded on this string.
          </div>
        </>
      )}

      {/* The vertical schematic the sample draws beside these blocks, with the
          cement intervals called out — the shared component. */}
      <SectionBar>Vertical schematic (actual)</SectionBar>
      <WellboreSchematic payload={payload.schematic} reportType="04" width={520} height={300} />
      <SchematicLegend />

      <PreviewFooter printedOn={payload.printedOn} />
    </PreviewSheet>
  );
}
