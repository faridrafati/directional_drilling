import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
