import { Badge } from '@/components/primitives';
import { Body } from '@/components/typography';
import { cn } from '@/lib/utils';

import { findWeakestStage, formatPercent, type FunnelStep } from './funnel';

// Horizontal bars, widest at the top of the funnel, each scaled against the
// top stage's value. Simple over a real funnel-shape SVG deliberately: bars
// remain legible with a zero anywhere in the middle, which a wedge shape
// hides badly, and this is the shape every stage of building this out
// (adding stages, empty weeks, tiny numbers) needs to stay correct.
export function FunnelChart({ steps, compact = false }: Readonly<{ steps: FunnelStep[]; compact?: boolean }>) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  const weakest = findWeakestStage(steps);

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      {steps.map((step) => {
        const widthPct = Math.max(2, (step.value / max) * 100);
        const isWeakest = weakest?.key === step.key;

        return (
          <div key={step.key} className="flex flex-col gap-1">
            <div className={cn('flex items-baseline justify-between gap-2', compact ? 'text-xs' : 'text-sm')}>
              <span className="font-medium text-text-primary">{step.label}</span>
              <span className="flex items-center gap-2 tabular-nums text-text-secondary">
                {step.value.toLocaleString()}
                {step.stepRate !== null ? (
                  <Badge tone={isWeakest ? 'error' : 'neutral'} className={compact ? 'px-1.5 py-0.5 text-[10px]' : undefined}>
                    {formatPercent(step.stepRate)}
                  </Badge>
                ) : null}
              </span>
            </div>
            <div className={cn('rounded-full bg-surface-subtle', compact ? 'h-2' : 'h-3')}>
              <div
                className={cn('rounded-full transition-all', isWeakest ? 'bg-error' : 'bg-brand')}
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}

      {weakest ? (
        <Body className={cn('text-text-secondary', compact ? 'text-xs' : 'text-sm')}>
          Biggest drop-off: <span className="font-medium text-text-primary">{weakest.label}</span> converts at{' '}
          <span className="font-medium text-error">{formatPercent(weakest.stepRate)}</span> from the previous stage.
        </Body>
      ) : null}
    </div>
  );
}
