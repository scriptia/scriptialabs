import * as React from 'react';

import { Body, Heading } from '@/components/typography';
import { Stack } from '@/components/surfaces';
import { cn } from '@/lib/utils';
import { TableOfContents } from './table-of-contents';

export type LegalDocumentSection = {
  id: string;
  title: string;
  body: string[];
};

export type LegalDocumentViewProps = {
  title: string;
  description?: string;
  lastUpdatedLabel: string;
  tocLabel: string;
  sections: LegalDocumentSection[];
};

// Shared shell for every legal page: title, last-updated date, an optional
// sticky table of contents once a document is long enough to need one, and
// sections rendered from translated content — no page hardcodes its own
// heading/spacing rhythm.
export function LegalDocumentView({ title, description, lastUpdatedLabel, tocLabel, sections }: LegalDocumentViewProps) {
  const showToc = sections.length > 3;

  return (
    <div className={cn('grid gap-10', showToc && 'lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start')}>
      {showToc ? <TableOfContents label={tocLabel} items={sections.map((section) => ({ id: section.id, label: section.title }))} /> : null}
      <div className="grid max-w-reading gap-12">
        <Stack gap="sm">
          <Heading level={1}>{title}</Heading>
          {description ? (
            <Body size="large" className="text-text-secondary">
              {description}
            </Body>
          ) : null}
          <Body size="small" className="text-text-tertiary">
            {lastUpdatedLabel}
          </Body>
        </Stack>
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24 grid gap-3">
            <Heading level={2}>{section.title}</Heading>
            {section.body.map((paragraph, index) => (
              <Body key={index}>{paragraph}</Body>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
