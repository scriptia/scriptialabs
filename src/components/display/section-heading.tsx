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
      {eyebrow ? <div className="text-caption font-medium uppercase tracking-[0.1em] text-text-tertiary">{eyebrow}</div> : null}
      <Heading level={2}>{title}</Heading>
      {description ? <Body size="base">{description}</Body> : null}
    </Stack>
  );
}
