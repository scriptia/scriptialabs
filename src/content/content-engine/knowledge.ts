// `text` + union, not a PG enum — same reasoning as ADR-010. `research`
// entries come from unverified NotebookLM research; `observed` entries carry
// real evidence from a specific app and are what `research` entries get
// superseded by over time (see KnowledgeEntry.supersededById in schema.ts).
export const knowledgeSources = ['research', 'observed'] as const;
export type KnowledgeSource = (typeof knowledgeSources)[number];

export function isKnowledgeSource(value: string): value is KnowledgeSource {
  return (knowledgeSources as readonly string[]).includes(value);
}
