import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface Props { children: ReactNode }

/** Top-level sections — moved from the old left sidebar into the top navbar. */
const NAV: { to: string; label: string }[] = [
  { to: "/projects", label: "Projects" },
  { to: "/logs", label: "EMI Log Analysis" },
  { to: "/air-gas", label: "Air & Gas Drilling" },
  { to: "/ddr", label: "Daily Drilling Reports" },
];

/**
 * App shell — a top navbar (brand + section links) over a full-width main area.
 * The previous left sidebar (nav links + Projects tree + Recent lists) was removed;
 * project management lives on the Projects page (the "/" landing route), and the
 * removed sidebar frees the full width for the data-heavy pages (DDR, maps, 3D).
 */
export function AppShell({ children }: Props) {
  return (
    <div className="h-full flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="flex items-center gap-x-4 gap-y-1 px-4 py-2 flex-wrap">
          <div className="flex items-baseline gap-2 mr-1">
            <h1 className="text-base font-semibold text-gray-900 whitespace-nowrap">Directional Drilling</h1>
            <span className="text-[11px] text-gray-500 whitespace-nowrap">v0.6 — Phase 6</span>
          </div>
          <nav className="flex items-center gap-1 flex-wrap">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-100 active:bg-gray-200"
                  }`
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
