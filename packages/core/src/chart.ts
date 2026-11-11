/**
 * Pure SVG line-chart geometry. The Y range comes only from the data and the
 * user's own (vet-entered) threshold values — never from a default "normal" range.
 */
export interface ChartInput {
  /** Epoch ms + numeric reading, any order. */
  points: { t: number; v: number }[];
  /** Threshold values the user entered from their vet. Empty = draw no line. */
  thresholds: number[];
  width: number;
  height: number;
  pad?: { top: number; right: number; bottom: number; left: number };
}

export interface ChartModel {
  path: string;
  dots: { x: number; y: number; v: number; t: number }[];
  thresholdLines: { y: number; value: number }[];
  yMin: number;
  yMax: number;
}

export function buildLineChart(input: ChartInput): ChartModel | null {
  const { points, thresholds, width, height } = input;
  if (points.length === 0) return null;
  const pad = input.pad ?? { top: 12, right: 12, bottom: 12, left: 12 };
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const values = [...sorted.map((p) => p.v), ...thresholds];
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const margin = (yMax - yMin) * 0.1;
  yMin -= margin;
  yMax += margin;
  const tMin = sorted[0].t;
  const tMax = sorted[sorted.length - 1].t;
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const x = (t: number) => pad.left + (tMax === tMin ? w / 2 : ((t - tMin) / (tMax - tMin)) * w);
  const y = (v: number) => pad.top + (1 - (v - yMin) / (yMax - yMin)) * h;
  const r = (n: number) => Math.round(n * 10) / 10;
  const dots = sorted.map((p) => ({ x: r(x(p.t)), y: r(y(p.v)), v: p.v, t: p.t }));
  return {
    path: dots.map((d, i) => `${i ? 'L' : 'M'}${d.x} ${d.y}`).join(' '),
    dots,
    thresholdLines: thresholds.map((value) => ({ value, y: r(y(value)) })),
    yMin,
    yMax,
  };
}
