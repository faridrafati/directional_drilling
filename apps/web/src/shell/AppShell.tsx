import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface Props { children: ReactNode }

/** Top-level sections — moved from the old left sidebar into the top navbar. */
const NAV: { to: string; label: string }[] = [
  { to: "/projects", label: "Directional Drilling" },
  { to: "/logs", label: "EMI Log Analysis" },
  { to: "/air-gas", label: "Air & Gas Drilling" },
  { to: "/ddr", label: "Daily Drilling Reports" },
  { to: "/ddr-entry", label: "Daily Report Entry" },
  { to: "/well-reports", label: "Well Reports" },
];

/** Derrick mark — inline SVG (the design checklist forbids emoji-as-icon). */
function DerrickIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-400 shrink-0" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true">
      {/* tower */}
      <path d="M9 21 L11 3 h2 L15 21" />
      <path d="M9.6 16 h4.8 M10.2 11 h3.6 M10.7 7 h2.6" />
      {/* ground + travelling block */}
      <path d="M5 21 h14" />
      <path d="M12 3 v-1.5" />
    </svg>
  );
}

/**
 * App shell — "Data-Dense Dashboard" chrome: a dark slate command bar (brand +
 * section links) over a full-width light work area. Active section is marked
 * with the amber accent; links keep 150ms hover transitions and visible
 * keyboard focus. The previous left sidebar stays retired — the data-heavy
 * pages (DDR, maps, 3D) get the full width.
 */
export function AppShell({ children }: Props) {
  return (
    <div className="h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 shadow-sm">
        <div className="flex items-center gap-x-5 gap-y-1 px-4 py-2 flex-wrap">
          <div className="flex items-center gap-2 mr-1">
            <DerrickIcon />
            <h1 className="text-base font-semibold text-white whitespace-nowrap tracking-tight">Rock Drill</h1>
            <span className="text-[10px] font-medium text-gray-400 border border-gray-700 rounded px-1.5 py-0.5 whitespace-nowrap">
              v0.6 · Phase 6
            </span>
          </div>
          <nav className="flex items-center gap-1 flex-wrap" aria-label="Main">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-md text-[13px] transition-colors duration-150 cursor-pointer ` +
                  (isActive
                    ? "text-white font-medium bg-white/10 shadow-[inset_0_-2px_0_0_#f59e0b]"
                    : "text-gray-300 hover:text-white hover:bg-white/5 active:bg-white/10")
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
