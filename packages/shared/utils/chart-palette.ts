/**
 * Categorical palette for multi-series charts.
 *
 * DESIGN.md names iOS teal as *the* data-visualisation accent, which answers
 * "what colour is this ring" but not "what eight colours does a stacked shift
 * chart use". Before this existed each chart picked its own hexes — the shift
 * distribution chart alone shipped Tailwind blue/emerald/amber/violet/red/cyan/
 * pink/gray, none of them from the palette, and the trend chart used a
 * different set again.
 *
 * These are the five iOS system hues first, then the 700 steps of the three
 * that stay legible when darkened. Everything here is a value the design system
 * already owns (see `design-tokens.js`), so a chart is never the reason a new
 * colour enters the product.
 *
 * Order matters: the first five are maximally distinguishable from each other,
 * so a chart with three or four series gets the strongest separation for free.
 * Beyond eight series, colour stops carrying the distinction — use direct
 * labels, small multiples, or grouping instead of extending this array.
 */
export const CHART_SERIES_COLORS = [
  "#007AFF", // ios-blue
  "#34C759", // ios-green
  "#FF9500", // ios-orange
  "#30B0C7", // ios-teal
  "#FF3B30", // ios-red
  "#084E9D", // ios-blue 700
  "#267B3D", // ios-green 700
  "#9B5E09", // ios-orange 700
] as const;

/** Neutral grey for "other"/"unknown" buckets — never one of the series hues. */
export const CHART_NEUTRAL_COLOR = "#8E8E93"; // ios secondary text

/** Hairline grid/axis colour, matching the DESIGN.md separator. */
export const CHART_GRID_COLOR = "rgba(28, 28, 30, 0.06)";

/**
 * Series colour by index, wrapping rather than returning undefined so a chart
 * with more series than colours degrades to repeats instead of blank marks.
 */
export function chartSeriesColor(index: number): string {
  const palette = CHART_SERIES_COLORS;
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/** `#RRGGBB` as `rgba(...)` at a given alpha, for fills under a solid stroke. */
export function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Series colour as `rgba(...)` at a given alpha, for chart fills that sit under
 * a solid stroke of the same hue.
 */
export function chartSeriesColorAlpha(index: number, alpha: number): string {
  return withAlpha(chartSeriesColor(index), alpha);
}

/**
 * Semantic series colours for metrics whose meaning is fixed, so the same
 * metric is the same colour in every chart that plots it.
 */
export const CHART_METRIC_COLORS: Record<string, string> = {
  revenue: "#007AFF", // money — primary
  total_orders: "#FF9500", // volume — warning/attention hue, high visibility
  completion_rate: "#34C759", // success
  avg_prep_time: "#30B0C7", // timing — data accent
  cancellations: "#FF3B30", // failure
};
