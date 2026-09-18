// Documents a bet carries. Like link kinds, this is a table (`bet_documents`)
// rather than columns on `bets`, so a new kind is one content entry and no
// migration. The discovery pipeline pushes `case` — plus the legacy `prompt`,
// `spec` and `memo` so historical bets keep their attachments; `other` exists
// so anything pasted in by hand has somewhere to live.
//
// `case` is the important one: it is the ~1,250-word Bet Case that replaced the
// brief + memo + spec + build-prompt chain, and it is the ONLY input
// product-agent consumes. It was missing from this list, which made zod reject
// the whole ingest payload (not just the document) with a 422 on every push
// that carried one.
export const betDocumentKinds = ['case', 'prompt', 'spec', 'memo', 'other'] as const;

export type BetDocumentKind = (typeof betDocumentKinds)[number];

export const betDocumentKindLabels: Record<BetDocumentKind, string> = {
  case: 'Bet Case',
  prompt: 'Build prompt',
  spec: 'Spec',
  memo: 'Decision memo',
  other: 'Other'
};

// Icon names from lucide-react, resolved by the documents panel — same
// indirection as betLinkKindIcons.
export const betDocumentKindIcons: Record<BetDocumentKind, string> = {
  case: 'FileSearch',
  prompt: 'Terminal',
  spec: 'FileText',
  memo: 'ScrollText',
  other: 'File'
};

export function isBetDocumentKind(value: string): value is BetDocumentKind {
  return (betDocumentKinds as readonly string[]).includes(value);
}
