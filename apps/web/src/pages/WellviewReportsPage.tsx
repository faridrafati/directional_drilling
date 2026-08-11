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
  type Report12Payload, type Report14Payload,
  type Report18Payload, type Report19Payload, type Report20Payload,
  type Report21Payload,
  type Report22Payload, type Report23Payload, type Report24Payload, type Report25Payload,
  type Report26Payload, type Report27Payload, type Report28Payload, type Report29Payload,
  type Report30Payload,
  type Report13Payload, type Report16Payload,
  type Report15Payload, type Report17Payload,
  type Report10Payload, type Report11Payload,
} from "../entry/wellview.js";
import { Report01Preview } from "../components/wellview/ReportPreview.js";
import { DailyPreview } from "../components/wellview/DailyPreview.js";
import { Report02Preview, Report03Preview } from "../components/wellview/BhaPreview.js";
import { Report10Preview, Report11Preview } from "../components/wellview/PhasePreview.js";
import { Report04Preview, Report05Preview } from "../components/wellview/CasingPreview.js";
import { Report08Preview } from "../components/wellview/DirectionalPreview.js";
import { Report09Preview } from "../components/wellview/SummaryPreview.js";
import { Report15Preview, Report17Preview } from "../components/wellview/MultiWellPreview.js";
import { Report13Preview, Report16Preview } from "../components/wellview/PivotPreview.js";
import { Report12Preview, Report14Preview } from "../components/wellview/OffsetPreview.js";
import { Report18Preview, Report19Preview, Report20Preview } from "../components/wellview/GeologyPreview.js";
import { Report21Preview } from "../components/wellview/SchematicPreview.js";
import {
  Report22Preview, Report23Preview, Report24Preview,
  Report26Preview, Report28Preview, Report29Preview, Report30Preview,
} from "../components/wellview/CompletionPreview.js";
import { Report25Preview, Report27Preview } from "../components/wellview/ProductionPreview.js";
import { TemplateBrowser } from "../components/wellview/TemplateBrowser.js";

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
  /**
   * The multi-well reports' set. EMPTY means "every well I may use" — which is
   * what a company man opening a cross-well summary almost always wants, and it
   * means the page shows something before anything is ticked.
   */
  const [wellIds, setWellIds] = useState<string[]>([]);
  /** The multi-well date filter, both bounds inclusive and both optional. */
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [selected, setSelected] = useState<string>("01");
  /**
   * "reports" builds the 30 from this application's own data; "templates"
   * browses the 181 ORIGINAL WellView layouts read out of their .afr files.
   * They answer different questions — what we produce, and what WellView
   * produced — so they are two views rather than one merged list.
   */
  const [view, setView] = useState<"reports" | "templates">("reports");

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
  /** What a multi-well request posts: the ticked ids, or nothing for "all". */
  const wellSetParam = wellIds.length ? wellIds.join(",") : "";
  const rangeParams = { ...(from ? { from } : {}), ...(to ? { to } : {}) };

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
          <div className="flex gap-1 border-b border-gray-200 mb-3 shrink-0">
            {([["reports", "Generated reports"], ["templates", "WellView templates"]] as const).map(
              ([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-current={view === id ? "page" : undefined}
                  className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors duration-150 ${
                    view === id
                      ? "border-blue-600 text-blue-700 font-medium"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        )}

        {user && view === "templates" && <TemplateBrowser />}

        {user && view === "reports" && (
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
                        {entry.params.includes("wells") && (
                          <WellSetPicker
                            wells={wells}
                            value={wellIds}
                            onChange={setWellIds}
                          />
                        )}
                        {entry.params.includes("asOf") && (
                          <Picker label="As of">
                            {(id) => (
                              <input
                                id={id} value={to} onChange={(e) => setTo(e.target.value)}
                                placeholder="1405/02/22"
                                className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white w-[120px]"
                              />
                            )}
                          </Picker>
                        )}
                        {entry.params.includes("dateRange") && (
                          <>
                            <Picker label="From">
                              {(id) => (
                                <input
                                  id={id} value={from} onChange={(e) => setFrom(e.target.value)}
                                  placeholder="1405/02/10"
                                  className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white w-[110px]"
                                />
                              )}
                            </Picker>
                            <Picker label="To">
                              {(id) => (
                                <input
                                  id={id} value={to} onChange={(e) => setTo(e.target.value)}
                                  placeholder="1405/03/05"
                                  className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white w-[110px]"
                                />
                              )}
                            </Picker>
                          </>
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
                    ) : entry.type === "22" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "22", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report22Payload>("22", { wellId })}
                        render={(p) => <Report22Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport22Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "24" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "24", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report24Payload>("24", { wellId })}
                        render={(p) => <Report24Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport24Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "26" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "26", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report26Payload>("26", { wellId })}
                        render={(p) => <Report26Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport26Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "27" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "27", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report27Payload>("27", { wellId })}
                        render={(p) => <Report27Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport27Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "28" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "28", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report28Payload>("28", { wellId })}
                        render={(p) => <Report28Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport28Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "29" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "29", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report29Payload>("29", { wellId })}
                        render={(p) => <Report29Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport29Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "30" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "30", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report30Payload>("30", { wellId })}
                        render={(p) => <Report30Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport30Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "23" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "23", wellId, date]}
                        enabled={!!wellId && !!date}
                        load={() => wellviewApi.reportData<Report23Payload>("23", { wellId, date })}
                        render={(p) => <Report23Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport23Pdf(p)}
                        empty="Pick a day above."
                      />
                    ) : entry.type === "25" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "25", wellSetParam]}
                        enabled
                        load={() => wellviewApi.reportData<Report25Payload>("25",
                          wellSetParam ? { wellIds: wellSetParam } : {})}
                        render={(p) => <Report25Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/completion.js")).exportReport25Pdf(p)}
                        xlsxExporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport25Xlsx(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "21" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "21", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report21Payload>("21", { wellId })}
                        render={(p) => <Report21Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/schematic.js")).exportReport21Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "18" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "18", wellId, date]}
                        enabled={!!wellId && !!date}
                        load={() => wellviewApi.reportData<Report18Payload>("18", { wellId, date })}
                        render={(p) => <Report18Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/geology.js")).exportReport18Pdf(p)}
                        empty="Pick a day above."
                      />
                    ) : entry.type === "19" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "19", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report19Payload>("19", { wellId })}
                        render={(p) => <Report19Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/geology.js")).exportReport19Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "20" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "20", wellId]}
                        enabled={!!wellId}
                        load={() => wellviewApi.reportData<Report20Payload>("20", { wellId })}
                        render={(p) => <Report20Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/geology.js")).exportReport20Pdf(p)}
                        empty="Pick a well above."
                      />
                    ) : entry.type === "12" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "12", wellSetParam, to]}
                        enabled
                        load={() => wellviewApi.reportData<Report12Payload>("12", {
                          ...(wellSetParam ? { wellIds: wellSetParam } : {}), ...(to ? { to } : {}),
                        })}
                        render={(p) => <Report12Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/offsets.js")).exportReport12Pdf(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "14" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "14", wellSetParam]}
                        enabled
                        load={() => wellviewApi.reportData<Report14Payload>("14",
                          wellSetParam ? { wellIds: wellSetParam } : {})}
                        render={(p) => <Report14Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/offsets.js")).exportReport14Pdf(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "13" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "13", wellSetParam]}
                        enabled
                        load={() => wellviewApi.reportData<Report13Payload>("13",
                          wellSetParam ? { wellIds: wellSetParam } : {})}
                        render={(p) => <Report13Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport13Pdf(p)}
                        xlsxExporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport13Xlsx(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "16" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "16", wellSetParam]}
                        enabled
                        load={() => wellviewApi.reportData<Report16Payload>("16",
                          wellSetParam ? { wellIds: wellSetParam } : {})}
                        render={(p) => <Report16Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport16Pdf(p)}
                        xlsxExporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport16Xlsx(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "15" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "15", wellSetParam, from, to]}
                        enabled
                        load={() => wellviewApi.reportData<Report15Payload>("15", {
                          ...(wellSetParam ? { wellIds: wellSetParam } : {}), ...rangeParams,
                        })}
                        render={(p) => <Report15Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/multiwell.js")).exportReport15Pdf(p)}
                        xlsxExporter={async (p) => (await import("../export/wellview/pivots.js")).exportReport15Xlsx(p)}
                        empty="No well available."
                      />
                    ) : entry.type === "17" ? (
                      <ReportPanel
                        queryKey={["wellview", "report", "17", wellSetParam, from, to]}
                        enabled
                        load={() => wellviewApi.reportData<Report17Payload>("17", {
                          ...(wellSetParam ? { wellIds: wellSetParam } : {}), ...rangeParams,
                        })}
                        render={(p) => <Report17Preview payload={p} />}
                        exporter={async (p) => (await import("../export/wellview/multiwell.js")).exportReport17Pdf(p)}
                        empty="No well available."
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

/**
 * The multi-well set picker.
 *
 * A dropdown of checkboxes rather than a `<select multiple>`: a native multi
 * select needs ctrl-click to add a well and silently clears the lot on a plain
 * click, which on a report that costs a page of output is a trap. Empty means
 * "all my wells", stated on the button so nobody has to guess what no ticks
 * does.
 */
function WellSetPicker({ wells, value, onChange }: {
  wells: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value.length === 0
    ? `All wells (${wells.length})`
    : `${value.length} of ${wells.length} wells`;

  /**
   * Ticking, with "empty means all" made to behave the way it looks.
   *
   * In "all" mode every box is drawn ticked, so clicking one has to UNtick that
   * well and leave the rest — not select it alone, which is what treating the
   * empty set literally would do. And once every well is ticked the set goes
   * back to empty, so "all" stays one state rather than two that print the same
   * report.
   */
  const toggle = (id: string) => {
    const current = value.length === 0 ? wells.map((w) => w.id) : value;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange(next.length === wells.length ? [] : next);
  };

  return (
    <div className="flex flex-col gap-0.5 relative">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">Wells</span>
      <button
        type="button" onClick={() => setOpen((v) => !v)} data-testid="well-set-picker"
        className="h-8 border border-gray-300 rounded-md px-2 text-xs bg-white min-w-[160px] text-left hover:bg-gray-50 transition-colors duration-150"
      >
        {label} <span className="text-gray-400 ml-1">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 w-[260px] max-h-[300px] overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg p-1.5">
          <div className="flex gap-2 px-1 pb-1.5 mb-1 border-b border-gray-100">
            <button type="button" onClick={() => onChange([])}
              className="text-[11px] text-blue-600 hover:underline">All wells</button>
            <button type="button" onClick={() => onChange(wells.map((w) => w.id))}
              className="text-[11px] text-blue-600 hover:underline">Tick every well</button>
          </div>
          {wells.length === 0 && (
            <div className="px-1 py-2 text-[11px] text-gray-400">No well assigned to this account.</div>
          )}
          {wells.map((w) => (
            <label key={w.id} className="flex items-center gap-2 px-1 py-1 text-xs hover:bg-gray-50 rounded cursor-pointer">
              <input
                type="checkbox" className="h-3.5 w-3.5"
                checked={value.length === 0 || value.includes(w.id)}
                onChange={() => toggle(w.id)}
              />
              <span className="truncate">{w.name}</span>
            </label>
          ))}
        </div>
      )}
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
function ReportPanel<T>({ queryKey, enabled, load, render, exporter, xlsxExporter, empty }: {
  queryKey: unknown[];
  enabled: boolean;
  load: () => Promise<T>;
  render: (payload: T) => React.ReactNode;
  exporter: (payload: T) => Promise<void>;
  /** Only the pivot reports have one — their samples ARE spreadsheets. */
  xlsxExporter?: (payload: T) => Promise<void>;
  empty: string;
}) {
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = useQuery({ queryKey, queryFn: load, enabled });

  const onExport = async (kind: "pdf" | "xlsx") => {
    if (!q.data) return;
    setExporting(kind);
    setError(null);
    try {
      // pdfmake and SheetJS are both imported at click time so neither ships in
      // the initial page load — the rule the directional-plot export set.
      await (kind === "pdf" ? exporter(q.data) : xlsxExporter?.(q.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(null);
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
        {xlsxExporter && (
          <button
            onClick={() => void onExport("xlsx")}
            disabled={exporting !== null}
            className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150"
          >
            {exporting === "xlsx" ? "Generating…" : "Excel"}
          </button>
        )}
        <button
          onClick={() => void onExport("pdf")}
          disabled={exporting !== null}
          className="h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors duration-150"
        >
          {exporting === "pdf" ? "Generating…" : "PDF"}
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
