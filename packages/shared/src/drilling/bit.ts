/**
 * Bit identity helpers: parse the free-text size label into inches and
 * classify the cutter family (roller-cone vs PDC / fixed-cutter).
 */

/**
 * Parse a bit / hole size label into inches.
 * Handles mixed fractions ("12 1/4" → 12.25), bare fractions ("3/4" → 0.75),
 * and decimals ("5.875", "26"). Returns `null` for anything unparseable or
 * outside a sane (0, 60) inch range.
 */
export function parseBitSizeInches(label: string | null | undefined): number | null {
  if (label == null) return null;
  const t = String(label).trim();
  if (!t) return null;
  let inches: number | null = null;
  let m = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/); // "12 1/4"
  if (m) inches = Number(m[1]) + Number(m[2]) / Number(m[3]);
  else if ((m = t.match(/^(\d+)\/(\d+)$/))) inches = Number(m[1]) / Number(m[2]); // "3/4"
  else if (/^\d+(?:\.\d+)?$/.test(t)) inches = Number(t); // "5.875" / "26"
  if (inches == null || !Number.isFinite(inches) || inches <= 0 || inches >= 60) return null;
  return inches;
}

export type BitClass = "PDC" | "roller";

/**
 * Classify a bit run's cutter family. By IADC convention, fixed-cutter / PDC
 * bits carry a letter-prefixed code (e.g. "M323"), while roller-cone bits use a
 * purely numeric code (e.g. "537"). The diamond flag and type text are used as
 * fallbacks. Defaults to "roller" when no signal is available.
 */
export function bitClass(opts: {
  iadc?: string | null;
  type?: string | null;
  diamond?: boolean | null;
}): BitClass {
  const iadc = (opts.iadc ?? "").trim();
  if (/^[A-Za-z]/.test(iadc)) return "PDC"; // letter-prefixed IADC ⇒ fixed-cutter
  if (/^\d/.test(iadc)) return "roller";    // numeric IADC ⇒ roller-cone
  if (opts.diamond === true) return "PDC";
  const type = (opts.type ?? "").toUpperCase();
  if (/\b(PDC|FC|FX|MX|DSX|DRILL\s*BIT)\b/.test(type)) return "PDC";
  return "roller";
}
