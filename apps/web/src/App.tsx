import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { AppShell } from "./shell/AppShell.js";
import { ProjectsPage } from "./pages/ProjectsPage.js";
import { ProjectDetailPage } from "./pages/ProjectDetailPage.js";
import { PlaceholderPage } from "./pages/PlaceholderPage.js";

// Heavy routes are lazy-loaded so the initial JS bundle stays small.
// Three.js / pdfmake / xlsx are vendor-chunked separately (see vite.config.ts).
const CalculationPage = lazy(() =>
  import("./pages/CalculationPage.js").then((m) => ({ default: m.CalculationPage }))
);
const FieldMapPage = lazy(() =>
  import("./pages/FieldMapPage.js").then((m) => ({ default: m.FieldMapPage }))
);
// EIV EMI-log analyzer (LAS heatmaps). Parses 4–38 MB files client-side, so
// it's lazy-split to keep it out of the initial bundle.
const LogAnalysisPage = lazy(() =>
  import("./pages/LogAnalysisPage.js").then((m) => ({ default: m.LogAnalysisPage }))
);
// Air & Gas Drilling — underbalanced hydraulics calculator. Lazy-split so its
// recharts / pdfmake / xlsx deps stay out of the initial bundle.
const AirGasPage = lazy(() =>
  import("./pages/AirGasPage.js").then((m) => ({ default: m.AirGasPage }))
);
// DDR — Daily Drilling Report viewer (reads the legacy SQLite DBs via @dd/api).
const DdrReportsPage = lazy(() =>
  import("./pages/DdrReportsPage.js").then((m) => ({ default: m.DdrReportsPage }))
);
// Rig-side entry for the same report — authenticated, writes to the app's own DB.
const ReportEntryPage = lazy(() =>
  import("./pages/ReportEntryPage.js").then((m) => ({ default: m.ReportEntryPage }))
);
// The WellView report suite — generated from the app's own database.
const WellviewReportsPage = lazy(() =>
  import("./pages/WellviewReportsPage.js").then((m) => ({ default: m.WellviewReportsPage }))
);

export function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/ddr" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/calculations/:id" element={<CalculationPage />} />
          <Route path="/fields/:id/maps" element={<FieldMapPage />} />
          {/* EIV EMI-log analyzer — standalone (no id) or per-well (?well=id). */}
          <Route path="/logs" element={<LogAnalysisPage />} />
          {/* Air & Gas Drilling — standalone underbalanced hydraulics calculator. */}
          <Route path="/air-gas" element={<AirGasPage />} />
          {/* Daily Drilling Reports — reads the legacy DDR SQLite databases. */}
          <Route path="/ddr" element={<DdrReportsPage />} />
          {/* Daily Report Entry — company men file the same form from the rig. */}
          <Route path="/ddr-entry" element={<ReportEntryPage />} />
          {/* Well Reports — the WellView report suite, from the entry database. */}
          <Route path="/well-reports" element={<WellviewReportsPage />} />
          <Route
            path="/3d/:id"
            element={<PlaceholderPage title="3D Field Visualization" phase="Phase 5" />}
          />
          <Route path="*" element={<PlaceholderPage title="Not found" />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
