/**
 * CWLS LAS 2.0 parser for EIV.
 *
 * Faithful behaviour port of old_eiv_code/Source/Unit3.pas `Open1Click`
 * (which read a configurable grammar table from Unit7/Form3.StringGrid1).
 * The Pascal walked the file char-by-char with a user-editable token table;
 * we implement the same LAS 2.0 grammar directly (the grammar table's cells
 * were just the standard LAS delimiters: section '~', comment '#', unit
 * delimiter '.', description ':', the 'PAD' curve prefix, '[' / ']', and the
 * STRT./STOP./STEP./NULL. mnemonics).
 *
 * What it extracts (matching Unit3's globals):
 *   - sections + their lines (Form2.ComboBox1 / Form5 viewer)
 *   - STRT / STOP / STEP / NULL from ~WELL  (matintro[18..20], error)
 *   - the ~CURVE mnemonic list, and PADn[m] detection → padCount,
 *     buttonsPerPad, firstPadCol, lastPadCol (matintro[2], matintro[3],
 *     Form6.Edit3/Edit4)
 *   - the ~ASCII numeric matrix (the data the `datareader` averages)
 */
import type { LasCurve, LasFile, LasWellInfo } from "./types.js";

/** Identify a LAS section by the letter right after '~'. */
function sectionKind(headerLine: string): string {
  // "~CURVE INFORMATION" → "CURVE INFORMATION"; "~A" / "~ASCII" → data.
  return headerLine.replace(/^~/, "").trim().toUpperCase();
}

/** Does a section header start the ASCII data block? (~A, ~ASCII, ~A ...). */
function isAsciiHeader(headerLine: string): boolean {
  const body = headerLine.replace(/^~/, "").trim().toUpperCase();
  return body === "" ? false : body[0] === "A";
}

/**
 * Parse one ~WELL / ~CURVE info line:
 *   MNEM .UNIT   DATA            : DESCRIPTION
 * Returns { mnem, unit, data, description }. Robust to missing pieces.
 */
function parseInfoLine(line: string): {
  mnem: string; unit: string; data: string; description: string;
} {
  // Split off the description after the FIRST ':'.
  const colon = line.indexOf(":");
  const left = colon >= 0 ? line.slice(0, colon) : line;
  const description = colon >= 0 ? line.slice(colon + 1).trim() : "";
  // mnemonic is everything up to the first '.', unit is the token right
  // after the '.', data is the rest of `left`.
  const dot = left.indexOf(".");
  if (dot < 0) {
    return { mnem: left.trim(), unit: "", data: "", description };
  }
  const mnem = left.slice(0, dot).trim();
  const afterDot = left.slice(dot + 1);
  // Unit is the leading non-space run after the dot; data is the remainder.
  const m = afterDot.match(/^(\S*)\s*(.*)$/);
  const unit = m ? m[1] : "";
  const data = m ? m[2].trim() : afterDot.trim();
  return { mnem, unit, data, description };
}

/** Pull the first signed float out of a string (handles "6100.00069 :…"). */
function firstFloat(s: string): number {
  const m = s.match(/-?\d+(\.\d+)?([eE][-+]?\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

/** FMI pad letter → 1-based pad number (old_fmi_code/Unit10.pas:382-580). */
const FMI_PAD_LETTER: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

/**
 * Detect an imaging-button curve and return {pad, button} (pad 1-based, button
 * 0-based) or null. Two naming schemes are recognised:
 *
 *   PADn[m]          — EIV casing-inspection logs (old_eiv_code/Unit3.pas). Pad
 *                      n, button m as written. Accepts loose spacing.
 *   FC{A|B|C|D}r[m]  — Schlumberger FMI borehole-image logs (e.g. FCD4[0],
 *                      FCA1[11]). Pad letter A→1…D→4; the 4 sensor rows r=1..4
 *                      are folded into the button axis so each pad has 48
 *                      buttons: button = (r-1)*12 + m. (old_fmi_code/Unit10.pas:
 *                      382-580 lists all 192 FMI channels.)
 */
function detectPad(mnem: string): { pad: number; button: number } | null {
  const up = mnem.toUpperCase();
  const fmi = up.match(/^FC([A-D])([1-4])\s*\[\s*(\d+)\s*\]$/);
  if (fmi) {
    const pad = FMI_PAD_LETTER[fmi[1]];
    const row = parseInt(fmi[2], 10);     // 1..4
    const idx = parseInt(fmi[3], 10);     // 0..11
    return { pad, button: (row - 1) * 12 + idx };
  }
  const m = up.match(/PAD\s*(\d+)\s*\[\s*(\d+)\s*\]/);
  if (!m) return null;
  return { pad: parseInt(m[1], 10), button: parseInt(m[2], 10) };
}

export function parseLas(text: string, fileName?: string): LasFile {
  // Normalise line endings; keep blank lines out.
  const rawLines = text.split(/\r\n|\r|\n/);

  const sections: Record<string, string[]> = {};
  const sectionOrder: string[] = [];
  let currentSection: string | null = null;
  let asciiStartIdx = -1;

  // First pass: bucket non-comment lines into sections; find the ~A block.
  const lines: string[] = [];
  for (const raw of rawLines) lines.push(raw);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (trimmed.startsWith("~")) {
      const name = sectionKind(trimmed);
      currentSection = name;
      if (!sections[name]) { sections[name] = []; sectionOrder.push(name); }
      if (isAsciiHeader(trimmed)) { asciiStartIdx = i + 1; break; }
      continue;
    }
    if (currentSection === null) continue;
    if (trimmed.startsWith("#")) continue;       // comment
    if (trimmed.trim() === "") continue;          // blank
    sections[currentSection].push(line);
  }

  // ── ~WELL → STRT/STOP/STEP/NULL ───────────────────────────────────────
  const wellSectionName = sectionOrder.find((s) => s.startsWith("WELL"));
  const well: LasWellInfo = { strt: 0, stop: 0, step: 0, nullValue: -999.25 };
  if (wellSectionName) {
    for (const line of sections[wellSectionName]) {
      const { mnem, data } = parseInfoLine(line);
      const key = mnem.toUpperCase();
      if (key === "STRT") well.strt = firstFloat(data || line);
      else if (key === "STOP") well.stop = firstFloat(data || line);
      else if (key === "STEP") well.step = firstFloat(data || line);
      else if (key === "NULL") well.nullValue = firstFloat(data || line);
    }
  }

  // ── ~CURVE → curve list + PADn[m] detection ───────────────────────────
  const curveSectionName = sectionOrder.find((s) => s.startsWith("CURVE"));
  const curves: LasCurve[] = [];
  if (curveSectionName) {
    for (const line of sections[curveSectionName]) {
      const { mnem, unit, description } = parseInfoLine(line);
      if (!mnem) continue;
      const pad = detectPad(mnem);
      curves.push({
        mnemonic: mnem, unit, description,
        pad: pad ? pad.pad : null,
        button: pad ? pad.button : null,
      });
    }
  }

  // Pad geometry: padCount = max pad number; buttonsPerPad = max button+1.
  let padCount = 0;
  let maxButton = -1;
  let firstPadCol = -1;
  let lastPadCol = -1;
  curves.forEach((c, col) => {
    if (c.pad !== null && c.button !== null) {
      if (c.pad > padCount) padCount = c.pad;
      if (c.button > maxButton) maxButton = c.button;
      if (firstPadCol < 0) firstPadCol = col;
      lastPadCol = col;
    }
  });
  const buttonsPerPad = maxButton >= 0 ? maxButton + 1 : 0;

  // Explicit (pad,button) → data-column map + aux-curve map. Built from the
  // actual curve positions so the tensor builder needs no positional arithmetic
  // (FMI pad columns are non-contiguous and reverse-ordered — see types.ts).
  const padCol = new Array<number>(padCount * buttonsPerPad).fill(-1);
  const auxCols: Record<string, number> = {};
  curves.forEach((c, col) => {
    if (c.pad !== null && c.button !== null) {
      padCol[(c.pad - 1) * buttonsPerPad + c.button] = col;
    } else if (c.mnemonic) {
      // First occurrence wins (LAS mnemonics are unique in practice).
      const key = c.mnemonic.toUpperCase();
      if (!(key in auxCols)) auxCols[key] = col;
    }
  });

  // ── WRAP mode (from ~VERSION) ─────────────────────────────────────────
  // WRAP=YES → each depth record's values are spread across MULTIPLE physical
  // lines (the index is on its own line, then the curve values wrap). We must
  // reassemble one logical row per depth = exactly `curves.length` numbers.
  // WRAP=NO → one physical line per depth (the simple case).
  let wrap = false;
  const versionSectionName = sectionOrder.find((s) => s.startsWith("VERSION"));
  if (versionSectionName) {
    for (const line of sections[versionSectionName]) {
      const { mnem, data: d } = parseInfoLine(line);
      if (mnem.toUpperCase() === "WRAP") {
        wrap = /^Y/i.test((d || line.split(".").pop() || "").trim());
        break;
      }
    }
  }

  // ── ~ASCII data matrix ────────────────────────────────────────────────
  const data: number[][] = [];
  const curveCount = curves.length;
  if (asciiStartIdx >= 0) {
    if (wrap && curveCount > 1) {
      // Flatten every numeric token in the data section, then regroup into
      // rows of `curveCount`. This is robust to however the producer wrapped
      // the lines (LAS 2.0 guarantees curveCount values per depth record).
      let row: number[] = [];
      for (let i = asciiStartIdx; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t === "" || t.startsWith("#") || t.startsWith("~")) continue;
        const toks = t.split(/[\s,;]+/).filter((x) => x.length > 0);
        for (const tok of toks) {
          const v = Number(tok);
          row.push(Number.isFinite(v) ? v : NaN);
          if (row.length === curveCount) { data.push(row); row = []; }
        }
      }
      if (row.length > 0) data.push(row); // trailing partial record (rare)
    } else {
      for (let i = asciiStartIdx; i < lines.length; i++) {
        const t = lines[i].trim();
        if (t === "" || t.startsWith("#") || t.startsWith("~")) continue;
        const toks = t.split(/[\s,;]+/).filter((x) => x.length > 0);
        if (toks.length === 0) continue;
        data.push(toks.map((tok) => {
          const v = Number(tok);
          return Number.isFinite(v) ? v : NaN;
        }));
      }
    }
  }

  return {
    sections, sectionOrder, well, curves,
    padCount, buttonsPerPad, firstPadCol, lastPadCol,
    padCol, auxCols,
    data, fileName,
  };
}
