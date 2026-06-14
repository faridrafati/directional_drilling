/**
 * Shared DDR sidebar selection — so the facet picks (Fields, Wells, Bit sizes,
 * Mud types) and the date range PERSIST when the user switches tabs. Each tab used
 * to keep these in its own local state, so the selection was lost on every tab
 * change. They now live in one context provided once above the tab content (which
 * stays mounted across tab switches), and every tab reads/writes the same store.
 *
 * Materials (Mud Stock) and activity types (Time Analysis) are tab-specific facets
 * but are kept here too so those picks survive a tab switch as well. Each tab still
 * only OFFERS the values that have data on that tab (via useFacetOptions / its own
 * options endpoint) and only sends the relevant facets to its own query — a
 * selection that has no data on a tab is simply ignored there, not lost.
 */
import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type StrList = string[];
type SetStr = Dispatch<SetStateAction<string>>;
type SetList = Dispatch<SetStateAction<StrList>>;

export interface DdrSelection {
  fields: StrList; setFields: SetList;
  wells: StrList; setWells: SetList;
  holeSizes: StrList; setHoleSizes: SetList;
  mudTypes: StrList; setMudTypes: SetList;
  materials: StrList; setMaterials: SetList;
  activityTypes: StrList; setActivityTypes: SetList;
  dateFrom: string; setDateFrom: SetStr;
  dateTo: string; setDateTo: SetStr;
  /** Reset every shared facet + the date range (the sidebar "Clear" action). */
  clearShared: () => void;
}

const Ctx = createContext<DdrSelection | null>(null);

export function DdrSelectionProvider({ children }: { children: ReactNode }) {
  const [fields, setFields] = useState<StrList>([]);
  const [wells, setWells] = useState<StrList>([]);
  const [holeSizes, setHoleSizes] = useState<StrList>([]);
  const [mudTypes, setMudTypes] = useState<StrList>([]);
  const [materials, setMaterials] = useState<StrList>([]);
  const [activityTypes, setActivityTypes] = useState<StrList>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const value = useMemo<DdrSelection>(() => ({
    fields, setFields, wells, setWells, holeSizes, setHoleSizes, mudTypes, setMudTypes,
    materials, setMaterials, activityTypes, setActivityTypes, dateFrom, setDateFrom, dateTo, setDateTo,
    clearShared: () => { setFields([]); setWells([]); setHoleSizes([]); setMudTypes([]); setMaterials([]); setActivityTypes([]); setDateFrom(""); setDateTo(""); },
  }), [fields, wells, holeSizes, mudTypes, materials, activityTypes, dateFrom, dateTo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDdrSelection(): DdrSelection {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDdrSelection must be used within a DdrSelectionProvider");
  return v;
}
