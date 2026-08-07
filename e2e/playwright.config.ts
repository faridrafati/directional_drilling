import { defineConfig } from "@playwright/test";

/**
 * Playwright config for the happy-path E2E tests.
 *
 * Assumes both the API (:4000) and web (:5173) are already running. To start
 * them yourself before `pnpm/npm test`:
 *
 *   npm run dev          (in the repo root, starts api + web)
 *
 * Or let Playwright start the web server itself (the `webServer` block does
 * this when the variable START_DEV is set).
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  // One worker: every spec here drives the SAME database through the UI, so
  // running two at once lets one test's job or cost code appear inside another
  // test's assertions. Serial is the only honest setting for DB-backed E2E.
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: process.env.START_DEV
    ? {
        command: "npm --workspace apps/web run dev",
        cwd: "..",
        port: 5173,
        reuseExistingServer: true,
        timeout: 30_000,
      }
    : undefined,
});
