/**
 * Scopes the value-facets (bit sizes / mud types / materials / activity types)
 * to the wells the user has actually selected — so each dropdown only offers
 * values present in the chosen fields/wells, the same way the Wells facet already
 * narrows by Fields. Shared by every DDR sidebar (Tools, Mud Stock, Time
 * Analysis, Well Path, Formation, Mud Properties, ROP, Remarks search).
 *
 * Fetches /ddr/facet-options whenever the field/well selection changes. While
 * nothing is selected the endpoint returns null lists and we fall back to the
 * GLOBAL search-options lists (passed in), so the dropdowns are never empty
 * before a well is chosen. Scoped lists are a strict subset of the global ones,
 * so existing selections stay valid.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "../../api/client.js";

interface ScopedFacets {
  holeSizes: string[] | null;
  mudTypes: string[] | null;
  materials: string[] | null;
  activityTypes: string[] | null;
  formations: string[] | null;
}

export interface GlobalFacets {
  holeSizes?: string[];
  mudTypes?: string[];
  materials?: string[];
  activityTypes?: string[];
  formations?: string[];
}

export interface FacetOptions {
  holeSizes: string[];
  mudTypes: string[];
  materials: string[];
  activityTypes: string[];
  formations: string[];
}

/**
 * @param fields  selected field names
 * @param wells   selected well codes
 * @param global  the global search-options lists (the fallback when nothing is
 *                selected, and while the scoped fetch is in flight)
 */
export function useFacetOptions(fields: string[], wells: string[], global: GlobalFacets | undefined): FacetOptions {
  const enabled = fields.length > 0 || wells.length > 0;
  const q = useQuery({
    queryKey: ["ddr", "facet-options", fields, wells],
    queryFn: () => api.post<ScopedFacets>("/ddr/facet-options", { fields, wells }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const g: Required<GlobalFacets> = {
    holeSizes: global?.holeSizes ?? [],
    mudTypes: global?.mudTypes ?? [],
    materials: global?.materials ?? [],
    activityTypes: global?.activityTypes ?? [],
    formations: global?.formations ?? [],
  };

  // Use the scoped list when a selection is active and the fetch has returned a
  // (non-null) list; otherwise fall back to the global list. `??` (not `||`) is
  // deliberate: a scoped-but-empty list [] (selected wells genuinely have no
  // values for that facet) must stay empty, NOT fall back to the global list.
  const d = enabled ? q.data : undefined;
  const pick = (scopedList: string[] | null | undefined, globalList: string[]) =>
    scopedList ?? globalList;

  return {
    holeSizes: pick(d?.holeSizes, g.holeSizes),
    mudTypes: pick(d?.mudTypes, g.mudTypes),
    materials: pick(d?.materials, g.materials),
    activityTypes: pick(d?.activityTypes, g.activityTypes),
    formations: pick(d?.formations, g.formations),
  };
}
