/**
 * Air & Gas Drilling — input form.
 *
 * Port of the Delphi data-entry side (old_air_mud_code Form41/Form43 + the
 * BitRun / Casing / DrillString / FixedNozzles MDB tables). Edits one
 * `AirMudInput` bag: the scalar run parameters plus three editable tables
 * (casing program, drill-string / BHA stack, bit nozzles).
 *
 * The component is fully controlled — the page owns the `input` and re-renders
 * on every `onChange`. `AirMudInput` is stored in USA base units; the `sel`
 * unit selection only changes how values are displayed/entered (Form42 cnv[]).
 * Mud fields are dimmed (but editable) when calcType === "gas".
 */
import type { AirMudInput, BhaComp, CalcType, CasingSeg } from "@dd/shared/air-mud";
import {
  type Quantity, type UnitSel,
  unitName, disp, toBase, sig, GAS_FLOW_BASE, dispGeotherm, toBaseGeotherm, geothermUnit,
} from "../../units/airmudUnits.js";

/** One scalar parameter's display metadata. */
interface FieldSpec {
  key: keyof AirMudInput;
  label: string;
  /** Fixed unit label for dimensionless / non-converted fields. */
  unit: string;
  step?: number;
  hint?: string;
  /** Convertible quantity class; when set, `unit` is replaced by the live unit. */
  q?: Quantity;
  /** Gas rate — stored in scf/min (ft³/min slot of the flow class). */
  gasFlow?: boolean;
  /** Rate of penetration (length / hr). */
  rop?: boolean;
  /** Geothermal gradient (temp / length). */
  geo?: boolean;
  /** Only relevant to the aerated (mist) branch — dimmed for dry gas. */
  mudOnly?: boolean;
}

const GAS_FIELDS: FieldSpec[] = [
  { key: "surfFlow", label: "Surface gas rate", unit: "scf/min", step: 1, hint: "QAT — air injected at the surface", q: "flow", gasFlow: true },
  { key: "surfTemp", label: "Surface temp", unit: "°R", step: 0.1, hint: "TAT — absolute (°F + 459.67)", q: "temp" },
  { key: "gasSg", label: "Gas sp. gravity", unit: "air=1", step: 0.01, hint: "GSG" },
  { key: "moleWt", label: "Gas mol. weight", unit: "lb/lbmol", step: 0.01, hint: "air = 28.97" },
  { key: "heatC", label: "Ratio sp. heats K", unit: "—", step: 0.01, hint: "nozzle expansion exponent" },
];
const SOLID_FIELDS: FieldSpec[] = [
  { key: "solidSg", label: "Cuttings sp. gravity", unit: "—", step: 0.01, hint: "SSG" },
  { key: "rop", label: "Rate of penetration", unit: "ft/hr", step: 1, hint: "ROP", rop: true },
];
const GEO_FIELDS: FieldSpec[] = [
  { key: "tvdOut", label: "Drilling depth (TD)", unit: "ft", step: 1, hint: "total measured depth being drilled", q: "length" },
  { key: "elevation", label: "Surface elevation", unit: "ft", step: 1, hint: "sets atmospheric pressure", q: "length" },
  { key: "geotherm", label: "Geothermal grad.", unit: "°R/ft", step: 0.001, hint: "TGRD", geo: true },
  { key: "bitSize", label: "Bit diameter", unit: "in", step: 0.001, hint: "open-hole size below the shoe", q: "diameter" },
  { key: "ohRough", label: "Open-hole roughness", unit: "ft", step: 0.0001, q: "length" },
  { key: "dpRough", label: "Pipe/casing roughness", unit: "ft", step: 0.00001, q: "length" },
];
const MUD_FIELDS: FieldSpec[] = [
  { key: "mudFlow", label: "Mud rate", unit: "gpm", step: 1, hint: "QM — liquid injected (aerated only)", q: "flow", mudOnly: true },
  { key: "mudWt", label: "Mud weight", unit: "ppg", step: 0.1, q: "density", mudOnly: true },
  { key: "mudVis", label: "Plastic viscosity", unit: "PV", step: 1, mudOnly: true },
];

/** Display value + unit label for a scalar field, in the current unit system. */
function fieldView(f: FieldSpec, sel: UnitSel, base: number): { value: number; unit: string } {
  if (f.geo) return { value: sig(dispGeotherm(sel, base)), unit: geothermUnit(sel) };
  if (f.rop) return { value: sig(disp("length", sel, base)), unit: `${unitName("length", sel)}/hr` };
  if (f.q) return { value: sig(disp(f.q, sel, base, f.gasFlow ? GAS_FLOW_BASE : 0)), unit: unitName(f.q, sel) };
  return { value: base, unit: f.unit };
}
/** Convert an entered display value back to the stored base unit. */
function fieldToBase(f: FieldSpec, sel: UnitSel, entered: number): number {
  if (f.geo) return toBaseGeotherm(sel, entered);
  if (f.rop) return toBase("length", sel, entered);
  if (f.q) return toBase(f.q, sel, entered, f.gasFlow ? GAS_FLOW_BASE : 0);
  return entered;
}

interface Props {
  input: AirMudInput;
  onChange: (next: AirMudInput) => void;
  /** Active display-unit selection. */
  sel: UnitSel;
  disabled?: boolean;
}

export function AirMudForm({ input, onChange, sel, disabled }: Props) {
  const set = (patch: Partial<AirMudInput>) => onChange({ ...input, ...patch });
  const gasMode = input.calcType === "gas";

  return (
    <div className="space-y-5">
      {/* Fluid model toggle */}
      <section>
        <SectionTitle>Fluid model</SectionTitle>
        <div className="flex gap-2">
          {(["gas", "aerated"] as CalcType[]).map((c) => (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => set({ calcType: c })}
              className={`flex-1 px-3 py-2 rounded-md text-sm border transition-colors ${
                input.calcType === c
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              } disabled:opacity-50`}
            >
              {c === "gas" ? "Dry gas" : "Aerated mud (mist)"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-1">
          {gasMode
            ? "Closed-form compressible march — no liquid phase."
            : "Gas + liquid mist; Simpson + bisection integrals. Mud fields apply."}
        </p>
      </section>

      {/* Scalar inputs */}
      <FieldGrid title="Gas & formation" fields={GAS_FIELDS} input={input} set={set} sel={sel} disabled={disabled} gasMode={gasMode} />
      <FieldGrid title="Cuttings & ROP" fields={SOLID_FIELDS} input={input} set={set} sel={sel} disabled={disabled} gasMode={gasMode} />
      <FieldGrid title="Well geometry & environment" fields={GEO_FIELDS} input={input} set={set} sel={sel} disabled={disabled} gasMode={gasMode} />
      <FieldGrid title="Liquid mud (aerated only)" fields={MUD_FIELDS} input={input} set={set} sel={sel} disabled={disabled} gasMode={gasMode} />

      <CasingTable input={input} set={set} sel={sel} disabled={disabled} />
      <BhaTable input={input} set={set} sel={sel} disabled={disabled} />
      <NozzleEditor input={input} set={set} sel={sel} disabled={disabled} />
    </div>
  );
}

function FieldGrid({
  title, fields, input, set, sel, disabled, gasMode,
}: {
  title: string;
  fields: FieldSpec[];
  input: AirMudInput;
  set: (p: Partial<AirMudInput>) => void;
  sel: UnitSel;
  disabled?: boolean;
  gasMode: boolean;
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {fields.map((f) => {
          const dim = f.mudOnly && gasMode;
          const v = fieldView(f, sel, Number(input[f.key]));
          return (
            <label key={String(f.key)} className="block" title={f.hint}>
              <span className={`text-[11px] block mb-0.5 truncate ${dim ? "text-gray-300" : "text-gray-500"}`}>
                {f.label} <span className="text-gray-400">({v.unit})</span>
              </span>
              <input
                type="number"
                step={f.step ?? "any"}
                value={v.value}
                disabled={disabled}
                onChange={(e) => set({ [f.key]: fieldToBase(f, sel, Number(e.target.value)) } as Partial<AirMudInput>)}
                className={`w-full border rounded px-2 py-1 text-right text-sm tabular-nums ${
                  dim ? "border-gray-200 text-gray-400 bg-gray-50" : "border-gray-300"
                } disabled:bg-gray-100`}
              />
            </label>
          );
        })}
      </div>
    </section>
  );
}

function CasingTable({
  input, set, sel, disabled,
}: { input: AirMudInput; set: (p: Partial<AirMudInput>) => void; sel: UnitSel; disabled?: boolean }) {
  const rows = input.casing;
  const update = (i: number, patch: Partial<CasingSeg>) =>
    set({ casing: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const add = () => {
    const last = rows[rows.length - 1];
    set({ casing: [...rows, { id: last?.id ?? 8.01, dTop: last?.dBtm ?? 0, dBtm: (last?.dBtm ?? 0) + 1000 }] });
  };
  const remove = (i: number) => set({ casing: rows.filter((_, j) => j !== i) });

  return (
    <section>
      <SectionTitle action={<AddButton onClick={add} disabled={disabled} label="Add casing" />}>
        Casing program
      </SectionTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-gray-400 text-right">
            <th className="font-normal text-left pl-1">ID ({unitName("diameter", sel)})</th>
            <th className="font-normal">Top ({unitName("length", sel)})</th>
            <th className="font-normal">Btm ({unitName("length", sel)})</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><CellInput value={sig(disp("diameter", sel, r.id))} step={0.001} disabled={disabled} onChange={(v) => update(i, { id: toBase("diameter", sel, v) })} /></Td>
              <Td><CellInput value={sig(disp("length", sel, r.dTop))} step={1} disabled={disabled} onChange={(v) => update(i, { dTop: toBase("length", sel, v) })} /></Td>
              <Td><CellInput value={sig(disp("length", sel, r.dBtm))} step={1} disabled={disabled} onChange={(v) => update(i, { dBtm: toBase("length", sel, v) })} /></Td>
              <td className="text-center">
                <RemoveButton onClick={() => remove(i)} disabled={disabled || rows.length <= 1} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function BhaTable({
  input, set, sel, disabled,
}: { input: AirMudInput; set: (p: Partial<AirMudInput>) => void; sel: UnitSel; disabled?: boolean }) {
  const rows = input.bha;
  const update = (i: number, patch: Partial<BhaComp>) =>
    set({ bha: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const add = () =>
    set({ bha: [...rows, { size: 4.5, id: 3.82, length: 1000, type: "DRILL PIPE" }] });
  const remove = (i: number) => set({ bha: rows.filter((_, j) => j !== i) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    set({ bha: next });
  };
  const total = rows.reduce((s, r) => s + (Number(r.length) || 0), 0);

  return (
    <section>
      <SectionTitle action={<AddButton onClick={add} disabled={disabled} label="Add component" />}>
        Drill string / BHA <span className="text-gray-400 font-normal">(top → bottom)</span>
      </SectionTitle>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-gray-400 text-right">
            <th className="font-normal text-left pl-1">OD ({unitName("diameter", sel)})</th>
            <th className="font-normal">Bore ({unitName("diameter", sel)})</th>
            <th className="font-normal">Length ({unitName("length", sel)})</th>
            <th className="font-normal text-left pl-2">Type</th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td><CellInput value={sig(disp("diameter", sel, r.size))} step={0.01} disabled={disabled} onChange={(v) => update(i, { size: toBase("diameter", sel, v) })} /></Td>
              <Td><CellInput value={sig(disp("diameter", sel, r.id))} step={0.01} disabled={disabled} onChange={(v) => update(i, { id: toBase("diameter", sel, v) })} /></Td>
              <Td><CellInput value={sig(disp("length", sel, r.length))} step={1} disabled={disabled} onChange={(v) => update(i, { length: toBase("length", sel, v) })} /></Td>
              <td className="pl-2">
                <input
                  type="text"
                  value={r.type ?? ""}
                  disabled={disabled}
                  onChange={(e) => update(i, { type: e.target.value })}
                  className="w-full border border-gray-300 rounded px-1.5 py-1 text-xs disabled:bg-gray-100"
                />
              </td>
              <td className="whitespace-nowrap text-center">
                <IconBtn onClick={() => move(i, -1)} disabled={disabled || i === 0} title="Move up">▲</IconBtn>
                <IconBtn onClick={() => move(i, 1)} disabled={disabled || i === rows.length - 1} title="Move down">▼</IconBtn>
                <RemoveButton onClick={() => remove(i)} disabled={disabled || rows.length <= 1} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[11px] text-gray-400 mt-1 text-right">
        Total length {sig(disp("length", sel, total)).toLocaleString()} {unitName("length", sel)}
        {Math.abs(total - input.tvdOut) > 1 && (
          <span className="text-amber-600"> · ≠ TD {sig(disp("length", sel, input.tvdOut)).toLocaleString()} {unitName("length", sel)}</span>
        )}
      </p>
    </section>
  );
}

function NozzleEditor({
  input, set, sel, disabled,
}: { input: AirMudInput; set: (p: Partial<AirMudInput>) => void; sel: UnitSel; disabled?: boolean }) {
  const jets = input.nozzles;
  const update = (i: number, v: number) => set({ nozzles: jets.map((j, k) => (k === i ? v : j)) });
  const add = () => { if (jets.length < 15) set({ nozzles: [...jets, jets[jets.length - 1] ?? 11] }); };
  const remove = (i: number) => set({ nozzles: jets.filter((_, k) => k !== i) });

  return (
    <section>
      <SectionTitle action={<AddButton onClick={add} disabled={disabled || jets.length >= 15} label="Add jet" />}>
        Bit nozzles <span className="text-gray-400 font-normal">({unitName("nozzle", sel)})</span>
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        {jets.map((j, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              type="number"
              step={0.1}
              value={sig(disp("nozzle", sel, j))}
              disabled={disabled}
              onChange={(e) => update(i, toBase("nozzle", sel, Number(e.target.value)))}
              className="w-16 border border-gray-300 rounded px-1.5 py-1 text-right text-sm tabular-nums disabled:bg-gray-100"
            />
            <RemoveButton onClick={() => remove(i)} disabled={disabled || jets.length <= 1} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────── small shared bits ───────────────────────────

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h4>
      {action}
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="py-0.5">{children}</td>;
}

function CellInput({
  value, onChange, step, disabled,
}: { value: number; onChange: (v: number) => void; step?: number; disabled?: boolean }) {
  return (
    <input
      type="number"
      step={step ?? "any"}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded px-1.5 py-1 text-right text-sm tabular-nums disabled:bg-gray-100"
    />
  );
}

function AddButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-40"
    >
      + {label}
    </button>
  );
}

function RemoveButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Remove"
      className="w-5 h-5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 leading-none"
    >
      ×
    </button>
  );
}

function IconBtn({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-5 h-5 rounded text-gray-400 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-30 text-[10px] leading-none"
    >
      {children}
    </button>
  );
}
