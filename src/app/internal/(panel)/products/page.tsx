import Link from 'next/link';

import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeaderCell, TableRow } from '@/components/data';
import { Badge } from '@/components/primitives';
import { Stack } from '@/components/surfaces';
import { Body, Heading } from '@/components/typography';
import { requireUser } from '@/server/auth/guard';
import { listProductsForPanel } from '@/server/queries/products';

import { formatRelative } from '../_components/format';
import { RevalidateAllButton } from './revalidate-all-button';

export default async function ProductsPage() {
  await requireUser();

  const rows = await listProductsForPanel();

  return (
    <Stack gap="lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>Products</Heading>
          <Body size="small" className="mt-1">
            What the public site shows. A product with no publish date is invisible everywhere — the resolver, every listing, the navbar, the footer and the sitemap all read the
            same rule.
          </Body>
        </div>
        <RevalidateAllButton />
      </div>

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Slug</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Public</TableHeaderCell>
            <TableHeaderCell>Indexed</TableHeaderCell>
            <TableHeaderCell>Bet</TableHeaderCell>
            <TableHeaderCell>Updated</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableEmpty colSpan={6}>No products yet. Run the product agent on a bet, or seed the migrated ones with `npm run seed:products`.</TableEmpty>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} interactive>
                <TableCell>
                  <Link href={`/internal/products/${row.slug}`} className="font-medium text-brand hover:underline">
                    /{row.slug}
                  </Link>
                </TableCell>
                <TableCell>{row.status}</TableCell>
                <TableCell>{row.publishedAt ? <Badge tone="success">Live</Badge> : <Badge tone="warning">Unpublished</Badge>}</TableCell>
                <TableCell>{row.indexable ? <Badge tone="brand">In sitemap</Badge> : <Badge>Hidden</Badge>}</TableCell>
                <TableCell>
                  {row.betSlug ? (
                    <Link href={`/internal/bets/${row.betSlug}`} className="hover:underline">
                      {row.betSlug}
                    </Link>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                </TableCell>
                <TableCell>{formatRelative(row.updatedAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Stack>
  );
}
