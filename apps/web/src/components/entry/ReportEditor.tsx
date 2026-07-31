/**
 * The fillable daily drilling report — the rig-side twin of DrReportForm.tsx.
 *
 * The office's read-only view puts the whole DR.xls sheet on one page. For DATA
 * ENTRY that is a wall of inputs, so each part of the sheet is its own subform,
 * picked from the strip of tabs: Well / Operations · Bit runs · Bottom hole
 * assembly · Drill string & tools · Mud properties · Solid control · Chemicals ·
 * Casing · Formation tops · Surveys · Time breakdown · Operations log · Summary.
 *
 * All subforms share ONE draft object, so switching between them never loses
 * anything typed, and Save posts the complete sheet in a single PUT (the API
 * replaces the child rows wholesale, which keeps a save atomic and idempotent).
 * Each tab shows how many entries it holds, so the company man can see at a
 * glance what is still empty before submitting.
 *
 * The well-level band (field, rig, spud date, RTE…) stays above the tabs on
 * every subform: it is read-only context from the well record an admin
 * registered, typed once rather than every day.
 *
 * NOTE: every subform below is a module-level component. Declaring one inside
 * ReportEditor would create a new component type per render and React would
 * remount the inputs, dropping focus after each keystroke.
 */
import { useEffect, useMemo, useState } from "react";
import {
  entryApi, type ReportBody, type ReportDetail, type ToolItem, type SolidControlRow,
} from "../../entry/client.js";
import { Section, TextField, NumField, StaticField, RowTable, type Col } from "./fields.js";

const TOOL_KINDS: { kind: ToolItem["kind"]; label: string }[] = [
  { kind: "jar", label: "Jar" },
  { kind: "mwd", label: "MWD" },
  { kind: "dhMotor", label: "DH motor" },
];
const SC_UNITS = ["Clay Jactor", "Mud Cleaner", "Shaker"];

/** Strip the server-only fields — what's left is exactly what PUT accepts. */
function toBody(r: ReportDetail): ReportBody {
  return {
    morningDepth: r.morningDepth, midnightDepth: r.midnightDepth, previousDepth: r.previousDepth,
    drillingTime: r.drillingTime, cumDrillingTime: r.cumDrillingTime,
    holeSize: r.holeSize, formation: r.formation, lithology: r.lithology,
    lastCasing: r.lastCasing, linerLap: r.linerLap, kop: r.kop,
    wellSiteSupt: r.wellSiteSupt, opnSupt: r.opnSupt, progEng: r.progEng,
    geologist: r.geologist, toolPusher1: r.toolPusher1, toolPusher2: r.toolPusher2,
    formationLoss: r.formationLoss, mudLossUnit: r.mudLossUnit, mudGains: r.mudGains,
    description: r.description, windSpeedDir: r.windSpeedDir, waveVisible: r.waveVisible,
    freshWater: r.freshWater, fuel: r.fuel,
    bitRuns: r.bitRuns ?? [], bha: r.bha ?? [], drillString: r.drillString ?? [],
    // The three tool rows and three solid-control units are always on the sheet,
    // present or not in the stored data.
    tools: TOOL_KINDS.map(({ kind }) =>
      r.tools?.find((t) => t.kind === kind) ?? { kind, type: null, size: null, serialNo: null, hours: null }),
    mud: r.mud ?? null,
    solidControl: SC_UNITS.map((unit) =>
      r.solidControl?.find((s) => s.unit === unit) ?? { unit, hours: null, underFlow: null, overFlow: null, feed: null, cons: null, fprs: null }),
    chemicals: r.chemicals ?? [], casing: r.casing ?? [], formationTops: r.formationTops ?? [],
    surveys: r.surveys ?? [], timeBreakdown: r.timeBreakdown ?? [], operations: r.operations ?? [],
  };
}

/** True when a row / object holds anything the user actually typed. */
const filled = (row: object, skip: string[] = ["order"]) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");
const filledRows = (rows: object[], skip?: string[]) => rows.filter((r) => filled(r, skip)).length;

/**
 * Drop the rows the user never typed into before posting.
 *
 * The tables keep a blank row on screen so a subform doesn't look empty
 * (`minRows`), and touching any cell materialises the whole visible set — so
 * without this a save would persist all-null bit runs / operations. The fixed
 * tool and solid-control rows are exempt: they are part of the sheet's shape and
 * are keyed by kind / unit.
 */
function prune(body: ReportBody): ReportBody {
  const mudFilled = body.mud && filled(body.mud, []);
  return {
    ...body,
    bitRuns: body.bitRuns.filter((r) => filled(r)),
    bha: body.bha.filter((r) => filled(r)),
    drillString: body.drillString.filter((r) => filled(r)),
    chemicals: body.chemicals.filter((r) => filled(r)),
    casing: body.casing.filter((r) => filled(r)),
    formationTops: body.formationTops.filter((r) => filled(r)),
    surveys: body.surveys.filter((r) => filled(r)),
    timeBreakdown: body.timeBreakdown.filter((r) => filled(r)),
    operations: body.operations.filter((r) => filled(r)),
    mud: mudFilled ? body.mud : null,
  };
}

const EMPTY_MUD: NonNullable<ReportBody["mud"]> = {
  mudSystem: null, maxWeight: null, minWeight: null, reportTime: null, funnelVisc: null,
  pv: null, yp: null, gelInitial: null, gel10min: null, fan600: null, fan300: null,
  ph: null, alkalinity: null, waterLoss: null, hpht: null, airFoam: null, oilPct: null,
  oilWaterRatio: null, eStability: null, kcl: null, mbt: null, pf: null, mf: null,
  chloride: null, calcium: null, solidsPct: null, tempF: null,
};

// ── shared prop shapes for the subforms ─────────────────────────────────────
type SetField = <K extends keyof ReportBody>(key: K, value: ReportBody[K]) => void;
interface SubformProps {
  draft: ReportBody;
  set: SetField;
  disabled: boolean;
}

/** The subforms, in the order the sheet is normally worked through. */
const SECTIONS = [
  { id: "well", label: "Well / Operations", count: (d: ReportBody) => filled({
      morningDepth: d.morningDepth, midnightDepth: d.midnightDepth, previousDepth: d.previousDepth,
      drillingTime: d.drillingTime, cumDrillingTime: d.cumDrillingTime, holeSize: d.holeSize,
      formation: d.formation, lithology: d.lithology, lastCasing: d.lastCasing, linerLap: d.linerLap,
      kop: d.kop, wellSiteSupt: d.wellSiteSupt, opnSupt: d.opnSupt, progEng: d.progEng,
      geologist: d.geologist, toolPusher1: d.toolPusher1, toolPusher2: d.toolPusher2,
    }, []) ? 1 : 0, unit: "" },
  { id: "bit", label: "Bit runs", count: (d: ReportBody) => filledRows(d.bitRuns), unit: "row" },
  { id: "bha", label: "Bottom hole assembly", count: (d: ReportBody) => filledRows(d.bha), unit: "row" },
  { id: "string", label: "Drill string & tools", count: (d: ReportBody) => filledRows(d.drillString) + filledRows(d.tools, ["kind"]), unit: "row" },
  { id: "mud", label: "Mud properties", count: (d: ReportBody) => (d.mud && filled(d.mud, []) ? 1 : 0) + (filled({ a: d.formationLoss, b: d.mudLossUnit, c: d.mudGains }, []) ? 1 : 0), unit: "" },
  { id: "solid", label: "Solid control", count: (d: ReportBody) => filledRows(d.solidControl, ["unit"]), unit: "row" },
  { id: "chem", label: "Chemicals", count: (d: ReportBody) => filledRows(d.chemicals), unit: "row" },
  { id: "casing", label: "Casing", count: (d: ReportBody) => filledRows(d.casing), unit: "row" },
  { id: "tops", label: "Formation tops", count: (d: ReportBody) => filledRows(d.formationTops), unit: "row" },
  { id: "survey", label: "Surveys", count: (d: ReportBody) => filledRows(d.surveys), unit: "row" },
  { id: "time", label: "Time breakdown", count: (d: ReportBody) => filledRows(d.timeBreakdown), unit: "row" },
  { id: "ops", label: "Operations log", count: (d: ReportBody) => filledRows(d.operations), unit: "row" },
  { id: "summary", label: "Summary & weather", count: (d: ReportBody) => filled({
      description: d.description, windSpeedDir: d.windSpeedDir, waveVisible: d.waveVisible,
      freshWater: d.freshWater, fuel: d.fuel,
    }, []) ? 1 : 0, unit: "" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function ReportEditor({ report, isAdmin, onChanged }: {
  report: ReportDetail;
  isAdmin: boolean;
  onChanged: (r: ReportDetail) => void;
}) {
  const [draft, setDraft] = useState<ReportBody>(() => toBody(report));
  const [section, setSection] = useState<SectionId>("well");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "submit" | "reopen">(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Switching to another day (or a reopen) replaces the draft wholesale.
  useEffect(() => { setDraft(toBody(report)); setDirty(false); setError(null); setSavedAt(null); }, [report.id, report.status, report.updatedAt]);

  const locked = report.status === "submitted" && !isAdmin;
  const set: SetField = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setDirty(true); };
  const setMud = <K extends keyof NonNullable<ReportBody["mud"]>>(key: K, value: NonNullable<ReportBody["mud"]>[K]) => {
    setDraft((d) => ({ ...d, mud: { ...(d.mud ?? EMPTY_MUD), [key]: value } })); setDirty(true);
  };
  const setTool = (kind: ToolItem["kind"], key: keyof ToolItem, value: string | number | null) => {
    setDraft((d) => ({ ...d, tools: d.tools.map((t) => (t.kind === kind ? { ...t, [key]: value } : t)) })); setDirty(true);
  };
  const setSc = (unit: string, key: keyof SolidControlRow, value: number | null) => {
    setDraft((d) => ({ ...d, solidControl: d.solidControl.map((s) => (s.unit === unit ? { ...s, [key]: value } : s)) })); setDirty(true);
  };

  // METERAGE is derived exactly as the office form derives it (midnight − previous).
  const meterage = useMemo(() => {
    const { midnightDepth: a, previousDepth: b } = draft;
    return a != null && b != null ? Number((a - b).toFixed(2)) : null;
  }, [draft.midnightDepth, draft.previousDepth]);

  async function save(): Promise<ReportDetail | null> {
    setBusy("save"); setError(null);
    try {
      const r = await entryApi.put<ReportDetail>(`/reports/${report.id}`, prune(draft));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      onChanged(r);
      return r;
    } catch (e) { setError(String((e as Error).message)); return null; }
    finally { setBusy(null); }
  }

  async function submit() {
    if (dirty && !(await save())) return;   // never submit a sheet that failed to save
    setBusy("submit"); setError(null);
    try { onChanged(await entryApi.post<ReportDetail>(`/reports/${report.id}/submit`)); }
    catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(null); }
  }

  async function reopen() {
    setBusy("reopen"); setError(null);
    try { onChanged(await entryApi.post<ReportDetail>(`/reports/${report.id}/reopen`)); }
    catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(null); }
  }

  const w = report.well;
  const d = locked;
  const idx = SECTIONS.findIndex((s) => s.id === section);
  const props: SubformProps = { draft, set, disabled: d };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden text-gray-800">
      {/* Title bar + actions */}
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-blue-700 text-white flex-wrap">
        <div className="font-semibold text-sm truncate">
          {w.name} — Daily Drilling Report
          <span className="font-normal opacity-80"> · #{report.serialNo} · {report.reportDate}</span>
        </div>
        <div className="flex items-center gap-2">
          {report.status === "submitted"
            ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/90 uppercase tracking-wide">Submitted</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/90 text-amber-950 uppercase tracking-wide">Draft</span>}
          {dirty && <span className="text-[10px] opacity-90">unsaved changes</span>}
          {!dirty && savedAt && <span className="text-[10px] opacity-90">saved {savedAt}</span>}
          {!locked && (
            <button onClick={save} disabled={!!busy}
              className="h-7 px-3 text-xs rounded-md bg-white/15 hover:bg-white/25 transition-colors duration-150 disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          )}
          {report.status === "draft" && (
            <button onClick={submit} disabled={!!busy}
              className="h-7 px-3 text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 transition-colors duration-150 disabled:opacity-50">
              {busy === "submit" ? "Submitting…" : "Submit"}
            </button>
          )}
          {report.status === "submitted" && isAdmin && (
            <button onClick={reopen} disabled={!!busy}
              className="h-7 px-3 text-xs rounded-md bg-white/15 hover:bg-white/25 transition-colors duration-150 disabled:opacity-50">
              {busy === "reopen" ? "Reopening…" : "Reopen"}
            </button>
          )}
        </div>
      </div>

      {error && <div className="px-3 py-1.5 text-xs text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
      {locked && (
        <div className="px-3 py-1.5 text-xs text-emerald-800 bg-emerald-50 border-b border-emerald-200">
          Submitted {report.submittedAt ? new Date(report.submittedAt).toLocaleString() : ""} — read-only. Ask an admin to reopen it for corrections.
        </div>
      )}

      {/* Well-level band — from the well record, not typed daily */}
      <div className="border-b border-gray-300 bg-gray-50/70">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <StaticField label="Date" value={report.reportDate} />
          <StaticField label="Field" value={w.field} />
          <StaticField label="Well no." value={w.legacyWellCode ?? w.name} />
          <StaticField label="Loc" value={w.location} />
          <StaticField label="Op. type" value={w.wellType} />
          <StaticField label="Well prof." value={w.profile} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-gray-200">
          <StaticField label="Rig no." value={w.rig?.name} />
          <StaticField label="Spud date" value={w.spudDate} />
          <StaticField label="Release date" value={w.rigReleasedDate} />
          <StaticField label="Resv" value={w.reservoir} />
          <StaticField label="R.T.E / W.depth" value={`${w.rtElevation ?? "—"} / ${w.waterDepth ?? "—"}`} />
        </div>
      </div>

      {/* Subform picker */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        {SECTIONS.map((s) => {
          const n = s.count(draft);
          const active = s.id === section;
          return (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`h-7 px-2.5 text-[11px] rounded-md border transition-colors duration-150 ${
                active ? "bg-blue-600 border-blue-600 text-white"
                       : "bg-white border-gray-300 text-gray-600 hover:bg-gray-100"}`}>
              {s.label}
              {n > 0 && (
                <span className={`ml-1.5 px-1 rounded text-[9px] tabular-nums ${
                  active ? "bg-white/25" : "bg-emerald-100 text-emerald-700"}`}>
                  {s.unit === "row" ? n : "✓"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The active subform */}
      <div className="min-h-[220px]">
        {section === "well" && <WellOperations {...props} well={w} meterage={meterage} />}
        {section === "bit" && <BitRuns {...props} />}
        {section === "bha" && <BhaSubform {...props} />}
        {section === "string" && <DrillStringAndTools {...props} setTool={setTool} />}
        {section === "mud" && <MudSubform {...props} setMud={setMud} />}
        {section === "solid" && <SolidControlSubform {...props} setSc={setSc} />}
        {section === "chem" && <Chemicals {...props} />}
        {section === "casing" && <CasingSubform {...props} />}
        {section === "tops" && <FormationTops {...props} />}
        {section === "survey" && <Surveys {...props} />}
        {section === "time" && <TimeBreakdown {...props} />}
        {section === "ops" && <OperationsLog {...props} />}
        {section === "summary" && <SummaryWeather {...props} />}
      </div>

      {/* Step through the subforms + the persistent Save / Submit */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button disabled={idx === 0} onClick={() => setSection(SECTIONS[idx - 1].id)}
            className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-40">← Previous</button>
          <span className="text-[11px] text-gray-500 tabular-nums">{idx + 1} / {SECTIONS.length}</span>
          <button disabled={idx === SECTIONS.length - 1} onClick={() => setSection(SECTIONS[idx + 1].id)}
            className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150 disabled:opacity-40">Next →</button>
        </div>
        {!locked && (
          <div className="flex gap-2">
            <button onClick={save} disabled={!!busy}
              className="h-8 px-4 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300">
              {busy === "save" ? "Saving…" : "Save report"}
            </button>
            {report.status === "draft" && (
              <button onClick={submit} disabled={!!busy}
                className="h-8 px-4 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors duration-150 disabled:bg-gray-300">
                {busy === "submit" ? "Submitting…" : "Submit for the office"}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-gray-200 text-[11px] text-gray-500">
        Filed by {report.user.fullName} ({report.user.username}) · last saved {new Date(report.updatedAt).toLocaleString()}
        {dirty && <span className="text-amber-700"> · unsaved changes on this sheet</span>}
      </div>
    </div>
  );
}

// ══ subforms ═══════════════════════════════════════════════════════════════
// Each one owns a single part of the sheet; they all write into the same draft.

function WellOperations({ draft, set, disabled, well, meterage }: SubformProps & {
  well: ReportDetail["well"]; meterage: number | null;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:border-r border-gray-200">
        <Section>Depths &amp; progress</Section>
        <div className="flex items-stretch border-b border-gray-100 bg-gray-50/40">
          <div className="w-[44%] shrink-0 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100">Contractor · Proj. TD · Rig days</div>
          <div className="flex-1 px-1.5 py-0.5 text-[11px] truncate">
            {well.contractor ?? "—"} · {well.finalForecastDepth ?? "—"} m · {well.forecastDays ?? "—"} d
          </div>
        </div>
        <NumField label="Morning depth" unit="m" value={draft.morningDepth} onChange={(v) => set("morningDepth", v)} disabled={disabled} />
        <NumField label="Midnight depth" unit="m" value={draft.midnightDepth} onChange={(v) => set("midnightDepth", v)} disabled={disabled} />
        <NumField label="Previous depth" unit="m" value={draft.previousDepth} onChange={(v) => set("previousDepth", v)} disabled={disabled} />
        <div className="flex items-stretch border-b border-gray-100">
          <div className="w-[44%] shrink-0 bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100">Meterage</div>
          <div className="flex-1 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
            {meterage ?? "—"}<span className="text-[9px] text-gray-400"> m (midnight − previous)</span>
          </div>
        </div>
        <NumField label="Drilling time" unit="h" value={draft.drillingTime} onChange={(v) => set("drillingTime", v)} disabled={disabled} />
        <NumField label="Cum. drlg time" unit="h" value={draft.cumDrillingTime} onChange={(v) => set("cumDrillingTime", v)} disabled={disabled} />
        <TextField label="Hole size" value={draft.holeSize} onChange={(v) => set("holeSize", v)} disabled={disabled} placeholder='12-1/4"' />
        <TextField label="Formation" value={draft.formation} onChange={(v) => set("formation", v)} disabled={disabled} placeholder="Asmari @ 2310" />
        <TextField label="Lithology" value={draft.lithology} onChange={(v) => set("lithology", v)} disabled={disabled} />
        <TextField label="Last casing" value={draft.lastCasing} onChange={(v) => set("lastCasing", v)} disabled={disabled} placeholder='13-3/8" @ 2105' />
        <TextField label="Liner lap" value={draft.linerLap} onChange={(v) => set("linerLap", v)} disabled={disabled} />
        <TextField label="KOP (w/ st.pt.)" value={draft.kop} onChange={(v) => set("kop", v)} disabled={disabled} />
      </div>
      <div>
        <Section>Rig crew</Section>
        <TextField label="Wellsite supt." value={draft.wellSiteSupt} onChange={(v) => set("wellSiteSupt", v)} disabled={disabled} />
        <TextField label="Opn. supt." value={draft.opnSupt} onChange={(v) => set("opnSupt", v)} disabled={disabled} />
        <TextField label="Prog. eng." value={draft.progEng} onChange={(v) => set("progEng", v)} disabled={disabled} />
        <TextField label="Geologist" value={draft.geologist} onChange={(v) => set("geologist", v)} disabled={disabled} />
        <TextField label="Tool pusher 1" value={draft.toolPusher1} onChange={(v) => set("toolPusher1", v)} disabled={disabled} />
        <TextField label="Tool pusher 2" value={draft.toolPusher2} onChange={(v) => set("toolPusher2", v)} disabled={disabled} />
        <p className="px-2 py-2 text-[10px] text-gray-400 leading-snug">
          Depths drive the meterage on the office side; the crew names print on the DR sheet header.
        </p>
      </div>
    </div>
  );
}

function BitRuns({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[9px] opacity-70">one row per bit run — a bit-change day has two</span>}>Bit</Section>
      <RowTable
        cols={[
          { key: "bitNo", label: "Bit no.", width: "w-16" },
          { key: "bitSerialNo", label: "Ser. no.", width: "w-24" },
          { key: "size", label: "Size", width: "w-20" },
          { key: "type", label: "Type", width: "w-20" },
          { key: "iadcCode", label: "IADC", width: "w-20" },
          { key: "nozzles", label: "Nozzles", width: "w-20" },
          { key: "tfa", label: "TFA", type: "num", width: "w-16" },
          { key: "meterage", label: "Meterage", type: "num", width: "w-20" },
          { key: "hours", label: "Hours", type: "num", width: "w-16" },
          { key: "wob", label: "WOB (klb)", type: "num", width: "w-20" },
          { key: "rpm", label: "RPM", type: "num", width: "w-16" },
          { key: "torque", label: "Torque on/off", width: "w-24" },
          { key: "dullGrade", label: "Dull (IADC)", width: "w-32" },
          { key: "reasonPulled", label: "Reason pulled", width: "w-24" },
          { key: "pumpType", label: "Pump type", width: "w-24" },
          { key: "pumpOutput", label: "Output (gpm)", type: "num", width: "w-24" },
          { key: "pumpPressure", label: "Pressure", type: "num", width: "w-20" },
          { key: "annularVelocity", label: "Ann. vel.", type: "num", width: "w-20" },
          { key: "hsi", label: "HSI", type: "num", width: "w-16" },
          { key: "cmtDrilled", label: "CMT drl (m-h)", width: "w-24" },
          { key: "washAndRun", label: "W&R (m-h)", width: "w-24" },
          { key: "bitChangeIn", label: "Change in", width: "w-20" },
          { key: "bitChangeOut", label: "Change out", width: "w-20" },
        ] as Col<ReportBody["bitRuns"][number]>[]}
        rows={draft.bitRuns} onChange={(v) => set("bitRuns", v)} disabled={disabled} minRows={1}
        addLabel="bit run"
        blank={() => ({
          order: 0, bitNo: null, bitSerialNo: null, size: null, type: null, iadcCode: null,
          nozzles: null, tfa: null, meterage: null, hours: null, wob: null, rpm: null,
          torque: null, dullGrade: null, reasonPulled: null, pumpType: null, pumpOutput: null,
          pumpPressure: null, annularVelocity: null, hsi: null, cmtDrilled: null,
          washAndRun: null, bitChangeIn: null, bitChangeOut: null,
        })}
      />
      <p className="px-2 pb-2 text-[10px] text-gray-400">
        Bit ROP is derived by the office from meterage ÷ hours, so leave it out here.
      </p>
    </>
  );
}

function BhaSubform({ draft, set, disabled }: SubformProps) {
  const total = draft.bha.reduce((a, b) => a + (b.lengthM ?? 0), 0);
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[9px] opacity-70">
        {total > 0 ? `${total.toFixed(1)} m total` : "top → bottom"}
      </span>}>Bottom hole assembly</Section>
      <RowTable
        cols={[
          { key: "assemblyNo", label: "BHA #", width: "w-20" },
          { key: "lengthM", label: "Length (m)", type: "num", width: "w-28" },
          { key: "specification", label: "Specification" },
        ] as Col<ReportBody["bha"][number]>[]}
        rows={draft.bha} onChange={(v) => set("bha", v)} disabled={disabled} minRows={2}
        addLabel="BHA component" blank={() => ({ order: 0, assemblyNo: null, lengthM: null, specification: null })}
      />
      <p className="px-2 pb-2 text-[10px] text-gray-400">
        List the assembly as it is run — bit, motor, subs, stabilisers, collars. The specification column is free text,
        exactly as it prints on the DR sheet.
      </p>
    </>
  );
}

function DrillStringAndTools({ draft, set, setTool, disabled }: SubformProps & {
  setTool: (kind: ToolItem["kind"], key: keyof ToolItem, value: string | number | null) => void;
}) {
  const cell = "w-full px-1.5 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-blue-50";
  return (
    <>
      <Section>Drill string</Section>
      <RowTable
        cols={[
          { key: "size", label: "D/P size" },
          { key: "grade", label: "D/P grade" },
          { key: "lengthM", label: "Length (m)", type: "num" },
        ] as Col<ReportBody["drillString"][number]>[]}
        rows={draft.drillString} onChange={(v) => set("drillString", v)} disabled={disabled} minRows={2}
        addLabel="pipe section" blank={() => ({ order: 0, size: null, grade: null, lengthM: null })}
      />
      <Section>Drilling tools</Section>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>{["Tool", "Type", "Size", "Serial no.", "Hours"].map((h) => (
            <th key={h} className="bg-gray-50 border border-gray-200 px-1.5 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {TOOL_KINDS.map(({ kind, label }) => {
            const t = draft.tools.find((x) => x.kind === kind)!;
            return (
              <tr key={kind}>
                <td className="border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase text-gray-600 font-medium whitespace-nowrap">{label}</td>
                <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.type ?? ""} onChange={(e) => setTool(kind, "type", e.target.value || null)} /></td>
                <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.size ?? ""} onChange={(e) => setTool(kind, "size", e.target.value || null)} /></td>
                <td className="border border-gray-200 p-0"><input disabled={disabled} className={cell} value={t.serialNo ?? ""} onChange={(e) => setTool(kind, "serialNo", e.target.value || null)} /></td>
                <td className="border border-gray-200 p-0"><input type="number" step="any" disabled={disabled} className={`${cell} tabular-nums`} value={t.hours ?? ""} onChange={(e) => setTool(kind, "hours", e.target.value === "" ? null : Number(e.target.value))} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 py-2 text-[10px] text-gray-400">Leave a tool row blank when it isn't in the string.</p>
    </>
  );
}

function MudSubform({ draft, set, setMud, disabled }: SubformProps & {
  setMud: <K extends keyof NonNullable<ReportBody["mud"]>>(key: K, value: NonNullable<ReportBody["mud"]>[K]) => void;
}) {
  const m = draft.mud ?? EMPTY_MUD;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:border-r border-gray-200">
        <Section>Mud properties</Section>
        <TextField label="Mud system" value={m.mudSystem} onChange={(v) => setMud("mudSystem", v)} disabled={disabled} placeholder="KCl-Polymer" />
        <TextField label="Rep. time" value={m.reportTime} onChange={(v) => setMud("reportTime", v)} disabled={disabled} placeholder="06:00" />
        <NumField label="MW max" unit="sg" value={m.maxWeight} onChange={(v) => setMud("maxWeight", v)} disabled={disabled} />
        <NumField label="MW min" unit="sg" value={m.minWeight} onChange={(v) => setMud("minWeight", v)} disabled={disabled} />
        <NumField label="Funnel visc" unit="s" value={m.funnelVisc} onChange={(v) => setMud("funnelVisc", v)} disabled={disabled} />
        <NumField label="PV" value={m.pv} onChange={(v) => setMud("pv", v)} disabled={disabled} />
        <NumField label="YP" value={m.yp} onChange={(v) => setMud("yp", v)} disabled={disabled} />
        <NumField label="Gel initial" value={m.gelInitial} onChange={(v) => setMud("gelInitial", v)} disabled={disabled} />
        <NumField label="Gel 10 min" value={m.gel10min} onChange={(v) => setMud("gel10min", v)} disabled={disabled} />
        <NumField label="Fan 600" value={m.fan600} onChange={(v) => setMud("fan600", v)} disabled={disabled} />
        <NumField label="Fan 300" value={m.fan300} onChange={(v) => setMud("fan300", v)} disabled={disabled} />
        <NumField label="pH" value={m.ph} onChange={(v) => setMud("ph", v)} disabled={disabled} />
        <NumField label="ALK" value={m.alkalinity} onChange={(v) => setMud("alkalinity", v)} disabled={disabled} />
        <NumField label="Water loss" value={m.waterLoss} onChange={(v) => setMud("waterLoss", v)} disabled={disabled} />
      </div>
      <div>
        <Section>Mud chemistry</Section>
        <NumField label="HPHT" value={m.hpht} onChange={(v) => setMud("hpht", v)} disabled={disabled} />
        <NumField label="Air / foam" unit="CFM" value={m.airFoam} onChange={(v) => setMud("airFoam", v)} disabled={disabled} />
        <NumField label="Oil %" value={m.oilPct} onChange={(v) => setMud("oilPct", v)} disabled={disabled} />
        <TextField label="O:W ratio" value={m.oilWaterRatio} onChange={(v) => setMud("oilWaterRatio", v)} disabled={disabled} placeholder="70/30" />
        <NumField label="E-stability" unit="V" value={m.eStability} onChange={(v) => setMud("eStability", v)} disabled={disabled} />
        <NumField label="KCl" unit="ppb" value={m.kcl} onChange={(v) => setMud("kcl", v)} disabled={disabled} />
        <NumField label="MBT" value={m.mbt} onChange={(v) => setMud("mbt", v)} disabled={disabled} />
        <NumField label="PF" value={m.pf} onChange={(v) => setMud("pf", v)} disabled={disabled} />
        <NumField label="MF" value={m.mf} onChange={(v) => setMud("mf", v)} disabled={disabled} />
        <NumField label="Chloride" unit="ppm" value={m.chloride} onChange={(v) => setMud("chloride", v)} disabled={disabled} />
        <NumField label="Calcium" unit="ppm" value={m.calcium} onChange={(v) => setMud("calcium", v)} disabled={disabled} />
        <NumField label="Retort solids" unit="%" value={m.solidsPct} onChange={(v) => setMud("solidsPct", v)} disabled={disabled} />
        <NumField label="Temp" unit="°F" value={m.tempF} onChange={(v) => setMud("tempF", v)} disabled={disabled} />

        <Section>Mud volume balance</Section>
        <NumField label="Formation loss" unit="bbl" value={draft.formationLoss} onChange={(v) => set("formationLoss", v)} disabled={disabled} />
        <NumField label="Loss @ units" unit="bbl" value={draft.mudLossUnit} onChange={(v) => set("mudLossUnit", v)} disabled={disabled} />
        <NumField label="Mud gains" unit="bbl" value={draft.mudGains} onChange={(v) => set("mudGains", v)} disabled={disabled} />
      </div>
    </div>
  );
}

function SolidControlSubform({ draft, setSc, disabled }: SubformProps & {
  setSc: (unit: string, key: keyof SolidControlRow, value: number | null) => void;
}) {
  const keys: (keyof SolidControlRow)[] = ["hours", "underFlow", "overFlow", "feed", "cons", "fprs"];
  return (
    <>
      <Section>Solid control</Section>
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>{["Unit", "HRS", "U.F.", "O.F.", "FEED", "CONS", "F.PRS."].map((h) => (
            <th key={h} className="bg-gray-50 border border-gray-200 px-1.5 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {SC_UNITS.map((unit) => {
            const r = draft.solidControl.find((s) => s.unit === unit)!;
            return (
              <tr key={unit}>
                <td className="border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase text-gray-600 font-medium whitespace-nowrap">{unit}</td>
                {keys.map((k) => (
                  <td key={k} className="border border-gray-200 p-0">
                    <input type="number" step="any" disabled={disabled}
                      className="w-full px-1.5 py-0.5 text-[11px] tabular-nums bg-transparent border-0 focus:outline-none focus:bg-blue-50"
                      value={(r[k] as number | null) ?? ""}
                      onChange={(e) => setSc(unit, k, e.target.value === "" ? null : Number(e.target.value))} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 py-2 text-[10px] text-gray-400">
        The three units are fixed on the DR sheet — leave a row blank when the unit didn't run.
      </p>
    </>
  );
}

function Chemicals({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Chemical materials</Section>
      <RowTable
        cols={[
          { key: "material", label: "Material" },
          { key: "unit", label: "Unit", width: "w-20" },
          { key: "used", label: "Used", type: "num", width: "w-20" },
          { key: "received", label: "Rec.", type: "num", width: "w-20" },
          { key: "stock", label: "Stock", type: "num", width: "w-20" },
          { key: "outstanding", label: "O/S", type: "num", width: "w-20" },
          { key: "requested", label: "Req", type: "num", width: "w-20" },
          { key: "sent", label: "Sent", type: "num", width: "w-20" },
        ] as Col<ReportBody["chemicals"][number]>[]}
        rows={draft.chemicals} onChange={(v) => set("chemicals", v)} disabled={disabled} minRows={3}
        addLabel="material"
        blank={() => ({ order: 0, material: null, unit: null, used: null, received: null, stock: null, outstanding: null, requested: null, sent: null })}
      />
    </>
  );
}

function CasingSubform({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Casing / liner run</Section>
      <RowTable
        cols={[
          { key: "casing", label: "Casing" },
          { key: "depth", label: "Depth (m)", type: "num", width: "w-28" },
          { key: "joints", label: "Joints", type: "num", width: "w-24" },
        ] as Col<ReportBody["casing"][number]>[]}
        rows={draft.casing} onChange={(v) => set("casing", v)} disabled={disabled} minRows={1}
        addLabel="casing run" blank={() => ({ order: 0, casing: null, depth: null, joints: null })}
      />
      <p className="px-2 pb-2 text-[10px] text-gray-400">Only the strings run on this day — the office carries the deepest one forward as "last casing".</p>
    </>
  );
}

function FormationTops({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Formation tops</Section>
      <RowTable
        cols={[
          { key: "formation", label: "Formation" },
          { key: "depth", label: "Depth (m)", type: "num", width: "w-28" },
          { key: "secondDepth", label: "Second depth", type: "num", width: "w-28" },
          { key: "type", label: "Type", width: "w-32" },
        ] as Col<ReportBody["formationTops"][number]>[]}
        rows={draft.formationTops} onChange={(v) => set("formationTops", v)} disabled={disabled} minRows={1}
        addLabel="formation top" blank={() => ({ order: 0, formation: null, depth: null, secondDepth: null, type: null })}
      />
    </>
  );
}

function Surveys({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[9px] opacity-70">deepest station last</span>}>Last survey data</Section>
      <RowTable
        cols={[
          { key: "md", label: "MD (m)", type: "num" },
          { key: "inc", label: "Inc (°)", type: "num" },
          { key: "azi", label: "Azi (°)", type: "num" },
          { key: "tvd", label: "TVD (m)", type: "num" },
          { key: "ns", label: "N/S", type: "num" },
          { key: "ew", label: "E/W", type: "num" },
          { key: "dls", label: "DLS", type: "num" },
        ] as Col<ReportBody["surveys"][number]>[]}
        rows={draft.surveys} onChange={(v) => set("surveys", v)} disabled={disabled} minRows={2}
        addLabel="survey station"
        blank={() => ({ order: 0, md: null, inc: null, azi: null, tvd: null, ns: null, ew: null, dls: null })}
      />
    </>
  );
}

function TimeBreakdown({ draft, set, disabled }: SubformProps) {
  const total = draft.timeBreakdown.reduce((a, t) => a + (t.hours ?? 0), 0);
  const off = Math.abs(total - 24) > 0.01 && total > 0;
  return (
    <>
      <Section right={<span className={`font-normal normal-case text-[9px] ${off ? "text-amber-700" : "opacity-70"}`}>
        {total.toFixed(1)} h of 24{off ? " — doesn't add up to the day" : ""}
      </span>}>Time breakdown</Section>
      <RowTable
        cols={[
          { key: "group", label: "Group" },
          { key: "type", label: "Type" },
          { key: "activity", label: "Activity" },
          { key: "hours", label: "Hours", type: "num", width: "w-24" },
        ] as Col<ReportBody["timeBreakdown"][number]>[]}
        rows={draft.timeBreakdown} onChange={(v) => set("timeBreakdown", v)} disabled={disabled} minRows={3}
        addLabel="activity" blank={() => ({ order: 0, group: null, type: null, activity: null, hours: null })}
      />
    </>
  );
}

function OperationsLog({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section right={<span className="font-normal normal-case text-[9px] opacity-70">midnight to midnight</span>}>Operations log</Section>
      <RowTable
        cols={[
          { key: "opCode", label: "Op", width: "w-24" },
          { key: "fromTime", label: "From", width: "w-24" },
          { key: "toTime", label: "To", width: "w-24" },
          { key: "remarks", label: "Remarks" },
        ] as Col<ReportBody["operations"][number]>[]}
        rows={draft.operations} onChange={(v) => set("operations", v)} disabled={disabled} minRows={3}
        addLabel="operation" blank={() => ({ order: 0, opCode: null, fromTime: null, toTime: null, remarks: null })}
      />
    </>
  );
}

function SummaryWeather({ draft, set, disabled }: SubformProps) {
  return (
    <>
      <Section>Summary</Section>
      <textarea rows={8} disabled={disabled} value={draft.description ?? ""}
        onChange={(e) => set("description", e.target.value || null)}
        placeholder="The day's narrative — what was drilled, what happened, what is planned next."
        className="w-full px-2 py-1.5 text-[11px] border-0 focus:outline-none focus:bg-blue-50 resize-y" />
      <Section>Weather &amp; consumables</Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Wind speed/dir" value={draft.windSpeedDir} onChange={(v) => set("windSpeedDir", v)} disabled={disabled} placeholder="12 kt NW" />
          <TextField label="Wave / vis" value={draft.waveVisible} onChange={(v) => set("waveVisible", v)} disabled={disabled} />
        </div>
        <div>
          <NumField label="Fresh water" unit="bbl" value={draft.freshWater} onChange={(v) => set("freshWater", v)} disabled={disabled} />
          <NumField label="Fuel" unit="L" value={draft.fuel} onChange={(v) => set("fuel", v)} disabled={disabled} />
        </div>
      </div>
    </>
  );
}
