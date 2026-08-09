/**
 * A STRUCTURAL guard over the daily-report PUT.
 *
 * WHY THIS EXISTS
 * ---------------
 * `PUT /entry/reports/:id` replaces a day's children wholesale: every bit run,
 * drill string, component, tool and mud check is deleted and recreated from the
 * parsed body. zod's `z.object()` strips keys it does not declare. Put those two
 * together and a column that exists in Prisma but is missing from its zod schema
 * is not merely un-typeable — it is DESTROYED the next time anybody saves a day
 * that already had a value in it.
 *
 * That is exactly what happened: `itemCost`, `driftIn`, `gaugeIn`, `connections`,
 * `massPerLenKgM` and `grade` were all readable, all printed by reports 02, 06
 * and 07, and all silently zeroed by a save with nothing edited. Nothing caught
 * it, because every existing test asserts what a report RENDERS, and a report
 * renders a blank cell perfectly happily.
 *
 * So this test does not read the database or start a server. It reads the two
 * source files and asserts they agree: every scalar column of a child model the
 * PUT recreates must be accepted by the schema that parses it. It is the cheapest
 * possible check for the one failure mode that costs the user their data.
 *
 * A field that genuinely should not be settable belongs in DERIVED_OR_MANAGED
 * below, with a reason — an explicit exemption, not a silent omission.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(join(HERE, "..", "..", "prisma", "schema.prisma"), "utf-8");
const ROUTES = readFileSync(join(HERE, "entry.ts"), "utf-8");

/**
 * Model -> parser, for every child of a daily report.
 *
 * Derived from the schema (any model carrying a `reportId`) rather than typed
 * out, so a child table added later is covered the day it is added instead of
 * the day somebody remembers to extend a list. The four irregular names are
 * spelled out because the convention does not reach them.
 */
const IRREGULAR: Record<string, string> = {
  EntryCasingRun: "casingSchema",
  EntryWellheadComponent: "wellheadSchema",
  EntryOnboardCompany: "companySchema",
  EntryTimeEntry: "timeSchema",
  EntryDrillStringComponent: "drillStringComponentSchema",
};

/**
 * Columns the ROUTE sets for itself, so the body has no business carrying them.
 * Each is an explicit decision; anything merely absent is a bug.
 */
const DERIVED_OR_MANAGED = new Set([
  "id", "createdAt", "updatedAt",
  // parentage, set by the route from the URL and the session
  "reportId", "wellId", "userId",
  // The BHA linkage is REBUILT by the route after the children are recreated
  // (see the entryDrillString / entryBitRun / entryDrillingParameter updates at
  // the end of the PUT), so it is correctly absent from the bodies.
  "bhaRunId",
  // Set by the nested `components: { create: [...] }` write.
  "drillStringId",
]);

/** Model names, so a field whose type is another model is a relation, not data. */
const MODEL_NAMES = new Set(
  [...SCHEMA.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]),
);

/** Every model that is a child of a daily report, with the schema that parses it. */
function reportChildren(): [model: string, zodConst: string][] {
  const declared = new Set(
    [...ROUTES.matchAll(/const (\w+Schema) = z\.object/g)].map((m) => m[1]),
  );
  const out: [string, string][] = [];
  for (const m of SCHEMA.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const [, model, body] = m;
    if (!/^\s*reportId\s/m.test(body)) continue;
    const base = model.replace(/^Entry/, "");
    const guess = IRREGULAR[model] ?? base.charAt(0).toLowerCase() + base.slice(1) + "Schema";
    if (!declared.has(guess)) {
      throw new Error(
        `${model} is a child of EntryReport but no zod schema named ${guess} exists. `
          + "Add it to IRREGULAR if it is parsed under another name.",
      );
    }
    out.push([model, guess]);
  }
  return out;
}

/** The scalar, settable columns of a Prisma model. */
function scalarColumns(model: string): string[] {
  const body = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m").exec(SCHEMA);
  if (!body) throw new Error(`model ${model} not found in schema.prisma`);
  const out: string[] = [];
  for (const raw of body[1].split("\n")) {
    const line = raw.split("///")[0].trim();
    if (!line || line.startsWith("@@") || line.startsWith("//")) continue;
    const [name, type] = line.split(/\s+/);
    if (!name || !type) continue;
    if (DERIVED_OR_MANAGED.has(name)) continue;
    const bare = type.replace(/[?[\]]/g, "");
    if (MODEL_NAMES.has(bare)) continue;     // a relation
    if (type.endsWith("[]")) continue;        // a list of children
    out.push(name);
  }
  return out;
}

/**
 * The keys a zod object schema declares.
 *
 * Brace-COUNTED rather than regex-terminated. A `/\n\}\)/` terminator silently
 * runs past a single-line `z.object({ ... });` into whatever is declared next and
 * returns the union of both schemas' keys — which is a false PASS, the one
 * failure mode a guard like this must not have. It hid three columns here until
 * an unrelated edit made the schema multi-line.
 */
function zodKeys(constName: string): Set<string> {
  const open = ROUTES.indexOf(`const ${constName} = z.object({`);
  if (open < 0) throw new Error(`${constName} not found in entry.ts`);
  let i = ROUTES.indexOf("{", open);
  let depth = 0;
  const start = i;
  for (; i < ROUTES.length; i++) {
    if (ROUTES[i] === "{") depth++;
    else if (ROUTES[i] === "}") { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) throw new Error(`${constName}: unbalanced braces`);
  const body = ROUTES.slice(start + 1, i)
    .replace(/\/\/.*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  // Only top-level keys: a nested object's keys are not this schema's keys.
  let d = 0;
  const keys = new Set<string>();
  for (const m of body.matchAll(/[{}]|(\w+)\s*:/g)) {
    if (m[0] === "{") d++;
    else if (m[0] === "}") d--;
    else if (d === 0 && m[1]) keys.add(m[1]);
  }
  return keys;
}

const PAIRS = reportChildren();

describe("daily-report PUT: zod schemas accept every column they overwrite", () => {
  for (const [model, zodConst] of PAIRS) {
    it(`${zodConst} accepts every scalar column of ${model}`, () => {
      const declared = zodKeys(zodConst);
      const missing = scalarColumns(model).filter((c) => !declared.has(c));
      expect(
        missing,
        `${model} column(s) ${missing.join(", ")} are stored and printed but absent from `
          + `${zodConst}. Because the PUT recreates ${model} rows wholesale, zod strips them and `
          + `the next save DELETES the stored value. Add them to the schema, or exempt them `
          + `explicitly in DERIVED_OR_MANAGED with a reason.`,
      ).toEqual([]);
    });
  }

  it("covers every child of a daily report", () => {
    // reportChildren() derives the list, so this asserts the derivation found
    // something rather than silently testing nothing.
    expect(PAIRS.length).toBeGreaterThanOrEqual(28);
  });
});
