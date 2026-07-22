// Documents a bet carries. Like link kinds, this is a table (`bet_documents`)
// rather than columns on `bets`, so a new kind is one content entry and no
// migration. The discovery pipeline pushes `prompt`, `spec` and `memo`; `other`
// exists so anything pasted in by hand has somewhere to live.
export const betDocumentKinds = ['prompt', 'spec', 'memo', 'other'] as const;

export type BetDocumentKind = (typeof betDocumentKinds)[number];

export const betDocumentKindLabels: Record<BetDocumentKind, string> = {
  prompt: 'Build prompt',
  spec: 'Spec',
  memo: 'Decision memo',
  other: 'Other'
};

// Icon names from lucide-react, resolved by the documents panel — same
// indirection as betLinkKindIcons.
export const betDocumentKindIcons: Record<BetDocumentKind, string> = {
  prompt: 'Terminal',
  spec: 'FileText',
  memo: 'ScrollText',
  other: 'File'
};

export function isBetDocumentKind(value: string): value is BetDocumentKind {
  return (betDocumentKinds as readonly string[]).includes(value);
}
