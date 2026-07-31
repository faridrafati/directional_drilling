/**
 * Administration for the report-entry module: rigs → wells → users → who may
 * report on what.
 *
 * The order on screen is the order of setup: register the rig, register the well
 * it is drilling (the DR.xls header band is filled in here, once), create the
 * company man's account, tick the wells they cover. A company man only ever sees
 * the wells ticked for them.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { entryApi, type EntryRig, type EntryUser, type EntryWell } from "../../entry/client.js";
import { ComboBox } from "./fields.js";
import { JalaliDatePicker } from "../ddr/JalaliDatePicker.js";

type AdminUser = EntryUser & { assignments: { wellId: string; well: EntryWell }[] };

/** Known values for the well form's descriptive fields (see /admin/well-options). */
interface WellOptions {
  fields: string[]; locations: string[]; wellTypes: string[];
  profiles: string[]; reservoirs: string[]; contractors: string[];
}
const NO_OPTIONS: WellOptions = { fields: [], locations: [], wellTypes: [], profiles: [], reservoirs: [], contractors: [] };

const input = "h-8 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0";
const btn = "h-8 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150 disabled:bg-gray-300";
const btnGhost = "h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150";

export function AdminPanel() {
  const [tab, setTab] = useState<"wells" | "users" | "reports">("wells");
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex gap-1 border-b border-gray-200 mb-3 shrink-0">
        {([["wells", "Rigs & wells"], ["users", "Users & assignments"], ["reports", "All reports"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-3 py-2 text-sm -mb-px border-b-2 transition-colors duration-150 ${tab === id ? "border-blue-600 text-blue-700 font-medium" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === "wells" ? <RigsAndWells /> : tab === "users" ? <UsersAndAssignments /> : <AllReports />}
      </div>
    </div>
  );
}

// ── rigs & wells ────────────────────────────────────────────────────────────
function RigsAndWells() {
  const qc = useQueryClient();
  const rigsQ = useQuery({ queryKey: ["entry", "admin", "rigs"], queryFn: () => entryApi.get<(EntryRig & { wells: EntryWell[] })[]>("/admin/rigs") });
  const wellsQ = useQuery({ queryKey: ["entry", "admin", "wells"], queryFn: () => entryApi.get<EntryWell[]>("/admin/wells") });
  // Pick-lists for the well form. Sourced from the legacy DDR lookups + the wells
  // already registered, so they grow as new values are typed.
  const optionsQ = useQuery({
    queryKey: ["entry", "admin", "well-options"],
    queryFn: () => entryApi.get<WellOptions>("/admin/well-options"),
    staleTime: 5 * 60_000,
  });
  const [rigName, setRigName] = useState("");
  const [rigContractor, setRigContractor] = useState("");
  const [editing, setEditing] = useState<EntryWell | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["entry"] });
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); invalidate(); } catch (e) { setError(String((e as Error).message)); }
  };

  return (
    <div className="space-y-5 pb-6">
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Rigs</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          <input className={input} placeholder="Rig name (PDX-203)" value={rigName} onChange={(e) => setRigName(e.target.value)} />
          <input className={input} placeholder="Contractor" value={rigContractor} onChange={(e) => setRigContractor(e.target.value)} />
          <button className={btn} disabled={!rigName.trim()}
            onClick={() => run(async () => {
              await entryApi.post("/admin/rigs", { name: rigName.trim(), contractor: rigContractor.trim() || null });
              setRigName(""); setRigContractor("");
            })}>Add rig</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(rigsQ.data ?? []).map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 text-xs border border-gray-200 rounded-md px-2 py-1 bg-white shadow-sm">
              <b>{r.name}</b>
              <span className="text-gray-400">{r.contractor ?? "—"} · {r.wells.length} well(s)</span>
              <button title="Delete rig (and its wells)" aria-label="Delete rig (and its wells)" className="text-gray-400 hover:text-red-600 transition-colors duration-150"
                onClick={() => { if (confirm(`Delete rig ${r.name} and all its wells and reports?`)) void run(() => entryApi.del(`/admin/rigs/${r.id}`)); }}>×</button>
            </span>
          ))}
          {rigsQ.data?.length === 0 && <span className="text-xs text-gray-400">No rigs yet — add one above.</span>}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Wells</h3>
          <button className={btnGhost} onClick={() => { setCreating(true); setEditing(null); }} disabled={!rigsQ.data?.length}>+ New well</button>
        </div>
        {(creating || editing) && (
          <WellForm
            rigs={rigsQ.data ?? []}
            well={editing}
            options={optionsQ.data ?? NO_OPTIONS}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onSaved={() => { setCreating(false); setEditing(null); invalidate(); }}
          />
        )}
        <table className="w-full text-xs border-collapse mt-2">
          <thead>
            <tr>{["Well", "Rig", "Field", "Type", "Spud", "Legacy code", "Reports", "Assigned", "", ""].map((h, i) => (
              <th key={i} className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {(wellsQ.data ?? []).map((w) => (
              <tr key={w.id} className={w.active ? "bg-white" : "bg-gray-50 text-gray-400"}>
                <td className="border border-gray-200 px-2 py-1 font-medium">{w.name}</td>
                <td className="border border-gray-200 px-2 py-1">{w.rig?.name}</td>
                <td className="border border-gray-200 px-2 py-1">{w.field ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1">{w.wellType ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1">{w.spudDate ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1">{w.legacyWellCode ?? "—"}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{w._count?.reports ?? 0}</td>
                <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{w._count?.assignments ?? 0}</td>
                <td className="border border-gray-200 px-1 py-1">
                  <button className="text-blue-600 hover:underline" onClick={() => { setEditing(w); setCreating(false); }}>edit</button>
                </td>
                <td className="border border-gray-200 px-1 py-1">
                  <button className="text-gray-400 hover:text-red-600"
                    onClick={() => { if (confirm(`Delete well ${w.name} and its ${w._count?.reports ?? 0} report(s)?`)) void run(() => entryApi.del(`/admin/wells/${w.id}`)); }}>delete</button>
                </td>
              </tr>
            ))}
            {wellsQ.data?.length === 0 && (
              <tr><td colSpan={10} className="border border-gray-200 px-2 py-3 text-center text-gray-400">No wells registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/**
 * Label + control, and label + text input.
 *
 * These MUST stay at module scope. Declaring a component inside another
 * component's body makes a brand-new component type on every render, so React
 * unmounts and remounts the subtree — the input loses focus after each
 * keystroke. The well form therefore calls them as plain helpers (or renders
 * them directly), never as locally-declared components.
 */
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function TextCell({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <input className={`${input} w-full mt-0.5`} type={type} placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Create / edit a well — this is the DR.xls header band, filled once. */
function WellForm({ rigs, well, options, onCancel, onSaved }: {
  rigs: EntryRig[]; well: EntryWell | null; options: WellOptions; onCancel: () => void; onSaved: () => void;
}) {
  const [f, setF] = useState(() => ({
    rigId: well?.rigId ?? rigs[0]?.id ?? "",
    name: well?.name ?? "", field: well?.field ?? "", legacyWellCode: well?.legacyWellCode ?? "",
    location: well?.location ?? "", wellType: well?.wellType ?? "", profile: well?.profile ?? "",
    reservoir: well?.reservoir ?? "", contractor: well?.contractor ?? "",
    spudDate: well?.spudDate ?? "", rigReleasedDate: well?.rigReleasedDate ?? "",
    rtElevation: well?.rtElevation ?? "", waterDepth: well?.waterDepth ?? "",
    finalForecastDepth: well?.finalForecastDepth ?? "", forecastDays: well?.forecastDays ?? "",
    active: well?.active ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (well) await entryApi.put(`/admin/wells/${well.id}`, f);
      else await entryApi.post("/admin/wells", f);
      onSaved();
    } catch (err) { setError(String((err as Error).message)); }
    finally { setBusy(false); }
  }

  const F = (label: string, k: keyof typeof f, type = "text", placeholder?: string) => (
    <TextCell key={k} label={label} type={type} placeholder={placeholder}
      value={String(f[k] ?? "")} onChange={(v) => set(k, v)} />
  );
  /** Descriptive fields are pick-from-list (company values) but still typeable. */
  const C = (label: string, k: keyof typeof f, list: string[], placeholder?: string) => (
    <Labeled key={k} label={label}>
      <ComboBox value={String(f[k] ?? "")} onChange={(v) => set(k, v)} options={list} placeholder={placeholder} />
    </Labeled>
  );

  return (
    <form onSubmit={submit} className="border border-blue-200 bg-blue-50/40 rounded-lg shadow-sm p-3">
      <div className="text-xs font-semibold text-gray-700 mb-2">{well ? `Edit ${well.name}` : "New well"}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Rig</span>
          <select className={`${input} w-full mt-0.5`} value={f.rigId} onChange={(e) => set("rigId", e.target.value)}>
            {rigs.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {F("Well name", "name", "text", "DEHLURAN-031")}
        {C("Field", "field", options.fields, "pick or type")}
        {F("Legacy well code", "legacyWellCode", "text", "DH-027-PDX")}
        {C("Location", "location", options.locations, "pick or type")}
        {C("Operation type", "wellType", options.wellTypes, "Development")}
        {C("Well profile", "profile", options.profiles, "Directional")}
        {C("Reservoir", "reservoir", options.reservoirs, "pick or type")}
        {C("Contractor", "contractor", options.contractors, "pick or type")}
        <Labeled label="Spud date (Jalali)">
          <JalaliDatePicker value={f.spudDate} onChange={(v) => set("spudDate", v)} placeholder="1404/04/12" className="w-full" />
        </Labeled>
        <Labeled label="Rig released (Jalali)">
          <JalaliDatePicker value={f.rigReleasedDate} onChange={(v) => set("rigReleasedDate", v)} placeholder="1404/09/20" className="w-full" />
        </Labeled>
        {F("R.T. elevation (m)", "rtElevation", "number")}
        {F("Water depth (m)", "waterDepth", "number")}
        {F("Projected TD (m)", "finalForecastDepth", "number")}
        {F("Forecast rig days", "forecastDays", "number")}
        <label className="flex items-center gap-2 mt-4 text-xs text-gray-600">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
      </div>
      <p className="text-[10px] text-gray-500 mt-2">
        The list fields offer the company's known values (from the DDR archive plus wells already registered) —
        pick one, or type a new value and it will be offered next time.
      </p>
      {error && <div className="text-xs text-red-700 mt-2">{error}</div>}
      <div className="flex gap-2 mt-3">
        <button type="submit" className={btn} disabled={busy || !f.name.trim() || !f.rigId}>{busy ? "Saving…" : well ? "Save well" : "Create well"}</button>
        <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── users & assignments ─────────────────────────────────────────────────────
function UsersAndAssignments() {
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["entry", "admin", "users"], queryFn: () => entryApi.get<AdminUser[]>("/admin/users") });
  const wellsQ = useQuery({ queryKey: ["entry", "admin", "wells"], queryFn: () => entryApi.get<EntryWell[]>("/admin/wells") });
  const [nu, setNu] = useState({ username: "", fullName: "", password: "", role: "companyman" });
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["entry"] });
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); invalidate(); } catch (e) { setError(String((e as Error).message)); }
  };
  const toggle = useMutation({
    mutationFn: ({ user, wellId, on }: { user: AdminUser; wellId: string; on: boolean }) => {
      const ids = new Set(user.assignments.map((a) => a.wellId));
      if (on) ids.add(wellId); else ids.delete(wellId);
      return entryApi.put(`/admin/users/${user.id}`, { wellIds: [...ids] });
    },
    onSuccess: invalidate,
    onError: (e) => setError(String((e as Error).message)),
  });

  return (
    <div className="space-y-5 pb-6">
      {error && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</div>}

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">New company man</h3>
        <div className="flex flex-wrap gap-2">
          <input className={input} placeholder="User name" value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} />
          <input className={input} placeholder="Full name" value={nu.fullName} onChange={(e) => setNu({ ...nu, fullName: e.target.value })} />
          <input className={input} type="password" placeholder="Password (min 6)" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          <select className={input} value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
            <option value="companyman">Company man</option>
            <option value="admin">Admin</option>
          </select>
          <button className={btn} disabled={!nu.username.trim() || nu.password.length < 6}
            onClick={() => run(async () => {
              await entryApi.post("/admin/users", nu);
              setNu({ username: "", fullName: "", password: "", role: "companyman" });
            })}>Create user</button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1">The account must change this password at first sign-in.</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Users · tick the wells each one may report on</h3>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600 sticky left-0">User</th>
                <th className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">Role</th>
                <th className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">Active</th>
                {(wellsQ.data ?? []).map((w) => (
                  <th key={w.id} className="bg-gray-100 border border-gray-200 px-2 py-1 font-medium text-gray-600 whitespace-nowrap">
                    {w.name}<div className="font-normal text-[10px] text-gray-400">{w.rig?.name}</div>
                  </th>
                ))}
                <th className="bg-gray-100 border border-gray-200 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {(usersQ.data ?? []).map((u) => {
                const assigned = new Set(u.assignments.map((a) => a.wellId));
                return (
                  <tr key={u.id} className={u.active ? "" : "text-gray-400"}>
                    <td className="border border-gray-200 px-2 py-1 whitespace-nowrap sticky left-0 bg-white">
                      <b>{u.username}</b><div className="text-[10px] text-gray-400">{u.fullName}</div>
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      <select className="text-xs bg-transparent" value={u.role}
                        onChange={(e) => run(() => entryApi.put(`/admin/users/${u.id}`, { role: e.target.value }))}>
                        <option value="companyman">company man</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center">
                      <input type="checkbox" checked={u.active}
                        onChange={(e) => run(() => entryApi.put(`/admin/users/${u.id}`, { active: e.target.checked }))} />
                    </td>
                    {(wellsQ.data ?? []).map((w) => (
                      <td key={w.id} className="border border-gray-200 px-2 py-1 text-center">
                        <input type="checkbox" checked={assigned.has(w.id)} disabled={u.role === "admin"}
                          title={u.role === "admin" ? "Admins can report on every well" : undefined}
                          onChange={(e) => toggle.mutate({ user: u, wellId: w.id, on: e.target.checked })} />
                      </td>
                    ))}
                    <td className="border border-gray-200 px-2 py-1 whitespace-nowrap">
                      <button className="text-blue-600 hover:underline mr-2"
                        onClick={() => {
                          const p = prompt(`New password for ${u.username} (min 6 characters):`);
                          if (p) void run(() => entryApi.put(`/admin/users/${u.id}`, { password: p }));
                        }}>reset password</button>
                      <button className="text-gray-400 hover:text-red-600"
                        onClick={() => { if (confirm(`Delete ${u.username}?`)) void run(() => entryApi.del(`/admin/users/${u.id}`)); }}>delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {wellsQ.data?.length === 0 && <p className="text-xs text-gray-400 mt-2">Register a rig and a well first — then the tick boxes appear here.</p>}
      </section>
    </div>
  );
}

// ── cross-well report overview ──────────────────────────────────────────────
interface OverviewRow {
  id: string; serialNo: number; reportDate: string; status: string; midnightDepth: number | null;
  updatedAt: string; submittedAt: string | null;
  well: { id: string; name: string; field: string | null; rig: { name: string } };
  user: { username: string; fullName: string };
}
function AllReports() {
  const q = useQuery({ queryKey: ["entry", "admin", "reports"], queryFn: () => entryApi.get<OverviewRow[]>("/admin/reports") });
  return (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr>{["Rig", "Well", "#", "Date", "Midnight depth", "Status", "Filed by", "Last saved"].map((h) => (
          <th key={h} className="bg-gray-100 border border-gray-200 px-2 py-1 text-left font-medium text-gray-600">{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {(q.data ?? []).map((r) => (
          <tr key={r.id}>
            <td className="border border-gray-200 px-2 py-1">{r.well.rig?.name}</td>
            <td className="border border-gray-200 px-2 py-1 font-medium">{r.well.name}</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{r.serialNo}</td>
            <td className="border border-gray-200 px-2 py-1 tabular-nums">{r.reportDate}</td>
            <td className="border border-gray-200 px-2 py-1 text-right tabular-nums">{r.midnightDepth ?? "—"}</td>
            <td className="border border-gray-200 px-2 py-1">
              <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${r.status === "submitted" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.status}</span>
            </td>
            <td className="border border-gray-200 px-2 py-1">{r.user.fullName}</td>
            <td className="border border-gray-200 px-2 py-1">{new Date(r.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
        {q.data?.length === 0 && <tr><td colSpan={8} className="border border-gray-200 px-2 py-3 text-center text-gray-400">No reports filed yet.</td></tr>}
      </tbody>
    </table>
  );
}
