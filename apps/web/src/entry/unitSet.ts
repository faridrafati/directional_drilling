/**
 * The chosen unit set (§4.2 "Select Units of Measure" / Tools > Units).
 *
 * WellView offers four — US, Metric, EU, Mixed — and the data model names, per
 * field, the unit and decimals each set displays. The choice is per user and
 * survives a reload, which is what the desktop does ("WellView will save the
 * profile setting upon exiting").
 *
 * Stored values are never touched: this only decides how a number is rendered
 * and how a typed one is read back.
 */
import { useEffect, useState } from "react";

export const UNIT_SETS = ["US", "Metric", "EU", "Mixed"] as const;
export type UnitSet = (typeof UNIT_SETS)[number];

const KEY = "wv.online.unitSet";
/** The model's own default: the sample databases store metric base units. */
const DEFAULT: UnitSet = "Metric";

const listeners = new Set<(u: UnitSet) => void>();
let current: UnitSet = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return (UNIT_SETS as readonly string[]).includes(v ?? "") ? (v as UnitSet) : DEFAULT;
  } catch { return DEFAULT; }
})();

export function getUnitSet(): UnitSet { return current; }

export function setUnitSet(next: UnitSet): void {
  current = next;
  try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
  // Every open grid re-renders: a half-switched screen, where one table is in
  // feet and the next still in metres, is worse than not switching at all.
  for (const l of listeners) l(next);
}

/** Subscribe to the choice; every surface that prints a number uses this. */
export function useUnitSet(): [UnitSet, (u: UnitSet) => void] {
  const [set, setLocal] = useState<UnitSet>(current);
  useEffect(() => {
    const fn = (u: UnitSet) => setLocal(u);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return [set, setUnitSet];
}
