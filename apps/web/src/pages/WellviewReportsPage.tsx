/**
 * Well Reports — the WellView report suite.
 *
 * A catalog of the 30 reports grouped by category, each with the parameter
 * pickers it needs (well · job · date · BHA run · a multi-well selector), an
 * on-screen preview and the export buttons.
 *
 * The catalog lists every report, including the ones not built yet: the page is
 * the plan made visible, so it is obvious what exists and what is still coming
 * rather than the page looking finished at one report.
 *
 * Reports read the entry database, so this page signs in through the same
 * /entry/* session as Daily Report Entry.
 */
import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EntryAuthProvider, useEntryAuth, SignInCard } from "../entry/auth.js";
import { entryApi } from "../entry/client.js";
import {
  wellviewApi,
  type CatalogEntry, type DailyPayload, type JobListItem,
  type Report01Payload, type Report02Payload, type Report03Payload,
  type Report04Payload, type Report05Payload,
  type Report08Payload, type Report09Payload,
  type Report10Payload, type Report11Payload,
} from "../entry/wellview.js";
import { Report01Preview } from "../components/wellview/ReportPreview.js";
import { DailyPreview } from "../components/wellview/DailyPreview.js";
import { Report02Preview, Report03Preview } from "../components/wellview/BhaPreview.js";
import { Report10Preview, Report11Preview } from "../components/wellview/PhasePreview.js";
import { Report04Preview, Report05Preview } from "../components/wellview/CasingPreview.js";
import { Report08Preview } from "../components/wellview/DirectionalPreview.js";
import { Report09Preview } from "../components/wellview/SummaryPreview.js";

const CATEGORIES = ["Daily", "Engineering", "Cost & Multi-well", "Geology", "Completion"] as const;

export function WellviewReportsPage() {
  return (
    <EntryAuthProvider>
      <Inner />
    </EntryAuthProvider>
  );
}

function Inner() {
  const { user, wells, loading, signOut } = useEntryAuth();
  const [wellId, setWellId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [bhaRunId, setBhaRunId] = useState<string>("");
  const [casingStringId, setCasingStringId] = useState<string>("");
  const [selected, setSelected] = useState<string>("01");

  const catalogQ = useQuery({
    queryKey: ["wellview", "catalog"],
    queryFn: wellviewApi.catalog,
    enabled: !!user,
  });
  const jobsQ = useQuery({
    queryKey: ["wellview", "jobs", wellId],
    queryFn: () => wellviewApi.jobsForWell(wellId),
    enabled: !!user && !!wellId,
  });
  const casingQ = useQuery({
    queryKey: ["wellview", "casingStrings", wellId],
    queryFn: () => wellviewApi.casingStrings(wellId),
    enabled: !!user && !!wellId,
  });
  const bhaQ = useQuery({
    queryKey: ["wellview", "bhaRuns", wellId],
    queryFn: () => wellviewApi.bhaRuns(wellId),
    enabled: !!user && !!wellId,
  });
  // The day list for the date picker — the same endpoint the daily editor uses.
  const daysQ = useQuery({
    queryKey: ["entry", "days", wellId],
    queryFn: () => entryApi.get<{ id: string; reportDate: string; serialNo: number }[]>(`/wells/${wellId}/reports`),
    enabled: !!user && !!wellId,
  });

  // Pick the first well as soon as the session knows about one, so the page is
  // never a set of empty dropdowns on arrival.
  useEffect(() => {
    if (!wellId && wells.length) setWellId(wells[0].id);
  }, [wells, wellId]);
  // A well change invalidates the job — never carry another well's job across.
  useEffect(() => { setJobId(""); setDate(""); setBhaRunId(""); setCasingStringId(""); }, [wellId]);
  useEffect(() => {
    const list = jobsQ.data ?? [];
    if (!jobId && list.length) setJobId(list[0].id);
  }, [jobsQ.data, jobId]);
  useEffect(() => {
    const list = daysQ.data ?? [];
    if (!date && list.length) {
      setDate([...list].sort((a, b) => b.serialNo - a.serialNo)[0].reportDate);
    }
  }, [daysQ.data, date]);
  useEffect(() => {
    const list = bhaQ.data ?? [];
    if (!bhaRunId && list.length) setBhaRunId(list[list.length - 1].id);   // the latest run
  }, [bhaQ.data, bhaRunId]);
  useEffect(() => {
    const list = casingQ.data ?? [];
    if (!casingStringId && list.length) setCasingStringId(list[list.length - 1].id);   // the deepest string
  }, [casingQ.data, casingStringId]);

  const catalog = catalogQ.data ?? [];
  const entry = catalog.find((c) => c.type === selected) ?? null;
  const jobs = jobsQ.data ?? [];
  // Newest first: a report is nearly always wanted for the most recent day.
  const days = [...(daysQ.data ?? [])].sort((a, b) => b.serialNo - a.serialNo);
  const bhaRuns = bhaQ.data ?? [];
  const casingStrings = casingQ.data ?? [];
  const wellName = wells.find((w) => w.id === wellId)?.name ?? "";

  return (
    <div className="h-full flex flex-col p-3 sm:p-6">
      <div className="w-full max-w-[1700px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-3 sm:mb-4 shrink-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3">
          <div className="border-l-[3px] border-amber-500 pl-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Well Reports</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              The WellView report suite, generated from this application&rsquo;s own data. Layouts follow the
              sample reports; depths are metric (mKB, m) and dates are Jalali, as stored.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">
                {user.fullName} <span className="text-gray-400">({user.username})</span>
              </span>
              <button onClick={signOut} className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                Sign out
              </button>
            </div>
          )}
        </div>

        {loading && <div className="text-sm text-gray-500">Signing in…</div>}
        {!loading && !user && <SignInCard />}

        {user && (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
            {/* ── catalog ── */}
            <aside className="lg:w-[300px] shrink-0 overflow-y-auto lg:max-h-full">
              {CATEGORIES.map((category) => {
                const items = catalog.filter((c) => c.category === category);
                if (items.length === 0) return null;
                return (
                  <div key={category} className="mb-3">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1 pb-1">{category}</div>
                    <div className="space-y-1">
                      {items.map((c) => (
                        <CatalogCard
                          key={c.type}
                          entry={c}
                          active={c.type === selected}
                          onClick={() => setSelected(c.type)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {catalogQ.isLoading && <div className="text-xs text-gray-400 px-1">Loading catalog…</div>}
            </aside>

            {/* ── parameters + preview ── */}
            <section className="flex-1 min-w-0 flex flex-col min-h-0">
              {!entry ? (
                <div className="text-sm text-gray-500">Pick a report on the left.</div>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 shrink-0">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900">
                          <span className="text-gray-400 tabular-nums mr-1.5">{entry.type}</span>
                          {entry.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{entry.blurb}</div>
                      </div>
                      <div className="flex flex-wrap items-end gap-2 ml-auto">
                        {entry.params.includes("well") && (
                          <Picker label="Well">
                            {(id) => (
                            <select
                              id={id}
                              value={wellId}
                              onChange={(e) => setWellId(e.target.value)}
                              className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[160px]"
                            >
                              {wells.length === 0 && <option value="">no wells assigned</option>}
                              {wells.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                            )}
                          </Picker>
                        )}
                        {entry.params.includes("date") && (
                          <Picker label="Date">
                            {(id) => (
                            <select
                              id={id}
                              value={date}
                              onChange={(e) => setDate(e.target.value)}
                              disabled={days.length === 0}
                              className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[150px] disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              {days.length === 0 && <option value="">— no days —</option>}
                              {days.map((r) => (
                                <option key={r.id} value={r.reportDate}>
                                  {r.reportDate} · #{r.serialNo}
                                </option>
                              ))}
                            </select>
                            )}
                          </Picker>
                        )}
                        {entry.params.includes("casingString") && (
                          <Picker label="Casing string">
                            {(id) => (
                            <select
                              id={id}
                              value={casingStringId}
                              onChange={(e) => setCasingStringId(e.target.value)}
                              disabled={casingStrings.length === 0}
                              className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[190px] disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              {casingStrings.length === 0 && <option value="">— no strings —</option>}
                              {casingStrings.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {[c.description ?? "Casing", c.setDepthMkb === null ? null : `${c.setDepthMkb.toFixed(1)} mKB`]
                                    .filter(Boolean).join(" · ")}
                                </option>
                              ))}
                            </select>
                            )}
                          </Picker>
                        )}
                        {entry.params.includes("bhaRun") && (
                          <Picker label="BHA run">
                            {(id) => (
                            <select
                              id={id}
                              value={bhaRunId}
                              onChange={(e) => setBhaRunId(e.target.value)}
                              disabled={bhaRuns.length === 0}
                              className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[180px] disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              {bhaRuns.length === 0 && <option value="">— no runs —</option>}
                              {bhaRuns.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {[r.bhaNo !== null ? `BHA #${r.bhaNo}` : "BHA", r.name].filter(Boolean).join(" · ")}
                                </option>
                              ))}
                            </select>
                            )}
                          </Picker>
                        )}
                        {entry.params.includes("job") && (
                          <Picker label="Job">
                            {(id) => (
                            <select
                              id={id}
                              value={jobId}
                              onChange={(e) => setJobId(e.target.value)}
                              // Nothing to choose from is a disabled control, not
                              // a live one showing a message — the well needs a
                              // job before this picker means anything.
                              disabled={jobs.length === 0}
                              className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white min-w-[180px] disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              {jobs.length === 0 && <option value="">— no jobs —</option>}
                              {jobs.map((j) => (
                                <option key={j.id} value={j.id}>{jobLabel(j)}</option>
                              ))}
                            </select>
                            )}
                          </Picker>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-auto bg-gray-100 rounded-lg p-3">
                    {!entry.available ? (
                      <Pending entry={entry} />
                    ) : entry.params.includes("job") && !jobsQ.isLoading && jobs.length === 0 ? (
                      // A job-scoped report on a well with no jobs. Say what is
                      // missing and where to add it — "pick a job above" would
                      // be asking for something that is not there to pick.
                      <Notice>
                        <span className="font-medium text-gray-700">{wellName || "This well"}</span> has no
                        drilling job recorded yet, and this report is scoped to one.
                        <div className="mt-1.5 text-xs text-gray-400">
                          Jobs, phases, the AFE and the cost sheet are entered under Well Data. Pick another
                          well above if one is already set up.
                        </div>
                      </Notice>
                    ) : entry.params.includes("date") && !daysQ.isLoading && days.length === 0 ? (
                      <Notice>
                        <span className="font-medium text-gray-700">{wellName || "This well"}</span> has no
                        daily reports filed yet, and this report covers one day.
                        <div className="mt-1.5 text-xs text-gray-400">
                          Days are filed under Daily Report Entry.
                        </div>
                      </Notice>
                    ) : entry.params.includes("bhaRun") && !bhaQ.isLoading && bhaRuns.length === 0 ? (
                      <Notice>
                        <span className="font-medium text-gray-700">{wellName || "This well"}</span> has no
                        BHA runs recorded, and this report covers one.
                        <div className="mt-1.5 text-xs text-gray-400">
                          A run is created from the daily drill-string rows — give each assembly a BHA
                          number on the Drill strings tab under Daily Report Entry.
                        </div>
                      </Notice>
                    ) : entry.type === "01" ? (
                      <Report01Panel jobId={jobId} />
                    ) : entry.type === "06" || entry.type === "07" ? (
                      <DailyPanel type={entry.type} wellId={wellId} date={date} />
                    ) : entry.type === "02" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "02", bhaRunId]}
                        enabled={!!bhaRunId}
                        load={() => wellviewApi.reportData<Report02Payload>("02", { bhaRunId })}
                        render={(p) => <Report02Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/bha.js")).exportReport02Pdf(p)}
                        empty="Pick a BHA run above."
                      />
                    ) : entry.type === "03" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "03", wellId, jobId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report03Payload>("03", { wellId, ...(jobId ? { jobId } : {}) })}
                        render={(p) => <Report03Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/bha.js")).exportReport03Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.params.includes("casingString") && !casingQ.isLoading && casingStrings.length === 0 ? (
                      <Notice>
                        <span className="font-medium text-gray-700">{wellName || "This well"}</span> has no
                        casing strings recorded, and this report covers one.
                        <div className="mt-1.5 text-xs text-gray-400">
                          Strings, their tallies and their cement jobs are entered under
                          Well data → Casing &amp; cement.
                        </div>
                      </Notice>
                    ) : entry.type === "04" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "04", casingStringId]}
                        enabled={!!casingStringId}
                        load={() => wellviewApi.reportData<Report04Payload>("04", { casingStringId })}
                        render={(p) => <Report04Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/casing.js")).exportReport04Pdf(p)}
                        empty="Pick a casing string above."
                      />
                    ) : entry.type === "05" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "05", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report05Payload>("05", { wellId })}
                        render={(p) => <Report05Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/casing.js")).exportReport05Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "08" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "08", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report08Payload>("08", { wellId })}
                        render={(p) => <Report08Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/directional.js")).exportReport08Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "09" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "09", jobId]}
                        enabled={!!jobId}
                        load={() => wellviewApi.reportData<Report09Payload>("09", { jobId })}
                        render={(p) => <Report09Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/summary.js")).exportReport09Pdf(p)}
                        empty="Pick a job above."
                      />
                    ) : entry.type === "10" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "10", jobId]}
                        enabled={!!jobId}
                        load={() => wellviewApi.reportData<Report10Payload>("10", { jobId })}
                        render={(p) => <Report10Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/phases.js")).exportReport10Pdf(p)}
                        empty="Pick a job above."
                      />
                    ) : entry.type === "11" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "11", jobId]}
                        enabled={!!jobId}
                        load={() => wellviewApi.reportData<Report11Payload>("11", { jobId })}
                        render={(p) => <Report11Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/phases.js")).exportReport11Pdf(p)}
                        empty="Pick a job above."
                      />
                    ) : (
                      <Pending entry={entry} />
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function jobLabel(j: JobListItem): string {
  const afe = j.afes.find((a) => a.afeNumber)?.afeNumber;
  return [j.name ?? j.primaryJobType ?? j.category ?? "Job", afe ? `AFE ${afe}` : null]
    .filter(Boolean).join(" · ");
}

/**
 * A labelled picker.
 *
 * The label is associated by `htmlFor`, not by wrapping the control: a `<label>`
 * that CONTAINS a `<select>` takes the selected option into its accessible
 * name, so the field announces as "Well Dehloran-099 — PDX-555" instead of
 * "Well".
 */
function Picker({ label, children }: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      {children(id)}
    </div>
  );
}

function CatalogCard({ entry, active, onClick }: {
  entry: CatalogEntry; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={`report-${entry.type}`}
      className={`w-full text-left px-2 py-1.5 rounded-md border transition-colors duration-150 ${
        active
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] tabular-nums text-gray-400 shrink-0">{entry.type}</span>
        <span className={`text-xs truncate ${active ? "font-semibold text-blue-800" : "text-gray-800"}`}>
          {entry.title}
        </span>
        {!entry.available && (
          <span className="ml-auto shrink-0 text-[9px] px-1 rounded bg-gray-100 text-gray-400 border border-gray-200">
            soon
          </span>
        )}
      </div>
    </button>
  );
}

/** A report whose assembler is not written yet — say so plainly. */
function Pending({ entry }: { entry: CatalogEntry }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 text-center max-w-[560px] mx-auto">
      <div className="text-sm font-semibold text-gray-800">{entry.title}</div>
      <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
        {entry.blurb}
      </p>
      <p className="text-xs text-gray-400 mt-3">
        Not built yet. The field inventory for this report is in{" "}
        <code className="text-gray-500">WELLVIEW_REPORT_SPEC.md</code>; progress is tracked in{" "}
        <code className="text-gray-500">docs/wellview-report-status.md</code>.
      </p>
    </div>
  );
}

/** Report 01, with its preview and its PDF button. */
function Report01Panel({ jobId }: { jobId: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["wellview", "report", "01", jobId],
    queryFn: () => wellviewApi.reportData<Report01Payload>("01", { jobId }),
    enabled: !!jobId,
  });

  const onExport = async () => {
    if (!q.data) return;
    setExporting(true);
    setError(null);
    try {
      // pdfmake is imported at click time, so the report bundle stays out of the
      // initial page load — the same rule the directional-plot export follows.
      const { exportReport01Pdf } = await import("../export/wellview/01-afe-vs-field-est.js");
      await exportReport01Pdf(q.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!jobId) {
    return <Notice>Pick a job above. This report is scoped to one drilling job.</Notice>;
  }
  if (q.isLoading) return <Notice>Assembling the report…</Notice>;
  if (q.error) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  if (!q.data) return <Notice>Nothing to show.</Notice>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
        <button
          onClick={() => void onExport()}
          disabled={exporting}
          className="h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
        >
          {exporting ? "Generating…" : "PDF"}
        </button>
      </div>
      <Report01Preview payload={q.data} />
    </div>
  );
}

/** Reports 06 and 07 — one panel, since they differ only by the payload. */
function DailyPanel({ type, wellId, date }: { type: string; wellId: string; date: string }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["wellview", "report", type, wellId, date],
    queryFn: () => wellviewApi.reportData<DailyPayload>(type, { wellId, date }),
    enabled: !!wellId && !!date,
  });

  const onExport = async () => {
    if (!q.data) return;
    setExporting(true);
    setError(null);
    try {
      const { exportDailyPdf } = await import("../export/wellview/daily.js");
      await exportDailyPdf(q.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!date) return <Notice>Pick a day above. This report covers one well-day.</Notice>;
  if (q.isLoading) return <Notice>Assembling the report…</Notice>;
  if (q.error) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  if (!q.data) return <Notice>Nothing to show.</Notice>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
        <button
          onClick={() => void onExport()}
          disabled={exporting}
          className="h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
        >
          {exporting ? "Generating…" : "PDF"}
        </button>
      </div>
      <DailyPreview payload={q.data} />
    </div>
  );
}

/**
 * A report panel: fetch the payload, preview it, offer the PDF.
 *
 * Generic because every report after the first three is the same three steps —
 * only the query, the preview component and the exporter change.
 */
function ReportPanel<T>({ queryKey, enabled, load, render, exporter, empty }: {
  queryKey: unknown[];
  enabled: boolean;
  load: () => Promise<T>;
  render: (payload: T) => React.ReactNode;
  exporter: (payload: T) => Promise<void>;
  empty: string;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey, queryFn: load, enabled });

  const onExport = async () => {
    if (!q.data) return;
    setExporting(true);
    setError(null);
    try {
      // pdfmake is imported at click time so the report bundle stays out of the
      // initial page load — the rule the directional-plot export set.
      await exporter(q.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  if (!enabled) return <Notice>{empty}</Notice>;
  if (q.isLoading) return <Notice>Assembling the report…</Notice>;
  if (q.error) return <Notice tone="error">{(q.error as Error).message}</Notice>;
  if (!q.data) return <Notice>Nothing to show.</Notice>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        {error && <span className="text-xs text-red-600 mr-auto">{error}</span>}
        <button
          onClick={() => void onExport()}
          disabled={exporting}
          className="h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
        >
          {exporting ? "Generating…" : "PDF"}
        </button>
      </div>
      {render(q.data)}
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className={`max-w-[560px] mx-auto rounded-lg border px-4 py-3 text-sm ${
      tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-gray-200 bg-white text-gray-500"
    }`}>
      {children}
    </div>
  );
}
