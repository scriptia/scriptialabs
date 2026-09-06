'use client';

import * as React from 'react';

import { Alert } from '@/components/feedback';
import { Button } from '@/components/primitives';
import { Grid, Stack, Surface } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { productAssetKindLabels, productDocumentKindLabels } from '@/content/internal';
import { loadProductDocument } from '@/server/actions/products';
import type { ProductAssetRow, ProductDocumentRow } from '@/server/queries/products';

// Everything the product stage produced, made readable and downloadable.
//
// Until this existed the artifacts were write-only from the panel's side: the
// markdown lived in `product_documents` and the images in blob storage, and the
// only way to read either was the runner's bearer-guarded API or the run
// directory on the machine that produced them. The bet page showed a count.
//
// Rendered in two places from one component — the bet's Product tab and
// /internal/products/[slug] — because they are the same question asked from two
// directions ("what did this bet produce?" / "what does this product hold?").

function formatSize(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

export function ProductArtifacts({
  slug,
  assets,
  documents
}: Readonly<{ slug: string; assets: ProductAssetRow[]; documents: ProductDocumentRow[] }>) {
  return (
    <Stack gap="lg">
      <ProductAssets slug={slug} assets={assets} />
      <ProductDocuments slug={slug} documents={documents} />
    </Stack>
  );
}

export function ProductAssets({ slug, assets }: Readonly<{ slug: string; assets: ProductAssetRow[] }>) {
  return (
    <Stack gap="sm">
      <Heading level={3}>Assets ({assets.length})</Heading>

      {assets.length === 0 ? (
        <Body size="small" className="text-text-tertiary">
          None uploaded. The product agent renders the logo, icons and screenshots during its identity stage.
        </Body>
      ) : (
        <Grid cols={4} gap="md">
          {assets.map((asset) => (
            <Surface key={asset.id} className="p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.url} alt={productAssetKindLabels[asset.kind]} className="mb-2 h-20 w-20 rounded-md object-contain" />
              <p className="text-caption font-medium text-text-primary">{productAssetKindLabels[asset.kind]}</p>
              <p className="text-caption text-text-tertiary">
                {asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'}
                {asset.checksum ? ` · ${asset.checksum.slice(7, 15)}` : ''}
              </p>
              <div className="mt-2 flex gap-3">
                <a href={asset.url} target="_blank" rel="noreferrer" className="text-caption text-brand hover:underline">
                  Open
                </a>
                {/* Through the panel route, not asset.url: the blob is on another
                    origin, where `download` is ignored and the file opens instead. */}
                <a href={`/api/internal/products/${slug}/download?asset=${asset.id}`} className="text-caption text-brand hover:underline">
                  Download
                </a>
              </div>
            </Surface>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

export function ProductDocuments({ slug, documents }: Readonly<{ slug: string; documents: ProductDocumentRow[] }>) {
  // One document open at a time, its body fetched on demand — the list carries
  // no content (see getProductArtifactsForBet).
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [content, setContent] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);

  function open(id: string) {
    if (openId === id) {
      setOpenId(null);
      setContent(null);

      return;
    }

    setOpenId(id);
    setContent(null);
    setError(null);

    startTransition(async () => {
      const result = await loadProductDocument(id);

      if (result.error) {
        setError(result.error);

        return;
      }

      setContent(result.content ?? '');
    });
  }

  async function copy() {
    if (!content) {
      return;
    }

    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Stack gap="sm">
      <Heading level={3}>Documents ({documents.length})</Heading>

      {documents.length === 0 ? (
        <Body size="small" className="text-text-tertiary">
          None. A builder handed this product would get feature names with no specification behind them.
        </Body>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {documents.map((document) => (
            <li key={document.id}>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <span className="text-caption uppercase tracking-[0.08em] text-text-tertiary">{productDocumentKindLabels[document.kind]}</span>
                  <p className="truncate text-body-small text-text-primary">{document.name}</p>
                  <p className="truncate font-mono text-caption text-text-tertiary">
                    {document.path} · {formatSize(document.size)}
                  </p>
                </div>

                {/* No Remove: these are pipeline output, replaced wholesale by the
                    next run, not files someone attached by hand. */}
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => open(document.id)}>
                    {openId === document.id ? 'Hide' : 'Open'}
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/api/internal/products/${slug}/download?doc=${document.id}`}>Download</a>
                  </Button>
                </div>
              </div>

              {openId === document.id ? (
                <div className="border-t border-border bg-surface-subtle px-4 py-3">
                  {error ? <Alert tone="error">{error}</Alert> : null}

                  {pending && content === null ? (
                    <p className="text-body-small text-text-secondary">Loading…</p>
                  ) : content !== null ? (
                    <Stack gap="sm">
                      <div className="flex justify-end">
                        <Button type="button" size="sm" onClick={copy}>
                          {copied ? 'Copied' : 'Copy to clipboard'}
                        </Button>
                      </div>
                      <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-4 text-caption text-text-secondary">
                        {content}
                      </pre>
                    </Stack>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}
