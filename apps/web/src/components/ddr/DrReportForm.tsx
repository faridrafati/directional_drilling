/**
 * Daily Drilling Report — the ARCHIVE report rendered in the PEDC/POGC DDR form.
 *
 * The layout is a.json (`/a.json`, the DDR JSON Schema): its 21 top-level blocks
 * in the schema's property order, which is the printed order of the real sheet.
 * Every section is rendered on every report — a.json is explicit that empty
 * tables still print their headers — so the office viewer and the rig-side entry
 * module (/ddr-entry) walk the same sheet in the same order:
 *
 *   01 report_header · 02 operations · 03 supervisors_contact ·
 *   04 onboard_companies · 05 hse_drill_schedule · 06 bulk_material ·
 *   07 formations · 08 directional_survey · 09 operations_24hr ·
 *   10 morning_report_6hr · 11 drill_strings · 12 drilling_parameters ·
 *   13 mud_information · 14 mud_additive_balance · 15 casing_string ·
 *   16 wellhead_component · 17 well_control_scr · 18 formation_integrity_test ·
 *   19 marine_conditions · 20 support_vessels · 21 general_notes
 *
 * The data is the legacy Access→SQLite archive (A01 well master + L04 header +
 * the curated section rows) resolved by the /ddr/* endpoints. That archive was
 * built from the OLD DR.xls sheet, so ten of the blocks have no source column at
 * all: they render with their a.json header and the marker "not recorded in the
 * archive" — the field was never captured by this form, which is a different
 * statement from a field the crew left blank (that stays a plain "—").
 *
 * Nothing is invented to fill a gap. The only computed values are the ones the
 * sheet itself defines as derived: avg ROP = progress ÷ drilling hours, bit ROP =
 * meterage ÷ hours, and an operation's duration = its own end time − start time.
 *
 * Values the archive holds but the PEDC form does not name (the time breakdown,
 * the solid-control units, a handful of DR.xls-only header and bit fields) are
 * kept, grouped under an explicit "archive only" sub-heading, so rebuilding the
 * sheet on a.json never silently drops a number the office used to read.
 */
// mudWeightRangePpg is shared with the Tables view and the exports on purpose:
// two independent conversions were printing two different densities for one field.
import { mudWeightRangePpg } from "../../export/ddr.js";
import type { DdrWellInfo, DdrReportDetail, SolidControl, EquipmentItem } from "../../export/ddr.js";

type Row = Record<string, unknown>;

const v = (x: unknown): string => {
  if (x == null || x === "") return "—";
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(2);
  return String(x);
};
/** "a / b" for a two-part cell, null (never "— / —") when neither side is set. */
const pair = (a: unknown, b: unknown, sep = " / "): string | null =>
  (a == null || a === "") && (b == null || b === "") ? null : `${v(a)}${sep}${v(b)}`;
const num = (x: unknown): number | null => {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
/** "HH:MM" (the archive pads them) → hours as a decimal. */
const hhmm = (x: unknown): number | null => {
  const m = String(x ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  // Hours may run past 24: the archive logs the next day's 00:00-06:00 morning
  // extension as 24:00-07:00. The Tables view and the API both accept <= 48, so
  // capping at 24 here silently dropped those rows from the Form's duration
  // column and its "X hr of 24" tally while the other views counted them.
  return h <= 48 && mi < 60 ? h + mi / 60 : null;
};
/** An operation's own duration, wrapping past midnight (23:00 → 01:00 = 2 hr). */
const durHr = (from: unknown, to: unknown): number | null => {
  const a = hhmm(from), b = hhmm(to);
  if (a == null || b == null) return null;
  // A zero span is NOT a zero-hour operation: ~4,890 archive rows carry
  // FTime == TTime because the crew never filled the clock in. Printing "0.00"
  // there invents a duration, and folding it into the "X hr of 24" tally makes
  // the day look accounted for when it isn't.
  if (b === a) return null;
  return Number((b > a ? b - a : b + 24 - a).toFixed(2));
};

/** a.json `supervisors_contact` is derived from the six L04 name columns — the
 *  archive stores them as fixed header fields, the new form as contact rows. */
const SUPERVISOR_ROLES: [string, string][] = [
  ["WellSiteSupt", "Well Site Superintendent"],
  ["OPNSupt", "Operations Superintendent"],
  ["ProgEng", "Programme Engineer"],
  ["Geologist", "Geologist"],
  ["Cont_T_Push1", "Contractor Tool Pusher"],
  ["Cont_T_Push2", "Contractor Tool Pusher"],
];

export function DrReportForm({ well, detail }: { well: DdrWellInfo | null; detail: DdrReportDetail }) {
  const h = detail.header;
  const m = detail.mud[0] ?? {};
  const w = (k: string): unknown => (well ? well[k] : null);

  // ── derived header numbers ────────────────────────────────────────────────
  // AVG ROP = the day's progress ÷ the day's drilling hours, exactly as the
  // entry sheet derives it; null (not 0) when either side is missing.
  const progress = num(h.Meterage), drillHours = num(h.DrillingTime);
  const avgRop = progress != null && drillHours != null && drillHours > 0
    ? Number((progress / drillHours).toFixed(2)) : null;

  // Day totals across the bit run(s) — a bit-change day has two L05 rows.
  const sumBit = (key: string): number | null => {
    let any = false, total = 0;
    for (const x of detail.bit) {
      const n = num(x[key]);
      if (n != null) { any = true; total += n; }
    }
    return any ? Number(total.toFixed(2)) : null;
  };
  const bitHours = sumBit("Bit hrs"), bitMeterage = sumBit("Bit meterage");
  const bitRop = bitHours != null && bitMeterage != null && bitHours > 0
    ? Number((bitMeterage / bitHours).toFixed(2)) : null;

  const supervisors: Row[] = SUPERVISOR_ROLES
    .filter(([k]) => h[k] != null && h[k] !== "")
    .map(([k, position]) => ({ "Job contact": h[k], "Position": position }));

  // Columns the archive has NO source for are declared `nr` on the column spec
  // (below), so their cells print the not-recorded marker; the row objects carry
  // only the fields the archive actually holds.
  const formations: Row[] = detail.formationTops.map((x) => ({
    "Formation name": x["Formation"], "Final top MD (mKB)": x["Depth (m)"],
    "Second depth (m)": x["Second depth"], "Top type": x["Type"],
  }));

  const surveys: Row[] = detail.directional.map((x) => ({
    "MD (mKB)": x["MD (m)"], "Incl (°)": x["Inc (°)"], "Azm (°)": x["Azi (°)"], "TVD (mKB)": x["TVD (m)"],
    "NS (m)": x["N/S"], "EW (m)": x["E/W"], "VS (m)": x["VS"], "DLS (°/30m)": x["DLS"],
    "Section HD (m)": x["Section"], "Dir": x["Dir"], "Remarks": x["Remarks"],
  }));

  const ops: Row[] = detail.operations.map((x) => ({
    "Start time": x["From"], "Dur (hr)": durHr(x["From"], x["To"]), "End time": x["To"],
    "Code 1": x["Op"], "Com": x["Remarks"], "Operation": x["Operation"],
  }));
  const opsHours = ops.reduce((a: number, r) => a + (num(r["Dur (hr)"]) ?? 0), 0);

  // One drill-string block per assembly, paired POSITIONALLY with the day's bit
  // runs: both are the same day's rows in the same order, and the archive holds
  // no key that ties a bit to an assembly.
  const strings = Array.from(
    { length: Math.max(detail.bha.length, detail.bit.length) },
    (_, i) => ({ bha: detail.bha[i] as Row | undefined, bit: detail.bit[i] as Row | undefined }),
  );

  // a.json `components` — the itemised make-up. The archive keeps the assembly as
  // one free-text Specification, so what can be itemised is the drill pipe in
  // hole (DrillString) and the tools with a serial number (Jar / DH motor).
  const components: Row[] = [];
  const addTool = (label: string, d?: EquipmentItem | null) => {
    if (!d || [d.type, d.size, d.sn, d.hrs].every((x) => x == null || x === "")) return;
    components.push({
      "Item des": d.type ? `${label} — ${v(d.type)}` : label, "Serv": null, "SN": d.sn,
      "OD (in)": d.size, "ID (in)": null, "Jts": null, "Len (m)": null, "Cum len (m)": null,
      "Com": d.hrs != null ? `${v(d.hrs)} hr` : null,
    });
  };
  addTool("Jar", detail.equipment?.jar);
  addTool("MWD", detail.equipment?.mwd);
  addTool("DH motor", detail.equipment?.dhMotor);
  for (const d of detail.drillString ?? []) {
    components.push({
      "Item des": "Drill pipe", "Serv": null, "SN": null, "OD (in)": d.size, "ID (in)": null,
      "Jts": null, "Len (m)": null, "Cum len (m)": null,
      "Com": d.grade != null ? `Grade ${v(d.grade)}` : null,
    });
  }

  const additives: Row[] = (detail.chemicals ?? []).map((x) => ({
    "Des": x["Material"], "Units": x["Unit"], "Consumed": x["Used"], "Rec": x["Rec."], "On loc": x["Stock"],
    "O/S": x["O/S"], "Req": x["Req"], "Sent": x["Sent"],
  }));

  const casing: Row[] = detail.casing.map((x) => ({
    "Csg des": x["Casing"], "Set depth (mKB)": x["Depth (m)"],
    "Com": x["Remarks"], "Joints": x["Joints"],
  }));

  return (
    <div className="bg-white border border-gray-300 rounded overflow-hidden text-gray-800">
      {/* Repeating page banner (a.json `document`) */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-700 text-white">
        <div className="font-semibold text-sm truncate">
          {v(w("name") ?? h.WellCode)} — Daily Drilling Report
        </div>
        <div className="text-xs whitespace-nowrap">DDR #{v(h.SerialNo)} · {v(h.DrillingDate)}</div>
      </div>

      {/* ── 01 report_header ─────────────────────────────────────────────── */}
      <GT n="01">Report header</GT>
      <HGrid fields={[
        { l: "Field name", v: w("field") },
        { l: "Client", v: w("company") },
        { l: "Well type", v: w("wellType") },
        { l: "Water depth (m)", v: w("waterDepth") },
        { l: "Latitude", na: true },
        { l: "Longitude", na: true },
        { l: "Rig number", v: w("rig") },
        { l: "Contractor", v: w("contractor") },
        { l: "Original KB elevation (m)", v: w("rtElevation") },
        { l: "Other elevation", v: w("groundLevel") != null ? `GL(m): ${v(w("groundLevel"))}` : null,
          t: "The archive records ground level, not the air gap the printed form usually notes here." },
        { l: "Comment", na: true },
        { l: "Spud date", v: w("spudDate") },
        { l: "Cum. time log (days)", na: true, t: "The archive's rig days are a well total, not a per-report cumulative — shown below under the archive-only fields." },
        { l: "Days since LTI", na: true },
        { l: "Kick-off depth (mKB)", v: h.KOP },
        { l: "Last casing string", v: h.LastCasing },
        { l: "Ops category", v: h.HoleSizeCode, t: "The hole section being drilled, e.g. 12-1/4\" H.S." },
        { l: "Current geology", v: h.Formation },
        { l: "Mud type", v: m["Mud type"] },
        { l: "Last mud check density (ppg)", v: mudWeightRangePpg(m["Min wt"], m["Max wt"]),
          t: `Archive N01 min/max weight as recorded: ${v(m["Min wt"])} / ${v(m["Max wt"])} — unit inferred from magnitude (pcf on most reports).` },
        { l: "Head count", na: true },
        { l: "Hazards", na: true },
        { l: "Start depth (mKB)", v: h.FromPoint },
        { l: "End depth (mKB)", v: h.ToPoint },
        { l: "End depth TVD (mKB)", na: true },
        { l: "Depth progress (m)", v: h.Meterage },
        { l: "Drilling hours (hr)", v: h.DrillingTime },
        { l: "Avg ROP (m/hr)", v: avgRop, t: "Derived: depth progress ÷ drilling hours." },
      ]} />
      <SubT>Archive only — DR.xls header fields the PEDC form does not name</SubT>
      <HGrid fields={[
        { l: "Well no.", v: w("wellCode") ?? h.WellCode },
        { l: "Well name (Farsi)", v: w("farsiName") },
        { l: "Location", v: w("location") },
        { l: "Well profile", v: w("profile") },
        { l: "Reservoir", v: w("reservoir") },
        { l: "TD reached", v: w("tdReachedDate") },
        { l: "Rig released", v: w("rigReleasedDate") },
        { l: "Well total depth (m)", v: w("totalDepth"), t: "A01 well total — the well's final MD, not this report's depth." },
        { l: "Well TVD (m)", v: w("tvd"), t: "A01 well total — the well's final TVD, not this report's depth." },
        { l: "Projected TD (m)", v: w("finalForecastDepth") },
        { l: "Est. total rig days", v: w("forecastDays") },
        { l: "Actual rig days", v: w("rigDays") },
        { l: "Morning depth (m)", v: h.MorningDepth },
        { l: "Total meter (as recorded)", v: h.TotalMeter,
          t: "L04 TotalMeter exactly as stored; the depth progress above is derived (end − start depth), which is what the sheet prints." },
        { l: "Cum. drilling time (hr)", v: h.TotalDRHour },
        { l: "Liner lap", v: h.LinerLap },
        { l: "Fresh water", v: h.FWater },
        { l: "Fuel", v: h.Fuel },
        { l: "Engineer", v: h.EngName },
      ]} />
      <F l="Lithology" v={h.Lithology} />

      {/* ── 02 operations ────────────────────────────────────────────────── */}
      <GT n="02">Operations</GT>
      <Narrative l="At report time" v={null} na />
      <Narrative l="Summary" v={h.Description} />
      <Narrative l="Next report period" v={null} na />

      {/* ── 03 supervisors_contact ───────────────────────────────────────── */}
      <GT n="03" right="derived from the report's name fields">Supervisors contact</GT>
      <Mini rows={supervisors} cols={["Job contact", "Position"]} fit />

      {/* ── 04 onboard_companies ─────────────────────────────────────────── */}
      <GT n="04">On-board companies</GT>
      <Mini rows={[]} cols={["Company", "Count", "Note"]} />
      <NotRecorded />

      {/* ── 05 hse_drill_schedule ────────────────────────────────────────── */}
      <GT n="05">HSE drill schedule</GT>
      {/* a.json: the four rows are fixed and always print, blank or not. */}
      <Mini rows={HSE_ROWS} cols={["Type", "Date", "Days to next check"]} fit />
      <NotRecorded />

      {/* ── 06 bulk_material ─────────────────────────────────────────────── */}
      <GT n="06">Bulk material</GT>
      <Mini rows={[]} cols={["Supply item des", "Unit", "Consumed", "Received", "Returned", "On loc", "Note"]} />
      <NotRecorded>the day's fresh water and fuel are on the header above, as the DR.xls sheet recorded them</NotRecorded>

      {/* ── 07 formations ────────────────────────────────────────────────── */}
      <GT n="07" right={formations.length ? `${formations.length} tops` : undefined}>Formations</GT>
      <Mini rows={formations} cols={[
        "Formation name", nr("Prog. top MD (mKB)"), "Final top MD (mKB)", nr("Final top TVD (mKB)"),
        nr("Thick (m)"), nr("Drilled ROP (m/hr)"), nr("Lith. des"), "Second depth (m)", "Top type",
      ]} />
      {formations.length > 0 && (
        <Note>
          The archive holds only the final top MD (the well's geological column, carried on every report).
          Prognosed top, TVD, thickness, drilled ROP and the lithology description are not recorded in it.
          Second depth and top type are archive-only columns.
        </Note>
      )}

      {/* ── 08 directional_survey ────────────────────────────────────────── */}
      <GT n="08" right={surveys.length ? `${surveys.length} stations` : undefined}>Directional survey</GT>
      <Mini rows={surveys} cols={[
        "MD (mKB)", "Incl (°)", "Azm (°)", "TVD (mKB)", "NS (m)", "EW (m)", "VS (m)",
        "DLS (°/30m)", nr("Build (°/30m)"), "Section HD (m)", "Dir", "Remarks",
      ]} />
      {surveys.length > 0 && (
        <Note>Build rate is not recorded in the archive. Section HD, direction and remarks are archive-only columns.</Note>
      )}

      {/* ── 09 operations_24hr ───────────────────────────────────────────── */}
      <GT n="09" right={ops.length ? `${opsHours.toFixed(1)} hr of 24 · ${ops.length} entries` : undefined}>
        24 hrs operation report
      </GT>
      <Mini rows={ops} cols={["Start time", "Dur (hr)", "End time", "Code 1", nr("Code 2"), "Com", "Operation"]} />
      {ops.length > 0 && (
        <Note>
          Duration is each entry's own end time − start time. Code 2 (P / NP) is not recorded in the archive;
          the resolved operation name is an archive-only column.
        </Note>
      )}

      {/* ── 10 morning_report_6hr ────────────────────────────────────────── */}
      <GT n="10" right="00:00–06:00 of the next day">6 hrs morning report</GT>
      <NotRecorded />

      {/* ── 11 drill_strings ─────────────────────────────────────────────── */}
      <GT n="11" right={strings.length
        ? `${strings.length} string${strings.length > 1 ? "s" : ""}${bitMeterage != null ? ` · ${v(bitMeterage)} m` : ""}${bitHours != null ? ` · ${v(bitHours)} hr` : ""}${bitRop != null ? ` · ${v(bitRop)} m/hr` : ""}`
        : undefined}>Drill strings</GT>
      {strings.length === 0 ? <None /> : strings.map((s, i) => (
        <DrillStringBlock key={i} index={i} bha={s.bha} bit={s.bit} />
      ))}
      <SubT>Components in hole</SubT>
      <Mini rows={components} cols={["Item des", "Serv", "SN", "OD (in)", "ID (in)", "Jts", "Len (m)", "Cum len (m)", "Com"]} />
      <Note>
        The archive stores each assembly as one free-text specification (shown as the string's note), not as an
        itemised make-up, and it does not say which assembly a component belonged to — these are the day's drill
        pipe and tools. Lengths, joint counts and the running total are not recorded in it; neither are MWD tools
        or stabilizers, which have no table in the converted database.
      </Note>

      {/* ── 12 drilling_parameters ───────────────────────────────────────── */}
      <GT n="12" right="one row per drilled interval">Drilling parameters</GT>
      <Mini rows={[]} cols={[
        "Start (mKB)", "End depth (mKB)", "Drill time (hr)", "Slide time (hr)", "Circ time (hr)",
        "Int. ROP (m/hr)", "Drill Tq", "RPM", "Q flow (gpm)", "SPP (psi)", "WOB (1000 lbf)",
      ]} />
      <NotRecorded>the archive keeps no per-interval rows — the bit run's own parameters are on its block above</NotRecorded>

      {/* ── 13 mud_information ───────────────────────────────────────────── */}
      <GT n="13">Mud information</GT>
      <FieldPair fields={[
        { l: "Depth (mKB)", v: m["To (m)"], t: "End of the interval the mud check covers." },
        { l: "Type", v: m["Mud type"] },
        { l: "Density (ppg)", v: mudWeightRangePpg(m["Min wt"], m["Max wt"]),
          t: `Archive N01 min/max weight as recorded: ${v(m["Min wt"])} / ${v(m["Max wt"])} — the day is a range, not one value; unit inferred from magnitude.` },
        { l: "T flowline (°F)", v: m["Temp"],
          t: "a.json asks for °C; the DR.xls sheet labelled this return temperature °F. Shown unconverted." },
        { l: "Funnel viscosity (s/qt)", v: m["Visc (s)"] },
        { l: "PV calc (cp)", v: m["PV"] },
        { l: "YP calc (lbf/100ft²)", v: m["YP"] },
        { l: "Filtrate (ml/30min)", v: m["Water loss"] },
        { l: "Vis 3 rpm", na: true },
        { l: "Vis 6 rpm", na: true },
        { l: "Gel 10 sec (lbf/100ft²)", v: m["Initial gel"] },
        { l: "Gel 10 min (lbf/100ft²)", v: m["10min gel"] },
        { l: "Water (%)", na: true },
        { l: "Oil (%)", v: m["Oil %"] },
        { l: "Solids (%)", v: m["Solids %"] },
        { l: "Low gravity solids (%)", na: true },
        { l: "MBT (lb/bbl)", v: m["MBT"] },
        { l: "pH", v: m["pH"] },
        { l: "Chlorides (mg/l)", v: m["Salinity"] },
        { l: "Hardness Ca (ppm)", v: m["Ca"] },
        { l: "KCl (lb/bbl)", v: m["KCl"] },
        { l: "Mud lost to hole (bbl)", v: h.FormationLoss },
        { l: "Active mud volume (bbl)", na: true },
        { l: "Vol. mud reserve (bbl)", na: true },
      ]} />
      <SubT>Archive only — DR.xls mud fields the PEDC form does not name</SubT>
      <FieldPair fields={[
        { l: "Check interval (m)", v: pair(m["From (m)"], m["To (m)"], " – ") },
        { l: "Rep. time", v: m["Rep time"] },
        { l: "Fan 600 / 300", v: m["Fan 600/300"] },
        { l: "ALK", v: m["ALK"] },
        { l: "HPHT", v: m["HPHT"] },
        { l: "Air / foam (CFM)", v: m["Air/Foam"] },
        { l: "O/W ratio", v: m["O/W"] },
        { l: "E-stability (V)", v: m["E-stability"] },
        { l: "PF / MF", v: pair(m["PF"], m["MF"]) },
        { l: "Mud loss @ units (bbl)", v: h.MudLossUnit },
        { l: "Mud gains (bbl)", v: h.MudGains },
        { l: "Remarks", v: m["Remarks"] },
      ]} />

      {/* ── 14 mud_additive_balance ──────────────────────────────────────── */}
      <GT n="14" right={additives.length ? `${additives.length} items` : undefined}>Mud additive balance</GT>
      <Mini rows={additives} cols={["Des", "Units", "Consumed", "Rec", "On loc", "O/S", "Req", "Sent"]} />
      {additives.length > 0 && <Note>Outstanding, requested and sent are archive-only columns.</Note>}

      {/* ── 15 casing_string ─────────────────────────────────────────────── */}
      <GT n="15" right="strings in hole at this date">Casing string</GT>
      <Mini rows={casing} cols={["Csg des", nr("Run date"), nr("Top (mKB)"), "Set depth (mKB)", "Com", "Joints"]} />
      {casing.length > 0 && (
        <Note>Run date and the string's top are not recorded in the archive; the joint count is an archive-only column.</Note>
      )}

      {/* ── 16 wellhead_component ────────────────────────────────────────── */}
      <GT n="16">Wellhead component</GT>
      <Mini rows={[]} cols={["Install date", "Size (in)", "Type", "Make", "WP (psi)", "Com"]} />
      <NotRecorded />

      {/* ── 17 well_control_scr ──────────────────────────────────────────── */}
      <GT n="17" right="slow circulation rates">Well control — SCR</GT>
      <Mini rows={[]} cols={["Pump #", "Depth (mKB)", "Strokes (spm)", "Eff (%)", "P (psi)", "Q flow (gpm)"]} />
      <NotRecorded />

      {/* ── 18 formation_integrity_test ──────────────────────────────────── */}
      <GT n="18">Formation integrity test</GT>
      <NotRecorded />

      {/* ── 19 marine_conditions ─────────────────────────────────────────── */}
      <GT n="19" right="offshore only">Marine conditions</GT>
      <FieldPair fields={[
        { l: "Swell ht (m)", na: true },
        { l: "Visibility (km)", na: true },
        { l: "Wind dir", na: true },
        { l: "Wind spd (knots)", na: true },
        { l: "T high (°C)", na: true },
        { l: "Wave ht (m)", na: true },
        { l: "Com", na: true },
      ]} />
      <SubT>Archive only — the same readings as free text on the DR.xls sheet</SubT>
      <FieldPair fields={[
        { l: "Wind speed / direction", v: h.WindSpeed_Dir },
        { l: "Wave / visibility", v: h.WaveVisible },
      ]} />
      <Note>The archive wrote the weather as free text, so it cannot be split into the typed values above.</Note>

      {/* ── 20 support_vessels ───────────────────────────────────────────── */}
      <GT n="20">Support vessels</GT>
      <Mini rows={[]} cols={["Vessel name", "Vessel type", "Arrival date", "Departure date", "Note"]} />
      <NotRecorded />

      {/* ── 21 general_notes ─────────────────────────────────────────────── */}
      <GT n="21">General notes</GT>
      <NotRecorded />

      {/* ── archive-only sections ────────────────────────────────────────── */}
      <div className="bg-amber-50 text-amber-900 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-1 border-y border-amber-200">
        Archive only — sections the PEDC/POGC form does not have
      </div>
      <SubT>Time breakdown</SubT>
      <Mini rows={detail.timeAnalysis} cols={["Group", "Type", "Activity", "Hours"]} fit />
      {detail.solidControl && <SolidControlSection sc={detail.solidControl} />}
    </div>
  );
}

/** a.json prints these four HSE rows blank rather than dropping them. */
const HSE_ROWS: Row[] = ["BOP Test", "H2S Drill", "Fire Drill", "Abandon Drill"]
  .map((t) => ({ "Type": t, "Date": null, "Days to next check": null }));

/**
 * One a.json `drill_strings` entry: the string header, then the bit record.
 *
 * Module scope, like every helper in this file — a component declared inside
 * another remounts its whole subtree on each render of the parent.
 */
function DrillStringBlock({ index, bha, bit }: { index: number; bha?: Row; bit?: Row }) {
  const b = bit ?? {};
  const meterage = num(b["Bit meterage"]), hours = num(b["Bit hrs"]);
  const rop = meterage != null && hours != null && hours > 0 ? Number((meterage / hours).toFixed(2)) : null;
  return (
    <div className="border-b-4 border-gray-100 last:border-b-0">
      <SubT>
        Drill string {index + 1}
        {bha?.["Assembly #"] != null ? ` · BHA #${v(bha["Assembly #"])}` : ""}
      </SubT>
      <FieldPair fields={[
        { l: "Drill string name", na: true },
        { l: "BHA no.", v: bha?.["Assembly #"] },
        { l: "Depth in (mKB)", na: true,
          t: "The depth the string went in hole is not recorded. The bit run's start depth (below) is not it: L05 rows are per DAY, so a run spanning days restarts at that day's depth." },
        { l: "Date in", na: true },
        { l: "BHA objective", na: true },
        { l: "Depth drilled (m)", v: meterage },
        { l: "Drilling time (hr)", v: hours },
        { l: "Circulating time (hr)", na: true },
        { l: "Rotating time (hr)", na: true },
        { l: "Sliding time (hr)", na: true },
      ]} />
      <F l="Note" v={bha?.["Specification"]} />
      {bha && (
        <FieldPair fields={[
          { l: "String length (m)", v: bha["Length (m)"] },
          { l: "String weight", v: bha["Weight"] },
          { l: "Drag up", v: bha["Drag up"] },
          { l: "Drag down", v: bha["Drag down"] },
        ]} />
      )}
      <SubT>Bit</SubT>
      <FieldPair fields={[
        { l: "Size (in)", v: b["Bit size"] },
        { l: "Model", v: b["Bit type"] },
        { l: "IADC codes", v: b["IADC code"] },
        { l: "Make", na: true },
        { l: "Serial number", v: b["Bit ser.no."] },
        { l: "Bit run", v: b["Bit #"] },
        { l: "Nozzles (32nds)", v: b["Nozzles"] },
        { l: "TFA (in²)", v: b["TFA"] },
        { l: "Bit revs", na: true },
        { l: "IADC bit dull", v: b["Dull (IADC)"],
          t: "a.json's 8-position grade I-O-D-L-B-G-O-R; the archive stores seven of the eight positions." },
      ]} />
      <SubT>Archive only — DR.xls bit-run fields the PEDC form does not name</SubT>
      <FieldPair fields={[
        { l: "Hole size", v: b["Hole size"] },
        { l: "Run interval (m)", v: pair(b["From (m)"], b["To (m)"], " – ") },
        { l: "Bit ROP (m/hr)", v: rop, t: "Derived: bit meterage ÷ bit hours." },
        { l: "WOB (klb)", v: b["WOB (klb)"] },
        { l: "RPM", v: b["RPM"] },
        { l: "Torque (on / off)", v: b["Torque"] },
        { l: "Reason pulled", v: b["Reason pulled"] },
        { l: "Pump type", v: b["Pump type"] },
        { l: "Pump output (gpm)", v: b["Pump output (gpm)"] },
        { l: "Pump pressure", v: b["Pump pressure"] },
        { l: "Annular velocity", v: b["Annular velocity"] },
        { l: "Bit HSI", v: b["HSI"] },
        { l: "CMT drilled (m-hr)", v: b["CMT drl (m/h)"] },
        { l: "Wash & ream (m-hr)", v: b["W&R (m/h)"] },
        { l: "Bit change (in / out)", v: b["Bit change (in/out)"] },
        { l: "Remarks", v: b["Remarks"] },
      ]} />
    </div>
  );
}

// ── primitives ──────────────────────────────────────────────────────────────

/** A label/value pair for the header grid and the label/value blocks.
 *  `na` = the archive has NO column for this field (not "the crew left it
 *  blank"), so the dash is muted and says so on hover. */
interface Fld { l: string; v?: unknown; na?: boolean; t?: string }

/** Compact inline header cell ("LABEL: value") for the report-header grid. */
function HF({ l, v: value, na, t }: Fld) {
  return (
    <div className="flex items-baseline gap-1 px-2 py-1 border-r border-b border-gray-200 min-w-0"
      title={t ?? (na ? "not recorded in the archive" : undefined)}>
      <span className="text-[9px] uppercase tracking-wide text-gray-500 shrink-0">{l}:</span>
      <span className={`text-[11px] truncate ${na ? "text-gray-300" : "font-semibold text-gray-900"}`}>
        {na ? "—" : v(value)}
      </span>
    </div>
  );
}

/** The dense identification grid at the top of the sheet. */
function HGrid({ fields }: { fields: Fld[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 bg-gray-50/70">
      {fields.map((f) => <HF key={f.l} {...f} />)}
    </div>
  );
}

/** Label / value cell. Long values (specification, formation, casing…) wrap and
 *  show in full, preserving any embedded line breaks, instead of truncating. */
function F({ l, v: value, na, t }: Fld) {
  return (
    <div className="flex items-start border-b border-gray-100"
      title={t ?? (na ? "not recorded in the archive" : undefined)}>
      <div className="w-[44%] shrink-0 self-stretch bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100">{l}</div>
      <div className={`flex-1 min-w-0 px-1.5 py-0.5 text-[11px] whitespace-pre-wrap break-words ${na ? "text-gray-300" : ""}`}>
        {na ? "—" : v(value)}
      </div>
    </div>
  );
}

/** A label/value block laid out as the sheet prints it: two columns, filled
 *  down the left first so the a.json field order reads top-to-bottom. */
function FieldPair({ fields }: { fields: Fld[] }) {
  const half = Math.ceil(fields.length / 2);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="border-gray-200 md:border-r">
        {fields.slice(0, half).map((f) => <F key={f.l} {...f} />)}
      </div>
      <div>{fields.slice(half).map((f) => <F key={f.l} {...f} />)}</div>
    </div>
  );
}

/** One of the three `operations` narratives. */
function Narrative({ l, v: value, na }: Fld) {
  return (
    <div className="border-b border-gray-100">
      <div className="bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-100">{l}</div>
      {na
        ? <NotRecorded />
        : <div className="px-2 py-1.5 text-[11px] whitespace-pre-wrap">{v(value)}</div>}
    </div>
  );
}

/** a.json section bar — numbered so the 21-block sequence is readable at a glance. */
function GT({ n, right, children }: { n?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-blue-100 text-blue-900 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-blue-200 flex items-baseline justify-between gap-2 flex-wrap">
      <span>
        {n && <span className="text-blue-500 tabular-nums mr-1.5">{n}</span>}
        {children}
      </span>
      {right && <span className="font-normal normal-case text-blue-700/70">{right}</span>}
    </div>
  );
}

/** Sub-heading inside a section (a bit record, a components table, an
 *  archive-only group). */
function SubT({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-100 text-gray-600 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
      {children}
    </div>
  );
}

/** The crew left it blank. */
function None() {
  return <div className="px-1.5 py-1 text-[11px] text-gray-400">—</div>;
}

/** The old form never captured it — a different statement from a blank field. */
function NotRecorded({ children }: { children?: React.ReactNode }) {
  return (
    <div className="px-2 py-1.5 text-[10px] text-gray-400 italic">
      not recorded in the archive
      {children ? <span className="not-italic"> — {children}</span> : null}
    </div>
  );
}

/** Quiet footnote naming what a section's blank columns mean. */
function Note({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-1 text-[10px] text-gray-400 leading-snug border-t border-gray-100">{children}</div>;
}

/** Solid-control equipment table (Clay Jactor / Mud Cleaner / Shaker). */
function SolidControlSection({ sc }: { sc: SolidControl }) {
  return (
    <>
      <SubT>Solid control</SubT>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead className="bg-gray-50 text-gray-500">
            <tr>{["Solid control", "HRS", "U.F.", "O.F.", "FEED", "CONS", "F.PRS."].map((c) => (
              <th key={c} className="px-1.5 py-1 text-left font-medium whitespace-nowrap">{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {sc.rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
                <td className="px-1.5 py-0.5 font-medium whitespace-nowrap">{r.unit}</td>
                {[r.hrs, r.uf, r.of, r.feed, r.cons, r.fprs].map((x, j) => (
                  <td key={j} className="px-1.5 py-0.5 whitespace-nowrap">{v(x)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sc.shakerScreen && (
        <div className="px-2 py-1 text-[10px] text-gray-600 border-t border-gray-100">Shaker screen size — {sc.shakerScreen}</div>
      )}
    </>
  );
}

/** Free-text columns wrap and show in full; the rest stay on one line. */
const WIDE_COLS = new Set(["Remarks", "Activity", "Specification", "Com", "Note", "Operation", "Item des", "Lith. des"]);

/**
 * A `Mini` column: a plain label, or one wrapped by `nr()` — a column a.json
 * asks for that the archive has NO source column for. Its cells print the
 * not-recorded marker instead of "—", which would claim the crew left the field
 * blank on a form that never had it.
 */
type MiniCol = string | { c: string; nr: true };
const nr = (c: string): MiniCol => ({ c, nr: true });
const colName = (c: MiniCol): string => (typeof c === "string" ? c : c.c);

/** In-table twin of <NotRecorded>: the column has no archive source at all.
 *  Same `n/r` marker the Tables view uses. */
function NrCell() {
  return <span className="text-amber-600/80 italic" title="not recorded in the archive">n/r</span>;
}

/**
 * A section's rows. An EMPTY table still prints its column headers — a.json is
 * explicit about that, and it is what tells the reader which fields the block
 * would have carried.
 */
function Mini({ rows, cols, fit }: { rows: Row[]; cols: MiniCol[]; fit?: boolean }) {
  return (
    <div className={fit ? "" : "overflow-x-auto"}>
      {/* `fit` = fixed-layout table that always fills the width and wraps every
          cell, so narrow column sets never scroll horizontally. */}
      <table className={`w-full text-[10px] ${fit ? "table-fixed" : ""}`}>
        <thead className="bg-gray-50 text-gray-500">
          <tr>{cols.map((c) => {
            const name = colName(c), unsourced = typeof c !== "string";
            return (
              <th key={name}
                title={unsourced ? "not recorded in the archive" : undefined}
                className={`px-1.5 py-1 text-left font-medium ${unsourced ? "text-amber-700/60" : ""} ${fit ? "whitespace-normal break-words" : "whitespace-nowrap"}`}>
                {name}
              </th>
            );
          })}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={cols.length} className="px-1.5 py-1 text-[11px] text-gray-300">—</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
              {cols.map((c) => {
                const name = colName(c), wide = WIDE_COLS.has(name);
                const cls = fit
                  ? "px-1.5 py-0.5 align-top whitespace-normal break-words"
                  : `px-1.5 py-0.5 align-top ${wide ? "whitespace-pre-wrap break-words min-w-[240px]" : "whitespace-nowrap max-w-[240px] truncate"}`;
                if (typeof c !== "string") return <td key={name} className={cls}><NrCell /></td>;
                return (
                  <td key={name} className={cls} title={fit || wide ? undefined : v(r[name])}>{v(r[name])}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
