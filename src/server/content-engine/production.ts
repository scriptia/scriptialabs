import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { contentAssets, contentPieces } from '@/server/db/schema';

// IMPORTANT — read before touching this file: there is no ProducerAgent in
// this TypeScript backend yet. In the original Python API, `POST
// /content/{id}/produce` received a *decision* per scene/slide
// (`resolved_scenes`/`resolved_slides`: "reuse this url" or "generate from
// this prompt") and its own ProducerAgent DID the real work — it called
// Kling/OpenAI for anything marked "generate", and it ALWAYS called
// Shotstack afterwards to assemble the final video/slide (assembly is not
// optional, even a fully-reused video still needs its clips stitched into
// one file).
//
// That executor does not exist here. So this endpoint's contract is
// deliberately different, not just a straight port: it accepts the
// ALREADY-FINISHED asset(s) — real urls that a Skill produced by calling
// Kling/Shotstack itself, directly, outside this process (from the
// developer's machine, same as any other Skill invocation). This function
// only persists what's handed to it and flips the piece to
// "ready_for_review". It does not call Kling, does not call Shotstack, and
// never will unless a future ProducerAgent port changes this contract back.
// If you're tempted to accept a `prompt` field here instead of a `url`,
// stop — nothing in this codebase would ever turn that prompt into a real
// asset, and you'd be persisting text as if it were a playable video.

export type FinishedAsset = {
  url: string;
  productionMethod: string;
  generationProvider?: string | null;
  generationCostUsd?: number | null;
};

export type FinishedSlideAsset = FinishedAsset & {
  orderIndex: number;
};

export type ProduceInput =
  | { kind: 'video'; asset: FinishedAsset }
  | { kind: 'carousel'; slideAssets: FinishedSlideAsset[] };

export async function produceContentPiece(contentPieceId: string, input: ProduceInput) {
  const [piece] = await db.select().from(contentPieces).where(eq(contentPieces.id, contentPieceId)).limit(1);

  if (!piece) {
    return null;
  }

  if (input.kind === 'video') {
    await db.insert(contentAssets).values({
      contentPieceId,
      assetType: 'final_video',
      url: input.asset.url,
      orderIndex: 0,
      productionMethod: input.asset.productionMethod,
      generationProvider: input.asset.generationProvider ?? null,
      generationCostUsd: input.asset.generationCostUsd != null ? String(input.asset.generationCostUsd) : null
    });
  } else {
    for (const slide of input.slideAssets) {
      await db.insert(contentAssets).values({
        contentPieceId,
        assetType: 'carousel_slide',
        url: slide.url,
        orderIndex: slide.orderIndex,
        productionMethod: slide.productionMethod,
        generationProvider: slide.generationProvider ?? null,
        generationCostUsd: slide.generationCostUsd != null ? String(slide.generationCostUsd) : null
      });
    }
  }

  const [updated] = await db.update(contentPieces).set({ status: 'ready_for_review' }).where(eq(contentPieces.id, contentPieceId)).returning();

  const assets = await db.select().from(contentAssets).where(eq(contentAssets.contentPieceId, contentPieceId));

  return { contentPiece: updated, assets };
}
