// Link kinds a bet can carry. This is a table (`bet_links`), not a fixed set of
// columns on `bets`, precisely so this list can grow — "specially TikTok" today
// means Instagram and YouTube tomorrow, and neither should need a migration.
export const betLinkKinds = ['drive', 'repo', 'tiktok', 'instagram', 'youtube', 'x', 'website', 'analytics', 'design', 'other'] as const;

export type BetLinkKind = (typeof betLinkKinds)[number];

export const betLinkKindLabels: Record<BetLinkKind, string> = {
  drive: 'Drive / materials',
  repo: 'Repository',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  website: 'Website',
  analytics: 'Analytics',
  design: 'Design',
  other: 'Other'
};

// Icon names from lucide-react, resolved by the link list component. Kept here
// so a new kind is a single content entry rather than a component change.
export const betLinkKindIcons: Record<BetLinkKind, string> = {
  drive: 'FolderOpen',
  repo: 'GitBranch',
  tiktok: 'Music2',
  instagram: 'Instagram',
  youtube: 'Youtube',
  x: 'Twitter',
  website: 'Globe',
  analytics: 'BarChart3',
  design: 'Palette',
  other: 'Link2'
};

export function isBetLinkKind(value: string): value is BetLinkKind {
  return (betLinkKinds as readonly string[]).includes(value);
}

export const betUpdateKinds = ['note', 'decision', 'blocker', 'milestone'] as const;
export type BetUpdateKind = (typeof betUpdateKinds)[number];

export const betUpdateKindLabels: Record<BetUpdateKind, string> = {
  note: 'Note',
  decision: 'Decision',
  blocker: 'Blocker',
  milestone: 'Milestone'
};

export function isBetUpdateKind(value: string): value is BetUpdateKind {
  return (betUpdateKinds as readonly string[]).includes(value);
}
