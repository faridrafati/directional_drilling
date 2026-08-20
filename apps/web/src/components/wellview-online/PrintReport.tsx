/**
 * Printing a report — chapter 9's Print Range.
 *
 * The guide's own example is the one that matters: "If a BHA report has 10
 * assemblies, users can print all of the assemblies, or select specific
 * assemblies to print." So a print range here is not a page count, it is a
 * choice of RECORDS: which jobs, or which daily reports, the template is run
 * for. The screen shows one at a time; a printed report is the run of them.
 *
 * The layout is deliberately its own rather than the on-screen report reused.
 * Print wants black on white, no toolbars, no zoom, a heading that repeats the
 * well and the record on every sheet, and a page break between records — none
 * of which the interactive view should carry.
 *
 * Records are fetched ONE AT A TIME and the progress is shown. A report over
 * forty daily reports is forty round trips, and firing them at once would stall
 * the browser and give the user nothing to look at while it did.
 */
import { useEffect, useRef, useState } from "react";
import { entryApi } from "../../entry/client.js";
import { wvDbApi } from "../../entry/wellviewDb.js";
import { useUnitSet } from "../../entry/unitSet.js";
import { useDatumShift } from "../../entry/datum.js";
import { toDisplay, formatUnitValue, displayUnitFor, type UnitFormat } from "@dd/shared";

interface Block {
  table: string | null; title: string | null; exists: boolean; computed: boolean;
  derived?: boolean; contentOnly?: boolean;
  columns?: { column: string; label: string; unit?: string; units?: Record<string, UnitFormat>;
              applyDatum?: boolean; datumMode?: "up" | "invariant" }[];
  rows?: (string | number | null)[][];
  rowCount?: number; missing?: string[];
}
interface Sheet { key: string; caption: string; blocks: Block[] }

interface Props {
  db: string;
  idwell: string;
  wellName: string;
  html: string;
  reportName: string;
  /** The anchor level this template is scoped by, if any. */
  level: { table: string; label: string } | null;
  /** Every record at that level, in the order the toolbar lists them. */
  records: { idrec: string; caption: string }[];
  /** Pre-selected: whatever the user was looking at. */
  initial: string[];
  onClose: () => void;
}

export function PrintReport({
  db, idwell, wellName, html, reportName, level, records, initial, onClose,
}: Props) {
  const [unitSet] = useUnitSet();
  const { shift: datumShift } = useDatumShift(db, idwell);
  const [picked, setPicked] = useState<string[]>(initial.length ? initial : records.map((r) => r.idrec));
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  /**
   * Stop building if the dialog closes mid-run.
   *
   * Reset on mount as well as set on unmount: StrictMode mounts, cleans up and
   * remounts in development, so a flag only ever set by the cleanup stays true
   * for the component's whole life and every build returns on its first record
   * — silently, because nothing threw.
   */
  const cancelled = useRef(false);
  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const [error, setError] = useState<string | null>(null);

  const build = async () => {
    setError(null);
    const order = records.filter((r) => picked.includes(r.idrec));
    const wanted = level && order.length ? order : [{ idrec: "", caption: wellName }];
    const out: Sheet[] = [];
    try {
      for (let i = 0; i < wanted.length; i++) {
        if (cancelled.current) return;
        const r = wanted[i];
        setProgress(`Building ${i + 1} of ${wanted.length}…`);
        const anchor = level && r.idrec ? { table: level.table, idrec: r.idrec } : null;
        const data = await entryApi.get<{ blocks: Block[] }>(
          wvDbApi.templateDataPath(db, html, idwell, anchor));
        out.push({ key: r.idrec || "well", caption: r.caption, blocks: data.blocks ?? [] });
      }
    } catch (e) {
      // Without this the button sat on "Building 1 of 2…" for ever: an
      // unhandled rejection leaves the progress state set and says nothing.
      setProgress(null);
      setError((e as Error).message);
      return;
    }
    setProgress(null);
    setSheets(out);
    // Let the sheets paint before handing over to the print dialog.
    setTimeout(() => window.print(), 250);
  };

  const cell = (v: string | number | null, c: NonNullable<Block["columns"]>[number]) => {
    if (v == null || v === "") return "";
    const n = Number(v);
    if (c.unit && Number.isFinite(n)) {
      const d = toDisplay(n, c, unitSet, datumShift);
      if (d) return formatUnitValue(d.value, d);
    }
    const m = String(v).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}Z$/);
    return m ? (m[2] === "00:00" ? m[1] : `${m[1]} ${m[2]}`) : String(v);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6 print:static print:bg-white print:p-0"
      onClick={sheets ? undefined : onClose}>
      <style>{`
        @media print {
          /* Only the sheets print: the app chrome and this dialog's controls
             are screen furniture. */
          body > *:not(#wv-print-root) { display: none !important; }
          #wv-print-controls { display: none !important; }
          #wv-print-root { position: static !important; }
          .wv-sheet { break-after: page; page-break-after: always; }
          .wv-sheet:last-child { break-after: auto; page-break-after: auto; }
          .wv-sheet table { border-collapse: collapse; width: 100%; }
          .wv-sheet th, .wv-sheet td { border: 1px solid #999; padding: 2px 4px; font-size: 9pt; }
          .wv-sheet thead { display: table-header-group; }
        }
        @page { margin: 12mm; }
      `}</style>

      <div id="wv-print-root"
        className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full flex flex-col overflow-hidden print:border-0 print:shadow-none print:rounded-none"
        onClick={(e) => e.stopPropagation()}>

        <div id="wv-print-controls" className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">Print</span>
          <span className="text-xs text-gray-300 truncate">{reportName} — {wellName}</span>
          {sheets && (
            <button type="button" onClick={() => window.print()} data-testid="wv-print-again"
              className="ml-auto h-7 px-3 text-[11px] rounded bg-blue-600 hover:bg-blue-500">Print again</button>
          )}
          <button type="button" onClick={onClose} data-testid="wv-print-close"
            className={`${sheets ? "" : "ml-auto"} h-7 px-3 text-[11px] rounded bg-gray-700 hover:bg-gray-600`}>Close</button>
        </div>

        {!sheets ? (
          <div id="wv-print-controls" className="flex-1 min-h-0 overflow-auto p-4">
            {!level || records.length === 0 ? (
              <p className="text-sm text-gray-600">
                This report is not broken down by job or day, so there is one to print.
              </p>
            ) : (
              <>
                <p className="text-sm text-gray-800 font-medium">
                  Which {level.label.toLowerCase()}s to print
                </p>
                <p className="text-[11px] text-gray-500 mb-2">
                  The report is produced once per record, one after another — the guide's
                  &ldquo;all of the assemblies, or select specific assemblies&rdquo;.
                </p>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setPicked(records.map((r) => r.idrec))}
                    className="h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">Select all</button>
                  <button type="button" onClick={() => setPicked([])}
                    className="h-7 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">Select none</button>
                  <span className="text-[11px] text-gray-500 self-center">{picked.length} of {records.length}</span>
                </div>
                <ul className="border border-gray-200 rounded divide-y divide-gray-100 max-h-80 overflow-auto">
                  {records.map((r) => (
                    <li key={r.idrec}>
                      <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-gray-50 cursor-pointer">
                        <input type="checkbox" data-testid="wv-print-pick"
                          checked={picked.includes(r.idrec)} onChange={() => toggle(r.idrec)} />
                        {r.caption}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => void build()} data-testid="wv-print-build"
                disabled={!!progress || (!!level && records.length > 0 && picked.length === 0)}
                className="h-8 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
                {progress ?? "Prepare for printing"}
              </button>
              {!!level && picked.length === 0 && records.length > 0 && (
                <span className="text-[11px] text-gray-500">Nothing selected.</span>
              )}
              {error && <span className="text-[11px] text-red-700">{error}</span>}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto bg-gray-100 print:bg-white print:overflow-visible p-4 print:p-0">
            {sheets.map((s) => (
              <section key={s.key}
                className="wv-sheet bg-white mx-auto mb-4 p-6 shadow print:shadow-none print:mb-0 print:p-0"
                style={{ maxWidth: "210mm" }} data-testid="wv-print-sheet">
                <header className="mb-3 border-b border-gray-300 pb-1">
                  <h1 className="text-base font-semibold text-gray-900">{reportName}</h1>
                  <p className="text-[11px] text-gray-600">{wellName}{s.caption !== wellName ? ` · ${s.caption}` : ""}</p>
                </header>
                {s.blocks.map((b, i) => (
                  <div key={`${b.table}-${i}`} className="mb-3">
                    <h2 className="text-[11px] font-semibold text-gray-800 border-b border-gray-200">
                      {b.title || b.table}
                    </h2>
                    {!b.columns?.length || !b.rows?.length ? (
                      <p className="text-[10px] text-gray-500 italic">
                        {b.contentOnly ? "Content drawn by the template."
                          : b.computed && !b.derived ? "Computed by WellView at print time."
                          : "No rows."}
                      </p>
                    ) : (
                      <table className="w-full text-[10px] border-collapse">
                        <thead>
                          <tr>
                            {b.columns.map((c) => (
                              <th key={c.column} className="text-left font-medium border border-gray-300 px-1">
                                {c.label}{c.unit ? ` (${displayUnitFor(c, unitSet)?.unit ?? c.unit})` : ""}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {b.rows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((v, ci) => (
                                <td key={ci} className="border border-gray-300 px-1">{cell(v, b.columns![ci])}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
