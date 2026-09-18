import Link from 'next/link';

import { Stack } from '@/components/surfaces';
import { Body } from '@/components/typography';
import type { ProductArtifacts as ProductArtifactsData } from '@/server/queries/products';

import { ProductArtifacts } from '../../_components/product-artifacts';

// The bet's view of what its product run produced. Same component the product
// page uses, plus the link across to the rest of that product's record — the
// copy, the features and the legal documents live there and are not artifacts.
export function ProductPanel({ artifacts }: Readonly<{ artifacts: ProductArtifactsData | null }>) {
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

      <ProductArtifacts slug={artifacts.slug} assets={artifacts.assets} documents={artifacts.documents} />
    </Stack>
  );
}
