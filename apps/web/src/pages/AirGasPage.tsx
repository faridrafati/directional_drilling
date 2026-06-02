/**
 * Air & Gas Drilling — underbalanced (dry-gas / aerated-mist) hydraulics page.
 *
 * Port of old_air_mud_code/Unit41.pas (TForm41) + the Form44 results view.
 * The user edits a run (scalars + casing / BHA / nozzle tables), hits
 * Calculate, and sees the section-boundary report, the densified pressure
 * traverse (chart + table), the derived header (P1/P2/Q1/K/shaft power), and
 * can probe the pressure at any arbitrary depth.
 *
 * All maths runs client-side in @dd/shared/air-mud — nothing is uploaded.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  calculate, AIR_MUD_PRESETS, DRYGAS_PRESET,
  type AirMudInput, type AirMudResult, type AirMudRow,
} from "@dd/shared/air-mud";
import { AirMudForm } from "../components/airmud/AirMudForm.js";
import { DepthTraverseChart } from "../components/airmud/AirMudChart.js";
import { exportAirMudCsv, exportAirMudPdf, exportAirMudXlsx } from "../export/airmud.js";
import {
  type Quantity, type UnitSel, UNITS, SYSTEMS, DEFAULT_SEL, systemLabel, unitName,
  disp, toBase, dispCol, colUnit, GAS_FLOW_BASE,
} from "../units/airmudUnits.js";

type ArbResult = AirMudResult & { arbitrary?: AirMudRow };

/** Which reporting view is shown — mirrors the Form44 PageControl tabs. */
type ReportTab = "data" | "pressure" | "flow" | "energy";

const num = (v: number, dp: number): string => (Number.isFinite(v) ? v.toFixed(dp) : "—");

export function AirGasPage() {
  const [input, setInput] = useState<AirMudInput>(() => clone(DRYGAS_PRESET));
  const [result, setResult] = useState<AirMudResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>("drygas");
  const [dialog, setDialog] = useState<null | "export" | "units">(null);
  // Display-unit selection (compute stays in base units; this only changes display).
  const [sel, setSel] = useState<UnitSel>(() => ({ ...DEFAULT_SEL }));
  // True when `input` has changed since the last calculation, so the shown
  // results may be stale (prevents mistaking old numbers for the new inputs).
  const [dirty, setDirty] = useState(false);

  // Arbitrary-point probe (Form44's "find pressure at depth" row).
  const [arbPart, setArbPart] = useState<"ANLS" | "STRG">("ANLS");
  const [arbDepth, setArbDepth] = useState<number>(5000);
  const [arbRow, setArbRow] = useState<AirMudRow | null>(null);

  // Reporting-tab + chart-series toggles (Form44 PageControl + checkboxes).
  const [tab, setTab] = useState<ReportTab>("pressure");
  const [pressMetric, setPressMetric] = useState<"press" | "delP">("press"); // Chart1: CheckBox1 / CheckBox2
  const [flowMetric, setFlowMetric] = useState<"gfrate" | "keDen">("keDen");  // Chart2: CheckBox3 / CheckBox4
  // Annulus / drill-string leg visibility is toggled by clicking the chart legend
  // (replacing Form44's CheckBox5 / CheckBox6).

  function run(next: AirMudInput) {
    // Aerated (mist) drilling needs a liquid phase — with zero mud rate/weight the
    // mist solver diverges into astronomically large pressures, so refuse to run
    // rather than display nonsense.
    if (next.calcType === "aerated" && (next.mudFlow <= 0 || next.mudWt <= 0)) {
      setError(
        "Aerated (mist) drilling needs a mud rate and mud weight greater than zero — " +
        "set them in the “Liquid mud (aerated only)” section, or switch the fluid model to Dry gas.",
      );
      setResult(null);
      setDirty(false);
      return;
    }
    try {
      const res = calculate(next);
      setResult(res);
      setError(null);
    } catch (e) {
      setError(String(e));
      setResult(null);
    }
    setDirty(false); // results now reflect `next`
  }

  /**
   * Apply an edit from the form. A fluid-model switch recalculates immediately
   * (the whole physics changes, so stale numbers would be misleading); any other
   * edit just marks the results stale until the user presses Calculate.
   */
  function handleInputChange(next: AirMudInput) {
    let n = next;
    // Switching a dry-gas run to aerated with no mud yet would diverge; seed
    // sensible mist defaults (the AERATED MUD sample's 231 gpm / 10 ppg / 30 PV)
    // so the user gets a valid run immediately and can then tune it.
    if (next.calcType === "aerated" && input.calcType !== "aerated" && (next.mudFlow <= 0 || next.mudWt <= 0)) {
      n = {
        ...next,
        mudFlow: next.mudFlow > 0 ? next.mudFlow : 231,
        mudWt: next.mudWt > 0 ? next.mudWt : 10,
        mudVis: next.mudVis > 0 ? next.mudVis : 30,
      };
    }
    setInput(n);
    setPresetId("custom");
    if (n.calcType !== input.calcType) run(n);
    else setDirty(true);
  }

  // Compute once on mount with the default preset.
  useEffect(() => { run(clone(DRYGAS_PRESET)); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  function applyPreset(id: string) {
    const p = AIR_MUD_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    const next = clone(p.input);
    setInput(next);
    setArbRow(null);
    run(next);
  }

  function probe() {
    try {
      const res = calculate(input, { part: arbPart, depth: arbDepth }) as ArbResult;
      setArbRow(res.arbitrary ?? null);
    } catch {
      setArbRow(null);
    }
  }

  // Bottom-hole point for the chart's bit marker = deepest annulus row.
  const bhp = useMemo(() => {
    if (!result) return null;
    const anls = result.report.filter((r) => r.part.startsWith("ANLS"));
    if (anls.length === 0) return null;
    return anls.reduce((a, b) => (b.depth > a.depth ? b : a));
  }, [result]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col flex-1 min-h-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Air &amp; Gas Drilling</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Underbalanced dry-gas / aerated-mist hydraulics. Port of the Air &amp; Gas tool —
              everything computes in your browser.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="whitespace-nowrap">Sample&nbsp;well</span>
              <select
                value={presetId}
                onChange={(e) => applyPreset(e.target.value)}
                className="h-10 border border-gray-300 rounded-md px-2 text-sm bg-white"
                title="Load a bundled example well — replaces every input (use the form's Fluid model toggle to switch gas/aerated without reloading)"
              >
                {AIR_MUD_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
                <option value="custom" disabled>Custom (edited)</option>
              </select>
            </label>
            <button
              onClick={() => run(input)}
              className={`px-4 h-10 text-sm rounded-md text-white ${
                dirty ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
              }`}
              title={dirty ? "Inputs changed since the last calculation" : "Recompute"}
            >
              {dirty ? "Calculate ●" : "Calculate"}
            </button>
            <button
              onClick={() => setDialog("units")}
              className="px-3 h-10 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              title="Choose the unit system / per-quantity units"
            >
              Units: <span className="font-medium">{systemLabel(sel)}</span>
            </button>
            <button
              onClick={() => setDialog("export")}
              disabled={!result}
              className="px-3 h-10 text-sm rounded-md bg-green-700 text-white hover:bg-green-800 disabled:bg-gray-300"
              title="Export CSV / PDF / Excel"
            >
              Export
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {dirty && result && (
          <div className="mb-3 px-3 py-2 rounded bg-amber-50 border border-amber-200 text-sm text-amber-800 shrink-0">
            Inputs changed — the results below are stale. Press <strong>Calculate</strong> to update.
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 overflow-hidden">
          {/* Input panel — scrolls independently */}
          <div className="overflow-y-auto bg-white border border-gray-200 rounded p-4 min-h-0">
            <AirMudForm input={input} onChange={handleInputChange} sel={sel} />
          </div>

          {/* Results — scrolls independently */}
          <div className="overflow-y-auto min-h-0 space-y-4">
            {result ? (
              <>
                <HeaderChips result={result} bhp={bhp?.press ?? null} sel={sel} />
                <TabBar tab={tab} setTab={setTab} />

                {tab === "data" && (
                  <>
                    <ArbitraryProbe
                      part={arbPart} setPart={setArbPart}
                      depth={arbDepth} setDepth={setArbDepth}
                      onProbe={probe} row={arbRow}
                      maxDepth={input.tvdOut}
                      sel={sel}
                    />
                    <ResultTable title="Section report" rows={result.report} sel={sel} />
                    <ResultTable title={`Detail profile (${result.detail.length} points)`} rows={result.detail} dense sel={sel} />
                  </>
                )}

                {tab === "pressure" && (
                  <>
                    <ChartControls note="Pressure (or ΔP) vs depth — click a legend entry to show/hide a leg.">
                      <Segmented
                        value={pressMetric}
                        onChange={setPressMetric}
                        options={[{ v: "press", label: "Pressure" }, { v: "delP", label: "ΔP" }]}
                      />
                    </ChartControls>
                    <DepthTraverseChart
                      detail={result.detail}
                      sel={sel}
                      xKey={pressMetric}
                      xQuantity="pressure"
                      xLabel={`${pressMetric === "press" ? "Pressure" : "ΔP per step"} (${unitName("pressure", sel)})`}
                      title={`${pressMetric === "press" ? "Pressure traverse" : "ΔP per step"} — ${unitName("pressure", sel)} × ${unitName("length", sel)}`}
                      bhp={pressMetric === "press" ? bhp : null}
                      connectLegs={pressMetric === "press"}
                    />
                    <ResultTable
                      title="Pressure profile"
                      rows={result.detail}
                      dense
                      colKeys={["part", "depth", "press", "delP"]}
                      sel={sel}
                    />
                  </>
                )}

                {tab === "flow" && (
                  <>
                    <ChartControls note="Click a legend entry to show or hide the annulus / drill-string leg.">
                      <Segmented
                        value={flowMetric}
                        onChange={setFlowMetric}
                        options={[{ v: "gfrate", label: "Flow rate" }, { v: "keDen", label: "Kinetic density" }]}
                      />
                    </ChartControls>
                    <DepthTraverseChart
                      detail={result.detail}
                      sel={sel}
                      xKey={flowMetric}
                      xQuantity={flowMetric === "gfrate" ? "flow" : undefined}
                      xStoredBase={flowMetric === "gfrate" ? GAS_FLOW_BASE : 0}
                      xLabel={flowMetric === "gfrate" ? `Gas flow rate (${unitName("flow", sel)})` : "Kinetic-energy density"}
                      title={
                        flowMetric === "gfrate"
                          ? `Flow rate — gas q (${unitName("flow", sel)}) × ${unitName("length", sel)}`
                          : `Kinetic density — KE × ${unitName("length", sel)}`
                      }
                      connectLegs
                    />
                    <ResultTable
                      title="Flow / kinetic-density profile"
                      rows={result.detail}
                      dense
                      colKeys={["part", "depth", "gfrate", "keDen"]}
                      sel={sel}
                    />
                  </>
                )}

                {tab === "energy" && <EnergyPanel result={result} sel={sel} />}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded p-12 text-center text-gray-400">
                Adjust the inputs and press Calculate.
              </div>
            )}
          </div>
        </div>
      </div>

      {dialog === "export" && result && (
        <Popup title="Export" onClose={() => setDialog(null)}>
          <p className="text-[11px] text-gray-400 mb-3">
            Exports the current run's report + detail profile in the selected units ({systemLabel(sel)}).
          </p>
          <div className="space-y-2">
            <ExportChoice label="CSV" hint="Parameters + section report + detail (single file)"
              onClick={() => { setDialog(null); exportAirMudCsv(input, result, sel); }} />
            <ExportChoice label="PDF report" hint="Parameters, section report and detail profile"
              onClick={() => { setDialog(null); void exportAirMudPdf(input, result, sel); }} />
            <ExportChoice label="Excel workbook" hint="Parameters / Section report / Detail sheets (.xlsx)"
              onClick={() => { setDialog(null); void exportAirMudXlsx(input, result, sel); }} />
          </div>
        </Popup>
      )}

      {dialog === "units" && (
        <Popup title="Units" onClose={() => setDialog(null)} wide>
          <UnitsDialog sel={sel} setSel={setSel} />
        </Popup>
      )}
    </div>
  );
}

/** Derived header values (Form44's labels). */
function HeaderChips({ result, bhp, sel }: { result: AirMudResult; bhp: number | null; sel: UnitSel }) {
  const pu = unitName("pressure", sel);
  const fu = unitName("flow", sel);
  const chips: { label: string; value: string; hint?: string }[] = [
    { label: "Surface P1", value: `${num(disp("pressure", sel, result.p1), 1)} ${pu}`, hint: "annulus surface pressure" },
    { label: "Injection P2", value: `${num(disp("pressure", sel, result.p2), 1)} ${pu}`, hint: "standpipe / injection pressure" },
    { label: "Bottom-hole", value: bhp == null ? "—" : `${num(disp("pressure", sel, bhp), 1)} ${pu}`, hint: "max annulus pressure" },
    { label: "Surface Q1", value: `${num(disp("flow", sel, result.q1, GAS_FLOW_BASE), 0)} ${fu}` },
    { label: "K", value: num(result.k, 2) },
    {
      label: "Shaft power",
      value: result.shaftPowerHp == null ? "n/a" : `${num(result.shaftPowerHp, 1)} HP`,
      hint: result.shaftPowerHp == null ? "gas runs only" : "compressor shaft power",
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {chips.map((c) => (
        <div key={c.label} className="bg-white border border-gray-200 rounded px-3 py-2" title={c.hint}>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">{c.label}</div>
          <div className="text-sm font-semibold text-gray-800 tabular-nums">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function ArbitraryProbe({
  part, setPart, depth, setDepth, onProbe, row, maxDepth, sel,
}: {
  part: "ANLS" | "STRG";
  setPart: (p: "ANLS" | "STRG") => void;
  depth: number;
  setDepth: (d: number) => void;
  onProbe: () => void;
  row: AirMudRow | null;
  maxDepth: number;
  sel: UnitSel;
}) {
  const lu = unitName("length", sel);
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-[11px] text-gray-500 block mb-0.5">Probe section</label>
          <select
            value={part}
            onChange={(e) => setPart(e.target.value as "ANLS" | "STRG")}
            className="h-9 border border-gray-300 rounded px-2 text-sm bg-white"
          >
            <option value="ANLS">Annulus</option>
            <option value="STRG">Drill string</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500 block mb-0.5">Depth ({lu})</label>
          <input
            type="number"
            value={disp("length", sel, depth)}
            min={0}
            max={disp("length", sel, maxDepth)}
            onChange={(e) => setDepth(toBase("length", sel, Number(e.target.value)))}
            className="h-9 w-28 border border-gray-300 rounded px-2 text-sm text-right tabular-nums"
          />
        </div>
        <button onClick={onProbe} className="h-9 px-3 rounded bg-gray-800 text-white text-sm hover:bg-gray-700">
          Find pressure
        </button>
        {row && (
          <div className="text-sm text-gray-700">
            <span className="text-gray-400">{row.part} @ {num(dispCol("depth", sel, row.depth), 0)} {lu} →</span>{" "}
            <span className="font-semibold">{num(dispCol("press", sel, row.press), 1)} {unitName("pressure", sel)}</span>
            <span className="text-gray-400">
              {" "}· {num(dispCol("velo", sel, row.velo), 1)} {colUnit("velo", sel)} · {num(dispCol("gfrate", sel, row.gfrate), 0)} {unitName("flow", sel)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const ALL_COLS: { key: keyof AirMudRow; label: string; dp: number }[] = [
  { key: "part", label: "Section", dp: -1 },
  { key: "depth", label: "Depth", dp: 0 },
  { key: "press", label: "Press", dp: 1 },
  { key: "delP", label: "ΔP", dp: 1 },
  { key: "gfrate", label: "Gas q", dp: 0 },
  { key: "velo", label: "Vel", dp: 1 },
  { key: "gasDen", label: "Dens", dp: 2 },
  { key: "keDen", label: "KE", dp: 3 },
];

function ResultTable({
  title, rows, dense, colKeys, sel,
}: {
  title: string;
  rows: AirMudRow[];
  dense?: boolean;
  /** Optional subset of columns to show (in canonical order). Defaults to all. */
  colKeys?: (keyof AirMudRow)[];
  sel: UnitSel;
}) {
  const cols = colKeys ? ALL_COLS.filter((c) => colKeys.includes(c.key)) : ALL_COLS;
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-3 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">{title}</div>
      <div className={dense ? "max-h-80 overflow-auto" : "overflow-auto"}>
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="text-gray-500 text-right">
              {cols.map((c) => {
                const u = colUnit(c.key, sel);
                return (
                  <th key={String(c.key)} className={`font-medium px-2 py-1.5 ${c.dp < 0 ? "text-left" : ""}`}>
                    {c.label}{u && <span className="text-gray-400 font-normal"> ({u})</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`text-right ${i % 2 ? "bg-gray-50/50" : ""}`}>
                {cols.map((c) => (
                  <td
                    key={String(c.key)}
                    className={`px-2 py-1 ${c.dp < 0 ? "text-left font-medium text-gray-700" : "text-gray-600"}`}
                  >
                    {c.dp < 0 ? String(r[c.key]) : num(dispCol(c.key, sel, Number(r[c.key])), c.dp)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Popup({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 pt-20" onClick={onClose}>
      <div className={`bg-white rounded-lg shadow-xl w-full ${wide ? "max-w-lg" : "max-w-sm"}`} onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 leading-none">×</button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

/** Form42 units dialog: 4 named systems + per-quantity overrides (Custom). */
function UnitsDialog({ sel, setSel }: { sel: UnitSel; setSel: (s: UnitSel) => void }) {
  const quantities = Object.keys(UNITS) as Quantity[];
  const active = systemLabel(sel);
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">System</div>
        <div className="flex flex-wrap gap-1.5">
          {SYSTEMS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSel({ ...s.sel })}
              className={`px-2.5 h-8 text-xs rounded border ${
                active === s.label
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {s.label}
            </button>
          ))}
          {active === "Custom" && (
            <span className="px-2.5 h-8 inline-flex items-center text-xs rounded border border-dashed border-amber-300 bg-amber-50 text-amber-700">
              Custom
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quantities.map((q) => (
          <label key={q} className="block">
            <span className="text-[11px] text-gray-500 block mb-0.5">{UNITS[q].label}</span>
            <select
              value={sel[q]}
              onChange={(e) => setSel({ ...sel, [q]: Number(e.target.value) })}
              className="w-full h-8 border border-gray-300 rounded px-1.5 text-sm bg-white"
            >
              {UNITS[q].units.map((u, i) => <option key={i} value={i}>{u.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <p className="text-[11px] text-gray-400">
        Units change the display only — the calculation always runs in USA base units. Specific gravities,
        K and plastic viscosity (PV) are dimensionless and shown as entered.
      </p>
    </div>
  );
}

function ExportChoice({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left px-3 py-2 rounded border border-gray-200 hover:border-blue-300 hover:bg-blue-50">
      <div className="text-sm font-medium text-gray-800">{label}</div>
      <div className="text-[11px] text-gray-400">{hint}</div>
    </button>
  );
}

/** Reporting-view tabs (Form44 PageControl1). */
function TabBar({ tab, setTab }: { tab: ReportTab; setTab: (t: ReportTab) => void }) {
  const tabs: { id: ReportTab; label: string }[] = [
    { id: "data", label: "Total data" },
    { id: "pressure", label: "Pressure vs depth" },
    { id: "flow", label: "Flow & kinetic density" },
    { id: "energy", label: "Energy" },
  ];
  return (
    <div className="flex gap-1 border-b border-gray-200 flex-wrap">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-3 py-2 text-sm -mb-px border-b-2 ${
            tab === t.id
              ? "border-blue-600 text-blue-700 font-medium"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** A segmented (radio-style) toggle for picking the charted quantity. */
function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 h-8 text-xs ${
            value === o.v ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Toolbar row above a chart: series toggles + a short caption. */
function ChartControls({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {children}
      <span className="text-[11px] text-gray-400">{note}</span>
    </div>
  );
}

/** Form44 "Energy consumptions" memo: K / Q1 / P1 / P2 (+ shaft power for gas). */
function EnergyPanel({ result, sel }: { result: AirMudResult; sel: UnitSel }) {
  const gas = result.shaftPowerHp != null;
  const pu = unitName("pressure", sel);
  const lines: [string, string][] = [
    ["K", num(result.k, 2)],
    ["Q1", `${num(disp("flow", sel, result.q1, GAS_FLOW_BASE), 2)} ${unitName("flow", sel)}`],
    ["P1", `${num(disp("pressure", sel, result.p1), 2)} ${pu}`],
    ["P2", `${num(disp("pressure", sel, result.p2), 2)} ${pu}`],
  ];
  return (
    <div className="bg-white border border-gray-200 rounded p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-700">Energy consumptions</h3>
      <div className="font-mono text-sm text-gray-800 space-y-1">
        {lines.map(([k, v]) => (
          <div key={k}><span className="text-gray-400">{k} = </span>{v}</div>
        ))}
      </div>
      {gas ? (
        <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-sm font-mono">
          <span className="text-gray-500">SHAFT POWER IS = </span>
          <span className="font-semibold text-blue-800">{num(result.shaftPowerHp as number, 2)} HP</span>
        </div>
      ) : (
        <p className="text-xs text-gray-400">
          Compressor shaft power is reported for dry-gas runs only — the original tool does
          not compute an energy figure for aerated-mud (mist) runs.
        </p>
      )}
    </div>
  );
}

/** Deep-clone a preset so edits never mutate the shared constant. */
function clone(input: AirMudInput): AirMudInput {
  return {
    ...input,
    casing: input.casing.map((c) => ({ ...c })),
    bha: input.bha.map((b) => ({ ...b })),
    nozzles: [...input.nozzles],
  };
}
