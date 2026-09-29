import * as React from 'react';

import { Container, Section, Stack } from '@/components/surfaces';
import { productAccentTextClassName, type ProductAccent } from '@/design/theme';
import { cn } from '@/lib/utils';

export type ProductScreenshot = { url: string; width: number | null; height: number | null };

export type ProductScreenshotsProps = Readonly<{
  eyebrow: string;
  accent: ProductAccent;
  productName: string;
  screenshots: ProductScreenshot[];
}>;

// A 6.7" iPhone screenshot, for any file whose size could not be read.
const FALLBACK_RATIO = '1290 / 2796';

// The listing's iPhone screenshots, as a swipeable strip.
//
// A store listing ships anywhere from two to ten screenshots, and the strip has
// to look deliberate at both ends: a short set sits centred on wide screens
// rather than hugging the left edge with a void beside it, and a long set
// scrolls with snap points so it pages like the App Store does. On phones it
// always scrolls, bleeding to the screen edge so the next shot peeks in and says
// "there is more this way".
export function ProductScreenshots({ eyebrow, accent, productName, screenshots }: ProductScreenshotsProps) {
  if (screenshots.length === 0) return null;

  const fits = screenshots.length <= 4;

  return (
    <Section spacing="md" className="relative overflow-hidden">
      <Container size="content">
        <Stack gap="lg">
          <div className={`text-caption font-medium uppercase tracking-[0.1em] ${productAccentTextClassName[accent]}`}>{eyebrow}</div>
          <ul
            className={cn(
              // Negative margin + matching padding: the strip scrolls under the
              // container's gutter to the viewport edge, while the first shot
              // still lines up with the heading above it.
              '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:gap-6 lg:-mx-8 lg:scroll-px-8 lg:px-8',
              '[scrollbar-width:thin]',
              fits && 'md:justify-center'
            )}
          >
            {screenshots.map((screenshot, index) => (
              <li key={screenshot.url} className="w-[62vw] max-w-[15rem] shrink-0 snap-start md:w-[15rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screenshot.url}
                  alt={`${productName} — ${index + 1}/${screenshots.length}`}
                  width={screenshot.width ?? undefined}
                  height={screenshot.height ?? undefined}
                  loading={index < 2 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="h-auto w-full rounded-[1.75rem] border border-border bg-surface object-cover shadow-medium"
                  style={{ aspectRatio: screenshot.width && screenshot.height ? `${screenshot.width} / ${screenshot.height}` : FALLBACK_RATIO }}
                />
              </li>
            ))}
          </ul>
        </Stack>
      </Container>
    </Section>
  );
}
