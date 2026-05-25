/**
 * useHistoryState — useState with bounded undo/redo history.
 *
 * Replaces ad-hoc patterns and gives the survey grid Excel-style undo/redo.
 * Keeps up to `limit` past states (default 50). Pushing a new state truncates
 * the redo stack (standard linear undo).
 *
 * The setter accepts either a new value OR an updater fn (like useState), so
 * existing call sites can swap useState → useHistoryState without changes.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export interface HistoryControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /** Discard the entire history, replacing it with `value`. */
  reset: (value: unknown) => void;
}

export function useHistoryState<T>(
  initial: T,
  limit = 50
): [T, (next: T | ((prev: T) => T)) => void, HistoryControls] {
  const [value, setValue] = useState<T>(initial);
  // past/future are stacks. past[past.length-1] is the most recent prior state.
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, forceRerender] = useState(0);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        // No-op if reference-equal; avoid polluting history with redundant entries.
        if (resolved === prev) return prev;
        past.current.push(prev);
        if (past.current.length > limit) past.current.shift();
        future.current = [];
        return resolved;
      });
    },
    [limit]
  );

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    setValue((curr) => {
      const prev = past.current.pop()!;
      future.current.push(curr);
      return prev;
    });
    forceRerender((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    setValue((curr) => {
      const next = future.current.pop()!;
      past.current.push(curr);
      return next;
    });
    forceRerender((n) => n + 1);
  }, []);

  const reset = useCallback((nextValue: unknown) => {
    past.current = [];
    future.current = [];
    setValue(nextValue as T);
  }, []);

  const controls: HistoryControls = {
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undo,
    redo,
    reset,
  };

  return [value, update, controls];
}

/**
 * Wire global Ctrl+Z / Ctrl+Shift+Z (and Cmd-equivalents) to a history's
 * undo/redo. Skipped while the user is typing into an input/textarea so
 * native browser undo still works there.
 */
export function useUndoRedoHotkeys(controls: HistoryControls) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      ) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        controls.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        controls.redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controls]);
}
