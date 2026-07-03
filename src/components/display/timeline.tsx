import * as React from 'react';

export type TimelineStep = {
  title: React.ReactNode;
  description: React.ReactNode;
};

export type TimelineProps = Omit<React.HTMLAttributes<HTMLOListElement>, 'children'> & {
  steps: TimelineStep[];
};

// A real sequence (step 1 leads to step 2), so numbering encodes order the
// reader needs — unlike a generic feature list, which shouldn't be numbered.
export function Timeline({ steps, className, ...props }: TimelineProps) {
  return (
    <ol className={className} {...props}>
      {steps.map((step, index) => (
        <li key={index} className="relative flex gap-4 pb-8 last:pb-0">
          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-border" />
          ) : null}
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-body-small font-medium text-text-primary"
          >
            {index + 1}
          </span>
          <div className="pt-0.5">
            <h3 className="text-h3 font-medium text-text-primary">{step.title}</h3>
            <p className="mt-1 text-body-small leading-[1.55] text-text-secondary">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
