import * as React from 'react';
import { ArrowUp, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';

export type PipelineStage = Readonly<{
  key: string;
  title: string;
  description: string;
  /** The agents that own the stage, one line, `·`-separated. */
  agents?: string;
}>;

export type PipelineDiagramProps = Readonly<{
  stages: PipelineStage[];
  /** Label on the return arc: the loop that makes it a system, not a line. */
  loopLabel: string;
  className?: string;
}>;

// Conceive → Build → Deploy → Scale, drawn as a track of nodes over four
// stage cards, with a return arc underneath from the last stage back to the
// first. On narrow screens it becomes a vertical rail and the arc collapses
// into a closing "loop" row, so the idea survives without the geometry.
export function PipelineDiagram({ stages, loopLabel, className }: PipelineDiagramProps) {
  return (
    <div className={cn('relative', className)}>
      <ol className="relative grid gap-4 lg:grid-cols-4">
        {/* Horizontal track through the node centres (desktop). */}
        <span aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-[1.375rem] hidden h-px bg-gradient-to-r from-border-strong via-orbit/30 to-border-strong lg:block" />
        {/* Vertical rail (mobile). */}
        <span aria-hidden="true" className="absolute bottom-0 left-[1.375rem] top-0 w-px bg-border-strong lg:hidden" />

        {stages.map((stage, index) => (
          <li key={stage.key} className="relative flex gap-4 lg:flex-col lg:items-center lg:gap-5">
            <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background">
              <span className="absolute inset-[5px] rounded-full border border-orbit/20" />
              <span className={cn('h-2 w-2 rounded-full', index === 0 ? 'bg-brand shadow-glow' : 'bg-orbit/60')} />
            </span>
            <div className="h-full w-full rounded-lg border border-border bg-surface/60 p-5 backdrop-blur-sm transition-colors duration-300 hover:border-border-strong">
              <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{String(index + 1).padStart(2, '0')}</div>
              <h3 className="mt-3 font-display text-h3 font-normal text-text-primary">{stage.title}</h3>
              <p className="mt-2 text-body-small leading-[1.6] text-text-secondary">{stage.description}</p>
              {stage.agents ? <p className="mt-4 border-t border-border pt-4 font-mono text-[0.75rem] leading-[1.6] text-text-tertiary">{stage.agents}</p> : null}
            </div>
          </li>
        ))}
      </ol>

      {/* Return arc (desktop): from under the last card back up into the first. */}
      <div className="relative mx-[12.5%] mt-2 hidden h-12 rounded-b-3xl border-x border-b border-dashed border-orbit/25 lg:block">
        <ArrowUp aria-hidden="true" className="absolute -left-[0.5rem] -top-2 h-4 w-4 text-orbit/60" strokeWidth={1.5} />
        <span className="absolute -bottom-[0.7rem] left-1/2 -translate-x-1/2 whitespace-nowrap bg-background px-4 font-mono text-caption uppercase tracking-[0.2em] text-text-secondary">
          {loopLabel}
        </span>
      </div>
      <p className="mt-4 flex items-center gap-3 font-mono text-caption uppercase tracking-[0.2em] text-text-secondary lg:hidden">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-orbit/30">
          <RotateCcw aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </span>
        {loopLabel}
      </p>
    </div>
  );
}
