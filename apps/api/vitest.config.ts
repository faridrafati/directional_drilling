import { defineConfig } from "vitest/config";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // The WellView route tests write to the same SQLite file the sweep reads;
    // parallel test FILES would contend on its write lock.
    fileParallelism: false,
  },
  resolve: {
    // The Vite under vitest 2 predates node:sqlite (a prefix-only builtin) and
    // resolves it as an npm package called "sqlite". Alias it to a shim that
    // loads the real builtin via createRequire. See src/test/node-sqlite-shim.mjs.
    alias: [{ find: /^node:sqlite$/, replacement: join(HERE, "src", "test", "node-sqlite-shim.mjs") }],
  },
});
