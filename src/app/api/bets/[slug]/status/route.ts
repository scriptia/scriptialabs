import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { betStatuses, externallySettableBetStatuses } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { betUpdates, bets } from '@/server/db/schema';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';

// Moves a bet along the human half of its lifecycle, from outside the panel.
//
// This exists because of the rule the panel enforces everywhere else: once a bet
// reaches `building` NOTHING automatic moves it — not the reaper, not a failed
// run, not a completion callback. It waits for a person. That is the right
// default, but a builder that finishes and wants to say so should not have to
// wait for someone to open a browser, so it can say so here instead.
//
// The status set is narrow on purpose (see externallySettableBetStatuses):
// `ready` is asserted only by publishing a real product page, and
// `researching` / `building` only by a run claiming the bet.

const payloadSchema = z.object({
  status: z.enum(externallySettableBetStatuses),
  // Optional one-liner recorded on the bet's update log, so the board shows WHY
  // it moved rather than just that it did.
  note: z.string().trim().max(2000).optional()
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { slug } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Payload failed validation.',
        issues: parsed.error.issues,
        settable: externallySettableBetStatuses,
        // Named so a caller that tried `ready` learns why rather than guessing.
        notSettableHere: betStatuses.filter((status) => !(externallySettableBetStatuses as readonly string[]).includes(status))
      },
      { status: 422 }
    );
  }

  const [bet] = await db.select({ id: bets.id, status: bets.status }).from(bets).where(eq(bets.slug, slug)).limit(1);
  if (!bet) {
    return NextResponse.json({ ok: false, error: `No bet with slug "${slug}".` }, { status: 404 });
  }

  const { status, note } = parsed.data;

  if (bet.status === status) {
    return NextResponse.json({ ok: true, slug, status, changed: false });
  }

  await db.update(bets).set({ status, updatedAt: new Date() }).where(eq(bets.id, bet.id));

  if (note) {
    await db.insert(betUpdates).values({ betId: bet.id, authorId: null, kind: 'note', body: note });
  }

  await recordAudit({
    actorId: null,
    entity: 'bet',
    entityId: bet.id,
    action: 'update',
    diff: { status: { from: bet.status, to: status } }
  });

  revalidatePath('/internal/bets');
  revalidatePath('/internal/bets/board');
  revalidatePath(`/internal/bets/${slug}`);

  return NextResponse.json({ ok: true, slug, status, changed: true, from: bet.status });
}
