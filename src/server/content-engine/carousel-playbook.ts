import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The single source of truth for carousel copy/design rules — see
// skills/carousel-production/carousel-playbook.md's own header comment for
// who else reads it (scriptwriter, carousel-production, both as Skills
// running outside this process). generateCarousel() reads the SAME file
// here, at runtime, in-process, instead of duplicating its rules in code.
//
// IMPORTANT — do not remove without re-verifying: this path is NOT reached
// via import/require, so Next.js's build-time file tracing cannot discover it
// on its own (see next.config.ts's `outputFileTracingIncludes`, added
// specifically for this file). Without that entry, this works in `next dev`
// (full repo on disk) but 404s/ENOENTs in the standalone production build
// (`.next/standalone` only contains files Next traced) — confirmed by
// building without the config entry first, see the commit that introduced
// this file for the before/after.
const PLAYBOOK_PATH = path.join(process.cwd(), 'skills/carousel-production/carousel-playbook.md');

let cached: string | null = null;

export async function loadCarouselPlaybook(): Promise<string> {
  cached ??= await readFile(PLAYBOOK_PATH, 'utf-8');

  return cached;
}
