import { buildLineChart } from '@atticus/core';

const W = 480;
const H = 160;

/**
 * Server-rendered SVG (zero client JS). Shows ONLY the user's own vet-entered
 * threshold line(s); with none set it draws no line and no default range.
 */
export function BreathingChart({
  points,
  thresholds,
}: {
  points: { t: number; v: number }[];
  thresholds: { comparator: string; value: number; unit: string; vet_instruction: string | null }[];
}) {
  const model = buildLineChart({ points, thresholds: thresholds.map((t) => t.value), width: W, height: H });
  if (!model) {
    return <p className="text-muted">No breathing counts in the last 14 days.</p>;
  }
  const latest = model.dots[model.dots.length - 1];
  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Breathing rate, last 14 days. Latest ${latest.v} breaths per minute.${
          thresholds.length ? ` Your vet's threshold: ${thresholds.map((t) => `${t.comparator} ${t.value}`).join(', ')}.` : ''
        }`}
        className="h-auto w-full"
      >
        {model.thresholdLines.map((l) => (
          <line key={l.value} x1="0" x2={W} y1={l.y} y2={l.y} stroke="var(--threshold)" strokeWidth="2" strokeDasharray="6 4" />
        ))}
        <path d={model.path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {model.dots.map((d) => (
          <circle key={d.t} cx={d.x} cy={d.y} r="3.5" fill="var(--accent)" />
        ))}
      </svg>
      <figcaption className="text-sm text-muted">
        {thresholds.length === 0 ? (
          'No threshold set yet — ask your vet what number to watch for.'
        ) : (
          thresholds.map((t) => (
            <span key={t.value} className="block">
              <span className="text-threshold">- - -</span> Your vet&apos;s threshold: {t.comparator} {t.value} {t.unit}
              {t.vet_instruction ? ` — “${t.vet_instruction}”` : ''}
            </span>
          ))
        )}
      </figcaption>
    </figure>
  );
}
