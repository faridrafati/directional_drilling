/**
 * The chosen reference datum (Tools > Reference Datum).
 *
 * The sibling of `unitSet.ts`, and deliberately the same shape: a per-user
 * choice, persisted, broadcast to every open screen so none is left half
 * re-referenced. It says WHICH point depths are shown from; the elevations that
 * turn that into an offset belong to the WELL and are fetched per well.
 *
 * Default is the original KB, which is what the database stores against — so
 * the app opens showing exactly what is in the file, and any other reading is
 * something the user asked for.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DATUMS, datumShift, type Datum } from "@dd/shared";
import { wvDbApi } from "./wellviewDb.js";

const KEY = "wv.online.datum";
const DEFAULT: Datum = "OrigKB";
/*
 * Read from the shared list, never re-typed here. A hand-copied whitelist that
 * had fallen one entry behind is exactly what dropped SeaLevel: the picker
 * offered it, the choice persisted, and the next page load silently rejected it
 * and reverted to the original KB — so a user reading depths from sea level got
 * KB depths back without being told.
 */
const VALID: readonly string[] = DATUMS;

const listeners = new Set<(d: Datum) => void>();
let current: Datum = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return VALID.includes(v ?? "") ? (v as Datum) : DEFAULT;
  } catch { return DEFAULT; }
})();

export function getDatum(): Datum { return current; }

export function setDatum(next: Datum): void {
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  for (const l of listeners) l(next);
}

export function useDatum(): [Datum, (d: Datum) => void] {
  const [d, setLocal] = useState<Datum>(current);
  useEffect(() => {
    const fn = (x: Datum) => setLocal(x);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return [d, setDatum];
}

/**
 * The offset for one well, ready to hand to `toDisplay`.
 *
 * The choice of datum is per user; the elevations that turn it into metres
 * belong to the WELL, so this pairs them. Returns null while the elevations are
 * still loading, which keeps a grid from briefly rendering unshifted depths
 * under a shifted heading.
 */
export function useDatumShift(db: string | null, idwell: string | null) {
  const [datum] = useDatum();
  const q = useQuery({
    queryKey: ["wvdb", db, "elevations", idwell],
    queryFn: () => wvDbApi.elevations(db!, idwell!),
    enabled: !!db && !!idwell,
    staleTime: 5 * 60 * 1000,
  });
  const shift = useMemo(() => {
    if (datum === "OrigKB") return datumShift({}, "OrigKB");
    if (!q.data) return null;
    return datumShift(q.data.elevations, datum);
  }, [datum, q.data]);
  return { datum, shift, loading: q.isLoading };
}
