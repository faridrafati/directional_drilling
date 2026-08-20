/**
 * Mud Inventory Transfer (§5.1, Add-ins > Utilities).
 *
 * "Transfer the closing balance of all bulk materials such as diesel and
 * potable water (job supplies) and mud additives (such as barite or detergents)
 * from the previous well to the newly created well." The stock left on the pad
 * when one well finishes is the stock the next one starts with.
 *
 * The balances are shown before anything moves, INCLUDING the ones that cannot
 * move: in the sample database most products come out negative, because
 * consumption was recorded against a receipt nobody entered. Hiding those would
 * make the utility look like it found nothing; showing them with the reason
 * points at the data that needs fixing.
 *
 * The date matters and is asked for rather than assumed — it decides which
 * daily report the received stock appears on, which is the whole point of doing
 * the transfer on the day the rig arrives.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { wvDbApi, type WvInventoryItem } from "../../entry/wellviewDb.js";

interface Props {
  db: string;
  /** The well receiving the stock. */
  toWell: string;
  toWellName: string;
  onClose: () => void;
}

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function InventoryTransfer({ db, toWell, toWellName, onClose }: Props) {
  const qc = useQueryClient();
  const [fromWell, setFromWell] = useState("");
  const [toJob, setToJob] = useState("");
  const [dtTm, setDtTm] = useState(() => `${new Date().toISOString().slice(0, 16)}`);
  const [picked, setPicked] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const wellsQ = useQuery({ queryKey: ["wvdb", db, "wells"], queryFn: () => wvDbApi.wells(db) });
  const jobsQ = useQuery({
    queryKey: ["wvdb", db, "records", "wvJob", toWell, null, false],
    queryFn: () => wvDbApi.records(db, "wvJob", { idwell: toWell }),
  });
  const invQ = useQuery({
    queryKey: ["wvdb", db, "inventory", fromWell],
    queryFn: () => wvDbApi.inventory(db, fromWell),
    enabled: !!fromWell,
  });

  const items = invQ.data?.items ?? [];
  const movable = useMemo(() => items.filter((i) => i.transferable), [items]);
  const stuck = useMemo(() => items.filter((i) => !i.transferable), [items]);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await wvDbApi.transferInventory(db, {
        fromWell, toWell, toJob,
        dtTm: `${dtTm.length === 16 ? `${dtTm}:00` : dtTm}Z`.replace(/Z+$/, "Z"),
        items: picked,
      });
      const bits = [
        `Transferred ${res.transferred.length} product${res.transferred.length === 1 ? "" : "s"}.`,
        res.createdProducts ? `${res.createdProducts} added to the job.` : "",
        res.reusedProducts ? `${res.reusedProducts} added to stock already there.` : "",
        res.skipped.length ? `${res.skipped.length} skipped.` : "",
      ].filter(Boolean);
      setResult(bits.join(" "));
      await qc.invalidateQueries({ queryKey: ["wvdb", db] });
    } catch (e) {
      setResult((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const row = (i: WvInventoryItem, on: boolean) => (
    <li key={i.idrec}>
      <label className={`flex items-center gap-2 px-2 py-1 text-xs ${on ? "hover:bg-gray-50 cursor-pointer" : "text-gray-400"}`}>
        <input type="checkbox" data-testid="wv-inv-pick" disabled={!on}
          checked={picked.includes(i.idrec)}
          onChange={() => setPicked((p) => p.includes(i.idrec) ? p.filter((x) => x !== i.idrec) : [...p, i.idrec])} />
        <span className="flex-1 truncate">{i.des ?? "—"}</span>
        <span className="text-[10px] uppercase text-gray-400">{i.kind}</span>
        <span className="tabular-nums">{qty(i.balance)} {i.unitLabel ?? ""}</span>
      </label>
      {!on && i.reason && <p className="px-8 pb-1 text-[10px] text-amber-700">{i.reason}</p>}
    </li>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full h-full max-w-3xl mx-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-3 py-2 bg-gray-800 text-white flex items-center gap-3 shrink-0">
          <span className="text-sm font-semibold">Mud Inventory Transfer</span>
          <span className="text-xs text-gray-300 truncate">into {toWellName}</span>
          <button type="button" onClick={onClose} data-testid="wv-inv-close"
            className="ml-auto h-7 px-3 text-[11px] rounded bg-gray-700 hover:bg-gray-600">Close</button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          <p className="text-[11px] text-gray-500">
            Carries the closing balance of mud additives and job supplies from the previous well
            onto a job here, as stock received on the date you choose — the date decides which
            daily report it appears on.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-[11px] text-gray-600">
              Previous well
              <select value={fromWell} onChange={(e) => { setFromWell(e.target.value); setPicked([]); }}
                data-testid="wv-inv-from"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-1 text-xs bg-white">
                <option value="">Choose…</option>
                {(wellsQ.data?.wells ?? [])
                  .filter((w) => String(w.idwell) !== toWell)
                  .map((w) => (
                    <option key={String(w.idwell)} value={String(w.idwell)}>
                      {String(w.WellName ?? w.idwell)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-[11px] text-gray-600">
              Onto job
              <select value={toJob} onChange={(e) => setToJob(e.target.value)} data-testid="wv-inv-job"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-1 text-xs bg-white">
                <option value="">Choose…</option>
                {(jobsQ.data?.rows ?? []).map((r) => (
                  <option key={String(r.IDRec)} value={String(r.IDRec)}>
                    {String(r.JobTyp ?? r.DtTmStart ?? r.IDRec).slice(0, 40)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] text-gray-600">
              Date received
              <input type="datetime-local" value={dtTm} onChange={(e) => setDtTm(e.target.value)}
                data-testid="wv-inv-date"
                className="mt-0.5 w-full h-8 border border-gray-300 rounded px-1 text-xs" />
            </label>
          </div>

          {invQ.isLoading && <p className="text-xs text-gray-400">Reading the previous well…</p>}
          {!!fromWell && !invQ.isLoading && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-800">
                  {movable.length} product{movable.length === 1 ? "" : "s"} with stock to carry
                </span>
                <button type="button" onClick={() => setPicked(movable.map((i) => i.idrec))}
                  className="h-6 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">Select all</button>
                <button type="button" onClick={() => setPicked([])}
                  className="h-6 px-2 text-[11px] rounded border border-gray-300 hover:bg-gray-50">None</button>
              </div>
              <ul className="border border-gray-200 rounded divide-y divide-gray-100 max-h-64 overflow-auto">
                {movable.map((i) => row(i, true))}
                {movable.length === 0 && (
                  <li className="px-2 py-2 text-xs text-gray-500">Nothing with a positive balance.</li>
                )}
              </ul>

              {stuck.length > 0 && (
                <details className="border border-amber-200 bg-amber-50 rounded">
                  <summary className="px-2 py-1 text-[11px] text-amber-900 cursor-pointer">
                    {stuck.length} product{stuck.length === 1 ? "" : "s"} cannot be carried — why
                  </summary>
                  <ul className="divide-y divide-amber-100">{stuck.map((i) => row(i, false))}</ul>
                </details>
              )}
            </>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button type="button" onClick={() => void run()} data-testid="wv-inv-run"
              disabled={busy || !fromWell || !toJob || picked.length === 0}
              className="h-8 px-4 text-xs rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40">
              {busy ? "Transferring…" : `Transfer ${picked.length || ""}`.trim()}
            </button>
            {result && <span className="text-[11px] text-gray-700" data-testid="wv-inv-result">{result}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
