/**
 * DDR (Daily Drilling Report) read-only data layer.
 *
 * Reads the legacy Access→SQLite databases directly (old_report_code/) through
 * the built-in `node:sqlite` — no migration, no extra dependency, opened
 * read-only. The original Delphi schema is preserved verbatim, so we encode the
 * legacy table/column names + join keys here, resolve the foreign-key *Code
 * columns against their lookup tables, and trim the fixed-width space padding
 * left by the .mdb→.sqlite conversion.
 *
 *   A01                 wells (master)        WellCode (PK)
 *   L04                 daily report header   WellCode + SerialNo, date=DrillingDate
 *   L05                 bit records           WellCode + SerialNo   (BitCode→Bit, ReasonPulledCode→ReasonPulled)
 *   N01                 mud properties        WellCode + SerialNo   (MudCode→MudType)
 *   M04                 directional surveys   WellCode + SerialNo
 *   L08                 casing                WellCode + SerialNo   (CasingCode→Casing)
 *   D07                 formation tops        WellCode + SerialNo   (FormCode→Formation)
 *   OperationAnalysis   operations log        WellCode + SerialNo   (OperationCode→Operations)
 *   BottomHoleAssembly  BHA                   WellCode + fDate
 *   TimeAnalysis        time breakdown        WellCode + fDate      (Activity{Group,Type,}Code→Activities)
 *
 * Dates are Jalali (Shamsi) strings, e.g. "1395/01/06" — handled in the web UI.
 */
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  mseTeale, estimateTorque, MU_DEFAULT, hsiFromHydraulics,
  tfaFromNozzles, parseBitSizeInches, bitClass, type BitClass,
} from "@dd/shared/drilling";

type Row = Record<string, unknown>;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..", "..");

/**
 * WHERE THE LEGACY DBs LIVE — resolved by SEARCHING, not by one hard-coded path.
 *
 * new.sqlite is 438 MB and gitignored, so it is wherever a given machine happens
 * to keep it, and that location has already moved twice: the tree was
 * `old_report_code/` at fd7119b, became `old/old_report_code/` when the legacy
 * Delphi trees were relocated in 9b6534d, and on a machine where only the two
 * .sqlite files were kept rather than the whole Delphi tree they sit in
 * `sqlite_DB/`. A single hard-coded default turns every one of those layouts
 * into a bare "not found on this machine" with no clue which path was wanted —
 * which is exactly how this surfaced.
 *
 * The first candidate that actually CONTAINS new.sqlite wins. DDR_DB_DIR still
 * overrides everything, and remains the answer for a machine that keeps the
 * archive outside the repo altogether.
 */
const DB_CANDIDATES: string[] = [
  process.env.DDR_DB_DIR,
  join(REPO, "old", "old_report_code"),
  join(REPO, "old_report_code"),
  join(REPO, "sqlite_DB"),
].filter((d): d is string => !!d);

/** Every place we looked — reported by /ddr/status so a miss is diagnosable. */
export const ddrSearchedPaths = (): string[] => [...DB_CANDIDATES];

const DB_DIR = DB_CANDIDATES.find((d) => existsSync(join(d, "new.sqlite"))) ?? DB_CANDIDATES[0];
export const ddrDbDir = (): string => DB_DIR;

const DATA_DB = join(DB_DIR, "new.sqlite");
const LOOKUP_DB = join(DB_DIR, "DB.sqlite");
/**
 * Geological lithology pattern tiles (DDR-Delphi/LITHO/<HatchName>.bmp).
 *
 * Resolved independently of the DBs: a machine that kept only the two .sqlite
 * files has no Delphi tree at all, and the tiles may sit beside a DIFFERENT
 * candidate than the one the DBs were found in. Every reader below already
 * treats an absent folder as "no tiles", so a miss degrades the hatch patterns
 * rather than the page.
 */
const LITHO_DIR = DB_CANDIDATES
  .map((d) => join(d, "DDR-Delphi", "LITHO"))
  .find((d) => existsSync(d)) ?? join(DB_DIR, "DDR-Delphi", "LITHO");

let _data: DatabaseSync | null = null;
let _lookupConn: DatabaseSync | null = null;

/** True when the legacy data DB is present on disk (it's gitignored — 438 MB). */
export function ddrAvailable(): boolean {
  return existsSync(DATA_DB);
}

function data(): DatabaseSync {
  if (!_data) {
    if (!existsSync(DATA_DB)) throw new Error(`DDR database not found at ${DATA_DB}`);
    _data = new DatabaseSync(DATA_DB, { readOnly: true });
  }
  return _data;
}

// ── value helpers (trim the Access fixed-width padding) ─────────────────────
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const orNull = (v: unknown): unknown => {
  const t = s(v);
  return t === "" || t.toLowerCase() === "none" ? null : (typeof v === "string" ? t : v);
};
/** Cleaner for cell values: trim padding, coerce numeric strings → numbers,
 *  and map blank / "None" → null. Dates ("1391/01/06") stay text. */
const val = (v: unknown): unknown => {
  if (typeof v === "number") return v;
  const t = s(v);
  if (t === "" || t.toLowerCase() === "none") return null;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t;
};
/** "a–b" for a min/max pair, collapsing equal or empty ends. */
const range = (a: unknown, b: unknown): string | null => {
  const x = s(a), y = s(b);
  if (x && y && x !== y) return `${x}–${y}`;
  return x || y || null;
};

// ── lookups (code → display name), loaded once, trimmed ─────────────────────
interface Lookups {
  bit: Map<string, string>; bitSize: Map<string, string>; bitType: Map<string, string>; bitIADC: Map<string, string>; bitMake: Map<string, string>;
  mud: Map<string, string>; formation: Map<string, string>;
  operation: Map<string, string>; field: Map<string, string>; casing: Map<string, string>;
  reasonPulled: Map<string, string>; holeSize: Map<string, string>; contractor: Map<string, string>;
  wellType: Map<string, string>; wellProfile: Map<string, string>; company: Map<string, string>;
  zone: Map<string, string>; activityGroup: Map<string, string>;
  activityType: Map<string, string>; activity: Map<string, string>;
  material: Map<string, string>; measure: Map<string, string>;
  jarType: Map<string, string>; dhMotorType: Map<string, string>;
}
let _lk: Lookups | null = null;

function buildMap(table: string, keyCol: string, label: (r: Row) => string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of data().prepare(`SELECT * FROM "${table}"`).all() as Row[]) {
    const k = s(r[keyCol]);
    if (k) m.set(k, label(r));
  }
  return m;
}

function lookups(): Lookups {
  if (_lk) return _lk;
  const join2 = (a: unknown, b: unknown) => `${s(a)}|${s(b)}`;
  const join3 = (a: unknown, b: unknown, c: unknown) => `${s(a)}|${s(b)}|${s(c)}`;
  const activityType = new Map<string, string>();
  for (const r of data().prepare(`SELECT * FROM ActivityTypes`).all() as Row[])
    activityType.set(join2(r.ActivityGroupCode, r.ActivityTypeCode), s(r.ActivityType));
  const activity = new Map<string, string>();
  for (const r of data().prepare(`SELECT * FROM Activities`).all() as Row[])
    activity.set(join3(r.ActivityGroupCode, r.ActivityTypeCode, r.ActivityCode), s(r.ActivityName));

  _lk = {
    bit: buildMap("Bit", "BitCode", (r) =>
      [s(r.BitName), s(r.Size), s(r.Type)].filter((v) => v && v !== "None").join("  ")),
    bitSize: buildMap("Bit", "BitCode", (r) => s(r.Size)),
    bitType: buildMap("Bit", "BitCode", (r) => s(r.Type)),
    bitIADC: buildMap("Bit", "BitCode", (r) => s(r.IADC)),
    bitMake: buildMap("Bit", "BitCode", (r) => s(r.Make)),
    mud: buildMap("MudType", "MudCode", (r) => s(r.MudName)),
    formation: buildMap("Formation", "FormCode", (r) => s(r.FormLat) || s(r.FormAbri)),
    operation: buildMap("Operations", "OperationCode", (r) => s(r.OperationDesc)),
    field: buildMap("Fields", "FieldCode", (r) => s(r.FieldName) || s(r.FieldAbri)),
    casing: buildMap("Casing", "CasingCode", (r) =>
      [s(r.CasingName), s(r.Grade)].filter((v) => v && v !== "None").join("  ")),
    reasonPulled: buildMap("ReasonPulled", "ReasonPulledCode", (r) => s(r.ReasonPulled)),
    holeSize: buildMap("HoleSize", "HoleSizeCode", (r) => s(r.HoleSize)),
    contractor: buildMap("Contractor", "ContractorCode", (r) => s(r.Contractor)),
    wellType: buildMap("WellType", "WellTypeCode", (r) => s(r.WellType)),
    wellProfile: buildMap("WellProfiles", "WellProfileCode", (r) => s(r.WellProfileName)),
    company: buildMap("Companies", "CompanyCode", (r) => s(r.CompanyName)),
    zone: buildMap("Zone", "ZoneCode", (r) => s(r.ZoneName)),
    activityGroup: buildMap("ActivityGroups", "ActivityGroupCode", (r) => s(r.ActivityGroup)),
    material: buildMap("Materials", "MaterialCode", (r) => s(r.Material)),
    measure: buildMap("Measures", "MeasureCode", (r) => s(r.Measure)),
    jarType: buildMap("JarType", "JarTypeCode", (r) => s(r.JarType)),
    dhMotorType: buildMap("DHMotorType", "DHMotorTypeCode", (r) => s(r.DHMotorType)),
    activityType, activity,
  };
  return _lk;
}

const look = (m: Map<string, string>, code: unknown): string | null => {
  const k = s(code);
  return k ? m.get(k) ?? k : null;
};

/** Base wellbore code: strip a trailing sidetrack / leg suffix (ST / WIN / LEG +
 *  run number) that appears AFTER the field-number dash, so a well and its legs
 *  / sidetracks collapse to one base (e.g. AB-006Leg1 → AB-006). Workover (WO)
 *  and CTU codes are left intact — in the source they are separate wells with
 *  their own A01 names (ABAN-002WO1, ABAN-006CTU128), not legs of the base. */
function baseWellCode(wellCode: string): string {
  const dash = wellCode.indexOf("-");
  if (dash < 0) return wellCode;
  let base = wellCode;
  for (const suf of ["ST", "WIN", "LEG"]) {
    const i = base.toUpperCase().indexOf(suf);
    if (i > dash) base = base.slice(0, i);
  }
  return base;
}

// ── public queries ──────────────────────────────────────────────────────────

/** Wells that have at least one daily report, with field name + date span. */
export function listWells(): Row[] {
  const lk = lookups();
  const rows = data().prepare(`
    SELECT a.WellCode AS wellCode, a.EnglishName AS name, a.FarsiName AS farsiName,
           a.FieldCode AS fieldCode, a.RIG AS rig,
           COUNT(l.SerialNo) AS reportCount,
           MIN(l.DrillingDate) AS firstDate, MAX(l.DrillingDate) AS lastDate
    FROM A01 a JOIN L04 l ON l.WellCode = a.WellCode
    GROUP BY a.WellCode
    ORDER BY reportCount DESC, name
  `).all() as Row[];
  return rows.map((r) => ({
    wellCode: s(r.wellCode), name: orNull(r.name), farsiName: orNull(r.farsiName),
    field: look(lk.field, r.fieldCode), rig: orNull(r.rig),
    reportCount: r.reportCount, firstDate: orNull(r.firstDate), lastDate: orNull(r.lastDate),
  }));
}

/** Daily reports for one well, newest first. */
export function listReports(wellCode: string): Row[] {
  return (data().prepare(`
    SELECT SerialNo AS serialNo, DrillingDate AS date, FromPoint AS fromPoint,
           ToPoint AS toPoint, MorningDepth AS morningDepth, TotalMeter AS totalMeter,
           TotalDRHour AS totalHours, EngName AS engineer, Description AS description
    FROM L04 WHERE WellCode = ? ORDER BY SerialNo DESC
  `).all(wellCode) as Row[]).map((r) => ({
    serialNo: r.serialNo, date: orNull(r.date), fromPoint: val(r.fromPoint), toPoint: val(r.toPoint),
    morningDepth: val(r.morningDepth), totalMeter: val(r.totalMeter), totalHours: val(r.totalHours),
    engineer: orNull(r.engineer), description: orNull(r.description),
  }));
}

/** One full daily report: header + every section, codes resolved, trimmed. */
export function getReport(wellCode: string, serialNo: number): Record<string, unknown> | null {
  const db = data();
  const lk = lookups();
  const raw = db.prepare(`SELECT * FROM L04 WHERE WellCode = ? AND SerialNo = ?`)
    .get(wellCode, serialNo) as Row | undefined;
  if (!raw) return null;

  const fDate = s(raw.DrillingDate);
  // Section tables join L04 by DATE — their SerialNo is a per-table row index,
  // NOT the report serial (verified: every L05/N01/M04/L08/OperationAnalysis row
  // matches by well+fDate, far better than by serial). D07 formation tops have
  // no date and are well-level (the geological column), so they join by well.
  const byDate = (t: string) =>
    db.prepare(`SELECT * FROM "${t}" WHERE WellCode = ? AND fDate = ?`).all(wellCode, fDate) as Row[];
  const byWell = (t: string) =>
    db.prepare(`SELECT * FROM "${t}" WHERE WellCode = ?`).all(wellCode) as Row[];

  // Header: trim every string + resolve the hole-size code in place.
  const header: Row = {};
  for (const k of Object.keys(raw)) header[k] = val(raw[k]);
  header.HoleSizeCode = look(lk.holeSize, raw.HoleSizeCode);

  // Resolved "Well / Operations" fields the DR.xls sheet shows but L04 doesn't
  // store directly (ported from Unit10.pas, the printable DR form, cells 11–25).
  const numv = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : null; };
  const toP = numv(raw.ToPoint), fromP = numv(raw.FromPoint);
  // METERAGE = the day's drilled interval (ToPoint − FromPoint).
  header.Meterage = toP != null && fromP != null ? val(toP - fromP) : val(raw.TotalMeter);
  // FORMATION = deepest formation top at/above the day's depth (D07 is well-level).
  const fRow = toP != null
    ? (db.prepare(`SELECT FormCode, DepthPoint FROM D07 WHERE WellCode = ? AND DepthPoint <= ? ORDER BY DepthPoint DESC LIMIT 1`).get(wellCode, toP) as Row | undefined)
    : undefined;
  const fName = fRow ? look(lk.formation, fRow.FormCode) : null;
  header.Formation = fName ? `${fName} @ ${val(fRow!.DepthPoint)}` : null;
  // LAST CASING = deepest casing run on/before this date.
  const cRow = db.prepare(`SELECT DepthPoint, CasingCode FROM L08 WHERE WellCode = ? AND fDate <= ? ORDER BY DepthPoint DESC LIMIT 1`).get(wellCode, fDate) as Row | undefined;
  const cName = cRow ? look(lk.casing, cRow.CasingCode) : null;
  header.LastCasing = cName ? `${cName} @ ${val(cRow!.DepthPoint)}` : null;
  // LINER LAP = top of the most recent liner run on/before this date.
  const lRow = db.prepare(`SELECT FromPoint, LinerCode FROM L06 WHERE WellCode = ? AND fDate <= ? ORDER BY fDate DESC, FromPoint LIMIT 1`).get(wellCode, fDate) as Row | undefined;
  const lName = lRow ? look(lk.casing, lRow.LinerCode) : null;
  header.LinerLap = lRow ? `${lName ? lName + " " : ""}@ ${val(lRow.FromPoint)}` : null;
  // KOP = kick-off-point depth recorded for this day (with start point).
  const kRow = db.prepare(`SELECT Depth FROM KickOfPoint WHERE WellCode = ? AND fDate = ? LIMIT 1`).get(wellCode, fDate) as Row | undefined;
  header.KOP = kRow ? val(kRow.Depth) : null;
  // Mud volume balance for the day (N05): formation loss / loss-at-units / gains.
  const n05 = db.prepare(`SELECT TotalLossesAmount, LossesAtUnit, TotalGainAmount FROM N05 WHERE WellCode = ? AND fDate = ? LIMIT 1`).get(wellCode, fDate) as Row | undefined;
  header.FormationLoss = n05 ? val(n05.TotalLossesAmount) : null;
  header.MudLossUnit = n05 ? val(n05.LossesAtUnit) : null;
  header.MudGains = n05 ? val(n05.TotalGainAmount) : null;
  // Solid-control equipment for the day (one row): Clay Jactor / Mud Cleaner /
  // Shaker (Unit10.pas rows 47–49). DR.xls cols: HRS, U.F., O.F., FEED, CONS, F.PRS.
  const sc = db.prepare(`SELECT * FROM SolidControlParameter WHERE WellCode = ? AND fDate = ? LIMIT 1`).get(wellCode, fDate) as Row | undefined;
  const scRow = (unit: string, p: string) => ({
    unit, hrs: val(sc?.[`${p}Hour`]), uf: val(sc?.[`${p}UnderFlow`]), of: val(sc?.[`${p}OverFlow`]),
    feed: val(sc?.[`${p}Feed`]), cons: val(sc?.[`${p}Cons`]), fprs: val(sc?.[`${p}FPRS`]),
  });
  const solidControl = sc ? {
    rows: [
      scRow("Clay Jactor", "ClayJactor"),
      scRow("Mud Cleaner", "MudCleaner"),
      { unit: "Shaker", hrs: val(sc.ShakerHour), uf: null, of: null, feed: null, cons: null, fprs: null },
    ],
    shakerScreen: [s(sc.ShakerSize1), s(sc.ShakerSize2)].some(Boolean)
      ? `1: ${s(sc.ShakerSize1) || "—"}    2: ${s(sc.ShakerSize2) || "—"}` : null,
  } : null;
  // Drilling tools — Jar / MWD / DH-Motor (Unit10.pas rows 31/33/35): type, size,
  // serial no, hours. MWD table isn't in the converted DB → that row is null.
  const eqRow = (table: string, szc: string, snc: string, tc: string, tmap: Map<string, string>) => {
    const r = db.prepare(`SELECT * FROM "${table}" WHERE WellCode = ? AND fDate = ? LIMIT 1`).get(wellCode, fDate) as Row | undefined;
    return r ? { type: look(tmap, r[tc]), size: orNull(r[szc]), sn: orNull(r[snc]), hrs: val(r.fHour) } : null;
  };
  const equipment = {
    jar: eqRow("Jar", "JarSize", "JarSerialNo", "JarTypeCode", lk.jarType),
    mwd: null,
    dhMotor: eqRow("DHMotor", "DHMotorSize", "DHMotorSerialNo", "DHMotorTypeCode", lk.dhMotorType),
  };
  // LAST CASING — the casing in hole *as of* the report date, not just casing
  // run that exact day (Unit10.pas: l08 where fDate ≤ wldate, ordered by depth).
  // For a sidetrack the ST/WIN/LEG suffix is stripped so the parent's casing is
  // included; LIKE base% then matches the wellbore + its sidetracks.
  const baseWell = baseWellCode(wellCode);
  const casingRows = db.prepare(
    `SELECT * FROM L08 WHERE WellCode LIKE ? AND fDate <= ? AND CasingCode IS NOT NULL AND TRIM(CasingCode) <> '' ORDER BY DepthPoint`,
  ).all(`${baseWell}%`, fDate) as Row[];

  return {
    header,
    bit: byDate("L05").map((r) => {
      // ROP = bit meterage ÷ bit hours (Unit10.pas cell row 14).
      const bm = Number(r.BitMeterTotal), bh = Number(r.BitHour);
      const rop = Number.isFinite(bm) && Number.isFinite(bh) && bh > 0 ? Number((bm / bh).toFixed(2)) : null;
      // No MudPumpTypes lookup table in the converted DB → show the raw code(s).
      const pumpType = [s(r.MudPumpType1Code), s(r.MudPumpType2Code)].filter((x) => x && x !== "None").join(" / ") || null;
      return {
        "Bit #": val(r.BitNo), "Bit ser.no.": val(r.BitSerialNo),
        "Bit size": look(lk.bitSize, r.BitCode), "Bit type": look(lk.bitType, r.BitCode),
        "IADC code": look(lk.bitIADC, r.BitCode), "Hole size": val(r.HoleSize),
        "Nozzles": val(r.NozzleSize), "TFA": val(r.TFA),
        "From (m)": val(r.FromPoint), "To (m)": val(r.ToPoint),
        "Bit meterage": val(r.BitMeterTotal), "Bit hrs": val(r.BitHour),
        "WOB (klb)": range(r.MinWeight, r.MaxWeight), "RPM": range(r.MinRPM, r.MaxRPM),
        "Torque": range(r.TorqueOnBottom, r.TorqueOffBottom), "ROP (m/h)": rop,
        "Dull (IADC)": [r.ICutterWearCode, r.OCutterWearCode, r.DullCharacteristicCode, r.WearLocationCode,
          r.BearingWearCode, r.GaugeWearCode, r.ODullCharacteristicCode].map((x) => s(x) || "-").join(" "),
        "Reason pulled": look(lk.reasonPulled, r.ReasonPulledCode),
        "Pump type": pumpType,
        "Pump output (gpm)": range(r.PumpOutput1, r.PumpOutput2),
        "Pump pressure": range(r.PumpPressure1, r.PumpPressure2),
        "Annular velocity": val(r.AnnularVelocity), "HSI": val(r.BitHSI),
        "CMT drl (m/h)": range(r.CMTDRLMotor, r.CMTDRLHour),
        "W&R (m/h)": range(r.WAndRMeter, r.WAndRHour),
        "Bit change (in/out)": range(r.BitChangeIn, r.BitChangeOut),
        "Remarks": val(r.Description),
      };
    }),
    mud: byDate("N01").map((r) => {
      // PV / YP from the Fann 600/300 readings (Unit10.pas: PV=θ600−θ300,
      // YP=2·θ300−θ600); null when no readings so we don't print 0/0.
      const f600 = Number(r.Fan600), f300 = Number(r.Fan300);
      const haveFan = Number.isFinite(f600) && Number.isFinite(f300) && (f600 !== 0 || f300 !== 0);
      return {
        "From (m)": val(r.FromPoint), "To (m)": val(r.ToPoint), "Mud type": look(lk.mud, r.MudCode),
        "Max wt": val(r.MaxWeight), "Min wt": val(r.MinWeight), "Rep time": val(r.RepTime),
        "Weight (pcf)": range(r.MinWeight, r.MaxWeight), "Visc (s)": val(r.Viscosity),
        "PV": haveFan ? Number((f600 - f300).toFixed(2)) : null,
        "YP": haveFan ? Number((2 * f300 - f600).toFixed(2)) : null,
        "Fan 600/300": range(r.Fan600, r.Fan300),
        "Initial gel": val(r.InitialGel), "10min gel": val(r.Gel10Minutes),
        "pH": val(r.PH), "ALK": val(r.Alk),
        "Water loss": val(r.WaterLoss), "HPHT": val(r.HPHT),
        "Air/Foam": val(r.AirFoamCFM),
        "Oil %": val(r.OilPercent), "O/W": val(r.OilPerWaterRatio),
        "E-stability": val(r.Stability), "KCl": val(r.KCL),
        "Solids %": val(r.SoildPercent), "Salinity": val(r.Salinity), "Ca": val(r.Calcium),
        "MBT": val(r.MBT), "PF": val(r.PF), "MF": val(r.MF),
        "Temp": val(r.ReturnTemperature), "Remarks": val(r.Description),
      };
    }),
    directional: byDate("M04").map((r) => ({
      "MD (m)": val(r.FromPoint), "Inc (°)": val(r.Angle), "Azi (°)": val(r.Azimuth), "TVD (m)": val(r.TVD),
      "N/S": val(r.N_S), "E/W": val(r.E_W), "Section": val(r.SectionHD), "DLS": val(r.DLS), "VS": val(r.VS),
      "Dir": val(r.Direction), "Remarks": val(r.Description),
    })),
    bha: byDate("BottomHoleAssembly").map((r) => ({
      "Assembly #": val(r.AssemblyNo), "Specification": val(r.Specification),
      "Weight": val(r.Weight), "Length (m)": val(r.Length),
      "Drag up": val(r.DragUp), "Drag down": val(r.DragDown),
    })),
    // Drill-string components for the D/P size / D/P grade rows (Unit10.pas
    // rows 34–35). Stabilizers aren't in the converted DB, so that row stays blank.
    drillString: byDate("DrillString")
      .map((r) => ({ size: orNull(r.fSize), grade: orNull(r.Grade) }))
      .filter((x) => x.size != null || x.grade != null)
      .slice(0, 6),
    casing: casingRows.map((r) => ({
      "Depth (m)": val(r.DepthPoint), "Casing": look(lk.casing, r.CasingCode),
      "Joints": val(r.Joint), "Remarks": val(r.Description),
    })),
    formationTops: byWell("D07").map((r) => ({
      "Formation": look(lk.formation, r.FormCode), "Depth (m)": val(r.DepthPoint),
      "Second depth": val(r.SecondDepth), "Type": val(r.TopTypeCode),
    })),
    operations: byDate("OperationAnalysis").map((r) => ({
      "Op": orNull(r.OperationCode), "Operation": look(lk.operation, r.OperationCode),
      "From": val(r.FTime), "To": val(r.TTime), "Remarks": val(r.Description),
    })),
    timeAnalysis: byDate("TimeAnalysis").map((r) => ({
      "Group": look(lk.activityGroup, r.ActivityGroupCode),
      "Type": lk.activityType.get(`${s(r.ActivityGroupCode)}|${s(r.ActivityTypeCode)}`) ?? null,
      "Activity": lk.activity.get(`${s(r.ActivityGroupCode)}|${s(r.ActivityTypeCode)}|${s(r.ActivityCode)}`) ?? null,
      "Hours": val(r.Hours), "Remarks": val(r.Description),
    })),
    chemicals: byDate("ChemicalMaterials")
      .filter((r) => [r.Amount, r.Rec, r.Stock, r.OS, r.Req, r.Sent].some((x) => Number(x) > 0))
      .map((r) => ({
        "Material": look(lk.material, r.MaterialCode), "Unit": look(lk.measure, r.MeasureCode),
        "Used": val(r.Amount), "Rec.": val(r.Rec), "Stock": val(r.Stock),
        "O/S": val(r.OS), "Req": val(r.Req), "Sent": val(r.Sent),
      })),
    solidControl,
    equipment,
  };
}

/** Resolved A01 well-master metadata for the well header (codes → names). */
export function getWell(wellCode: string): Record<string, unknown> | null {
  const r = data().prepare(`SELECT * FROM A01 WHERE WellCode = ?`).get(wellCode) as Row | undefined;
  if (!r) return null;
  const lk = lookups();
  return {
    wellCode: s(r.WellCode),
    name: orNull(r.EnglishName) ?? orNull(r.Description),
    farsiName: orNull(r.FarsiName),
    field: look(lk.field, r.FieldCode),
    rig: orNull(r.RIG),
    contractor: look(lk.contractor, r.ContractorCode),
    wellType: look(lk.wellType, r.WellTypeCode),
    profile: look(lk.wellProfile, r.WellProfileCode),
    zone: look(lk.zone, r.ZoneCode),
    company: look(lk.company, r.CompanyCode),
    reservoir: orNull(r.Reservoir),
    structure: orNull(r.StrucName),
    location: orNull(r.Location),
    spudDate: orNull(r.SpuddedInDate),
    tdReachedDate: orNull(r.ReachedTDDate),
    rigReleasedDate: orNull(r.RigReleasedDate),
    totalDepth: val(r.Depth),
    tvd: val(r.TVD),
    finalForecastDepth: val(r.FinalForecastedDepth),
    rtElevation: val(r.RTLevelSea),
    groundLevel: val(r.GrdLevel),
    waterDepth: val(r.WaterDepth),
    rigDays: val(r.RigDays),
    forecastDays: val(r.TotalForecastedDays),
  };
}

// LITHO/<HatchName>.bmp pattern tiles — served to the lithology track. Mapped
// case-insensitively (filenames are mixed-case) and restricted to real files.
let _lithoFiles: Map<string, string> | null = null;
function lithoFiles(): Map<string, string> {
  if (_lithoFiles) return _lithoFiles;
  const m = new Map<string, string>();
  try { for (const f of readdirSync(LITHO_DIR)) if (/\.bmp$/i.test(f)) m.set(f.replace(/\.bmp$/i, "").toLowerCase(), f); } catch { /* folder absent */ }
  _lithoFiles = m;
  return m;
}
/** Raw bytes of a lithology pattern tile, or null if the name isn't a real tile. */
export function readLithoPattern(name: string): Buffer | null {
  const file = lithoFiles().get(s(name).toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (!file) return null;
  try { return readFileSync(join(LITHO_DIR, file)); } catch { return null; }
}

export interface FormationMatrixFilters {
  fields?: string[]; wells?: string[]; rigs?: string[]; holeSizes?: string[]; mudTypes?: string[];
  // Cross-tab depth/geology facets (apply per row by the row's MD): a depth window
  // and a set of formation names (resolved from D07 tops). Shared by every tab.
  formations?: string[]; depthFrom?: number | string; depthTo?: number | string;
}

/** (wellCode, MD) → formation name = the deepest D07 top at/above that MD. Loads
 *  D07 once (no WellCode index → a single full scan, as getFormationMatrix does). */
function buildFormationResolver(): (wc: string, md: number) => string | null {
  const db = data(), lk = lookups();
  const byWell = new Map<string, { d: number; name: string }[]>();
  for (const r of db.prepare(`SELECT WellCode, FormCode, DepthPoint FROM D07 WHERE DepthPoint IS NOT NULL`).all() as Row[]) {
    const wc = s(r.WellCode), name = look(lk.formation, r.FormCode), d = Number(s(r.DepthPoint));
    if (!name || !Number.isFinite(d)) continue;
    let arr = byWell.get(wc); if (!arr) { arr = []; byWell.set(wc, arr); } arr.push({ d, name });
  }
  for (const a of byWell.values()) a.sort((x, y) => x.d - y.d);
  return (wc, md) => {
    const arr = byWell.get(wc); if (!arr) return null;
    let name: string | null = null;
    for (const t of arr) { if (t.d <= md) name = t.name; else break; }
    return name;
  };
}

/**
 * Shared depth-interval + formation row gate used by the DDR data endpoints.
 * `pass(wellCode, md)` is false for a row whose MD falls outside the picked depth
 * window or not inside one of the picked formations. A row with no usable MD is
 * dropped whenever either filter is active (it can't be placed). `active` lets a
 * caller skip the work entirely when neither facet is set.
 *
 * `topFormation(wellCode, md)` returns the deepest D07 top at/above that MD — the
 * per-row "top formation" name — independent of whether the formation FILTER is
 * active. Every tab query uses this to emit a `topFormation` column so results can
 * be displayed and broken down by formation. The resolver is built lazily on first
 * use (one D07 scan) so a query that needs neither the formation filter nor the
 * emitted value pays nothing.
 */
function depthFormationGate(f: FormationMatrixFilters) {
  // Treat undefined / null / "" as "not set" — Number("") is 0 (finite), which
  // would otherwise turn an absent filter into a bogus [0,0] depth window.
  const numOrNaN = (v: unknown) => (v === undefined || v === null || s(v) === "" ? NaN : Number(s(v)));
  const fromD = numOrNaN(f.depthFrom), toD = numOrNaN(f.depthTo);
  const hasFrom = Number.isFinite(fromD), hasTo = Number.isFinite(toD);
  const formNames = new Set((f.formations ?? []).map((x) => s(x)).filter(Boolean));
  const wantForm = formNames.size > 0, wantDepth = hasFrom || hasTo;
  // One resolver shared by both the formation filter and the emitted value, built
  // on first need so depth-only / unfiltered queries that never read the formation
  // skip the D07 scan entirely.
  let resolve: ((wc: string, md: number) => string | null) | null = null;
  const resolver = () => (resolve ??= buildFormationResolver());
  return {
    active: wantForm || wantDepth,
    pass(wc: string, md: number | null): boolean {
      if (!wantForm && !wantDepth) return true;
      if (md == null || !Number.isFinite(md)) return false;
      if (hasFrom && md < fromD) return false;
      if (hasTo && md > toD) return false;
      if (wantForm) { const fn = resolver()(wc, md); if (!fn || !formNames.has(fn)) return false; }
      return true;
    },
    /** The deepest formation top at/above this MD (null when MD is unusable). */
    topFormation(wc: string, md: number | null): string | null {
      if (md == null || !Number.isFinite(md)) return null;
      return resolver()(wc, md);
    },
  };
}

/** Facet filters → the matched well-code set (null = no facet selected at all;
 *  every caller treats null as "nothing selected", not "all wells"). */
function resolveWellSet(f: FormationMatrixFilters): Set<string> | null {
  const db = data(), lk = lookups(), c = ctx();
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const fields = clean(f.fields), rigs = clean(f.rigs), wells = clean(f.wells), holeSizes = clean(f.holeSizes), mudTypes = clean(f.mudTypes);
  // A picked well pulls in its sidetrack legs (AB-011 ↔ AB-011Leg1 ↔ AB-011ST1):
  // they're one physical well whose data is split across the leg codes, so the
  // query must span the whole family. Field/rig/size filters still narrow it.
  let wellSet: Set<string> | null = wells.length ? expandSidetracks(wells) : null;
  const intersect = (m: Set<string>) => { wellSet = wellSet ? new Set([...wellSet].filter((w) => m.has(w))) : m; };
  if (fields.length) { const fset = new Set(fields), m = new Set<string>(); for (const [wc, fc] of c.field) { const fn = look(lk.field, fc); if (fn && fset.has(fn)) m.add(wc); } intersect(m); }
  if (rigs.length) { const rset = new Set(rigs), m = new Set<string>(); for (const [wc, rg] of c.rig) if (rg && rset.has(rg)) m.add(wc); intersect(m); }
  if (holeSizes.length) {
    const hs = new Set(holeSizes), codes: string[] = [];
    for (const [code, name] of lk.holeSize) if (hs.has(normHoleSize(name))) codes.push(code);
    const m = new Set<string>();
    if (codes.length) for (const r of db.prepare(`SELECT DISTINCT WellCode FROM L04 WHERE TRIM(HoleSizeCode) IN (${codes.map(() => "?").join(",")})`).all(...codes) as Row[]) m.add(s(r.WellCode));
    intersect(m);
  }
  if (mudTypes.length) {
    const mt = new Set(mudTypes), codes: string[] = [];
    for (const [code, name] of lk.mud) if (mt.has(name)) codes.push(code);
    const m = new Set<string>();
    if (codes.length) for (const r of db.prepare(`SELECT DISTINCT WellCode FROM N01 WHERE TRIM(MudCode) IN (${codes.map(() => "?").join(",")})`).all(...codes) as Row[]) m.add(s(r.WellCode));
    intersect(m);
  }
  return wellSet;
}

/**
 * Formation-tops cross-tab: one row per well (in the facet-selected set), one
 * column per formation, cell = the formation top MD (D07.DepthPoint). Mirrors
 * the Reports & Search facets (fields/wells/rigs are per-well; hole-size & mud
 * select wells that have at least one matching day).
 */
export function getFormationMatrix(f: FormationMatrixFilters): Record<string, unknown> {
  const db = data();
  const lk = lookups();
  const wellSet = resolveWellSet(f);

  // No facet selected ⇒ nothing selected (don't dump every well). The user must
  // pick a field / well first, matching the lithology table & graph endpoints.
  if (!wellSet) return { formations: [], rows: [], truncated: false, total: 0, note: "Select a field or well to load formation tops." };

  // Selected set. Wells with no formation tops are dropped below (only rows
  // with ≥1 top are returned), so the cross-tab never shows blank-top wells.
  const nameMap = new Map<string, string>(), fieldMap = new Map<string, unknown>();
  for (const r of db.prepare(`SELECT WellCode, EnglishName, FieldCode FROM A01`).all() as Row[]) {
    const wc = s(r.WellCode); nameMap.set(wc, s(r.EnglishName)); fieldMap.set(wc, r.FieldCode);
  }
  const okWell = (wc: string) => /[A-Za-z0-9]/.test(wc); // drop blank / dash placeholders
  const codes = [...wellSet].filter(okWell).sort((a, b) => a.localeCompare(b));
  const truncated = codes.length > 800;
  const keep = new Set(codes.slice(0, 800));

  // Bit sizes + mud types used in each kept well (per-well distinct sets — tops
  // are well-level, so we show every bit/mud used in that well, comma-joined).
  const bm = bitMudByDepth(db, lk, [...keep]);
  const join = (set: Set<string> | undefined) => set && set.size ? [...set].sort().join(", ") : null;

  const rows = [...keep].map((wc) => ({
    wellCode: wc, name: nameMap.get(wc) || wc,
    field: orNull(look(lk.field, fieldMap.get(wc))),
    bitSizes: join(bm.get(wc)?.bitSet), mudTypes: join(bm.get(wc)?.mudSet),
    tops: {} as Record<string, unknown>,
    // Per-formation bit/mud resolved at the top depth, for the expandable
    // per-well view (one sub-row per formation). bit/mud are null when no
    // drilled interval covers that depth.
    detail: {} as Record<string, { md: number; bit: string | null; mud: string | null }>,
  }));
  const rowByCode = new Map(rows.map((r) => [r.wellCode, r]));
  const formSet = new Set<string>();
  for (const r of db.prepare(`SELECT WellCode, FormCode, DepthPoint FROM D07 WHERE DepthPoint IS NOT NULL`).all() as Row[]) {
    const wc = s(r.WellCode);
    const row = rowByCode.get(wc); if (!row) continue;
    const fname = look(lk.formation, r.FormCode); if (!fname) continue;
    const dv = val(r.DepthPoint); if (typeof dv !== "number") continue;
    const depth: number = dv;
    formSet.add(fname);
    if (!(fname in row.tops)) {
      row.tops[fname] = depth;
      const seg = bm.get(wc);
      row.detail[fname] = { md: depth, bit: segAt(seg?.bit, depth), mud: segAt(seg?.mud, depth) };
    }
  }
  // Hide wells with no formation tops — only rows with ≥1 recorded top are
  // shown (formSet, and thus the columns, already covers just those wells).
  const visible = rows
    .filter((r) => Object.keys(r.tops).length > 0)
    .sort((a, b) => a.wellCode.localeCompare(b.wellCode));
  const formations = [...formSet].sort((a, b) => a.localeCompare(b));
  const note = visible.length === 0 && codes.length > 0
    ? "None of the selected wells have formation tops recorded."
    : undefined;
  return { formations, rows: visible, truncated, total: codes.length, note };
}

/**
 * Formation-tops PROGNOSIS analytics over D07 — the next-well geology-planning
 * view (vs getFormationMatrix's per-well cross-tab). Synthesises the offset
 * wells' formation tops into the inputs a drilling/geology engineer prognoses
 * the next well from:
 *
 *  • prognosis   — per formation (in stratigraphic / mean-depth order): the top
 *                  depth (MD) across the offset wells — n / min / mean / median /
 *                  max / std-dev / spread — the prognosed-tops table with its
 *                  uncertainty band. Read off the expected top ± spread to set
 *                  casing points.
 *  • thickness   — per formation, the interval thickness (next top − this top,
 *                  per well) across offsets (min/median/max) + the hole section
 *                  the top falls in — flags casing seats and thick / variable
 *                  intervals.
 *  • wells       — per offset well, its ordered tops (formation → MD) — drives
 *                  the stratigraphic correlation panel (tops connected well to
 *                  well).
 *  • hazards     — each formation's loss exposure: N05 loss events / volume that
 *                  fell inside that formation's interval across the offsets, plus
 *                  a MOBILE-salt/anhydrite flag (Gachsaran / salt / anhydrite) —
 *                  the geology-driven risk list (which formation loses mud).
 *
 * Depths are MD as stored. Filtered by field / well / hole-size / mud-type.
 */
export interface FormationPrognosisFilters extends FormationMatrixFilters {}

export function getFormationPrognosis(f: FormationPrognosisFilters): Record<string, unknown> {
  const wellSet = resolveWellSet(f);
  if (!wellSet) return { prognosis: [], thickness: [], wells: [], hazards: [], wellCount: 0, depthRange: null, note: "Select a field or well to prognose from offset tops." };
  const db = data(), lk = lookups();
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { prognosis: [], thickness: [], wells: [], hazards: [], wellCount: 0, depthRange: null };

  // Optional hole-size filter selects wells that drilled a matching section
  // (resolveWellSet already applied field/well/hole/mud → wellSet). Here we just
  // need the well English names + a per-well hole-section depth map.
  const nameMap = new Map<string, string>();
  for (const r of db.prepare(`SELECT WellCode, EnglishName FROM A01`).all() as Row[]) nameMap.set(s(r.WellCode), s(r.EnglishName) || s(r.WellCode));

  // Per-well bit-size depth segments (L04 → hole section), so each top resolves
  // to the hole section it sits in (for the casing-seat view).
  const bitByWell = new Map<string, DepthSeg[]>();
  // N05 loss events per well (depth → volume), for the formation hazard cross-ref.
  const lossByWell = new Map<string, { d: number; vol: number }[]>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const name = look(lk.holeSize, r.HoleSizeCode); if (!name) continue;
      const fr = val(r.FromPoint), to = val(r.ToPoint);
      if (typeof fr === "number" && typeof to === "number" && to > fr) {
        const wc = s(r.WellCode); let arr = bitByWell.get(wc); if (!arr) { arr = []; bitByWell.set(wc, arr); }
        arr.push({ from: fr, to, name: normHoleSize(name), own: true });
      }
    }
    for (const r of db.prepare(`SELECT WellCode, FromPoint, TotalLossesAmount, LossesAtUnit, MinGraduallyLossesAmount, MaxGraduallyLossesAmount FROM N05 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const d = Number(s(r.FromPoint)); if (!Number.isFinite(d) || d <= 0 || d > 9000) continue;
      const vol = Math.max(Number(s(r.TotalLossesAmount)) || 0, Number(s(r.LossesAtUnit)) || 0, Number(s(r.MinGraduallyLossesAmount)) || 0, Number(s(r.MaxGraduallyLossesAmount)) || 0);
      if (vol <= 0) continue;
      const wc = s(r.WellCode); let arr = lossByWell.get(wc); if (!arr) { arr = []; lossByWell.set(wc, arr); }
      arr.push({ d, vol });
    }
  }
  for (const arr of bitByWell.values()) arr.sort((a, b) => a.from - b.from);

  // Per-well ordered tops (formation → MD). D07 has no WellCode index → one pass.
  const topsByWell = new Map<string, { name: string; md: number }[]>();
  const keep = new Set(codes);
  for (const r of db.prepare(`SELECT WellCode, FormCode, DepthPoint FROM D07 WHERE DepthPoint IS NOT NULL`).all() as Row[]) {
    const wc = s(r.WellCode); if (!keep.has(wc)) continue;
    const name = look(lk.formation, r.FormCode); if (!name) continue;
    const md = val(r.DepthPoint); if (typeof md !== "number" || md < 1 || md > 9000) continue;
    let arr = topsByWell.get(wc); if (!arr) { arr = []; topsByWell.set(wc, arr); }
    // Keep the first (shallowest) top per formation per well (matches the matrix).
    if (!arr.some((t) => t.name === name)) arr.push({ name, md });
  }
  for (const arr of topsByWell.values()) arr.sort((a, b) => a.md - b.md);

  // ── per-formation depth stats + thickness + loss exposure ───────────────────
  const depthByForm = new Map<string, number[]>();
  const thickByForm = new Map<string, number[]>();
  const sectionByForm = new Map<string, Map<string, number>>();   // form → section → count
  const lossByForm = new Map<string, { events: number; vol: number }>();

  for (const [wc, tops] of topsByWell) {
    const losses = lossByWell.get(wc) ?? [];
    for (let i = 0; i < tops.length; i++) {
      const { name, md } = tops[i];
      (depthByForm.get(name) ?? depthByForm.set(name, []).get(name)!).push(md);
      const base = i + 1 < tops.length ? tops[i + 1].md : null;
      if (base != null) { const th = base - md; if (th > 0 && th < 3000) (thickByForm.get(name) ?? thickByForm.set(name, []).get(name)!).push(th); }
      // Hole section the top sits in.
      const sec = segAt(bitByWell.get(wc), md);
      if (sec) { let m = sectionByForm.get(name); if (!m) { m = new Map(); sectionByForm.set(name, m); } m.set(sec, (m.get(sec) ?? 0) + 1); }
      // Losses that fell inside this formation's interval [md, base).
      if (losses.length) {
        const hi = base ?? Infinity;
        let ev = 0, vol = 0;
        for (const l of losses) if (l.d >= md && l.d < hi) { ev++; vol += l.vol; }
        if (ev) { const e = lossByForm.get(name) ?? { events: 0, vol: 0 }; e.events += ev; e.vol += vol; lossByForm.set(name, e); }
      }
    }
  }

  const sortNum = (a: number[]) => a.slice().sort((m, n) => m - n);
  const pct = (sorted: number[], p: number) => { if (!sorted.length) return 0; const idx = (sorted.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); };
  const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
  const std = (a: number[]) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / (a.length - 1)); };
  const r0 = (v: number) => Math.round(v);

  const MOBILE = /gachsaran|salt|anhyd|halit|gypsum/i;   // mobile / loss-prone evaporite formations

  const prognosis = [...depthByForm.entries()].map(([name, ds]) => {
    const s2 = sortNum(ds);
    return {
      formation: name, n: ds.length, min: r0(s2[0]), mean: r0(mean(ds)), median: r0(pct(s2, 0.5)),
      max: r0(s2[s2.length - 1]), std: r0(std(ds)), spread: r0(s2[s2.length - 1] - s2[0]),
    };
  }).sort((a, b) => a.mean - b.mean);   // stratigraphic order = shallow → deep by mean top

  const meanDepthOf = new Map(prognosis.map((p) => [p.formation, p.mean]));
  const thickness = [...thickByForm.entries()].map(([name, ts]) => {
    const s2 = sortNum(ts);
    const secMap = sectionByForm.get(name);
    const topSec = secMap ? [...secMap.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null : null;
    return { formation: name, n: ts.length, min: r0(s2[0]), median: r0(pct(s2, 0.5)), max: r0(s2[s2.length - 1]), section: topSec };
  }).sort((a, b) => (meanDepthOf.get(a.formation) ?? 0) - (meanDepthOf.get(b.formation) ?? 0));

  const hazards = [...new Set([...depthByForm.keys()])].map((name) => {
    const e = lossByForm.get(name);
    return { formation: name, meanDepth: meanDepthOf.get(name) ?? null, lossEvents: e?.events ?? 0, lossVol: e ? r0(e.vol) : 0, mobile: MOBILE.test(name) };
  }).filter((h) => h.lossEvents > 0 || h.mobile)
    .sort((a, b) => b.lossVol - a.lossVol || (a.meanDepth ?? 0) - (b.meanDepth ?? 0));

  // Wells for the correlation panel (cap at 12 — drawn side by side), ordered by code.
  const wellList = [...topsByWell.keys()].sort((a, b) => a.localeCompare(b)).slice(0, 12);
  const wells = wellList.map((wc) => ({ wellCode: wc, name: nameMap.get(wc) || wc, tops: topsByWell.get(wc)! }));

  let dmin = Infinity, dmax = -Infinity;
  for (const ds of depthByForm.values()) for (const d of ds) { dmin = Math.min(dmin, d); dmax = Math.max(dmax, d); }
  const depthRange = Number.isFinite(dmin) ? { min: Math.floor(dmin / 100) * 100, max: Math.ceil(dmax / 100) * 100 } : null;

  return { prognosis, thickness, wells, hazards, wellCount: topsByWell.size, depthRange, truncatedWells: wellList.length < topsByWell.size };
}

// ── Lithology component parser: free-text Description → {name, pct} list ──────
// The DailyLitologyDecription.Description packs up to several lithologies, each
// "<abbr>: <details> <NN>%". We pull the leading abbreviation per %-segment and
// resolve a rock type (+ colour modifier: "Gy Ml" → Gray Marl).
const LITHO_COLOR: [RegExp, string][] = [
  [/\b(red|rd|rdsh|reddish)\b/i, "Red"], [/\b(gr[ae]y|gy|grey)\b/i, "Gray"],
  [/\b(brn|brown)\b/i, "Brown"], [/\b(grn|green|gn)\b/i, "Green"], [/\b(blk|black)\b/i, "Black"],
];
const LITHO_ROCK: { re: RegExp; type: string; pattern: string; base: string }[] = [
  { re: /anhy|anhd|\banh\b/i, type: "Anhydrite", pattern: "ANGYPSUM", base: "#b39ddb" },
  { re: /salt|halit/i, type: "Salt", pattern: "SALT", base: "#fff3c4" },
  { re: /gyp/i, type: "Gypsum", pattern: "ANGYPSUM", base: "#f8bbd0" },
  { re: /m(a?)rl|ml\b/i, type: "Marl", pattern: "MlGr", base: "#a5d6a7" },
  { re: /arg/i, type: "Argillaceous Lst", pattern: "ARGILST", base: "#90caf9" },
  { re: /lst|lime|\bl\.?st\b/i, type: "Limestone", pattern: "LST", base: "#64b5f6" },
  { re: /dol/i, type: "Dolomite", pattern: "DOL", base: "#80cbc4" },
  { re: /\bsh\b|shale|shl/i, type: "Shale", pattern: "SH", base: "#b0bec5" },
  { re: /sst|\bs\.?st\b|sand/i, type: "Sandstone", pattern: "SST", base: "#ffe082" },
  { re: /silt|\bslt\b/i, type: "Siltstone", pattern: "STST", base: "#cdb98a" },
  { re: /clay|\bcly?\b|clst/i, type: "Claystone", pattern: "CLST", base: "#bcaaa4" },
  { re: /congl|cgl/i, type: "Conglomerate", pattern: "Congl", base: "#ffab91" },
  { re: /coal/i, type: "Coal", pattern: "COAL", base: "#5d4037" },
];
const LITHO_TINT: Record<string, string> = { Red: "#ef9a9a", Gray: "#cfd8dc", Brown: "#bcaaa4", Green: "#a5d6a7", Black: "#90a4ae" };

function matchLitho(seg: string): { name: string; pattern: string; color: string } | null {
  const d = (seg ?? "").toLowerCase();
  if (/no\s*sample|recovery|no\s*rec/.test(d)) return { name: "NoSample", pattern: "NS", color: "#e0e0e0" };
  let rock: (typeof LITHO_ROCK)[number] | undefined;
  for (const r of LITHO_ROCK) if (r.re.test(d)) { rock = r; break; }
  if (!rock) return null;
  let color = "";
  for (const [re, cl] of LITHO_COLOR) if (re.test(d)) { color = cl; break; }
  return { name: color ? `${color} ${rock.type}` : rock.type, pattern: rock.pattern, color: color && LITHO_TINT[color] ? LITHO_TINT[color] : rock.base };
}

export interface LithoComp { name: string; pct: number; pattern: string; color: string }
function parseLitho(desc: string): LithoComp[] {
  const t = s(desc);
  if (!t) return [];
  if (!/%/.test(t)) { const m = matchLitho(t); return m ? [{ ...m, pct: 100 }] : []; }
  const out: LithoComp[] = [];
  const re = /([^%]*?)(\d+(?:\.\d+)?)\s*%/g;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(t)) !== null && out.length < 6) {
    const chunk = mm[1];
    const descriptor = chunk.includes(":") ? chunk.slice(0, chunk.indexOf(":")) : chunk;
    let lit = matchLitho(descriptor);            // prefer the leading abbreviation
    if (!lit && descriptor !== chunk) lit = matchLitho(chunk);
    if (lit) out.push({ ...lit, pct: Number(mm[2]) }); // skip unrecognised accessory text
  }
  return out;
}

/**
 * Per-well depth-tagged bit size (L04.HoleSizeCode over the day's drilled
 * FromPoint–ToPoint) and mud type (N01.MudCode over its FromPoint–ToPoint), so a
 * lithology interval / formation top at a given depth can be resolved by overlap.
 * Returns, per requested well code: sorted [from,to,name] segments for bit + mud,
 * and the distinct name sets (the per-well "all bit sizes / mud types used" view).
 *
 * A well's LEGS / SIDETRACKS (same well number — e.g. AB-006Leg1 under AB-006)
 * contribute their intervals to the base well: formation tops (D07) are recorded
 * once under the base, while the deeper section is drilled — and its bit/mud
 * logged — under the leg, so without this the deep tops show no bit/mud. Workover
 * (WO) / CTU variants are NOT merged: in the source they are separate wells with
 * their own A01 names, so they keep distinct bases (see baseWellCode).
 */
// `own` = this interval is the requested well's OWN (vs a folded-in leg/sidetrack
// sibling). The owning well's intervals take priority at depths it drilled itself.
interface DepthSeg { from: number; to: number; name: string; own: boolean }
interface BitMud { bit: DepthSeg[]; mud: DepthSeg[]; bitSet: Set<string>; mudSet: Set<string> }

// base wellbore code → every data WellCode sharing it (the base + its legs /
// sidetracks). Built once from the codes present in L04 + N01 (cached).
let _siblings: Map<string, string[]> | null = null;
function siblingsByBase(db: ReturnType<typeof data>): Map<string, string[]> {
  if (_siblings) return _siblings;
  const m = new Map<string, Set<string>>();
  const add = (wc: string) => { if (!wc) return; const b = baseWellCode(wc); let set = m.get(b); if (!set) { set = new Set(); m.set(b, set); } set.add(wc); };
  for (const r of db.prepare(`SELECT DISTINCT WellCode FROM L04`).all() as Row[]) add(s(r.WellCode));
  for (const r of db.prepare(`SELECT DISTINCT WellCode FROM N01`).all() as Row[]) add(s(r.WellCode));
  _siblings = new Map([...m].map(([b, set]) => [b, [...set]]));
  return _siblings;
}

function bitMudByDepth(db: ReturnType<typeof data>, lk: ReturnType<typeof lookups>, codes: string[]): Map<string, BitMud> {
  const out = new Map<string, BitMud>();
  const get = (wc: string) => { let m = out.get(wc); if (!m) { m = { bit: [], mud: [], bitSet: new Set(), mudSet: new Set() }; out.set(wc, m); } return m; };
  // Group requested wells by base wellbore, then fold in each base's leg /
  // sidetrack siblings so their drilled intervals resolve the base's bit/mud.
  const reqByBase = new Map<string, string[]>();
  for (const wc of codes) { get(wc); const b = baseWellCode(wc); const a = reqByBase.get(b); if (a) a.push(wc); else reqByBase.set(b, [wc]); }
  const sib = siblingsByBase(db);
  const fetch = new Set<string>(codes);
  for (const b of reqByBase.keys()) { const list = sib.get(b); if (list) for (const c of list) fetch.add(c); }
  const fetchArr = [...fetch];
  // Attribute a fetched interval to every requested well sharing its base, flagging
  // whether it's that well's OWN interval (rowWc === wc) or a folded-in sibling's.
  const apply = (rowWc: string, fn: (m: BitMud, own: boolean) => void) => {
    const reqs = reqByBase.get(baseWellCode(rowWc)); if (reqs) for (const wc of reqs) fn(get(wc), rowWc === wc);
  };
  for (let i = 0; i < fetchArr.length; i += 800) {
    const chunk = fetchArr.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const name = look(lk.holeSize, r.HoleSizeCode); if (!name) continue;
      const fr = val(r.FromPoint), to = val(r.ToPoint);
      apply(s(r.WellCode), (m, own) => { m.bitSet.add(name); if (typeof fr === "number" && typeof to === "number" && to > fr) m.bit.push({ from: fr, to, name, own }); });
    }
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const name = look(lk.mud, r.MudCode); if (!name) continue;
      const fr = val(r.FromPoint), to = val(r.ToPoint);
      apply(s(r.WellCode), (m, own) => { m.mudSet.add(name); if (typeof fr === "number" && typeof to === "number" && to > fr) m.mud.push({ from: fr, to, name, own }); });
    }
  }
  // Deterministic order: by depth, then OWN intervals before folded-in siblings,
  // then name — so equal-`from` overlaps don't depend on SQLite row order.
  const cmp = (a: DepthSeg, b: DepthSeg) => a.from - b.from || (b.own ? 1 : 0) - (a.own ? 1 : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const m of out.values()) { m.bit.sort(cmp); m.mud.sort(cmp); }
  return out;
}
/** Bit/mud name for a depth. The requested well's OWN interval wins wherever it
 *  covers the depth; a folded-in leg/sidetrack sibling is used only where the well
 *  itself drilled nothing (e.g. a deep section drilled under a leg). This stops a
 *  sidetrack's (often narrower / shallower-kicked-off) hole from shadowing the base
 *  at depths the base genuinely drilled. */
function segAt(segs: DepthSeg[] | undefined, depth: number): string | null {
  if (!segs || !segs.length) return null;
  let sibling: string | null = null;
  for (const x of segs) {
    if (depth >= x.from && depth < x.to) {
      if (x.own) return x.name;                 // owning wellbore wins immediately
      if (sibling == null) sibling = x.name;    // remember first sibling as fallback
    }
  }
  return sibling;
}

/**
 * Lithology-% table: one row per cuttings interval (DailyLitologyDecription) for
 * the facet-selected wells, with its parsed lithology components (name + %), plus
 * the bit size + mud type covering that depth (by L04 / N01 overlap).
 * Distinct component names are returned for the lithology checklist.
 */
export function getLithologyTable(f: FormationMatrixFilters): Record<string, unknown> {
  const wellSet = resolveWellSet(f);
  if (!wellSet) return { rows: [], lithoTypes: [], truncated: false, total: 0, note: "Select a field or well to load lithology." };
  const db = data(), lk = lookups();
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { rows: [], lithoTypes: [], truncated: false, total: 0 };

  const bm = bitMudByDepth(db, lk, codes);
  const raw: Row[] = [];
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800);
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, Description FROM DailyLitologyDecription WHERE TRIM(WellCode) IN (${chunk.map(() => "?").join(",")})`).all(...chunk) as Row[]) raw.push(r);
  }
  const typeSet = new Set<string>();
  const rows = raw
    .map((r) => {
      const wc = s(r.WellCode), from = val(r.FromPoint), to = val(r.ToPoint);
      const wm = bm.get(wc);
      // Resolve bit/mud at the interval's midpoint (falls inside the covering day).
      const mid = typeof from === "number" ? (typeof to === "number" && to > from ? (from + to) / 2 : from) : null;
      return {
        wellCode: wc, from, to, comps: parseLitho(s(r.Description)),
        bitSize: mid != null ? segAt(wm?.bit, mid) : null,
        mudType: mid != null ? segAt(wm?.mud, mid) : null,
      };
    })
    .filter((row) => typeof row.from === "number" && row.comps.length);
  for (const row of rows) for (const cc of row.comps) typeSet.add(cc.name);
  rows.sort((a, b) => a.wellCode.localeCompare(b.wellCode) || (a.from as number) - (b.from as number));
  const cap = 6000;
  return { rows: rows.slice(0, cap), lithoTypes: [...typeSet].sort(), truncated: rows.length > cap, total: rows.length };
}

/**
 * Mud-properties table: one row per N01 mud interval for the facet-selected
 * wells, joined with that day's N05 losses/gains balance — the multi-well
 * version of the Delphi mud report (DDR-Delphi/Unit1.pas:4433). PV/YP are
 * derived from the Fann 600/300 readings (Unit10.pas). MudCode resolves to a
 * mud-type name via lk.mud. N05 keys on (WellCode, fDate) — and, where present,
 * the same (FromPoint) interval — so the per-day balance is attached to its
 * matching N01 interval.
 */
export function getMudProperties(f: FormationMatrixFilters): Record<string, unknown> {
  const wellSet = resolveWellSet(f);
  if (!wellSet) return { rows: [], truncated: false, total: 0, note: "Select a field or well to load mud properties." };
  const db = data(), lk = lookups();
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { rows: [], truncated: false, total: 0 };
  const gate = depthFormationGate(f);   // depth-window + formation row filter

  // N01/N05 have no WellCode index → one grouped, chunked-IN pass over each
  // (like getLithologyGraph), not a per-well loop.
  const n01: Row[] = [];
  // N05 keyed by composite so each N01 interval gets its own day's balance:
  // prefer (WellCode|fDate|FromPoint), fall back to (WellCode|fDate).
  const n05ByKey = new Map<string, Row>();
  const n05ByDay = new Map<string, Row>();
  // L04 (WellCode|DrillingDate) -> report SerialNo, so each mud row can open the
  // day's full report. The section tables' own SerialNo is a per-table row index,
  // NOT the report serial (see getReport ~line 187) — getReport keys on
  // L04.WellCode + L04.SerialNo, so we resolve the report serial by date here.
  const reportSerialByDay = new Map<string, number>();
  // Day remark (L04.Description) per (WellCode|DrillingDate), taken from the
  // primary (lowest-serial) report — the Delphi mud report's DESCRIPTION column.
  const descByDay = new Map<string, unknown>();
  // Per-well bit-size depth segments (L04 drilled interval → HoleSize), so each
  // mud interval shows the bit size covering its depth.
  const bitByWell = new Map<string, DepthSeg[]>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(
      `SELECT WellCode, fDate, FromPoint, ToPoint, MudCode, MinWeight, MaxWeight, Viscosity, Fan600, Fan300,
              InitialGel, Gel10Minutes, PH, Alk, WaterLoss, HPHT, AirFoamCFM, OilPercent, OilPerWaterRatio,
              Stability, KCL, SoildPercent, Salinity, Calcium, MBT, PF, MF,
              ReturnTemperature, RepTime, MudChangeDepth FROM N01 WHERE TRIM(WellCode) IN (${ph})`,
    ).all(...chunk) as Row[]) n01.push(r);
    for (const r of db.prepare(
      `SELECT WellCode, fDate, FromPoint, TotalLossesAmount, LossesAtUnit, MinGraduallyLossesAmount,
              MaxGraduallyLossesAmount, TotalGainAmount, MinGainAmount, MaxGainAmount FROM N05 WHERE TRIM(WellCode) IN (${ph})`,
    ).all(...chunk) as Row[]) {
      const wc = s(r.WellCode), fd = s(r.fDate);
      const key = `${wc}|${fd}|${s(r.FromPoint)}`;
      if (!n05ByKey.has(key)) n05ByKey.set(key, r);
      const day = `${wc}|${fd}`;
      if (!n05ByDay.has(day)) n05ByDay.set(day, r);
    }
    for (const r of db.prepare(
      `SELECT WellCode, SerialNo, DrillingDate, FromPoint, ToPoint, HoleSizeCode, Description FROM L04 WHERE TRIM(WellCode) IN (${ph})`,
    ).all(...chunk) as Row[]) {
      const wc = s(r.WellCode), day = `${wc}|${s(r.DrillingDate)}`;
      const sn = Number(r.SerialNo);
      if (Number.isFinite(sn)) {
        // A few wells have two L04 reports on the same date; keep the lowest serial
        // (the primary report) so the choice is deterministic across runs.
        const cur = reportSerialByDay.get(day);
        if (cur == null || sn < cur) { reportSerialByDay.set(day, sn); descByDay.set(day, orNull(r.Description)); }
      } else if (!descByDay.has(day)) {
        descByDay.set(day, orNull(r.Description));
      }
      const bitName = look(lk.holeSize, r.HoleSizeCode);
      const fr = val(r.FromPoint), to = val(r.ToPoint);
      if (bitName && typeof fr === "number" && typeof to === "number" && to > fr) {
        let arr = bitByWell.get(wc); if (!arr) { arr = []; bitByWell.set(wc, arr); }
        arr.push({ from: fr, to, name: bitName, own: true }); // per-well only here (no leg merge)
      }
    }
  }
  for (const arr of bitByWell.values()) arr.sort((a, b) => a.from - b.from);

  const rows = n01.map((r) => {
    const wc = s(r.WellCode), fd = s(r.fDate);
    const balance = n05ByKey.get(`${wc}|${fd}|${s(r.FromPoint)}`) ?? n05ByDay.get(`${wc}|${fd}`) ?? {};
    // PV / YP from the Fann 600/300 readings (Unit10.pas: PV=θ600−θ300,
    // YP=2·θ300−θ600); null when no readings so we don't print 0/0.
    const f600 = Number(r.Fan600), f300 = Number(r.Fan300);
    const haveFan = Number.isFinite(f600) && Number.isFinite(f300) && (f600 !== 0 || f300 !== 0);
    const serialNo: number | null = reportSerialByDay.get(`${wc}|${fd}`) ?? null;
    // Bit size covering this mud interval (its midpoint), by L04 depth overlap.
    const from = val(r.FromPoint), to = val(r.ToPoint);
    const mid = typeof from === "number" ? (typeof to === "number" && to > from ? (from + to) / 2 : from) : null;
    const bitSize = mid != null ? segAt(bitByWell.get(wc), mid) : null;
    // Top formation at this interval's gate MD (to ?? from), so the displayed
    // formation matches the row the formation filter would keep/drop.
    const gateMd = typeof to === "number" ? to : (typeof from === "number" ? from : null);
    return {
      wellCode: wc, date: orNull(fd), serialNo,
      from, to, bitSize, topFormation: gate.topFormation(wc, gateMd), mudType: look(lk.mud, r.MudCode),
      minWeight: val(r.MinWeight), maxWeight: val(r.MaxWeight),
      visc: val(r.Viscosity),
      pv: haveFan ? Number((f600 - f300).toFixed(2)) : null,
      yp: haveFan ? Number((2 * f300 - f600).toFixed(2)) : null,
      fan600: val(r.Fan600), fan300: val(r.Fan300),
      initialGel: val(r.InitialGel), gel10: val(r.Gel10Minutes),
      ph: val(r.PH), alk: val(r.Alk),
      waterLoss: val(r.WaterLoss), hpht: val(r.HPHT), airFoam: val(r.AirFoamCFM),
      oilPercent: val(r.OilPercent), oilWater: val(r.OilPerWaterRatio),
      stability: val(r.Stability), kcl: val(r.KCL),
      solids: val(r.SoildPercent), salinity: val(r.Salinity), calcium: val(r.Calcium),
      mbt: val(r.MBT), pf: val(r.PF), mf: val(r.MF),
      temp: val(r.ReturnTemperature), repTime: val(r.RepTime), mudChangeDepth: val(r.MudChangeDepth),
      // N05 day balance (losses / gains). TotalLossesAmount is often 0 on days
      // with only gradual loss, so surface the gradual-loss range too.
      totalLosses: val(balance.TotalLossesAmount), lossesAtUnit: val(balance.LossesAtUnit),
      minGradLoss: val(balance.MinGraduallyLossesAmount), maxGradLoss: val(balance.MaxGraduallyLossesAmount),
      totalGains: val(balance.TotalGainAmount), minGain: val(balance.MinGainAmount), maxGain: val(balance.MaxGainAmount),
      // Day remark (L04.Description) — the Delphi mud report's trailing DESCRIPTION column.
      remarks: descByDay.get(`${wc}|${fd}`) ?? null,
    };
  }).filter((row) => (typeof row.from === "number" || row.mudType != null)
    && (!gate.active || gate.pass(row.wellCode, typeof row.to === "number" ? row.to : (typeof row.from === "number" ? row.from : null))));

  rows.sort((a, b) =>
    a.wellCode.localeCompare(b.wellCode) ||
    s(a.date).localeCompare(s(b.date)) ||
    (typeof a.from === "number" ? a.from : 0) - (typeof b.from === "number" ? b.from : 0));
  const cap = 6000;
  return { rows: rows.slice(0, cap), truncated: rows.length > cap, total: rows.length };
}

/**
 * Mud-program PLANNING analytics over N01/N05 — the next-well design view (vs
 * getMudProperties' per-well browser). Synthesises the offset wells into the
 * inputs a mud engineer designs the next well's mud program from:
 *
 *  • weightByDepth  — the empirical MUD-WEIGHT WINDOW: per depth bin, the p10 /
 *                     median / p90 / min / max of MaxWeight (pcf) across the
 *                     offset wells. Read off the planning weight at each depth.
 *  • losses         — the LOSS-RISK MAP: N05 loss (and gain/kick) events binned
 *                     by depth, with event count, total volume and a severity
 *                     split (seepage / partial / severe / total), plus the hole
 *                     section — flags the loss-prone zones to plan LCM for.
 *  • rheologyBySection — per hole section, the min/median/max of the rheology &
 *                     solids properties offset wells ran (weight, visc, PV, YP,
 *                     gels, solids%, filtrate) — the next well's mud spec.
 *  • mudBySection   — which mud systems were used in each section, with the row
 *                     count and typical (median) weight — the program skeleton.
 *
 * Weight is kept in pcf (as stored); the UI offers pcf/ppg/SG. Depth bins are a
 * fixed 250 m. Filtered by field / well / hole-size / mud-type like the browser.
 */
export interface MudProgramFilters extends FormationMatrixFilters {}

export function getMudProgram(f: MudProgramFilters): Record<string, unknown> {
  const wellSet = resolveWellSet(f);
  if (!wellSet) return { weightByDepth: [], losses: [], rheologyBySection: [], mudBySection: [], wellCount: 0, depthRange: null, note: "Select a field or well to design from offset mud data." };
  const db = data(), lk = lookups();
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { weightByDepth: [], losses: [], rheologyBySection: [], mudBySection: [], wellCount: 0, depthRange: null };

  // Optional mud-type filter (per row), matching the browser facet.
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const holeNames = new Set(clean(f.holeSizes));
  const holeFilter = holeNames.size ? holeNames : null;   // compared against normalised section label

  // Per-well bit-size depth segments (L04 drilled interval → hole size), so each
  // N01/N05 depth resolves to its hole section (same approach as getMudProperties).
  const bitByWell = new Map<string, DepthSeg[]>();
  const seenWells = new Set<string>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const name = look(lk.holeSize, r.HoleSizeCode); if (!name) continue;
      const fr = val(r.FromPoint), to = val(r.ToPoint);
      if (typeof fr === "number" && typeof to === "number" && to > fr) {
        const wc = s(r.WellCode); let arr = bitByWell.get(wc); if (!arr) { arr = []; bitByWell.set(wc, arr); }
        arr.push({ from: fr, to, name: normHoleSize(name), own: true });
      }
    }
  }
  for (const arr of bitByWell.values()) arr.sort((a, b) => a.from - b.from);
  const sectionAt = (wc: string, depth: number): string | null => segAt(bitByWell.get(wc), depth);

  const BIN = 250;
  const binOf = (d: number) => Math.floor(d / BIN) * BIN;

  // Accumulators.
  const weightBins = new Map<number, number[]>();          // depthBin → MaxWeight[]
  interface LossBucket { seepage: number; partial: number; severe: number; total: number; vol: number; gains: number; gainVol: number; sections: Map<string, number> }
  const lossAcc = new Map<number, LossBucket>();           // depthBin → loss/gain tallies
  // Rheology & solids per section: each prop → values[].
  const RHEO: { key: string; col: string }[] = [
    { key: "maxWeight", col: "MaxWeight" }, { key: "visc", col: "Viscosity" },
    { key: "solids", col: "SoildPercent" }, { key: "waterLoss", col: "WaterLoss" },
  ];
  const sectionStats = new Map<string, { rheo: Map<string, number[]>; pv: number[]; yp: number[]; gel: number[] }>();
  const sectionMud = new Map<string, Map<string, { n: number; wt: number[] }>>();  // section → mudName → {count, weights}
  const getSec = (sec: string) => { let s2 = sectionStats.get(sec); if (!s2) { s2 = { rheo: new Map(), pv: [], yp: [], gel: [] }; sectionStats.set(sec, s2); } return s2; };

  let dmin = Infinity, dmax = -Infinity;

  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(
      `SELECT WellCode, FromPoint, MudCode, MaxWeight, Viscosity, Fan600, Fan300, InitialGel, SoildPercent, WaterLoss FROM N01 WHERE TRIM(WellCode) IN (${ph})`,
    ).all(...chunk) as Row[]) {
      const wc = s(r.WellCode);
      const depth = Number(s(r.FromPoint));
      if (!Number.isFinite(depth) || depth < 0 || depth > 9000) continue;
      const sec = sectionAt(wc, depth);
      if (holeFilter && (!sec || !holeFilter.has(sec))) continue;
      const mudCode = s(r.MudCode);
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      seenWells.add(wc);

      const mw = Number(s(r.MaxWeight));
      const mwOk = Number.isFinite(mw) && mw >= 30 && mw <= 200;
      if (mwOk) {
        const b = binOf(depth); let arr = weightBins.get(b); if (!arr) { arr = []; weightBins.set(b, arr); } arr.push(mw);
        dmin = Math.min(dmin, depth); dmax = Math.max(dmax, depth);
      }
      if (sec) {
        const ss = getSec(sec);
        for (const rh of RHEO) { const v = Number(s(r[rh.col])); if (Number.isFinite(v) && v > 0) { let a = ss.rheo.get(rh.key); if (!a) { a = []; ss.rheo.set(rh.key, a); } a.push(v); } }
        // PV = θ600−θ300, YP = 2·θ300−θ600. A valid Fann reading has θ600 ≥ θ300 ≥ 0
        // AND θ300 ≥ PV (so YP ≥ 0). Drop physically-impossible pairs (data-entry
        // slips that otherwise produce negative / absurd PV/YP and skew the spec).
        const f600 = Number(s(r.Fan600)), f300 = Number(s(r.Fan300));
        if (Number.isFinite(f600) && Number.isFinite(f300) && f600 >= f300 && f300 >= 0 && f600 > 0 && f600 <= 400 && 2 * f300 - f600 >= 0) {
          ss.pv.push(f600 - f300); ss.yp.push(2 * f300 - f600);
        }
        const gel = Number(s(r.InitialGel)); if (Number.isFinite(gel) && gel > 0) ss.gel.push(gel);
        // Mud-type program per section.
        const mudName = look(lk.mud, mudCode);
        if (mudName) { let mm = sectionMud.get(sec); if (!mm) { mm = new Map(); sectionMud.set(sec, mm); } let e = mm.get(mudName); if (!e) { e = { n: 0, wt: [] }; mm.set(mudName, e); } e.n++; if (mwOk) e.wt.push(mw); }
      }
    }

    // Losses & gains (N05) by depth.
    for (const r of db.prepare(
      `SELECT WellCode, FromPoint, TotalLossesAmount, LossesAtUnit, MinGraduallyLossesAmount, MaxGraduallyLossesAmount, TotalGainAmount FROM N05 WHERE TRIM(WellCode) IN (${ph})`,
    ).all(...chunk) as Row[]) {
      const wc = s(r.WellCode);
      const depth = Number(s(r.FromPoint));
      if (!Number.isFinite(depth) || depth < 0 || depth > 9000) continue;
      const sec = sectionAt(wc, depth);
      if (holeFilter && (!sec || !holeFilter.has(sec))) continue;
      const total = Number(s(r.TotalLossesAmount)) || 0, unit = Number(s(r.LossesAtUnit)) || 0;
      const grad = Math.max(Number(s(r.MinGraduallyLossesAmount)) || 0, Number(s(r.MaxGraduallyLossesAmount)) || 0);
      const lossVol = Math.max(total, unit, grad);
      const gain = Number(s(r.TotalGainAmount)) || 0;
      if (lossVol <= 0 && gain <= 0) continue;
      const b = binOf(depth);
      let bucket = lossAcc.get(b); if (!bucket) { bucket = { seepage: 0, partial: 0, severe: 0, total: 0, vol: 0, gains: 0, gainVol: 0, sections: new Map() }; lossAcc.set(b, bucket); }
      if (lossVol > 0) {
        // Severity bands (bbl): seepage <10, partial 10–50, severe 50–100, total >100.
        if (lossVol < 10) bucket.seepage++; else if (lossVol < 50) bucket.partial++; else if (lossVol < 100) bucket.severe++; else bucket.total++;
        bucket.vol += lossVol;
        if (sec) bucket.sections.set(sec, (bucket.sections.get(sec) ?? 0) + 1);
      }
      if (gain > 0) { bucket.gains++; bucket.gainVol += gain; }
    }
  }

  // ── assemble ──────────────────────────────────────────────────────────────
  const sortNum = (a: number[]) => a.slice().sort((m, n) => m - n);
  const pct = (sorted: number[], p: number) => { if (!sorted.length) return 0; const idx = (sorted.length - 1) * p; const lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo); };
  const r1 = (v: number) => Number(v.toFixed(1));

  const weightByDepth = [...weightBins.entries()].sort((a, b) => a[0] - b[0]).map(([depth, vals]) => {
    const s2 = sortNum(vals);
    return { depth, n: vals.length, min: r1(s2[0]), p10: r1(pct(s2, 0.1)), median: r1(pct(s2, 0.5)), p90: r1(pct(s2, 0.9)), max: r1(s2[s2.length - 1]) };
  });

  const losses = [...lossAcc.entries()].sort((a, b) => a[0] - b[0]).map(([depth, b]) => {
    const topSec = [...b.sections.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    return {
      depth, events: b.seepage + b.partial + b.severe + b.total, vol: Math.round(b.vol),
      seepage: b.seepage, partial: b.partial, severe: b.severe, total: b.total,
      gains: b.gains, gainVol: Math.round(b.gainVol), section: topSec,
    };
  }).filter((x) => x.events > 0 || x.gains > 0);

  // Section ordering widest → narrowest.
  const allSections = new Set<string>([...sectionStats.keys(), ...sectionMud.keys()]);
  const sectionOrder = [...allSections].sort((a, b) => (holeSizeValue(b) ?? -1) - (holeSizeValue(a) ?? -1) || a.localeCompare(b));

  const stat = (vals: number[]) => { const s2 = sortNum(vals.filter((v) => Number.isFinite(v))); return s2.length ? { n: s2.length, min: r1(s2[0]), median: r1(pct(s2, 0.5)), max: r1(s2[s2.length - 1]) } : null; };
  const rheologyBySection = sectionOrder.filter((sec) => sectionStats.has(sec)).map((sec) => {
    const ss = sectionStats.get(sec)!;
    return {
      section: sec,
      maxWeight: stat(ss.rheo.get("maxWeight") ?? []), visc: stat(ss.rheo.get("visc") ?? []),
      pv: stat(ss.pv), yp: stat(ss.yp), gel: stat(ss.gel),
      solids: stat(ss.rheo.get("solids") ?? []), waterLoss: stat(ss.rheo.get("waterLoss") ?? []),
    };
  });

  const mudBySection = sectionOrder.filter((sec) => sectionMud.has(sec)).map((sec) => {
    const mm = sectionMud.get(sec)!;
    const muds = [...mm.entries()].map(([mud, e]) => ({ mud, n: e.n, medianWeight: e.wt.length ? r1(pct(sortNum(e.wt), 0.5)) : null }))
      .sort((a, b) => b.n - a.n);
    return { section: sec, muds };
  });

  const depthRange = Number.isFinite(dmin) ? { min: Math.floor(dmin / BIN) * BIN, max: Math.ceil(dmax / BIN) * BIN } : null;
  return { weightByDepth, losses, rheologyBySection, mudBySection, wellCount: seenWells.size, depthRange, bin: BIN };
}

export interface MudStockFilters extends FormationMatrixFilters {
  materials?: string[]; dateFrom?: string; dateTo?: string;
}

/**
 * Chemical-materials "mud stock" report — the multi-well port of the Delphi DDR
 * tab 3 (Unit1.pas:4454). One row per ChemicalMaterials entry for the facet-
 * selected wells, joined with the material name + unit (Materials / Measures)
 * and the hole size / mud type in use that day (L04 / N01 by well+date). Columns
 * mirror the Delphi grid: Used (Amount), Rec, Stock, OS, Req, Sent.
 *
 * Hole-size / mud-type / material / date filters are applied PER ROW (per day),
 * exactly like the Delphi join-based WHERE — not reduced to a per-well set — so a
 * stock row only matches when that day's hole/mud (and the row's material) match.
 * serialNo resolves to the day's primary L04 report so a row can open it.
 */
export function getMudStock(f: MudStockFilters): Record<string, unknown> {
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { rows: [], truncated: false, total: 0, note: "Select a field or well to load mud stock." };
  const db = data(), lk = lookups();
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { rows: [], truncated: false, total: 0 };

  // Selected facet names → code sets (per-row filters, matching the Delphi joins).
  const matNames = new Set(clean(f.materials));
  const matCodes = matNames.size ? new Set([...lk.material].filter(([, n]) => matNames.has(n)).map(([c]) => c)) : null;
  const holeNames = new Set(clean(f.holeSizes));
  const holeCodes = holeNames.size ? new Set([...lk.holeSize].filter(([, n]) => holeNames.has(normHoleSize(n))).map(([c]) => c)) : null;
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const gate = depthFormationGate(f);   // depth-window + formation row filter

  // The hole size (L04) and mud type (N01) in use per (well | date), plus the
  // day's primary (lowest-serial) L04 report — so each stock row shows that day's
  // hole/mud, can be filtered by it, and can open the matching daily report.
  const holeByDay = new Map<string, string>(), mudByDay = new Map<string, string>(), serialByDay = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, SerialNo, DrillingDate, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.DrillingDate)}`;
      if (!holeByDay.has(k)) holeByDay.set(k, s(r.HoleSizeCode));
      const sn = Number(r.SerialNo);
      if (Number.isFinite(sn)) { const cur = serialByDay.get(k); if (cur == null || sn < cur) serialByDay.set(k, sn); }
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`; if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
    }
  }

  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(
      `SELECT WellCode, fDate, FromPoint, ToPoint, MaterialCode, Amount, MeasureCode, Rec, Stock, OS, Req, Sent FROM ChemicalMaterials WHERE ${where.join(" AND ")}`,
    ).all(...params) as Row[]) {
      const matCode = s(r.MaterialCode);
      if (matCodes && !matCodes.has(matCode)) continue;
      const wc = s(r.WellCode), date = s(r.fDate), k = `${wc}|${date}`;
      const holeCode = holeByDay.get(k) ?? "";
      if (holeCodes && !holeCodes.has(holeCode)) continue;
      const mudCode = mudByDay.get(k) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      const toMd = Number(s(r.ToPoint)), frMd = Number(s(r.FromPoint));
      const stockMd = Number.isFinite(toMd) ? toMd : (Number.isFinite(frMd) ? frMd : null);
      if (gate.active && !gate.pass(wc, stockMd)) continue;
      out.push({
        wellCode: wc, date: orNull(date), serialNo: serialByDay.get(k) ?? null,
        from: val(r.FromPoint), to: val(r.ToPoint),
        holeSize: orNull(look(lk.holeSize, holeCode)), topFormation: gate.topFormation(wc, stockMd), mudType: orNull(look(lk.mud, mudCode)),
        material: orNull(look(lk.material, matCode)), measure: orNull(look(lk.measure, r.MeasureCode)),
        used: val(r.Amount), rec: val(r.Rec), stock: val(r.Stock),
        os: val(r.OS), req: val(r.Req), sent: val(r.Sent),
      });
    }
  }
  out.sort((a, b) =>
    String(a.wellCode).localeCompare(String(b.wellCode)) ||
    String(a.date ?? "").localeCompare(String(b.date ?? "")) ||
    String(a.material ?? "").localeCompare(String(b.material ?? "")));
  const cap = 8000;
  return { rows: out.slice(0, cap), truncated: out.length > cap, total: out.length };
}

/**
 * Mud-material PLANNING analytics over ChemicalMaterials — the next-well
 * forecasting view (vs getMudStock's per-day accounting grid). For the faceted
 * wells it returns, per (material × hole section): total consumed, the section
 * metres drilled per contributing well, and the per-well per-metre rates — the
 * basis for benchmarking the next well. The driver is that material need scales
 * with the metres drilled IN a section (26"/17½"/12¼"/8½"…), so every figure is
 * normalised by L04's drilled interval for that (well, hole size), NOT by the
 * consumption row's own depth (early "0–0" spud days drill no metres).
 *
 * Returns (one fetch powers all planning views):
 *  • sections        — the hole sizes present, widest→narrowest, with total metres.
 *  • materials        — per material: unit, total used, total cost (Rial/Dollar),
 *                       and per-section { used, metres, wells, perM stats
 *                       (mean / p50 / min / max over the per-well rates), cost }.
 * Per-row hole size is the day's L04 section; mud/material/date facets apply per
 * row exactly as getMudStock does.
 */
export interface MudPlanningFilters extends MudStockFilters {}

export function getMudPlanning(f: MudPlanningFilters): Record<string, unknown> {
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { sections: [], materials: [], wellCount: 0, note: "Select a field or well to plan from offset consumption." };
  const db = data(), lk = lookups();
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { sections: [], materials: [], wellCount: 0 };

  const matNames = new Set(clean(f.materials));
  const matCodes = matNames.size ? new Set([...lk.material].filter(([, n]) => matNames.has(n)).map(([c]) => c)) : null;
  const holeNames = new Set(clean(f.holeSizes));
  const holeCodes = holeNames.size ? new Set([...lk.holeSize].filter(([, n]) => holeNames.has(normHoleSize(n))).map(([c]) => c)) : null;
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);

  // Section metres drilled per (well | hole-size code): max(ToPoint)−min(FromPoint)
  // over that well's L04 days in the section. Also the day→(hole, mud) maps.
  const holeByDay = new Map<string, string>(), mudByDay = new Map<string, string>();
  const secKey = (wc: string, hsc: string) => `${wc}|${hsc}`;
  const secSpan = new Map<string, { f: number; t: number }>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, DrillingDate, HoleSizeCode, FromPoint, ToPoint FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const wc = s(r.WellCode), hsc = s(r.HoleSizeCode);
      holeByDay.set(`${wc}|${s(r.DrillingDate)}`, hsc);
      const fp = Number(s(r.FromPoint)), tp = Number(s(r.ToPoint));
      if (Number.isFinite(fp) && Number.isFinite(tp) && tp > fp && hsc) {
        const k = secKey(wc, hsc), cur = secSpan.get(k);
        if (!cur) secSpan.set(k, { f: fp, t: tp }); else { cur.f = Math.min(cur.f, fp); cur.t = Math.max(cur.t, tp); }
      }
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`; if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
    }
  }
  const secMetres = (wc: string, hsc: string) => { const v = secSpan.get(secKey(wc, hsc)); return v ? v.t - v.f : 0; };
  // Canonical SECTION key = the normalised hole-size label, so the several raw
  // hole-size codes that mean the same diameter (e.g. an unmapped "26" alongside
  // the real 26" code) collapse to ONE section. Metres for a (well, section) sum
  // every contributing code's drilled span.
  const sec = (hsc: string): string => normHoleSize(look(lk.holeSize, hsc));
  const wellSectionMetres = (wc: string, section: string): number => {
    let m = 0;
    for (const k of secSpan.keys()) { const [w, hsc] = k.split("|"); if (w === wc && sec(hsc) === section) m += secMetres(wc, hsc); }
    return m;
  };

  // Per (material | section): consumed + cost, and per-well consumed (→ per-metre).
  interface Cell { used: number; costR: number; costD: number; perWell: Map<string, number> }
  const cells = new Map<string, Cell>();                 // key: matCode|section
  const unitOf = new Map<string, string>();              // matCode → unit label
  const matTotal = new Map<string, { used: number; costR: number; costD: number }>();
  const sectionWells = new Map<string, Set<string>>();   // section → wells that drilled it
  const cell = (mk: string, section: string) => { const k = `${mk}|${section}`; let c = cells.get(k); if (!c) { c = { used: 0, costR: 0, costD: 0, perWell: new Map() }; cells.set(k, c); } return c; };

  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`, `CAST(Amount AS REAL) > 0`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(
      `SELECT WellCode, fDate, MaterialCode, Amount, MeasureCode, CostRial, CostDollar FROM ChemicalMaterials WHERE ${where.join(" AND ")}`,
    ).all(...params) as Row[]) {
      const matCode = s(r.MaterialCode);
      if (matCodes && !matCodes.has(matCode)) continue;
      const wc = s(r.WellCode), date = s(r.fDate), dk = `${wc}|${date}`;
      const hsc = holeByDay.get(dk) ?? "";
      if (holeCodes && !holeCodes.has(hsc)) continue;
      const mudCode = mudByDay.get(dk) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      if (!hsc) continue;                                 // no section → can't normalise
      const section = sec(hsc); if (!section) continue;
      const amt = Number(s(r.Amount)); if (!Number.isFinite(amt) || amt <= 0) continue;
      const costR = Number(s(r.CostRial)) || 0, costD = Number(s(r.CostDollar)) || 0;

      const c = cell(matCode, section);
      c.used += amt; c.costR += costR; c.costD += costD;
      c.perWell.set(wc, (c.perWell.get(wc) ?? 0) + amt);
      if (!unitOf.has(matCode)) unitOf.set(matCode, s(look(lk.measure, r.MeasureCode)) || "");
      const mt = matTotal.get(matCode) ?? { used: 0, costR: 0, costD: 0 };
      mt.used += amt; mt.costR += costR; mt.costD += costD; matTotal.set(matCode, mt);
      let sw = sectionWells.get(section); if (!sw) { sw = new Set(); sectionWells.set(section, sw); }
      sw.add(wc);
    }
  }

  // Sections present (widest→narrowest), with total metres summed per canonical
  // size. Sections where no well actually drilled metres are dropped (they can't
  // anchor a per-metre rate — e.g. a stray unmapped hole-size code on a 0-m day).
  const secMetresTotal = new Map<string, number>();
  for (const k of secSpan.keys()) { const [wc, hsc] = k.split("|"); const section = sec(hsc); if (sectionWells.has(section)) secMetresTotal.set(section, (secMetresTotal.get(section) ?? 0) + secMetres(wc, hsc)); }
  const sections = [...sectionWells.keys()]
    .map((section) => ({ code: section, size: section, wells: sectionWells.get(section)!.size, metres: Math.round(secMetresTotal.get(section) ?? 0) }))
    .filter((s2) => s2.metres > 0)
    .sort((a, b) => (holeSizeValue(b.size) ?? -1) - (holeSizeValue(a.size) ?? -1) || a.size.localeCompare(b.size));

  const median = (xs: number[]) => { if (!xs.length) return 0; const a = xs.slice().sort((m, n) => m - n); const i = a.length >> 1; return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2; };

  // Assemble per-material rows with per-section per-metre stats.
  const materials = [...matTotal.entries()].map(([mk, tot]) => {
    const bySection = sections.map((secn) => {
      const c = cells.get(`${mk}|${secn.code}`);
      if (!c) return { code: secn.code, size: secn.size, used: 0, metres: 0, wells: 0, perMmean: 0, perMmedian: 0, perMmin: 0, perMmax: 0, costR: 0, costD: 0 };
      // Per-well per-metre rate (only wells with >0 metres drilled in this section).
      const rates: number[] = []; let metresSum = 0;
      for (const [wc, used] of c.perWell) { const m = wellSectionMetres(wc, secn.code); if (m > 0) { rates.push(used / m); metresSum += m; } }
      return {
        code: secn.code, size: secn.size, used: Math.round(c.used), metres: Math.round(metresSum), wells: c.perWell.size,
        perMmean: rates.length ? Number((rates.reduce((p, q) => p + q, 0) / rates.length).toFixed(3)) : 0,
        perMmedian: Number(median(rates).toFixed(3)),
        perMmin: rates.length ? Number(Math.min(...rates).toFixed(3)) : 0,
        perMmax: rates.length ? Number(Math.max(...rates).toFixed(3)) : 0,
        costR: Math.round(c.costR), costD: Math.round(c.costD),
      };
    }).filter((x) => x.used > 0);
    return {
      material: look(lk.material, mk) || mk, unit: unitOf.get(mk) || "",
      totalUsed: Math.round(tot.used), totalCostR: Math.round(tot.costR), totalCostD: Math.round(tot.costD),
      bySection,
    };
  }).filter((m) => m.bySection.length > 0)
    .sort((a, b) => b.totalUsed - a.totalUsed);

  return { sections, materials, wellCount: sectionWells.size ? new Set([...sectionWells.values()].flatMap((s) => [...s])).size : 0 };
}

export interface WellPathFilters extends FormationMatrixFilters {
  dateFrom?: string; dateTo?: string;
}

/**
 * Directional-survey "well path" report — the multi-well port of the Delphi DDR
 * tab 4 (Unit1.pas:4483 + drawpat). One row per M04 survey station for the facet-
 * selected wells, joined with the hole size / mud type in use that day. Columns:
 * MD (FromPoint), Inc (Angle), Az (Azimuth), TVD, N/S, E/W, Section HD, DLS, VS,
 * Direction. N/S and E/W are signed numeric text in the source (e.g. "-22.15").
 *
 * Mirrors the Delphi WHERE: only stations that HAVE N/S AND E/W are returned (the
 * plottable deviated stations — vertical wells have none), ordered by well, date,
 * MD. Hole-size / mud / date filters apply per row; serialNo resolves the day's
 * primary L04 report. drawpat plots: Vertical section (TVD↓ vs Section HD), Plan
 * (N/S vs E/W) and Dogleg (DLS vs TVD↓) — rendered in the web Graph view.
 */
export function getWellPath(f: WellPathFilters): Record<string, unknown> {
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { rows: [], truncated: false, total: 0, note: "Select a field or well to load the well path." };
  const db = data(), lk = lookups();
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { rows: [], truncated: false, total: 0 };

  const holeNames = new Set(clean(f.holeSizes));
  const holeCodes = holeNames.size ? new Set([...lk.holeSize].filter(([, n]) => holeNames.has(normHoleSize(n))).map(([c]) => c)) : null;
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const num = (v: unknown): number | null => { const n = parseFloat(s(v)); return Number.isFinite(n) ? n : null; };
  const gate = depthFormationGate(f);   // depth-window + formation row filter

  // hole/mud in use per (well|date) + the day's primary L04 report serial.
  const holeByDay = new Map<string, string>(), mudByDay = new Map<string, string>(), serialByDay = new Map<string, number>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, SerialNo, DrillingDate, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.DrillingDate)}`;
      if (!holeByDay.has(k)) holeByDay.set(k, s(r.HoleSizeCode));
      const sn = Number(r.SerialNo);
      if (Number.isFinite(sn)) { const cur = serialByDay.get(k); if (cur == null || sn < cur) serialByDay.set(k, sn); }
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`; if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
    }
  }

  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`, `TRIM(IFNULL(N_S,'')) <> ''`, `TRIM(IFNULL(E_W,'')) <> ''`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(
      `SELECT WellCode, fDate, FromPoint, Angle, Azimuth, TVD, N_S, E_W, SectionHD, DLS, VS, Direction FROM M04 WHERE ${where.join(" AND ")}`,
    ).all(...params) as Row[]) {
      const wc = s(r.WellCode), date = s(r.fDate), k = `${wc}|${date}`;
      const holeCode = holeByDay.get(k) ?? "";
      if (holeCodes && !holeCodes.has(holeCode)) continue;
      const mudCode = mudByDay.get(k) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      const stationMd = num(r.FromPoint);   // MD = survey station depth
      if (gate.active && !gate.pass(wc, stationMd)) continue;
      const ns = num(r.N_S), ew = num(r.E_W);
      if (ns == null || ew == null) continue; // plottable stations only (matches Delphi)
      out.push({
        wellCode: wc, date: orNull(date), serialNo: serialByDay.get(k) ?? null,
        md: stationMd, inc: num(r.Angle), az: num(r.Azimuth), tvd: num(r.TVD),
        ns, ew, sectionHD: num(r.SectionHD), dls: num(r.DLS), vs: num(r.VS), direction: orNull(r.Direction),
        holeSize: orNull(look(lk.holeSize, holeCode)), topFormation: gate.topFormation(wc, stationMd), mudType: orNull(look(lk.mud, mudCode)),
      });
    }
  }
  const md = (x: Record<string, unknown>) => (typeof x.md === "number" ? x.md : 0);
  out.sort((a, b) =>
    String(a.wellCode).localeCompare(String(b.wellCode)) ||
    String(a.date ?? "").localeCompare(String(b.date ?? "")) ||
    md(a) - md(b));
  const cap = 8000;
  return { rows: out.slice(0, cap), truncated: out.length > cap, total: out.length };
}

/**
 * Well-Path facet options — only the fields and wells that actually have
 * directional-survey data (M04 stations with N/S·E/W coordinates), so the Well
 * Path sidebar doesn't list vertical wells / wells with no path to plot. Returns
 * the same { fields, wells } shape the global search-options uses, restricted to
 * surveyed wells; cached (the underlying M04/A01 data is static).
 */
let _wellPathOpts: Record<string, unknown> | null = null;
export function getWellPathOptions(): Record<string, unknown> {
  if (_wellPathOpts) return _wellPathOpts;
  const db = data(), lk = lookups();
  // Wells with at least one M04 station carrying N/S or E/W (i.e. a real path).
  const surveyed = new Set<string>();
  for (const r of db.prepare(
    `SELECT DISTINCT TRIM(WellCode) wc FROM M04 WHERE TRIM(IFNULL(N_S,'')) <> '' OR TRIM(IFNULL(E_W,'')) <> ''`,
  ).all() as Row[]) { const wc = s(r.wc); if (/[A-Za-z0-9]/.test(wc)) surveyed.add(wc); }

  const fieldSet = new Set<string>();
  const wells: { code: string; name: string; field: string | null }[] = [];
  for (const r of db.prepare(`SELECT WellCode, EnglishName, FieldCode FROM A01 ORDER BY EnglishName, WellCode`).all() as Row[]) {
    const code = s(r.WellCode);
    if (!surveyed.has(code)) continue;
    const field = look(lk.field, r.FieldCode);
    wells.push({ code, name: s(r.EnglishName) || code, field });
    if (field) fieldSet.add(field);
  }
  const fields = [...fieldSet].sort();
  _wellPathOpts = { fields, wells };
  return _wellPathOpts;
}

export interface TimeAnalysisFilters extends FormationMatrixFilters {
  activityTypes?: string[]; dateFrom?: string; dateTo?: string;
}

/**
 * Time-analysis report — the multi-well port of the Delphi DDR tab 5 (Unit1.pas:
 * 4511, + TABF('A') cross-tab + drawACT chart). One row per TimeAnalysis entry
 * (hours on an activity for a well/day), resolved through the activity hierarchy
 * Group → Type → Activity, joined with that day's hole size / mud type and the
 * day's drilled interval (L04 From/To) + narrative.
 *
 * Hole-size / mud / activity-type / date filters apply per row; serialNo resolves
 * the day's primary L04 report. The web tab builds three views from these rows:
 * Rows (the grid), Pivot (day × activity-type hours with sums — the TABF table),
 * and Chart (total hours by activity / type — drawACT).
 */
export function getTimeAnalysis(f: TimeAnalysisFilters): Record<string, unknown> {
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { rows: [], truncated: false, total: 0, note: "Select a field or well to load time analysis." };
  const db = data(), lk = lookups();
  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { rows: [], truncated: false, total: 0 };

  const holeNames = new Set(clean(f.holeSizes));
  const holeCodes = holeNames.size ? new Set([...lk.holeSize].filter(([, n]) => holeNames.has(normHoleSize(n))).map(([c]) => c)) : null;
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  // activity-type filter → set of "groupCode|typeCode" composites (lk.activityType key).
  const typeNames = new Set(clean(f.activityTypes));
  const typeKeys = typeNames.size ? new Set([...lk.activityType].filter(([, n]) => typeNames.has(n)).map(([k]) => k)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const num = (v: unknown): number | null => { const n = parseFloat(s(v)); return Number.isFinite(n) ? n : null; };

  // The day's primary (lowest-serial) L04 report: hole size, drilled From/To,
  // narrative + serial. Plus the day's mud type (N01) and the day's deepest hole
  // depth (max ToPoint / MorningDepth across that day's reports) — the cumulative
  // MD the next-well depth-vs-days learning curve is plotted against.
  const byDay = new Map<string, { serial: number | null; hole: string; from: unknown; to: unknown; desc: unknown; depth: number | null }>();
  const mudByDay = new Map<string, string>();
  const depthOf = (...vs: unknown[]) => { let d = -Infinity; for (const v of vs) { const x = Number(s(v)); if (Number.isFinite(x) && x > d) d = x; } return d > 0 ? d : null; };
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, SerialNo, DrillingDate, HoleSizeCode, FromPoint, ToPoint, MorningDepth, Description FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.DrillingDate)}`;
      const snN = Number(r.SerialNo), fin = Number.isFinite(snN);
      const cur = byDay.get(k);
      const dDepth = depthOf(r.ToPoint, r.MorningDepth);
      const depth = dDepth != null && (cur?.depth == null || dDepth > cur.depth) ? dDepth : (cur?.depth ?? null);
      if (!cur || (fin && (cur.serial == null || snN < cur.serial))) {
        byDay.set(k, { serial: fin ? snN : (cur?.serial ?? null), hole: s(r.HoleSizeCode), from: val(r.FromPoint), to: val(r.ToPoint), desc: orNull(r.Description), depth });
      } else if (depth != null) {
        cur.depth = depth; // keep the deepest depth seen even when the primary serial doesn't change
      }
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`; if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
    }
  }

  const gate = depthFormationGate(f);   // depth-window + formation row filter
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(
      `SELECT WellCode, fDate, ActivityGroupCode, ActivityTypeCode, ActivityCode, Hours, Description FROM TimeAnalysis WHERE ${where.join(" AND ")}`,
    ).all(...params) as Row[]) {
      const gc = s(r.ActivityGroupCode), tc = s(r.ActivityTypeCode), ac = s(r.ActivityCode);
      const typeKey = `${gc}|${tc}`;
      if (typeKeys && !typeKeys.has(typeKey)) continue;
      const wc = s(r.WellCode), date = s(r.fDate), k = `${wc}|${date}`;
      const d = byDay.get(k);
      const holeCode = d?.hole ?? "";
      if (holeCodes && !holeCodes.has(holeCode)) continue;
      const mudCode = mudByDay.get(k) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      const taMd = d?.depth != null ? d.depth : (typeof d?.to === "number" ? d.to : null);
      if (gate.active && !gate.pass(wc, taMd)) continue;
      out.push({
        wellCode: wc, date: orNull(date), serialNo: d?.serial ?? null,
        holeSize: orNull(look(lk.holeSize, holeCode)), from: d?.from ?? null, to: d?.to ?? null,
        depth: d?.depth ?? null, topFormation: gate.topFormation(wc, taMd),
        mudType: orNull(look(lk.mud, mudCode)),
        group: orNull(look(lk.activityGroup, gc)),
        type: lk.activityType.get(typeKey) ?? null,
        activity: lk.activity.get(`${gc}|${tc}|${ac}`) ?? null,
        hours: num(r.Hours), description: orNull(r.Description), dayNarrative: d?.desc ?? null,
      });
    }
  }
  out.sort((a, b) =>
    String(a.wellCode).localeCompare(String(b.wellCode)) ||
    String(a.date ?? "").localeCompare(String(b.date ?? "")));
  // Well code → English display name (for charts that label by well).
  const wellNames: Record<string, string> = {};
  const seen = new Set(out.map((r) => String(r.wellCode)));
  if (seen.size) {
    for (const r of db.prepare(`SELECT WellCode, EnglishName FROM A01`).all() as Row[]) {
      const wc = s(r.WellCode); if (seen.has(wc)) wellNames[wc] = s(r.EnglishName) || wc;
    }
  }
  const cap = 9000;
  return { rows: out.slice(0, cap), truncated: out.length > cap, total: out.length, wellNames };
}

export interface ToolsFilters extends FormationMatrixFilters {
  tool?: string; dateFrom?: string; dateTo?: string;
}

// ── Tools / equipment browser (Delphi DDR tab 6, Unit1.pas:4552) ─────────────
// Nine equipment types, each its own table + (optional) lookup, shown with the
// day's hole size / mud type. `get` resolves one display field from a source row.
interface ToolField { key: string; label: string; text?: boolean; wide?: boolean; hidden?: boolean; titleKey?: string; get: (r: Row, lk: Lookups) => unknown }
interface ToolSpec { label: string; table: string; fields: ToolField[] }

// ── IADC bit dull-grade decoding (SPE/IADC 23937/23938/23939) ─────────────────
// Dictionaries for the 8-position dull grade (I-O-D-L-B-G-O-R). Used by the Bit
// tool to assemble + decode the grade. NOTE: in this legacy L05 schema the column
// NAMES for positions 6 & 7 are SWAPPED vs IADC order — ODullCharacteristicCode
// actually holds the GAUGE and GaugeWearCode holds the OTHER dull characteristic
// (confirmed from the data: ODullCharacteristicCode = IG/UG/OG/1, GaugeWearCode =
// WT/BT/CT…). bitDull() maps them back to the correct IADC positions.
const IADC_DULL_CHAR: Record<string, string> = {
  BC: "Broken cone", BF: "Bond failure", BT: "Broken teeth/cutters", BU: "Balled up", CC: "Cracked cone/cutter",
  CD: "Cone dragged", CI: "Cone interference", CR: "Cored", CT: "Chipped teeth/cutters", ER: "Erosion",
  FC: "Flat-crested wear", HC: "Heat checking", JD: "Junk damage", LC: "Lost cone", LN: "Lost nozzle",
  LT: "Lost teeth/cutters", NO: "No dull characteristic", NR: "Not re-runnable", OC: "Off-center wear",
  PB: "Pinched bit", PN: "Plugged nozzle/flow", RG: "Rounded gauge", RO: "Ring out", RR: "Re-runnable",
  SD: "Shirttail damage", SS: "Self-sharpening wear", TR: "Tracking", WO: "Washed out", WT: "Worn teeth/cutters",
};
const IADC_LOC_CONE: Record<string, string> = { N: "Nose row", M: "Middle row", G: "Gauge row", A: "All rows", C: "Cone", "1": "Cone 1", "2": "Cone 2", "3": "Cone 3" };
const IADC_LOC_PDC: Record<string, string> = { C: "Cone", N: "Nose", T: "Taper", S: "Shoulder", G: "Gauge", A: "All areas" };
const IADC_BEARING: Record<string, string> = { E: "Seals effective", F: "Seals failed", N: "Not gradeable", X: "Fixed cutter — no bearings" };
const IADC_REASON: Record<string, string> = {
  BHA: "Change BHA", CM: "Condition mud", CP: "Core point", DMF: "Downhole motor failure", DP: "Drill plug",
  DSF: "Drill-string failure", DST: "Drill-stem test", DTF: "Downhole tool failure", FM: "Formation change",
  HP: "Hole problems", HR: "Hours on bit", LIH: "Left in hole", LOG: "Run logs", PP: "Pump pressure",
  PR: "Penetration rate", RIG: "Rig repair", TD: "Total / casing depth", TQ: "Torque", TW: "Twist off",
  WC: "Weather", WO: "Washout (drill string)",
};
const stripZeros = (v: string) => v.replace(/^0+(?=\d)/, "") || v;

/** PDC vs roller-cone for a bit row: bearing 'X' ⇒ PDC; numeric/E/F/N ⇒ cone;
 *  else inferred from the IADC class / type (M/S body ⇒ PDC, leading digit ⇒ cone). */
function bitKind(r: Row, lk: Lookups): string | null {
  const bear = s(r.BearingWearCode).toUpperCase();
  if (bear === "X") return "PDC";
  if (/^[0-8]+$|^[EFN]$/.test(stripZeros(bear))) return "Roller cone";
  const iadc = s(look(lk.bitIADC, r.BitCode)).toUpperCase();
  if (/^[MS]\d/.test(iadc)) return "PDC";
  if (/^\d/.test(iadc)) return "Roller cone";
  const ty = s(look(lk.bitType, r.BitCode)).toUpperCase();
  if (/PDC|DIAMOND|^[MS]\d/.test(ty)) return "PDC";
  return null;
}

/** Assemble + decode the IADC 8-position dull grade for an L05 bit row, using the
 *  corrected column mapping (gauge ← ODullCharacteristicCode, other ← GaugeWearCode). */
/**
 * The IADC 8-position dull grade, as a code, a decoded title, AND the discrete
 * positions.
 *
 * The positions were always computed here and only ever joined into a string.
 * The wear view needs them apart: the dull CHARACTERISTIC (position 3) is what a
 * Pareto of damage modes counts, and inner/outer wear are what a wear RATE
 * divides by hours. The IADC scale is linear in remaining cutter height
 * (SPE/IADC 23939), which is what makes a rate meaningful at all.
 */
function bitDull(r: Row, lk: Lookups): {
  code: string | null; title: string | null;
  dullChar: string | null; location: string | null; bearing: string | null; gauge: string | null;
} {
  const inner = stripZeros(s(r.ICutterWearCode)), outer = stripZeros(s(r.OCutterWearCode));
  const dchar = s(r.DullCharacteristicCode).toUpperCase();
  const loc = s(r.WearLocationCode).toUpperCase();
  const bear = s(r.BearingWearCode).toUpperCase();
  const gRaw = s(r.ODullCharacteristicCode).toUpperCase();   // position 6 — GAUGE (swapped name)
  const other = s(r.GaugeWearCode).toUpperCase();            // position 7 — OTHER dull (swapped name)
  const reason = s(r.ReasonPulledCode).toUpperCase();
  if (![inner, outer, dchar, loc, bear, gRaw, other, reason].some(Boolean)) {
    return { code: null, title: null, dullChar: null, location: null, bearing: null, gauge: null };
  }
  const isPDC = bear === "X";
  // Gauge → code + text.
  let gCode = "", gTxt = "";
  const gn = stripZeros(gRaw);
  if (/^I/.test(gRaw)) { gCode = "I"; gTxt = "in gauge"; }
  else if (/^\d+$/.test(gn)) { gCode = gn; gTxt = `${gn}/16" undergauge`; }
  else if (gRaw && gRaw !== "NO") { gCode = gRaw; gTxt = gRaw === "UG" ? "undergauge" : gRaw === "OG" ? "out of gauge" : gRaw; }
  const bn = stripZeros(bear);
  const bearTxt = IADC_BEARING[bear] ?? (/^[0-8]+$/.test(bn) ? `${bn}/8 bearing life used` : bear);
  const locMap = isPDC ? IADC_LOC_PDC : IADC_LOC_CONE;
  const code = [inner || "·", outer || "·", dchar || "·", loc || "·", bear || "·", gCode || "·", other || "·", reason || "·"].join("-");
  const wear = (v: string) => (v ? (v === "8" ? "8/8 (gone)" : `${v}/8`) : "");
  const t: string[] = [];
  if (inner) t.push(`Inner ${wear(inner)}`);
  if (outer) t.push(`Outer ${wear(outer)}`);
  if (dchar) t.push(`${dchar} = ${IADC_DULL_CHAR[dchar] ?? dchar}`);
  if (loc) t.push(`@ ${loc} = ${locMap[loc] ?? loc}`);
  if (bear) t.push(`bearing ${bearTxt}`);
  if (gCode) t.push(`gauge ${gTxt}`);
  if (other && other !== "NO") t.push(`other ${other} = ${IADC_DULL_CHAR[other] ?? other}`);
  if (reason) t.push(`pulled ${reason} = ${IADC_REASON[reason] ?? look(lk.reasonPulled, r.ReasonPulledCode) ?? reason}`);
  return {
    code, title: t.join(" · "),
    dullChar: dchar || null, location: loc || null, bearing: bear || null, gauge: gCode || null,
  };
}

const TOOL_SPECS: Record<string, ToolSpec> = {
  jar: { label: "Jar", table: "Jar", fields: [
    { key: "jarType", label: "Jar type", text: true, get: (r, lk) => look(lk.jarType, r.JarTypeCode) },
    { key: "size", label: "Size", text: true, get: (r) => orNull(r.JarSize) },
    { key: "serial", label: "Serial no", text: true, get: (r) => orNull(r.JarSerialNo) },
    { key: "hours", label: "Hours", get: (r) => val(r.fHour) },
  ] },
  mwd: { label: "MWD", table: "MWD", fields: [
    { key: "mwdType", label: "MWD type", text: true, get: (r) => orNull(r.MWDTypeCode) },
    { key: "size", label: "Size", text: true, get: (r) => orNull(r.MWDSize) },
    { key: "serial", label: "Serial no", text: true, get: (r) => orNull(r.MWDSerialNo) },
    { key: "hours", label: "Hours", get: (r) => val(r.fHour) },
  ] },
  dhMotor: { label: "DH Motor", table: "DHMotor", fields: [
    { key: "type", label: "Motor type", text: true, get: (r, lk) => look(lk.dhMotorType, r.DHMotorTypeCode) },
    { key: "size", label: "Size", text: true, get: (r) => orNull(r.DHMotorSize) },
    { key: "serial", label: "Serial no", text: true, get: (r) => orNull(r.DHMotorSerialNo) },
    { key: "hours", label: "Hours", get: (r) => val(r.fHour) },
  ] },
  bha: { label: "BHA", table: "BottomHoleAssembly", fields: [
    { key: "assemblyNo", label: "Assembly no", text: true, get: (r) => orNull(r.AssemblyNo) },
    { key: "spec", label: "Specification", text: true, wide: true, get: (r) => orNull(r.Specification) },
    { key: "weight", label: "Weight", get: (r) => val(r.Weight) },
    { key: "length", label: "Length", get: (r) => val(r.Length) },
    { key: "dragUp", label: "Drag up", get: (r) => val(r.DragUp) },
    { key: "dragDown", label: "Drag down", get: (r) => val(r.DragDown) },
  ] },
  drillString: { label: "Drill string", table: "DrillString", fields: [
    { key: "no", label: "No.", text: true, get: (r) => orNull(r.SerialNo) },
    { key: "size", label: "Size", text: true, get: (r) => orNull(r.fSize) },
    { key: "grade", label: "Grade", text: true, get: (r) => orNull(r.Grade) },
  ] },
  casing: { label: "Casing", table: "L08", fields: [
    { key: "depth", label: "Depth (m)", get: (r) => val(r.DepthPoint) },
    { key: "casing", label: "Casing", text: true, get: (r, lk) => look(lk.casing, r.CasingCode) },
    { key: "joint", label: "Joint", text: true, get: (r) => orNull(r.Joint) },
    { key: "desc", label: "Description", text: true, wide: true, get: (r) => orNull(r.Description) },
  ] },
  liner: { label: "Liner", table: "L06", fields: [
    { key: "from", label: "From (m)", get: (r) => val(r.FromPoint) },
    { key: "to", label: "To (m)", get: (r) => val(r.ToPoint) },
    { key: "liner", label: "Liner", text: true, get: (r, lk) => look(lk.casing, r.LinerCode) },
    { key: "joint", label: "Joint", text: true, get: (r) => orNull(r.Joint) },
    { key: "desc", label: "Description", text: true, wide: true, get: (r) => orNull(r.Description) },
  ] },
  bit: { label: "Bit", table: "L05", fields: [
    { key: "from", label: "From (m)", get: (r) => val(r.FromPoint) },
    { key: "to", label: "To (m)", get: (r) => val(r.ToPoint) },
    { key: "bit", label: "Bit", text: true, get: (r, lk) => look(lk.bit, r.BitCode) },
    { key: "size", label: "Bit size", text: true, get: (r, lk) => look(lk.bitSize, r.BitCode) || orNull(r.HoleSize) },
    { key: "type", label: "Type", text: true, get: (r, lk) => look(lk.bitType, r.BitCode) },
    { key: "kind", label: "Kind", text: true, get: (r, lk) => bitKind(r, lk) },
    { key: "iadc", label: "IADC class", text: true, get: (r, lk) => look(lk.bitIADC, r.BitCode) },
    { key: "bitNo", label: "Bit no", text: true, get: (r) => orNull(r.BitNo) },
    { key: "serial", label: "Serial no", text: true, get: (r) => orNull(r.BitSerialNo) },
    { key: "nozzles", label: "Nozzles", text: true, get: (r) => orNull(r.NozzleSize) },
    { key: "tfa", label: "TFA", get: (r) => val(r.TFA) },
    { key: "bitHrs", label: "Bit hrs", get: (r) => val(r.BitHour) },
    { key: "meters", label: "Meters", get: (r) => val(r.BitMeterTotal) },
    // ROP (m/hr) = footage ÷ rotating hours, the per-bit performance metric.
    { key: "rop", label: "ROP m/hr", get: (r) => {
      const hrs = Number(s(r.BitHour)); let m = Number(s(r.BitMeterTotal));
      if (!Number.isFinite(m) || m <= 0) { const f = Number(s(r.FromPoint)), t = Number(s(r.ToPoint)); m = (Number.isFinite(f) && Number.isFinite(t)) ? t - f : NaN; }
      return Number.isFinite(hrs) && hrs > 0 && Number.isFinite(m) && m > 0 ? Number((m / hrs).toFixed(1)) : null;
    } },
    { key: "minWob", label: "WOB min", get: (r) => val(r.MinWeight) },
    { key: "maxWob", label: "WOB max", get: (r) => val(r.MaxWeight) },
    { key: "minRpm", label: "RPM min", get: (r) => val(r.MinRPM) },
    { key: "maxRpm", label: "RPM max", get: (r) => val(r.MaxRPM) },
    // IADC 8-position dull grade (I-O-D-L-B-G-O-R); hover shows the decoded meaning.
    { key: "dull", label: "IADC dull grade", text: true, titleKey: "dullTitle", get: (r, lk) => bitDull(r, lk).code },
    { key: "dullTitle", label: "", hidden: true, get: (r, lk) => bitDull(r, lk).title },
    { key: "reasonPulled", label: "Reason pulled", text: true, get: (r, lk) => look(lk.reasonPulled, r.ReasonPulledCode) },
    { key: "desc", label: "Description", text: true, wide: true, get: (r) => orNull(r.Description) },
  ] },
  stabilizers: { label: "Stabilizers", table: "Stabilizers", fields: [
    { key: "spec", label: "Specification", text: true, wide: true, get: (r) => orNull(r.Specification ?? r.Description) },
  ] },
};
export const TOOL_LIST = Object.entries(TOOL_SPECS).map(([key, s]) => ({ key, label: s.label }));

/**
 * Tools / equipment report — the multi-well port of the Delphi DDR tab 6
 * (Unit1.pas:4552). One row per record of the chosen tool table (Jar / MWD /
 * DH-Motor / BHA / Drill string / Casing(L08) / Liner(L06) / Bit(L05) /
 * Stabilizers) for the faceted wells, joined with that day's hole size / mud type
 * and the day's primary L04 report (so a row can open it). Columns are
 * tool-specific (resolved through each tool's lookup). MWD / Stabilizers tables
 * are absent in this DB → an empty note, matching the Delphi tool list.
 */
export function getTools(f: ToolsFilters): Record<string, unknown> {
  const toolKey = s(f.tool) || "bit";
  const spec = TOOL_SPECS[toolKey];
  if (!spec) return { tool: toolKey, columns: [], rows: [], truncated: false, total: 0, note: "Unknown tool." };
  const columns = [
    { key: "holeSize", label: "Hole", text: true }, { key: "topFormation", label: "Top formation", text: true }, { key: "mudType", label: "Mud type", text: true },
    ...spec.fields.filter((fl) => !fl.hidden).map((fl) => ({ key: fl.key, label: fl.label, text: fl.text, wide: fl.wide, titleKey: fl.titleKey })),
  ];
  const base = { tool: toolKey, label: spec.label, columns };
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { ...base, rows: [], truncated: false, total: 0, note: "Select a field or well to load tools." };
  const db = data(), lk = lookups();
  const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND lower(name)=lower(?)`).get(spec.table);
  if (!exists) return { ...base, rows: [], truncated: false, total: 0, note: `No ${spec.label} records in this database.` };
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { ...base, rows: [], truncated: false, total: 0 };

  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  const holeNames = new Set(clean(f.holeSizes));
  const holeCodes = holeNames.size ? new Set([...lk.holeSize].filter(([, n]) => holeNames.has(normHoleSize(n))).map(([c]) => c)) : null;
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const gate = depthFormationGate(f);   // depth-window + formation row filter
  // A tool record's MD from whichever depth column it carries (bit: From/ToPoint).
  const rowMd = (r: Row): number | null => { for (const key of ["ToPoint", "FromPoint", "DepthPoint", "Depth"]) { const sv = s(r[key]); if (sv !== "") { const v = Number(sv); if (Number.isFinite(v)) return v; } } return null; };

  // Day context: hole size + primary L04 serial (per well|date), and mud type.
  const byDay = new Map<string, { serial: number | null; hole: string }>();
  const mudByDay = new Map<string, string>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, SerialNo, DrillingDate, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.DrillingDate)}`;
      const snN = Number(r.SerialNo), fin = Number.isFinite(snN), cur = byDay.get(k);
      if (!cur || (fin && (cur.serial == null || snN < cur.serial))) byDay.set(k, { serial: fin ? snN : (cur?.serial ?? null), hole: s(r.HoleSizeCode) });
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`; if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
    }
  }

  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(`SELECT * FROM "${spec.table}" WHERE ${where.join(" AND ")}`).all(...params) as Row[]) {
      const wc = s(r.WellCode), date = s(r.fDate), k = `${wc}|${date}`;
      const d = byDay.get(k);
      const holeCode = d?.hole ?? "";
      if (holeCodes && !holeCodes.has(holeCode)) continue;
      const mudCode = mudByDay.get(k) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;
      const md = rowMd(r);
      if (gate.active && !gate.pass(wc, md)) continue;
      const row: Record<string, unknown> = {
        wellCode: wc, date: orNull(date), serialNo: d?.serial ?? null,
        holeSize: orNull(look(lk.holeSize, holeCode)), topFormation: gate.topFormation(wc, md), mudType: orNull(look(lk.mud, mudCode)),
      };
      for (const fl of spec.fields) row[fl.key] = fl.get(r, lk);
      out.push(row);
    }
  }
  out.sort((a, b) => String(a.wellCode).localeCompare(String(b.wellCode)) || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const cap = 8000;
  return { ...base, rows: out.slice(0, cap), truncated: out.length > cap, total: out.length };
}

export interface RopOptimizationFilters extends FormationMatrixFilters {
  dateFrom?: string; dateTo?: string;
}

/**
 * ROP-optimization scatter from the bit table (L05) for the faceted wells. One
 * point per bit record with a usable operating point: WOB and RPM are the
 * MIDPOINTS of the recorded min–max ranges (MinWeight/MaxWeight, MinRPM/MaxRPM),
 * and ROP is footage ÷ rotating-hours (BitMeterTotal, else ToPoint−FromPoint,
 * over BitHour) — the same per-bit metric the Tools tab shows. Points carry the
 * well, field, date, the day's primary L04 serial (so a point can open that
 * day's report) and the bit size (lk.bitSize ← BitCode, else the day's hole),
 * for client-side WOB×RPM→ROP binning (the contour) and the supporting scatters
 * / per-bit-size comparison. Filtered by field / well / day hole-size / mud-type
 * / Jalali date, mirroring the other DDR tabs.
 *
 * Each point also carries the drilling-engineering metrics behind the MSE,
 * Hydraulics, Economics and Bit-Advisor views: the IADC code + bit class
 * (roller/PDC) + make + diameter (in), Mechanical Specific Energy (Teale, psi —
 * with measured TorqueOnBottom when present, else estimated from WOB, flagged
 * via `mseEstimated`), HSI (`hsiSource` = reported BitHSI / computed from
 * nozzles+flow+mud / null), and the raw TFA / flow / SPP / mud-weight (ppg) /
 * dull grades / drilling-hours used by the economics and advisory analytics.
 */
export function getRopOptimization(f: RopOptimizationFilters): Record<string, unknown> {
  // Resolve wells by field/well/mud only — NOT hole size. The "Bit sizes" facet
  // is applied per bit record below (on each point's own size), so letting the
  // section-based well pre-filter run here would wrongly drop wells whose bit of
  // the chosen size was logged under a differently-coded L04 section.
  const wellSet = resolveWellSet({ ...f, holeSizes: [] });
  if (!wellSet) return { points: [], bitSizes: [], truncated: false, total: 0, note: "Select a field or well to load bit performance." };
  const db = data(), lk = lookups();
  const exists = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND lower(name)='l05'`).get();
  if (!exists) return { points: [], bitSizes: [], truncated: false, total: 0, note: "No bit records in this database." };
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { points: [], bitSizes: [], truncated: false, total: 0 };

  const clean = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean);
  // The "Bit sizes" facet sends normalized hole-size strings (e.g. 12-1/2"). We
  // match them against each point's *own* bitSize (derived below), not the day's
  // L04 section — so the selection and the displayed size always agree (a bit run
  // off-section no longer leaks in under the wrong size). Stored normalized.
  const sizeNames = new Set(clean(f.holeSizes).map((x) => normHoleSize(x)));
  const mudNames = new Set(clean(f.mudTypes));
  const mudCodes = mudNames.size ? new Set([...lk.mud].filter(([, n]) => mudNames.has(n)).map(([c]) => c)) : null;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const gate = depthFormationGate(f);   // depth-window + formation row filter

  // Mud weight → ppg (for HSI). Reports mostly store pcf (≈60–140); a few use
  // ppg (≈8–20) or SG (≈1.0–2.5). Pick the unit from the magnitude.
  const mudWeightPpg = (v: unknown): number | null => {
    const x = Number(s(v));
    if (!Number.isFinite(x) || x <= 0) return null;
    if (x >= 30) return x / 7.4805;   // pcf → ppg
    if (x >= 5) return x;             // already ppg
    if (x >= 0.8) return x * 8.345;   // SG → ppg
    return null;
  };
  // Parse a free-text nozzle string ("3x14", "14-14-14", "16,16,16+12") into a
  // list of 1/32" jet sizes for the TFA calculation.
  const parseNozzleSizes = (raw: unknown): number[] => {
    const str = s(raw).toLowerCase(); if (!str) return [];
    const out: number[] = [];
    for (const tk of str.split(/[,;+\s/]+/).filter(Boolean)) {
      const mx = tk.match(/^(\d+)\s*[x*]\s*(\d+(?:\.\d+)?)$/);   // "3x14" = 3 jets of 14
      if (mx) { const cnt = Number(mx[1]); for (let i = 0; i < cnt && i < 12; i++) out.push(Number(mx[2])); continue; }
      for (const part of tk.split("-").filter(Boolean)) {       // "14-14-14"
        const n = Number(part); if (Number.isFinite(n) && n > 0 && n < 40) out.push(n);
      }
    }
    return out;
  };

  // Field + English name per well (A01), for labelling / field colour-split.
  const nameMap = new Map<string, string>(), fieldMap = new Map<string, string | null>();
  for (const r of db.prepare(`SELECT WellCode, EnglishName, FieldCode FROM A01`).all() as Row[]) {
    const wc = s(r.WellCode); nameMap.set(wc, s(r.EnglishName) || wc); fieldMap.set(wc, look(lk.field, r.FieldCode));
  }

  // Day context: hole size + the day's primary (lowest-serial) L04 report, and
  // the day's mud type — keyed by well|date, exactly as getTools resolves it.
  const byDay = new Map<string, { serial: number | null; hole: string }>();
  const mudByDay = new Map<string, string>();
  const mudWtByDay = new Map<string, number>();   // mud weight (ppg) per well|date
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, SerialNo, DrillingDate, HoleSizeCode FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.DrillingDate)}`;
      const snN = Number(r.SerialNo), fin = Number.isFinite(snN), cur = byDay.get(k);
      if (!cur || (fin && (cur.serial == null || snN < cur.serial))) byDay.set(k, { serial: fin ? snN : (cur?.serial ?? null), hole: s(r.HoleSizeCode) });
    }
    for (const r of db.prepare(`SELECT WellCode, fDate, MudCode, MinWeight FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) {
      const k = `${s(r.WellCode)}|${s(r.fDate)}`;
      if (!mudByDay.has(k)) mudByDay.set(k, s(r.MudCode));
      if (!mudWtByDay.has(k)) { const w = mudWeightPpg(r.MinWeight); if (w != null) mudWtByDay.set(k, w); }
    }
  }

  // Midpoint of a recorded min–max range (one usable end ⇒ that end).
  const mid = (a: unknown, b: unknown): number | null => {
    const x = Number(s(a)), y = Number(s(b));
    const xs = Number.isFinite(x) && x > 0, ys = Number.isFinite(y) && y > 0;
    if (xs && ys) return (x + y) / 2;
    if (xs) return x; if (ys) return y;
    return null;
  };

  const points: Record<string, unknown>[] = [];
  const bitSizeSet = new Set<string>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    const where = [`TRIM(WellCode) IN (${ph})`]; const params: unknown[] = [...chunk];
    if (dateFrom) { where.push(`fDate >= ?`); params.push(dateFrom); }
    if (dateTo) { where.push(`fDate <= ?`); params.push(dateTo); }
    for (const r of db.prepare(`SELECT * FROM L05 WHERE ${where.join(" AND ")}`).all(...params) as Row[]) {
      const wc = s(r.WellCode), date = s(r.fDate), k = `${wc}|${date}`;
      const d = byDay.get(k), holeCode = d?.hole ?? "";
      const mudCode = mudByDay.get(k) ?? "";
      if (mudCodes && !mudCodes.has(mudCode)) continue;

      const wob = mid(r.MinWeight, r.MaxWeight);
      const rpm = mid(r.MinRPM, r.MaxRPM);
      // ROP (m/hr) = footage ÷ rotating hours (BitMeterTotal, else interval).
      const hrs = Number(s(r.BitHour)); let m = Number(s(r.BitMeterTotal));
      const fp = Number(s(r.FromPoint)), tp = Number(s(r.ToPoint));
      const bitMd = Number.isFinite(tp) ? tp : (Number.isFinite(fp) ? fp : null);  // bit-run MD
      if (gate.active && !gate.pass(wc, bitMd)) continue;
      if (!Number.isFinite(m) || m <= 0) { m = (Number.isFinite(fp) && Number.isFinite(tp)) ? tp - fp : NaN; }
      const rop = Number.isFinite(hrs) && hrs > 0 && Number.isFinite(m) && m > 0 ? Number((m / hrs).toFixed(2)) : null;
      // A contour point needs all three axes; drop incomplete / out-of-range rows.
      if (wob == null || rpm == null || rop == null) continue;
      if (wob > 200 || rpm > 600 || rop > 500) continue; // guard against unit-typo outliers

      const rawSize = s(look(lk.bitSize, r.BitCode)) || s(orNull(r.HoleSize)) || look(lk.holeSize, holeCode) || "";
      // Normalize to the canonical 12-1/2" form so the label, the per-size charts
      // and the "Bit sizes" facet all key on the same string (no "12 1/4" vs
      // "12-1/4"" splits). Falls back to the raw text when it isn't a parsable size.
      const bitSize = rawSize ? (normHoleSize(rawSize) || rawSize) : "—";
      // Filter on the point's own size, so a 12-1/2" selection shows only 12-1/2"
      // bits — never 17-1/2" leakage from the day's L04 section.
      if (sizeNames.size && !sizeNames.has(bitSize)) continue;
      bitSizeSet.add(bitSize);

      // ── derived engineering metrics: bit identity, MSE (Teale), HSI ───────
      const iadc = look(lk.bitIADC, r.BitCode);
      const cls: BitClass = bitClass({ iadc, type: look(lk.bitType, r.BitCode) });
      const make = look(lk.bitMake, r.BitCode);
      const diaIn = parseBitSizeInches(bitSize);
      const wobLbf = wob * 1000;               // recorded WOB is in klbf → lbf
      const ropFtHr = rop * 3.280839895;       // m/hr → ft/hr

      // MSE: measured TorqueOnBottom (ft·lbf) when present, else estimated from WOB.
      const tqMeasured = Number(s(r.TorqueOnBottom));
      const hasTq = Number.isFinite(tqMeasured) && tqMeasured > 0;
      let mse: number | null = null, mseEstimated = false;
      let torqueUsed: number | null = hasTq ? tqMeasured : null;
      if (diaIn != null) {
        const torque = hasTq ? tqMeasured : estimateTorque({ mu: MU_DEFAULT[cls], dIn: diaIn, wobLbf });
        torqueUsed = torque;
        mseEstimated = !hasTq;
        const v = mseTeale({ wobLbf, rpm, torqueFtLbf: torque, ropFtHr, dIn: diaIn });
        mse = v != null ? Math.round(v) : null;
      }

      // HSI: reported BitHSI when present, else computed from nozzles + flow + mud.
      const flow = Number(s(r.PumpOutput1));   // gpm
      const spp = Number(s(r.PumpPressure1));  // psi
      const mudWeight = mudWtByDay.get(k) ?? null;
      const reportedHsi = Number(s(r.BitHSI));
      const nozzles = parseNozzleSizes(r.NozzleSize);   // jet sizes in 32nds″, for the HSI tooltip
      let tfa = Number(s(r.TFA));              // in² (reported), else from nozzles
      if (!(Number.isFinite(tfa) && tfa > 0)) { tfa = nozzles.length ? tfaFromNozzles(nozzles) : NaN; }
      let hsiVal: number | null = null, hsiSource: "reported" | "computed" | null = null;
      if (Number.isFinite(reportedHsi) && reportedHsi > 0) { hsiVal = reportedHsi; hsiSource = "reported"; }
      else if (diaIn != null && tfa > 0 && flow > 0 && mudWeight != null) {
        const h = hsiFromHydraulics({ tfaIn2: tfa, qGpm: flow, rhoPpg: mudWeight, dIn: diaIn });
        if (h != null) { hsiVal = h; hsiSource = "computed"; }
      }

      const dull = (v: unknown): number | null => { const x = Number(s(v)); return Number.isFinite(x) && x >= 0 && x <= 8 ? x : null; };
      const dg = bitDull(r, lk);
      const rpCode = s(r.ReasonPulledCode).toUpperCase() || null;

      points.push({
        wob: Number(wob.toFixed(1)), rpm: Number(rpm.toFixed(0)), rop,
        bitSize, topFormation: gate.topFormation(wc, bitMd),
        wellCode: wc, name: nameMap.get(wc) || wc, field: fieldMap.get(wc) ?? null,
        date: orNull(date), serialNo: d?.serial ?? null,
        // Depth + footage for the progress charts (cumulative-depth & ROP-vs-depth).
        from: Number.isFinite(fp) && fp > 0 ? Number(fp.toFixed(1)) : null,
        to: Number.isFinite(tp) && tp > 0 ? Number(tp.toFixed(1)) : null,
        meters: Number.isFinite(m) && m > 0 ? Number(m.toFixed(1)) : null,
        // Engineering metrics (MSE / HSI / economics) + bit identity.
        iadc, bitClass: cls, make, diaIn: diaIn != null ? Number(diaIn.toFixed(3)) : null,
        mse, mseEstimated,
        hsi: hsiVal != null ? Number(hsiVal.toFixed(2)) : null, hsiSource,
        tfa: Number.isFinite(tfa) && tfa > 0 ? Number(tfa.toFixed(3)) : null,
        nozzles: nozzles.length ? nozzles : null,
        flow: flow > 0 ? Number(flow.toFixed(0)) : null,
        spp: spp > 0 ? Number(spp.toFixed(0)) : null,
        mudWeight: mudWeight != null ? Number(mudWeight.toFixed(2)) : null,
        dullInner: dull(r.ICutterWearCode), dullOuter: dull(r.OCutterWearCode),
        // The discrete dull positions, for the wear view's damage-mode Pareto and
        // its formation × bit-family wear heatmap.
        dullChar: dg.dullChar, dullLocation: dg.location,
        dullBearing: dg.bearing, dullGauge: dg.gauge,
        // The torque MSE was computed from, and whether it was measured. The
        // aggressiveness metric mu = 36T/(dW) inverts estimateTorque exactly, so
        // on an ESTIMATED torque it would just hand back MU_DEFAULT — a constant
        // dressed up as a measurement. The flag is what lets the UI exclude them.
        torqueFtLbf: torqueUsed != null ? Number(torqueUsed.toFixed(0)) : null,
        torqueMeasured: hasTq,
        // Full IADC 8-position dull grade (code + decoded title) and reason-pulled (§3.1).
        dullGrade: dg.code, dullTitle: dg.title,
        reasonCode: rpCode,
        reasonLabel: rpCode ? (IADC_REASON[rpCode] ?? look(lk.reasonPulled, r.ReasonPulledCode) ?? rpCode) : null,
        bitHour: Number.isFinite(hrs) && hrs > 0 ? Number(hrs.toFixed(1)) : null,
      });
    }
  }

  points.sort((a, b) => String(a.wellCode).localeCompare(String(b.wellCode)) || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const cap = 20000;
  return {
    points: points.slice(0, cap),
    bitSizes: [...bitSizeSet].sort((a, b) => (holeSizeValue(b) ?? -1) - (holeSizeValue(a) ?? -1) || a.localeCompare(b)),
    truncated: points.length > cap, total: points.length,
  };
}

/**
 * Multi-well lithology + formation GRAPH data: per well, the parsed lithology
 * intervals (component %, pattern, colour) and the formation tops (D07), plus a
 * shared depth range. Capped at a handful of wells (rendered side by side).
 */
export function getLithologyGraph(f: FormationMatrixFilters): Record<string, unknown> {
  const wellSet = resolveWellSet(f);
  if (!wellSet) return { wells: [], depthRange: null, lithoTypes: [], note: "Select a field or well to draw the graph." };
  const db = data(), lk = lookups();
  const allCodes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!allCodes.length) return { wells: [], depthRange: null, lithoTypes: [] };

  // One grouped pass (chunked IN) — DLD/D07 have no WellCode index, so avoid a
  // per-well scan. Group by well, keep depth order.
  const lithoByWell = new Map<string, { from: number; to: number | null; comps: LithoComp[] }[]>();
  const formByWell = new Map<string, { name: string | null; md: number }[]>();
  for (let i = 0; i < allCodes.length; i += 800) {
    const chunk = allCodes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT WellCode, FromPoint, ToPoint, Description FROM DailyLitologyDecription WHERE TRIM(WellCode) IN (${ph}) ORDER BY FromPoint`).all(...chunk) as Row[]) {
      const from = val(r.FromPoint); if (typeof from !== "number" || from < 0 || from > 9000) continue; // skip typo depths
      const comps = parseLitho(s(r.Description)); if (!comps.length) continue;
      const toV = val(r.ToPoint);
      const to = typeof toV === "number" && toV > from && toV < from + 500 ? toV : null; // ignore absurd spans
      const wc = s(r.WellCode); let arr = lithoByWell.get(wc); if (!arr) { arr = []; lithoByWell.set(wc, arr); }
      arr.push({ from, to, comps });
    }
    for (const r of db.prepare(`SELECT WellCode, FormCode, DepthPoint FROM D07 WHERE TRIM(WellCode) IN (${ph}) AND DepthPoint IS NOT NULL ORDER BY DepthPoint`).all(...chunk) as Row[]) {
      const md = val(r.DepthPoint); if (typeof md !== "number" || md < 0 || md > 9000) continue;
      const wc = s(r.WellCode); let arr = formByWell.get(wc); if (!arr) { arr = []; formByWell.set(wc, arr); }
      arr.push({ name: look(lk.formation, r.FormCode), md });
    }
  }

  const nameMap = new Map<string, string>();
  for (const r of db.prepare(`SELECT WellCode, EnglishName FROM A01`).all() as Row[]) nameMap.set(s(r.WellCode), s(r.EnglishName));

  // Pool sidetrack legs into one well (AB-011 + AB-011Leg1 + AB-011ST1 → one
  // column), merging their lithology + formation depth lists — the base's tops
  // and a leg's lithology belong to the same physical well. Keyed by base code.
  const baseOf = (wc: string) => sidetrackBase(wc) || wc;
  const lithoByBase = new Map<string, { from: number; to: number | null; comps: LithoComp[] }[]>();
  const formByBase = new Map<string, { name: string | null; md: number }[]>();
  for (const wc of allCodes) {
    const b = baseOf(wc);
    if (lithoByWell.has(wc)) { const a = lithoByBase.get(b) ?? []; a.push(...lithoByWell.get(wc)!); lithoByBase.set(b, a); }
    if (formByWell.has(wc)) { const a = formByBase.get(b) ?? []; a.push(...formByWell.get(wc)!); formByBase.set(b, a); }
  }
  // Dedup pooled formation tops by name (keep shallowest md) and depth-sort both
  // lists, so overlapping leg/base records don't double-draw.
  const dedupTops = (tops: { name: string | null; md: number }[]) => {
    const best = new Map<string, { name: string | null; md: number }>();
    for (const t of tops) { const k = s(t.name); const cur = best.get(k); if (!cur || t.md < cur.md) best.set(k, t); }
    return [...best.values()].sort((a, b) => a.md - b.md);
  };

  // Only bases that actually have data, capped at 8 (rendered side by side).
  const bases = [...new Set(allCodes.map(baseOf))].filter((b) => lithoByBase.has(b) || formByBase.has(b)).sort((a, b) => a.localeCompare(b)).slice(0, 8);
  const typeSet = new Set<string>();
  let dmin = Infinity, dmax = -Infinity;
  const wells = bases.map((b) => {
    const lithology = (lithoByBase.get(b) ?? []).slice().sort((x, y) => x.from - y.from);
    const formations = dedupTops(formByBase.get(b) ?? []);
    for (const l of lithology) { dmin = Math.min(dmin, l.from); dmax = Math.max(dmax, typeof l.to === "number" ? l.to : l.from); for (const cc of l.comps) typeSet.add(cc.name); }
    for (const fo of formations) dmax = Math.max(dmax, fo.md);
    return { wellCode: b, name: nameMap.get(b) || b, lithology, formations };
  });
  const depthRange = Number.isFinite(dmin) ? { min: Math.floor(dmin / 100) * 100, max: Math.ceil(dmax / 100) * 100 } : null;
  return { wells, depthRange, lithoTypes: [...typeSet].sort() };
}

// ── a.json operations_24hr vocabulary over the archive's operations log ──────
// a.json gives every 24-hour log row a `code_1` (operation code) and a `code_2`
// (P / NP). The archive stores `code_1` — OperationAnalysis.OperationCode, whose
// meaning lives in the Operations lookup — but it stores NO P/NP flag, so
// `code_2` has to be INFERRED. The Operations descriptions are written to a
// house style that separates the two families, and that opening wording is the
// signal — matched exactly as written below, and stated the same way on screen:
//   NP → "Lost time due to …"
//   P  → "Time actually spent …"
//     → "All operation(s) …" / "All the operation(s) …" — every planned-work
//        definition in this family, which is not only "All operations necessary
//        to …" but also RD/RM "All the operations for rig down / moving": rig
//        down and rig move are planned work, not lost time.
//     → "All repair …" — ROE "All repair and routine service …", likewise
//        planned (scheduled service), as opposed to a breakdown, which the
//        lookup words as "Lost time due to …".
// Codes whose wording places them in neither family (ACD "Time for any
// accident.", LDP, NT, SAC) stay UNCLASSIFIED — never guessed into a bucket.
// The coarser ActivityGroups signal ("01 Drilling" / "02 Waiting", from
// TimeAnalysis) is the fallback for wells whose operations log carries no
// usable times; it is per-day, not per-code, so it is the weaker of the two.
export type PnpClass = "P" | "NP";
function classifyOperation(desc: string): PnpClass | null {
  const d = desc.trim().toLowerCase();
  if (d.startsWith("lost time due to")) return "NP";
  if (d.startsWith("time actually spent")) return "P";
  if (/^all (the )?(operations?|repair)\b/.test(d)) return "P";
  return null;
}

/** "HH:MM" → minutes past midnight. Hours may run past 24: the archive logs the
 *  00:00–06:00 morning extension of the next day as 24:00–07:00. */
function hhmmMinutes(x: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s(x));
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 48 || mi > 59) return null;
  return h * 60 + mi;
}
/** Duration of one logged operation row, wrapping midnight. Rows with no time,
 *  an unparsable time or a zero span (the archive writes 00:00→00:00 when the
 *  time was never filled in) contribute nothing rather than a guessed value. */
function loggedHours(from: unknown, to: unknown): number | null {
  const a = hhmmMinutes(from), b = hhmmMinutes(to);
  if (a == null || b == null) return null;
  let d = b - a;
  if (d < 0) d += 24 * 60;
  if (d <= 0 || d > 24 * 60) return null;
  return d / 60;
}

/** Per-well analytics: drilling-progress curve + time distribution. */
export function getAnalytics(wellCode: string): Record<string, unknown> {
  const db = data();
  const lk = lookups();

  // Depth-vs-day progress (one point per daily report, in date order).
  const progress = (db.prepare(`
    SELECT DrillingDate AS date, MorningDepth AS depth, TotalMeter AS meterage, TotalDRHour AS hours
    FROM L04 WHERE WellCode = ? ORDER BY DrillingDate
  `).all(wellCode) as Row[])
    .map((r, i) => ({ day: i + 1, date: orNull(r.date), depth: val(r.depth), meterage: val(r.meterage), hours: val(r.hours) }))
    .filter((r) => typeof r.depth === "number" && (r.depth as number) > 0);

  // Time analysis summed by activity type (and group), across the whole well.
  const timeRows = db.prepare(`
    SELECT ActivityGroupCode AS g, ActivityTypeCode AS t, SUM(CAST(Hours AS REAL)) AS hours
    FROM TimeAnalysis WHERE WellCode = ? GROUP BY ActivityGroupCode, ActivityTypeCode
  `).all(wellCode) as Row[];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const timeByType = timeRows
    .map((r) => ({
      group: look(lk.activityGroup, r.g),
      type: lk.activityType.get(`${s(r.g)}|${s(r.t)}`) ?? s(r.t),
      hours: round1(Number(r.hours) || 0),
    }))
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.hours - a.hours);
  const groups = new Map<string, number>();
  for (const r of timeByType) groups.set(r.group ?? "—", (groups.get(r.group ?? "—") ?? 0) + r.hours);
  const timeByGroup = [...groups]
    .map(([group, hours]) => ({ group, hours: round1(hours) }))
    .sort((a, b) => b.hours - a.hours);

  const totalHours = round1(timeByType.reduce((s2, r) => s2 + r.hours, 0));

  // ── a.json operations_24hr.code_1: hours per OPERATION CODE ────────────────
  // One row of the archive's operations log = one a.json 24-hr log row; its
  // duration is end − start (a.json dur_hr), which the archive keeps as the
  // FTime/TTime pair rather than as a number.
  const opRows = db.prepare(`
    SELECT OperationCode AS code, FTime AS f, TTime AS t
    FROM OperationAnalysis WHERE WellCode = ?
  `).all(wellCode) as Row[];
  const byCode = new Map<string, { hours: number; rows: number }>();
  let untimedRows = 0;
  for (const r of opRows) {
    const code = s(r.code);
    if (!code) continue;
    const h = loggedHours(r.f, r.t);
    if (h == null) { untimedRows++; continue; }
    const cur = byCode.get(code) ?? { hours: 0, rows: 0 };
    cur.hours += h; cur.rows++;
    byCode.set(code, cur);
  }
  const timeByOperation = [...byCode]
    .map(([code, agg]) => {
      const desc = lk.operation.get(code) ?? "";
      return { code, desc: desc || null, hours: round1(agg.hours), rows: agg.rows, pnp: classifyOperation(desc) };
    })
    .filter((r) => r.hours > 0)
    .sort((a2, b2) => b2.hours - a2.hours);

  // ── a.json operations_24hr.code_2: P / NP — DERIVED, never stored ──────────
  const bucket = (c: PnpClass | null) =>
    round1(timeByOperation.filter((r) => r.pnp === c).reduce((s2, r) => s2 + r.hours, 0));
  const opTotalHours = round1(timeByOperation.reduce((s2, r) => s2 + r.hours, 0));
  const groupHours = (name: string) => round1(timeByGroup.find((g) => g.group === name)?.hours ?? 0);
  const pnp = {
    // "operation-code definitions" = the per-code wording of the Operations
    // lookup; "activity groups" = the two-row ActivityGroups fallback, used only
    // when the operations log has no usable durations at all.
    source: timeByOperation.length ? "operation-code definitions" : "activity groups",
    productiveHours: timeByOperation.length ? bucket("P") : groupHours("Drilling"),
    nonProductiveHours: timeByOperation.length ? bucket("NP") : groupHours("Waiting"),
    unclassifiedHours: timeByOperation.length ? bucket(null) : 0,
    totalHours: timeByOperation.length ? opTotalHours : round1(groupHours("Drilling") + groupHours("Waiting")),
    topNonProductive: timeByOperation.filter((r) => r.pnp === "NP").slice(0, 8),
    unclassifiedCodes: timeByOperation.filter((r) => r.pnp === null).slice(0, 8),
    // Cross-check from the other (coarser) signal, always reported so the two
    // can be compared on screen.
    activityGroup: { drillingHours: groupHours("Drilling"), waitingHours: groupHours("Waiting") },
    untimedRows,
  };

  // ── a.json formations: prognosed vs actual top ─────────────────────────────
  // D07 keeps the ACTUAL top only (DepthPoint, mKB). a.json's prog_top_md_mkb
  // has no archive column at all, so it is returned as null and labelled on
  // screen — the comparison is the block's whole point, so it is not dropped.
  const formations = (db.prepare(`
    SELECT FormCode AS code, DepthPoint AS md, SecondDepth AS second
    FROM D07 WHERE WellCode = ? ORDER BY CAST(DepthPoint AS REAL)
  `).all(wellCode) as Row[])
    .map((r) => ({
      name: look(lk.formation, r.code),
      progTopMd: null as number | null, // not recorded in the archive
      finalTopMd: val(r.md) as number | null,
      subseaDepth: orNull(r.second) as string | null,
    }))
    .filter((r) => r.name != null || typeof r.finalTopMd === "number");

  const depths = progress.map((p) => p.depth as number);
  return {
    progress, timeByType, timeByGroup, timeByOperation, pnp, formations,
    summary: {
      reports: progress.length,
      maxDepth: depths.length ? Math.max(...depths) : null,
      totalHours,
      totalDays: totalHours ? round1(totalHours / 24) : null,
    },
  };
}

// ── Remarks & Summary: cross-well operations keyword search ──────────────────
// (port of the Delphi "REMARKS OR SUMMERY" tab — Unit1; saved groups in
//  DB.sqlite FIELDDATA; search over OperationAnalysis narratives.)

function lookupConn(): DatabaseSync | null {
  if (_lookupConn) return _lookupConn;
  if (!existsSync(LOOKUP_DB)) return null;
  _lookupConn = new DatabaseSync(LOOKUP_DB, { readOnly: true });
  return _lookupConn;
}

/** Saved keyword search groups (DB.sqlite FIELDDATA), keyword strings tokenised. */
export function listSearchGroups(): Row[] {
  const db = lookupConn();
  if (!db) return [];
  const tok = (x: unknown) =>
    s(x).split(/[\s,;]+/).map((t) => t.trim()).filter((t) => t && t.toLowerCase() !== "none");
  return (db
    .prepare(`SELECT "GROUP" AS category, "DESC" AS name, "AND" AS a, "OR" AS o, "NOT" AS n FROM FIELDDATA`)
    .all() as Row[])
    .map((r) => ({ category: s(r.category) || "OTHER", name: s(r.name), and: tok(r.a), or: tok(r.o), not: tok(r.n) }))
    .filter((r) => r.name && (r.and.length || r.or.length || r.not.length));
}

// ── Saved-group create / modify / delete — written to DB.sqlite FIELDDATA, just
// like the Delphi saved-search manager (Form2/Unit2.pas). DESC is the key. The
// keyword lists are stored space-joined (the legacy token format). A short-lived
// writable connection is used so we never hold a write lock open.
export interface SavedGroupInput { category?: string; name: string; and?: string[]; or?: string[]; not?: string[] }
const joinKw = (a?: string[]) => (a ?? []).map((x) => s(x)).filter(Boolean).join(" ");
function lookupWritable(): DatabaseSync {
  if (!existsSync(LOOKUP_DB)) throw new Error("DDR lookup database (DB.sqlite) not found");
  return new DatabaseSync(LOOKUP_DB); // writable (default)
}

export function createSearchGroup(g: SavedGroupInput): { ok: true } {
  const name = s(g.name);
  if (!name) throw new Error("A name is required.");
  const db = lookupWritable();
  try {
    if (db.prepare(`SELECT 1 FROM FIELDDATA WHERE "DESC" = ?`).get(name))
      throw new Error(`A saved search named "${name}" already exists.`);
    db.prepare(`INSERT INTO FIELDDATA ("DESC","GROUP","AND","OR","NOT") VALUES (?,?,?,?,?)`)
      .run(name, s(g.category) || "MY SEARCHES", joinKw(g.and), joinKw(g.or), joinKw(g.not));
    return { ok: true };
  } finally { db.close(); }
}

export function updateSearchGroup(originalName: string, g: SavedGroupInput): { ok: true } {
  const orig = s(originalName), name = s(g.name);
  if (!orig || !name) throw new Error("A name is required.");
  const db = lookupWritable();
  try {
    if (name !== orig && db.prepare(`SELECT 1 FROM FIELDDATA WHERE "DESC" = ?`).get(name))
      throw new Error(`A saved search named "${name}" already exists.`);
    const r = db.prepare(`UPDATE FIELDDATA SET "DESC"=?, "GROUP"=?, "AND"=?, "OR"=?, "NOT"=? WHERE "DESC"=?`)
      .run(name, s(g.category) || "MY SEARCHES", joinKw(g.and), joinKw(g.or), joinKw(g.not), orig);
    if (r.changes === 0) throw new Error(`Saved search "${orig}" was not found.`);
    return { ok: true };
  } finally { db.close(); }
}

export function deleteSearchGroup(name: string): { ok: true } {
  const n = s(name);
  if (!n) throw new Error("A name is required.");
  const db = lookupWritable();
  try {
    db.prepare(`DELETE FROM FIELDDATA WHERE "DESC"=?`).run(n);
    return { ok: true };
  } finally { db.close(); }
}

/** Rename a category header — moves every saved search under it (GROUP column). */
export function renameCategory(oldName: string, newName: string): { ok: true; moved: number } {
  const o = s(oldName), n = s(newName);
  if (!o || !n) throw new Error("Both the old and new category names are required.");
  const db = lookupWritable();
  try {
    const r = db.prepare(`UPDATE FIELDDATA SET "GROUP"=? WHERE "GROUP"=?`).run(n, o);
    return { ok: true, moved: Number(r.changes) };
  } finally { db.close(); }
}

/** Delete a whole category header and every saved search under it. */
export function deleteCategory(name: string): { ok: true; removed: number } {
  const n = s(name);
  if (!n) throw new Error("A category name is required.");
  const db = lookupWritable();
  try {
    const r = db.prepare(`DELETE FROM FIELDDATA WHERE "GROUP"=?`).run(n);
    return { ok: true, removed: Number(r.changes) };
  } finally { db.close(); }
}

// Per-day bit/mud context + per-well rig, built once (no DB indexes, so we map
// in memory rather than correlate-subquery per result row).
let _ctx: { hole: Map<string, Row>; mud: Map<string, Row>; rig: Map<string, string>; field: Map<string, string> } | null = null;
function ctx() {
  if (_ctx) return _ctx;
  const db = data();
  const hole = new Map<string, Row>();
  for (const r of db.prepare(`SELECT SerialNo, WellCode, DrillingDate AS fDate, HoleSizeCode, FromPoint, ToPoint FROM L04`).all() as Row[]) {
    const k = `${s(r.WellCode)}|${s(r.fDate)}`;
    if (!hole.has(k)) hole.set(k, r);
  }
  const mud = new Map<string, Row>();
  for (const r of db.prepare(`SELECT WellCode, fDate, MudCode, MinWeight, MaxWeight FROM N01`).all() as Row[]) {
    const k = `${s(r.WellCode)}|${s(r.fDate)}`;
    if (!mud.has(k)) mud.set(k, r);
  }
  const rig = new Map<string, string>();
  const field = new Map<string, string>();
  for (const r of db.prepare(`SELECT WellCode, RIG, FieldCode FROM A01`).all() as Row[]) {
    rig.set(s(r.WellCode), s(r.RIG));
    field.set(s(r.WellCode), s(r.FieldCode));
  }
  _ctx = { hole, mud, rig, field };
  return _ctx;
}

/**
 * Sidetrack family map: a well and its legs / sidetracks are the SAME physical
 * well, so their daily-report data lives under different codes (e.g. base
 * "AB-011" carries the formation tops while "AB-011Leg1" carries the survey, and
 * "AB-011ST1" a couple more runs). We pool them by stripping a trailing run of
 * `Leg<N>` / `ST<N>` segments to a base code, then grouping every A01 code by
 * that base. Only Leg/ST count — CTU / WO / other suffixes stay distinct.
 *
 * Returns code → the full set of codes sharing its base (always includes itself).
 */
let _wellFam: Map<string, Set<string>> | null = null;
const sidetrackBase = (code: string): string => s(code).replace(/(?:(?:leg|st)\d+)+$/i, "");
function wellFamilies(): Map<string, Set<string>> {
  if (_wellFam) return _wellFam;
  const byBase = new Map<string, Set<string>>();
  for (const r of data().prepare(`SELECT WellCode FROM A01`).all() as Row[]) {
    const wc = s(r.WellCode); if (!wc) continue;
    const base = sidetrackBase(wc) || wc;
    let set = byBase.get(base); if (!set) { set = new Set(); byBase.set(base, set); }
    set.add(wc);
  }
  const m = new Map<string, Set<string>>();
  for (const set of byBase.values()) for (const wc of set) m.set(wc, set);
  _wellFam = m;
  return m;
}
/** Expand each requested code into its full sidetrack family (base + Leg/ST). */
function expandSidetracks(codes: Iterable<string>): Set<string> {
  const fam = wellFamilies(), out = new Set<string>();
  for (const c of codes) { const wc = s(c); out.add(wc); const sibs = fam.get(wc); if (sibs) for (const x of sibs) out.add(x); }
  return out;
}

// Hole/bit-size normalisation — collapse the many spellings of one size
// ("12 1/4”", `12-1/4"`, "8.5" → `8-1/2"`) to a single canonical label, deduped
// by numeric value (1/32" resolution).
function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }
function holeSizeValue(raw: unknown): number | null {
  const t = s(raw).replace(/[^0-9./ -]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  let m = t.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/);  // 12 1/4 | 12-1/4
  if (m) return +m[1] + +m[2] / +m[3];
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);                  // 1/4
  if (m) return +m[1] / +m[2];
  m = t.match(/^(\d+(?:\.\d+)?)$/);                     // 26 | 8.5
  if (m) return +m[1];
  return null;
}
function normHoleSize(raw: unknown): string {
  const v = holeSizeValue(raw);
  if (v == null) return s(raw);
  const whole = Math.floor(v + 1e-9);
  let num = Math.round((v - whole) * 32);
  if (num >= 32) return `${whole + 1}"`;
  if (num === 0) return `${whole}"`;
  let den = 32;
  const g = gcd(num, den); num /= g; den /= g;
  return `${whole}-${num}/${den}"`;
}

export interface OpsSearchFilters {
  and?: string[]; or?: string[]; not?: string[];
  wells?: string[]; opCodes?: string[]; dateFrom?: string; dateTo?: string; limit?: number;
  /** Display-value filters applied post-enrichment (no OA columns of their own). */
  fields?: string[]; rigs?: string[]; holeSizes?: string[]; mudTypes?: string[];
  /** Only operations that have a recorded from-time ("TIME INCLUDED"). */
  onlyTimed?: boolean;
  /**
   * "remarks" (default) = one row per operation (OperationAnalysis, with op
   * code + from/to time). "summary" = one row per day = the L04 daily-report
   * operations narrative (the Delphi REMARKS / SUMMERY radio).
   */
  mode?: "remarks" | "summary";
}

/**
 * AND/OR/NOT keyword search, enriched with day context. Two modes:
 *   "remarks" (default) → one row per operation (OperationAnalysis): op code +
 *      from/to time + the per-operation remark.
 *   "summary"           → one row per daily report (L04): the day's operations
 *      narrative (L04.Description). Mirrors the Delphi REMARKS / SUMMERY radio —
 *      a day with no logged operations still has a daily summary, so the two
 *      modes return genuinely different row sets.
 * Shared filters (keywords, wells, fields, rigs, hole size, mud, dates) apply to
 * both; per-operation filters (op codes, time-included) apply to remarks only.
 */
export function searchOperations(f: OpsSearchFilters): Record<string, unknown> {
  const db = data();
  const lk = lookups();
  const c = ctx();
  const clean = (arr?: string[]) => (arr ?? []).map((x) => s(x)).filter(Boolean);
  const and = clean(f.and), or = clean(f.or), not = clean(f.not);
  const wells = clean(f.wells), opCodes = clean(f.opCodes);
  const fields = clean(f.fields), rigs = clean(f.rigs), holeSizes = clean(f.holeSizes), mudTypes = clean(f.mudTypes);
  const onlyTimed = !!f.onlyTimed;
  const dateFrom = s(f.dateFrom), dateTo = s(f.dateTo);
  const summary = f.mode === "summary";
  const limit = Math.min(5000, Math.max(1, Math.round(f.limit ?? 2000)));

  // "Nothing selected" means ALL (SELECT *): an unconstrained search returns
  // every row, ordered and capped at `limit`. Empty facets simply don't
  // constrain — matching the Delphi form, where a blank selection on a facet
  // means "any". The LIMIT keeps even the full-table case bounded.

  // field / rig are per-well → resolve to a well set (intersected with explicit
  // wells). hole-size / mud → code lists. Shared by both modes; applied BEFORE
  // the limit so results aren't lost to a candidate window.
  let wellSet: Set<string> | null = wells.length ? new Set(wells) : null;
  const intersect = (matched: Set<string>) => { wellSet = wellSet ? new Set([...wellSet].filter((w) => matched.has(w))) : matched; };
  if (fields.length) {
    const fset = new Set(fields), m = new Set<string>();
    for (const [wc, fc] of c.field) { const fn = look(lk.field, fc); if (fn && fset.has(fn)) m.add(wc); }
    intersect(m);
  }
  if (rigs.length) {
    const rset = new Set(rigs), m = new Set<string>();
    for (const [wc, rg] of c.rig) if (rg && rset.has(rg)) m.add(wc);
    intersect(m);
  }
  const holeCodes: string[] = [];
  if (holeSizes.length) { const hs = new Set(holeSizes); for (const [code, name] of lk.holeSize) if (hs.has(normHoleSize(name))) holeCodes.push(code); }
  const mudCodes: string[] = [];
  if (mudTypes.length) { const mt = new Set(mudTypes); for (const [code, name] of lk.mud) if (mt.has(name)) mudCodes.push(code); }

  // A filter that resolves to nothing ⇒ no results.
  if ((wellSet && wellSet.size === 0) || (holeSizes.length && !holeCodes.length) || (mudTypes.length && !mudCodes.length)) {
    return { count: 0, limit, truncated: false, rows: [] };
  }

  // ── SUMMARY: one row per daily report (L04), keyword on the daily narrative ──
  if (summary) {
    // Drop blank / all-dash placeholder wellcodes (no real report); keep every
    // real code incl. workover/case variants not in A01.
    const w = ["l.WellCode GLOB '*[A-Za-z0-9]*'", "l.Description IS NOT NULL", "l.Description <> ''"];
    const p: unknown[] = [];
    for (const kw of and) { w.push("l.Description LIKE ?"); p.push(`%${kw}%`); }
    for (const kw of not) { w.push("l.Description NOT LIKE ?"); p.push(`%${kw}%`); }
    if (or.length) { w.push("(" + or.map(() => "l.Description LIKE ?").join(" OR ") + ")"); for (const kw of or) p.push(`%${kw}%`); }
    if (wellSet) { w.push(`l.WellCode IN (${[...wellSet].map(() => "?").join(",")})`); p.push(...wellSet); }
    if (holeCodes.length) { w.push(`TRIM(l.HoleSizeCode) IN (${holeCodes.map(() => "?").join(",")})`); p.push(...holeCodes); }
    if (mudCodes.length) {
      w.push(`(TRIM(l.WellCode), TRIM(l.DrillingDate)) IN (SELECT TRIM(WellCode), TRIM(fDate) FROM N01 WHERE TRIM(MudCode) IN (${mudCodes.map(() => "?").join(",")}))`);
      p.push(...mudCodes);
    }
    if (dateFrom) { w.push("l.DrillingDate >= ?"); p.push(dateFrom); }
    if (dateTo) { w.push("l.DrillingDate <= ?"); p.push(dateTo); }
    const raw = db.prepare(`
      SELECT l.SerialNo AS serialNo, l.WellCode AS wellCode, l.DrillingDate AS date, l.HoleSizeCode AS holeSizeCode,
             l.FromPoint AS fromPoint, l.ToPoint AS toPoint, l.Description AS description
      FROM L04 l
      WHERE ${w.join(" AND ")}
      ORDER BY l.WellCode, l.DrillingDate
      LIMIT ${limit + 1}
    `).all(...p) as Row[];
    const truncated = raw.length > limit;
    const rows = raw.slice(0, limit).map((r) => {
      const wc = s(r.wellCode);
      const mud = c.mud.get(`${wc}|${s(r.date)}`) ?? {};
      return {
        wellCode: wc, serialNo: r.serialNo == null ? null : Number(r.serialNo),
        date: orNull(r.date), opCode: null, fromTime: null, toTime: null,
        description: orNull(r.description),
        field: orNull(look(lk.field, c.field.get(wc))), rig: orNull(c.rig.get(wc)),
        holeSize: normHoleSize(look(lk.holeSize, r.holeSizeCode) ?? "") || null,
        fromPoint: val(r.fromPoint), toPoint: val(r.toPoint),
        mud: look(lk.mud, mud.MudCode), minWeight: val(mud.MinWeight), maxWeight: val(mud.MaxWeight),
      };
    });
    return { count: rows.length, limit, truncated, rows, mode: "summary" };
  }

  // ── REMARKS: one row per operation (OperationAnalysis) ──
  // (GLOB drops blank / all-dash placeholder wellcodes; keeps real codes.)
  const where = ["oa.WellCode GLOB '*[A-Za-z0-9]*'", "oa.Description IS NOT NULL", "oa.Description <> ''"];
  const params: unknown[] = [];
  for (const kw of and) { where.push("oa.Description LIKE ?"); params.push(`%${kw}%`); }
  for (const kw of not) { where.push("oa.Description NOT LIKE ?"); params.push(`%${kw}%`); }
  if (or.length) { where.push("(" + or.map(() => "oa.Description LIKE ?").join(" OR ") + ")"); for (const kw of or) params.push(`%${kw}%`); }
  // OperationCode is space-padded in the source → TRIM before matching the (trimmed) codes.
  if (opCodes.length) { where.push(`TRIM(oa.OperationCode) IN (${opCodes.map(() => "?").join(",")})`); params.push(...opCodes); }
  // "Time included" — keep only operations that have a from- OR to-time recorded
  // (FTime/TTime are space-padded in the source, so TRIM before testing; remarks
  // only — the summary branch never applies it).
  if (onlyTimed) where.push("(TRIM(oa.FTime) <> '' OR TRIM(oa.TTime) <> '')");
  if (dateFrom) { where.push("oa.fDate >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("oa.fDate <= ?"); params.push(dateTo); }
  if (wellSet) { where.push(`oa.WellCode IN (${[...wellSet].map(() => "?").join(",")})`); params.push(...wellSet); }
  if (holeCodes.length) {
    where.push(`(TRIM(oa.WellCode), TRIM(oa.fDate)) IN (SELECT TRIM(WellCode), TRIM(DrillingDate) FROM L04 WHERE TRIM(HoleSizeCode) IN (${holeCodes.map(() => "?").join(",")}))`);
    params.push(...holeCodes);
  }
  if (mudCodes.length) {
    where.push(`(TRIM(oa.WellCode), TRIM(oa.fDate)) IN (SELECT TRIM(WellCode), TRIM(fDate) FROM N01 WHERE TRIM(MudCode) IN (${mudCodes.map(() => "?").join(",")}))`);
    params.push(...mudCodes);
  }

  const raw = db.prepare(`
    SELECT oa.WellCode AS wellCode, oa.fDate AS date, oa.OperationCode AS opCode,
           oa.FTime AS fromTime, oa.TTime AS toTime, oa.Description AS description
    FROM OperationAnalysis oa
    WHERE ${where.join(" AND ")}
    ORDER BY oa.WellCode, oa.fDate
    LIMIT ${limit + 1}
  `).all(...params) as Row[];
  const truncated = raw.length > limit;
  const rows = raw.slice(0, limit).map((r) => {
    const wc = s(r.wellCode);
    const k = `${wc}|${s(r.date)}`;
    const hole = c.hole.get(k) ?? {};
    const mud = c.mud.get(k) ?? {};
    return {
      wellCode: wc, serialNo: hole.SerialNo == null ? null : Number(hole.SerialNo),
      date: orNull(r.date), opCode: s(r.opCode) || null,
      fromTime: val(r.fromTime), toTime: val(r.toTime), description: orNull(r.description),
      field: orNull(look(lk.field, c.field.get(wc))), rig: orNull(c.rig.get(wc)),
      holeSize: normHoleSize(look(lk.holeSize, hole.HoleSizeCode) ?? "") || null, fromPoint: val(hole.FromPoint), toPoint: val(hole.ToPoint),
      mud: look(lk.mud, mud.MudCode), minWeight: val(mud.MinWeight), maxWeight: val(mud.MaxWeight),
    };
  });
  return { count: rows.length, limit, truncated, rows, mode: "remarks" };
}

/** Distinct filter option lists for the Remarks & Summary search (cached). */
let _opts: Record<string, unknown> | null = null;
export function searchOptions(): Record<string, unknown> {
  if (_opts) return _opts;
  const db = data();
  const lk = lookups();
  const uniq = (sql: string, col: string) =>
    [...new Set((db.prepare(sql).all() as Row[]).map((r) => s(r[col])).filter((v) => v && v.toLowerCase() !== "none"))].sort();
  const fieldCodes = (db.prepare(`SELECT DISTINCT FieldCode FROM A01 WHERE FieldCode IS NOT NULL`).all() as Row[])
    .map((r) => s(r.FieldCode)).filter(Boolean);
  const fields = [...new Set(fieldCodes.map((code) => look(lk.field, code)).filter((v): v is string => !!v))].sort();
  const wells = (db.prepare(`
    SELECT a.WellCode AS code, a.EnglishName AS name, a.FieldCode AS fieldCode FROM A01 a
    WHERE a.WellCode IN (SELECT DISTINCT WellCode FROM OperationAnalysis) ORDER BY a.EnglishName, a.WellCode
  `).all() as Row[])
    .map((r) => ({ code: s(r.code), name: s(r.name) || s(r.code), field: look(lk.field, r.fieldCode) }))
    .filter((w) => w.code);
  const holeSizes = [...new Set((db.prepare(`SELECT DISTINCT HoleSizeCode FROM L04 WHERE HoleSizeCode IS NOT NULL`).all() as Row[])
    .map((r) => look(lk.holeSize, r.HoleSizeCode)).filter((v): v is string => !!v).map((n) => normHoleSize(n)))]
    .sort((a, b) => (holeSizeValue(b) ?? 0) - (holeSizeValue(a) ?? 0));
  const rigs = uniq(`SELECT DISTINCT RIG FROM A01`, "RIG");
  const mudTypes = [...new Set([...lk.mud.values()].filter(Boolean))].sort();
  // Chemical materials for the Mud Stock facet (Materials.Material names).
  const materials = [...new Set([...lk.material.values()].filter(Boolean))].sort();
  // Activity types for the Time Analysis facet (ActivityTypes.ActivityType names).
  const activityTypes = [...new Set([...lk.activityType.values()].filter(Boolean))].sort();
  // Formations actually recorded as a D07 top (the shared formation facet).
  const formations = [...new Set((db.prepare(`SELECT DISTINCT FormCode FROM D07 WHERE DepthPoint IS NOT NULL`).all() as Row[])
    .map((r) => look(lk.formation, r.FormCode)).filter((v): v is string => !!v))].sort();
  const operations = [...lk.operation.entries()].map(([code, desc]) => ({ code, desc }))
    .sort((a, b) => a.desc.localeCompare(b.desc));
  _opts = { fields, wells, holeSizes, mudTypes, rigs, materials, activityTypes, formations, operations };
  return _opts;
}

/**
 * Facet value lists SCOPED to the selected wells/fields — the bit sizes, mud
 * types, materials and activity types that actually occur in those wells. The
 * sidebar facets call this whenever the field/well selection changes so each
 * dropdown only offers values present in the chosen wells (the Wells facet
 * already narrows by Fields the same way). With no field/well selected this
 * returns null lists; the UI then falls back to the global searchOptions lists.
 * Scoped by fields + wells only (NOT by the value facets themselves) — one
 * well-set drives all four lists.
 */
export function getFacetOptions(f: { fields?: string[]; wells?: string[] }): Record<string, unknown> {
  const wellSet = resolveWellSet({ fields: f.fields, wells: f.wells });
  if (!wellSet) return { holeSizes: null, mudTypes: null, materials: null, activityTypes: null, formations: null };
  const db = data(), lk = lookups();
  const codes = [...wellSet].filter((w) => /[A-Za-z0-9]/.test(w));
  if (!codes.length) return { holeSizes: [], mudTypes: [], materials: [], activityTypes: [], formations: [] };

  const holeCodes = new Set<string>(), mudCodes = new Set<string>(), matCodes = new Set<string>(), actKeys = new Set<string>(), formCodes = new Set<string>();
  for (let i = 0; i < codes.length; i += 800) {
    const chunk = codes.slice(i, i + 800), ph = chunk.map(() => "?").join(",");
    for (const r of db.prepare(`SELECT DISTINCT HoleSizeCode c FROM L04 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) { const c = s(r.c); if (c) holeCodes.add(c); }
    for (const r of db.prepare(`SELECT DISTINCT MudCode c FROM N01 WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) { const c = s(r.c); if (c) mudCodes.add(c); }
    for (const r of db.prepare(`SELECT DISTINCT MaterialCode c FROM ChemicalMaterials WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) { const c = s(r.c); if (c) matCodes.add(c); }
    for (const r of db.prepare(`SELECT DISTINCT ActivityGroupCode g, ActivityTypeCode t FROM TimeAnalysis WHERE TRIM(WellCode) IN (${ph})`).all(...chunk) as Row[]) { const k = `${s(r.g)}|${s(r.t)}`; if (k !== "|") actKeys.add(k); }
    for (const r of db.prepare(`SELECT DISTINCT FormCode c FROM D07 WHERE TRIM(WellCode) IN (${ph}) AND DepthPoint IS NOT NULL`).all(...chunk) as Row[]) { const c = s(r.c); if (c) formCodes.add(c); }
  }

  // Codes → display names, deduped + sorted exactly as searchOptions does, so the
  // scoped list is a strict subset of (and matches) the global facet values.
  const holeSizes = [...new Set([...holeCodes].map((c) => look(lk.holeSize, c)).filter((v): v is string => !!v).map((n) => normHoleSize(n)))]
    .sort((a, b) => (holeSizeValue(b) ?? 0) - (holeSizeValue(a) ?? 0));
  const mudTypes = [...new Set([...mudCodes].map((c) => look(lk.mud, c)).filter((v): v is string => !!v))].sort();
  const materials = [...new Set([...matCodes].map((c) => look(lk.material, c)).filter((v): v is string => !!v))].sort();
  const activityTypes = [...new Set([...actKeys].map((k) => lk.activityType.get(k)).filter((v): v is string => !!v))].sort();
  const formations = [...new Set([...formCodes].map((c) => look(lk.formation, c)).filter((v): v is string => !!v))].sort();
  return { holeSizes, mudTypes, materials, activityTypes, formations };
}

// ── Well-registration option lists (for the report-entry admin form) ─────────
/**
 * The values an admin can pick from when registering a well the rig is drilling
 * now: the company's own lookup tables (Fields / WellType / WellProfiles /
 * Contractor) plus the free-text Location and Reservoir columns as actually used
 * across A01. Returns empty lists when the legacy DB isn't on this machine — the
 * form then just takes typed values.
 */
export function wellRegistryOptions(): {
  fields: string[]; locations: string[]; wellTypes: string[];
  profiles: string[]; reservoirs: string[]; contractors: string[];
} {
  const empty = { fields: [], locations: [], wellTypes: [], profiles: [], reservoirs: [], contractors: [] };
  if (!ddrAvailable()) return empty;
  const lk = lookups();
  // The free-text columns are full of placeholder junk from the Access days
  // ("-", ".", "0", "None"). A real name has a letter in it and isn't a single
  // character — that alone clears the noise without dropping short names.
  const usable = (v: string) => v.length > 1 && /\p{L}/u.test(v) && v.toLowerCase() !== "none";
  const names = (m: Map<string, string>) =>
    [...new Set([...m.values()].map((v) => s(v)).filter(usable))].sort();
  /** DISTINCT of a free-text A01 column (Location / Reservoir have no lookup). */
  const distinctA01 = (col: string) =>
    [...new Set((data().prepare(`SELECT DISTINCT "${col}" v FROM A01`).all() as Row[])
      .map((r) => s(r.v)).filter(usable))].sort();
  return {
    fields: names(lk.field),
    locations: distinctA01("Location"),
    wellTypes: names(lk.wellType),
    profiles: names(lk.wellProfile),
    // Reservoir is free text in A01; Zone names are the curated equivalent, so
    // offer both (deduped) rather than making the admin retype a known zone.
    reservoirs: [...new Set([...distinctA01("Reservoir"), ...names(lk.zone)])].sort(),
    contractors: names(lk.contractor),
  };
}
