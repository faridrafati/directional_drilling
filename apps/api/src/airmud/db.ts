/**
 * Air & Gas Drilling — sample wells read from the converted Access→SQLite
 * databases (old_air_mud_code/*.sqlite) via the built-in `node:sqlite`, instead
 * of hardcoded presets. Maps the legacy tables to AirMudInput:
 *
 *   BitRun (the WellName='11' row)  → all scalar params + fluid type
 *       SURFFLOW/SURFTEMP, GSPECGRV/MOLEWT/HEATC, SSPECGRV, PREDROP→rop,
 *       ELEVATION/GEOTHERM, TVDOut, OH/DPROUGH, BitSize, MudWt, PV→mudVis,
 *       MUDFLOW→mudFlow (absent/0 ⇒ dry gas; >0 ⇒ aerated mist).
 *   Casing (named rows, by DTOP)    → casing program  [{id,dTop,dBtm}]
 *   DrillString (by IDENTITY)       → BHA (top→bottom) [{size,id,length,type}]
 *   FixedNozzles (Noz1..15)         → nozzles[]
 */
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import type { AirMudInput } from "@dd/shared/air-mud";

type Row = Record<string, unknown>;

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_DIR = process.env.AIRMUD_DB_DIR ?? join(HERE, "..", "..", "..", "..", "old_air_mud_code");

const SAMPLES = [
  { id: "drygas", label: "DRYGAS sample", file: "DRYGAS.sqlite" },
  { id: "aerated", label: "AREATED MUD sample", file: "AREATED MUD.sqlite" },
];

const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
/**
 * Numeric reader that strips the float noise left by the Access→SQLite
 * conversion (e.g. 6699.00000000001 → 6699, 10050.000000000013 → 10050).
 * Without this, the BHA total ≠ TD by ~1e-12 and the densified pressure
 * profile sprouts spurious press=0 rows at the bit boundary. `toPrecision(12)`
 * keeps 12 significant figures — well beyond any real input precision.
 */
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toPrecision(12)) : 0;
};

/** Map one sample SQLite to an AirMudInput, or null if the file is missing. */
function readSample(file: string): AirMudInput | null {
  const path = join(DB_DIR, file);
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    // The configured well row (the other BitRun row is the blank default).
    const br = db.prepare(`SELECT * FROM BitRun WHERE CAST(BitSize AS REAL) > 0 ORDER BY rowid DESC LIMIT 1`).get() as Row | undefined;
    if (!br) return null;
    const mudFlow = num(br.MUDFLOW);

    const casingRows = db.prepare(`SELECT ID, DTOP, DBTM, CASINGNAME FROM Casing ORDER BY DTOP, rowid`).all() as Row[];
    const named = casingRows.filter((r) => s(r.CASINGNAME));
    const casing = (named.length ? named : casingRows).map((r) => ({ id: num(r.ID), dTop: num(r.DTOP), dBtm: num(r.DBTM) }));

    const bha = (db.prepare(`SELECT Size, ID, Length, BHATYPE FROM DrillString ORDER BY IDENTITY`).all() as Row[])
      .map((r) => ({ size: num(r.Size), id: num(r.ID), length: num(r.Length), type: s(r.BHATYPE) || undefined }));

    const nz = db.prepare(`SELECT * FROM FixedNozzles LIMIT 1`).get() as Row | undefined;
    const total = num(br.TotalNumberofNozzles);
    const nozzles: number[] = [];
    if (nz) {
      for (let i = 1; i <= 15; i++) {
        const v = num(nz[`Noz${i}`]);
        if (total > 0 ? i <= total : v > 0) nozzles.push(v);
      }
    }

    return {
      calcType: mudFlow > 0 ? "aerated" : "gas",
      surfFlow: num(br.SURFFLOW), surfTemp: num(br.SURFTEMP),
      gasSg: num(br.GSPECGRV), moleWt: num(br.MOLEWT), heatC: num(br.HEATC),
      solidSg: num(br.SSPECGRV), rop: num(br.PREDROP),
      elevation: num(br.ELEVATION), geotherm: num(br.GEOTHERM),
      tvdOut: num(br.TVDOut), ohRough: num(br.OHROUGH), dpRough: num(br.DPROUGH),
      bitSize: num(br.BitSize), mudFlow, mudWt: num(br.MudWt), mudVis: num(br.PV),
      casing, bha, nozzles,
    };
  } finally {
    db.close();
  }
}

/** True when at least one sample SQLite is present on disk. */
export function airmudAvailable(): boolean {
  return SAMPLES.some((x) => existsSync(join(DB_DIR, x.file)));
}

/** All sample wells, read fresh from the SQLite files. */
export function listAirmudSamples(): { id: string; label: string; input: AirMudInput }[] {
  const out: { id: string; label: string; input: AirMudInput }[] = [];
  for (const sm of SAMPLES) {
    const input = readSample(sm.file);
    if (input) out.push({ id: sm.id, label: sm.label, input });
  }
  return out;
}
