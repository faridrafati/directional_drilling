/**
 * Directional Plot report — a real, generated PDF (no browser print dialog).
 *
 * Shaped after Wellview/08_DirectionalPlot.pdf:
 *
 *   PAGE 1  title · well-identification header block · the Plan and Vertical
 *           Section plots, captured from the live Recharts SVGs
 *   PAGE 2  the calculated-stations table — built by `stationTable.ts`, the
 *           SAME builder the stations PDF uses, so the two exports agree
 *           column for column
 *
 * WHAT WE DO NOT PRINT
 * --------------------
 * The Wellview header carries API/UWI, License #, Surface Legal Location and
 * casing-flange elevations. This application models none of those. Rather than
 * print labelled blanks — which reads as "missing data" on a report an
 * engineer signs — every field is emitted only when we actually have a value
 * (see `identificationFields`). Distances are labelled with the PROJECT's
 * length unit throughout; nothing here assumes feet.
 *
 * Getting the charts in: `svgRaster.ts` serializes each live `<svg>` and
 * rasterizes it at 2× through an offscreen canvas. If either plot is not
 * mounted, or rasterization fails, this function throws with a user-facing
 * message and NO file is produced — a blank page in a signed report is worse
 * than an error.
 *
 * The legend is NOT in that raster: Recharts renders it as an HTML sibling of
 * the surface. `svgRaster.readChartLegend` reads the swatches the user is
 * looking at and we redraw them here as pdfmake vector shapes + text, so the
 * printed plots identify their series exactly as the screen does — with the
 * series the chart actually has, and none it does not.
 *
 * PAGE 1 IS A FIXED HEIGHT BUDGET
 * -------------------------------
 * "Page 1 = plots, page 2 = table" is a contract, and pdfmake will happily
 * break it by reflowing a long identification value onto extra lines. So page
 * 1 is budgeted rather than hoped for: identification values are bounded
 * (`MAX_FIELD_VALUE_CHARS`), the block is capped at `ID_BLOCK_MAX_ROWS` rows,
 * and `plotFitFor` hands the plot images whatever body height is left over.
 * The plots shrink; the page never spills.
 */
import type { TDocumentDefinitions, Content, Column, CanvasElement } from "pdfmake/interfaces";
import { pdfMake } from "./pdfmakeSetup.js";
import { stationTableContent, STATION_TABLE_STYLES } from "./stationTable.js";
import {
  rasterizeSvgElement, readChartLegend,
  type SvgRasterResult, type ChartLegendItem,
} from "./svgRaster.js";
import type { CalculationDetail } from "../api/client.js";

/**
 * Everything the header block can show. All of it is optional except the
 * length unit: a field with no value is omitted from the report entirely.
 */
export interface DirectionalPlotMeta {
  projectName?: string | null;
  countryName?: string | null;
  fieldName?: string | null;
  wellName?: string | null;
  /** Wellhead position + elevation, in the project's length unit. */
  wellNs?: number | null;
  wellEw?: number | null;
  wellMsl?: number | null;
  /** Planned well depths recorded on the Well record. */
  wellTvd?: number | null;
  wellMd?: number | null;
  wellType?: string | null;
  /** Profile chain for this calculation, e.g. "Build & Hold → Hold-Curve 3D". */
  profileLabel?: string | null;
  /** Reference bearing the Vertical Section is projected onto, in degrees. */
  vsecAzmDeg?: number | null;
  /** Project length unit — "ft", "m", … Never defaulted to ft by this module. */
  lengthUnit: string;
  /** Project's declared DLS unit ("deg/100ft" | "deg/30m") — never derived. */
  dlsUnit?: string;
}

/** The two live chart surfaces, as found in the DOM by the caller. */
export interface DirectionalPlotSources {
  plan: SVGSVGElement | null | undefined;
  verticalSection: SVGSVGElement | null | undefined;
}

/** Landscape A4 body geometry (842 × 595 pt page, 30 pt side margins). */
const PAGE_MARGINS: [number, number, number, number] = [30, 62, 30, 44];
/** A4 landscape is 841.89 × 595.28 pt; the body is what the margins leave. */
const BODY_HEIGHT_PT = 595.28 - PAGE_MARGINS[1] - PAGE_MARGINS[3]; // 489.28

/** Width of the box each plot image is fitted into — two across the body. */
const PLOT_FIT_WIDTH = 376;
/** Never taller than this, however much room is left … */
const PLOT_FIT_MAX_HEIGHT = 296;
/** … and never so short that the plot stops being readable. */
const PLOT_FIT_MIN_HEIGHT = 190;

/**
 * Height of one line of `size`-pt Roboto in pdfmake, rounded up.
 * Roboto's (ascender − descender) is 2400/2048 = 1.172 em; 1.2 keeps the
 * estimate on the safe side of the real line box.
 */
const line = (size: number): number => size * 1.2;

/** Legend geometry. The swatch canvas is drawn inside 0…LEGEND_SWATCH_HEIGHT,
 *  which is what pdfmake then measures the row as. */
const LEGEND_SWATCH_WIDTH = 15;
const LEGEND_SWATCH_HEIGHT = 10;
const LEGEND_MARGIN_TOP = 5;
/** Gap between one entry's swatch and its label, and between entries. */
const LEGEND_LABEL_GAP = 3;
const LEGEND_ITEM_GAP = 9;

/**
 * Everything on page 1 that is NOT the plot image or the identification block,
 * top to bottom:
 *
 *   report subheader (12 pt) + its 6 pt bottom margin
 *   plot title       (11 pt)
 *   axis caption     ( 8 pt) + its 4 pt bottom margin
 *   the legend row   (its swatch canvas) + its 5 pt top margin
 *   markers note     ( 8 pt) + its 8 pt top margin, allowed to wrap to 2 lines
 *   slack, so one unforeseen wrapped line still cannot push page 1 over
 */
const PAGE1_CHROME_PT =
  line(12) + 6 +
  line(11) +
  line(8) + 4 +
  LEGEND_SWATCH_HEIGHT + LEGEND_MARGIN_TOP +
  8 + 2 * line(8) +
  14;

/**
 * Build and download the two-page Directional Plot report.
 *
 * @throws Error — with a message meant for the user — when a plot is missing
 *   from the DOM or cannot be rasterized. Nothing is downloaded in that case.
 */
export async function exportDirectionalPlotPdf(
  calc: CalculationDetail,
  meta: DirectionalPlotMeta,
  sources: DirectionalPlotSources,
): Promise<void> {
  const missing: string[] = [];
  if (!sources.plan) missing.push("Plan");
  if (!sources.verticalSection) missing.push("Vertical Section");
  if (missing.length > 0) {
    throw new Error(
      `the ${missing.join(" and ")} ${missing.length === 1 ? "plot is" : "plots are"} not on screen — ` +
      "open the Charts tab, calculate the trajectory, and let the charts finish drawing before exporting",
    );
  }

  const [plan, verticalSection] = await Promise.all([
    capturePlot(sources.plan as SVGSVGElement, "Plan"),
    capturePlot(sources.verticalSection as SVGSVGElement, "Vertical Section"),
  ]);

  const unit = meta.lengthUnit;
  const fieldTitle = (meta.fieldName ?? "").trim();
  const wellTitle = (meta.wellName ?? "").trim();
  // Both are needed before `content` is built: the identification block's row
  // count is what is left of page 1 for the plots (see plotFitFor).
  const idFields = identificationFields(calc, meta);
  const plotFit = plotFitFor(idFields.length);

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    info: {
      title: `Directional Plot — ${calc.name}`,
      subject: wellTitle ? `Directional plot for ${wellTitle}` : "Directional plot",
    },
    header: (): Content => ({
      stack: [
        {
          text: fieldTitle ? fieldTitle.toUpperCase() : "DIRECTIONAL PLOT",
          style: "title",
          alignment: "center",
          margin: [0, 14, 0, 0],
        },
        {
          columns: [
            {
              text: meta.countryName ? `Country: ${meta.countryName}` : "",
              alignment: "left",
              margin: [30, 0, 0, 0],
            },
            {
              text: wellTitle ? `Well: ${wellTitle}` : "",
              alignment: "right",
              margin: [0, 0, 30, 0],
            },
          ],
          fontSize: 9,
          color: "#475569",
        },
      ],
    }),
    footer: (currentPage, pageCount): Content => ({
      columns: [
        {
          text: `Report printed ${new Date().toLocaleString()}`,
          alignment: "left",
          margin: [30, 10, 0, 0],
          fontSize: 8,
          color: "#94a3b8",
        },
        {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: "right",
          margin: [0, 10, 30, 0],
          fontSize: 8,
          color: "#94a3b8",
        },
      ],
    }),
    content: [
      {
        text: `Directional Plot — ${calc.name}`,
        style: "subheader",
        margin: [0, 0, 0, 6],
      },
      identificationBlock(idFields),
      {
        columns: [
          // Plan first, matching the reference's plot order.
          plotColumn("Plan", plan, `EW (${unit}) horizontal · NS (${unit}) vertical`, plotFit),
          plotColumn(
            "Vertical Section",
            verticalSection,
            `VS (${unit}) horizontal · TVD (${unit}) vertical, increasing downward`,
            plotFit,
          ),
        ],
        columnGap: 14,
      },
      {
        text: markersNote([plan, verticalSection]),
        style: "note",
        margin: [0, 8, 0, 0],
      },
      {
        // `pageBreak: "before"` starts the table on a fresh page; page 1
        // fitting in one page (the budget above) is what makes that page 2.
        text: `Calculated Stations (${calc.stations.length})`,
        style: "subheader",
        pageBreak: "before",
        margin: [0, 0, 0, 6],
      },
      stationTableContent(calc.stations, unit, meta.dlsUnit),
    ],
    styles: {
      ...STATION_TABLE_STYLES,
      title: { fontSize: 16, bold: true, color: "#1e3a8a" },
      subheader: { fontSize: 12, bold: true, color: "#1f2937" },
      plotTitle: { fontSize: 11, bold: true, color: "#1e3a8a" },
      plotAxes: { fontSize: 8, color: "#64748b" },
      fieldLabel: { fontSize: 8, color: "#64748b" },
      fieldValue: { fontSize: 8, bold: true, color: "#1f2937" },
      legendLabel: { fontSize: 7, color: "#475569" },
      note: { fontSize: 8, italics: true, color: "#94a3b8" },
    },
    defaultStyle: { font: "Roboto", fontSize: 9 },
  };

  pdfMake.createPdf(doc).download(fileName(calc, meta));
}

/** One plot as the report needs it: the picture, plus what the picture means. */
interface CapturedPlot {
  raster: SvgRasterResult;
  /** Empty when the chart has no legend — then none is printed. */
  legend: ChartLegendItem[];
}

/**
 * Capture one plot, re-throwing with the plot's name attached.
 *
 * Only the raster is load-bearing. A legend we cannot read costs the report a
 * key, not the report — so it is read outside the throwing path.
 */
async function capturePlot(svg: SVGSVGElement, label: string): Promise<CapturedPlot> {
  let raster: SvgRasterResult;
  try {
    raster = await rasterizeSvgElement(svg, { scale: 2, background: "#ffffff" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`could not capture the ${label} plot — ${reason}`);
  }
  let legend: ChartLegendItem[] = [];
  try {
    legend = readChartLegend(svg);
  } catch {
    legend = []; // unreadable legend markup — print the plot without a key
  }
  return { raster, legend };
}

/** One plot: caption, axis legend, the raster fitted into its box, its key. */
function plotColumn(
  title: string,
  plot: CapturedPlot,
  axes: string,
  fit: [number, number],
): Column {
  const stack: Content[] = [
    { text: title, style: "plotTitle" },
    { text: axes, style: "plotAxes", margin: [0, 0, 0, 4] },
    { image: plot.raster.dataUrl, fit, alignment: "center" },
  ];
  const legend = legendRow(plot.legend);
  if (legend) stack.push(legend);
  return { width: "*", stack };
}

/**
 * The chart's own legend, redrawn as vector shapes + text.
 *
 * A single-row borderless table rather than nested columns: table widths are
 * measured cell by cell, so a four-entry key cannot silently collapse or push
 * past the column. Padding is stripped to keep the row the height of one
 * swatch — the height `PAGE1_CHROME_PT` budgeted for it.
 */
function legendRow(items: ChartLegendItem[]): Content | null {
  if (items.length === 0) return null;
  const cells: Content[] = [];
  const widths: Array<number | string> = [];
  for (const item of items) {
    cells.push({ canvas: swatchCanvas(item) }, { text: item.label, style: "legendLabel" });
    widths.push(LEGEND_SWATCH_WIDTH, "auto");
  }
  return {
    table: { widths, body: [cells] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      // Column 0 of each pair is a swatch (gap before it, except the first);
      // column 1 is its label, snug against the swatch.
      paddingLeft: (i: number) => (i === 0 ? 0 : i % 2 === 0 ? LEGEND_ITEM_GAP : LEGEND_LABEL_GAP),
      paddingRight: () => 0,
    },
    margin: [0, LEGEND_MARGIN_TOP, 0, 0],
  };
}

/**
 * The sentence under the plots explaining what each marker MEANS — the part a
 * legend swatch cannot say (that the amber diamond is a KOP/EOC/Target).
 *
 * It only describes markers the captured legends actually carry: a survey with
 * no keypoints has no diamond on the chart and must not be told about one. If
 * no legend could be read at all we know nothing about the markers, and the
 * complete key is more use than a silently trimmed one.
 */
function markersNote(plots: readonly CapturedPlot[]): string {
  const shapes = new Set(plots.flatMap((p) => p.legend.map((item) => item.shape)));
  const clauses: Array<[ChartLegendItem["shape"], string]> = [
    ["triangle", "green triangle = first station (wellhead)"],
    ["dot", "red circle = last calculated station"],
    ["diamond", "amber diamond = profile keypoint (KOP / EOC / Target)"],
  ];
  const shown = shapes.size === 0
    ? clauses.map(([, text]) => text)
    : clauses.filter(([shape]) => shapes.has(shape)).map(([, text]) => text);
  return shown.length === 0 ? "" : `Markers: ${shown.join(" · ")}.`;
}

/**
 * Draw one swatch, matching the marker the chart draws for that series.
 * Everything stays inside 0…LEGEND_SWATCH_HEIGHT vertically, because pdfmake
 * measures a canvas node by the extent of what it contains.
 */
function swatchCanvas(item: ChartLegendItem): CanvasElement[] {
  const w = LEGEND_SWATCH_WIDTH;
  const h = LEGEND_SWATCH_HEIGHT;
  const cx = w / 2;
  const cy = h / 2;
  switch (item.shape) {
    case "line":
      return [{
        type: "line", x1: 0, y1: cy, x2: w, y2: cy, lineWidth: 2, lineColor: item.color,
      }];
    case "triangle":
      return [{
        type: "polyline", closePath: true, color: item.color,
        points: [{ x: cx, y: h }, { x: 1, y: 1 }, { x: w - 1, y: 1 }],
      }];
    case "diamond":
      return [{
        type: "polyline", closePath: true, color: item.color,
        points: [{ x: cx, y: 0 }, { x: w - 2, y: cy }, { x: cx, y: h }, { x: 2, y: cy }],
      }];
    case "square":
      return [{ type: "rect", x: 2, y: cy - 3.5, w: 7, h: 7, color: item.color }];
    case "dot":
    default:
      return [{ type: "ellipse", x: cx, y: cy, r1: 4, r2: 4, color: item.color }];
  }
}

/**
 * How tall the plot images may be so that page 1 stays one page.
 *
 * The identification block is the only part of page 1 whose height varies, and
 * `identificationBlock` deals `fieldCount` pairs into `ID_BLOCK_COLUMNS`
 * columns — so its worst case is `rows × (two wrapped lines + cell padding)`,
 * every value being bounded by `MAX_FIELD_VALUE_CHARS`. Whatever the body has
 * left after that and `PAGE1_CHROME_PT` goes to the plots.
 */
function plotFitFor(fieldCount: number): [number, number] {
  const rows = Math.min(Math.ceil(fieldCount / ID_BLOCK_COLUMNS), ID_BLOCK_MAX_ROWS);
  const idHeight = rows * (ID_ROW_MAX_LINES * line(ID_FONT_PT) + ID_ROW_PADDING_PT)
    + ID_BLOCK_MARGIN_BOTTOM;
  const available = BODY_HEIGHT_PT - PAGE1_CHROME_PT - idHeight;
  const height = Math.min(PLOT_FIT_MAX_HEIGHT, Math.max(PLOT_FIT_MIN_HEIGHT, Math.floor(available)));
  return [PLOT_FIT_WIDTH, height];
}

/**
 * Longest identification VALUE printed.
 *
 * A block column is ~185 pt wide and its label eats part of that, so 40
 * characters of 8 pt Roboto is about two lines — which is exactly what
 * `plotFitFor` reserves per row. Callers are expected to shorten their own
 * long fields more meaningfully than a blind cut can (CalculationPage trims
 * the profile chain on a segment boundary); this is the backstop that keeps
 * the page-1 budget true no matter what a caller hands us.
 *
 * U+2026 is in pdfmake's bundled Roboto (U+2192 is not — see `profileLabel`).
 */
const MAX_FIELD_VALUE_CHARS = 40;

/**
 * The well-identification block, as label/value pairs.
 *
 * Only fields with a real value are returned — see the module header for why
 * we omit rather than print a blank. Distances carry the project length unit.
 * Values are bounded; the list is capped at `ID_BLOCK_COLUMNS × ID_BLOCK_MAX_ROWS`
 * so a future field cannot quietly grow the block into page 2's space — adding
 * one past the cap means replacing one, deliberately.
 */
function identificationFields(
  calc: CalculationDetail,
  meta: DirectionalPlotMeta,
): Array<[string, string]> {
  const unit = meta.lengthUnit;
  const out: Array<[string, string]> = [];
  const push = (label: string, value: string | null | undefined): void => {
    const text = (value ?? "").trim();
    if (!text) return;
    out.push([label, text.length <= MAX_FIELD_VALUE_CHARS
      ? text
      : `${text.slice(0, MAX_FIELD_VALUE_CHARS - 1).trimEnd()}…`]);
  };
  const len = (value: number | null | undefined): string | null =>
    typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)} ${unit}` : null;

  push("Project", meta.projectName);
  push("Country", meta.countryName);
  push("Field", meta.fieldName);
  push("Well Name", meta.wellName);
  push("Well type", meta.wellType);
  push("Wellhead NS", len(meta.wellNs));
  push("Wellhead EW", len(meta.wellEw));
  push("Wellhead Elevation (MSL)", len(meta.wellMsl));
  push("Well TVD", len(meta.wellTvd));
  push("Well MD", len(meta.wellMd));
  push("Calculation", calc.name);
  push("Calculation Type", calc.type);
  push("Profile", meta.profileLabel);
  push("Length Unit", unit);
  push("Calculated Stations", String(calc.stations.length));
  push(
    "VS Reference Azimuth",
    typeof meta.vsecAzmDeg === "number" && Number.isFinite(meta.vsecAzmDeg)
      ? `${meta.vsecAzmDeg.toFixed(2)}°`
      : null,
  );
  push("Report Printed", new Date().toLocaleString());
  return out.slice(0, ID_BLOCK_COLUMNS * ID_BLOCK_MAX_ROWS);
}

/** Number of side-by-side columns the identification block is dealt into. */
const ID_BLOCK_COLUMNS = 4;
/** Rows per column the block may reach — the height `plotFitFor` reserves. */
const ID_BLOCK_MAX_ROWS = 5;
/** Lines one row may wrap to before the reservation stops being true. */
const ID_ROW_MAX_LINES = 2;
/** `fieldLabel` / `fieldValue` font size, and pdfmake's default cell padding. */
const ID_FONT_PT = 8;
const ID_ROW_PADDING_PT = 4;
/** Bottom margin the block below carries — see `identificationBlock`. */
const ID_BLOCK_MARGIN_BOTTOM = 10;

/** Lay the label/value pairs out as N borderless columns of two-cell rows. */
function identificationBlock(fields: Array<[string, string]>): Content {
  if (fields.length === 0) return { text: "", margin: [0, 0, 0, 8] };
  const perColumn = Math.ceil(fields.length / ID_BLOCK_COLUMNS);
  const columns: Column[] = [];
  for (let i = 0; i < ID_BLOCK_COLUMNS; i++) {
    const slice = fields.slice(i * perColumn, (i + 1) * perColumn);
    if (slice.length === 0) continue;
    columns.push({
      width: "*",
      table: {
        widths: ["auto", "*"],
        body: slice.map(([label, value]) => [
          { text: `${label}:`, style: "fieldLabel" },
          { text: value, style: "fieldValue" },
        ]),
      },
      layout: "noBorders",
    });
  }
  return { columns, columnGap: 14, margin: [0, 0, 0, 10] };
}

/** `WELL_CALC_directional_plot.pdf`, with anything non-word collapsed. */
function fileName(calc: CalculationDetail, meta: DirectionalPlotMeta): string {
  const slug = (s: string): string => s.replace(/\W+/g, "_").replace(/^_+|_+$/g, "");
  const parts = [slug(meta.wellName ?? ""), slug(calc.name), "directional_plot"].filter(Boolean);
  return `${parts.join("_")}.pdf`;
}
