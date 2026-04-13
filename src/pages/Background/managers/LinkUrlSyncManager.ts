// Backward-compatibility re-export.
// All logic now lives in SiteStateSyncManager.ts — this file exists so that
// existing consumers (MessageRouter, Background/index) continue to work
// without import-path changes.

export { SiteStateSyncManager as LinkUrlSyncManager } from './SiteStateSyncManager';
