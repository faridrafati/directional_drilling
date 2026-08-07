/**
 * Capture what a LIVE, on-screen Recharts chart shows, for a generated PDF:
 *
 *   `rasterizeSvgElement` — the plot surface, as a PNG data URL pdfmake can
 *                           embed, with no extra dependency.
 *   `readChartLegend`     — the chart's legend, as data, because the legend is
 *                           NOT part of the surface (see below).
 *
 * The raster pipeline is the only one the browser offers without a library:
 *
 *   clone → inline computed styles → XMLSerializer → data: URL
 *         → <img> decode → offscreen <canvas> at N× → canvas.toDataURL()
 *
 * WHY THE LEGEND IS READ AND NOT DRAWN
 * ------------------------------------
 * Recharts renders `<Legend>` into a `<div class="recharts-legend-wrapper">`
 * that is an absolutely-positioned SIBLING of `<svg class="recharts-surface">`
 * inside `.recharts-wrapper` — it is HTML, and it is outside the element this
 * module rasterizes. Capturing it as pixels would mean serializing that HTML
 * into a `<foreignObject>`, which drags the whole page cascade (flex layout,
 * the Tailwind webfont) into the `<img>` sandbox that cannot load fonts and
 * that WebKit refuses to paint at all. So we read the legend as DATA — label,
 * colour, marker shape, straight off the swatches the user is looking at — and
 * let the report redraw it as vector text in the report's own font. Nothing is
 * invented: a chart with no legend yields an empty array and the caller simply
 * prints no legend.
 *
 * WHY THE STYLE INLINING STEP EXISTS
 * ----------------------------------
 * An SVG loaded through `<img src="data:image/svg+xml,…">` is rendered as an
 * ISOLATED document: none of the host page's stylesheets apply to it, and it
 * is forbidden from fetching anything external (no network, no @font-face).
 * Recharts leans on inherited CSS for typography — the axis ticks, the axis
 * <Label>s and the marker labels get their family/size/weight from the page's
 * Tailwind body font, not from an attribute — so a naive serialize-and-draw
 * loses every piece of text styling, and text can disappear entirely where a
 * `fill` was inherited too.
 *
 * So we walk the source tree and the clone in lockstep and copy the RESOLVED
 * value of a small whitelist of presentation properties onto the clone as
 * inline style. `getComputedStyle` already folds in presentation attributes
 * (they act as the lowest-priority author rules), so the result is exactly
 * what the user sees on screen, self-contained.
 *
 * Fonts still cannot be embedded, so the family list is normalised to end in a
 * generic (`sans-serif`) and the renderer substitutes a local face. Metrics
 * shift slightly; the text is always present and legible, which is the point.
 *
 * …AND WHY IT IS NORMALISED FOR PAGE ZOOM
 * ---------------------------------------
 * The page renders inside a `zoom: 0.85` container. `measureSvg` deliberately
 * takes the SVG's width/height ATTRIBUTES so the raster's geometry is in
 * unzoomed user units. The inlined lengths have to agree with that geometry,
 * and browsers disagree about what `getComputedStyle` reports under `zoom`:
 * some hand back the USED value (zoom already multiplied in — a 12 px axis
 * font comes out as 10.2 px), others hand back the computed value untouched.
 * Mixing a zoomed font size into unzoomed geometry shrinks every label in the
 * exported PDF by the zoom factor.
 *
 * Rather than assume either behaviour, `measureComputedStyleZoom` ASKS: it
 * drops a hidden probe with a known `font-size` into the very SVG being
 * captured and reads it back. The ratio is 1 on a browser that reports
 * computed values (nothing is rescaled, so nothing can regress) and equals the
 * zoom factor on one that reports used values, in which case every inlined
 * <length> is divided by it. `currentCSSZoom`, where the browser exposes it,
 * is used only to sanity-check the measured ratio.
 *
 * Every failure path throws an Error with a message written for the user — the
 * caller surfaces it rather than emitting a PDF with a blank page.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * Presentation properties copied from the live element onto the clone.
 * Deliberately small: every entry costs a `getComputedStyle` read per node,
 * and copying layout properties (display/visibility/transform) risks changing
 * the picture rather than preserving it.
 */
const INLINED_STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-linecap",
  "stroke-linejoin",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "letter-spacing",
  "text-anchor",
  "dominant-baseline",
  "paint-order",
] as const;

/**
 * The subset of INLINED_STYLE_PROPS whose value carries <length>s. Only these
 * are rescaled when the browser bakes page zoom into computed values; colours,
 * keywords and unitless ratios must be copied through untouched.
 */
const LENGTH_STYLE_PROPS: ReadonlySet<string> = new Set([
  "stroke-width",
  "stroke-dasharray",
  "font-size",
  "letter-spacing",
]);

/**
 * Transient, cursor-driven decorations that must not be baked into a printed
 * report: the hover crosshair and the active-point dot only exist while the
 * mouse is over the chart, so whether they appear would depend on where the
 * pointer happened to be when the user clicked Export.
 */
const TRANSIENT_SELECTORS = [
  ".recharts-tooltip-cursor",
  ".recharts-active-dot",
  ".recharts-tooltip-wrapper",
];

export interface SvgRasterResult {
  /** `data:image/png;base64,…` — ready for a pdfmake `{ image }` node. */
  dataUrl: string;
  /** Logical (CSS px) size of the source SVG — use it to keep the aspect. */
  width: number;
  height: number;
}

export interface SvgRasterOptions {
  /** Pixel multiplier for print resolution. Clamped to [1, 4]. Default 2. */
  scale?: number;
  /** Canvas fill behind the drawing — SVG has no background. Default white. */
  background?: string;
  /** Give up after this many ms waiting for the browser to decode. */
  timeoutMs?: number;
}

/**
 * Rasterize `svg` to a PNG data URL.
 *
 * @throws Error with a user-facing message when the element has no rendered
 *   size, when the browser cannot decode the serialized SVG, or when the
 *   canvas refuses to produce a PNG.
 */
export async function rasterizeSvgElement(
  svg: SVGSVGElement,
  options: SvgRasterOptions = {},
): Promise<SvgRasterResult> {
  const scale = Math.max(1, Math.min(4, options.scale ?? 2));
  const { width, height } = measureSvg(svg);
  if (!(width > 0) || !(height > 0)) {
    throw new Error("the chart has no rendered size yet — let it finish drawing and try again");
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Order matters: the zoom probe adds and removes a node inside `svg`, so it
  // has to finish before `inlineComputedStyles` walks the two trees in
  // lockstep — and after the clone was taken, so the probe cannot be cloned.
  inlineComputedStyles(svg, clone, measureComputedStyleZoom(svg));
  for (const selector of TRANSIENT_SELECTORS) {
    clone.querySelectorAll(selector).forEach((node) => node.remove());
  }
  // A serialized fragment is not a document: it needs its own namespaces and
  // an explicit size, or the <img> has nothing to lay out against.
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", XLINK_NS);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  const markup = new XMLSerializer().serializeToString(clone);
  // encodeURIComponent (not btoa) — the markup carries "°", "→" and whatever
  // the user typed into a station comment, and btoa throws on non-Latin-1.
  const source = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = await loadImage(source, options.timeoutMs ?? 15_000);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("this browser did not provide a 2D canvas to render the chart into");
  ctx.fillStyle = options.background ?? "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch {
    // Only reachable if something tainted the canvas — an SVG with an external
    // <image> href would do it. Ours has none, but the message beats a crash.
    throw new Error("the browser blocked reading the rendered chart back from the canvas");
  }
  if (!dataUrl.startsWith("data:image/png")) {
    throw new Error("the browser produced no PNG for the chart");
  }
  return { dataUrl, width, height };
}

/**
 * Logical size of the SVG in CSS px.
 *
 * Prefers the width/height ATTRIBUTES (Recharts' ResponsiveContainer writes
 * concrete numbers there) over `getBoundingClientRect`, because the
 * Directional Drilling page renders inside a `zoom: 0.85` container and the
 * bounding rect comes back scaled — which would bake the page zoom into the
 * exported image.
 */
function measureSvg(svg: SVGSVGElement): { width: number; height: number } {
  const attrW = Number(svg.getAttribute("width"));
  const attrH = Number(svg.getAttribute("height"));
  if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
    return { width: attrW, height: attrH };
  }
  const box = svg.viewBox?.baseVal;
  if (box && box.width > 0 && box.height > 0) {
    return { width: box.width, height: box.height };
  }
  const rect = svg.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Copy resolved presentation styles from every node of `src` onto the matching
 * node of `dst`.
 *
 * The two trees are walked with the same document-order `querySelectorAll("*")`
 * enumeration. `dst` is a deep clone of `src`, so index i addresses the same
 * element in both; we still guard on the shorter length in case a browser
 * extension mutated the live tree mid-walk.
 *
 * `styleZoom` is what `measureComputedStyleZoom` measured: the factor this
 * browser multiplied into the <length>s it just reported. 1 means "reported
 * them as authored", and then nothing here changes.
 */
function inlineComputedStyles(src: SVGSVGElement, dst: SVGSVGElement, styleZoom: number): void {
  const srcNodes: Element[] = [src, ...Array.from(src.querySelectorAll("*"))];
  const dstNodes: Element[] = [dst, ...Array.from(dst.querySelectorAll("*"))];
  const count = Math.min(srcNodes.length, dstNodes.length);
  for (let i = 0; i < count; i++) {
    const computed = window.getComputedStyle(srcNodes[i]);
    let declarations = "";
    for (const prop of INLINED_STYLE_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (!value) continue;
      const emitted = prop === "font-family"
        ? withGenericFallback(value)
        : LENGTH_STYLE_PROPS.has(prop)
          ? unzoomLengths(value, styleZoom)
          : value;
      declarations += `${prop}:${emitted};`;
    }
    if (!declarations) continue;
    const existing = dstNodes[i].getAttribute("style") ?? "";
    // Ours goes LAST so it wins: the computed value already folded in whatever
    // that inline style said, so this is a no-op where they agree.
    dstNodes[i].setAttribute("style", existing ? `${existing};${declarations}` : declarations);
  }
}

/** Font size the zoom probe asks for. Large enough that the reported value's
 *  rounding (browsers round resolved lengths) cannot swamp the ratio. */
const ZOOM_PROBE_PX = 100;

/**
 * How much this browser multiplied page zoom into the computed <length>s of
 * elements inside `svg` — 1 when it did not.
 *
 * Measured, not assumed: a hidden `<text>` with a known `font-size` is placed
 * in the live SVG (same zoom context as everything we are about to read),
 * `getComputedStyle` is asked what that size resolved to, and the node is
 * removed again. Both operations are synchronous, so no frame is painted in
 * between and nothing flickers.
 *
 * Anything that is neither ~1 nor ~`currentCSSZoom` is treated as 1: a page
 * stylesheet forcing `font-size` on `text` with `!important` would otherwise
 * be read as an enormous "zoom" and blow every label up.
 */
function measureComputedStyleZoom(svg: SVGSVGElement): number {
  const doc = svg.ownerDocument;
  if (!doc || typeof window.getComputedStyle !== "function") return 1;
  const probe = doc.createElementNS(SVG_NS, "text");
  probe.setAttribute("style", `font-size:${ZOOM_PROBE_PX}px;visibility:hidden`);
  svg.appendChild(probe);
  try {
    const reported = Number.parseFloat(
      window.getComputedStyle(probe).getPropertyValue("font-size"),
    );
    if (!Number.isFinite(reported) || reported <= 0) return 1;
    const ratio = reported / ZOOM_PROBE_PX;
    if (Math.abs(ratio - 1) <= 0.005) return 1;
    // `currentCSSZoom` (where implemented) states the element's effective zoom
    // independently of how computed values are reported — a free cross-check.
    const declared = (probe as Element & { currentCSSZoom?: number }).currentCSSZoom;
    if (typeof declared === "number" && declared > 0) {
      return Math.abs(ratio - declared) <= 0.01 ? declared : 1;
    }
    return ratio >= 0.2 && ratio <= 5 ? ratio : 1;
  } finally {
    probe.remove();
  }
}

/**
 * Divide every `<n>px` in a computed value by `factor`, recovering the length
 * as authored. Handles the list-valued ones too (`stroke-dasharray` comes back
 * as "3px, 3px") and leaves keywords such as `normal` alone.
 */
function unzoomLengths(value: string, factor: number): string {
  if (!(factor > 0) || Math.abs(factor - 1) <= 0.005) return value;
  return value.replace(/(-?(?:\d+\.?\d*|\.\d+))px/g, (_match, n: string) => {
    const scaled = Number(n) / factor;
    return Number.isFinite(scaled) ? `${Math.round(scaled * 1e4) / 1e4}px` : `${n}px`;
  });
}

/* ───────────────────────── the legend, as data ───────────────────────── */

/** Marker a legend swatch draws, mapped onto shapes a PDF can redraw. */
export type ChartLegendShape = "line" | "triangle" | "dot" | "diamond" | "square";

/** One entry of a chart's legend, read off the live DOM. */
export interface ChartLegendItem {
  /** The text next to the swatch, exactly as the chart shows it. */
  label: string;
  /** `#rrggbb` — PDFKit rejects the `rgb(…)` strings getComputedStyle returns. */
  color: string;
  shape: ChartLegendShape;
}

/** SVG elements a swatch can be built from, in the order we recognise them. */
const SWATCH_TAGS: ReadonlySet<string> = new Set([
  "line", "polyline", "polygon", "circle", "ellipse", "rect", "path",
]);

/** Used when a swatch's colour cannot be resolved — the label still identifies
 *  the series, so dropping the entry would lose more than a grey marker does. */
const UNRESOLVED_SWATCH_COLOR = "#475569";

/** Guards against a runaway legend eating the report's page-1 height budget. */
const MAX_LEGEND_ITEMS = 12;
const MAX_LEGEND_LABEL_CHARS = 24;

/**
 * Read the legend belonging to the chart whose surface is `svg`.
 *
 * Recharts puts the legend in `.recharts-legend-wrapper`, a sibling of the
 * surface under `.recharts-wrapper`, so it is found by walking UP from the
 * surface rather than querying inside it.
 *
 * Returns `[]` — never a guess — when the chart has no legend, when the
 * swatches cannot be interpreted, or when anything about the markup is not
 * what we expect. The report then prints no legend for that plot.
 */
export function readChartLegend(svg: SVGSVGElement): ChartLegendItem[] {
  const wrapper = svg.closest(".recharts-wrapper") ?? svg.parentElement;
  const legend = wrapper?.querySelector(".recharts-legend-wrapper");
  if (!legend) return [];

  const items: ChartLegendItem[] = [];
  const seen = new Set<string>();
  for (const swatch of Array.from(legend.querySelectorAll("svg"))) {
    if (items.length >= MAX_LEGEND_ITEMS) break;
    const label = legendLabelFor(swatch, legend);
    if (!label || seen.has(label)) continue;
    const drawn = swatchShape(swatch);
    if (!drawn) continue;
    seen.add(label);
    items.push({ label, ...drawn });
  }
  return items;
}

/**
 * The text that belongs to one swatch.
 *
 * Climbs from the swatch towards the legend root and takes the first ancestor
 * that holds this swatch AND NO OTHER — that element's text is this entry's
 * label. The "no other" test is what stops us at the per-item `<span>` (or the
 * `<li>` of Recharts' default legend) instead of scooping up the whole row's
 * text as one run-on label.
 */
function legendLabelFor(swatch: Element, stopAt: Element): string | null {
  let node: Element | null = swatch.parentElement;
  for (let depth = 0; node && depth < 4; depth++) {
    if (node.querySelectorAll("svg").length === 1) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) {
        return text.length <= MAX_LEGEND_LABEL_CHARS
          ? text
          : `${text.slice(0, MAX_LEGEND_LABEL_CHARS - 1)}…`;
      }
    }
    if (node === stopAt) break;
    node = node.parentElement;
  }
  return null;
}

/** Classify a swatch's marker and pull the colour it is actually painted in. */
function swatchShape(swatch: Element): { shape: ChartLegendShape; color: string } | null {
  const drawn = Array.from(swatch.querySelectorAll("*"))
    .find((node) => SWATCH_TAGS.has(node.tagName.toLowerCase()));
  if (!drawn) return null;

  const tag = drawn.tagName.toLowerCase();
  let shape: ChartLegendShape;
  if (tag === "circle" || tag === "ellipse") {
    shape = "dot";
  } else if (tag === "rect") {
    shape = "square";
  } else if (tag === "polygon") {
    // "9,12 3,3 15,3" → 3 points → triangle; 4 → diamond.
    const coords = (drawn.getAttribute("points") ?? "").trim().split(/[\s,]+/).filter(Boolean);
    shape = coords.length === 6 ? "triangle" : coords.length === 8 ? "diamond" : "square";
  } else {
    shape = "line";
  }
  return { shape, color: swatchColor(drawn, shape) };
}

/**
 * A swatch's colour. A stroked marker (the trajectory rule) carries it on
 * `stroke`; a filled one (triangle / dot / diamond) carries it on `fill` and
 * uses `stroke` for the white halo, so the two are tried in the order that
 * matches the shape.
 */
function swatchColor(drawn: Element, shape: ChartLegendShape): string {
  const computed = window.getComputedStyle(drawn);
  const fill = computed.getPropertyValue("fill");
  const stroke = computed.getPropertyValue("stroke");
  for (const candidate of shape === "line" ? [stroke, fill] : [fill, stroke]) {
    const hex = toHexColor(candidate);
    if (hex) return hex;
  }
  return UNRESOLVED_SWATCH_COLOR;
}

/** `rgb(30, 64, 175)` → `#1e40af`. null for none/transparent/unparseable. */
function toHexColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v || v === "none" || v === "transparent" || v === "currentcolor") return null;
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (!m) return null;
  if (m[4] !== undefined) {
    const alpha = m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    if (!(alpha > 0)) return null; // fully transparent — nothing is painted
  }
  const byte = (n: string): string =>
    Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0");
  return `#${byte(m[1])}${byte(m[2])}${byte(m[3])}`;
}

/** Generic CSS font families — a stack ending in one of these always renders. */
const GENERIC_FAMILIES = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui"];

/**
 * Guarantee the family list ends in a generic. Webfonts (@fontsource Fira
 * Sans, here) cannot follow the SVG into the `<img>` sandbox, so without a
 * generic tail the renderer is free to fall back to nothing at all.
 */
function withGenericFallback(family: string): string {
  const hasGeneric = family
    .split(",")
    .some((part) => GENERIC_FAMILIES.includes(part.trim().replace(/^["']|["']$/g, "").toLowerCase()));
  return hasGeneric ? family : `${family}, sans-serif`;
}

/** Decode a data URL into an `<img>`, rejecting on error or timeout. */
function loadImage(source: string, timeoutMs: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("timed out while the browser rendered the chart image"));
    }, timeoutMs);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error("the browser could not decode the chart into an image"));
    };
    image.src = source;
  });
}
