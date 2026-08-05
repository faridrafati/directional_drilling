/**
 * Daily Report Entry — the rig side of the Daily Drilling Reports page.
 *
 * The /ddr page reads the office's historical Access→SQLite archive. This page
 * is where the report is *born*: a company man signs in, picks the well an admin
 * assigned to them, opens a day, and fills the same DR.xls sheet. Everything is
 * stored in the app's own database via the authenticated /entry/* API.
 *
 *   sign in → well (+ its day list) → the day's report → Save … Submit
 *
 * Admins get an extra tab for rigs, wells, accounts and assignments, plus a
 * cross-well view of everything filed.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EntryAuthProvider, useEntryAuth, SignInCard, ChangePasswordCard } from "../entry/auth.js";
import { entryApi, type ReportDetail, type ReportListItem, type EntryWell } from "../entry/client.js";
import { ReportEditor } from "../components/entry/ReportEditor.js";
import { AdminPanel } from "../components/entry/AdminPanel.js";
import { JalaliDatePicker } from "../components/ddr/JalaliDatePicker.js";

export function ReportEntryPage() {
  return (
    <EntryAuthProvider>
      <Inner />
    </EntryAuthProvider>
  );
}

function Inner() {
  const { user, wells, loading, signOut } = useEntryAuth();
  const [tab, setTab] = useState<"reports" | "admin">("reports");
  const [changing, setChanging] = useState(false);

  return (
    <div className="h-full flex flex-col p-3 sm:p-6">
      <div className="w-full max-w-[1700px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-3 sm:mb-4 shrink-0 flex flex-col sm:flex-row sm:flex-wrap sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="border-l-[3px] border-amber-500 pl-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Daily Report Entry</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Rig-side data capture — the company man fills the daily drilling report for the well they are
              assigned to. Dates are Jalali (Shamsi), the same as the office archive.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-gray-600 basis-full sm:basis-auto">
                {user.fullName} <span className="text-gray-400">({user.username}{user.role === "admin" ? " · admin" : ""})</span>
              </span>
              <button onClick={() => setChanging(true)} className="min-h-[44px] sm:min-h-[32px] h-11 sm:h-8 px-4 sm:px-3 text-sm sm:text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">Password</button>
              <button onClick={signOut} className="min-h-[44px] sm:min-h-[32px] h-11 sm:h-8 px-4 sm:px-3 text-sm sm:text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">Sign out</button>
            </div>
          )}
        </div>

        {loading && <div className="text-sm text-gray-500">Signing in…</div>}

        {!loading && !user && <SignInCard />}

        {/* A password an admin issued must be replaced before any reporting. */}
        {user?.mustChangePassword && (
          <div className="flex-1 min-h-0 flex items-start justify-center pt-6">
            <ChangePasswordCard forced onDone={() => setChanging(false)} />
          </div>
        )}

        {user && !user.mustChangePassword && changing && (
          <div className="flex-1 min-h-0 flex items-start justify-center pt-6">
            <ChangePasswordCard onDone={() => setChanging(false)} />
          </div>
        )}

        {user && !user.mustChangePassword && !changing && (
          <>
            {user.role === "admin" && (
              <div className="flex gap-2 sm:gap-1 border-b border-gray-200 mb-3 shrink-0">
                {([["reports", "Reports"], ["admin", "Administration"]] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    className={`min-h-[44px] sm:min-h-[36px] px-4 sm:px-3 py-2 text-sm -mb-px border-b-2 transition-colors duration-150 ${tab === id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {tab === "admin" && user.role === "admin" ? <AdminPanel /> : <ReportsWorkspace wells={wells} isAdmin={user.role === "admin"} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── well + day list on the left, the sheet on the right ─────────────────────
function ReportsWorkspace({ wells, isAdmin }: { wells: EntryWell[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [wellId, setWellId] = useState<string>(wells[0]?.id ?? "");
  const [reportId, setReportId] = useState<string | null>(null);
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Purely presentational: below `lg` the panel stacks on top of the sheet, so
  // opening a day folds it away to give the sheet the screen. Starts open,
  // because with no day selected the panel IS the page.
  const [panelOpen, setPanelOpen] = useState(true);
  /** Open a day and, on a phone, get the picker out of the way. */
  const openReport = (id: string | null) => {
    setReportId(id);
    setPanelOpen(id === null);
  };

  // Keep a valid well selected as the assignment list loads or changes.
  useEffect(() => {
    if (!wells.length) { setWellId(""); return; }
    if (!wells.some((w) => w.id === wellId)) { setWellId(wells[0].id); openReport(null); }
  }, [wells, wellId]);

  const daysQ = useQuery({
    queryKey: ["entry", "days", wellId],
    queryFn: () => entryApi.get<ReportListItem[]>(`/wells/${wellId}/reports`),
    enabled: !!wellId,
  });
  const reportQ = useQuery({
    queryKey: ["entry", "report", reportId],
    queryFn: () => entryApi.get<ReportDetail>(`/reports/${reportId}`),
    enabled: !!reportId,
  });

  async function createDay() {
    if (!wellId || !newDate) return;
    setCreating(true); setError(null);
    try {
      const r = await entryApi.post<ReportDetail>("/reports", { wellId, reportDate: newDate });
      qc.setQueryData(["entry", "report", r.id], r);
      openReport(r.id);
      setNewDate("");
      await qc.invalidateQueries({ queryKey: ["entry", "days", wellId] });
    } catch (e) { setError(String((e as Error).message)); }
    finally { setCreating(false); }
  }

  async function removeDay(id: string) {
    if (!confirm("Delete this day's report? Everything typed on it is lost.")) return;
    setError(null);
    try {
      await entryApi.del(`/reports/${id}`);
      if (reportId === id) openReport(null);
      await qc.invalidateQueries({ queryKey: ["entry", "days", wellId] });
    } catch (e) { setError(String((e as Error).message)); }
  }

  if (!wells.length) {
    return (
      <div className="flex-1 min-h-0 flex items-start justify-center pt-10">
        <div className="max-w-md text-center text-sm text-gray-500 border border-gray-200 bg-white rounded-lg shadow-sm p-6">
          <p className="font-medium text-gray-700 mb-1">No wells assigned to you yet.</p>
          <p className="text-xs">
            An admin registers the rig and the well, then ticks it for your account under
            <b> Administration → Users &amp; assignments</b>. It shows up here straight away.
          </p>
        </div>
      </div>
    );
  }

  const selected = wells.find((w) => w.id === wellId);
  // Below `lg` the toggle drives the panel outright. Deriving it as
  // `panelOpen || !reportId` made the button a no-op whenever no day was open,
  // and left the panel pinned open for every later day once tapped.
  // From `lg` up the CSS keeps it visible regardless.
  const panelShown = panelOpen;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[280px_1fr] gap-3 lg:gap-4 overflow-hidden">
      {/* Well + days */}
      <div className="flex flex-col min-h-0 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelShown}
          title="Show or hide the well and day list"
          className="lg:hidden shrink-0 w-full min-h-[44px] flex items-center justify-between gap-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors duration-150">
          <span className="truncate">{selected ? `${selected.name} · days` : "Well & days"}</span>
          <span className="text-xs text-gray-400 shrink-0">{panelShown ? "Hide ▲" : "Show ▼"}</span>
        </button>
        <div className={`${panelShown ? "block" : "hidden"} lg:flex lg:flex-1 lg:flex-col min-h-0 max-h-[45vh] lg:max-h-none overflow-y-auto p-3 pt-0 lg:pt-3`}>
          <label className="block">
            <span className="text-xs sm:text-[11px] text-gray-500">Well</span>
            <select value={wellId} onChange={(e) => { setWellId(e.target.value); openReport(null); }}
              className="mt-1 w-full min-h-[44px] sm:min-h-[36px] px-2 text-base sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
              {wells.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.rig?.name}</option>)}
            </select>
          </label>
          {selected && (
            <p className="text-[11px] sm:text-[10px] text-gray-400 mt-1 leading-snug">
              {selected.field ?? "—"} · {selected.wellType ?? "—"} · spud {selected.spudDate ?? "—"}
              {selected.finalForecastDepth ? ` · TD ${selected.finalForecastDepth} m` : ""}
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs sm:text-[11px] text-gray-500">New day</span>
            <div className="flex gap-2 sm:gap-1.5 mt-1">
              <JalaliDatePicker value={newDate} onChange={setNewDate} placeholder="1404/05/09"
                className="flex-1 min-w-0 [&>input]:h-11 [&>input]:text-base sm:[&>input]:h-9 sm:[&>input]:text-sm" />
              <button onClick={createDay} disabled={!newDate || creating}
                className="min-h-[44px] sm:min-h-[36px] h-11 sm:h-9 px-4 sm:px-3 text-base sm:text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300 shrink-0">
                {creating ? "…" : "Add"}
              </button>
            </div>
            <p className="text-[11px] sm:text-[10px] text-gray-400 mt-1">Opens a draft with yesterday's midnight depth carried forward.</p>
          </div>

          {error && <div className="mt-2 text-xs sm:text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5 sm:py-1">{error}</div>}

          <div className="mt-3 pt-3 border-t border-gray-100 lg:flex-1 lg:min-h-0">
            <div className="text-xs sm:text-[11px] text-gray-500 mb-1">
              Days {daysQ.data ? `· ${daysQ.data.length}` : ""}
            </div>
            <div className="space-y-1.5 sm:space-y-1">
              {(daysQ.data ?? []).map((r) => (
                <div key={r.id}
                  className={`group w-full flex items-center gap-2 sm:gap-1 rounded-md border px-2 min-h-[44px] sm:min-h-0 py-1.5 sm:py-1 cursor-pointer transition-colors duration-100 ${
                    reportId === r.id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-blue-50/50"}`}
                  onClick={() => openReport(r.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] sm:text-[11px] font-medium text-gray-800 tabular-nums">#{r.serialNo} · {r.reportDate}</div>
                    <div className="text-xs sm:text-[10px] text-gray-400 truncate">
                      {r.midnightDepth != null ? `${r.midnightDepth} m` : "no depth yet"} · {r.user.username}
                    </div>
                  </div>
                  <span className={`text-[10px] sm:text-[9px] px-1 py-0.5 rounded uppercase shrink-0 ${
                    r.status === "submitted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {r.status === "submitted" ? "sent" : "draft"}
                  </span>
                  {(r.status === "draft" || isAdmin) && (
                    <button title="Delete this day" aria-label="Delete this day" onClick={(e) => { e.stopPropagation(); void removeDay(r.id); }}
                      className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 -my-1.5 sm:my-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-red-600 text-xl sm:text-xs leading-none shrink-0 transition-colors duration-150">×</button>
                  )}
                </div>
              ))}
              {daysQ.data?.length === 0 && (
                <p className="text-xs sm:text-[11px] text-gray-400">No reports on this well yet — add the first day above.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* The sheet */}
      <div className="min-h-0 overflow-auto">
        {reportQ.isLoading && <div className="text-sm text-gray-500 p-4">Loading the report…</div>}
        {!reportId && (
          <div className="h-full flex items-center justify-center text-center p-4 text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
            <span className="lg:hidden">Pick a day in the list above, or add a new one.</span>
            <span className="hidden lg:inline">Pick a day on the left, or add a new one.</span>
          </div>
        )}
        {reportQ.data && (
          <ReportEditor
            report={reportQ.data}
            isAdmin={isAdmin}
            onChanged={(r) => {
              qc.setQueryData(["entry", "report", r.id], r);
              void qc.invalidateQueries({ queryKey: ["entry", "days", r.wellId] });
            }}
          />
        )}
      </div>
    </div>
  );
}
