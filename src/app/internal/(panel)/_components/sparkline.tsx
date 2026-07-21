import { formatMetricValue } from './format';

export type SparklinePoint = {
  date: string;
  value: number;
};

export type SparklineProps = Readonly<{
  points: SparklinePoint[];
  unit: string | null;
  label: string;
}>;

const WIDTH = 320;
const HEIGHT = 64;
const PADDING = 8;
// Leaves room for the end-marker's surface ring so it is never clipped.
const RIGHT_PADDING = 14;

// A single-series trend, so: no legend (the tile's label names it), one hue,
// 2px line, an end-marker with a 2px surface ring, and only the endpoint
// directly labelled — the full series stays readable in the table underneath.
export function Sparkline({ points, unit, label }: SparklineProps) {
  if (points.length < 2) {
    return <p className="text-caption text-text-tertiary">Needs at least two snapshots to show a trend.</p>;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat series would divide by zero; render it as a centred straight line.
  const span = max - min || 1;

  const innerWidth = WIDTH - PADDING - RIGHT_PADDING;
  const innerHeight = HEIGHT - PADDING * 2;

  const coords = points.map((point, index) => ({
    x: PADDING + (index / (points.length - 1)) * innerWidth,
    y: max === min ? HEIGHT / 2 : PADDING + (1 - (point.value - min) / span) * innerHeight,
    point
  }));

  const path = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'}${coord.x.toFixed(2)},${coord.y.toFixed(2)}`).join(' ');
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-16 w-full"
      role="img"
      aria-label={`${label}: ${points.length} snapshots from ${formatMetricValue(String(points[0].value), unit)} to ${formatMetricValue(String(last.point.value), unit)}`}
    >
      {/* Hairline baseline, one step off the surface — recessive by design. */}
      <line x1={PADDING} y1={HEIGHT - PADDING} x2={WIDTH - RIGHT_PADDING} y2={HEIGHT - PADDING} className="stroke-border" strokeWidth={1} />

      <path d={path} fill="none" className="stroke-brand" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {coords.map((coord) => (
        // Native tooltips per point: the whole series is also in the table below,
        // so nothing here is gated behind hover.
        <circle key={coord.point.date} cx={coord.x} cy={coord.y} r={4} className="fill-brand opacity-0 transition-opacity hover:opacity-100">
          <title>{`${coord.point.date}: ${formatMetricValue(String(coord.point.value), unit)}`}</title>
        </circle>
      ))}

      {/* End marker: 8px, with a 2px ring in the surface colour so it stays
          legible where it sits on the line. */}
      <circle cx={last.x} cy={last.y} r={4} className="fill-brand stroke-surface" strokeWidth={2} />
    </svg>
  );
}
