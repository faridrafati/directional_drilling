import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type ProjectSummary, type ProjectDetail } from "../api/client.js";
import { useRecentCalculations, useRecentMaps, type RecentItem } from "../hooks/useRecent.js";

interface Props { children: ReactNode }

export function AppShell({ children }: Props) {
  const calcs = useRecentCalculations();
  const maps = useRecentMaps();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the drawer when navigating (mobile UX).
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="h-full md:grid md:grid-cols-[260px_1fr] flex flex-col">
      {/* Mobile header — only visible below md */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 bg-white/95 backdrop-blur border-b border-gray-200 px-3 py-2.5">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="-ml-1 p-2 rounded-md hover:bg-gray-100 active:bg-gray-200"
        >
          <HamburgerIcon />
        </button>
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          Directional Drilling
        </h1>
        <span className="w-8" />
      </header>

      {/* Sidebar — full overlay on mobile, persistent on desktop */}
      <Sidebar
        open={open}
        onClose={() => setOpen(false)}
        calcs={calcs.items}
        maps={maps.items}
      />

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}

function Sidebar({
  open, onClose, calcs, maps,
}: {
  open: boolean;
  onClose: () => void;
  calcs: RecentItem[];
  maps: RecentItem[];
}) {
  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in"
        />
      )}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 md:w-auto
          bg-white border-r border-gray-200
          flex flex-col gap-1 overflow-y-auto
          transform transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          md:h-full p-3
        `}
      >
        <div className="px-2 py-3 border-b border-gray-200 mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">
              Directional Drilling
            </h1>
            <p className="text-xs text-gray-500">v0.6 — Phase 6</p>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded hover:bg-gray-100"
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <Nav to="/projects" label="Projects" />

        <ProjectTree />

        <RecentSection
          title="Recent calculations"
          items={calcs}
          emptyHint="Open any well's calculation to see it here."
          toPath={(it) => `/calculations/${it.id}`}
        />

        <RecentSection
          title="Recent maps"
          items={maps}
          emptyHint="Open a field's Maps page to see it here."
          toPath={(it) => `/fields/${it.id}/maps`}
        />

        <div className="mt-auto pt-4 px-2 text-xs text-gray-400 leading-relaxed">
          Tip: the 3D viewer lives inside each Calculation and Field-Map page as a tab.
        </div>
      </aside>
    </>
  );
}

function Nav({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `px-3 py-2.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

/**
 * Collapsible tree of every project → country → field → well → calculation
 * in the sidebar above "Recent calculations". Engineers who manage many
 * wells benefit from a global view they don't have to navigate into the
 * Projects page to see.
 *
 * Data strategy:
 *   - The project list itself is always fetched (small, single endpoint).
 *   - Each project's nested tree is fetched ONLY when the user expands
 *     that project (lazy via useQuery `enabled: open[id]`). This keeps
 *     a fresh-load with 50 projects from blasting the API on mount.
 *   - Expanded state lives in localStorage so the user's view survives
 *     page reloads.
 *
 * The leaf rows show "<type> · <calcName>" — e.g. "WellDesign · test"
 * with the parent breadcrumb shown small below ("country / field / well").
 */
function ProjectTree() {
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<ProjectSummary[]>("/projects"),
  });

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("dd:projectTreeOpen") ?? "{}"); }
    catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("dd:projectTreeOpen", JSON.stringify(open)); }
    catch { /* noop */ }
  }, [open]);

  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-3 mb-1 px-3">
        Projects tree
      </div>
      {isLoading && (
        <p className="px-3 py-1 text-xs text-gray-400 italic">Loading…</p>
      )}
      {error && (
        <p className="px-3 py-1 text-xs text-red-500 italic">
          Could not load tree.
        </p>
      )}
      {projects && projects.length === 0 && (
        <p className="px-3 py-1 text-xs text-gray-400 italic">
          No projects yet.
        </p>
      )}
      {projects && projects.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {projects.map((p) => (
            <ProjectTreeNode
              key={p.id}
              project={p}
              open={!!open[p.id]}
              onToggle={() => setOpen((m) => ({ ...m, [p.id]: !m[p.id] }))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One project row + its lazy-loaded nested tree on expand. */
function ProjectTreeNode({
  project, open, onToggle,
}: {
  project: ProjectSummary;
  open: boolean;
  onToggle: () => void;
}) {
  // Lazy fetch — only when the user expands this project's row.
  const { data, isLoading } = useQuery({
    queryKey: ["project", project.id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${project.id}`),
    enabled: open,
  });
  return (
    <li>
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-gray-700 hover:bg-gray-100 active:bg-gray-200"
        title={project.name}
      >
        <Chevron open={open} />
        <span className="truncate flex-1">{project.name}</span>
      </button>
      {open && (
        <ul className="pl-4 mt-0.5 border-l border-gray-100 ml-3">
          {isLoading && (
            <li className="px-2 py-1 text-xs text-gray-400 italic">Loading…</li>
          )}
          {data?.countries?.length === 0 && (
            <li className="px-2 py-1 text-xs text-gray-400 italic">No countries.</li>
          )}
          {data?.countries?.map((country) => (
            <li key={country.id}>
              <div className="px-2 py-1 text-xs font-medium text-gray-600 truncate">
                {country.name}
              </div>
              <ul className="pl-3 border-l border-gray-100 ml-1">
                {country.fields.length === 0 && (
                  <li className="px-2 py-0.5 text-xs text-gray-400 italic">
                    No fields.
                  </li>
                )}
                {country.fields.map((field) => (
                  <li key={field.id}>
                    <div className="px-2 py-1 text-xs font-medium text-gray-600 truncate">
                      <NavLink
                        to={`/fields/${field.id}/maps`}
                        className={({ isActive }) =>
                          isActive ? "text-blue-700" : "hover:text-blue-700"
                        }
                        title={`Open map for ${field.name}`}
                      >
                        {field.name}
                      </NavLink>
                    </div>
                    <ul className="pl-3 border-l border-gray-100 ml-1">
                      {field.wells.length === 0 && (
                        <li className="px-2 py-0.5 text-xs text-gray-400 italic">
                          No wells.
                        </li>
                      )}
                      {field.wells.map((well) => (
                        <li key={well.id}>
                          <div className="px-2 py-1 text-xs font-medium text-gray-600 truncate">
                            {well.name}
                          </div>
                          <ul className="pl-3 border-l border-gray-100 ml-1">
                            {well.calculations.length === 0 && (
                              <li className="px-2 py-0.5 text-xs text-gray-400 italic">
                                No calculations.
                              </li>
                            )}
                            {well.calculations.map((calc) => (
                              <li key={calc.id}>
                                <NavLink
                                  to={`/calculations/${calc.id}`}
                                  className={({ isActive }) =>
                                    `block px-2 py-1 rounded text-xs truncate ${
                                      isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-700 hover:bg-gray-100"
                                    }`
                                  }
                                  title={`${calc.type} · ${calc.name}`}
                                >
                                  <CalcTypeBadge type={calc.type} />
                                  <span className="ml-1">{calc.name}</span>
                                </NavLink>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Color-coded type chip next to each calculation in the tree. */
function CalcTypeBadge({ type }: { type: string }) {
  const isDesign = type === "WellDesign";
  return (
    <span
      className={`inline-block px-1 py-0.5 rounded text-[9px] font-semibold uppercase ${
        isDesign
          ? "bg-blue-100 text-blue-700"
          : "bg-purple-100 text-purple-700"
      }`}
      title={type}
    >
      {isDesign ? "Design" : "Survey"}
    </span>
  );
}

/** ▶ closed / ▼ open chevron icon used by the project tree node header. */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 120ms ease",
        flexShrink: 0,
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function RecentSection({
  title, items, emptyHint, toPath,
}: {
  title: string;
  items: RecentItem[];
  emptyHint: string;
  toPath: (item: RecentItem) => string;
}) {
  return (
    <div className="mt-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mt-3 mb-1 px-3">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="px-3 py-1 text-xs text-gray-400 italic">{emptyHint}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <NavLink
                to={toPath(it)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                  }`
                }
                title={it.label}
              >
                <div className="truncate">{it.label}</div>
                {it.context && (
                  <div className="text-xs text-gray-400 truncate">{it.context}</div>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
