import 'server-only';

// Talks to OpenAI's Images API directly (gpt-image-2, verified against
// https://developers.openai.com/api/docs/guides/image-generation on
// 2026-08-10 — current model lineup is gpt-image-2/1.5/1/1-mini; the Images
// API always returns base64 (`data[0].b64_json`), never a hosted url, for
// every model in that lineup). No SDK dependency: two plain fetch calls is
// less surface than adding the `openai` package for this alone.
const IMAGE_MODEL = 'gpt-image-2';
const IMAGES_API_BASE = 'https://api.openai.com/v1/images';

// generateCarousel's clean-failure path (point 4 of the task) checks this
// BEFORE calling generate()/edit() — an unconfigured key must never reach a
// real fetch call and surface as a raw network/500 error in the UI.
export function isImageApiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    // Only reachable if a caller skips isImageApiConfigured() — that's a
    // programming error in this codebase, not a user-facing state.
    throw new Error('OPENAI_API_KEY is not set — call isImageApiConfigured() first.');
  }

  return key;
}

export type GeneratedImage = { base64: string };

// The real client — every call in this module is dependency-injected into
// generateCarouselSlides() (carousel-generation.ts) behind an
// `ImageClient` parameter that defaults to these two functions. That's what
// lets verification swap in a stub client without any stub-only branch
// existing in this file or in the Server Action — see the commit message
// for how that was actually exercised (fake OPENAI_API_KEY + a mocked
// global fetch in a throwaway script, reverted after, never shipped).
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const response = await fetch(`${IMAGES_API_BASE}/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1536',
      quality: 'high'
    })
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(`OpenAI image generation failed (${response.status}): ${detail}`);
  }

  const body = (await response.json()) as { data: Array<{ b64_json: string }> };

  return { base64: body.data[0].b64_json };
}

// Uses the first generated slide as visual reference for every subsequent
// one (not a chain of slide-N -> slide-N+1) — chaining edits compounds
// drift from the original style with every step; anchoring every edit to
// the same reference keeps all slides equally close to the original.
export async function editImage(prompt: string, referenceBase64Png: string): Promise<GeneratedImage> {
  const referenceBytes = Buffer.from(referenceBase64Png, 'base64');
  const form = new FormData();

  form.append('model', IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', '1024x1536');
  form.append('image', new Blob([referenceBytes], { type: 'image/png' }), 'reference.png');

  const response = await fetch(`${IMAGES_API_BASE}/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form
  });

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(`OpenAI image edit failed (${response.status}): ${detail}`);
  }

  const body = (await response.json()) as { data: Array<{ b64_json: string }> };

  return { base64: body.data[0].b64_json };
}

export type ImageClient = {
  generate: typeof generateImage;
  edit: typeof editImage;
};

export const realImageClient: ImageClient = { generate: generateImage, edit: editImage };
