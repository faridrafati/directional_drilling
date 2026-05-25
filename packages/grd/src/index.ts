/**
 * Petrel / Landmark style ASCII grid (.grd) parser.
 *
 * Port of `FieldExtract` in old_delphi_code/Unit21.pas:328-602.
 *
 * File format:
 *   Line 1:   FSASCI 0 1 "<err>" 0 ...     ← <err> is the null-data sentinel (default 1.0e30)
 *   Line 2:   FSATTR 0 0
 *   Lines:    !<key>: <value> [unit]       ← metadata, terminated by first non-! line
 *   Line:     ->MSMODL: Surface of zN      ← (sometimes) data-block separator
 *   Then:     NCOL × NROW float values in column-major order, wrapped across
 *             N values per text line (typically 5).
 *
 * Unit codes follow Unit23.pas:conversion (1=cm, 2=m, 3=km, 4=ft, 5=yd, 6=mi, 7=nmi).
 * We emit the parsed unit as a LengthUnit string so the rest of the system
 * doesn't need that integer encoding.
 */

export type GrdLengthUnit = "cm" | "m" | "km" | "ft" | "yd" | "mi" | "nmi";

export interface GrdHeader {
  /** Null-data sentinel value (commonly 1.0e30 in Petrel exports). */
  errorValue: number;
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  /** Cell width in `units`. */
  xinc: number;
  yinc: number;
  /** Number of columns (X direction). */
  ncol: number;
  /** Number of rows (Y direction). */
  nrow: number;
  /** Horizontal length unit declared in the header (defaults to "m"). */
  units: GrdLengthUnit;
}

export interface GrdFile extends GrdHeader {
  /** Column-major Float32Array of length ncol*nrow. data[col*nrow + row]. */
  data: Float32Array;
}

const UNIT_CODES: Record<string, GrdLengthUnit> = {
  m: "m",
  km: "km",
  ft: "ft",
  yd: "yd",
  ml: "mi",  // Pascal abbreviates "mile" as "ml"
  nm: "nmi", // and "nautical mile" as "nm"
  cm: "cm",
};

/**
 * Parse a .grd file from text.
 * Throws on missing required metadata or malformed data.
 */
export function parseGrd(text: string): GrdFile {
  const lines = text.split(/\r?\n/);
  let i = 0;

  // Line 1: FSASCI header.
  //   `FSASCI 0 1 "1.0e30" 0 1000000000.000000 0`
  // The 6th whitespace-separated token is the null-data sentinel (the Pascal
  // parser counts to jj=6 in Unit21.pas:367). The quoted "1.0e30" is just a
  // max-value marker, NOT the sentinel. We canonicalize through Float32 so
  // === comparisons against parsed cell values are exact.
  let errorValue = new Float32Array([1e30])[0];
  if (lines[i]?.startsWith("FSASCI")) {
    // Pascal counts whitespace-separated tokens; quotes are part of token #4.
    // Token #6 (1-based) = index 5 here is the sentinel.
    const tokens = lines[i].trim().split(/\s+/);
    const sentinelTok = tokens[5];
    if (sentinelTok !== undefined) {
      const v = parseFloat(sentinelTok);
      if (isFinite(v)) errorValue = new Float32Array([v])[0];
    }
    i++;
  }
  // Line 2: FSATTR (skip)
  if (lines[i]?.startsWith("FSATTR")) i++;

  // Skip until first `!` line.
  while (i < lines.length && !lines[i].startsWith("!")) i++;

  // Parse metadata.
  const meta: Partial<GrdHeader> = { errorValue, units: "m" };
  while (i < lines.length && lines[i].startsWith("!")) {
    const stripped = lines[i].slice(1).trim();
    parseMetaLine(stripped, meta);
    i++;
  }

  // Validate.
  for (const k of ["xmin", "xmax", "ymin", "ymax", "xinc", "yinc", "ncol", "nrow"] as const) {
    if (meta[k] === undefined) throw new Error(`.grd: missing ${k.toUpperCase()}`);
  }
  const header = meta as GrdHeader;

  // Skip non-data lines until we hit a data line.
  // Pascal: `while (line[1]<>' ') do readln(f,line)` — first data line starts with space.
  while (i < lines.length && (lines[i] === "" || !lines[i].startsWith(" "))) i++;

  // Read the entire remaining data stream as whitespace-separated floats.
  const flat = new Float32Array(header.ncol * header.nrow);
  let written = 0;
  for (; i < lines.length; i++) {
    const tokens = lines[i].trim().split(/\s+/).filter(Boolean);
    for (const tok of tokens) {
      if (written >= flat.length) break;
      flat[written++] = parseFloat(tok);
    }
    if (written >= flat.length) break;
  }
  if (written < flat.length) {
    throw new Error(
      `.grd: expected ${flat.length} cell values, got ${written} ` +
        `(ncol=${header.ncol} × nrow=${header.nrow})`
    );
  }

  return { ...header, data: flat };
}

/** Process one ! metadata line into the partial header. */
function parseMetaLine(line: string, meta: Partial<GrdHeader>) {
  // Examples:
  //   "VOI Box           XMIN: 2001200.00000 m"
  //   "                  XMAX: 2024600.00000 m"
  //   "Lattice           XINC: 50.000000 m"
  //   "                  NCOL: 469"
  const m = line.match(
    /\b(XMIN|XMAX|YMIN|YMAX|XINC|YINC|NCOL|NROW):\s+(\S+)(?:\s+(\S+))?/
  );
  if (!m) return;
  const key = m[1];
  const value = parseFloat(m[2]);
  const unitTok = m[3];
  if (unitTok && UNIT_CODES[unitTok]) meta.units = UNIT_CODES[unitTok];

  switch (key) {
    case "XMIN": meta.xmin = value; break;
    case "XMAX": meta.xmax = value; break;
    case "YMIN": meta.ymin = value; break;
    case "YMAX": meta.ymax = value; break;
    case "XINC": meta.xinc = value; break;
    case "YINC": meta.yinc = value; break;
    case "NCOL": meta.ncol = value; break;
    case "NROW": meta.nrow = value; break;
  }
}

/** Get the cell value at (col, row); returns NaN for null-data. */
export function cellAt(grid: GrdFile, col: number, row: number): number {
  if (col < 0 || col >= grid.ncol || row < 0 || row >= grid.nrow) return NaN;
  const v = grid.data[col * grid.nrow + row];
  return v === grid.errorValue ? NaN : v;
}

/** Compute min/max of valid (non-error) cells. */
export function gridRange(grid: GrdFile): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < grid.data.length; i++) {
    const v = grid.data[i];
    if (v === grid.errorValue) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) return { min: 0, max: 0 };
  return { min, max };
}

/** Serialize a parsed grid back to Float32Array bytes for storage. */
export function gridToBytes(grid: GrdFile): Uint8Array {
  return new Uint8Array(grid.data.buffer, grid.data.byteOffset, grid.data.byteLength);
}

/** Reconstruct a grid value array from stored bytes + header. */
export function gridFromBytes(header: GrdHeader, bytes: Uint8Array): GrdFile {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return { ...header, data: new Float32Array(buf) };
}
