/**
 * Editable grid cell with proper typing semantics.
 *
 * Why this exists: the previous implementation parsed every keystroke and
 * rejected the change if the partial string didn't parse cleanly (e.g.
 * "1." or "-"). Combined with `value={raw.toFixed(3)}`, the field flipped
 * between the typed value and the formatted display on every render,
 * making editing impossible.
 *
 * Behaviour:
 *   - While focused, the input shows the user's raw string verbatim.
 *   - On blur or Enter, the string is parsed and committed via `onCommit`.
 *     Parse failure → revert to the original display.
 *   - On Escape, revert without committing.
 *   - When NOT focused, the input shows the formatted display value.
 *   - When `readOnly`, the cell renders as gray-tinted plain text.
 */
import { useEffect, useRef, useState } from "react";

export interface NumberCellProps {
  value: number;
  /** How to display the value when not focused. Receives the raw stored number. */
  format: (n: number) => string;
  /** How to convert the user's input string back to the stored form. */
  parse: (s: string) => number | null;
  /** Commit callback — only invoked when parse succeeds AND value actually changed. */
  onCommit: (n: number) => void;
  readOnly?: boolean;
  className?: string;
}

export function NumberCell({
  value, format, parse, onCommit, readOnly, className,
}: NumberCellProps) {
  // Local string state — only synced from `value` when not focused.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => format(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the displayed value in sync with the external `value` when idle.
  useEffect(() => {
    if (!editing) setDraft(format(value));
  }, [value, editing, format]);

  function commit() {
    const parsed = parse(draft);
    if (parsed === null || isNaN(parsed)) {
      // Bad input — revert.
      setDraft(format(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
    setDraft(format(parsed));
  }

  if (readOnly) {
    return (
      <span
        className={`block w-full px-1 py-0.5 text-gray-600 ${className ?? ""}`}
        title="Computed automatically — not editable for this profile type"
      >
        {format(value)}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          inputRef.current?.blur();
        } else if (e.key === "Escape") {
          setDraft(format(value));
          inputRef.current?.blur();
        }
      }}
      className={`bg-yellow-50 focus:bg-yellow-100 ${className ?? ""}`}
    />
  );
}

export interface TextCellProps {
  value: string;
  onCommit: (s: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function TextCell({ value, onCommit, readOnly, className }: TextCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  if (readOnly) {
    return (
      <span className={`block w-full px-1 py-0.5 text-gray-600 ${className ?? ""}`}>
        {value}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`bg-yellow-50 focus:bg-yellow-100 ${className ?? ""}`}
    />
  );
}
