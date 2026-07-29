import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { contentAssets, contentPieces, galleryItems } from '@/server/db/schema';

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

type VideoScript = { scenes?: Array<{ order: number; visualDirection?: string; visual_direction?: string }> };
type CarouselScript = { slides?: Array<{ order: number; visualDirection?: string; visual_direction?: string }> };

// Both snake_case and camelCase keys are accepted here on purpose: `script`
// is opaque jsonb written by a Skill (Python-side conventions used
// snake_case; nothing in this schema enforces a shape on it), so reading
// either spelling is more robust than assuming one.
function visualDirectionOf(entry: { visualDirection?: string; visual_direction?: string } | undefined): string {
  return entry?.visualDirection ?? entry?.visual_direction ?? '';
}

// tags mirror the original: [angle, hookType], whichever of the two is set —
// this is what lets a future GET /gallery/search find this item again by the
// same angle/hook_type a Skill is currently working with.
function galleryTags(piece: { angle: string | null; hookType: string | null }): string[] {
  return [piece.angle, piece.hookType].filter((value): value is string => Boolean(value));
}

// Registers a reusable GalleryItem for an asset just produced — same
// automatic registration the original ProducerAgent did on every produce
// call, so a future video-production/carousel-production run can find it via
// GET /gallery/search. `description` MUST come from visual_direction (what
// the image/clip actually shows), never from headline/body/voiceover (the
// text overlaid ON TOP of it) — that exact mistake was made and fixed on the
// Python side (carousel_image descriptions were headlines, making semantic
// search over the gallery useless); don't reintroduce it here.
async function createGalleryItem(params: {
  appId: string;
  assetType: 'clip' | 'carousel_image';
  url: string;
  description: string;
  tags: string[];
  productionMethod: string;
  sourceContentPieceId: string;
}) {
  await db.insert(galleryItems).values({
    appId: params.appId,
    assetType: params.assetType,
    url: params.url,
    description: params.description,
    tags: params.tags,
    productionMethod: params.productionMethod,
    sourceContentPieceId: params.sourceContentPieceId
  });
}

export type ProduceContentPieceResult =
  | { kind: 'ok'; contentPiece: typeof contentPieces.$inferSelect; assets: (typeof contentAssets.$inferSelect)[] }
  | { kind: 'not_found' }
  | { kind: 'wrong_status'; currentStatus: string };

// A piece can only be produced once from "scripted" — calling this twice on
// the same piece (e.g. a retried request, or a Skill re-running by mistake)
// must not silently duplicate ContentAsset/GalleryItem rows. Any status
// other than "scripted" (already ready_for_review, approved, published...)
// is rejected with 409 at the route layer before anything is written.
export async function produceContentPiece(contentPieceId: string, input: ProduceInput): Promise<ProduceContentPieceResult> {
  const [piece] = await db.select().from(contentPieces).where(eq(contentPieces.id, contentPieceId)).limit(1);

  if (!piece) {
    return { kind: 'not_found' };
  }

  if (piece.status !== 'scripted') {
    return { kind: 'wrong_status', currentStatus: piece.status };
  }

  const tags = galleryTags(piece);

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

    // One GalleryItem for the whole assembled video, description built from
    // the first few scenes' visual_direction — same shape the original used
    // for the `clip` asset_type (a single item summarizing multiple scenes,
    // since the final video is one file, not one per scene).
    const script = piece.script as VideoScript | null;
    const sceneDirections = (script?.scenes ?? [])
      .map(visualDirectionOf)
      .filter((direction) => direction.length > 0)
      .slice(0, 3);

    await createGalleryItem({
      appId: piece.appId,
      assetType: 'clip',
      url: input.asset.url,
      description: `angle=${piece.angle ?? '(no angle)'}: ${sceneDirections.join('; ')}`,
      tags,
      productionMethod: input.asset.productionMethod,
      sourceContentPieceId: contentPieceId
    });
  } else {
    const script = piece.script as CarouselScript | null;
    const slidesByOrder = new Map((script?.slides ?? []).map((slide) => [slide.order, slide]));

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

      // One GalleryItem per slide — description is THIS slide's own
      // visual_direction (the background it shows), never its headline/body.
      await createGalleryItem({
        appId: piece.appId,
        assetType: 'carousel_image',
        url: slide.url,
        description: visualDirectionOf(slidesByOrder.get(slide.orderIndex)),
        tags,
        productionMethod: slide.productionMethod,
        sourceContentPieceId: contentPieceId
      });
    }
  }

  const [updated] = await db.update(contentPieces).set({ status: 'ready_for_review' }).where(eq(contentPieces.id, contentPieceId)).returning();

  const assets = await db.select().from(contentAssets).where(eq(contentAssets.contentPieceId, contentPieceId));

  return { kind: 'ok', contentPiece: updated, assets };
}
