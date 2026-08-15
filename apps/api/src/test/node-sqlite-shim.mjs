/**
 * Test-only shim for `node:sqlite`.
 *
 * The Vite bundled with vitest 2 predates node:sqlite and strips the `node:`
 * prefix while resolving, then fails to find a package called "sqlite".
 * vitest.config.ts aliases `node:sqlite` to this file, which loads the real
 * builtin through createRequire — a path Vite does not try to rewrite.
 * Production code keeps importing `node:sqlite` directly.
 */
import { createRequire } from "node:module";

const sqlite = createRequire(import.meta.url)("node:sqlite");

export const DatabaseSync = sqlite.DatabaseSync;
export const StatementSync = sqlite.StatementSync;
export default sqlite;
