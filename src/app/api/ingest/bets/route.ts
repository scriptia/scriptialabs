import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import type { BetStatus } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { betDocuments, bets } from '@/server/db/schema';
import { ingestPayloadSchema, type IngestBetInput } from '@/server/validation/ingest';

// The only API route in the project — see ADR-011. Everything the panel itself
// does stays a server action; this exists because the discovery pipeline is a
// Python process outside the browser and cannot invoke one.
//
// Node runtime, not Edge: timingSafeEqual comes from node:crypto.
export const runtime = 'nodejs';

// Statuses the pipeline is allowed to overwrite. Once a bet has been picked up
// by a human — researching, building, deployed, scaling, or deliberately
// paused — a later run must not drag it back to the pick queue. This is the
// rule that makes the endpoint safe to call every week.
const REASSIGNABLE: readonly BetStatus[] = ['backlog', 'ready', 'killed'];

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

// Hash both sides before comparing: timingSafeEqual throws on length mismatch,
// and the length of the supplied token is itself a small leak. Comparing fixed
// -width digests sidesteps both.
function tokenMatches(supplied: string, expected: string) {
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update(expected).digest();

  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.INGEST_TOKEN;

  // No token configured means the endpoint is not set up. Fail closed and say
  // so distinctly from "wrong token" — this one is an operator error, not an
  // intruder, and conflating them makes a first deploy baffling to debug.
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'Ingest is not configured on this deployment.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!supplied || !tokenMatches(supplied, expected)) {
    return unauthorized('Invalid or missing bearer token.');
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = ingestPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { runId, bets: incoming } = parsed.data;
  const result = { created: [] as string[], updated: [] as string[], statusHeld: [] as string[], documents: 0 };

  // Sequential, not transactional: the neon-http driver is one statement per
  // round trip and has no interactive transactions (see server/db/client.ts).
  // Every write here is an idempotent upsert, so a partial run is repaired by
  // simply calling the endpoint again — which the pipeline does anyway.
  for (const bet of incoming) {
    result.documents += await upsertBet(bet, result);
  }

  revalidatePath('/internal/bets');
  revalidatePath('/internal/bets/board');

  return NextResponse.json({
    ok: true,
    runId,
    created: result.created.length,
    updated: result.updated.length,
    documents: result.documents,
    // Named, not just counted: these are the bets you have already moved on, and
    // seeing which ones held their status is the point of reporting it.
    statusHeld: result.statusHeld
  });
}

async function upsertBet(input: IngestBetInput, result: { created: string[]; updated: string[]; statusHeld: string[] }) {
  const description = input.description?.trim() || null;
  const [existing] = await db.select({ id: bets.id, status: bets.status, title: bets.title, description: bets.description }).from(bets).where(eq(bets.slug, input.slug)).limit(1);

  let betId: string;

  if (!existing) {
    const [created] = await db
      .insert(bets)
      .values({
        slug: input.slug,
        title: input.title,
        description,
        status: input.status,
        audience: input.audience ?? 'b2c',
        priority: input.priority ?? 'medium',
        // No actor: this row was created by a machine, and createdById is a
        // foreign key to a real account.
        createdById: null
      })
      .returning({ id: bets.id });

    betId = created.id;
    result.created.push(input.slug);

    await recordAudit({
      actorId: null,
      entity: 'bet',
      entityId: betId,
      action: 'create',
      diff: { slug: { from: null, to: input.slug }, status: { from: null, to: input.status } }
    });
  } else {
    betId = existing.id;

    const holdStatus = !REASSIGNABLE.includes(existing.status);
    const nextStatus = holdStatus ? existing.status : input.status;

    if (holdStatus) {
      result.statusHeld.push(input.slug);
    }

    await db.update(bets).set({ title: input.title, description, status: nextStatus, updatedAt: new Date() }).where(eq(bets.id, betId));

    result.updated.push(input.slug);

    const diff: Record<string, { from: unknown; to: unknown }> = {};

    if (existing.title !== input.title) diff.title = { from: existing.title, to: input.title };
    if (existing.description !== description) diff.description = { from: existing.description, to: description };
    if (existing.status !== nextStatus) diff.status = { from: existing.status, to: nextStatus };

    await recordAudit({ actorId: null, entity: 'bet', entityId: betId, action: 'update', diff });
  }

  return upsertDocuments(betId, input);
}

async function upsertDocuments(betId: string, input: IngestBetInput) {
  if (!input.documents?.length) {
    return 0;
  }

  for (const document of input.documents) {
    await db
      .insert(betDocuments)
      .values({ betId, kind: document.kind, name: document.name, content: document.content })
      .onConflictDoUpdate({
        target: [betDocuments.betId, betDocuments.kind],
        set: { name: document.name, content: document.content, updatedAt: new Date() }
      });
  }

  await recordAudit({
    actorId: null,
    entity: 'bet_document',
    entityId: betId,
    action: 'update',
    diff: { documents: { from: null, to: input.documents.map((document) => `${document.kind}:${document.name}`) } }
  });

  return input.documents.length;
}
