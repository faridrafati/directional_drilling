import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
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
        <Nav to="/logs" label="EMI Log Analysis" />
        <Nav to="/air-gas" label="Air & Gas Drilling" />

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
  const qc = useQueryClient();
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

  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["projects"] });
    // Every per-project detail query needs to refetch so the renamed /
    // added / moved node shows up under its new parent.
    qc.invalidateQueries({ queryKey: ["project"] });
  };

  const addProject = useMutation({
    mutationFn: (name: string) =>
      // Default to API unit preset; user can change later in Projects page.
      api.post("/projects", { name, units: '{"length":"ft","angle":"deg","dls":"deg/100ft"}' }),
    onSuccess: invalidateAll,
  });

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mt-3 mb-1 px-3">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
          Projects tree
        </div>
        <button
          onClick={() => {
            const name = window.prompt("New project name:");
            if (name?.trim()) addProject.mutate(name.trim());
          }}
          className="text-gray-400 hover:text-blue-700 p-0.5 rounded"
          title="Add project"
          aria-label="Add project"
        >
          <PlusIcon />
        </button>
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
              onInvalidate={invalidateAll}
              onMoveRequest={setMoveTarget}
            />
          ))}
        </ul>
      )}

      {/* Move-to-different-parent modal */}
      {moveTarget && (
        <MoveModal
          target={moveTarget}
          projects={projects ?? []}
          onClose={() => setMoveTarget(null)}
          onMoved={() => { invalidateAll(); setMoveTarget(null); }}
        />
      )}
    </div>
  );
}

/**
 * Identifies one specific tree node so the MoveModal knows which item to
 * move and which API endpoint to call. `parentId` is the CURRENT parent
 * (so the modal can pre-select its current location and exclude it from
 * the destination list — moving a country to its own current project
 * would be a no-op).
 */
type MoveTarget =
  | { kind: "country"; id: string; name: string; parentId: string }
  | { kind: "field";   id: string; name: string; parentId: string }
  | { kind: "well";    id: string; name: string; parentId: string }
  | { kind: "calc";    id: string; name: string; parentId: string };

/** One project row + its lazy-loaded nested tree on expand. */
function ProjectTreeNode({
  project, open, onToggle, onInvalidate, onMoveRequest,
}: {
  project: ProjectSummary;
  open: boolean;
  onToggle: () => void;
  onInvalidate: () => void;
  onMoveRequest: (t: MoveTarget) => void;
}) {
  // Lazy fetch — only when the user expands this project's row.
  const { data, isLoading } = useQuery({
    queryKey: ["project", project.id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${project.id}`),
    enabled: open,
  });

  const renameProject = useMutation({
    mutationFn: (name: string) => api.put(`/projects/${project.id}`, { name }),
    onSuccess: onInvalidate,
  });
  const deleteProject = useMutation({
    mutationFn: () => api.del(`/projects/${project.id}`),
    onSuccess: onInvalidate,
  });
  const addCountry = useMutation({
    mutationFn: (name: string) => api.post("/countries", { projectId: project.id, name }),
    onSuccess: onInvalidate,
  });

  return (
    <li>
      <TreeRow
        chevron={<Chevron open={open} />}
        label={project.name}
        onClick={onToggle}
        actions={[
          { kind: "rename", onSubmit: (n) => renameProject.mutate(n), current: project.name },
          { kind: "add", title: "Add country", onSubmit: (n) => addCountry.mutate(n), placeholder: "Country name" },
          {
            kind: "delete",
            confirmMessage: `Delete project "${project.name}" and ALL its countries, fields, wells, and calculations? This cannot be undone.`,
            onConfirm: () => deleteProject.mutate(),
          },
        ]}
      />
      {open && (
        <ul className="pl-4 mt-0.5 border-l border-gray-100 ml-3">
          {isLoading && (
            <li className="px-2 py-1 text-xs text-gray-400 italic">Loading…</li>
          )}
          {data?.countries?.length === 0 && (
            <li className="px-2 py-1 text-xs text-gray-400 italic">No countries.</li>
          )}
          {data?.countries?.map((country) => (
            <CountryNode
              key={country.id}
              country={country}
              projectId={project.id}
              onInvalidate={onInvalidate}
              onMoveRequest={onMoveRequest}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function CountryNode({
  country, projectId, onInvalidate, onMoveRequest,
}: {
  country: ProjectDetail["countries"][number];
  projectId: string;
  onInvalidate: () => void;
  onMoveRequest: (t: MoveTarget) => void;
}) {
  const renameCountry = useMutation({
    mutationFn: (name: string) => api.put(`/countries/${country.id}`, { name }),
    onSuccess: onInvalidate,
  });
  const deleteCountry = useMutation({
    mutationFn: () => api.del(`/countries/${country.id}`),
    onSuccess: onInvalidate,
  });
  const addField = useMutation({
    mutationFn: (name: string) => api.post("/fields", { countryId: country.id, name }),
    onSuccess: onInvalidate,
  });
  return (
    <li>
      <TreeRow
        label={country.name}
        small
        actions={[
          { kind: "rename", onSubmit: (n) => renameCountry.mutate(n), current: country.name },
          { kind: "add", title: "Add field", onSubmit: (n) => addField.mutate(n), placeholder: "Field name" },
          { kind: "move", onClick: () =>
            onMoveRequest({ kind: "country", id: country.id, name: country.name, parentId: projectId }) },
          {
            kind: "delete",
            confirmMessage: `Delete country "${country.name}" and all its fields/wells/calcs?`,
            onConfirm: () => deleteCountry.mutate(),
          },
        ]}
      />
      <ul className="pl-3 border-l border-gray-100 ml-1">
        {country.fields.length === 0 && (
          <li className="px-2 py-0.5 text-xs text-gray-400 italic">No fields.</li>
        )}
        {country.fields.map((field) => (
          <FieldNode
            key={field.id}
            field={field}
            countryId={country.id}
            onInvalidate={onInvalidate}
            onMoveRequest={onMoveRequest}
          />
        ))}
      </ul>
    </li>
  );
}

function FieldNode({
  field, countryId, onInvalidate, onMoveRequest,
}: {
  field: ProjectDetail["countries"][number]["fields"][number];
  countryId: string;
  onInvalidate: () => void;
  onMoveRequest: (t: MoveTarget) => void;
}) {
  const renameField = useMutation({
    mutationFn: (name: string) => api.put(`/fields/${field.id}`, { name }),
    onSuccess: onInvalidate,
  });
  const deleteField = useMutation({
    mutationFn: () => api.del(`/fields/${field.id}`),
    onSuccess: onInvalidate,
  });
  const addWell = useMutation({
    mutationFn: (name: string) => api.post("/wells", { fieldId: field.id, name }),
    onSuccess: onInvalidate,
  });
  return (
    <li>
      <TreeRow
        label={field.name}
        small
        labelHref={`/fields/${field.id}/maps`}
        labelTitle={`Open map for ${field.name}`}
        actions={[
          { kind: "rename", onSubmit: (n) => renameField.mutate(n), current: field.name },
          { kind: "add", title: "Add well", onSubmit: (n) => addWell.mutate(n), placeholder: "Well name" },
          { kind: "move", onClick: () =>
            onMoveRequest({ kind: "field", id: field.id, name: field.name, parentId: countryId }) },
          {
            kind: "delete",
            confirmMessage: `Delete field "${field.name}" and all its wells/calcs?`,
            onConfirm: () => deleteField.mutate(),
          },
        ]}
      />
      <ul className="pl-3 border-l border-gray-100 ml-1">
        {field.wells.length === 0 && (
          <li className="px-2 py-0.5 text-xs text-gray-400 italic">No wells.</li>
        )}
        {field.wells.map((well) => (
          <WellNode
            key={well.id}
            well={well}
            fieldId={field.id}
            onInvalidate={onInvalidate}
            onMoveRequest={onMoveRequest}
          />
        ))}
      </ul>
    </li>
  );
}

function WellNode({
  well, fieldId, onInvalidate, onMoveRequest,
}: {
  well: ProjectDetail["countries"][number]["fields"][number]["wells"][number];
  fieldId: string;
  onInvalidate: () => void;
  onMoveRequest: (t: MoveTarget) => void;
}) {
  const renameWell = useMutation({
    mutationFn: (name: string) => api.put(`/wells/${well.id}`, { name }),
    onSuccess: onInvalidate,
  });
  const deleteWell = useMutation({
    mutationFn: () => api.del(`/wells/${well.id}`),
    onSuccess: onInvalidate,
  });
  // Adding a calculation needs BOTH a name and a type, so handle it via a
  // 2-step prompt rather than the inline add row used elsewhere.
  const addCalc = useMutation({
    mutationFn: (vars: { name: string; type: "WellDesign" | "SurveyEditor" }) =>
      api.post("/calculations", { wellId: well.id, ...vars }),
    onSuccess: onInvalidate,
  });
  return (
    <li>
      <TreeRow
        label={well.name}
        small
        actions={[
          { kind: "rename", onSubmit: (n) => renameWell.mutate(n), current: well.name },
          {
            kind: "custom",
            title: "Add calculation",
            icon: <PlusIcon />,
            onClick: () => {
              const name = window.prompt('New calculation name:');
              if (!name?.trim()) return;
              const t = window.prompt(
                "Type? Enter 'design' for WellDesign or 'survey' for SurveyEditor:",
                "design",
              );
              if (!t) return;
              const type = /^s/i.test(t.trim()) ? "SurveyEditor" : "WellDesign";
              addCalc.mutate({ name: name.trim(), type });
            },
          },
          { kind: "move", onClick: () =>
            onMoveRequest({ kind: "well", id: well.id, name: well.name, parentId: fieldId }) },
          {
            kind: "delete",
            confirmMessage: `Delete well "${well.name}" and all its calculations?`,
            onConfirm: () => deleteWell.mutate(),
          },
        ]}
      />
      <ul className="pl-3 border-l border-gray-100 ml-1">
        {well.calculations.length === 0 && (
          <li className="px-2 py-0.5 text-xs text-gray-400 italic">No calculations.</li>
        )}
        {well.calculations.map((calc) => (
          <CalcLeaf
            key={calc.id}
            calc={calc}
            wellId={well.id}
            onInvalidate={onInvalidate}
            onMoveRequest={onMoveRequest}
          />
        ))}
      </ul>
    </li>
  );
}

function CalcLeaf({
  calc, wellId, onInvalidate, onMoveRequest,
}: {
  calc: { id: string; name: string; type: string };
  wellId: string;
  onInvalidate: () => void;
  onMoveRequest: (t: MoveTarget) => void;
}) {
  const renameCalc = useMutation({
    mutationFn: (name: string) => api.put(`/calculations/${calc.id}`, { name }),
    onSuccess: onInvalidate,
  });
  const deleteCalc = useMutation({
    mutationFn: () => api.del(`/calculations/${calc.id}`),
    onSuccess: onInvalidate,
  });
  return (
    <li>
      <TreeRow
        small
        labelHref={`/calculations/${calc.id}`}
        labelTitle={`${calc.type} · ${calc.name}`}
        labelContent={
          <>
            <CalcTypeBadge type={calc.type} />
            <span className="ml-1">{calc.name}</span>
          </>
        }
        label={calc.name}
        actions={[
          { kind: "rename", onSubmit: (n) => renameCalc.mutate(n), current: calc.name },
          { kind: "move", onClick: () =>
            onMoveRequest({ kind: "calc", id: calc.id, name: calc.name, parentId: wellId }) },
          {
            kind: "delete",
            confirmMessage: `Delete calculation "${calc.name}"?`,
            onConfirm: () => deleteCalc.mutate(),
          },
        ]}
      />
    </li>
  );
}

/**
 * Single tree row with optional chevron + label + action icons that appear
 * on hover. Used by every level (project / country / field / well / calc)
 * so they all behave consistently.
 *
 * The `actions` array drives the icons on the right side. Each action is
 * one of:
 *   - rename  → pencil icon → inline edit (replaces the label with input)
 *   - add     → plus icon   → inline edit for a child name
 *   - delete  → trash icon  → window.confirm() then onConfirm()
 *   - move    → arrow icon  → onClick() (parent opens the move modal)
 *   - custom  → user icon + onClick (used for "add calculation" which needs
 *               a type prompt as well as a name)
 *
 * When `labelHref` is set, the label becomes a NavLink; otherwise just a
 * styled button toggling chevron / parent's onClick.
 */
type TreeAction =
  | { kind: "rename"; current: string; onSubmit: (next: string) => void }
  | { kind: "add"; title: string; placeholder: string; onSubmit: (name: string) => void }
  | { kind: "delete"; confirmMessage: string; onConfirm: () => void }
  | { kind: "move"; onClick: () => void }
  | { kind: "custom"; title: string; icon: ReactNode; onClick: () => void };

function TreeRow({
  chevron, label, labelHref, labelTitle, labelContent, small, onClick, actions,
}: {
  chevron?: ReactNode;
  label: string;
  labelHref?: string;
  labelTitle?: string;
  labelContent?: ReactNode;
  small?: boolean;
  onClick?: () => void;
  actions: TreeAction[];
}) {
  // Inline-edit modes — at most one active at a time.
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState<TreeAction | null>(null);
  const [draft, setDraft] = useState("");

  // Start a rename or add interaction.
  const startRename = (current: string) => {
    setAdding(null);
    setDraft(current);
    setRenaming(true);
  };
  const startAdd = (act: TreeAction) => {
    if (act.kind !== "add") return;
    setRenaming(false);
    setDraft("");
    setAdding(act);
  };
  const cancel = () => { setRenaming(false); setAdding(null); setDraft(""); };

  const rowClass = `group w-full text-left flex items-center gap-1.5 px-2 ${
    small ? "py-1" : "py-1.5"
  } rounded-md ${
    small ? "text-xs" : "text-sm"
  } text-gray-700 hover:bg-gray-100 active:bg-gray-200`;

  // Render the inline-edit input when either rename or add is active.
  if (renaming || adding) {
    const placeholder = adding?.kind === "add" ? adding.placeholder : label;
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (!v) return cancel();
          if (renaming) {
            const a = actions.find((a) => a.kind === "rename");
            if (a?.kind === "rename") a.onSubmit(v);
          } else if (adding?.kind === "add") {
            adding.onSubmit(v);
          }
          cancel();
        }}
        className={rowClass + " bg-blue-50"}
      >
        {chevron}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={cancel}
          onKeyDown={(e) => { if (e.key === "Escape") cancel(); }}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-white border border-blue-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </form>
    );
  }

  // Normal row: clickable label OR navigable label, plus hover icons.
  return (
    <div className={rowClass} title={labelTitle ?? label}>
      {chevron && (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center"
          aria-label="Expand / collapse"
        >
          {chevron}
        </button>
      )}
      {labelHref ? (
        <NavLink
          to={labelHref}
          className={({ isActive }) =>
            `flex-1 min-w-0 truncate ${isActive ? "text-blue-700" : "hover:text-blue-700"}`
          }
        >
          {labelContent ?? label}
        </NavLink>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="flex-1 min-w-0 truncate text-left"
        >
          {labelContent ?? label}
        </button>
      )}
      {/* Action icons — appear on hover so the tree stays uncluttered. */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {actions.map((a, i) => {
          if (a.kind === "rename") {
            return (
              <ActionIconButton
                key={i}
                title="Rename"
                onClick={(e) => { e.stopPropagation(); startRename(a.current); }}
                icon={<PencilIcon />}
              />
            );
          }
          if (a.kind === "add") {
            return (
              <ActionIconButton
                key={i}
                title={a.title}
                onClick={(e) => { e.stopPropagation(); startAdd(a); }}
                icon={<PlusIcon />}
              />
            );
          }
          if (a.kind === "move") {
            return (
              <ActionIconButton
                key={i}
                title="Move to a different parent"
                onClick={(e) => { e.stopPropagation(); a.onClick(); }}
                icon={<MoveIcon />}
              />
            );
          }
          if (a.kind === "custom") {
            return (
              <ActionIconButton
                key={i}
                title={a.title}
                onClick={(e) => { e.stopPropagation(); a.onClick(); }}
                icon={a.icon}
              />
            );
          }
          // delete
          return (
            <ActionIconButton
              key={i}
              title="Delete"
              danger
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(a.confirmMessage)) a.onConfirm();
              }}
              icon={<TrashIcon />}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActionIconButton({
  icon, onClick, title, danger,
}: {
  icon: ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1 rounded ${
        danger ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
               : "text-gray-400 hover:text-blue-700 hover:bg-blue-50"
      }`}
    >
      {icon}
    </button>
  );
}

/**
 * Modal that lets the user reparent a country / field / well / calculation
 * onto a different ancestor. Lists every possible destination at the
 * matching level (e.g. moving a well → list every Field across every
 * Country across every Project) and PUTs the new parent ID.
 *
 * The current parent appears at the top with "(current)" so the user
 * knows where the item is now; selecting it is a no-op (the destination
 * select disables when it matches).
 */
function MoveModal({
  target, projects, onClose, onMoved,
}: {
  target: MoveTarget;
  projects: ProjectSummary[];
  onClose: () => void;
  onMoved: () => void;
}) {
  // Pre-load every project's tree so we can list ALL possible destinations.
  // useQueries handles variable-length arrays of queries safely (Rules of
  // Hooks compliant); each ["project", id] query was probably already
  // fetched if the user has been navigating the sidebar, in which case
  // useQueries returns cached data instantly.
  const trees = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["project", p.id],
      queryFn: () => api.get<ProjectDetail>(`/projects/${p.id}`),
    })),
  });
  const allLoaded = trees.every((t) => t.data || t.isError);
  const [destId, setDestId] = useState<string>(target.parentId);

  const move = useMutation({
    mutationFn: () => {
      const url = ({
        country: `/countries/${target.id}`,
        field:   `/fields/${target.id}`,
        well:    `/wells/${target.id}`,
        calc:    `/calculations/${target.id}`,
      })[target.kind];
      const body = ({
        country: { projectId: destId },
        field:   { countryId: destId },
        well:    { fieldId:   destId },
        calc:    { wellId:    destId },
      })[target.kind];
      return api.put(url, body);
    },
    onSuccess: onMoved,
  });

  // Flatten the loaded projects into a list of valid destinations.
  // For each level we collect {id, label} where the label shows the full
  // breadcrumb so the user can disambiguate same-named fields/wells.
  type Dest = { id: string; label: string };
  const destinations: Dest[] = [];
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    const pd = trees[i].data;
    if (!pd) continue;
    if (target.kind === "country") {
      destinations.push({ id: p.id, label: p.name });
    }
    for (const country of pd.countries) {
      if (target.kind === "field") {
        destinations.push({ id: country.id, label: `${p.name} / ${country.name}` });
      }
      for (const field of country.fields) {
        if (target.kind === "well") {
          destinations.push({
            id: field.id,
            label: `${p.name} / ${country.name} / ${field.name}`,
          });
        }
        for (const well of field.wells) {
          if (target.kind === "calc") {
            destinations.push({
              id: well.id,
              label: `${p.name} / ${country.name} / ${field.name} / ${well.name}`,
            });
          }
        }
      }
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-[92vw] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          Move {target.kind}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Pick a new parent for <span className="font-medium">{target.name}</span>.
        </p>
        {!allLoaded ? (
          <p className="text-xs text-gray-400 italic">Loading destinations…</p>
        ) : (
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 h-10 bg-white text-sm"
          >
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}{d.id === target.parentId ? " (current)" : ""}
              </option>
            ))}
          </select>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 h-9 rounded-md text-sm bg-gray-100 hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            disabled={destId === target.parentId || move.isPending}
            onClick={() => move.mutate()}
            className="px-3 h-9 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300"
          >
            {move.isPending ? "Moving…" : "Move"}
          </button>
        </div>
      </div>
    </div>
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

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 9 2 12 5 15" />
      <polyline points="9 5 12 2 15 5" />
      <polyline points="15 19 12 22 9 19" />
      <polyline points="19 9 22 12 19 15" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
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
