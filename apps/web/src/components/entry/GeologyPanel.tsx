/**
 * The well's GEOLOGY sheet — the formation register and the program's sampling
 * requirements. Reports 18, 19, 20 and 21 all read it.
 *
 * PROGNOSIS AND ACTUAL ARE SEPARATE COLUMNS
 * -----------------------------------------
 * A formation row carries what was predicted AND what was drilled, side by
 * side, never one field that gets overwritten when the top comes in. Report 19
 * exists precisely to print the two against each other, and a prognosis that
 * disappears the moment it is tested cannot be compared with anything. The grid
 * is therefore wide, and split into three labelled bands so a geologist filling
 * in a prognosis before spud is not walking past twelve columns they cannot
 * answer yet.
 *
 * Both tables save replace-all: nothing points into either.
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  wellviewApi,
  type GeologySheet, type SamplingRequirementRow, type WellFormationRow, type WellboreRow,
} from "../../entry/wellview.js";
import { Section, RowTable, type Col } from "./fields.js";

const filled = (row: object, skip: string[] = ["order", "wellboreId"]) =>
  Object.entries(row).some(([k, v]) => !skip.includes(k) && v !== null && v !== "");

const emptyFormation = (): WellFormationRow => ({
  order: 0, name: null, lithDes: null, elementType: null, layerName: null,
  progDepthTopSs: null, progTopTvd: null, progDepthBtmSs: null, progBtmTvd: null,
  drillTopMd: null, drillTopTvd: null, drillBtmMd: null, drillBtmTvd: null,
  finalTopMd: null, finalBtmMd: null, ropMHr: null,
  pPorePpg: null, pFracPpg: null, temperatureC: null, h2sConcPct: null,
});
const emptyRequirement = (): SamplingRequirementRow => ({
  order: 0, wellboreId: null, topDes: null, topMkb: null,
  btmDes: null, btmMkb: null, rqdBy: null, sampledBy: null, com: null,
});

const LITH_TYPES = [
  "Sandstone", "Shale", "Limestone", "Dolomite", "Anhydrite", "Salt", "Marl", "Claystone", "Coal",
];

/**
 * The formation grid, in three bands.
 *
 * One RowTable per band over the SAME rows, so a row stays one row: the tables
 * share `draft.formations` and each writes back the whole array. Splitting the
 * data instead would let the bands drift out of alignment the moment a row was
 * added in one of them.
 */
function FormationBands({ rows, onChange }: {
  rows: WellFormationRow[];
  onChange: (rows: WellFormationRow[]) => void;
}) {
  return (
    <>
      <SubBar>Identity — who the formation is</SubBar>
      <RowTable
        cols={[
          { key: "name", label: "Formation name", width: "w-48", placeholder: "Asmari" },
          { key: "lithDes", label: "Lith des", type: "select", width: "w-32",
            options: LITH_TYPES.map((v) => ({ value: v, label: v })) },
          { key: "elementType", label: "Element type", type: "select", width: "w-32",
            options: ["Marker", "Reservoir", "Seal", "Source"].map((v) => ({ value: v, label: v })),
            title: "The part this formation plays in the play — report 18 and 20 print it" },
          { key: "layerName", label: "Layer name", width: "w-32",
            title: "Where a formation is subdivided; report 19 prints it" },
        ] as Col<WellFormationRow>[]}
        rows={rows} onChange={onChange} blank={emptyFormation}
        addLabel="Formation" minRows={3} testId="fm"
      />

      <SubBar>Prognosis — what was predicted (report 20)</SubBar>
      <RowTable
        cols={[
          { key: "name", label: "Formation name", width: "w-48" },
          { key: "progDepthTopSs", label: "Prog depth top SS (m)", type: "num", width: "w-28",
            title: "SUBSEA, not below KB — that is what the sample's column says" },
          { key: "progTopTvd", label: "Prog top TVD (mKB)", type: "num", width: "w-28" },
          { key: "progDepthBtmSs", label: "Prog depth btm SS (m)", type: "num", width: "w-28" },
          { key: "progBtmTvd", label: "Prog btm TVD (mKB)", type: "num", width: "w-28" },
          { key: "pPorePpg", label: "P pore (ppg)", type: "num", width: "w-24" },
          { key: "pFracPpg", label: "P frac (ppg)", type: "num", width: "w-24" },
          { key: "temperatureC", label: "T (°C)", type: "num", width: "w-20" },
          { key: "h2sConcPct", label: "H2S conc (%)", type: "num", width: "w-24" },
        ] as Col<WellFormationRow>[]}
        rows={rows} onChange={onChange} blank={emptyFormation}
        addLabel="Formation" minRows={3} testId="fmprog"
      />

      <SubBar>As drilled — what was found (reports 18, 19)</SubBar>
      <RowTable
        cols={[
          { key: "name", label: "Formation name", width: "w-48" },
          { key: "drillTopMd", label: "Drill top MD (mKB)", type: "num", width: "w-28" },
          { key: "drillTopTvd", label: "Drill top TVD (mKB)", type: "num", width: "w-28" },
          { key: "drillBtmMd", label: "Drill btm MD (mKB)", type: "num", width: "w-28" },
          { key: "drillBtmTvd", label: "Drill btm TVD (mKB)", type: "num", width: "w-28" },
          { key: "finalTopMd", label: "Final top MD (mKB)", type: "num", width: "w-28",
            title: "After the log was tied in — not where the driller called it" },
          { key: "finalBtmMd", label: "Final btm MD (mKB)", type: "num", width: "w-28" },
          { key: "ropMHr", label: "ROP (m/hr)", type: "num", width: "w-24" },
        ] as Col<WellFormationRow>[]}
        rows={rows} onChange={onChange} blank={emptyFormation}
        addLabel="Formation" minRows={3} testId="fmdrill"
      />
      <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
        The three bands are the SAME rows — add a formation in any of them and it appears in all
        three. Prognosis and actual are kept apart because report 19 prints them against each other:
        a predicted top that is overwritten the moment it is drilled cannot be compared with
        anything.
      </div>
    </>
  );
}

export function GeologyPanel({ wellId, wellbores }: { wellId: string; wellbores: WellboreRow[] }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["wellview", "geology", wellId],
    queryFn: () => wellviewApi.geology(wellId),
    enabled: !!wellId,
  });
  const [draft, setDraft] = useState<GeologySheet | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => { if (q.data) { setDraft(q.data); setDirty(false); } }, [q.data]);

  const set = <K extends keyof GeologySheet>(key: K, value: GeologySheet[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setDirty(true);
    setSavedAt(null);
  };

  async function save() {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const rows = <T extends object>(list: T[]) =>
        list.filter((r) => filled(r)).map((r, i) => ({ ...r, order: i }));
      await wellviewApi.saveGeology(wellId, {
        formations: rows(draft.formations),
        samplingRequirements: rows(draft.samplingRequirements),
      });
      await qc.invalidateQueries({ queryKey: ["wellview", "geology", wellId] });
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) { setError(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  if (!draft) return <div className="px-2 py-3 text-[11px] text-gray-400">Loading geology…</div>;

  const wellboreOptions = wellbores
    .filter((w) => w.id && w.name)
    .map((w) => ({ value: w.id as string, label: w.name as string }));

  return (
    <div>
      <Section right={
        <div className="flex items-center gap-2 font-normal normal-case">
          {error && <span className="text-red-600 max-w-[320px] truncate" title={error}>{error}</span>}
          {savedAt && !dirty && <span className="text-green-700">Saved {savedAt}</span>}
          {dirty && <span className="text-amber-600">Unsaved changes</span>}
          <button type="button" onClick={() => void save()} disabled={busy || !dirty}
            data-testid="save-geology"
            className="min-h-[28px] px-2.5 text-[11px] rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 transition-colors duration-150">
            {busy ? "Saving…" : "Save geology"}
          </button>
        </div>
      }>
        Geology
      </Section>

      <FormationBands rows={draft.formations} onChange={(rows) => set("formations", rows)} />

      <SubBar>Sampling requirements — the geological program (report 20)</SubBar>
      <RowTable
        cols={[
          { key: "topDes", label: "Top des", type: "select", width: "w-40",
            options: ["Open Hole Logs", "Cores", "Sidewall Cores", "Cuttings", "MDT/RFT"]
              .map((v) => ({ value: v, label: v })) },
          { key: "topMkb", label: "Top (mKB)", type: "num", width: "w-28" },
          { key: "btmDes", label: "Btm des", width: "w-40" },
          { key: "btmMkb", label: "Btm (mKB)", type: "num", width: "w-28" },
          ...(wellboreOptions.length
            ? [{ key: "wellboreId", label: "Wellbore", type: "select", width: "w-36",
                options: wellboreOptions } as Col<SamplingRequirementRow>]
            : []),
          { key: "rqdBy", label: "Rqd by", width: "w-32" },
          { key: "sampledBy", label: "Sampled by", width: "w-32" },
          { key: "com", label: "Com" },
        ] as Col<SamplingRequirementRow>[]}
        rows={draft.samplingRequirements}
        onChange={(rows) => set("samplingRequirements", rows)}
        blank={emptyRequirement}
        addLabel="Requirement" minRows={2} testId="sreq"
      />
      <div className="px-2 py-1.5 text-[11px] text-gray-400 leading-snug">
        What the program asks to be taken and over what interval. The day&rsquo;s actual cuttings,
        lithology, shows and log runs are entered on the daily sheet&rsquo;s Geology tab &mdash; this
        is the plan, those are the record.
      </div>
    </div>
  );
}

function SubBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 text-gray-500 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 border-y border-gray-200">
      {children}
    </div>
  );
}
