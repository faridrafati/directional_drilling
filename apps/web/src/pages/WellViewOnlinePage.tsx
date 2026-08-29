/**
 * WellView Online — the Peloton desktop application rebuilt as a web page,
 * following the SASBU Master Training Guide chapter by chapter:
 *
 *   ch 1  Open Database  → pick one of the converted .sqlite databases
 *   ch 2  Quick Start    → open a well, edit data from a report
 *   ch 3  Well Explorer  → folders, groups, quick query, well list, toolbar;
 *         opened well    → Reports and Schematic tabs; Edit Data window
 *   §3.10 Data Auditor   → the §10.2 business rules
 *
 * The databases are the user's own WellView databases converted to SQLite
 * (sqlite_DB/wellview/); edits write back to those files, exactly as the
 * desktop app wrote to its .mdb. Signs in through the same /entry session as
 * the rest of the app.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EntryAuthProvider, useEntryAuth, SignInCard } from "../entry/auth.js";
import { wvDbApi } from "../entry/wellviewDb.js";
import { useUnitSet, UNIT_SETS, type UnitSet } from "../entry/unitSet.js";
import { useDatum } from "../entry/datum.js";
import { DATUMS, DATUM_LABELS, type Datum } from "@dd/shared";
import { WellExplorer } from "../components/wellview-online/WellExplorer.js";
import { WellWindow } from "../components/wellview-online/WellWindow.js";
import { MultiReports } from "../components/wellview-online/MultiReports.js";
import { EditData, type WvClipboard } from "../components/wellview-online/EditData.js";
import { DataAudit } from "../components/wellview-online/DataAudit.js";

export function WellViewOnlinePage() {
  return (
    <EntryAuthProvider>
      <Inner />
    </EntryAuthProvider>
  );
}

function Inner() {
  const { user, loading, signOut } = useEntryAuth();
  const [unitSet, setUnitSet] = useUnitSet();
  const [datum, setDatum] = useDatum();
  const [db, setDb] = useState<string | null>(null);
  // Peloton s own manifest: read once, and only when signed in, since the
  // route is behind the same guard as everything else here.
  const about = useQuery({
    queryKey: ["wvdb", "about"],
    queryFn: () => wvDbApi.about(),
    enabled: !!user,
    staleTime: Infinity,
  });
  const [openWell, setOpenWell] = useState<string | null>(null);
  const [edit, setEdit] = useState<{
    idwell: string;
    table: string | null;
    idrec?: string;
    column?: string | null;
    /** The Explorer selection this was opened on — the window can switch between them. */
    wells?: string[];
  } | null>(null);
  const [audit, setAudit] = useState<string[] | null>(null);
  const [multi, setMulti] = useState<string[] | null>(null);
  /** Copy Record / Paste Record buffer — survives closing one well and opening
   *  another, which is exactly what the manual's between-wells copy needs. */
  const [clipboard, setClipboard] = useState<WvClipboard | null>(null);

  // Well names for the title bars, fetched once per database.
  const wellsQ = useQuery({
    queryKey: ["wvdb", db, "wellnames"],
    queryFn: () => wvDbApi.wells(db!),
    enabled: !!user && !!db,
  });
  const nameOf = (idwell: string): string => {
    const w = wellsQ.data?.wells.find((x) => String(x.idwell) === idwell);
    return String(w?.WellName ?? idwell);
  };

  return (
    <div className="h-full flex flex-col p-3 sm:p-6">
      <div className="w-full max-w-[1700px] mx-auto flex flex-col flex-1 min-h-0">
        <div className="mb-3 shrink-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="border-l-[3px] border-amber-500 pl-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
              WellView
              {/*
                * The build the shipped material came from, out of Peloton’s own
                * manifest rather than typed here. The templates, data model,
                * units and icons all come from ONE package and are not
                * interchangeable between versions, so a user given a different
                * export can see at a glance that they no longer match.
                */}
              {about.data?.version && (
                <span className="ml-2 text-sm font-normal text-gray-400"
                  data-testid="wv-version"
                  title={about.data.packageId
                    ? `Templates, data model, units and icons from WellView package ${about.data.packageId}`
                    : undefined}>
                  {about.data.version}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              The WellView application online — Well Explorer, Edit Data, Reports, Schematic and the
              Data Auditor, over your converted WellView databases.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                Units
                <select value={unitSet} onChange={(e) => setUnitSet(e.target.value as UnitSet)}
                  data-testid="wv-unit-set"
                  title="Tools > Units — the set every number on screen is shown in (§4.2)"
                  className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white text-gray-800 normal-case tracking-normal">
                  {UNIT_SETS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
                Datum
                <select value={datum} onChange={(e) => setDatum(e.target.value as Datum)}
                  data-testid="wv-datum"
                  title="Tools > Reference Datum — the point every depth is measured from. Stored depths are relative to the original KB."
                  className="h-8 border border-gray-300 rounded-md px-1.5 text-xs bg-white text-gray-800 normal-case tracking-normal">
                  {DATUMS.map((d) => <option key={d} value={d}>{DATUM_LABELS[d]}</option>)}
                </select>
              </label>
              <span className="text-gray-600">
                {user.fullName} <span className="text-gray-400">({user.username})</span>
              </span>
              <button onClick={signOut}
                className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
                Sign out
              </button>
            </div>
          )}
        </div>

        {loading && <div className="text-sm text-gray-500">Signing in…</div>}
        {!loading && !user && <SignInCard />}

        {user && !db && <OpenDatabase onOpen={setDb} />}

        {user && db && !openWell && (
          <WellExplorer
            db={db}
            onOpen={setOpenWell}
            onEdit={(idwell, wells) => setEdit({ idwell, table: null, wells })}
            onAudit={(idwells) => setAudit(idwells)}
            onMultiReport={(idwells) => setMulti(idwells)}
            onChangeDatabase={() => { setDb(null); setOpenWell(null); }}
          />
        )}

        {user && db && openWell && (
          <WellWindow
            db={db}
            idwell={openWell}
            wellName={nameOf(openWell)}
            onClose={() => setOpenWell(null)}
            onEditTable={(table) => setEdit({ idwell: openWell, table })}
            onEditRecord={(table, idrec, column) =>
              setEdit({ idwell: openWell, table, idrec, column })}
          />
        )}

        {user && db && edit && (
          <EditData
            db={db}
            idwell={edit.idwell}
            wellName={nameOf(edit.idwell)}
            wells={(edit.wells ?? []).map((w) => ({ idwell: w, name: nameOf(w) }))}
            initialTable={edit.table}
            initialRecord={edit.idrec ?? null}
            initialColumn={edit.column ?? null}
            clipboard={clipboard}
            onClipboard={setClipboard}
            onClose={() => setEdit(null)}
          />
        )}

        {user && db && audit !== null && (
          <DataAudit
            db={db}
            wells={audit}
            onClose={() => setAudit(null)}
            onOpenRecord={(idwell, table) => { setAudit(null); setEdit({ idwell, table }); }}
          />
        )}

        {user && db && multi && (
          <MultiReports
            db={db}
            wells={multi}
            wellName={nameOf}
            onClose={() => setMulti(null)}
          />
        )}
      </div>
    </div>
  );
}

/** Chapter 1's Open Database window, for the converted .sqlite files. */
function OpenDatabase({ onOpen }: { onOpen: (id: string) => void }) {
  const q = useQuery({ queryKey: ["wvdb", "list"], queryFn: wvDbApi.databases });

  return (
    <div className="max-w-lg mx-auto w-full">
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-gray-900">Open Database</h3>
        <p className="text-[11px] text-gray-500 mt-0.5 mb-3">
          Your WellView databases, converted from Access to SQLite
          (<code className="text-gray-500">sqlite_DB/wellview/</code>). Edits write back to the file,
          as the desktop application wrote to its .mdb.
        </p>
        {q.isLoading && <div className="text-sm text-gray-400">Looking for databases…</div>}
        {q.error && ((q.error as { status?: number }).status === 403 ? (
          /* Not a failure the user can fix by retrying: the WellView databases
             are office-side data with no per-well assignment behind them, so
             the whole area is admin-only. Say that, rather than showing the
             bare "admin only" the API returns. */
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900">
            <b>This area is for office personnel.</b> The converted WellView databases hold every
            well in the asset and are not scoped to your well assignments, so access is limited to
            administrators. Your own reports are under <b>Daily Report Entry</b>.
          </div>
        ) : (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {(q.error as Error).message}
          </div>
        ))}
        {q.data?.length === 0 && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
            No converted database found. Convert the Access files first:{" "}
            <code>python3 scripts/mdb_to_sqlite.py</code>
          </div>
        )}
        <div className="space-y-2">
          {(q.data ?? []).map((d) => (
            <button key={d.id} type="button" onClick={() => onOpen(d.id)}
              data-testid={`wv-db-${d.id}`}
              className="w-full text-left px-3 py-2.5 rounded-md border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors duration-150 flex items-baseline gap-3">
              <span className="text-sm font-medium text-gray-900">{d.file}</span>
              <span className="text-[11px] text-gray-500 tabular-nums">
                {d.wells > 0 ? `${d.wells} wells` : "empty — WellView's blank template database"}
              </span>
              <span className="ml-auto text-[10px] text-gray-400 tabular-nums">
                {(d.sizeBytes / 1048576).toFixed(1)} MB
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
