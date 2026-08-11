/**
 * WellView's schematic COMPONENT ICONS — the symbols its wellbore pictures are
 * drawn from: packers, centralizers, bits, pumps, wellheads, lithology hatches.
 *
 * WellView ships them as `.emf`, a Windows vector format no browser can display.
 * `scripts/wellview-icons/` converts those to SVG and rasterises them; this
 * browses the result.
 *
 * The manifest records which icons came back essentially blank and which leaned
 * on EMF records the converter does not implement. Both are surfaced here rather
 * than left in a file nobody opens — an icon that silently arrived empty is
 * worse than one labelled as such.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface IconEntry {
  name: string;
  category: string;
  source: string;
  source_format: string;
  png: string;
  shapes?: number;
  blank?: boolean;
  converter_notes?: { skipped?: Record<string, number> };
}

interface IconManifest {
  count: number;
  icon_size_px: number;
  categories: Record<string, number>;
  skipped_pce_files: number;
  failures: { source: string; error: string }[];
  blank_renders: { name: string }[];
  partial_conversions: { name: string }[];
  icons: IconEntry[];
}

const BASE = "/wellview-icons";

export function IconBrowser() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");
  const [showBlank, setShowBlank] = useState(false);

  const manifestQ = useQuery({
    queryKey: ["wellview", "icons", "manifest"],
    queryFn: async (): Promise<IconManifest> => {
      const res = await fetch(`${BASE}/manifest.json`);
      if (!res.ok) {
        throw new Error(
          "The icon library has not been imported. Run "
          + "scripts/wellview-icons/import_icons.py.",
        );
      }
      return res.json();
    },
    staleTime: Infinity,
  });

  const shown = useMemo(() => {
    const all = manifestQ.data?.icons ?? [];
    const q = query.trim().toLowerCase();
    return all.filter(
      (i) =>
        (!category || i.category === category)
        && (showBlank || !i.blank)
        && (!q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)),
    );
  }, [manifestQ.data, query, category, showBlank]);

  if (manifestQ.isLoading) {
    return <div className="px-3 py-6 text-sm text-gray-400">Loading icons…</div>;
  }
  if (manifestQ.error) {
    return (
      <div className="mx-3 my-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
        {(manifestQ.error as Error).message}
      </div>
    );
  }

  const m = manifestQ.data!;
  const categories = Object.entries(m.categories).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <p className="text-[11px] text-gray-500 leading-snug px-1 pb-2 shrink-0">
        <strong>{m.count}</strong> WellView schematic component icons, converted from their
        binary <code className="font-mono">.emf</code> vector files at {m.icon_size_px}px.
        {" "}{m.skipped_pce_files} <code className="font-mono">.pce</code> files were skipped —
        Peloton metadata, not images.
        {m.blank_renders.length > 0 && (
          <>
            {" "}
            <span className="text-amber-700">
              {m.blank_renders.length} came out blank and {m.partial_conversions.length} use
              drawing records the converter does not implement; both are marked, not hidden.
            </span>
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2 px-1 pb-2 shrink-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          aria-label="Search icons"
          className="px-2 py-1.5 text-xs border border-gray-300 rounded w-56
                     focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Category"
          className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white"
        >
          <option value="">All categories ({m.count})</option>
          {categories.map(([c, n]) => (
            <option key={c} value={c}>{c} ({n})</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <input
            type="checkbox"
            className="accent-blue-600"
            checked={showBlank}
            onChange={(e) => setShowBlank(e.target.checked)}
          />
          Show blank renders
        </label>
        <span className="text-[11px] text-gray-400 tabular-nums ml-auto">
          {shown.length} shown
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg bg-white p-3">
        {shown.length === 0 ? (
          <div className="text-sm text-gray-400 px-2 py-6 text-center">Nothing matches that.</div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(104px,1fr))" }}>
            {shown.map((icon) => {
              // `{}` is truthy in JS, so testing the object alone marked every
              // icon partial. Only a non-empty skip list is a warning.
              const skipped = icon.converter_notes?.skipped ?? {};
              const skippedKeys = Object.keys(skipped);
              const note = skippedKeys.length
                ? `uses ${skippedKeys.join(", ")} — not fully converted`
                : undefined;
              return (
                <figure key={icon.png} className="m-0 text-center">
                  <div
                    className={`grid place-items-center h-24 rounded border bg-white
                      ${icon.blank ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}
                    title={`${icon.name}\n${icon.category}\nsource: ${icon.source}${note ? `\n${note}` : ""}`}
                  >
                    <img
                      src={`${BASE}/${icon.png}`}
                      alt={icon.name}
                      loading="lazy"
                      className="max-h-20 max-w-[88px]"
                    />
                  </div>
                  <figcaption className="mt-1 text-[9px] leading-tight text-gray-600 break-words">
                    {icon.name}
                    {icon.blank && <span className="block text-amber-700">blank render</span>}
                    {!icon.blank && note && <span className="block text-amber-600">partial</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
