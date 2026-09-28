import * as React from 'react';

import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';

export type SectionHeadingProps = Readonly<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
}>;

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <Stack gap="sm">
      {eyebrow ? <div className="font-mono text-caption uppercase tracking-[0.2em] text-brand">{eyebrow}</div> : null}
      <Heading level={2}>{title}</Heading>
      {description ? <Body size="base">{description}</Body> : null}
    </Stack>
  );
}
