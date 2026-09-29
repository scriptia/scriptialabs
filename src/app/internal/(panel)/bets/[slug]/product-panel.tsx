import Link from 'next/link';

import { Alert } from '@/components/feedback';
import { Stack } from '@/components/surfaces';
import { Body } from '@/components/typography';
import type { BetStatus } from '@/content/internal';
import type { ProductArtifacts as ProductArtifactsData } from '@/server/queries/products';

import { ProductArtifacts } from '../../_components/product-artifacts';

// The bet's view of what its product run produced. Same component the product
// page uses, plus the link across to the rest of that product's record — the
// copy, the features and the legal documents live there and are not artifacts.
export function ProductPanel({ artifacts, betStatus }: Readonly<{ artifacts: ProductArtifactsData | null; betStatus: BetStatus }>) {
  if (!artifacts) {
    return (
      <Body size="small" className="text-text-secondary">
        No product yet. A product-agent run creates one: its identity, requirements and feature specs land here as documents, and its logo and icons as assets.
      </Body>
    );
  }

  return (
    <Stack gap="lg">
      <Body size="small">
        Produced by the product agent for{' '}
        <Link href={`/internal/products/${artifacts.slug}`} className="text-brand hover:underline">
          /{artifacts.slug}
        </Link>
        , where the page copy, features and legal documents are.
      </Body>

      {/* Shipped but the public page still shows the placeholder device card:
          the store link is what swaps in the real icon, screenshots and badge. */}
      {(betStatus === 'deployed' || betStatus === 'scaling') && !artifacts.hasStoreListing ? (
        <Alert tone="info" title="The app is live — link its store listing">
          The product page still shows a placeholder.{' '}
          <Link href={`/internal/products/${artifacts.slug}`} className="text-brand hover:underline">
            Add the App Store link →
          </Link>{' '}
          and its icon, screenshots and a download badge appear on /{artifacts.slug}.
        </Alert>
      ) : null}

      <ProductArtifacts slug={artifacts.slug} assets={artifacts.assets} documents={artifacts.documents} />
    </Stack>
  );
}
