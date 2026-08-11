/**
 * The ORIGINAL WellView report templates, browsable beside the 30 we build.
 *
 * WellView keeps its report layouts in a proprietary binary format (`*.afr`).
 * `scripts/wellview-afr/` reads those and renders each as a standalone HTML
 * page under `public/wellview-templates/`; this browses them.
 *
 * WHY AN IFRAME
 * -------------
 * Each export is a COMPLETE document with its own `@page` size, margins, fonts
 * and colours parsed out of that particular .afr — a letter-portrait report and
 * a tabloid-landscape one carry different page CSS. Inlining them would mean
 * either dropping that styling or letting one template's rules leak into the
 * next. An iframe keeps each page exactly as it was generated, which is the
 * whole point of having it: this is a reference view of what WellView prints.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

/** The slice of reports.json this browser needs. */
interface TemplateEntry {
  name: string;
  html: string;
  folder_relative: string;
  paper: string;
  parent_template: string;
  root_table: string | null;
  blocks: { table: string; title: string | null; printed_field_count: number }[];
  warnings: string[];
}

interface TemplateIndex {
  report_count: number;
  failures: { path: string; error: string }[];
  reports: TemplateEntry[];
}

const BASE = "/wellview-templates";

export function TemplateBrowser() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const indexQ = useQuery({
    queryKey: ["wellview", "templates", "index"],
    queryFn: async (): Promise<TemplateIndex> => {
      const res = await fetch(`${BASE}/reports.json`);
      if (!res.ok) {
        throw new Error(
          "The exported templates are not present. Generate them with "
          + "scripts/wellview-afr/afr_export.py.",
        );
      }
      return res.json();
    },
    staleTime: Infinity,
  });

  const groups = useMemo(() => {
    const reports = indexQ.data?.reports ?? [];
    const q = query.trim().toLowerCase();
    const matched = q
      ? reports.filter(
        (r) =>
          r.name.toLowerCase().includes(q)
            || r.folder_relative.toLowerCase().includes(q)
            || (r.root_table ?? "").toLowerCase().includes(q)
            || r.blocks.some((b) => b.table.toLowerCase().includes(q)),
      )
      : reports;
    // Grouped by WellView's own category, which is the first path segment.
    const out = new Map<string, TemplateEntry[]>();
    for (const r of matched) {
      const category = r.folder_relative.split("/")[0] || "(root)";
      const list = out.get(category) ?? [];
      list.push(r);
      out.set(category, list);
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [indexQ.data, query]);

  const current = useMemo(
    () => indexQ.data?.reports.find((r) => r.html === selected) ?? null,
    [indexQ.data, selected],
  );

  if (indexQ.isLoading) {
    return <div className="px-3 py-6 text-sm text-gray-400">Loading templates…</div>;
  }
  if (indexQ.error) {
    return (
      <div className="mx-3 my-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
        {(indexQ.error as Error).message}
      </div>
    );
  }

  const total = indexQ.data?.report_count ?? 0;
  const failures = indexQ.data?.failures ?? [];
  const shown = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-1 pb-2 shrink-0">
        <p className="text-[11px] text-gray-500 leading-snug">
          The <strong>{total}</strong> original Peloton WellView report templates, read out of
          their binary <code className="font-mono">.afr</code> files. Structure — blocks, fields,
          widths, link conditions — is extracted; field labels are interpreted from WellView
          naming, and all data values are fictional.
          {failures.length > 0 && (
            <>
              {" "}
              <span className="text-amber-700">
                {failures.length} file{failures.length === 1 ? "" : "s"} could not be parsed and
                {failures.length === 1 ? " is" : " are"} listed, not guessed at.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <aside className="w-72 shrink-0 flex flex-col min-h-0 border border-gray-200 rounded-lg bg-white">
          <div className="p-2 border-b border-gray-100">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, category or table…"
              aria-label="Search templates"
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded
                         focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="mt-1 text-[10px] text-gray-400 tabular-nums">
              {shown} of {total} shown
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-1">
            {groups.length === 0 && (
              <div className="px-2 py-3 text-[11px] text-gray-400">Nothing matches that.</div>
            )}
            {groups.map(([category, list]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {category}
                  <span className="ml-1 font-normal text-gray-400 tabular-nums">{list.length}</span>
                </div>
                {list.map((r) => (
                  <button
                    key={r.html}
                    type="button"
                    onClick={() => setSelected(r.html)}
                    title={`${r.folder_relative} · ${r.paper}`}
                    className={`w-full text-left px-2 py-1 rounded text-[11px] leading-snug
                      ${r.html === selected
                        ? "bg-blue-50 text-blue-800 font-medium"
                        : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    {r.name}
                    <span className="block text-[9px] text-gray-400">
                      {r.blocks.length} block{r.blocks.length === 1 ? "" : "s"} · {r.paper}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col border border-gray-200 rounded-lg bg-white">
          {current === null ? (
            <div className="flex-1 grid place-items-center text-sm text-gray-400 px-6 text-center">
              Pick a template to see how WellView lays it out.
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-100 flex items-baseline gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-900">{current.name}</h3>
                <span className="text-[10px] text-gray-500">
                  {current.folder_relative} · {current.paper}
                  {current.parent_template ? ` · master: ${current.parent_template}` : ""}
                  {current.root_table ? ` · root: ${current.root_table}` : ""}
                </span>
                <a
                  href={`${BASE}/${current.html.split("/").map(encodeURIComponent).join("/")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[11px] text-blue-700 hover:underline"
                >
                  Open in a new tab ↗
                </a>
              </div>
              {current.warnings.length > 0 && (
                <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-[10px] text-amber-800">
                  {current.warnings.join(" · ")}
                </div>
              )}
              <iframe
                key={current.html}
                title={`${current.name} — WellView template`}
                src={`${BASE}/${current.html.split("/").map(encodeURIComponent).join("/")}`}
                className="flex-1 w-full border-0 bg-gray-100"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
