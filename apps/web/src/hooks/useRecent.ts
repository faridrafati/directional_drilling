/**
 * Track recently-visited calculations and field maps so the sidebar can show
 * useful shortcuts. Persists in localStorage so it survives reloads.
 *
 * Two separate caps: 5 recent calcs + 5 recent maps. Newest first; opening
 * the same item again bumps it to the top without duplicating.
 */
import { useCallback, useEffect, useState } from "react";

const CALC_KEY = "recent:calculations";
const MAP_KEY = "recent:maps";
const LIMIT = 5;

export interface RecentItem {
  id: string;
  /** Display label — e.g. "Well-01 · Well Design". */
  label: string;
  /** Optional secondary label (e.g. project name) shown beneath. */
  context?: string;
  /** Unix-ms timestamp of last visit. */
  visitedAt: number;
}

function load(key: string): RecentItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(key: string, items: RecentItem[]) {
  localStorage.setItem(key, JSON.stringify(items.slice(0, LIMIT)));
  // Tell other tabs/components to refresh.
  window.dispatchEvent(new CustomEvent("recent-updated", { detail: key }));
}

function useRecentList(key: string) {
  const [items, setItems] = useState<RecentItem[]>(() => load(key));

  useEffect(() => {
    function refresh() { setItems(load(key)); }
    window.addEventListener("recent-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("recent-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [key]);

  const record = useCallback(
    (item: Omit<RecentItem, "visitedAt">) => {
      const now = Date.now();
      const next = [
        { ...item, visitedAt: now },
        ...load(key).filter((x) => x.id !== item.id),
      ];
      save(key, next);
      setItems(next.slice(0, LIMIT));
    },
    [key]
  );

  const clear = useCallback(() => {
    save(key, []);
    setItems([]);
  }, [key]);

  return { items, record, clear };
}

export const useRecentCalculations = () => useRecentList(CALC_KEY);
export const useRecentMaps = () => useRecentList(MAP_KEY);
