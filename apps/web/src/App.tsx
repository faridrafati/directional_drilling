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

export function App() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/calculations/:id" element={<CalculationPage />} />
          <Route path="/fields/:id/maps" element={<FieldMapPage />} />
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
