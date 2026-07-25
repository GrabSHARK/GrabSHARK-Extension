import { getConfig, isConfigured } from '../../../@/lib/config';
import {
  applyDelta,
  replaceAll,
  getLastSyncTime,
  removeUrl,
  clear,
  clearDomainPrefsCache,
  setCachedDomainPref,
  setGlobalDomainDefaults,
} from '../../../@/lib/siteStateCache';
import { ApiClient, ApiRequestError, type BackgroundApiConfig } from './ApiClient';

/** Minimum interval between two consecutive sync() calls. */
const SYNC_COOLDOWN_MS = 60 * 1000; // 60 seconds

interface LinkUrlsResponse {
  response: {
    urls: Record<string, number>;
    serverTime: string;
  };
}

interface DomainPrefsResponse {
  response: {
    globalDefaults: {
      enableSmartCapture: boolean;
      enableSelectionMenu: boolean;
    };
    domains: Array<{
      domain: string;
      enableSmartCapture: boolean;
      enableSelectionMenu: boolean;
      isModified: boolean;
    }>;
  };
}

async function getConfigIfReady(): Promise<BackgroundApiConfig | null> {
  const configured = await isConfigured();
  if (!configured) return null;

  const config = await getConfig();
  if (!config.baseUrl || !config.apiKey) return null;

  return { baseUrl: config.baseUrl, apiKey: config.apiKey };
}

let instance: SiteStateSyncManager | null = null;

export class SiteStateSyncManager {
  private syncing = false;
  private lastSyncAttempt = 0;

  constructor() {
    instance = this;
  }

  static getInstance(): SiteStateSyncManager | null {
    return instance;
  }

  /**
   * Run a sync if cooldown has elapsed.
   * - First-ever sync (no timestamp) → full sync.
   * - Subsequent syncs → delta only.
   */
  async sync(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncAttempt < SYNC_COOLDOWN_MS) {
      console.log('[SiteStateSync] Cooldown active, skipping');
      return;
    }
    if (this.syncing) {
      console.log('[SiteStateSync] Already syncing, skipping');
      return;
    }
    this.syncing = true;
    this.lastSyncAttempt = now;

    try {
      const config = await getConfigIfReady();
      if (!config) {
        console.log('[SiteStateSync] Config not ready, skipping');
        return;
      }

      const lastSync = await getLastSyncTime();
      console.log('[SiteStateSync] lastSync:', lastSync);

      if (!lastSync) {
        console.log('[SiteStateSync] Running FULL sync (initial)');
        await this.syncFull(config);
        console.log('[SiteStateSync] Full sync complete');
      } else {
        console.log('[SiteStateSync] Running DELTA sync since:', lastSync);
        await this.syncDelta(config, lastSync);
        console.log('[SiteStateSync] Delta sync complete');
      }
    } catch (e) {
      console.error('[SiteStateSync] Sync failed:', e);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Force a full sync regardless of cooldown or existing timestamp.
   * Used on extension install/update.
   * Fetches all link URLs AND all domain preferences in parallel.
   */
  async syncFull(config?: BackgroundApiConfig): Promise<void> {
    const resolvedConfig = config ?? (await getConfigIfReady());
    if (!resolvedConfig) return;

    const [urlsData, domainPrefsData] = await Promise.all([
      ApiClient.request<LinkUrlsResponse>(resolvedConfig, '/api/v1/links/urls'),
      ApiClient.request<DomainPrefsResponse>(resolvedConfig, '/api/v1/domain-preferences').catch(() => null),
    ]);

    await replaceAll(urlsData.response.urls, urlsData.response.serverTime);

    // Populate domain prefs cache from bulk fetch
    await clearDomainPrefsCache();
    if (domainPrefsData?.response) {
      const globalDefaults = domainPrefsData.response.globalDefaults ?? null;

      // Store global defaults so cache misses can use them directly
      if (globalDefaults) {
        await setGlobalDomainDefaults(globalDefaults);
      }

      for (const pref of domainPrefsData.response.domains ?? []) {
        await setCachedDomainPref(pref.domain, {
          enableSmartCapture: pref.enableSmartCapture,
          enableSelectionMenu: pref.enableSelectionMenu,
          isModified: pref.isModified,
          globalDefaults,
        });
      }
      console.log('[SiteStateSync] Cached', (domainPrefsData.response.domains?.length ?? 0), 'domain preferences');
    }
  }

  private async syncDelta(config: BackgroundApiConfig, since: string): Promise<void> {
    const data = await ApiClient.request<LinkUrlsResponse>(
      config,
      `/api/v1/links/urls?since=${encodeURIComponent(since)}`,
    );
    await applyDelta(data.response.urls, data.response.serverTime);
  }

  /**
   * Verify whether a specific link still exists on the server.
   * If the link has been deleted (404), removes the URL from the local cache.
   * Returns the verified linkId, or null if the link no longer exists.
   */
  async verifyLink(url: string, linkId: number): Promise<number | null> {
    try {
      const config = await getConfigIfReady();
      if (!config) return linkId; // can't verify, assume it still exists

      await ApiClient.request(config, `/api/v1/links/${linkId}`);
      return linkId; // link still exists
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) {
        console.log('[SiteStateSync] Link', linkId, 'no longer exists, removing from cache');
        await removeUrl(url);
        return null;
      }
      // Network error or other issue — don't remove, assume it still exists
      return linkId;
    }
  }

  async clearAndReset(): Promise<void> {
    await clear();
    await clearDomainPrefsCache();
  }
}
