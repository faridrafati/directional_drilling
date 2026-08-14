/**
 * WellView pick-lists for entry-form dropdowns.
 *
 * The values come from `public/wellview-picklists.json`, which is DERIVED from
 * the sample database (scripts/wellview-db/build_picklists.mjs) — NOT decrypted
 * from WellView's encrypted `custom/library/*.lib` files, which need Peloton's
 * password. Each library is BOUND to its table.column by WellView's own data
 * model (mdl.xml); the values are then those that actually occur in the sample
 * data, ordered most-common-first: a real, usable subset, never a full library.
 *
 * Consume it two ways, whichever a form has to hand:
 *   const cas = usePicklist("libcasdes");            // by library name
 *   const cas = usePicklistFor("wvCas", "Des");      // by table + column
 *
 * Both return `string[]` (empty until loaded, or when the sample never
 * populated that field). `usePicklistCatalog()` exposes the whole thing plus
 * the honest counts for anything that wants to show provenance.
 */
import { useQuery } from "@tanstack/react-query";

export interface PicklistValue { value: string; count: number }
export interface Picklist {
  /** e.g. "wvCas.Des" — the sample-DB column the values came from. */
  source: string;
  /** The field's long caption from the data model, e.g. "Casing Description". */
  caption: string;
  /** How the library was bound to its column: authoritative model, or fallback. */
  binding: "model" | "heuristic";
  /** true when the list has 3+ values (a worthwhile dropdown). */
  usable: boolean;
  count: number;
  values: PicklistValue[];
}
export interface PicklistCatalog {
  derivation: "sample-data";
  note: string;
  library_count: number;
  bound_by_model: number;
  bound_by_heuristic: number;
  usable: number;
  sparse: number;
  picklists: Record<string, Picklist>;
}

/** Loads and caches the catalog. It is a static asset, so fetch it once. */
export function usePicklistCatalog() {
  return useQuery({
    queryKey: ["wellview", "picklists"],
    queryFn: async (): Promise<PicklistCatalog> => {
      const res = await fetch("/wellview-picklists.json");
      if (!res.ok) throw new Error("pick-list catalog not found — run scripts/wellview-db/build_picklists.mjs");
      return res.json();
    },
    staleTime: Infinity,
  });
}

/** The values of one library (`libcasdes`), most-common-first; [] until loaded. */
export function usePicklist(library: string): string[] {
  const { data } = usePicklistCatalog();
  return data?.picklists[library]?.values.map((v) => v.value) ?? [];
}

/**
 * The values behind a `wv<Table>` + column, without needing to know the library
 * name — the resolver mirrors build_picklists.mjs (lib<table><column>).
 */
export function usePicklistFor(table: string, column: string): string[] {
  const { data } = usePicklistCatalog();
  if (!data) return [];
  const wanted = `${table}.${column}`.toLowerCase();
  for (const pl of Object.values(data.picklists)) {
    if (pl.source.toLowerCase() === wanted) return pl.values.map((v) => v.value);
  }
  return [];
}
