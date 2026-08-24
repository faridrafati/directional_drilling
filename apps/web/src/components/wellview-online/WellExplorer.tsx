/**
 * The Well Explorer — WellView's opening window, as a web page (manual ch. 3).
 *
 * Left side: well folders — Recently Opened Wells (last 20, kept automatically),
 * My Wells (the user's shortcuts, up to 100), All Wells, the group folders made
 * by "Group by Properties" (each level ascending or descending),
 * and Quick Query (§3.3): pick a well-header field, type a full or partial
 * value, refresh.
 *
 * Right side: the well list. Default columns are Well Name and API/UWI as in
 * the manual; "Well List Properties" changes the displayed columns and their
 * order. Click a heading to sort (again to reverse). Ctrl/Shift select works
 * as in any list; Copy Well List puts the visible columns on the clipboard,
 * tab-separated, headings included — pasteable straight into Excel.
 *
 * Folder shortcuts, groups and column choices persist per database in
 * localStorage — the manual's "per user, per machine" behaviour, literally.
 *
 * Measured columns are shown in the user's unit set, the heading names that
 * unit, and Copy Well List carries the SAME numbers the screen does — 28 of the
 * 120 well-header fields have a unit, and printing stored metres under a
 * heading that says feet put them on someone's clipboard that way too.
 *
 * The datum shift is wired the same way and is, today, unreachable: all four
 * datum-bearing header fields (TDCalc, TDAllCalc, PBTDAllCalc, TDTVDAllCalc)
 * are model-CALCULATED, so they have no stored column and cannot be chosen as
 * a list column at all. It is kept because it is the correct shape for when
 * calculated header fields are computed, and because this is the one grid whose
 * rows are different WELLS — the offset is per row, not per screen, which is
 * why each well's elevations come down with the list rather than being fetched
 * once. Nothing in the sample exercises it yet; do not read a passing well list
 * as evidence that it works.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QueryBuilder } from "./QueryBuilder.js";
import { useQuery } from "@tanstack/react-query";
import { wvDbApi, type WvHeaderColumn, type WvQuery, type WvQueryResult , type WvSavedQuery } from "../../entry/wellviewDb.js";
import { useUnitSet } from "../../entry/unitSet.js";
import { useDatum } from "../../entry/datum.js";
import { toDisplay, formatUnitValue, displayUnitFor, datumShift } from "@dd/shared";

type WellRow = Record<string, string | number | null>;

interface Props {
  db: string;
  /** Open a well (double-click or Open button) into the Reports/Schematic window. */
  onOpen: (idwell: string) => void;
  /** Open the Edit Data window on a well. */
  onEdit: (idwell: string) => void;
  /** Run a WellView multi-well report over the selected wells. */
  onMultiReport: (idwells: string[]) => void;
  /** Run the Data Auditor over the selected wells. */
  onAudit: (idwells: string[]) => void;
  /** Back to the Open Database window. */
  onChangeDatabase: () => void;
}

/*
 * THE GUIDE'S OWN LIMITS, which this file had set lower.
 *
 * "The My Wells, My Sites, and My Rigs folder can contain up to 1,000 items"
 * and "The Recently Opened Wells folder lists the last 50 wells you opened" —
 * both from WellView 9.0's own help. These were 100 and 20, and the My Wells
 * one truncated silently, so adding the 101st well removed the first without
 * saying so. Both lists are arrays of GUIDs in localStorage; the lower numbers
 * bought nothing.
 */
const MY_WELLS_CAP = 1000;
const RECENT_CAP = 50;

/**
 * How deep Group by Properties goes.
 *
 * 9.0's Explorer Enhancements topic lists "The Group By hierarchy can be more
 * than four levels" among the version's new additions, so four is the OLD
 * limit. Eight is this app's choice of "more than four" — a hierarchy deeper
 * than that groups wells into leaves of one, and the dialog has to fit on a
 * screen. Stated here rather than left as a bare number.
 */
const GROUP_LEVELS = 8;

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch { return fallback; }
  },
  set(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/blocked */ }
  },
};

type Folder =
  | { kind: "recent" }
  | { kind: "my" }
  | { kind: "all" }
  | { kind: "query" }
  | { kind: "template"; queryId: string }   // a saved Query Template (§8.1)
  | { kind: "group"; path: (string | null)[] };   // value per group level, null = any

interface GroupSpec { column: string; desc: boolean }

export function WellExplorer({ db, onOpen, onEdit, onAudit, onMultiReport, onChangeDatabase }: Props) {
  const K = (s: string) => `wv.online.${db}.${s}`;

  const [unitSet] = useUnitSet();
  const [datum] = useDatum();

  const [folder, setFolder] = useState<Folder>({ kind: "all" });
  const [cols, setCols] = useState<string[]>(() => store.get(K("cols"), ["WellName", "WellIDA"]));
  const [myWells, setMyWells] = useState<string[]>(() => store.get(K("my"), []));
  const [recent, setRecent] = useState<string[]>(() => store.get(K("recent"), []));
  const [groups, setGroups] = useState<GroupSpec[]>(() => store.get(K("groups"), []));
  /** §3.2 "Show wells in lowest group only" — only leaf folders list wells. */
  const [lowestOnly, setLowestOnly] = useState<boolean>(() => store.get(K("groupsLowest"), false));
  const [sort, setSort] = useState<{ column: string; desc: boolean } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const queryClient = useQueryClient();
  /** §8.1: writing a query, not just running the 29 shipped ones. */
  const [building, setBuilding] = useState<{ editing: WvSavedQuery | null } | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);
  const [transfer, setTransfer] = useState<string | null>(null);

  /** Export: the payload is large, so it is streamed to a file, not held. */
  /**
   * Export the wells that are selected, not just the first one.
   *
   * The guide's Exporting Well Files describes choosing a group, and this screen
   * says "· N selected" in its header while exporting one — so the count on
   * screen and the file that arrived disagreed, with nothing to say which was
   * right.
   *
   * One file per well, because that is what Import Well reads: the payload is a
   * single well's records, and a combined document would import as nothing.
   *
   * THE COUNT IS WELLS FETCHED, NOT FILES SAVED, and the wording says so. An
   * earlier version of this comment claimed the count would come out lower if a
   * browser blocked the downloads — it will not. A blocked `a.click()` neither
   * throws nor rejects, so the loop completes either way and only the user's
   * downloads folder knows the difference. Since the app cannot tell, it does
   * not say; forty wells asks first instead.
   */
  const exportWells = async (idwells: string[]) => {
    if (!idwells.length) return;
    // Browsers throttle or silently block a run of programmatic downloads, and
    // the app cannot detect it — so ask before starting one, rather than
    // reporting a success it cannot verify.
    if (idwells.length > 5 && !window.confirm(
      `This saves ${idwells.length} separate files, one per well. `
      + "Your browser may ask to allow multiple downloads. Continue?")) return;
    setTransfer(idwells.length > 1 ? `Exporting ${idwells.length} wells…` : "Exporting…");
    let done = 0;
    try {
      for (const idwell of idwells) {
        const blob = await wvDbApi.exportWell(db, idwell);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        /*
         * NAMED BY THE WELL, not by its key.
         *
         * The server already builds a proper name into Content-Disposition —
         * and it can never apply, because the body is fetched as a blob and
         * saved through an anchor, which takes its filename from `download`
         * alone. So forty exported wells arrived as forty 32-character hex
         * GUIDs, indistinguishable without opening them. The list on screen
         * knows every well's name; it just was not asked.
         *
         * The key stays on the end as a short suffix: two wells can share a
         * name, and a file that silently overwrote another would be worse than
         * an ugly one. MultiReports.tsx already names its CSV this way.
         */
        const well = allWells.find((w) => idOf(w) === idwell);
        const label = (well ? nameOf(well) : idwell).trim() || idwell;
        const safe = label.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
        a.download = `${safe || "well"}_${idwell.slice(0, 8)}.wellview.json`;
        a.click();
        URL.revokeObjectURL(url);
        done++;
      }
      setTransfer(done === 1 ? "Exported."
        : `Exported ${done} wells — ${done} files, if your browser allowed them all.`);
    } catch (e) {
      // Say how far it got. "Failed" after eight of ten files have landed in the
      // downloads folder is a worse answer than the count.
      setTransfer(`${(e as Error).message}${done ? ` — ${done} exported before it stopped.` : ""}`);
    }
  };

  /** Import: checked before anything is written, and refused if the well is
   *  already here — IDRecs are preserved, so a merge would duplicate records. */
  const importWell = async (file: File) => {
    setTransfer("Reading…");
    try {
      const payload = JSON.parse(await file.text());
      const pre = await wvDbApi.importPreflight(db, payload);
      if (!pre.ok) { setTransfer(`Not imported — ${pre.reason}`); return; }
      const res = await wvDbApi.importWell(db, payload);
      const notes = [
        `Imported ${res.wellName ?? res.idwell}: ${res.inserted.rows} rows across ${res.inserted.tables} tables.`,
        res.missingTables.length ? `${res.missingTables.length} table(s) not in this database.` : "",
        res.missingColumns.length ? `${res.missingColumns.length} column(s) not in this database.` : "",
      ].filter(Boolean);
      setTransfer(notes.join(" "));
      await queryClient.invalidateQueries({ queryKey: ["wvdb", db] });
    } catch (e) {
      setTransfer((e as Error).message);
    }
  };
  const lastClick = useRef<number | null>(null);
  const [showListProps, setShowListProps] = useState(false);
  const [showGroupDlg, setShowGroupDlg] = useState(false);
  const [copied, setCopied] = useState(false);

  /** The saved Query Templates (§8.1), and the values a prompting one needs. */
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [ranQuery, setRanQuery] = useState<{ id: string; values: Record<string, string> } | null>(null);

  // Quick Query state — applied on Refresh, like the desktop app.
  const [lookIn, setLookIn] = useState("WellName");
  const [lookFor, setLookFor] = useState("");
  const [applied, setApplied] = useState<{ lookin: string; lookfor: string } | null>(null);

  useEffect(() => { store.set(K("cols"), cols); }, [cols]);       // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("my"), myWells); }, [myWells]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("recent"), recent); }, [recent]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("groups"), groups); }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { store.set(K("groupsLowest"), lowestOnly); }, [lowestOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  /** §3.3: the Look-for lookup — values already stored in the chosen field. */
  const lookValuesQ = useQuery({
    queryKey: ["wvdb", db, "header-values", lookIn],
    queryFn: () => wvDbApi.headerValues(db, lookIn),
    enabled: folder.kind === "query",
    staleTime: 60_000,
  });

  const templatesQ = useQuery({
    queryKey: ["wvdb", db, "queries"],
    queryFn: () => wvDbApi.queries(db),
    staleTime: Infinity,
  });

  /** Query templates this user wrote, kept in the app's own database. */
  const savedQ = useQuery({
    queryKey: ["wvdb", db, "saved-queries"],
    queryFn: () => wvDbApi.savedQueries(db),
  });
  /** Runs only once the user asks — a template with prompts needs them first. */
  const templateRunQ = useQuery({
    queryKey: ["wvdb", db, "query-run", ranQuery?.id, JSON.stringify(ranQuery?.values ?? {})],
    queryFn: () => wvDbApi.runQuery(db, ranQuery!.id, ranQuery!.values),
    enabled: !!ranQuery,
  });

  const headerColsQ = useQuery({
    queryKey: ["wvdb", db, "header-columns"],
    queryFn: () => wvDbApi.headerColumns(db),
    staleTime: Infinity,
  });

  // Group columns must be fetched even when not displayed.
  const fetchCols = useMemo(() => {
    const set = new Set(cols);
    for (const g of groups) set.add(g.column);
    return [...set];
  }, [cols, groups]);

  const wellsQ = useQuery({
    queryKey: ["wvdb", db, "wells", fetchCols.join(","), applied?.lookin ?? "", applied?.lookfor ?? ""],
    queryFn: () => wvDbApi.wells(db, {
      cols: fetchCols,
      ...(folder.kind === "query" && applied ? { lookin: applied.lookin, lookfor: applied.lookfor } : {}),
    }),
  });

  const allWells = useMemo(() => wellsQ.data?.wells ?? [], [wellsQ.data]);
  const columns: WvHeaderColumn[] = (wellsQ.data?.columns ?? []).filter((c) => cols.includes(c.column));

  /**
   * One cell, in the user's unit set and from the chosen reference datum.
   *
   * The datum offset is looked up per ROW: every row here is a different well
   * with its own KB, so there is no single shift for the grid. A well whose
   * elevations cannot resolve the chosen datum keeps its stored value rather
   * than being shifted by someone else's rig height.
   */
  const unitLabel = (c: WvHeaderColumn): string =>
    (c.unit ? displayUnitFor({ unit: c.unit, units: c.units }, unitSet)?.unit ?? c.unit : "");

  const cell = (w: WellRow, c: WvHeaderColumn): string => {
    const v = w[c.column];
    if (v == null || v === "") return "";
    if (!c.unit) return String(v);
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    const elev = wellsQ.data?.elevations?.[String(w.idwell ?? "")];
    const shift = c.applyDatum && elev ? datumShift(elev, datum) : null;
    const d = toDisplay(n,
      { unit: c.unit, units: c.units, applyDatum: c.applyDatum, datumMode: c.datumMode },
      unitSet, shift && shift.resolved ? shift : null);
    return d ? formatUnitValue(d.value, d) : String(v);
  };

  /** The rows the active folder shows, before sorting. */
  const folderRows: WellRow[] = useMemo(() => {
    const byId = new Map(allWells.map((w) => [String(w.idwell), w]));
    switch (folder.kind) {
      case "recent":
        return recent.map((id) => byId.get(id)).filter((w): w is WellRow => !!w);
      case "my":
        return myWells.map((id) => byId.get(id)).filter((w): w is WellRow => !!w);
      case "group": {
        return allWells.filter((w) =>
          folder.path.every((v, i) => v === null || String(w[groups[i]?.column] ?? "—") === v));
      }
      case "template": {
        const hits = templateRunQ.data?.wells;
        if (!hits) return [];
        const order = new Map(hits.map((h, i) => [h.idwell, i]));
        return allWells.filter((w) => order.has(String(w.idwell)))
          .sort((a, b) => order.get(String(a.idwell))! - order.get(String(b.idwell))!);
      }
      default:
        return allWells;
    }
  }, [folder, allWells, recent, myWells, groups, templateRunQ.data]);

  const rows = useMemo(() => {
    if (!sort) return folderRows;
    const dir = sort.desc ? -1 : 1;
    return [...folderRows].sort((a, b) => {
      const av = a[sort.column], bv = b[sort.column];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [folderRows, sort]);

  /** Group-folder tree values, computed from the data itself. */
  const groupTree = useMemo(() => {
    if (!groups.length) return null;
    type GNode = { value: string; path: (string | null)[]; count: number; children: GNode[] };
    const build = (wells: WellRow[], level: number, path: (string | null)[]): GNode[] => {
      if (level >= groups.length) return [];
      const g = groups[level];
      const byValue = new Map<string, WellRow[]>();
      for (const w of wells) {
        const v = String(w[g.column] ?? "—");
        (byValue.get(v) ?? byValue.set(v, []).get(v)!).push(w);
      }
      const entries = [...byValue.entries()].sort(([a], [b]) => a.localeCompare(b) * (g.desc ? -1 : 1));
      return entries.map(([value, ws]) => {
        const p = [...path, value];
        return { value, path: p, count: ws.length, children: build(ws, level + 1, p) };
      });
    };
    return build(allWells, 0, []);
  }, [groups, allWells]);

  const idOf = (w: WellRow) => String(w.idwell);
  const nameOf = (w: WellRow) => String(w.WellName ?? w.idwell);

  function clickRow(w: WellRow, e: React.MouseEvent, index: number) {
    const id = idOf(w);
    if (e.shiftKey && lastClick.current !== null) {
      const [a, b] = [lastClick.current, index].sort((x, y) => x - y);
      setSelected(rows.slice(a, b + 1).map(idOf));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
      lastClick.current = index;
    } else {
      setSelected([id]);
      lastClick.current = index;
    }
  }

  function openWell(id: string) {
    // "The Recently Opened Wells folder lists the last 50 wells you opened in
    // WellView" — the guide's own number, where this kept 20.
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, RECENT_CAP));
    onOpen(id);
  }

  /**
   * Ch. 4 "Create a New Well": the header record IS the well, so one insert
   * with a name mints the idwell; Edit Data then opens on it so the header
   * and wellbore details can be entered top-down, as the manual teaches.
   */
  async function newWell() {
    const name = window.prompt("Name for the new well (Well Header → Well Name):");
    if (!name?.trim()) return;
    const res = await wvDbApi.insert(db, "wvWellHeader", { values: { WellName: name.trim() } });
    await wellsQ.refetch();
    if (res.idwell) onEdit(res.idwell);
  }

  /**
   * The manual's warning made real: Delete removes the ENTIRE well from the
   * database — every table's rows — not just a shortcut. Hence the name check.
   */
  async function deleteWells(ids: string[]) {
    if (!ids.length) return;
    const names = ids.map((id) => nameOf(allWells.find((w) => idOf(w) === id) ?? { idwell: id }));

    /*
     * The confirmation is deliberately different for one well and for several,
     * and both are deliberately awkward.
     *
     * This button lives in the SELECTION bar, beside "Add to My Wells", which
     * acts on every selected well — so acting on only the first was the kind of
     * inconsistency a user discovers by losing something. But delete here means
     * every record in every folder of every well named, and this app has no
     * undo, so the guard scales with the blast radius: one well still asks for
     * its name typed exactly, and several ask for the count, after listing them.
     */
    if (ids.length === 1) {
      const typed = window.prompt(
        `This deletes "${names[0]}" from the database — every record in every folder, `
        + "not just a link. Type the well name to confirm:");
      if (typed?.trim() !== names[0]) return;
    } else {
      const shown = names.slice(0, 10).map((n) => `  • ${n}`).join("\n")
        + (names.length > 10 ? `\n  • …and ${names.length - 10} more` : "");
      const typed = window.prompt(
        `This deletes ${ids.length} wells from the database — every record in every `
        + `folder of each, not just a link. This cannot be undone.\n\n${shown}\n\n`
        + `Type "delete ${ids.length} wells" to confirm:`);
      // A phrase, not the number that is printed two lines above it. The
      // single-well branch asks for the well's name typed exactly; the branch
      // that removes forty must not be the easier one to get through.
      if (typed?.trim().toLowerCase() !== `delete ${ids.length} wells`) return;
    }

    let done = 0;
    let failure: string | null = null;
    try {
      for (const id of ids) { await wvDbApi.deleteWell(db, id); done++; }
    } catch (e) {
      // Without this the rejection escapes `void deleteWells(...)` and nothing
      // reaches the screen at all — and the status line below used to be gated
      // on a multi-well selection, so a single failed delete said nothing
      // whatsoever. A delete that did not happen must never look like one that
      // did.
      failure = (e as Error).message;
    } finally {
      // Whatever happened, the screen must reflect what is actually gone.
      const gone = new Set(ids.slice(0, done));
      setSelected([]);
      setMyWells((m) => m.filter((x) => !gone.has(x)));
      setRecent((r) => r.filter((x) => !gone.has(x)));
      await wellsQ.refetch();
      setTransfer(failure
        ? `Delete stopped after ${done} of ${ids.length}: ${failure}`
        : ids.length > 1 ? `Deleted ${ids.length} wells.` : "Well deleted.");
    }
  }

  /**
   * The wells Copy Well List copies: the highlighted ones, or all of them.
   *
   * The guide: "To copy well list information just for wells that are
   * highlighted, select the wells and press Ctrl+C."
   *
   * This mapped `rows` — the whole folder — and never looked at the selection,
   * while the footer of this very screen read "Data Audit and Copy Well List use
   * the selection". Data Audit genuinely did. A screen stating a behaviour the
   * code does not have is worse than a missing feature: a user who highlights
   * six wells and pastes forty has no reason to check.
   */
  const wellsToCopy = () => {
    if (!selected.length) return rows;
    const want = new Set(selected);
    // Kept in the FOLDER's order, not the order they were clicked in: the
    // clipboard should look like the list it came from.
    return rows.filter((w) => want.has(idOf(w)));
  };

  function copyWellList() {
    // The heading names a unit, so the value under it has to be in that unit.
    const head = columns.map((c) => {
      const u = c.unit ? unitLabel(c) : "";
      return u ? `${c.label} (${u})` : c.label;
    }).join("\t");
    const body = wellsToCopy().map((w) => columns.map((c) => cell(w, c)).join("\t")).join("\n");
    void navigator.clipboard.writeText(`${head}\n${body}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  /**
   * Ctrl+C copies the well list, because the guide names that key.
   *
   * "To copy well list information just for wells that are highlighted, select
   * the wells and press Ctrl+C." The button existed; the keystroke the guide
   * actually tells a user to press did not.
   *
   * Ignored while the focus is in a field — Ctrl+C there means copy the text
   * the user selected, and stealing it would be a worse bug than not having
   * the shortcut.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "c") return;
      const el = e.target as HTMLElement | null;
      if (el && /^(input|textarea|select)$/i.test(el.tagName)) return;
      if (el?.isContentEditable) return;
      if (window.getSelection()?.toString()) return;   // a real text selection wins
      e.preventDefault();
      copyWellList();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const primary = selected[0] ?? null;
  const folderBtn = (active: boolean) =>
    `w-full text-left px-2 py-1 rounded text-xs flex items-center gap-1.5 ${
      active ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-100"}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {building && (
        <QueryBuilder db={db} editing={building.editing}
          onClose={() => setBuilding(null)}
          onSaved={() => setBuilding(null)} />
      )}
      {/* ── toolbar (§3.1) ── */}
      <div className="flex items-center gap-1 mb-2 shrink-0 flex-wrap">
        <ToolButton label="Open" hint="Open the selected well to view reports and the schematic"
          disabled={!primary} onClick={() => primary && openWell(primary)} />
        <ToolButton label="Edit Data" hint="Open the Edit Data window to change well records"
          disabled={!primary} onClick={() => primary && onEdit(primary)} />
        <ToolButton label="New Well" hint="Create a new well in this database (ch. 4 — Well Planning)"
          onClick={() => void newWell()} />
        <ToolButton label="Data Audit" hint="Check that fields meet the §10.2 business rules"
          onClick={() => onAudit(selected)} />
        <ToolButton label={selected.length > 1 ? `Export Wells (${selected.length})` : "Export Well"}
          hint="Download the selected wells — every row in every table — one document each"
          disabled={!selected.length}
          onClick={() => void exportWells(selected)} />
        <ToolButton label="Import Well"
          hint="Bring a well exported from another database into this one"
          onClick={() => importRef.current?.click()} />
        <ToolButton label="Multi Well Reports"
          hint="Print one table across the selected wells (custom/reports multi)"
          disabled={!selected.length}
          onClick={() => onMultiReport(selected)} />
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden"
          data-testid="wv-import-well"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importWell(f); e.target.value = ""; }} />
        <span className="mx-1 h-5 w-px bg-gray-300" />
        <ToolButton label="Change Database" hint="Back to the Open Database window" onClick={onChangeDatabase} />
        {transfer && (
          <span className="text-[11px] text-blue-700 max-w-[28rem] truncate" title={transfer}>{transfer}</span>
        )}
        <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
          {rows.length} well{rows.length === 1 ? "" : "s"}
          {selected.length > 1 ? ` · ${selected.length} selected` : ""}
        </span>
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* ── folders ── */}
        <aside className="w-64 shrink-0 border border-gray-200 rounded-lg bg-white overflow-y-auto p-1.5">
          <button type="button" className={folderBtn(folder.kind === "recent")}
            onClick={() => setFolder({ kind: "recent" })}>
            <FolderIcon /> Recently Opened Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{recent.length}</span>
          </button>
          <button type="button" className={folderBtn(folder.kind === "my")}
            onClick={() => setFolder({ kind: "my" })}>
            <FolderIcon /> My Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{myWells.length}</span>
          </button>
          <button type="button" className={folderBtn(folder.kind === "all")}
            onClick={() => setFolder({ kind: "all" })}>
            <FolderIcon /> All Wells
            <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{allWells.length}</span>
          </button>

          {/* group folders */}
          {groupTree && (
            <div className="mt-1 border-t border-gray-100 pt-1">
              <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 flex items-center">
                Grouped wells
                <button type="button" data-testid="wv-group-edit"
                  className="ml-auto text-blue-600 hover:underline normal-case"
                  onClick={() => setShowGroupDlg(true)}>edit</button>
              </div>
              <GroupFolders nodes={groupTree} depth={0} lowestOnly={lowestOnly}
                active={folder.kind === "group" ? folder.path : null}
                onPick={(path) => setFolder({ kind: "group", path })} />
            </div>
          )}
          {!groupTree && (
            <button type="button" className="w-full text-left px-2 py-1 rounded text-[11px] text-blue-600 hover:bg-gray-50"
              onClick={() => setShowGroupDlg(true)}>
              Group by Properties…
            </button>
          )}

          {/* saved Query Templates (§8.1) — the manual's "My Queries" */}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <div className="px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 flex items-center">
              Queries
              <span className="ml-1 font-normal normal-case tabular-nums">
                {(templatesQ.data?.queries.length ?? 0) + (savedQ.data?.queries.length ?? 0)}
              </span>
              <button type="button" data-testid="wv-qb-new"
                onClick={() => setBuilding({ editing: null })}
                title="Write a query of your own (§8.1)"
                className="ml-auto mr-1 h-5 px-1.5 text-[10px] normal-case rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                New
              </button>
            </div>
            {(savedQ.data?.queries ?? []).length > 0 && (
              <div>
                <div className="px-2 pt-1 text-[9px] uppercase tracking-wide text-gray-300">Mine</div>
                {(savedQ.data?.queries ?? []).map((q) => (
                  <div key={q.id} className="group">
                    <div className="flex items-center">
                    <button type="button" data-testid="wv-saved-query"
                      onClick={() => {
                        // Exactly what a shipped template does: select it, and
                        // run it at once unless a criterion asks for a value.
                        setFolder({ kind: "template", queryId: q.id });
                        setQueryValues({});
                        if (!q.criteria.some((c) => c.prompts)) setRanQuery({ id: q.id, values: {} });
                        else setRanQuery(null);
                      }}
                      className={`flex-1 text-left px-2 py-1 rounded text-xs truncate ${
                        folder.kind === "template" && folder.queryId === q.id
                          ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-700 hover:bg-gray-100"}`}>
                      {q.name}
                    </button>
                    <button type="button" title="Edit" onClick={() => setBuilding({ editing: q })}
                      data-testid="wv-qb-edit"
                      className="opacity-0 group-hover:opacity-100 px-1 text-[10px] text-gray-500 hover:text-blue-700">edit</button>
                    <button type="button" title="Delete" data-testid="wv-qb-delete"
                      onClick={() => void wvDbApi.deleteQuery(db, q.id).then(() =>
                        queryClient.invalidateQueries({ queryKey: ["wvdb", db, "saved-queries"] }))}
                      className="opacity-0 group-hover:opacity-100 px-1 text-[10px] text-gray-500 hover:text-red-700">del</button>
                    </div>
                    {folder.kind === "template" && folder.queryId === q.id && (
                      <QueryPrompts
                        query={q}
                        values={queryValues}
                        onChange={setQueryValues}
                        onRun={() => setRanQuery({ id: q.id, values: queryValues })}
                        result={templateRunQ.data ?? null}
                        running={templateRunQ.isFetching}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            {Object.entries(
              (templatesQ.data?.queries ?? []).reduce<Record<string, WvQuery[]>>((acc, q) => {
                (acc[q.category] ??= []).push(q);
                return acc;
              }, {}),
            ).map(([cat, list]) => (
              <div key={cat}>
                <div className="px-2 pt-1 text-[9px] uppercase tracking-wide text-gray-300">{cat}</div>
                {list.map((q) => {
                  const active = folder.kind === "template" && folder.queryId === q.id;
                  return (
                    <div key={q.id}>
                      <button type="button" data-testid={`wv-query-${q.name}`}
                        className={folderBtn(active)}
                        style={{ paddingLeft: 16 }}
                        onClick={() => {
                          setFolder({ kind: "template", queryId: q.id });
                          setQueryValues({});
                          // No prompts: run it straight away, as the desktop does.
                          if (!q.criteria.some((c) => c.prompts)) setRanQuery({ id: q.id, values: {} });
                          else setRanQuery(null);
                        }}>
                        <SearchIcon /> <span className="truncate">{q.name}</span>
                      </button>
                      {active && (
                        <QueryPrompts
                          query={q}
                          values={queryValues}
                          onChange={setQueryValues}
                          onRun={() => setRanQuery({ id: q.id, values: queryValues })}
                          result={templateRunQ.data ?? null}
                          running={templateRunQ.isFetching}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* quick query (§3.3) */}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button type="button" className={folderBtn(folder.kind === "query")}
              onClick={() => setFolder({ kind: "query" })}>
              <SearchIcon /> Quick Query
            </button>
            {folder.kind === "query" && (
              <div className="px-2 py-1.5 space-y-1.5">
                <label className="block text-[10px] uppercase tracking-wide text-gray-400">
                  Look in
                  <select value={lookIn} onChange={(e) => setLookIn(e.target.value)}
                    className="mt-0.5 w-full h-7 border border-gray-300 rounded px-1 text-xs bg-white text-gray-800 normal-case tracking-normal">
                    {(headerColsQ.data ?? []).map((c) => (
                      <option key={c.column} value={c.column}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-[10px] uppercase tracking-wide text-gray-400">
                  Look for
                  <input value={lookFor} onChange={(e) => setLookFor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") setApplied({ lookin: lookIn, lookfor: lookFor }); }}
                    placeholder="full or partial value"
                    list="wv-qq-lookup"
                    className="mt-0.5 w-full h-7 border border-gray-300 rounded px-1.5 text-xs normal-case tracking-normal" />
                  {/* the manual's Database Lookup list: values already stored in that field */}
                  <datalist id="wv-qq-lookup">
                    {(lookValuesQ.data?.values ?? []).map((v) => <option key={v} value={v} />)}
                  </datalist>
                </label>
                <button type="button"
                  onClick={() => setApplied({ lookin: lookIn, lookfor: lookFor })}
                  className="h-7 px-2.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150">
                  Refresh
                </button>
                {applied && (
                  <button type="button" onClick={() => { setApplied(null); setLookFor(""); }}
                    className="ml-1.5 h-7 px-2 text-[11px] rounded border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ── well list ── */}
        <section className="flex-1 min-w-0 border border-gray-200 rounded-lg bg-white flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100 text-[11px]">
            <button type="button" className="text-blue-600 hover:underline" onClick={() => setShowListProps(true)}>
              Well List Properties…
            </button>
            <button type="button" className="text-blue-600 hover:underline" onClick={copyWellList}>
              {copied ? "Copied ✓"
                : selected.length ? `Copy Well List (${selected.length})`
                  : "Copy Well List"}
            </button>
            <button type="button" className="text-blue-600 hover:underline"
              onClick={() => setSelected(rows.map(idOf))}>
              Select All
            </button>
            {primary && (
              <>
                <span className="h-4 w-px bg-gray-200" />
                {myWells.includes(primary) ? (
                  <button type="button" className="text-blue-600 hover:underline"
                    onClick={() => setMyWells((m) => m.filter((x) => !selected.includes(x)))}>
                    Remove from My Wells
                  </button>
                ) : (
                  <button type="button" className="text-blue-600 hover:underline"
                    onClick={() => setMyWells((m) =>
                      [...new Set([...m, ...selected])].slice(0, MY_WELLS_CAP))}>
                    Add to My Wells
                  </button>
                )}
                <button type="button" className="text-red-600 hover:underline ml-auto"
                  onClick={() => void deleteWells(selected)}>
                  {selected.length > 1 ? `Delete ${selected.length} Wells…` : "Delete Well…"}
                </button>
              </>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {wellsQ.isLoading ? (
              <div className="p-4 text-sm text-gray-400">Reading the database…</div>
            ) : wellsQ.error ? (
              <div className="m-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {(wellsQ.error as Error).message}
              </div>
            ) : rows.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">
                {folder.kind === "my" ? "No wells in My Wells yet — right side of the manual: select wells and Add to My Wells."
                  : folder.kind === "recent" ? "No wells opened yet."
                  : folder.kind === "template"
                    ? (templateRunQ.data ? "No well matches this query." : "Fill in the values and click Run.")
                  : folder.kind === "query" ? (applied ? "No well matches that query." : "Set the query and click Refresh.")
                  : "No wells."}
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100">
                  <tr>
                    {columns.map((c) => (
                      <th key={c.column}
                        className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200"
                        onClick={() => setSort((s) =>
                          s?.column === c.column ? { column: c.column, desc: !s.desc } : { column: c.column, desc: false })}>
                        {c.label}
                        {/* The value converts with the unit set, so the heading has to say which. */}
                        {unitLabel(c) && <span className="ml-1 font-normal text-gray-400">({unitLabel(c)})</span>}
                        {sort?.column === c.column && <span className="ml-1 text-gray-400">{sort.desc ? "▾" : "▴"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w, i) => {
                    const id = idOf(w);
                    const sel = selected.includes(id);
                    return (
                      <tr key={id}
                        data-testid="wv-well-row"
                        className={`cursor-default select-none ${sel ? "bg-blue-100" : i % 2 ? "bg-gray-50 hover:bg-blue-50" : "hover:bg-blue-50"}`}
                        onClick={(e) => clickRow(w, e, i)}
                        onDoubleClick={() => openWell(id)}>
                        {columns.map((c) => (
                          <td key={c.column} className="px-2 py-1 whitespace-nowrap text-gray-800">
                            {cell(w, c)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="px-2 py-1 border-t border-gray-100 text-[10px] text-gray-400">
            {/*
              * This sentence used to name two commands as using the selection
              * when only one of them did. It now names four, and all four do —
              * which is the only version of this line worth having, because a
              * user has no way to check it except by losing something.
              */}
            Double-click a well to open it. Ctrl-click and Shift-click select several — Data Audit,
            Copy Well List (or Ctrl-C), Export Wells, Multi Well Reports, My Wells and Delete all
            use the selection.{" "}
            {selected.length > 1
              ? `${selected.length} selected.`
              : primary ? `Selected: ${nameOf(rows.find((w) => idOf(w) === primary) ?? { idwell: primary })}` : ""}
          </div>
        </section>
      </div>

      {showListProps && (
        <WellListProperties
          all={headerColsQ.data ?? []}
          displayed={cols}
          onClose={() => setShowListProps(false)}
          onApply={(next) => { setCols(next); setShowListProps(false); }}
        />
      )}
      {showGroupDlg && (
        <GroupByProperties
          all={headerColsQ.data ?? []}
          groups={groups}
          lowestOnly={lowestOnly}
          onClose={() => setShowGroupDlg(false)}
          onApply={(next, lowest) => {
            setGroups(next);
            setLowestOnly(lowest);
            setShowGroupDlg(false);
            if (next.length === 0 && folder.kind === "group") setFolder({ kind: "all" });
          }}
        />
      )}
    </div>
  );
}

function ToolButton({ label, hint, onClick, disabled }: {
  label: string; hint: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button type="button" title={hint} onClick={onClick} disabled={disabled}
      className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150">
      {label}
    </button>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5v7A1.5 1.5 0 0 1 13 13.5H3A1.5 1.5 0 0 1 1.5 12v-8.5z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor"
      strokeWidth="1.6" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3 3" />
    </svg>
  );
}

/** Nested group folders. 9.0 allows more than four levels; see GROUP_LEVELS. */
function GroupFolders({ nodes, depth, active, onPick, lowestOnly }: {
  nodes: { value: string; path: (string | null)[]; count: number; children: GroupFolders_Node[] }[];
  depth: number;
  active: (string | null)[] | null;
  onPick: (path: (string | null)[]) => void;
  /** §3.2 "Show wells in lowest group only": intermediate levels are labels. */
  lowestOnly: boolean;
}) {
  return (
    <div>
      {nodes.map((n) => {
        const isActive = active !== null && active.length === n.path.length && n.path.every((v, i) => active[i] === v);
        const leaf = n.children.length === 0;
        const listable = !lowestOnly || leaf;
        return (
          <div key={n.path.join("¦")}>
            {listable ? (
              <button type="button" data-testid="wv-group-folder"
                style={{ paddingLeft: 8 + depth * 14 }}
                className={`w-full text-left pr-2 py-0.5 rounded text-[11px] flex items-center gap-1.5 ${
                  isActive ? "bg-blue-100 text-blue-900 font-medium" : "text-gray-600 hover:bg-gray-100"}`}
                onClick={() => onPick(n.path)}>
                <FolderIcon />
                <span className="truncate">{n.value}</span>
                <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{n.count}</span>
              </button>
            ) : (
              <div style={{ paddingLeft: 8 + depth * 14 }}
                className="pr-2 py-0.5 text-[11px] text-gray-500 flex items-center gap-1.5">
                <FolderIcon />
                <span className="truncate">{n.value}</span>
                <span className="ml-auto text-[10px] text-gray-300 tabular-nums">{n.count}</span>
              </div>
            )}
            {n.children.length > 0 && (
              <GroupFolders nodes={n.children} depth={depth + 1} active={active} onPick={onPick} lowestOnly={lowestOnly} />
            )}
          </div>
        );
      })}
    </div>
  );
}
interface GroupFolders_Node { value: string; path: (string | null)[]; count: number; children: GroupFolders_Node[] }

/** §3.2 "Change Well List Columns" — the Well List Properties dialog. */
function WellListProperties({ all, displayed, onApply, onClose }: {
  all: WvHeaderColumn[];
  displayed: string[];
  onApply: (cols: string[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<string[]>(displayed);
  const [filter, setFilter] = useState("");
  const available = all.filter((c) => !chosen.includes(c.column)
    && (!filter || c.label.toLowerCase().includes(filter.toLowerCase()) || c.column.toLowerCase().includes(filter.toLowerCase())));
  const move = (col: string, dir: -1 | 1) => setChosen((cs) => {
    const i = cs.indexOf(col);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cs.length) return cs;
    const next = [...cs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  return (
    <Dialog title="Well List Properties" onClose={onClose}>
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Available</div>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="filter…"
            className="w-full h-7 border border-gray-300 rounded px-1.5 text-xs mb-1" />
          <div className="h-56 overflow-y-auto border border-gray-200 rounded">
            {available.map((c) => (
              <button key={c.column} type="button"
                className="w-full text-left px-2 py-1 text-xs hover:bg-blue-50"
                onDoubleClick={() => setChosen((cs) => [...cs, c.column])}
                onClick={() => setChosen((cs) => [...cs, c.column])}
                title={c.column}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">Displayed (in order)</div>
          <div className="h-[15.9rem] overflow-y-auto border border-gray-200 rounded">
            {chosen.map((col) => {
              const label = all.find((c) => c.column === col)?.label ?? col;
              return (
                <div key={col} className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-gray-50">
                  <span className="truncate flex-1" title={col}>{label}</span>
                  <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => move(col, -1)}>↑</button>
                  <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => move(col, 1)}>↓</button>
                  <button type="button" className="text-red-400 hover:text-red-600"
                    onClick={() => setChosen((cs) => cs.filter((x) => x !== col))}>✕</button>
                </div>
              );
            })}
            {chosen.length === 0 && <div className="p-2 text-[11px] text-gray-400">Nothing displayed — add a column.</div>}
          </div>
        </div>
      </div>
      <DialogButtons onOk={() => onApply(chosen.length ? chosen : ["WellName"])} onCancel={onClose} />
    </Dialog>
  );
}

/**
 * §3.2 "Add and Edit a Well Group" — group by header fields.
 *
 * Not four. That limit was justified in this file as "per the manual", and the
 * manual it cites is an earlier one: 9.0's own Explorer Enhancements topic
 * lists, among the new additions, "The Group By hierarchy can be more than four
 * levels."
 */
function GroupByProperties({ all, groups, lowestOnly, onApply, onClose }: {
  all: WvHeaderColumn[];
  groups: GroupSpec[];
  lowestOnly: boolean;
  onApply: (groups: GroupSpec[], lowestOnly: boolean) => void;
  onClose: () => void;
}) {
  const [levels, setLevels] = useState<GroupSpec[]>(groups.length ? groups : []);
  const [lowest, setLowest] = useState(lowestOnly);
  const setLevel = (i: number, spec: GroupSpec | null) =>
    setLevels((ls) => {
      const next = [...ls];
      if (spec === null) next.splice(i);
      else next[i] = spec;
      return next.slice(0, GROUP_LEVELS);
    });
  const rows = [...levels, ...(levels.length < GROUP_LEVELS ? [null] : [])];
  return (
    <Dialog title="Group by Properties" onClose={onClose}>
      <p className="text-[11px] text-gray-500 mb-2">
        Group wells by any field in the well header record — up to {GROUP_LEVELS} levels, each ascending or
        descending. Select &lt;none&gt; to remove a level.
      </p>
      <div className="space-y-1.5">
        {rows.map((g, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-12">Level {i + 1}</span>
            <select value={g?.column ?? ""}
              onChange={(e) => setLevel(i, e.target.value ? { column: e.target.value, desc: g?.desc ?? false } : null)}
              className="h-7 border border-gray-300 rounded px-1 text-xs bg-white flex-1">
              <option value="">&lt;none&gt;</option>
              {all.map((c) => <option key={c.column} value={c.column}>{c.label}</option>)}
            </select>
            {g && (
              <select value={g.desc ? "desc" : "asc"}
                onChange={(e) => setLevel(i, { column: g.column, desc: e.target.value === "desc" })}
                className="h-7 border border-gray-300 rounded px-1 text-xs bg-white">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <input type="checkbox" checked={lowest} onChange={(e) => setLowest(e.target.checked)} />
          Show wells in lowest group only
        </label>
        <button type="button" className="text-[11px] text-blue-600 hover:underline" onClick={() => setLevels([])}>
          Clear All
        </button>
      </div>
      <DialogButtons onOk={() => onApply(levels, lowest)} onCancel={onClose} />
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/30 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl border border-gray-300 w-full max-w-lg p-4"
        onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function DialogButtons({ onOk, onCancel }: { onOk: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 mt-4">
      <button type="button" onClick={onCancel}
        className="h-8 px-3 text-xs rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
        Cancel
      </button>
      <button type="button" onClick={onOk}
        className="h-8 px-4 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700">
        OK
      </button>
    </div>
  );
}

/**
 * The prompt panel for a saved query (§8.1 "Prompt for Value").
 *
 * A criterion the template already answers is shown as context, not as an input
 * — "Job Category like drill" is part of what the query MEANS, and editing it
 * would make the name a lie. Only the prompting criteria get a box.
 *
 * Anything the run could not apply is listed underneath: a query that quietly
 * drops half its criteria returns too many wells and looks like it worked.
 */
function QueryPrompts({ query, values, onChange, onRun, result, running }: {
  query: WvQuery;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onRun: () => void;
  result: WvQueryResult | null;
  running: boolean;
}) {
  const fixed = query.criteria.filter((c) => !c.prompts);
  return (
    <div className="px-2 pb-2 pt-1 space-y-1.5" style={{ paddingLeft: 16 }}>
      {fixed.length > 0 && (
        <div className="text-[10px] text-gray-400 leading-snug">
          {fixed.map((c, i) => (
            <div key={i} className="truncate">
              {c.fieldLabel} {(c.op ?? "").toLowerCase()} {c.value ? `"${c.value}"` : ""}
            </div>
          ))}
        </div>
      )}
      {query.criteria.map((c, i) => c.prompts && (
        <label key={i} className="block text-[10px] uppercase tracking-wide text-gray-400">
          {c.fieldLabel}
          <span className="normal-case tracking-normal text-gray-300"> {(c.op ?? "").toLowerCase()}</span>
          <input
            type={c.isDate ? "date" : "text"}
            value={values[String(i)] ?? ""}
            onChange={(e) => onChange({ ...values, [String(i)]: e.target.value })}
            onKeyDown={(e) => { if (e.key === "Enter") onRun(); }}
            placeholder={c.isDate ? undefined : "full or partial value"}
            className="mt-0.5 w-full h-7 border border-gray-300 rounded px-1.5 text-xs normal-case tracking-normal"
          />
        </label>
      ))}
      <button type="button" onClick={onRun} data-testid="wv-query-run"
        className="h-7 px-2.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors duration-150">
        {running ? "Running…" : "Run"}
      </button>
      {result && (
        <div className="text-[10px] text-gray-400 leading-snug">
          {result.wells.length} well{result.wells.length === 1 ? "" : "s"} matched.
          {result.skipped.length > 0 && (
            <div className="mt-0.5 text-amber-600">
              Not applied: {result.skipped.map((s) => `${s.criterion} (${s.reason})`).join("; ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
