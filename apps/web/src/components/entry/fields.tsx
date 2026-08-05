/**
 * Input primitives for the report-entry sheet.
 *
 * They mirror the read-only DR.xls renderer (DrReportForm.tsx) section for
 * section, so a company man filling the form sees the sheet they already know —
 * but sized for DATA ENTRY rather than for reading, and mobile-first: the office
 * reads this on a desktop, the rig fills it on a phone or a tablet in a doghouse.
 *
 * The sizing rules (ui-ux-pro-max §2 Touch, §5 Responsive):
 *   • inputs are 16px on mobile — anything smaller makes iOS Safari zoom the
 *     page on focus, which is the single most disorienting mobile form bug;
 *   • every control clears the 44×44px touch minimum on mobile, tightening to
 *     the dense desktop rhythm from `sm:` up;
 *   • numeric fields declare inputMode so phones raise the number pad;
 *   • label-above-input on narrow screens, label-beside-input on wide ones — the
 *     fixed 44% label column is unusable at 375px.
 *
 * Every value is `string | number | null`: a blank input means "not recorded"
 * and posts as null, never as 0.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Comfortable on touch (44px, 16px text), dense on desktop. */
const INPUT =
  "w-full min-w-0 bg-transparent border-0 rounded-sm text-base min-h-[44px] px-2 py-2 " +
  "sm:text-[13px] sm:min-h-[32px] sm:px-1.5 sm:py-1 " +
  "focus:outline-none focus:bg-blue-50 focus:ring-1 focus:ring-inset focus:ring-blue-400 " +
  "disabled:text-gray-500 disabled:bg-gray-50/60";

/** Label cell: above the input on phones, beside it from `sm:` up. */
const LABEL =
  "shrink-0 bg-gray-50 text-gray-600 uppercase tracking-wide px-2 pt-1.5 pb-0.5 text-[11px] " +
  "sm:w-[44%] sm:px-1.5 sm:py-0.5 sm:text-[10px] sm:border-r sm:border-gray-100 sm:flex sm:items-center";

const FIELD_ROW = "flex flex-col sm:flex-row sm:items-stretch border-b border-gray-100";

/** True below Tailwind's `sm` breakpoint — used where CSS alone can't switch layout. */
export function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

/** Section bar (gray with a blue accent edge) — the GT() of the read-only form. */
export function Section({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="bg-gray-100 text-gray-700 text-[11px] sm:text-[10px] font-semibold uppercase tracking-wide px-2 sm:px-1.5 py-1.5 sm:py-1 border-y border-gray-200 border-l-2 border-l-blue-600 flex items-center justify-between gap-2 flex-wrap">
      <span>{children}</span>
      {right}
    </div>
  );
}

/** Label / editable value row. */
export function TextField({ label, value, onChange, disabled, placeholder, multiline }: {
  label: string; value: string | null; onChange: (v: string | null) => void;
  disabled?: boolean; placeholder?: string; multiline?: boolean;
}) {
  return (
    <div className={FIELD_ROW}>
      <div className={LABEL}>{label}</div>
      <div className="flex-1 min-w-0">
        {multiline ? (
          <textarea rows={3} className={`${INPUT} resize-y`} disabled={disabled} placeholder={placeholder}
            value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
        ) : (
          <input className={INPUT} disabled={disabled} placeholder={placeholder}
            value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />
        )}
      </div>
    </div>
  );
}

/** Numeric variant — empty stays null instead of collapsing to 0. */
export function NumField({ label, value, onChange, disabled, step, unit, signed }: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  disabled?: boolean; step?: string; unit?: string;
  /** Value can be negative (air temperature, a south/west offset). Same reason as
   *  Col.signed: iOS's decimal pad has no minus key, so it must not be requested. */
  signed?: boolean;
}) {
  return (
    <div className={FIELD_ROW}>
      <div className={LABEL}>{label}</div>
      <div className="flex-1 min-w-0 flex items-center">
        {/* inputMode raises the phone number pad; type=number keeps the desktop spinner. */}
        <input type="number" inputMode={signed ? undefined : "decimal"} step={step ?? "any"} className={`${INPUT} tabular-nums`} disabled={disabled}
          value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
        {unit && <span className="pr-2 sm:pr-1.5 text-[11px] sm:text-[9px] text-gray-500 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

/** Read-only cell for well-level facts that come from the well record. */
export function StaticField({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div className="flex items-baseline gap-1 px-2 py-1.5 sm:py-1 border-r border-b sm:border-b-0 border-gray-200 min-w-0">
      <span className="text-[10px] sm:text-[9px] uppercase tracking-wide text-gray-500 shrink-0">{label}:</span>
      <span className="text-[13px] sm:text-[11px] font-semibold text-gray-900 truncate" title={text}>{text}</span>
    </div>
  );
}

// ── repeating-row tables (bit runs, BHA, surveys, operations …) ──────────────
export interface Col<T> {
  key: keyof T & string;
  label: string;
  /**
   * "int" is a whole-number column backed by an Int database column. It must not
   * accept a decimal: the API validates with `z.number().int()`, so a typed
   * "3.5" rejects the WHOLE sheet save with a 400 that names no field.
   */
  type?: "text" | "num" | "int";
  /**
   * Numeric column whose value can be NEGATIVE (a south/west survey station, a
   * drop-section build rate). iOS's `decimal` pad has no minus key, so signed
   * columns must not declare it — `type=number` alone raises the numbers-and-
   * punctuation keypad, which does.
   */
  signed?: boolean;
  /** Tailwind width class for the column, e.g. "w-24". */
  width?: string;
  title?: string;
}

/**
 * Editable grid for a repeating section.
 *
 * Two layouts over the same data (ui-ux-pro-max: "tables can overflow on
 * mobile — use horizontal scroll or card layout"):
 *   • phones  → one CARD per row, fields stacked label-above-input. The bit-run
 *     section has 23 columns; as a table that is metres of sideways scrolling on
 *     a 375px screen, and you lose the header before you reach the field.
 *   • sm: up  → the dense spreadsheet-style table the office expects.
 *
 * Rows are re-numbered on every change so `order` always matches the on-screen
 * sequence — the API stores and re-serves rows in that order.
 */
export function RowTable<T extends { order?: number }>({ cols, rows, onChange, blank, disabled, addLabel, minRows = 0 }: {
  cols: Col<T>[];
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: () => T;
  disabled?: boolean;
  addLabel?: string;
  /** Keep at least this many rows on screen so the sheet never looks empty. */
  minRows?: number;
}) {
  const narrow = useNarrowScreen();
  const shown = rows.length >= minRows ? rows : [...rows, ...Array.from({ length: minRows - rows.length }, blank)];
  const reindex = (list: T[]) => list.map((r, i) => ({ ...r, order: i }));
  const setCell = (i: number, key: string, value: string | number | null) => {
    const next = shown.slice();
    next[i] = { ...next[i], [key]: value } as T;
    onChange(reindex(next));
  };
  const removeRow = (i: number) => onChange(reindex(shown.filter((_, j) => j !== i)));
  const addRow = () => onChange(reindex([...shown, blank()]));

  const cell = (row: T, i: number, c: Col<T>) =>
    c.type === "int" ? (
      // Whole numbers only — step/inputMode ask the browser and the phone keypad
      // for an integer, and the round() makes it true even when they don't.
      <input type="number" inputMode="numeric" step="1" disabled={disabled} className={`${INPUT} tabular-nums`}
        value={(row[c.key] as number | null) ?? ""}
        onChange={(e) => setCell(i, c.key, e.target.value === "" ? null : Math.round(Number(e.target.value)))} />
    ) : c.type === "num" ? (
      <input type="number" inputMode={c.signed ? undefined : "decimal"} step="any" disabled={disabled} className={`${INPUT} tabular-nums`}
        value={(row[c.key] as number | null) ?? ""}
        onChange={(e) => setCell(i, c.key, e.target.value === "" ? null : Number(e.target.value))} />
    ) : (
      <input disabled={disabled} className={INPUT}
        value={(row[c.key] as string | null) ?? ""}
        onChange={(e) => setCell(i, c.key, e.target.value || null)} />
    );

  const addButton = !disabled && (
    <button type="button" onClick={addRow}
      className="mt-2 mb-2 mx-2 sm:mx-1 min-h-[44px] sm:min-h-[28px] px-3 text-sm sm:text-[11px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
      + {addLabel ?? "Add row"}
    </button>
  );

  // ── phone: a card per row ──
  if (narrow) {
    return (
      <div className="p-2 space-y-2">
        {shown.map((row, i) => (
          <div key={i} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="flex items-center justify-between bg-gray-50 border-b border-gray-200 px-2 py-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                {addLabel ? `${addLabel} ${i + 1}` : `Row ${i + 1}`}
              </span>
              {!disabled && (
                <button type="button" aria-label={`Remove ${addLabel ?? "row"} ${i + 1}`} onClick={() => removeRow(i)}
                  className="min-h-[44px] min-w-[44px] -my-1 text-gray-400 hover:text-red-600 transition-colors duration-150 text-xl leading-none">
                  ×
                </button>
              )}
            </div>
            {cols.map((c) => (
              <div key={c.key} className={FIELD_ROW}>
                <div className={LABEL} title={c.title}>{c.label}</div>
                <div className="flex-1 min-w-0">{cell(row, i, c)}</div>
              </div>
            ))}
          </div>
        ))}
        {addButton}
      </div>
    );
  }

  // ── tablet / desktop: the dense table ──
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-[13px] border-collapse">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} title={c.title}
                className={`bg-gray-50 border border-gray-200 px-1.5 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-gray-600 ${c.width ?? ""}`}>
                {c.label}
              </th>
            ))}
            {!disabled && <th className="bg-gray-50 border border-gray-200 w-10" />}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className="border border-gray-200 p-0">{cell(row, i, c)}</td>
              ))}
              {!disabled && (
                <td className="border border-gray-200 text-center">
                  <button type="button" title="Remove this row" aria-label={`Remove ${addLabel ?? "row"} ${i + 1}`}
                    onClick={() => removeRow(i)}
                    className="w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded leading-none transition-colors duration-150">×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {addButton}
    </div>
  );
}

/**
 * Pick-from-list field that still accepts a new value.
 *
 * The well form's field / location / operation type / profile / reservoir /
 * contractor all have a known set of company values (from the legacy lookup
 * tables plus wells already registered), but a brand-new field or reservoir has
 * to be typeable — so this is a combo box, not a <select>: click to browse the
 * whole list, type to filter it, and anything typed is kept as-is.
 */
export function ComboBox({ value, onChange, options, placeholder, disabled, id }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);   // null = showing `value`
  const wrap = useRef<HTMLDivElement>(null);

  // Close on an outside click (the list is absolutely positioned over the form).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setQuery(null); }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
    return list.slice(0, 200);   // the legacy Location list is 200+ entries long
  }, [options, query]);

  const pick = (v: string) => { onChange(v); setQuery(null); setOpen(false); };

  return (
    <div ref={wrap} className="relative">
      <div className="flex">
        <input
          id={id}
          className="min-h-[44px] sm:min-h-[36px] px-2 text-base sm:text-xs border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0 disabled:bg-gray-50"
          disabled={disabled}
          placeholder={placeholder}
          value={query ?? value}
          onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(null); }
            if (e.key === "Enter" && open) { e.preventDefault(); if (shown.length === 1) pick(shown[0]); else setOpen(false); }
          }}
        />
        <button type="button" tabIndex={-1} disabled={disabled} aria-label="Show known values"
          title={options.length ? `${options.length} known value(s)` : "No known values yet — type one"}
          onClick={() => { setOpen((o) => !o); setQuery(null); }}
          className="min-h-[44px] sm:min-h-[36px] min-w-[44px] sm:min-w-0 px-2 border border-l-0 border-gray-300 rounded-r-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 shrink-0 transition-colors duration-150">
          <span className="text-[10px] leading-none">▼</span>
        </button>
      </div>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-0.5 max-h-64 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg">
          {shown.length === 0 ? (
            <div className="px-2 py-2 text-[13px] text-gray-500">
              {options.length ? "No match — what you typed will be saved as a new value." : "No known values yet — type one."}
            </div>
          ) : shown.map((o) => (
            <button key={o} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}
              className={`block w-full text-left px-2 min-h-[44px] sm:min-h-[30px] py-2 sm:py-1 text-[15px] sm:text-[12px] hover:bg-blue-50 transition-colors duration-100 ${o === value ? "bg-blue-50 font-medium" : ""}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
