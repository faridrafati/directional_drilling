/**
 * Daily Drilling Report — rendered in the official one-page form layout from
 * old_report_code/DDR-React/DR.xls (the company's "DR" reporting sheet):
 *
 *   ┌ Well / Operations ┬ Bit · BHA · Casing ┬ Mud properties ┐
 *   ├ Last survey data  ┴ Time breakdown      ┤
 *   ├ Operations log ─────────────────────────┤
 *   ├ Formation tops ─────────────────────────┤
 *   └ Summary · Weather · Lithology ──────────┘
 *
 * Data comes from the resolved /ddr/* endpoints (A01 well master + L04 header +
 * the curated section rows). Single-value cells take the day's primary row;
 * multi-row sections (survey, time, operations) render as compact tables.
 */
import type { DdrWellInfo, DdrReportDetail, SolidControl, EquipmentItem } from "../../export/ddr.js";

type Row = Record<string, unknown>;

const v = (x: unknown): string => {
  if (x == null || x === "") return "—";
  if (typeof x === "number") return Number.isInteger(x) ? String(x) : x.toFixed(2);
  return String(x);
};
const pair = (a: unknown, b: unknown, sep = " / "): string =>
  a == null && b == null ? "—" : `${v(a)}${sep}${v(b)}`;

export function DrReportForm({ well, detail }: { well: DdrWellInfo | null; detail: DdrReportDetail }) {
  const h = detail.header;
  const b = detail.bit[0] ?? {};
  // Bit hours & meterage are summed across the day's bit run(s) (a bit-change
  // day has two L05 rows); bit ROP = total metres ÷ total hours.
  const sumBit = (key: string): number | null => {
    let any = false, total = 0;
    for (const x of detail.bit) {
      const n = Number(x[key]);
      if (x[key] != null && Number.isFinite(n)) { any = true; total += n; }
    }
    return any ? Number(total.toFixed(2)) : null;
  };
  const bitHours = sumBit("Bit hrs");
  const bitMeterage = sumBit("Bit meterage");
  const bitRop = bitHours != null && bitMeterage != null && bitHours > 0
    ? Number((bitMeterage / bitHours).toFixed(2)) : null;
  const m = detail.mud[0] ?? {};
  const w = (k: string): unknown => (well ? well[k] : null);

  return (
    <div className="bg-white border border-gray-300 rounded overflow-hidden text-gray-800">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-blue-700 text-white">
        <div className="font-semibold text-sm truncate">
          {v(w("name") ?? h.WellCode)} — Daily Drilling Report
        </div>
        <div className="text-xs whitespace-nowrap">#{v(h.SerialNo)} · {v(h.DrillingDate)}</div>
      </div>

      {/* DR.xls header band — the sheet's identifying fields */}
      <div className="border-b border-gray-300 bg-gray-50/70">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <HF l="Date" v={h.DrillingDate} />
          <HF l="Field" v={w("field")} />
          <HF l="Well no." v={w("wellCode") ?? h.WellCode} />
          <HF l="Loc" v={w("location")} />
          <HF l="Op. type" v={w("wellType")} />
          <HF l="Well prof." v={w("profile")} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 border-t border-gray-200">
          <HF l="Rig no." v={w("rig")} />
          <HF l="Spud date" v={w("spudDate")} />
          <HF l="Release date" v={w("rigReleasedDate")} />
          <HF l="Resv" v={w("reservoir")} />
          <HF l="R.T.E / W.depth" v={pair(w("rtElevation"), w("waterDepth"))} />
        </div>
      </div>

      {/* Top three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3">
        <div className="border-gray-200 md:border-r">
          <GT>Well / Operations</GT>
          <F l="Contractor" v={w("contractor")} />
          <F l="Proj. TD" v={w("finalForecastDepth")} />
          <F l="Est. ttl rig days" v={w("forecastDays")} />
          <F l="Act. rig days" v={w("rigDays")} />
          <F l="Morning depth" v={h.MorningDepth} />
          <F l="Midnight depth" v={h.ToPoint} />
          <F l="Previous depth" v={h.FromPoint} />
          <F l="Meterage" v={h.Meterage} />
          <F l="Drilling time" v={h.DrillingTime} />
          <F l="Cum. drlg time" v={h.TotalDRHour} />
          <F l="Hole size" v={h.HoleSizeCode} />
          <F l="Formation" v={h.Formation} />
          <F l="Lithology" v={h.Lithology} />
          <F l="Last casing" v={h.LastCasing} />
          <F l="Liner lap" v={h.LinerLap} />
          <F l="KOP (w/ st.pt.)" v={h.KOP} />
          <F l="Wellsite supt." v={h.WellSiteSupt} />
          <F l="Opn. supt." v={h.OPNSupt} />
          <F l="Prog. eng." v={h.ProgEng} />
          <F l="Geologist" v={h.Geologist} />
          <F l="Tool pusher 1" v={h.Cont_T_Push1} />
          <F l="Tool pusher 2" v={h.Cont_T_Push2} />
          <GT>Bottom hole assembly</GT>
          {detail.bha.length ? detail.bha.map((x, i) => (
            <F key={i} l={`BHA #${v(x["Assembly #"])} · ${v(x["Length (m)"])} m`} v={x["Specification"]} />
          )) : <None />}
          <DpTable ds={detail.drillString ?? []} />
          <GT>Drilling tools</GT>
          <EquipmentTable eq={detail.equipment} />
        </div>

        <div className="border-gray-200 md:border-r">
          <GT>Bit</GT>
          <F l="Bit no." v={b["Bit #"]} />
          <F l="Bit ser. no." v={b["Bit ser.no."]} />
          <F l="Bit size" v={b["Bit size"]} />
          <F l="Bit type" v={b["Bit type"]} />
          <F l="IADC code" v={b["IADC code"]} />
          <F l="Nozzle size / TFA" v={pair(b["Nozzles"], b["TFA"])} />
          <F l="Bit meterage (m)" v={bitMeterage} />
          <F l="Bit hours" v={bitHours} />
          <F l="WOB (klb)" v={b["WOB (klb)"]} />
          <F l="RPM" v={b["RPM"]} />
          <F l="Torque (on / off)" v={b["Torque"]} />
          <F l="Bit ROP (m/h)" v={bitRop} />
          <F l="Dull (IADC)" v={b["Dull (IADC)"]} />
          <F l="Reason pulled" v={b["Reason pulled"]} />
          <F l="Pump type" v={b["Pump type"]} />
          <F l="Pump output (gpm)" v={b["Pump output (gpm)"]} />
          <F l="Pump pressure" v={b["Pump pressure"]} />
          <F l="Annular velocity" v={b["Annular velocity"]} />
          <F l="Bit HSI" v={b["HSI"]} />
          <F l="CMT drl (m-h)" v={b["CMT drl (m/h)"]} />
          <F l="W&R (m-h)" v={b["W&R (m/h)"]} />
          <F l="Bit change (in / out)" v={b["Bit change (in/out)"]} />
          {detail.formationTops.length > 0 && (
            <>
              <GT>Formation tops</GT>
              <Mini rows={detail.formationTops} cols={["Formation", "Depth (m)", "Second depth", "Type"]} fit />
            </>
          )}
          <GT>Last casing</GT>
          {detail.casing.length ? detail.casing.map((x, i) => (
            <F key={i} l={v(x["Casing"])} v={`@ ${v(x["Depth (m)"])} m · ${v(x["Joints"])} jt`} />
          )) : <None />}
          {detail.solidControl && <SolidControlSection sc={detail.solidControl} />}
        </div>

        <div>
          <GT>Mud properties</GT>
          <F l="Mud system" v={m["Mud type"]} />
          <F l="MW max / min" v={pair(m["Max wt"], m["Min wt"])} />
          <F l="Rep. time" v={m["Rep time"]} />
          <F l="Funnel visc (s)" v={m["Visc (s)"]} />
          <F l="PV / YP" v={pair(m["PV"], m["YP"])} />
          <F l="Gel init / 10 min" v={pair(m["Initial gel"], m["10min gel"])} />
          <F l="Fan 600 / 300" v={m["Fan 600/300"]} />
          <F l="pH / ALK" v={pair(m["pH"], m["ALK"])} />
          <F l="Water loss / HPHT" v={pair(m["Water loss"], m["HPHT"])} />
          <F l="Air / foam (CFM)" v={m["Air/Foam"]} />
          <F l="Oil % / O:W" v={pair(m["Oil %"], m["O/W"])} />
          <F l="E-stability (V)" v={m["E-stability"]} />
          <F l="KCl (ppb)" v={m["KCl"]} />
          <F l="MBT" v={m["MBT"]} />
          <F l="PF / MF" v={pair(m["PF"], m["MF"])} />
          <F l="Chloride (ppm)" v={m["Salinity"]} />
          <F l="Calcium (ppm)" v={m["Ca"]} />
          <F l="Retort solids %" v={m["Solids %"]} />
          <F l="Temp (°F)" v={m["Temp"]} />
          <F l="Formation loss (bbl)" v={h.FormationLoss} />
          <F l="Mud loss @ units (bbl)" v={h.MudLossUnit} />
          <F l="Mud gains (bbl)" v={h.MudGains} />
          <GT>Chemical materials</GT>
          <Mini rows={detail.chemicals ?? []} cols={["Material", "Unit", "Used", "Rec.", "Stock", "O/S", "Req", "Sent"]} />
        </div>
      </div>

      {/* Last survey data (left) + time breakdown (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-t border-gray-200">
        <div className="md:border-r border-gray-200">
          <GT>Last survey data</GT>
          <Mini rows={detail.directional} cols={["MD (m)", "Inc (°)", "Azi (°)", "TVD (m)", "N/S", "E/W", "DLS"]} />
        </div>
        <div>
          <GT>Time breakdown</GT>
          <Mini rows={detail.timeAnalysis} cols={["Group", "Type", "Activity", "Hours"]} fit />
        </div>
      </div>

      <GT>Operations log</GT>
      <Mini rows={detail.operations} cols={["Op", "From", "To", "Remarks"]} />

      <GT>Summary</GT>
      <div className="px-2 py-1.5 text-[11px] whitespace-pre-wrap">{v(h.Description)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-gray-200">
        <F l="Wind speed/dir" v={h.WindSpeed_Dir} />
        <F l="Wave / vis" v={h.WaveVisible} />
        <F l="Fresh water" v={h.FWater} />
        <F l="Fuel" v={h.Fuel} />
      </div>
      {/* Lithology is shown once, in the Well / Operations column (DR.xls cell
          [1,15]); no separate bottom section to avoid duplicating it. */}
    </div>
  );
}

/** Compact inline header cell ("LABEL: value") for the DR.xls header band. */
function HF({ l, v: value }: { l: string; v: unknown }) {
  return (
    <div className="flex items-baseline gap-1 px-2 py-1 border-r border-gray-200 min-w-0">
      <span className="text-[9px] uppercase tracking-wide text-gray-500 shrink-0">{l}:</span>
      <span className="text-[11px] font-semibold text-gray-900 truncate" title={v(value)}>{v(value)}</span>
    </div>
  );
}

/** Label / value cell. Long values (BHA spec, formation, casing…) wrap and show
 *  in full, preserving any embedded line breaks, instead of truncating. */
function F({ l, v: value }: { l: string; v: unknown }) {
  return (
    <div className="flex items-start border-b border-gray-100">
      <div className="w-[44%] shrink-0 self-stretch bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100">{l}</div>
      <div className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] whitespace-pre-wrap break-words">{v(value)}</div>
    </div>
  );
}
function GT({ children }: { children: React.ReactNode }) {
  return <div className="bg-blue-100 text-blue-900 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-blue-200">{children}</div>;
}
function None() {
  return <div className="px-1.5 py-1 text-[11px] text-gray-400">—</div>;
}

/** D/P size · D/P grade · stabilizer rows below the BHA (Unit10.pas rows 34–36).
 *  Sizes/grades come from DrillString; the Stabilizers table isn't in the
 *  converted DB, so that row is shown blank. */
function DpTable({ ds }: { ds: { size: unknown; grade: unknown }[] }) {
  const n = Math.max(ds.length, 1);
  const Lbl = ({ children }: { children: React.ReactNode }) => (
    <td className="w-[44%] bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 font-medium border-r border-gray-100">{children}</td>
  );
  const cells = (pick: (d: { size: unknown; grade: unknown }) => unknown) =>
    Array.from({ length: n }, (_, i) => (
      <td key={i} className="px-1.5 py-0.5 border-l border-gray-100 whitespace-nowrap text-[11px]">{ds[i] ? v(pick(ds[i])) : ""}</td>
    ));
  return (
    <table className="w-full border-t border-gray-100">
      <tbody>
        <tr className="border-b border-gray-100"><Lbl>D/P size</Lbl>{cells((d) => d.size)}</tr>
        <tr className="border-b border-gray-100"><Lbl>D/P grade</Lbl>{cells((d) => d.grade)}</tr>
        <tr><Lbl>Stabilizer</Lbl><td colSpan={n} className="px-1.5 py-0.5 text-[11px] text-gray-400">—</td></tr>
      </tbody>
    </table>
  );
}

/** Jar / MWD / DH-motor — type · size · SN · hours (Unit10.pas rows 31/33/35).
 *  MWD isn't in the converted DB, so that row shows blank. */
function EquipmentTable({ eq }: { eq?: { jar: EquipmentItem | null; mwd: EquipmentItem | null; dhMotor: EquipmentItem | null } }) {
  const Row = ({ label, d }: { label: string; d?: EquipmentItem | null }) => (
    <tr className="border-b border-gray-100">
      <td className="bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 font-medium border-r border-gray-100 whitespace-nowrap">
        {label}{d?.type ? ` · ${v(d.type)}` : ""}
      </td>
      <td className="px-1.5 py-0.5 text-[10px] whitespace-nowrap"><span className="text-gray-400">Size </span>{d ? v(d.size) : ""}</td>
      <td className="px-1.5 py-0.5 text-[10px] whitespace-nowrap"><span className="text-gray-400">SN </span>{d ? v(d.sn) : ""}</td>
      <td className="px-1.5 py-0.5 text-[10px] whitespace-nowrap"><span className="text-gray-400">HRS </span>{d ? v(d.hrs) : ""}</td>
    </tr>
  );
  return (
    <table className="w-full border-t border-gray-100">
      <tbody>
        <Row label="Jar (type)" d={eq?.jar} />
        <Row label="MWD (type)" d={eq?.mwd} />
        <Row label="DH motor (type)" d={eq?.dhMotor} />
      </tbody>
    </table>
  );
}

/** Solid-control equipment table (Clay Jactor / Mud Cleaner / Shaker). */
function SolidControlSection({ sc }: { sc: SolidControl }) {
  return (
    <>
      <GT>Solid control</GT>
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
function Mini({ rows, cols, fit }: { rows: Row[]; cols: string[]; fit?: boolean }) {
  if (!rows || rows.length === 0) return <None />;
  return (
    <div className={fit ? "" : "overflow-x-auto"}>
      {/* `fit` = fixed-layout table that always fills the column width and wraps
          every cell, so narrow columns (time breakdown, formation tops) never
          scroll horizontally. */}
      <table className={`w-full text-[10px] ${fit ? "table-fixed" : ""}`}>
        <thead className="bg-gray-50 text-gray-500">
          <tr>{cols.map((c) => (
            <th key={c} className={`px-1.5 py-1 text-left font-medium ${fit ? "whitespace-normal break-words" : "whitespace-nowrap"}`}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i % 2 ? "bg-gray-50/50" : ""}>
              {cols.map((c) => {
                // Long free-text columns wrap and show in full; the rest stay on
                // one line (truncated). In `fit` mode every cell wraps instead.
                const wide = c === "Remarks" || c === "Activity" || c === "Specification";
                const cls = fit
                  ? "px-1.5 py-0.5 align-top whitespace-normal break-words"
                  : `px-1.5 py-0.5 align-top ${wide ? "whitespace-pre-wrap break-words min-w-[240px]" : "whitespace-nowrap max-w-[240px] truncate"}`;
                return (
                  <td key={c} className={cls} title={fit || wide ? undefined : v(r[c])}>{v(r[c])}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
