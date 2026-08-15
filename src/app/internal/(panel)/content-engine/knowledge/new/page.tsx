import { notFound } from 'next/navigation';

import { Body, Heading } from '@/components/typography';
import { Stack } from '@/components/surfaces';
import { requireUser } from '@/server/auth/guard';
import { getKnowledgeEntryById } from '@/server/content-engine';

import { KnowledgeEntryForm } from '../knowledge-entry-form';

// ?supersede=<id> switches this same page into "create a replacement" mode
// (see KnowledgeEntryForm) — no separate route, since it's the same form with
// different pre-fill and a different bound Server Action.
export default async function NewKnowledgeEntryPage({ searchParams }: Readonly<{ searchParams: Promise<{ supersede?: string }> }>) {
  await requireUser();

  const { supersede } = await searchParams;
  const supersedesEntry = supersede ? await getKnowledgeEntryById(supersede) : null;

  if (supersede && !supersedesEntry) {
    notFound();
  }

  return (
    <Stack gap="lg" className="max-w-3xl">
      <div>
        <Heading level={1}>{supersedesEntry ? 'Supersede knowledge entry' : 'New knowledge entry'}</Heading>
        <Body size="small" className="mt-1">
          Global entry (no app scoping in this iteration) — same fields as <code>POST /api/content-engine/knowledge</code>.
        </Body>
      </div>
      <KnowledgeEntryForm
        supersedes={
          supersedesEntry
            ? {
                id: supersedesEntry.id,
                principle: supersedesEntry.principle,
                relatedAngle: supersedesEntry.relatedAngle,
                relatedHookType: supersedesEntry.relatedHookType
              }
            : undefined
        }
      />
    </Stack>
  );
}
