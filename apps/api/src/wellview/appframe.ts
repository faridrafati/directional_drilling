/**
 * `system/peloton.appframe.ini` — WellView's own application manifest.
 *
 * Four lines of it matter, and they are worth reading rather than assuming:
 *
 *   idpackage             the exact build the shipped material came from. The
 *                         182 report templates, the data model, the unit table
 *                         and the icon library are all from ONE package, and a
 *                         user handed a different export needs to see which.
 *   appname / Version     what Peloton calls the product.
 *   datafileextension     `wvd` — the extension WellView's own well files use,
 *                         which is exactly why this app must NOT use it (see
 *                         `WELL_FILE_EXTENSION` below).
 *   [VisToolsSingle]      the five single-well visual tools and their ORDER.
 *
 * Missing is not an error: the file lives in the vendor tree, which is not in
 * the repository, so a clean checkout has no manifest and the app simply does
 * not state a version.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");
const INI = process.env.WELLVIEW_APPFRAME_INI
  ?? join(REPO, "WellView_files", "system", "peloton.appframe.ini");

export interface AppFrame {
  /** "WellView 9.0" */
  appName: string | null;
  /** "9.0" */
  version: string | null;
  /** "9.0.20111208" — the build every shipped template and icon came from. */
  packageId: string | null;
  /** Peloton's own subtitle. */
  subtitle: string | null;
  /** The single-well visual tools, in the order the manifest gives them. */
  singleTools: string[];
  /** …and the multi-well ones. */
  multiTools: string[];
}

/**
 * WellView's well-file extension is `wvd`, and this app deliberately does not
 * use it.
 *
 * A `.wvd` is Peloton's own well file. What Export Well produces is a JSON
 * document of this app's making — same data, entirely different container, and
 * WellView cannot open it. Giving it the `.wvd` name would claim an
 * interoperability that does not exist, which is a worse failure than an
 * unfamiliar extension.
 */
export const WELLVIEW_DATA_EXTENSION = "wvd";
export const WELL_FILE_EXTENSION = "wellview.json";

let _cached: AppFrame | null | undefined;

/** The manifest, parsed once, or null when the vendor tree is not present. */
export function appFrame(): AppFrame | null {
  if (_cached !== undefined) return _cached;
  if (!existsSync(INI)) return (_cached = null);
  let text: string;
  try { text = readFileSync(INI, "latin1"); } catch { return (_cached = null); }

  const sections = new Map<string, Map<string, string>>();
  let current = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(";")) continue;
    const head = line.match(/^\[(.+)\]$/);
    if (head) { current = head[1].toLowerCase(); sections.set(current, new Map()); continue; }
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    // Keys keep their case: in [general] a key is a setting name, but in the
    // tool sections the KEY is the data — a .NET class name — and lowercasing
    // it would hand back "reportenginecontrolsingle".
    sections.get(current)?.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  const get = (s: string, k: string) => {
    for (const [key, v] of sections.get(s) ?? new Map()) {
      if (key.toLowerCase() === k) return v as string;
    }
    return null;
  };

  // The tool sections are keyed by class name and VALUED by display order, so
  // the order is the value, not the file order.
  const ordered = (s: string) => [...(sections.get(s) ?? new Map()).entries()]
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map(([cls]) => cls);

  return (_cached = {
    appName: get("general", "appname"),
    version: get("splash", "version"),
    packageId: get("general", "idpackage"),
    subtitle: get("splash", "subtitle"),
    singleTools: ordered("vistoolssingle"),
    multiTools: ordered("vistoolsmulti"),
  });
}

/** Reset the cache — tests only. */
export function _resetAppFrame(): void { _cached = undefined; }
