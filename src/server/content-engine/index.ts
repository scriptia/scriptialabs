export { getApps, getAppById } from './apps';
export { getKnowledgeEntries, type KnowledgeEntryFilters } from './knowledge';
export { getTrendSources, getTrendSourceById, type TrendSourceFilters } from './trend-sources';
export {
  getContentPieces,
  getContentPieceById,
  createContentPiece,
  getReviewQueue,
  getPerformanceSummary,
  type ContentPieceFilters,
  type CreateContentPieceInput,
  type ReviewQueueFilters,
  type PerformanceSummaryFilters
} from './content-pieces';
export { getStalePublications, type StalePublicationFilters } from './publications';
export { getGalleryItems, searchGalleryItems, type GalleryItemFilters, type GalleryItemSearchFilters } from './gallery';
export { produceContentPiece, type ProduceInput, type FinishedAsset, type FinishedSlideAsset } from './production';

// GET /api/content-engine/skills is deliberately not implemented yet — see
// ADR-012. skills/*/SKILL.md was copied into this repo's root in a later
// commit, so the files exist now, but reading them back out for the
// dashboard is still unbuilt — not needed for Fase 3 bloque 1 (content).
