import 'server-only';

import JSZip from 'jszip';
import sharp from 'sharp';

import type { CarouselSkeletonSlide, CarouselSkeletonSlideRole } from '@/content/content-engine';

import { type ImageClient, realImageClient } from './image-client';

// Pulls one `## N. Heading` section out of the playbook's raw markdown, by
// heading prefix — NOT a markdown parser (the skeletons themselves live in
// src/content/content-engine/carousel-skeleton.ts as a plain constant, per
// the same "don't parse what doesn't change daily" call). This exists so the
// hook/structure/CTA/app-integration RULES (prose, not structured data) are
// read from carousel-playbook.md at prompt-build time instead of being
// retyped as string literals here — see skills/scriptwriter/SKILL.md and
// skills/carousel-production/SKILL.md, which read the exact same file the
// exact same way.
export function extractPlaybookSection(playbookText: string, headingPrefix: string): string {
  const lines = playbookText.split('\n');
  const startIndex = lines.findIndex((line) => line.startsWith(headingPrefix));

  if (startIndex === -1) return '';

  const rest = lines.slice(startIndex + 1);
  const endOffset = rest.findIndex((line) => line.startsWith('## '));
  const body = endOffset === -1 ? rest : rest.slice(0, endOffset);

  return [lines[startIndex], ...body].join('\n').trim();
}

const ROLE_SECTION_HEADING: Record<CarouselSkeletonSlideRole, string> = {
  hook: '## 4.',
  point: '## 5.',
  app_mention: '## 9.',
  cta: '## 8.'
};

// Crude, deliberately non-LLM templating: every `[bracketed placeholder]` in
// the skeleton's literal example copy gets replaced with the user's idea
// text verbatim. This task only calls for an image-generation API, not a
// copywriting one — so slide headline/body are NOT rewritten by a model,
// just interpolated. Good enough to drive an image prompt; not a substitute
// for scriptwriter's actual LLM-authored copy for a "real" ContentPiece.
function fillTemplate(template: string, idea: string): string {
  return template.replace(/\[[^\]]+\]/g, idea).trim();
}

export type GeneratedSlidePlan = {
  order: number;
  role: CarouselSkeletonSlideRole;
  headline: string;
  body: string;
  visualDirection: string;
};

export function buildSlidePlan(idea: string, slides: CarouselSkeletonSlide[]): GeneratedSlidePlan[] {
  return slides.map((slide) => {
    const headline = fillTemplate(slide.template, idea);

    return {
      order: slide.order,
      role: slide.role,
      headline,
      body: idea,
      visualDirection: `${headline} — ${idea}`
    };
  });
}

type BrandProfile = { colors?: unknown; typography?: unknown };

// The 2a "style bible" — identical for every slide's prompt. Brand colors/
// typography read defensively (brand_profile is opaque jsonb, see
// scriptwriter/SKILL.md's own "se asume que existen" caveat for the same
// field) with a sane fallback rather than failing the whole generation over
// a brand profile that hasn't been filled in yet.
export function buildStyleBible(brandProfile: unknown, playbookText: string): string {
  const brand = (brandProfile ?? {}) as BrandProfile;
  const colors = brand.colors ? JSON.stringify(brand.colors) : 'sin paleta de marca definida — usa tonos neutros de alto contraste';
  const typography = brand.typography ? JSON.stringify(brand.typography) : 'sans-serif condensada en mayúsculas para titulares + sans-serif neutra para cuerpo';

  return [
    'STYLE BIBLE — se repite idéntico en el prompt de cada slide de este carrusel:',
    `Paleta de marca (respétala exactamente en cada slide): ${colors}`,
    `Tipografía de marca: ${typography}`,
    'Fondo/borde visualmente consistente entre todas las slides — deben leerse como una sola pieza, no imágenes sueltas.',
    extractPlaybookSection(playbookText, '## 6.')
  ].join('\n\n');
}

export function buildSlidePrompt(styleBible: string, slide: GeneratedSlidePlan, playbookText: string, appName: string): string {
  const rules = extractPlaybookSection(playbookText, ROLE_SECTION_HEADING[slide.role]);

  return [
    styleBible,
    `Slide ${slide.order} de este carrusel — rol: ${slide.role}.`,
    slide.role === 'app_mention' ? `Esta slide menciona la app "${appName}" — sigue estas reglas exactamente:` : 'Reglas del playbook aplicables a esta slide:',
    rules,
    `Titular a renderizar en la imagen, grande y legible: "${slide.headline}"`,
    `Texto de apoyo/contexto: ${slide.body}`,
    `Qué debe verse en la imagen: ${slide.visualDirection}`
  ].join('\n\n');
}

export type GeneratedSlideImage = GeneratedSlidePlan & { base64Png: string };

// Slide 1 goes through /images/generations (establishes the look); every
// other slide goes through /images/edits using slide 1's own image as the
// reference — anchoring every edit to the SAME reference (not chaining
// slide-N -> slide-N+1) avoids compounding drift across a long carousel.
// gpt-image's `n` parameter can't do this in one call: it reruns the same
// prompt with random variation, it can't express 10 slides with 10 distinct
// contents in a single request (verified against the current API docs
// before writing this) — sequential generate-then-edit is the real
// mechanism for a coherent set of DISTINCT slides, not a single batched call.
//
// `client` defaults to the real OpenAI-backed implementation
// (image-client.ts) but is a plain parameter — that's what let verification
// exercise this whole function with a stub client without any stub-only
// branch existing in this file.
export async function generateCarouselSlideImages(
  plan: GeneratedSlidePlan[],
  styleBible: string,
  playbookText: string,
  appName: string,
  client: ImageClient = realImageClient
): Promise<GeneratedSlideImage[]> {
  if (plan.length === 0) return [];

  const [first, ...rest] = plan;
  const firstImage = await client.generate(buildSlidePrompt(styleBible, first, playbookText, appName));
  const images: GeneratedSlideImage[] = [{ ...first, base64Png: firstImage.base64 }];

  // Sequential on purpose, not Promise.all — keeps cost/ordering predictable
  // and avoids bursting rate limits with N simultaneous OpenAI calls.
  for (const slide of rest) {
    const image = await client.edit(buildSlidePrompt(styleBible, slide, playbookText, appName), firstImage.base64);

    images.push({ ...slide, base64Png: image.base64 });
  }

  return images;
}

// ContentAsset.url / GalleryItem.url need a real url, and the Images API
// only ever returns base64 (no hosted-url mode exists for gpt-image models —
// verified against current docs). No object-storage client exists anywhere
// in this codebase yet (every other asset url is produced by an external
// Skill uploading to MinIO/S3 itself, then just handed to this app as a
// string — see gallery/page.tsx's own comment on that). Storing a data: url
// is a deliberate, disclosed stand-in for that missing upload step, not a
// silent shortcut: browsers render `<img src="data:...">` natively, so nothing
// downstream breaks, but these rows are meaningfully heavier than a real CDN
// url. Swap this one function for a real upload call once storage exists —
// nothing else in this file needs to change.
export function dataUrlFromPng(base64Png: string): string {
  return `data:image/png;base64,${base64Png}`;
}

// Zips slide images numbered 01.jpg, 02.jpg... — entirely in memory (sharp
// re-encodes the PNG bytes OpenAI returns into real JPEGs so the extension
// isn't a lie, jszip bundles them). Nothing is written to disk or to any
// storage; the caller (the downloadCarouselZip Server Action) only adds the
// requireUser() auth check on top of this — kept separate so this logic is
// callable/testable on its own (the auth check needs a real request context
// that a plain script can't provide, this doesn't).
export async function buildCarouselZip(slides: Array<{ order: number; dataUrl: string }>): Promise<{ base64: string; filename: string }> {
  const zip = new JSZip();

  for (const slide of slides.slice().sort((a, b) => a.order - b.order)) {
    const base64 = slide.dataUrl.split(',')[1] ?? '';
    const pngBytes = Buffer.from(base64, 'base64');
    const jpegBytes = await sharp(pngBytes).jpeg({ quality: 92 }).toBuffer();
    const filename = `${String(slide.order).padStart(2, '0')}.jpg`;

    zip.file(filename, jpegBytes);
  }

  const zipBytes = await zip.generateAsync({ type: 'nodebuffer' });

  return { base64: zipBytes.toString('base64'), filename: 'carousel.zip' };
}
