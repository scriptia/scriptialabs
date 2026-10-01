import 'server-only';

import { get, put } from '@vercel/blob';

// Checkpoint bundles: what an orchestrator uploads when a session pauses, so
// the run can continue on a different machine. A tar.gz of the agent's run
// directory plus the Claude transcripts of its sessions (CLAUDE_CONFIG_DIR is
// per-run, see idion-orchestrator/orchestrator/checkpoint.py).
//
// Uploaded in PARTS because a Vercel function rejects request bodies above
// ~4.5 MB and a transcript-heavy bundle is larger. Each part is its own blob;
// the run's `checkpoint` jsonb lists them in order with the bundle's sha256.
//
// PRIVATE by default. Transcripts carry prompts, file contents and whatever a
// session read from disk, so they must not sit behind a guessable public URL.
// Downloads go through GET /api/runs/[id]/checkpoint, behind the runner token.
// A Blob store created as public-only can set CHECKPOINT_BLOB_ACCESS=public;
// the pathname then includes the run id and an upload id nobody outside the
// runner ever sees.

export const CHECKPOINT_PART_MAX_BYTES = 4 * 1024 * 1024;

type BlobAccess = 'public' | 'private';

function access(): BlobAccess {
  return process.env.CHECKPOINT_BLOB_ACCESS === 'public' ? 'public' : 'private';
}

export function checkpointPartPath(runId: string, uploadId: string, part: number): string {
  return `checkpoints/${runId}/${uploadId}/part-${String(part).padStart(3, '0')}`;
}

export async function putCheckpointPart(pathname: string, bytes: Buffer): Promise<{ pathname: string; bytes: number }> {
  // Bounded like uploadProductAsset: @vercel/blob retries internally, and a
  // rejected token otherwise outlasts the function and surfaces as an empty 502.
  const blob = await put(pathname, bytes, {
    access: access(),
    contentType: 'application/octet-stream',
    addRandomSuffix: false,
    allowOverwrite: true,
    abortSignal: AbortSignal.timeout(30_000)
  });
  return { pathname: blob.pathname, bytes: bytes.length };
}

export async function getCheckpointPart(pathname: string): Promise<ReadableStream<Uint8Array> | null> {
  const result = await get(pathname, { access: access(), useCache: false });
  if (!result || result.statusCode !== 200) return null;
  return result.stream;
}
