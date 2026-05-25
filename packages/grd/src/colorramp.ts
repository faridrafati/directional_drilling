/**
 * Color ramps for raster grids.
 * The default mirrors Form22.imageone — red→orange→yellow→lime→aqua→blue→purple.
 */

export type Ramp = "spectrum" | "grayscale" | "warm";

export interface RGB { r: number; g: number; b: number }

/** Stops for the named ramp, in band order (low → high). */
const STOPS: Record<Ramp, RGB[]> = {
  spectrum: [
    { r: 255, g: 0,   b: 0   }, // red
    { r: 255, g: 128, b: 0   }, // orange
    { r: 255, g: 255, b: 0   }, // yellow
    { r: 0,   g: 255, b: 0   }, // lime
    { r: 0,   g: 255, b: 255 }, // aqua
    { r: 0,   g: 0,   b: 255 }, // blue
    { r: 128, g: 0,   b: 128 }, // purple
  ],
  grayscale: [
    { r: 240, g: 240, b: 240 },
    { r: 32,  g: 32,  b: 32  },
  ],
  warm: [
    { r: 255, g: 255, b: 224 },
    { r: 255, g: 200, b: 100 },
    { r: 220, g: 80,  b: 20  },
    { r: 90,  g: 0,   b: 0   },
  ],
};

/** Look up the RGB color for a normalized value t ∈ [0,1]. */
export function sample(ramp: Ramp, t: number): RGB {
  const stops = STOPS[ramp];
  if (t <= 0) return stops[0];
  if (t >= 1) return stops[stops.length - 1];
  const scaled = t * (stops.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  return {
    r: Math.round(a.r + (b.r - a.r) * f),
    g: Math.round(a.g + (b.g - a.g) * f),
    b: Math.round(a.b + (b.b - a.b) * f),
  };
}

/** Get the stops directly (useful for legends). */
export function rampStops(ramp: Ramp): RGB[] {
  return STOPS[ramp].slice();
}
