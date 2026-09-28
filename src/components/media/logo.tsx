import * as React from 'react';

import { cn } from '@/lib/utils';

// Idion mark geometry, traced from the master artwork and normalised to a
// 100×100 box: a thin outer orbit broken by a ~17° gap at one o'clock, a heavy
// inner ring, and a sage core. The gap is the idea — a loop that is almost
// closed, and keeps turning.
const CENTER = 50;
const OUTER_R = 46;
const INNER_R = 25;
const CORE_R = 8.25;
const GAP_START = -40; // degrees, SVG convention (0° = 3 o'clock, clockwise)
const GAP_END = -57;

const point = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${(CENTER + r * Math.cos(rad)).toFixed(2)} ${(CENTER + r * Math.sin(rad)).toFixed(2)}`;
};

const OUTER_ARC = `M ${point(GAP_START, OUTER_R)} A ${OUTER_R} ${OUTER_R} 0 1 1 ${point(GAP_END, OUTER_R)}`;

const strokeWeights = {
  // Small sizes (navbar, footer, favicon): heavier so the hairline survives.
  bold: { outer: 3.2, inner: 6.5 },
  // Large, decorative sizes: the master artwork's proportions.
  fine: { outer: 1, inner: 3.6 }
} as const;

export type IdionMarkProps = React.SVGAttributes<SVGSVGElement> & {
  weight?: keyof typeof strokeWeights;
  /** Rotate the outer orbit slowly and breathe the core. Honours reduced motion. */
  animated?: boolean;
  /** Drop the sage core — for large, faint decorative ring fields. */
  showCore?: boolean;
};

// Rings draw in `currentColor`, so the mark follows the text colour of
// whatever surrounds it; the core always reads `--color-brand` (sage on Idion).
export function IdionMark({ weight = 'bold', animated = false, showCore = true, className, ...props }: IdionMarkProps) {
  const stroke = strokeWeights[weight];

  return (
    <svg aria-hidden="true" viewBox="0 0 100 100" fill="none" className={cn('shrink-0', className)} {...props}>
      <g
        className={animated ? 'motion-safe:animate-orbit' : undefined}
        style={animated ? { transformOrigin: '50px 50px' } : undefined}
      >
        <path d={OUTER_ARC} stroke="currentColor" strokeWidth={stroke.outer} />
      </g>
      <circle cx={CENTER} cy={CENTER} r={INNER_R} stroke="currentColor" strokeWidth={stroke.inner} />
      {showCore ? <circle cx={CENTER} cy={CENTER} r={CORE_R} className={cn('fill-brand', animated && 'motion-safe:animate-core-pulse')} /> : null}
    </svg>
  );
}

export type LogoProps = React.HTMLAttributes<HTMLSpanElement> & {
  label?: string;
  /** Hide the mark and render the wordmark alone. */
  showMark?: boolean;
  /** Second line under the wordmark, as in the lockup ("Venture Studio"). */
  descriptor?: string;
};

// Idion Labs lockup: the mark beside the name set in the light geometric
// display face, uppercase and widely tracked like the master artwork. The
// wordmark inherits its colour from the surrounding link so hover/active
// states just work.
export function Logo({ label = 'Idion Labs', showMark = true, descriptor, className, ...props }: LogoProps) {
  return (
    <span aria-label={label} className={cn('inline-flex items-center gap-2.5', className)} {...props}>
      {showMark ? <IdionMark className="h-[1.6em] w-[1.6em]" /> : null}
      <span className="flex flex-col leading-none">
        <span className="mr-[-0.3em] font-display text-[0.95em] font-light uppercase tracking-[0.3em]">{label}</span>
        {descriptor ? (
          <span className="mr-[-0.42em] mt-1.5 font-display text-[0.5em] font-normal uppercase tracking-[0.42em] text-text-tertiary">{descriptor}</span>
        ) : null}
      </span>
    </span>
  );
}
