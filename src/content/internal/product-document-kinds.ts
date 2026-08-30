// Documents a *product* carries, as opposed to a bet's (see ./document-kinds.ts).
//
// These are the markdown artifacts product-agent writes and that downstream
// agents read: the builder needs the feature specifications, the requirements
// and the identity; a marketing agent needs the App Store listing. Until this
// table existed the product ingest carried feature titles and legal prose and
// nothing else, so a builder receiving `build.json` got ten feature names with
// no specification behind them — the documents stayed on the machine that ran
// the stage.
//
// `kind` is the ROLE of the document, not its filename: several features share
// the `feature` kind and are told apart by `path`, which is why uniqueness is
// on (productId, path) rather than (productId, kind).
export const productDocumentKinds = [
  'identity',
  'readme',
  'requirements',
  'funnel',
  'featureIndex',
  'feature',
  'storeListing',
  'reviewNotes',
  'aso',
  'screenshots',
  'other'
] as const;

export type ProductDocumentKind = (typeof productDocumentKinds)[number];

export const productDocumentKindLabels: Record<ProductDocumentKind, string> = {
  identity: 'Identity',
  readme: 'Product overview',
  requirements: 'Requirements',
  funnel: 'Funnel',
  featureIndex: 'Feature index',
  feature: 'Feature spec',
  storeListing: 'App Store listing',
  reviewNotes: 'App Review notes',
  aso: 'ASO',
  screenshots: 'Screenshot plan',
  other: 'Other'
};

// Icon names from lucide-react, resolved by the panel — same indirection as
// betDocumentKindIcons.
export const productDocumentKindIcons: Record<ProductDocumentKind, string> = {
  identity: 'Fingerprint',
  readme: 'BookOpen',
  requirements: 'ListChecks',
  funnel: 'Filter',
  featureIndex: 'ListTree',
  feature: 'FileText',
  storeListing: 'Store',
  reviewNotes: 'ShieldCheck',
  aso: 'Search',
  screenshots: 'Images',
  other: 'File'
};

export function isProductDocumentKind(value: string): value is ProductDocumentKind {
  return (productDocumentKinds as readonly string[]).includes(value);
}
