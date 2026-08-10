'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { carouselSkeletons, isCarouselSkeletonId, resizeSkeletonSlides, withoutAppMention, type CarouselSkeletonSlide } from '@/content/content-engine';
import { requireUser } from '@/server/auth/guard';
import { createContentPiece, getAppById, produceContentPiece } from '@/server/content-engine';
import {
  buildCarouselZip,
  buildSlidePlan,
  buildStyleBible,
  dataUrlFromPng,
  generateCarouselSlideImages,
  type GeneratedSlideImage
} from '@/server/content-engine/carousel-generation';
import { isImageApiConfigured } from '@/server/content-engine/image-client';
import { loadCarouselPlaybook } from '@/server/content-engine/carousel-playbook';

export type GenerateCarouselFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  result?: { contentPieceId: string; slides: Array<{ order: number; headline: string; dataUrl: string }> };
};

const generateCarouselFormSchema = z.object({
  appId: z.uuid(),
  idea: z.string().trim().min(1, 'Cuenta la idea/tema del carrusel.'),
  skeletonId: z.string().refine(isCarouselSkeletonId, 'Elige un esqueleto válido.'),
  slideCount: z.coerce.number().int().min(7, 'Entre 7 y 10 slides.').max(10, 'Entre 7 y 10 slides.'),
  mentionApp: z.enum(['yes', 'no']),
  appMentionPosition: z.coerce.number().int().optional()
});

// Keeps exactly ONE app-mention slide, at the position the user picked —
// section 9 of the playbook is explicit that the app is mentioned "una sola
// vez", even though skeleton C's own literal transcription (section 13) has
// two touchpoints (a progress screenshot slide AND a direct-mention slide).
// The general, explicitly-marked-critical rule wins: any OTHER app_mention
// slide besides the chosen position gets demoted to a plain point.
function resolveAppMention(slides: CarouselSkeletonSlide[], mentionApp: boolean, position: number | null): CarouselSkeletonSlide[] {
  if (!mentionApp) {
    return withoutAppMention(slides);
  }

  return slides.map((slide) => (slide.role === 'app_mention' && slide.order !== position ? { ...slide, role: 'point' as const } : slide));
}

// Builds the prompts and calls the image API for real (gated by
// isImageApiConfigured() — point 4 of the task: an unconfigured key must
// fail clean here, never reach a fetch call). Persists via the SAME
// createContentPiece + produceContentPiece functions the rest of the system
// uses (production.ts), rather than a new parallel write path — that's what
// guarantees this reuses the already-fixed "GalleryItem.description must be
// visual_direction, never headline/body" behavior instead of risking
// reintroducing it.
export async function generateCarousel(_state: GenerateCarouselFormState, formData: FormData): Promise<GenerateCarouselFormState> {
  await requireUser();

  const parsed = generateCarouselFormSchema.safeParse({
    appId: formData.get('appId'),
    idea: formData.get('idea'),
    skeletonId: formData.get('skeletonId'),
    slideCount: formData.get('slideCount'),
    mentionApp: formData.get('mentionApp'),
    appMentionPosition: formData.get('appMentionPosition') || undefined
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');

      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }

    return { error: 'Revisa los campos marcados.', fieldErrors };
  }

  if (!isImageApiConfigured()) {
    return { error: 'La generación de imagen no está disponible todavía en este despliegue: falta configurar OPENAI_API_KEY.' };
  }

  const app = await getAppById(parsed.data.appId);

  if (!app) {
    return { error: 'App no encontrada.' };
  }

  const skeleton = carouselSkeletons[parsed.data.skeletonId];
  const resized = resizeSkeletonSlides(skeleton, parsed.data.slideCount);
  const finalSlides = resolveAppMention(resized, parsed.data.mentionApp === 'yes', parsed.data.appMentionPosition ?? null);

  const plan = buildSlidePlan(parsed.data.idea, finalSlides);
  const playbookText = await loadCarouselPlaybook();
  const styleBible = buildStyleBible(app.brandProfile, playbookText);

  let images: GeneratedSlideImage[];

  try {
    images = await generateCarouselSlideImages(plan, styleBible, playbookText, app.name);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'La generación de imagen falló.' };
  }

  const piece = await createContentPiece({
    appId: app.id,
    contentType: 'carousel',
    angle: parsed.data.idea.slice(0, 160),
    hookText: plan[0]?.headline ?? null,
    hookType: skeleton.id,
    script: {
      slides: plan.map((slide) => ({
        order: slide.order,
        headline: slide.headline,
        body: slide.body,
        visual_direction: slide.visualDirection
      }))
    }
  });

  const produced = await produceContentPiece(piece.id, {
    kind: 'carousel',
    slideAssets: images.map((image) => ({
      orderIndex: image.order,
      url: dataUrlFromPng(image.base64Png),
      productionMethod: 'ai_generated',
      generationProvider: 'openai'
    }))
  });

  if (produced.kind !== 'ok') {
    return { error: 'La pieza se creó pero no se pudo persistir la producción — revisa el estado en Review.' };
  }

  revalidatePath('/internal/content-engine/review');
  revalidatePath('/internal/content-engine/carousels');

  return {
    result: {
      contentPieceId: piece.id,
      slides: images.map((image) => ({ order: image.order, headline: image.headline, dataUrl: dataUrlFromPng(image.base64Png) }))
    }
  };
}

// Zips the just-generated slide images numbered 01.jpg, 02.jpg... — built
// entirely in-memory inside this Server Action (sharp re-encodes the PNG
// bytes OpenAI returns into real JPEGs so the extension isn't a lie, jszip
// bundles them), returned as base64 for the client to turn into a Blob and
// download. Nothing is written to disk or to any storage — ADR-010 has no
// route-handler exception for this, and the task doesn't need one: a Server
// Action returning bytes is enough for a client-triggered download.
export async function downloadCarouselZip(slides: Array<{ order: number; dataUrl: string }>): Promise<{ base64: string; filename: string } | { error: string }> {
  await requireUser();

  if (slides.length === 0) {
    return { error: 'No hay slides que descargar.' };
  }

  return buildCarouselZip(slides);
}
