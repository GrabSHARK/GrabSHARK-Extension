// Backward-compatibility re-export.
// All logic now lives in siteStateCache.ts — this file exists so that
// existing consumers (BadgeManager, LinksManager, ConfigManager, etc.)
// continue to work without import-path changes.

export {
  hasUrl,
  getLinkIdByUrl,
  addUrl,
  removeUrl,
  removeUrlByLinkId,
  applyDelta,
  replaceAll,
  getLastSyncTime,
  getLastFullSyncTime,
  clear,
} from './siteStateCache';
