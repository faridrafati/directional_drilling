/**
 * Casing, cement and hole sections — the entry surface behind reports 04 and 05.
 *
 * This is the deepest nesting in the app: a well has strings, a string has a
 * tally and cement jobs, a job has stages, a stage has fluids, and a fluid has
 * additives. Five levels is a lot of screen, so the panel is built as an
 * accordion — one string open at a time, and the cement only unfolded when the
 * string actually has some. Everything below a string is edited in place.
 *
 * SAVE DOCTRINE
 * -------------
 * Strings save ID-STABLE: a daily casing-run row carries `casingStringId`, so
 * re-minting the id on every save would silently unlink the day the string was
 * run from the string itself. Everything BELOW a string has nothing pointing
 * into it and saves replace-all inside its string, exactly like a daily child
 * table. That is why only the string rows mint a client-side id.
 *
 * Blank rows behave the way they do everywhere else: `minRows` spare rows stay
 * on screen, they are pruned on save, and a blank field posts as null — never 0.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  wellviewApi, newRowId,
  type CasingSheet, type CasingStringRow, type CasingTallyRow,
  type CementAdditiveRow, type CementFluidRow, type CementJobRow, type CementStageRow,
  type HoleSectionRow, type WellboreRow,
} from "../../entry/wellview.js";
import { Section, TextField, NumField, RowTable, type Col } from "./fields.js";

/** Keys set by the app rather than typed — see WellDataEditor's LINK_SKIP. */
const SKIP = ["order", "id", "wellboreId", "components", "cementJobs", "stages", "fluids", "additives"];
const filled = (row: object, skip: string[] = SKIP) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");

const emptyTally = (): CasingTallyRow => ({
  order: 0, jts: null, itemDes: null, odIn: null, idIn: null, massPerLenKgM: null,
  grade: null, topThread: null, topMkb: null, btmMkb: null, lenM: null,
  pBurstPsi: null, pCollapsePsi: null,
});
const emptyAdditive = (): CementAdditiveRow => ({
  order: 0, additive: null, additiveType: null, concentration: null,
});
const emptyFluid = (): CementFluidRow => ({
  order: 0, fluidType: null, fluidDescription: null, amountSacks: null, cementClass: null,
  volumePumpedM3: null, estimatedTopMkb: null, estimatedBtmMkb: null,
  yieldLPerSack: null, mixWaterLPerSack: null, freeWaterPct: null, densityPpg: null,
  plasticViscosityCp: null, thickeningTimeHr: null, compressiveStrengthPsi: null,
  additives: [],
});
const emptyStage = (): CementStageRow => ({
  order: 0, topDepthMkb: null, bottomDepthMkb: null, fullReturn: null, volCementM3: null,
  topPlug: null, bottomPlug: null,
  qPumpInitM3Min: null, qPumpFinalM3Min: null, avgPumpRateM3Min: null,
  finalPumpPressurePsi: null, plugBumpPressurePsi: null,
  pipeReciprocated: null, strokeM: null, reciprocationRateSpm: null,
  pipeRotated: null, pipeRpm: null,
  taggedDepthMkb: null, tagMethod: null,
  depthPlugDrilledOutMkb: null, drillOutDiameterIn: null, drillOutDate: null,
  fluids: [emptyFluid()],
});
const emptyJob = (): CementJobRow => ({
  order: 0, wellboreId: null, description: null, startDate: null, endDate: null,
  evaluationMethod: null, evaluationResults: null, comment: null,
  stages: [emptyStage()],
});
const emptyString = (): CasingStringRow => ({
  id: newRowId("cs"), order: 0, wellboreId: null, description: null, runDate: null,
  setDepthMkb: null, setTensionKn: null, stringNominalOdIn: null, stringMinDriftIn: null,
  centralizers: null, scratchers: null,
  components: [emptyTally(), emptyTally()],
  cementJobs: [],
});

/** Drop the grids' spare blanks and renumber, the way every table here saves. */
function prune(sheet: CasingSheet): CasingSheet {
  const rows = <T extends object>(list: T[]) =>
    list.filter((r) => filled(r)).map((r, i) => ({ ...r, order: i }));
  return {
    holeSections: rows(sheet.holeSections),
    strings: sheet.strings
      // A string with nothing but blank tally rows is a row the user added and
      // then left — it is not data, and it must not become an empty report.
      .filter((s) => filled(s) || s.components.some((c) => filled(c)))
      .map((s, i) => ({
        ...s, order: i,
        components: rows(s.components),
        cementJobs: s.cementJobs
          .filter((j) => filled(j) || j.stages.some((st) => filled(st) || st.fluids.some((f) => filled(f))))
          .map((j, k) => ({
            ...j, order: k,
            stages: j.stages.map((st, m) => ({
              ...st, order: m,
              fluids: rows(st.fluids).map((f) => ({ ...f, additives: rows(f.additives) })),
            })),
          })),
      })),
  };
}

const YES_NO = [{ value: "true", label: "Yes" }, { value: "false", label: "No" }];

export function CasingPanel({ wellId, wellbores }: { wellId: string; wellbores: WellboreRow[] }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wellview", "casing", wellId],
    queryFn: () => wellviewApi.casing(wellId),
    enabled: !!wellId,
  });
  const [draft, setDraft] = useState<CasingSheet | null>(null);
  const [open, setOpen] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!q.data) return;
    // The server sends its rows exactly; the spare blanks are the client's job,
    // so a string that arrives with an empty tally still shows somewhere to type.
    setDraft({
      holeSections: q.data.holeSections,
      strings: q.data.strings.map((s) => ({
        ...s,
        components: s.components.length ? s.components : [emptyTally(), emptyTally()],
        cementJobs: s.cementJobs,
      })),
    });
    setDirty(false);
  }, [q.data]);

  const edit = (fn: (d: CasingSheet) => CasingSheet) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
    setSavedAt(null);
  };
  /** Rewrite one string in place — every nested editor funnels through this. */
  const setString = (i: number, fn: (s: CasingStringRow) => CasingStringRow) =>
    edit((d) => ({ ...d, strings: d.strings.map((s, k) => (k === i ? fn(s) : s)) }));

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      await wellviewApi.saveCasing(wellId, prune(draft));
      await qc.invalidateQueries({ queryKey: ["wellview", "casing", wellId] });
      await qc.invalidateQueries({ queryKey: ["wellview", "casingStrings", wellId] });
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  if (!draft) return <div className="px-2 py-3 text-[11px] text-gray-400">Loading casing…</div>;

  const wellboreOptions = wellbores
    .filter((w) => w.id && w.name)
    .map((w) => ({ value: w.id as string, label: w.name as string }));

  return (
    <div>
      <Section right={
        <div className="flex items-center gap-2 font-normal normal-case">
          {error && <span className="text-red-600 max-w-[320px] truncate" title={error}>{error}</span>}
          {savedAt && !dirty && <span className="text-green-700">Saved {savedAt}</span>}
          {dirty && <span className="text-amber-600">Unsaved changes</span>}
          <button type="button" onClick={() => void save()} disabled={busy || !dirty}
            data-testid="save-casing"
            className="min-h-[28px] px-2.5 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors duration-150">
            {busy ? "Saving…" : "Save casing"}
          </button>
        </div>
      }>
        Casing &amp; cement
      </Section>

      <SubBar>Hole sections — the holes the strings were run in</SubBar>
      <RowTable
        cols={[
          { key: "sectionDes", label: "Section des", width: "w-32", placeholder: "Surface" },
          { key: "sizeIn", label: "Size (in)", width: "w-24", placeholder: "17 1/2",
            title: "Text, because the sheet prints the fraction" },
          { key: "actTopMkb", label: "Act top (mKB)", type: "num", width: "w-28" },
          { key: "actBtmMkb", label: "Act btm (mKB)", type: "num", width: "w-28" },
          ...(wellboreOptions.length
            ? [{ key: "wellboreId", label: "Wellbore", type: "select", width: "w-40",
                options: wellboreOptions } as Col<HoleSectionRow>]
            : []),
        ] as Col<HoleSectionRow>[]}
        rows={draft.holeSections}
        onChange={(rows) => edit((d) => ({ ...d, holeSections: rows }))}
        blank={() => ({ order: 0, wellboreId: null, sectionDes: null, sizeIn: null, actTopMkb: null, actBtmMkb: null })}
        addLabel="Section" minRows={2} testId="holesec"
      />

      <SubBar right={
        <button type="button" data-testid="add-casing-string"
          onClick={() => edit((d) => {
            setOpen(d.strings.length);
            return { ...d, strings: [...d.strings, emptyString()] };
          })}
          className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 normal-case font-normal">
          + Casing string
        </button>
      }>
        Casing strings — one block each, reports 04 and 05
      </SubBar>

      {draft.strings.length === 0 && (
        <div className="px-2 py-2 text-[11px] text-gray-400 leading-snug">
          No casing string yet. Add one above — it carries the tally report 05 sums and the cement
          job report 04 prints beside it.
        </div>
      )}

      {draft.strings.map((s, i) => (
        <div key={s.id ?? i} className="border-b-4 border-gray-100 last:border-b-0">
          <button
            type="button"
            onClick={() => setOpen((o) => (o === i ? -1 : i))}
            data-testid={`casing-string-${i}`}
            aria-expanded={open === i}
            className="w-full flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-1 border-y border-gray-200 text-left transition-colors duration-150"
          >
            <span className="text-gray-400">{open === i ? "▾" : "▸"}</span>
            <span className="truncate">
              {[s.description || `String ${i + 1}`,
                s.setDepthMkb !== null ? `${s.setDepthMkb} mKB` : null,
                s.cementJobs.length ? "cemented" : null].filter(Boolean).join(" · ")}
            </span>
            <span className="ml-auto normal-case font-normal text-gray-400">
              {s.components.filter((c) => filled(c)).length} tally rows
            </span>
          </button>

          {open === i && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="md:border-r border-gray-200">
                  <TextField label="Description" value={s.description} placeholder="Surface Casing"
                    onChange={(v) => setString(i, (x) => ({ ...x, description: v }))} />
                  <TextField label="Run date" value={s.runDate} placeholder="1405/02/11"
                    onChange={(v) => setString(i, (x) => ({ ...x, runDate: v }))} />
                  <NumField label="Set depth (mKB)" value={s.setDepthMkb}
                    onChange={(v) => setString(i, (x) => ({ ...x, setDepthMkb: v }))} />
                  <NumField label="Set tension (kN)" value={s.setTensionKn}
                    onChange={(v) => setString(i, (x) => ({ ...x, setTensionKn: v }))} />
                  <TextField label="String nominal OD (in)" value={s.stringNominalOdIn} placeholder="13 3/8"
                    onChange={(v) => setString(i, (x) => ({ ...x, stringNominalOdIn: v }))} />
                </div>
                <div>
                  <NumField label="String min drift (in)" value={s.stringMinDriftIn}
                    onChange={(v) => setString(i, (x) => ({ ...x, stringMinDriftIn: v }))} />
                  <TextField label="Centralizers" value={s.centralizers} placeholder="2/joint on shoe track."
                    onChange={(v) => setString(i, (x) => ({ ...x, centralizers: v }))} />
                  <TextField label="Scratchers" value={s.scratchers}
                    onChange={(v) => setString(i, (x) => ({ ...x, scratchers: v }))} />
                  {wellboreOptions.length > 0 && (
                    <label className="flex items-center gap-2 px-1.5 py-1 border-b border-gray-100">
                      <span className="w-40 shrink-0 text-[11px] text-gray-500">Wellbore</span>
                      <select
                        value={s.wellboreId ?? ""}
                        onChange={(e) => setString(i, (x) => ({ ...x, wellboreId: e.target.value || null }))}
                        className="flex-1 min-h-[28px] border border-gray-200 rounded px-1 text-[11px] bg-white"
                      >
                        <option value="">—</option>
                        {wellboreOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  )}
                  <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
                    Joints and string length are SUMMED from the tally below — report 05 prints the
                    total, so it is never typed twice.
                  </div>
                </div>
              </div>

              <SubBar>Tally — every joint, collar and shoe in run order</SubBar>
              <RowTable
                cols={[
                  { key: "jts", label: "Jts", type: "int", width: "w-16" },
                  { key: "itemDes", label: "Item des", type: "select", width: "w-36",
                    options: ["Casing Joint(s)", "Float Collar", "Float Shoe", "Cross Over", "Landing Joint", "Liner Hanger", "Stage Collar"]
                      .map((v) => ({ value: v, label: v })) },
                  { key: "odIn", label: "OD (in)", width: "w-24", placeholder: "13 3/8" },
                  { key: "idIn", label: "ID (in)", type: "num", width: "w-24" },
                  { key: "massPerLenKgM", label: "Mass/len (kg/m)", type: "num", width: "w-28",
                    title: "METRIC — the WellView sample prints lb/ft; this app prints kg/m throughout" },
                  { key: "grade", label: "Grade", width: "w-20", placeholder: "K-55" },
                  { key: "topThread", label: "Top thread", width: "w-24", placeholder: "BTC" },
                  { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-24" },
                  { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-24" },
                  { key: "lenM", label: "Len (m)", type: "num", width: "w-24" },
                  { key: "pBurstPsi", label: "P burst (psi)", type: "num", width: "w-24" },
                  { key: "pCollapsePsi", label: "P collapse (psi)", type: "num", width: "w-24" },
                ] as Col<CasingTallyRow>[]}
                rows={s.components}
                onChange={(rows) => setString(i, (x) => ({ ...x, components: rows }))}
                blank={emptyTally}
                addLabel="Tally row" minRows={2} testId={`tally${i}`}
              />

              <SubBar right={
                <button type="button" data-testid={`add-cement-${i}`}
                  onClick={() => setString(i, (x) => ({ ...x, cementJobs: [...x.cementJobs, emptyJob()] }))}
                  className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 normal-case font-normal">
                  + Cement job
                </button>
              }>
                Cement
              </SubBar>

              {s.cementJobs.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-gray-400 leading-snug">
                  Not cemented, or not recorded. Report 04 prints the string on its own when there is
                  no cement job — the section simply says so.
                </div>
              )}

              {s.cementJobs.map((j, ji) => (
                <CementJobEditor
                  key={ji}
                  job={j}
                  wellboreOptions={wellboreOptions}
                  testPrefix={`cement${i}-${ji}`}
                  onChange={(next) => setString(i, (x) => ({
                    ...x, cementJobs: x.cementJobs.map((y, k) => (k === ji ? next : y)),
                  }))}
                  onRemove={() => setString(i, (x) => ({
                    ...x, cementJobs: x.cementJobs.filter((_, k) => k !== ji),
                  }))}
                />
              ))}

              <div className="px-2 py-1.5 border-t border-gray-100">
                <button type="button"
                  onClick={() => {
                    if (!confirm("Remove this casing string? Its tally and cement go with it.")) return;
                    edit((d) => ({ ...d, strings: d.strings.filter((_, k) => k !== i) }));
                    setOpen(-1);
                  }}
                  className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors duration-150">
                  Remove string
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── one cement job: its header, its stages, their fluids and additives ───── */

function CementJobEditor({ job, wellboreOptions, testPrefix, onChange, onRemove }: {
  job: CementJobRow;
  wellboreOptions: { value: string; label: string }[];
  testPrefix: string;
  onChange: (j: CementJobRow) => void;
  onRemove: () => void;
}) {
  const setStage = (m: number, fn: (s: CementStageRow) => CementStageRow) =>
    onChange({ ...job, stages: job.stages.map((s, k) => (k === m ? fn(s) : s)) });

  return (
    <div className="border-t border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Description" value={job.description} placeholder="Surface Casing Cement"
            onChange={(v) => onChange({ ...job, description: v })} />
          <TextField label="Cementing start date" value={job.startDate} placeholder="1405/02/11"
            onChange={(v) => onChange({ ...job, startDate: v })} />
          <TextField label="Cementing end date" value={job.endDate}
            onChange={(v) => onChange({ ...job, endDate: v })} />
          {wellboreOptions.length > 0 && (
            <label className="flex items-center gap-2 px-1.5 py-1 border-b border-gray-100">
              <span className="w-40 shrink-0 text-[11px] text-gray-500">Wellbore</span>
              <select
                value={job.wellboreId ?? ""}
                onChange={(e) => onChange({ ...job, wellboreId: e.target.value || null })}
                className="flex-1 min-h-[28px] border border-gray-200 rounded px-1 text-[11px] bg-white"
              >
                <option value="">—</option>
                {wellboreOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}
        </div>
        <div>
          <TextField label="Evaluation method" value={job.evaluationMethod} placeholder="Temperature Log"
            onChange={(v) => onChange({ ...job, evaluationMethod: v })} />
          <TextField label="Evaluation results" multiline value={job.evaluationResults}
            onChange={(v) => onChange({ ...job, evaluationResults: v })} />
          <TextField label="Comment" multiline value={job.comment}
            onChange={(v) => onChange({ ...job, comment: v })} />
        </div>
      </div>

      {job.stages.map((st, m) => (
        <div key={m}>
          <SubBar right={
            job.stages.length > 1 ? (
              <button type="button"
                onClick={() => onChange({ ...job, stages: job.stages.filter((_, k) => k !== m) })}
                className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700 normal-case font-normal">
                Remove stage
              </button>
            ) : undefined
          }>
            Stage {m + 1}
          </SubBar>
          <div className="grid grid-cols-1 md:grid-cols-3">
            <div className="md:border-r border-gray-200">
              <NumField label="Top depth (mKB)" value={st.topDepthMkb}
                onChange={(v) => setStage(m, (x) => ({ ...x, topDepthMkb: v }))} />
              <NumField label="Bottom depth (mKB)" value={st.bottomDepthMkb}
                onChange={(v) => setStage(m, (x) => ({ ...x, bottomDepthMkb: v }))} />
              <TriField label="Full return?" value={st.fullReturn}
                onChange={(v) => setStage(m, (x) => ({ ...x, fullReturn: v }))} />
              <NumField label="Vol cement (m³)" value={st.volCementM3}
                onChange={(v) => setStage(m, (x) => ({ ...x, volCementM3: v }))} />
              <TriField label="Top plug?" value={st.topPlug}
                onChange={(v) => setStage(m, (x) => ({ ...x, topPlug: v }))} />
              <TriField label="Bottom plug?" value={st.bottomPlug}
                onChange={(v) => setStage(m, (x) => ({ ...x, bottomPlug: v }))} />
              <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
                Leave Vol cement blank and report 04 adds the fluids&rsquo; pumped volumes instead —
                type it only when the job ticket states a figure the fluids do not add up to.
              </div>
            </div>
            <div className="md:border-r border-gray-200">
              <NumField label="Q pump init (m³/min)" value={st.qPumpInitM3Min}
                onChange={(v) => setStage(m, (x) => ({ ...x, qPumpInitM3Min: v }))} />
              <NumField label="Q pump final (m³/min)" value={st.qPumpFinalM3Min}
                onChange={(v) => setStage(m, (x) => ({ ...x, qPumpFinalM3Min: v }))} />
              <NumField label="Avg pump rate (m³/min)" value={st.avgPumpRateM3Min}
                onChange={(v) => setStage(m, (x) => ({ ...x, avgPumpRateM3Min: v }))} />
              <NumField label="Final pump pressure (psi)" value={st.finalPumpPressurePsi}
                onChange={(v) => setStage(m, (x) => ({ ...x, finalPumpPressurePsi: v }))} />
              <NumField label="Plug bump pressure (psi)" value={st.plugBumpPressurePsi}
                onChange={(v) => setStage(m, (x) => ({ ...x, plugBumpPressurePsi: v }))} />
              <TriField label="Pipe reciprocated?" value={st.pipeReciprocated}
                onChange={(v) => setStage(m, (x) => ({ ...x, pipeReciprocated: v }))} />
              <NumField label="Stroke (m)" value={st.strokeM}
                onChange={(v) => setStage(m, (x) => ({ ...x, strokeM: v }))} />
              <NumField label="Reciprocation rate (spm)" value={st.reciprocationRateSpm}
                onChange={(v) => setStage(m, (x) => ({ ...x, reciprocationRateSpm: v }))} />
            </div>
            <div>
              <TriField label="Pipe rotated?" value={st.pipeRotated}
                onChange={(v) => setStage(m, (x) => ({ ...x, pipeRotated: v }))} />
              <NumField label="Pipe RPM" value={st.pipeRpm}
                onChange={(v) => setStage(m, (x) => ({ ...x, pipeRpm: v }))} />
              <NumField label="Tagged depth (mKB)" value={st.taggedDepthMkb}
                onChange={(v) => setStage(m, (x) => ({ ...x, taggedDepthMkb: v }))} />
              <TextField label="Tag method" value={st.tagMethod} placeholder="Drill Bit"
                onChange={(v) => setStage(m, (x) => ({ ...x, tagMethod: v }))} />
              <NumField label="Depth plug drilled out (mKB)" value={st.depthPlugDrilledOutMkb}
                onChange={(v) => setStage(m, (x) => ({ ...x, depthPlugDrilledOutMkb: v }))} />
              <TextField label="Drill out diameter (in)" value={st.drillOutDiameterIn} placeholder="12 1/4"
                onChange={(v) => setStage(m, (x) => ({ ...x, drillOutDiameterIn: v }))} />
              <TextField label="Drill out date" value={st.drillOutDate}
                onChange={(v) => setStage(m, (x) => ({ ...x, drillOutDate: v }))} />
            </div>
          </div>

          <SubBar>Fluids pumped, in pumping order</SubBar>
          <RowTable
            cols={[
              { key: "fluidType", label: "Fluid type", type: "select", width: "w-24",
                options: ["Flush", "Spacer", "Lead", "Tail", "Displacement"].map((v) => ({ value: v, label: v })) },
              { key: "fluidDescription", label: "Description", width: "w-40", placeholder: "Class G + 8% bentonite" },
              { key: "amountSacks", label: "Amount (sacks)", type: "num", width: "w-24" },
              { key: "cementClass", label: "Class", width: "w-16", placeholder: "G" },
              { key: "volumePumpedM3", label: "Vol pumped (m³)", type: "num", width: "w-24" },
              { key: "estimatedTopMkb", label: "Est top (mKB)", type: "num", width: "w-24" },
              { key: "estimatedBtmMkb", label: "Est btm (mKB)", type: "num", width: "w-24" },
              { key: "yieldLPerSack", label: "Yield (L/sack)", type: "num", width: "w-24" },
              { key: "mixWaterLPerSack", label: "Mix water (L/sack)", type: "num", width: "w-24" },
              { key: "freeWaterPct", label: "Free water (%)", type: "num", width: "w-24" },
              { key: "densityPpg", label: "Dens (ppg)", type: "num", width: "w-24" },
              { key: "plasticViscosityCp", label: "PV (cp)", type: "num", width: "w-20" },
              { key: "thickeningTimeHr", label: "Thickening time (hr)", type: "num", width: "w-24" },
              { key: "compressiveStrengthPsi", label: "Comp strength (psi)", type: "num", width: "w-24" },
            ] as Col<CementFluidRow>[]}
            rows={st.fluids}
            onChange={(rows) => setStage(m, (x) => ({
              // RowTable hands back rows it built with `blank()`, which carries an
              // empty additive list — a fluid that already had additives keeps
              // them because the row object itself is passed through untouched.
              ...x, fluids: rows,
            }))}
            blank={emptyFluid}
            addLabel="Fluid" minRows={2} testId={`${testPrefix}-fluid${m}`}
          />

          {st.fluids.map((f, fi) => (
            filled(f) ? (
              <div key={fi}>
                <SubBar>
                  Additives — {f.fluidType || f.fluidDescription || `fluid ${fi + 1}`}
                </SubBar>
                <RowTable
                  cols={[
                    { key: "additive", label: "Additive", width: "w-40", placeholder: "Kwik Seal" },
                    { key: "additiveType", label: "Type", type: "select", width: "w-44",
                      options: ["Accelerator", "Retarder", "Extender", "Weighting Agent",
                        "Dispersant", "Fluid Loss Additive", "Lost Circulation Additive",
                        "Anti-foam", "Other"].map((v) => ({ value: v, label: v })) },
                    { key: "concentration", label: "Concentration", width: "w-32", placeholder: "0.25 %BWOC",
                      title: "Free text — the sheet prints %BWOC, lb/sk and gal/sk in the same column" },
                  ] as Col<CementAdditiveRow>[]}
                  rows={f.additives}
                  onChange={(rows) => setStage(m, (x) => ({
                    ...x, fluids: x.fluids.map((y, k) => (k === fi ? { ...y, additives: rows } : y)),
                  }))}
                  blank={emptyAdditive}
                  addLabel="Additive" minRows={1} testId={`${testPrefix}-add${m}-${fi}`}
                />
              </div>
            ) : null
          ))}
        </div>
      ))}

      <div className="px-2 py-1.5 flex gap-2 border-t border-gray-100">
        <button type="button"
          onClick={() => onChange({ ...job, stages: [...job.stages, emptyStage()] })}
          className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
          + Stage
        </button>
        <button type="button"
          onClick={() => { if (confirm("Remove this cement job?")) onRemove(); }}
          className="min-h-[24px] px-2 text-[10px] rounded border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors duration-150">
          Remove cement job
        </button>
      </div>
    </div>
  );
}

/* ── small shared pieces ──────────────────────────────────────────────────── */

function SubBar({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
      <span className="truncate">{children}</span>
      {right && <span className="ml-auto">{right}</span>}
    </div>
  );
}

/**
 * A tri-state Yes / No / unanswered field.
 *
 * Not a checkbox: a checkbox has two states and would turn "nobody has said"
 * into "no", which is exactly the distinction report 04's blank cells carry.
 */
function TriField({ label, value, onChange }: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-1.5 py-1 border-b border-gray-100">
      <span className="w-40 shrink-0 text-[11px] text-gray-500">{label}</span>
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
        className="flex-1 min-h-[28px] border border-gray-200 rounded px-1 text-[11px] bg-white"
      >
        <option value="">—</option>
        {YES_NO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
