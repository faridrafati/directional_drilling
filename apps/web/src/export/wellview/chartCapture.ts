/**
 * Getting a live Recharts panel into a PDF — shared by every charted report in
 * the suite (08, 09, 10, 11).
 *
 * The rule these reports follow, set by the directional-plot export before them:
 * the printed chart is rasterized from the SVG the user is looking at, so the
 * page can never show a different series set from the preview. If the chart is
 * not mounted this THROWS with a message meant for the user and no file is
 * produced — a blank panel on a signed report is worse than an error.
 *
 * Recharts renders its legend as an HTML sibling of the SVG rather than inside
 * it, so the raster never contains one. `readChartLegend` reads the swatches off
 * the DOM and `legendRow` redraws them as pdfmake vectors, which is why the
 * printed key names the series the chart actually has and none it does not.
 *
 * Lifted out of `phases.ts` when report 08 became the third caller: three copies
 * of a capture-or-throw rule is how one of them quietly stops throwing.
 */
import type { CanvasElement, Content } from "pdfmake/interfaces";
import {
  rasterizeSvgElement, readChartLegend,
  type ChartLegendItem, type SvgRasterResult,
} from "../svgRaster.js";

/** One plot as a report needs it: the picture, and what the picture means. */
export interface CapturedChart {
  raster: SvgRasterResult;
  legend: ChartLegendItem[];
}

/**
 * Find the live chart by the id its preview stamps, and rasterize it at 2×.
 *
 * Throws with a user-facing message when it is not on screen — the caller lets
 * that surface rather than downloading a report with a hole in it.
 */
export async function captureChart(
  containerId: string,
  label: string,
  /**
   * Pixels per CSS pixel. 2 is the default and the right answer for a plot that
   * prints near its on-screen width. A report that prints four panels at half
   * width (09) is already oversampled at 1.5, and the four 2× rasters together
   * pushed its export past thirty seconds.
   */
  scale = 2,
): Promise<CapturedChart> {
  const svg = document.getElementById(containerId)?.querySelector("svg");
  if (!svg) {
    throw new Error(
      `the ${label} is not on screen — let the preview finish drawing before exporting`,
    );
  }
  let raster: SvgRasterResult;
  try {
    raster = await rasterizeSvgElement(svg as SVGSVGElement, { scale, background: "#ffffff" });
  } catch (err) {
    throw new Error(`could not capture the ${label} — ${err instanceof Error ? err.message : String(err)}`);
  }
  let legend: ChartLegendItem[] = [];
  // An unreadable legend costs the report a key, not the report.
  try { legend = readChartLegend(svg as SVGSVGElement); } catch { legend = []; }
  return { raster, legend };
}

const SWATCH_W = 14;
const SWATCH_H = 9;

/** The chart's own key, redrawn as vector shapes so it prints as it looks. */
export function legendRow(items: ChartLegendItem[]): Content | null {
  if (items.length === 0) return null;
  const cells: Content[] = [];
  const widths: Array<number | string> = [];
  for (const item of items) {
    cells.push({ canvas: swatch(item) }, { text: item.label, style: "cellLabel" });
    widths.push(SWATCH_W, "auto");
  }
  return {
    table: { widths, body: [cells] },
    layout: {
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : i % 2 === 0 ? 8 : 3),
      paddingRight: () => 0,
    },
    margin: [0, 4, 0, 0],
  };
}

function swatch(item: ChartLegendItem): CanvasElement[] {
  const cy = SWATCH_H / 2;
  switch (item.shape) {
    case "line":
      return [{ type: "line", x1: 0, y1: cy, x2: SWATCH_W, y2: cy, lineWidth: 2, lineColor: item.color }];
    case "square":
      return [{ type: "rect", x: 1, y: cy - 3.5, w: 7, h: 7, color: item.color }];
    default:
      return [{ type: "ellipse", x: SWATCH_W / 2, y: cy, r1: 3.5, r2: 3.5, color: item.color }];
  }
}
