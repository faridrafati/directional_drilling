/**
 * Well Data — the well-level editor, parallel to the daily ReportEditor.
 *
 * The daily sheet is one well-DAY. This is everything that outlives a day and
 * that the WellView reports are scoped to: the drilling job, its phases (plan
 * against actual), the AFE with its supplements and authorized lines, and the
 * job cost sheet those reports add up.
 *
 * Same doctrine as the daily editor, deliberately — a company man should not
 * have to learn a second set of habits:
 *   • one draft object shared by every tab, so switching never loses a keystroke;
 *   • repeating tables keep blank rows on screen (`minRows`) and prune them on save;
 *   • a blank field posts as null, never 0 or "";
 *   • advisory warnings in amber; nothing blocks a save.
 *
 * WHERE IT DIFFERS, AND WHY
 * -------------------------
 * The daily sheet saves replace-all: delete every child row, re-create it. That
 * is safe there because nothing points INTO a daily child row. Here a cost line
 * carries `phaseId` and `afeLineId`, so re-creating phases on every save would
 * orphan every cost line that referenced one. This editor therefore keeps row
 * ids, and MINTS one client-side for a row the user just added — which is what
 * lets a cost line reference a phase created in the same session, before any
 * save has been made.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  wellviewApi, newRowId,
  type AfeRow, type CostCode, type CostItemRow, type JobBody, type JobDetail,
  type JobListItem, type JobPhaseRow, type WvCodeTables,
} from "../../entry/wellview.js";
import { Section, TextField, NumField, RowTable, type Col } from "./fields.js";

/**
 * Keys `filled()` must ignore when deciding whether a row is worth saving.
 *
 * A row's own id and its foreign keys are set by the app, not typed by the
 * user — counting them makes every spare blank row look filled, and the table's
 * `minRows` blanks would all be persisted. One shared list so a future FK
 * column cannot be forgotten in one place and remembered in another.
 */
const LINK_SKIP = ["order", "id", "phaseId", "costCodeId", "afeLineId", "supplementId", "plan"];

/** True when a row holds anything the user actually typed. */
const filled = (row: object, skip: string[] = LINK_SKIP) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");

/** A phase counts as filled when its header OR its plan half is typed into. */
const phaseFilled = (p: JobPhaseRow) =>
  filled(p) || (p.plan != null && filled(p.plan, []));

/** A cost line is real if it has money, a description, or a code. */
const costFilled = (c: CostItemRow) =>
  filled(c) || c.costCodeId != null;

const emptyPhase = (): JobPhaseRow => ({
  id: newRowId("ph"), order: 0,
  phaseType1: null, phaseType2: null,
  actualStartDate: null, actualEndDate: null,
  actualStartDepth: null, actualEndDepth: null,
  workingPhaseCode: null,
  plan: { startDepth: null, endDepth: null, durMostLikelyDays: null, costMostLikely: null },
});
const emptyCost = (): CostItemRow => ({
  id: newRowId("ci"), order: 0,
  phaseId: null, costCodeId: null, afeLineId: null, supplementId: null,
  description: null,
  afeAmount: null, suppAmount: null, fieldEstimate: null, finalInvoice: null,
  category: null, costDate: null,
});
const emptyAfe = (): AfeRow => ({
  id: newRowId("afe"), order: 0,
  afeNumber: null, description: null, amount: null, approvedDate: null,
  supplements: [], lines: [],
});

/** Strip the server-only fields — what is left is exactly what PUT accepts. */
function toBody(j: JobDetail): JobBody {
  return {
    order: j.order, name: j.name, category: j.category,
    primaryJobType: j.primaryJobType, secondaryJobType: j.secondaryJobType,
    status1: j.status1,
    plannedStartDate: j.plannedStartDate, startDate: j.startDate,
    minPlannedEndDate: j.minPlannedEndDate,
    mostLikelyPlannedEndDate: j.mostLikelyPlannedEndDate,
    maxPlannedEndDate: j.maxPlannedEndDate, endDate: j.endDate,
    targetDepth: j.targetDepth, targetFormation: j.targetFormation, summary: j.summary,
    possCostSave: j.possCostSave, possTimeSaveHr: j.possTimeSaveHr,
    estProblemCost: j.estProblemCost, estLostTimeHr: j.estLostTimeHr,
    phases: (j.phases ?? []).map((p) => ({
      ...p,
      // Every phase edits a plan; a plan left blank is dropped again on save, so
      // the user never has to "create" one before typing into it.
      plan: p.plan ?? { startDepth: null, endDepth: null, durMostLikelyDays: null, costMostLikely: null },
    })),
    afes: (j.afes ?? []).map((a) => ({ ...a, supplements: a.supplements ?? [], lines: a.lines ?? [] })),
    costItems: j.costItems ?? [],
  };
}

/** Drop the rows the user never typed into, and re-index what survives. */
function prune(body: JobBody): JobBody {
  // Re-indexing matters: `order` is what the reports print by, and a gap left
  // by a pruned middle row would make an ordinal reference point at the wrong
  // thing.
  const reindex = <T extends { order: number }>(rows: T[]) => rows.map((r, i) => ({ ...r, order: i }));
  return {
    ...body,
    phases: reindex(body.phases.filter(phaseFilled)).map((p) => ({
      ...p,
      plan: p.plan && filled(p.plan, []) ? p.plan : null,
    })),
    afes: reindex(
      body.afes
        .map((a) => ({
          ...a,
          supplements: reindex(a.supplements.filter((s) => filled(s))),
          lines: reindex(a.lines.filter((l) => filled(l) || l.costCodeId != null)),
        }))
        .filter((a) => filled(a, [...LINK_SKIP, "supplements", "lines"]) || a.supplements.length > 0 || a.lines.length > 0),
    ),
    costItems: reindex(body.costItems.filter(costFilled)),
  };
}

type TabId = "job" | "phases" | "afe" | "costs";

const TABS: { id: TabId; label: string; count: (d: JobBody) => number }[] = [
  { id: "job", label: "Job", count: (d) => (filled(d, ["order", "phases", "afes", "costItems"]) ? 1 : 0) },
  { id: "phases", label: "Phases", count: (d) => d.phases.filter(phaseFilled).length },
  { id: "afe", label: "AFE & supplements", count: (d) => d.afes.length },
  { id: "costs", label: "Cost sheet", count: (d) => d.costItems.filter(costFilled).length },
];

export function WellDataEditor({ wellId, wellName, isAdmin }: {
  wellId: string;
  wellName: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string>("");
  const [tab, setTab] = useState<TabId>("job");
  /**
   * The chart of accounts is COMPANY-wide, not per job — so it lives beside the
   * job sheet rather than inside it. Nested under a job it was unreachable
   * until one existed, which is exactly backwards: the codes have to be there
   * before the first cost line can be typed.
   */
  const [showCodes, setShowCodes] = useState(false);
  // Associated by htmlFor rather than by wrapping: a <label> around a <select>
  // absorbs the selected option into the field's accessible name.
  const jobPickerId = useId();

  const jobsQ = useQuery({
    queryKey: ["wellview", "jobs", wellId],
    queryFn: () => wellviewApi.jobsForWell(wellId),
    enabled: !!wellId,
  });
  const jobQ = useQuery({
    queryKey: ["wellview", "job", jobId],
    queryFn: () => wellviewApi.job(jobId),
    enabled: !!jobId,
  });
  const codesQ = useQuery({ queryKey: ["wellview", "codes"], queryFn: wellviewApi.codes });
  const costCodesQ = useQuery({ queryKey: ["wellview", "costCodes"], queryFn: wellviewApi.costCodes });

  const jobs = jobsQ.data ?? [];
  useEffect(() => { setJobId(""); }, [wellId]);
  useEffect(() => {
    if (!jobId && jobs.length) setJobId(jobs[0].id);
    if (jobId && jobs.length && !jobs.some((j) => j.id === jobId)) setJobId(jobs[0].id);
  }, [jobs, jobId]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createJob() {
    setBusy(true); setError(null);
    try {
      const j = await wellviewApi.createJob(wellId, "New job");
      await qc.invalidateQueries({ queryKey: ["wellview", "jobs", wellId] });
      setJobId(j.id);
      setTab("job");
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  async function removeJob(id: string) {
    if (!confirm("Delete this job? Its phases, AFE and every cost line go with it. Daily reports are kept.")) return;
    setBusy(true); setError(null);
    try {
      await wellviewApi.deleteJob(id);
      setJobId("");
      await qc.invalidateQueries({ queryKey: ["wellview", "jobs", wellId] });
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{wellName}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Jobs, phases, the AFE and the cost sheet — the well-level data the reports are built from.
            </div>
          </div>
          <div className="flex flex-col gap-0.5 ml-auto">
            <label htmlFor={jobPickerId} className="text-[10px] uppercase tracking-wide text-gray-400">Job</label>
            <select
              id={jobPickerId}
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              disabled={jobs.length === 0}
              className="h-9 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[200px] disabled:bg-gray-50 disabled:text-gray-400"
            >
              {jobs.length === 0 && <option value="">— no jobs on this well —</option>}
              {jobs.map((j) => <option key={j.id} value={j.id}>{jobLabel(j)}</option>)}
            </select>
          </div>
          <button
            type="button" onClick={() => void createJob()} disabled={busy}
            className="h-9 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
          >
            + New job
          </button>
          {jobId && (
            <button
              type="button" onClick={() => void removeJob(jobId)} disabled={busy}
              className="h-9 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50 transition-colors duration-150"
            >
              Delete job
            </button>
          )}
          {isAdmin && (
            <button
              type="button" onClick={() => setShowCodes((v) => !v)}
              className={`h-9 px-3 text-xs rounded-md border transition-colors duration-150 ${
                showCodes
                  ? "border-blue-500 bg-blue-50 text-blue-800"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Cost codes
            </button>
          )}
        </div>
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </div>

      {showCodes && isAdmin && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden shrink-0">
          <CostCodesTab />
        </div>
      )}

      {jobs.length === 0 && !jobsQ.isLoading ? (
        <div className="max-w-[560px] mx-auto rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{wellName}</span> has no drilling job yet.
          <div className="mt-1.5 text-xs text-gray-400">
            A job is the campaign the WellView reports are scoped to — it carries the phases, the AFE
            and the cost sheet. Create one above to start entering them.
          </div>
        </div>
      ) : !jobQ.data ? (
        <div className="text-sm text-gray-400 px-2">Loading job…</div>
      ) : (
        <JobSheet
          key={jobQ.data.id}
          job={jobQ.data}
          tab={tab}
          setTab={setTab}
          codes={codesQ.data}
          costCodes={costCodesQ.data ?? []}
          onSaved={async () => {
            await qc.invalidateQueries({ queryKey: ["wellview", "jobs", wellId] });
            await qc.invalidateQueries({ queryKey: ["wellview", "job", jobQ.data!.id] });
          }}
        />
      )}
    </div>
  );
}

function jobLabel(j: JobListItem): string {
  const afe = j.afes.find((a) => a.afeNumber)?.afeNumber;
  return [j.name ?? j.primaryJobType ?? j.category ?? "Job", afe ? `AFE ${afe}` : null]
    .filter(Boolean).join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * One job's sheet — the tabs, the draft and the save.
 * ═══════════════════════════════════════════════════════════════════════════ */

function JobSheet({ job, tab, setTab, codes, costCodes, onSaved }: {
  job: JobDetail;
  tab: TabId;
  setTab: (t: TabId) => void;
  codes?: WvCodeTables;
  costCodes: CostCode[];
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<JobBody>(() => toBody(job));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const set = <K extends keyof JobBody>(key: K, value: JobBody[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
    setSavedAt(null);
  };

  async function save() {
    setBusy(true); setError(null);
    try {
      await wellviewApi.saveJob(job.id, prune(draft));
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
      await onSaved();
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  // Warn before losing typed work to a reload or a tab close.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // Pick-lists for the cost sheet. A phase or an AFE line typed in this session
  // is already in the draft with its client-minted id, so it can be referenced
  // immediately — no save-and-reload round trip.
  const phaseOptions = useMemo(
    () => draft.phases.filter(phaseFilled).map((p, i) => ({
      value: p.id ?? "",
      label: [p.phaseType1, p.phaseType2].filter(Boolean).join(" · ") || `Phase ${i + 1}`,
    })).filter((o) => o.value),
    [draft.phases],
  );
  const costCodeOptions = useMemo(
    () => costCodes
      .filter((c) => c.active || draft.costItems.some((i) => i.costCodeId === c.id))
      .map((c) => ({ value: c.id ?? "", label: `${c.code1}/${c.code2} — ${c.description}` }))
      .filter((o) => o.value),
    [costCodes, draft.costItems],
  );
  const supplementOptions = useMemo(
    () => draft.afes.flatMap((a) => a.supplements.map((s, i) => ({
      value: s.id ?? "",
      label: `${a.afeNumber ?? "AFE"} · ${s.number ?? `supplement ${i + 1}`}`,
    }))).filter((o) => o.value),
    [draft.afes],
  );

  // Live totals, computed exactly as report 01's assembler computes them, so the
  // page the user is typing into agrees with the report they will print.
  const totals = useMemo(() => {
    const sum = (pick: (c: CostItemRow) => number | null) => {
      let any = false, total = 0;
      for (const c of draft.costItems) {
        const v = pick(c);
        if (v === null || v === undefined || !Number.isFinite(v)) continue;
        any = true; total += v;
      }
      return any ? Number(total.toFixed(2)) : null;
    };
    const afe = sum((c) => c.afeAmount);
    const supp = sum((c) => c.suppAmount);
    const fld = sum((c) => c.fieldEstimate);
    const variance = [afe, supp, fld].some((v) => v !== null)
      ? Number((((afe ?? 0) + (supp ?? 0) - (fld ?? 0)).toFixed(2)))
      : null;
    return { afe, supp, fld, variance };
  }, [draft.costItems]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-gray-200 bg-gray-50">
        {TABS.map((t) => {
          const n = t.count(draft);
          return (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`min-h-[36px] px-2.5 text-xs rounded-md transition-colors duration-150 ${
                tab === t.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
              {n > 0 && (
                <span className={`ml-1.5 text-[10px] ${tab === t.id ? "text-blue-100" : "text-gray-400"}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {error && <span className="text-xs text-red-600 max-w-[360px] truncate" title={error}>{error}</span>}
          {savedAt && !dirty && <span className="text-xs text-green-700">Saved {savedAt}</span>}
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          <button
            type="button" onClick={() => void save()} disabled={busy || !dirty}
            className="min-h-[36px] px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors duration-150"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "job" && <JobTab draft={draft} set={set} codes={codes} />}
        {tab === "phases" && <PhasesTab draft={draft} set={set} codes={codes} />}
        {tab === "afe" && <AfeTab draft={draft} set={set} costCodeOptions={costCodeOptions} />}
        {tab === "costs" && (
          <CostsTab
            draft={draft} set={set} totals={totals}
            phaseOptions={phaseOptions}
            costCodeOptions={costCodeOptions}
            supplementOptions={supplementOptions}
          />
        )}
      </div>
    </div>
  );
}

type SetField = <K extends keyof JobBody>(key: K, value: JobBody[K]) => void;

/* ── Job ──────────────────────────────────────────────────────────────────── */

function JobTab({ draft, set, codes }: { draft: JobBody; set: SetField; codes?: WvCodeTables }) {
  return (
    <div>
      <Section right={<span className="font-normal normal-case text-gray-500">printed on reports 01, 10, 11, 12 and 22</span>}>
        Job
      </Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <TextField label="Name" value={draft.name} onChange={(v) => set("name", v)}
            placeholder="e.g. Drilling - original" />
          <TextField label="Job category" value={draft.category} onChange={(v) => set("category", v)}
            placeholder="Drilling / Completion / Workover / Abandonment" />
          <TextField label="Primary job type" value={draft.primaryJobType} onChange={(v) => set("primaryJobType", v)}
            placeholder="e.g. Drilling - original" />
          <TextField label="Secondary job type" value={draft.secondaryJobType} onChange={(v) => set("secondaryJobType", v)} />
          <TextField label="Status 1" value={draft.status1} onChange={(v) => set("status1", v)}
            placeholder="Planned / In Progress / Suspended / Job Complete" />
          <TextField label="Target formation" value={draft.targetFormation} onChange={(v) => set("targetFormation", v)} />
          <NumField label="Target depth" unit="mKB" value={draft.targetDepth} onChange={(v) => set("targetDepth", v)} />
        </div>
        <div>
          <TextField label="Planned start" value={draft.plannedStartDate} onChange={(v) => set("plannedStartDate", v)} placeholder="1405/02/10" />
          <TextField label="Actual start" value={draft.startDate} onChange={(v) => set("startDate", v)} placeholder="1405/02/10" />
          <TextField label="Planned end — min" value={draft.minPlannedEndDate} onChange={(v) => set("minPlannedEndDate", v)} placeholder="1405/03/01" />
          <TextField label="Planned end — most likely" value={draft.mostLikelyPlannedEndDate} onChange={(v) => set("mostLikelyPlannedEndDate", v)} placeholder="1405/03/05" />
          <TextField label="Planned end — max" value={draft.maxPlannedEndDate} onChange={(v) => set("maxPlannedEndDate", v)} placeholder="1405/03/12" />
          <TextField label="Actual end" value={draft.endDate} onChange={(v) => set("endDate", v)} placeholder="1405/03/05" />
        </div>
      </div>

      <Section>Summary</Section>
      <TextField label="Job summary" multiline value={draft.summary} onChange={(v) => set("summary", v)}
        placeholder="The job narrative report 01 prints. Not the daily summary — that stays on each day's report." />

      <Section right={<span className="font-normal normal-case text-gray-500">report 22</span>}>
        Savings &amp; problem cost
      </Section>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="md:border-r border-gray-200">
          <NumField label="Possible cost saving" value={draft.possCostSave} onChange={(v) => set("possCostSave", v)} />
          <NumField label="Possible time saving" unit="hr" value={draft.possTimeSaveHr} onChange={(v) => set("possTimeSaveHr", v)} />
        </div>
        <div>
          <NumField label="Est. problem cost" value={draft.estProblemCost} onChange={(v) => set("estProblemCost", v)} />
          <NumField label="Est. lost time" unit="hr" value={draft.estLostTimeHr} onChange={(v) => set("estLostTimeHr", v)} />
        </div>
      </div>

      {codes && (
        <>
          <Section right={<span className="font-normal normal-case text-gray-500">reference only</span>}>
            Working phases (OIEC Tab. 4-1)
          </Section>
          <div className="px-2 py-1.5 text-[11px] text-gray-500 leading-snug">
            {codes.workingPhases.map((p) => p.name).join(" · ")}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Phases ───────────────────────────────────────────────────────────────── */

function PhasesTab({ draft, set, codes }: { draft: JobBody; set: SetField; codes?: WvCodeTables }) {
  const phaseCodeOptions = (codes?.workingPhases ?? []).map((p) => ({ value: p.code, label: p.name }));

  /** The actual half. */
  const actualCols: Col<JobPhaseRow>[] = [
    { key: "phaseType1", label: "Phase type 1", width: "w-36", placeholder: "Surface / Production" },
    { key: "phaseType2", label: "Phase type 2", width: "w-44", placeholder: "Drill-Vertical" },
    { key: "actualStartDate", label: "Actual start", width: "w-36", placeholder: "1405/02/10 09:00",
      title: "Jalali date, and the TIME — report 10's durations are printed to 2 dp and cannot be reproduced from a date alone" },
    { key: "actualEndDate", label: "Actual end", width: "w-36", placeholder: "1405/02/11 21:45" },
    { key: "actualStartDepth", label: "Start depth (mKB)", type: "num", width: "w-28" },
    { key: "actualEndDepth", label: "End depth (mKB)", type: "num", width: "w-28" },
    { key: "workingPhaseCode", label: "Working phase", type: "select", options: phaseCodeOptions, width: "w-40",
      title: "The OIEC working phase this rolls up to. Advisory — nothing is rejected." },
  ];

  // The plan lives on a nested object, so it is edited through a flattened view
  // and folded back on change. Two tables side by side would make the reader
  // match rows by eye, which is exactly the mistake report 10 exists to prevent.
  type PlanFlat = { order: number; startDepth: number | null; endDepth: number | null; durMostLikelyDays: number | null; costMostLikely: number | null };
  const planRows: PlanFlat[] = draft.phases.map((p, i) => ({
    order: i,
    startDepth: p.plan?.startDepth ?? null,
    endDepth: p.plan?.endDepth ?? null,
    durMostLikelyDays: p.plan?.durMostLikelyDays ?? null,
    costMostLikely: p.plan?.costMostLikely ?? null,
  }));
  const planCols: Col<PlanFlat>[] = [
    { key: "startDepth", label: "Planned start depth (mKB)", type: "num", width: "w-32" },
    { key: "endDepth", label: "Planned end depth (mKB)", type: "num", width: "w-32" },
    { key: "durMostLikelyDays", label: "Dur ML (days)", type: "num", width: "w-24" },
    { key: "costMostLikely", label: "Planned likely phase cost", type: "num", width: "w-36" },
  ];

  return (
    <div>
      <Section right={<span className="font-normal normal-case text-gray-500">reports 10 and 11</span>}>
        Phases — actual
      </Section>
      <RowTable
        cols={actualCols}
        rows={draft.phases}
        onChange={(rows) => set("phases", rows.map((r) => (r.id ? r : { ...r, id: newRowId("ph") })))}
        blank={emptyPhase}
        addLabel="Phase"
        minRows={3}
        testId="phase"
      />

      <Section right={<span className="font-normal normal-case text-gray-500">one row per phase above, in the same order</span>}>
        Phases — plan
      </Section>
      <RowTable
        cols={planCols}
        rows={planRows}
        onChange={(rows) => {
          // Rows are positional against the actual table; a plan row with no
          // phase beside it is dropped rather than saved against nothing.
          set("phases", draft.phases.map((p, i) => {
            const r = rows[i];
            return r
              ? { ...p, plan: { startDepth: r.startDepth, endDepth: r.endDepth, durMostLikelyDays: r.durMostLikelyDays, costMostLikely: r.costMostLikely } }
              : p;
          }));
        }}
        blank={() => ({ order: 0, startDepth: null, endDepth: null, durMostLikelyDays: null, costMostLikely: null })}
        addLabel="Plan row"
        minRows={draft.phases.length || 3}
        testId="plan"
      />
      <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug border-t border-gray-100">
        The plan is stored separately from the actual so a phase with no plan contributes nothing to
        report 10&rsquo;s planned cumulative columns — rather than contributing a zero nobody entered.
      </div>
    </div>
  );
}

/* ── AFE ──────────────────────────────────────────────────────────────────── */

function AfeTab({ draft, set, costCodeOptions }: {
  draft: JobBody; set: SetField; costCodeOptions: { value: string; label: string }[];
}) {
  const setAfe = (i: number, patch: Partial<AfeRow>) =>
    set("afes", draft.afes.map((a, k) => (k === i ? { ...a, ...patch } : a)));

  return (
    <div>
      <Section right={
        <button type="button"
          onClick={() => set("afes", [...draft.afes, { ...emptyAfe(), order: draft.afes.length }])}
          className="font-normal normal-case min-h-[28px] px-2 text-[11px] rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
          + Add AFE
        </button>
      }>
        AFE
      </Section>

      {draft.afes.length === 0 ? (
        <div className="px-2 py-3 text-[11px] text-gray-400">
          No AFE on this job yet. Reports 01, 06, 07, 10, 11 and 12 all print its number and amount.
        </div>
      ) : draft.afes.map((afe, i) => (
        <div key={afe.id ?? i} className="border-b-4 border-gray-100 last:border-b-0">
          <div className="bg-gray-100 text-gray-600 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-1 border-y border-gray-200 flex items-center justify-between">
            <span>AFE {i + 1}{afe.afeNumber ? ` · ${afe.afeNumber}` : ""}{i === 0 ? " · primary" : ""}</span>
            <button type="button"
              onClick={() => set("afes", draft.afes.filter((_, k) => k !== i).map((a, k) => ({ ...a, order: k })))}
              className="font-normal normal-case text-gray-400 hover:text-red-600 transition-colors duration-150">
              Remove
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="md:border-r border-gray-200">
              <TextField label="AFE number" value={afe.afeNumber} onChange={(v) => setAfe(i, { afeNumber: v })}
                placeholder="9876543" />
              <TextField label="Description" value={afe.description} onChange={(v) => setAfe(i, { description: v })} />
            </div>
            <div>
              <NumField label="AFE amount (control total)" value={afe.amount} onChange={(v) => setAfe(i, { amount: v })} />
              <TextField label="Approved date" value={afe.approvedDate} onChange={(v) => setAfe(i, { approvedDate: v })}
                placeholder="1405/01/26" />
            </div>
          </div>
          <div className="px-2 py-1 text-[11px] text-gray-400 leading-snug">
            The reports print the SUM of the cost lines, not this figure — it is kept as the approval
            document&rsquo;s own control total, to reconcile against.
          </div>

          <div className="bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
            Supplements
          </div>
          <RowTable
            cols={[
              { key: "number", label: "Supplement no.", width: "w-40" },
              { key: "amount", label: "Amount", type: "num", width: "w-32" },
              { key: "approvedDate", label: "Approved", width: "w-32", placeholder: "1405/02/19" },
            ]}
            rows={afe.supplements}
            onChange={(rows) => setAfe(i, { supplements: rows.map((r) => (r.id ? r : { ...r, id: newRowId("sup") })) })}
            blank={() => ({ id: newRowId("sup"), order: 0, number: null, amount: null, approvedDate: null })}
            addLabel="Supplement"
            minRows={2}
            testId={`afe${i}-supp`}
          />

          <div className="bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
            Authorized lines
          </div>
          <RowTable
            cols={[
              { key: "costCodeId", label: "Cost code", type: "select", options: costCodeOptions, width: "w-64" },
              { key: "description", label: "Description", width: "w-64" },
              { key: "amount", label: "Authorized amount", type: "num", width: "w-32" },
            ]}
            rows={afe.lines}
            onChange={(rows) => setAfe(i, { lines: rows.map((r) => (r.id ? r : { ...r, id: newRowId("ln") })) })}
            blank={() => ({ id: newRowId("ln"), order: 0, costCodeId: null, description: null, amount: null })}
            addLabel="Line"
            minRows={2}
            testId={`afe${i}-line`}
          />
          <div className="px-2 py-1 text-[11px] text-gray-400 leading-snug border-t border-gray-100">
            What finance signed. The cost sheet is what the field actually estimated and was invoiced —
            they are kept apart so a line can exist without spend, and spend without a line.
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Cost sheet ───────────────────────────────────────────────────────────── */

function CostsTab({ draft, set, totals, phaseOptions, costCodeOptions, supplementOptions }: {
  draft: JobBody;
  set: SetField;
  totals: { afe: number | null; supp: number | null; fld: number | null; variance: number | null };
  phaseOptions: { value: string; label: string }[];
  costCodeOptions: { value: string; label: string }[];
  supplementOptions: { value: string; label: string }[];
}) {
  const cols: Col<CostItemRow>[] = [
    { key: "costCodeId", label: "Cost code", type: "select", options: costCodeOptions, width: "w-60" },
    { key: "description", label: "Cost des (override)", width: "w-56",
      title: "Leave blank to print the cost code's own description" },
    { key: "afeAmount", label: "AFE amt", type: "num", width: "w-28" },
    { key: "suppAmount", label: "Supp amt", type: "num", width: "w-28" },
    { key: "fieldEstimate", label: "Fld est", type: "num", width: "w-28" },
    { key: "finalInvoice", label: "Final invoice", type: "num", width: "w-28" },
    { key: "supplementId", label: "Supplement", type: "select", options: supplementOptions, width: "w-44" },
    { key: "phaseId", label: "Phase", type: "select", options: phaseOptions, width: "w-44",
      title: "Which phase this cost is charged to — report 10's per-phase field estimate needs it" },
    { key: "category", label: "Category", type: "select", width: "w-32",
      options: ["mud", "rig", "tubulars", "services", "logistics", "other"].map((v) => ({ value: v, label: v })),
      title: "\"mud\" is what the daily header's Mud Field Est cell rolls up" },
    { key: "costDate", label: "Cost date", width: "w-32", placeholder: "1405/02/12",
      title: "Lets the daily reports slice this cost by day" },
  ];

  return (
    <div>
      <Section right={<span className="font-normal normal-case text-gray-500">report 01&rsquo;s Job Cost Summary</span>}>
        Cost sheet
      </Section>
      <RowTable
        cols={cols}
        rows={draft.costItems}
        onChange={(rows) => set("costItems", rows.map((r) => (r.id ? r : { ...r, id: newRowId("ci") })))}
        blank={emptyCost}
        addLabel="Cost line"
        minRows={5}
        testId="cost"
      />

      <Section>Totals</Section>
      <div className="grid grid-cols-2 md:grid-cols-4">
        <Total label="Total AFE amount" value={totals.afe} />
        <Total label="Total AFE supplemental" value={totals.supp} />
        <Total label="Total field estimate" value={totals.fld} />
        <Total label="AFE − field estimate" value={totals.variance} accent />
      </div>
      <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug border-t border-gray-100">
        Computed from the lines above by the same arithmetic report 01 uses, so what you see here is
        what the report will print. Nothing is stored — a total can never drift from its rows.
        A blank amount stays blank; it is not read as zero except inside a variance.
      </div>
    </div>
  );
}

function Total({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className="px-2 py-1.5 border-r border-b border-gray-100 min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 truncate">{label}</div>
      <div className={`text-[13px] tabular-nums ${accent ? "font-semibold text-blue-800" : "text-gray-900"}`}>
        {value === null
          ? <span className="text-gray-300">—</span>
          : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
    </div>
  );
}

/* ── Cost codes (company-wide, admin) ─────────────────────────────────────── */

function CostCodesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wellview", "costCodes"], queryFn: wellviewApi.costCodes });
  const [rows, setRows] = useState<CostCode[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => { if (q.data) setRows(q.data); }, [q.data]);

  const blank = (): CostCode => ({ id: null, code1: null, code2: null, description: null, projectScope: null, active: true });

  async function save() {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      // Prune the grid's spare blanks before posting, exactly as every other
      // replace-all surface in this app does — an untouched spare row must not
      // fail the whole save.
      const filledRows = rows.filter((r) => r.code1 || r.code2 || r.description);
      const saved = await wellviewApi.saveCostCodes(filledRows);
      setRows(saved);
      setSavedAt(new Date().toLocaleTimeString());
      await qc.invalidateQueries({ queryKey: ["wellview", "costCodes"] });
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  const cols: Col<CostCode & { order?: number }>[] = [
    { key: "code1", label: "Code 1", width: "w-24", title: "Major account, as printed" },
    { key: "code2", label: "Code 2", width: "w-24", title: "Sub-account, as printed" },
    { key: "description", label: "Cost des", width: "w-80" },
    { key: "projectScope", label: "Scope", width: "w-32", placeholder: "Drilling / Completion" },
  ];

  return (
    <div>
      <Section right={
        <div className="flex items-center gap-2 font-normal normal-case">
          {error && <span className="text-red-600 max-w-[320px] truncate" title={error}>{error}</span>}
          {savedAt && <span className="text-green-700">Saved {savedAt}</span>}
          <button type="button" onClick={() => void save()} disabled={busy || !rows}
            className="min-h-[28px] px-2.5 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors duration-150">
            {busy ? "Saving…" : "Save cost codes"}
          </button>
        </div>
      }>
        Cost codes — company-wide
      </Section>
      <div className="px-2 py-1.5 text-[11px] text-gray-500 leading-snug">
        The company chart of accounts behind report 01&rsquo;s Code 1 / Code 2 columns. Shared by every
        well and every job, so it is edited here once. A code still used by a cost line or an AFE line
        is deactivated rather than deleted — the reports that print it must keep printing it.
      </div>
      {!rows ? (
        <div className="px-2 py-3 text-[11px] text-gray-400">Loading…</div>
      ) : (
        <RowTable
          cols={cols}
          rows={rows as (CostCode & { order?: number })[]}
          onChange={(next) => setRows(next)}
          blank={blank}
          addLabel="Cost code"
          minRows={5}
          testId="code"
        />
      )}
    </div>
  );
}
