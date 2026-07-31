/**
 * Input primitives for the report-entry sheet.
 *
 * They mirror the read-only DR.xls renderer (DrReportForm.tsx) cell for cell —
 * same label-left / value-right rows, same blue section bars — so a company man
 * filling the form sees the sheet they already know, with the cells editable.
 *
 * Every value is `string | number | null`: a blank input means "not recorded"
 * and posts as null, never as 0.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const INPUT =
  "w-full min-w-0 px-1.5 py-0.5 text-[11px] bg-transparent border-0 focus:outline-none focus:bg-blue-50 focus:ring-1 focus:ring-inset focus:ring-blue-400 rounded-sm disabled:text-gray-500";

/** Section bar (gray with a blue accent edge) — the GT() of the read-only form. */
export function Section({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="bg-gray-100 text-gray-700 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200 border-l-2 border-l-blue-600 flex items-center justify-between gap-2">
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
    <div className="flex items-stretch border-b border-gray-100">
      <div className="w-[44%] shrink-0 bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100 flex items-center">{label}</div>
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
export function NumField({ label, value, onChange, disabled, step, unit }: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  disabled?: boolean; step?: string; unit?: string;
}) {
  return (
    <div className="flex items-stretch border-b border-gray-100">
      <div className="w-[44%] shrink-0 bg-gray-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-500 border-r border-gray-100 flex items-center">{label}</div>
      <div className="flex-1 min-w-0 flex items-center">
        <input type="number" step={step ?? "any"} className={`${INPUT} tabular-nums`} disabled={disabled}
          value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
        {unit && <span className="pr-1.5 text-[9px] text-gray-400 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

/** Read-only cell for well-level facts that come from the well record. */
export function StaticField({ label, value }: { label: string; value: unknown }) {
  const text = value == null || value === "" ? "—" : String(value);
  return (
    <div className="flex items-baseline gap-1 px-2 py-1 border-r border-gray-200 min-w-0">
      <span className="text-[9px] uppercase tracking-wide text-gray-500 shrink-0">{label}:</span>
      <span className="text-[11px] font-semibold text-gray-900 truncate" title={text}>{text}</span>
    </div>
  );
}

// ── repeating-row tables (bit runs, BHA, surveys, operations …) ──────────────
export interface Col<T> {
  key: keyof T & string;
  label: string;
  type?: "text" | "num";
  /** Tailwind width class for the column, e.g. "w-24". */
  width?: string;
  title?: string;
}

/**
 * Editable grid for a repeating section. Rows are re-numbered on every change so
 * `order` always matches the on-screen sequence — the API stores and re-serves
 * rows in that order.
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
  const shown = rows.length >= minRows ? rows : [...rows, ...Array.from({ length: minRows - rows.length }, blank)];
  const reindex = (list: T[]) => list.map((r, i) => ({ ...r, order: i }));
  const setCell = (i: number, key: string, value: string | number | null) => {
    const next = shown.slice();
    next[i] = { ...next[i], [key]: value } as T;
    onChange(reindex(next));
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} title={c.title}
                className={`bg-gray-50 border border-gray-200 px-1.5 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-gray-500 ${c.width ?? ""}`}>
                {c.label}
              </th>
            ))}
            {!disabled && <th className="bg-gray-50 border border-gray-200 w-8" />}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c.key} className="border border-gray-200 p-0">
                  {c.type === "num" ? (
                    <input type="number" step="any" disabled={disabled} className={`${INPUT} tabular-nums`}
                      value={(row[c.key] as number | null) ?? ""}
                      onChange={(e) => setCell(i, c.key, e.target.value === "" ? null : Number(e.target.value))} />
                  ) : (
                    <input disabled={disabled} className={INPUT}
                      value={(row[c.key] as string | null) ?? ""}
                      onChange={(e) => setCell(i, c.key, e.target.value || null)} />
                  )}
                </td>
              ))}
              {!disabled && (
                <td className="border border-gray-200 text-center">
                  <button type="button" title="Remove this row" aria-label="Remove this row"
                    onClick={() => onChange(reindex(shown.filter((_, j) => j !== i)))}
                    className="w-6 h-5 text-gray-400 hover:text-red-600 leading-none transition-colors duration-150">×</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" onClick={() => onChange(reindex([...shown, blank()]))}
          className="mt-1 mb-2 ml-1 h-6 px-2 text-[11px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors duration-150">
          + {addLabel ?? "Add row"}
        </button>
      )}
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
          className="h-8 px-2 text-xs border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 w-full min-w-0 disabled:bg-gray-50"
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
          className="h-8 px-1.5 border border-l-0 border-gray-300 rounded-r text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:bg-gray-50 shrink-0 transition-colors duration-150">
          <span className="text-[9px] leading-none">▼</span>
        </button>
      </div>
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-0.5 max-h-56 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg">
          {shown.length === 0 ? (
            <div className="px-2 py-1.5 text-[11px] text-gray-400">
              {options.length ? "No match — what you typed will be saved as a new value." : "No known values yet — type one."}
            </div>
          ) : shown.map((o) => (
            <button key={o} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(o)}
              className={`block w-full text-left px-2 py-1 text-[11px] hover:bg-blue-50 ${o === value ? "bg-blue-50 font-medium" : ""}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
