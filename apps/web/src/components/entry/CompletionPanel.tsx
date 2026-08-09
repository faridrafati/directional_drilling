/**
 * The well's COMPLETION sheet — everything Tier 5's reports print that the
 * drilling side does not hold: zones, reservoirs, perforations, tubing strings,
 * plug-backs, deviation-survey records, production history, failures and
 * stimulations.
 *
 * SAVE DOCTRINE
 * -------------
 * ZONES save id-stable. Perforations, production periods and stimulations all
 * carry a `zoneId`, and re-minting zone ids on every save would silently unlink
 * every one of them — so a zone added here mints its own cuid client-side,
 * which is what lets a perforation reference a zone created in the same
 * session, before any save.
 *
 * Everything else has nothing pointing into it and saves replace-all, children
 * included — the same rule the casing sheet follows.
 *
 * The panel is a set of collapsible sections rather than one long page: a
 * completion engineer opens it to change one thing, and nine grids stacked
 * vertically is a scroll bar, not a form.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  wellviewApi, newRowId,
  type CompletionSheet, type DeviationSurveyRow, type EquipmentFailureRow,
  type PerforationRow, type PlugBackRow, type ProductionPeriodRow, type ReservoirRow,
  type StimulationRow, type TubingComponentRow, type TubingStringRow,
  type WellZoneRow, type WellboreRow,
} from "../../entry/wellview.js";
import { Section, TextField, NumField, RowTable, type Col } from "./fields.js";

const SKIP = ["order", "id", "wellboreId", "zoneId", "statuses", "components"];
const filled = (row: object, skip: string[] = SKIP) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");

const emptyZone = (): WellZoneRow => ({
  id: newRowId("zn"), order: 0, wellboreId: null, name: null,
  topMkb: null, btmMkb: null, status: null,
});
const emptyPerf = (): PerforationRow => ({
  order: 0, zoneId: null, date: null, time: null, topMkb: null, btmMkb: null,
  company: null, conveyanceMethod: null, gunSizeIn: null, carrierMake: null,
  shotDensityPerM: null, chargeType: null, phasingDeg: null,
  orientation: null, orientationMethod: null,
  overUnderBalanced: null, pOverUnderPsi: null,
  flMdBeforeMkb: null, flMdAfterMkb: null, pSurfInitPsi: null, pFinalSurfPsi: null,
  referenceLog: null, statuses: [],
});
const emptyTubingComponent = (): TubingComponentRow => ({
  order: 0, itemDes: null, jts: null, make: null, model: null,
  odIn: null, idIn: null, massPerLenKgM: null, grade: null,
  lenM: null, topMkb: null, btmMkb: null, serialNo: null,
});
const emptyTubingString = (): TubingStringRow => ({
  order: 0, wellboreId: null, description: null, runDate: null,
  stringLengthM: null, setDepthMkb: null,
  components: [emptyTubingComponent(), emptyTubingComponent()],
});

/** Drop the grids' spare blanks and renumber, as every sheet here saves. */
function prune(sheet: CompletionSheet): CompletionSheet {
  const rows = <T extends object>(list: T[]) =>
    list.filter((r) => filled(r)).map((r, i) => ({ ...r, order: i }));
  return {
    zones: rows(sheet.zones),
    reservoirs: rows(sheet.reservoirs),
    perforations: sheet.perforations
      .filter((p) => filled(p) || p.statuses.some((st) => filled(st)))
      .map((p, i) => ({ ...p, order: i, statuses: rows(p.statuses) })),
    tubingStrings: sheet.tubingStrings
      .filter((t) => filled(t) || t.components.some((c) => filled(c)))
      .map((t, i) => ({ ...t, order: i, components: rows(t.components) })),
    plugBacks: rows(sheet.plugBacks),
    deviationSurveys: rows(sheet.deviationSurveys),
    productionPeriods: rows(sheet.productionPeriods),
    equipmentFailures: rows(sheet.equipmentFailures),
    stimulations: rows(sheet.stimulations),
  };
}

/** A section that folds away — nine grids on one page is a scroll bar. */
function Fold({ title, count, children }: {
  title: string; count: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b-4 border-gray-100 last:border-b-0">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`fold-${title.toLowerCase().replace(/\W+/g, "-")}`}
        className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-1 border-y border-gray-200 text-left transition-colors duration-150"
      >
        <span className="text-gray-400">{open ? "▾" : "▸"}</span>
        <span>{title}</span>
        <span className="ml-auto normal-case font-normal text-gray-400">
          {count === 0 ? "empty" : `${count} row${count === 1 ? "" : "s"}`}
        </span>
      </button>
      {open && children}
    </div>
  );
}

export function CompletionPanel({ wellId, wellbores }: { wellId: string; wellbores: WellboreRow[] }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wellview", "completion", wellId],
    queryFn: () => wellviewApi.completion(wellId),
    enabled: !!wellId,
  });
  const [draft, setDraft] = useState<CompletionSheet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    setDraft({
      ...q.data,
      tubingStrings: q.data.tubingStrings.map((t) => ({
        ...t,
        components: t.components.length ? t.components : [emptyTubingComponent(), emptyTubingComponent()],
      })),
    });
    setDirty(false);
  }, [q.data]);

  const set = <K extends keyof CompletionSheet>(key: K, value: CompletionSheet[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
    setSavedAt(null);
  };

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      await wellviewApi.saveCompletion(wellId, prune(draft));
      await qc.invalidateQueries({ queryKey: ["wellview", "completion", wellId] });
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  if (!draft) return <div className="px-2 py-3 text-[11px] text-gray-400">Loading completion…</div>;

  const wellboreOptions = wellbores
    .filter((w) => w.id && w.name)
    .map((w) => ({ value: w.id as string, label: w.name as string }));
  // Zones are the pick-list every perforation, period and stimulation uses. A
  // zone the user just added is in here already, because it minted its own id.
  const zoneOptions = draft.zones
    .filter((z) => z.id && z.name)
    .map((z) => ({ value: z.id as string, label: z.name as string }));

  const n = (rows: object[]) => rows.filter((r) => filled(r)).length;

  return (
    <div>
      <Section right={
        <div className="flex items-center gap-2 font-normal normal-case">
          {error && <span className="text-red-600 max-w-[320px] truncate" title={error}>{error}</span>}
          {savedAt && !dirty && <span className="text-green-700">Saved {savedAt}</span>}
          {dirty && <span className="text-amber-600">Unsaved changes</span>}
          <button type="button" onClick={() => void save()} disabled={busy || !dirty}
            data-testid="save-completion"
            className="min-h-[28px] px-2.5 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors duration-150">
            {busy ? "Saving…" : "Save completion"}
          </button>
        </div>
      }>
        Completion
      </Section>

      <Fold title="Zones" count={n(draft.zones)}>
        <RowTable
          cols={[
            { key: "name", label: "Zone name", width: "w-40", placeholder: "Upper Asmari" },
            { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
            { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
            { key: "status", label: "Status", type: "select", width: "w-32",
              options: ["Open", "Squeezed", "Isolated", "Abandoned"].map((v) => ({ value: v, label: v })) },
            ...(wellboreOptions.length
              ? [{ key: "wellboreId", label: "Wellbore", type: "select", width: "w-36",
                  options: wellboreOptions } as Col<WellZoneRow>]
              : []),
          ] as Col<WellZoneRow>[]}
          rows={draft.zones}
          onChange={(rows) => set("zones", rows.map((r) => (r.id ? r : { ...r, id: newRowId("zn") })))}
          blank={emptyZone}
          addLabel="Zone" minRows={2} testId="zone"
        />
        <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
          A zone is what a perforation is shot into and what production is allocated to. It is not a
          reservoir: a zone can commingle two reservoirs, and a reservoir can be completed in two
          zones — which is why they are separate lists.
        </div>
      </Fold>

      <Fold title="Reservoirs" count={n(draft.reservoirs)}>
        <RowTable
          cols={[
            { key: "name", label: "Reservoir name", width: "w-40" },
            { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
            { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
            { key: "datumDepthM", label: "Datum depth (m)", type: "num", width: "w-32",
              title: "The depth this reservoir's pressures are referred to" },
            { key: "fluidType", label: "Fluid", type: "select", width: "w-28",
              options: ["Oil", "Gas", "Water", "Condensate"].map((v) => ({ value: v, label: v })) },
          ] as Col<ReservoirRow>[]}
          rows={draft.reservoirs} onChange={(rows) => set("reservoirs", rows)}
          blank={() => ({ order: 0, name: null, topMkb: null, btmMkb: null, datumDepthM: null, fluidType: null })}
          addLabel="Reservoir" minRows={2} testId="res"
        />
      </Fold>

      <Fold title="Perforations" count={n(draft.perforations)}>
        {draft.perforations.map((p, i) => (
          <div key={i} className="border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="md:border-r border-gray-200">
                <TextField label="Date" value={p.date} placeholder="1405/03/02"
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, date: v } : x)))} />
                <TextField label="Time" value={p.time} placeholder="09:15"
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, time: v } : x)))} />
                <NumField label="Top (mKB)" value={p.topMkb}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, topMkb: v } : x)))} />
                <NumField label="Btm (mKB)" value={p.btmMkb}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, btmMkb: v } : x)))} />
                {zoneOptions.length > 0 && (
                  <label className="flex items-center gap-2 px-1.5 py-1 border-b border-gray-100">
                    <span className="w-40 shrink-0 text-[11px] text-gray-500">Zone</span>
                    <select
                      value={p.zoneId ?? ""}
                      onChange={(e) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, zoneId: e.target.value || null } : x)))}
                      className="flex-1 min-h-[28px] border border-gray-200 rounded px-1 text-[11px] bg-white"
                    >
                      <option value="">—</option>
                      {zoneOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div className="md:border-r border-gray-200">
                <TextField label="Perforation company" value={p.company}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, company: v } : x)))} />
                <TextField label="Conveyance method" value={p.conveyanceMethod} placeholder="Tubing"
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, conveyanceMethod: v } : x)))} />
                <TextField label="Gun size (in)" value={p.gunSizeIn} placeholder="3 3/8"
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, gunSizeIn: v } : x)))} />
                <TextField label="Carrier make" value={p.carrierMake}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, carrierMake: v } : x)))} />
                <NumField label="Shot density (shots/m)" value={p.shotDensityPerM}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, shotDensityPerM: v } : x)))} />
              </div>
              <div>
                <TextField label="Charge type" value={p.chargeType}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, chargeType: v } : x)))} />
                <NumField label="Phasing (°)" value={p.phasingDeg}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, phasingDeg: v } : x)))} />
                <TextField label="Over/under balanced" value={p.overUnderBalanced} placeholder="Under"
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, overUnderBalanced: v } : x)))} />
                <NumField label="P over/under (psi)" value={p.pOverUnderPsi}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, pOverUnderPsi: v } : x)))} />
                <TextField label="Reference log" value={p.referenceLog}
                  onChange={(v) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, referenceLog: v } : x)))} />
              </div>
            </div>
            <div className="bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
              Statuses — the history, not just the current state
            </div>
            <RowTable
              cols={[
                { key: "date", label: "Date", width: "w-28", placeholder: "1405/03/02" },
                { key: "status", label: "Status", type: "select", width: "w-32",
                  options: ["Open", "Squeezed", "Plugged", "Isolated"].map((v) => ({ value: v, label: v })) },
                { key: "com", label: "Com" },
              ] as Col<PerforationRow["statuses"][number]>[]}
              rows={p.statuses}
              onChange={(rows) => set("perforations", draft.perforations.map((x, k) => (k === i ? { ...x, statuses: rows } : x)))}
              blank={() => ({ order: 0, date: null, status: null, com: null })}
              addLabel="Status" minRows={1} testId={`perfstat${i}`}
            />
            <div className="px-2 py-1.5 border-t border-gray-100">
              <button type="button"
                onClick={() => set("perforations", draft.perforations.filter((_, k) => k !== i))}
                className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700">
                Remove perforation
              </button>
            </div>
          </div>
        ))}
        <div className="px-2 py-1.5">
          <button type="button" data-testid="add-perforation"
            onClick={() => set("perforations", [...draft.perforations, emptyPerf()])}
            className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            + Perforation
          </button>
        </div>
      </Fold>

      <Fold title="Tubing strings" count={n(draft.tubingStrings)}>
        {draft.tubingStrings.map((t, i) => (
          <div key={i} className="border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="md:border-r border-gray-200">
                <TextField label="Description" value={t.description} placeholder="Production String"
                  onChange={(v) => set("tubingStrings", draft.tubingStrings.map((x, k) => (k === i ? { ...x, description: v } : x)))} />
                <TextField label="Run date" value={t.runDate} placeholder="1405/03/05"
                  onChange={(v) => set("tubingStrings", draft.tubingStrings.map((x, k) => (k === i ? { ...x, runDate: v } : x)))} />
              </div>
              <div>
                <NumField label="String length (m)" value={t.stringLengthM}
                  onChange={(v) => set("tubingStrings", draft.tubingStrings.map((x, k) => (k === i ? { ...x, stringLengthM: v } : x)))} />
                <NumField label="Set depth (mKB)" value={t.setDepthMkb}
                  onChange={(v) => set("tubingStrings", draft.tubingStrings.map((x, k) => (k === i ? { ...x, setDepthMkb: v } : x)))} />
              </div>
            </div>
            <div className="bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
              Components, top down
            </div>
            <RowTable
              cols={[
                { key: "itemDes", label: "Item des", type: "select", width: "w-40",
                  options: ["Tubing", "Packer", "TRSSV", "Communications nipple", "Landing nipple",
                    "Seating nipple", "Sliding sleeve", "Pup joint", "Wireline entry guide"]
                    .map((v) => ({ value: v, label: v })) },
                { key: "jts", label: "Jts", type: "int", width: "w-16" },
                { key: "odIn", label: "OD (in)", width: "w-24", placeholder: "2 7/8" },
                { key: "idIn", label: "ID (in)", type: "num", width: "w-24" },
                { key: "massPerLenKgM", label: "Wt (kg/m)", type: "num", width: "w-24" },
                { key: "grade", label: "Grade", width: "w-20", placeholder: "L-80" },
                { key: "lenM", label: "Len (m)", type: "num", width: "w-24" },
                { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-24" },
                { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-24" },
                { key: "make", label: "Make", width: "w-28" },
                { key: "model", label: "Model", width: "w-28" },
                { key: "serialNo", label: "SN", width: "w-28" },
              ] as Col<TubingComponentRow>[]}
              rows={t.components}
              onChange={(rows) => set("tubingStrings", draft.tubingStrings.map((x, k) => (k === i ? { ...x, components: rows } : x)))}
              blank={emptyTubingComponent}
              addLabel="Component" minRows={2} testId={`tub${i}`}
            />
            <div className="px-2 py-1.5 border-t border-gray-100">
              <button type="button"
                onClick={() => set("tubingStrings", draft.tubingStrings.filter((_, k) => k !== i))}
                className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700">
                Remove string
              </button>
            </div>
          </div>
        ))}
        <div className="px-2 py-1.5">
          <button type="button" data-testid="add-tubing-string"
            onClick={() => set("tubingStrings", [...draft.tubingStrings, emptyTubingString()])}
            className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
            + Tubing string
          </button>
        </div>
      </Fold>

      <Fold title="Production history" count={n(draft.productionPeriods)}>
        <RowTable
          cols={[
            { key: "startDate", label: "Start date", width: "w-28", placeholder: "1405/04/01" },
            { key: "endDate", label: "End date", width: "w-28" },
            { key: "activityType", label: "Activity", type: "select", width: "w-28",
              options: ["Produce", "Inject", "Shut In", "Workover"].map((v) => ({ value: v, label: v })) },
            ...(zoneOptions.length
              ? [{ key: "zoneId", label: "Zone", type: "select", width: "w-32", options: zoneOptions } as Col<ProductionPeriodRow>]
              : []),
            { key: "prodTimeDays", label: "Prod time (days)", type: "num", width: "w-28" },
            { key: "downTimeDays", label: "Down time (days)", type: "num", width: "w-28" },
            { key: "volOilBbl", label: "Vol oil (bbl)", type: "num", width: "w-28" },
            { key: "volWaterBbl", label: "Vol water (bbl)", type: "num", width: "w-28" },
            { key: "volResGasMcf", label: "Vol res gas (MCF)", type: "num", width: "w-28" },
            { key: "qOilBblD", label: "Q oil (bbl/day)", type: "num", width: "w-28",
              title: "Stored as well as the volume: an allocated rate is not always the volume over the days" },
            { key: "qWaterBblD", label: "Q water (bbl/day)", type: "num", width: "w-28" },
            { key: "qResGasMcfD", label: "Q res gas (MCF/day)", type: "num", width: "w-28" },
            { key: "waterGasRatioPct", label: "Water gas ratio (%)", type: "num", width: "w-28" },
            { key: "com", label: "Com" },
          ] as Col<ProductionPeriodRow>[]}
          rows={draft.productionPeriods} onChange={(rows) => set("productionPeriods", rows)}
          blank={() => ({
            order: 0, zoneId: null, startDate: null, endDate: null, activityType: null,
            prodTimeDays: null, downTimeDays: null,
            volOilBbl: null, volWaterBbl: null, volResGasMcf: null,
            qOilBblD: null, qWaterBblD: null, qResGasMcfD: null,
            waterGasRatioPct: null, com: null,
          })}
          addLabel="Period" minRows={2} testId="prod"
        />
      </Fold>

      <Fold title="Perforation stimulations" count={n(draft.stimulations)}>
        <RowTable
          cols={[
            { key: "date", label: "Date", width: "w-28" },
            { key: "time", label: "Time", width: "w-20" },
            ...(zoneOptions.length
              ? [{ key: "zoneId", label: "Zone", type: "select", width: "w-32", options: zoneOptions } as Col<StimulationRow>]
              : []),
            { key: "type", label: "Type", type: "select", width: "w-28",
              options: ["Acid", "Frac", "Scale Squeeze", "Solvent", "Nitrogen"].map((v) => ({ value: v, label: v })) },
            { key: "deliveryMode", label: "Delivery mode", type: "select", width: "w-32",
              options: ["Bullhead", "Coiled Tubing", "Tubing", "Annulus"].map((v) => ({ value: v, label: v })) },
            { key: "company", label: "Company", width: "w-32" },
            { key: "volumeM3", label: "Volume (m³)", type: "num", width: "w-28" },
            { key: "com", label: "Com" },
          ] as Col<StimulationRow>[]}
          rows={draft.stimulations} onChange={(rows) => set("stimulations", rows)}
          blank={() => ({
            order: 0, zoneId: null, date: null, time: null, type: null,
            deliveryMode: null, company: null, volumeM3: null, com: null,
          })}
          addLabel="Stimulation" minRows={1} testId="stim"
        />
      </Fold>

      <Fold title="Equipment failures" count={n(draft.equipmentFailures)}>
        <RowTable
          cols={[
            { key: "date", label: "Date", width: "w-28" },
            { key: "failureType", label: "Failure type", type: "select", width: "w-28",
              options: ["Wear", "Worn", "Parted", "Collapse", "Hole", "Other"].map((v) => ({ value: v, label: v })),
              title: "Report 25 stacks its cost on this; a blank prints as (blank)" },
            { key: "componentDes", label: "Component", width: "w-40", placeholder: "ESP pump" },
            { key: "cost", label: "Cost", type: "num", width: "w-28" },
            { key: "accountableParty", label: "Accountable party", width: "w-32" },
            { key: "com", label: "Com" },
          ] as Col<EquipmentFailureRow>[]}
          rows={draft.equipmentFailures} onChange={(rows) => set("equipmentFailures", rows)}
          blank={() => ({
            order: 0, date: null, failureType: null, componentDes: null,
            cost: null, accountableParty: null, com: null,
          })}
          addLabel="Failure" minRows={2} testId="fail"
        />
      </Fold>

      <Fold title="Plug backs" count={n(draft.plugBacks)}>
        <RowTable
          cols={[
            { key: "date", label: "Date", width: "w-28" },
            { key: "depthMkb", label: "Depth (mKB)", type: "num", width: "w-28" },
            { key: "method", label: "Method", type: "select", width: "w-32",
              options: ["Cement", "Bridge Plug", "Sand", "Packer"].map((v) => ({ value: v, label: v })) },
            { key: "com", label: "Com" },
          ] as Col<PlugBackRow>[]}
          rows={draft.plugBacks} onChange={(rows) => set("plugBacks", rows)}
          blank={() => ({ order: 0, date: null, depthMkb: null, method: null, com: null })}
          addLabel="Plug back" minRows={1} testId="pb"
        />
      </Fold>

      <Fold title="Deviation surveys" count={n(draft.deviationSurveys)}>
        <RowTable
          cols={[
            { key: "date", label: "Date", width: "w-28" },
            { key: "des", label: "Des", width: "w-48", placeholder: "Main Hole Survey" },
            { key: "proposed", label: "Proposed?", type: "bool", width: "w-24" },
            { key: "definitive", label: "Definitive?", type: "bool", width: "w-24",
              title: "The survey the well is officially positioned by" },
            { key: "company", label: "Company", width: "w-32" },
          ] as Col<DeviationSurveyRow>[]}
          rows={draft.deviationSurveys} onChange={(rows) => set("deviationSurveys", rows)}
          blank={() => ({ order: 0, date: null, des: null, proposed: null, definitive: null, company: null })}
          addLabel="Survey" minRows={1} testId="dev"
        />
        <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
          This is the INDEX over the surveys, not their stations: the actual stations are entered on
          the daily sheets and the proposed ones under Well registers → Directional plan. Report 22
          lists which surveys exist and which one the well is officially positioned by.
        </div>
      </Fold>
    </div>
  );
}
