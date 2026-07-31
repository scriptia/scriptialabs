import type { BadgeTone } from '@/components/primitives';

// `text` + union, not a PG enum — same reasoning as ADR-010. `research`
// entries come from unverified NotebookLM research; `observed` entries carry
// real evidence from a specific app and are what `research` entries get
// superseded by over time (see KnowledgeEntry.supersededById in schema.ts).
export const knowledgeSources = ['research', 'observed'] as const;
export type KnowledgeSource = (typeof knowledgeSources)[number];

export function isKnowledgeSource(value: string): value is KnowledgeSource {
  return (knowledgeSources as readonly string[]).includes(value);
}

export const knowledgeSourceLabels: Record<KnowledgeSource, string> = {
  research: 'Research',
  observed: 'Observed'
};

// observed = confirmed with a specific app's real evidence, so it gets the
// tone that already reads as "trustworthy" elsewhere (bet-status uses the
// same success tone for deployed/scaling); research is unverified, so it
// gets the neutral tone rather than a warning one — it isn't wrong, just
// not yet confirmed.
export const knowledgeSourceTones: Record<KnowledgeSource, BadgeTone> = {
  research: 'neutral',
  observed: 'success'
};
