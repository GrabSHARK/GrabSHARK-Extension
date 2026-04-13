import { getConfig, isConfigured } from '../../../@/lib/config';
import {
  applyDelta,
  replaceAll,
  getLastSyncTime,
  getLastFullSyncTime,
  clear,
  clearDomainPrefsCache,
} from '../../../@/lib/siteStateCache';
import { ApiClient, type BackgroundApiConfig } from './ApiClient';

const FULL_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface LinkUrlsResponse {
  response: {
    urls: Record<string, number>;
    serverTime: string;
  };
}

async function getConfigIfReady(): Promise<BackgroundApiConfig | null> {
  const configured = await isConfigured();
  if (!configured) return null;

  const config = await getConfig();
  if (!config.baseUrl || !config.apiKey) return null;

  return { baseUrl: config.baseUrl, apiKey: config.apiKey };
}

function isFullSyncNeeded(lastFullSyncTime: string | null): boolean {
  if (!lastFullSyncTime) return true;
  return Date.now() - new Date(lastFullSyncTime).getTime() > FULL_SYNC_INTERVAL_MS;
}

let instance: SiteStateSyncManager | null = null;

export class SiteStateSyncManager {
  private syncing = false;

  constructor() {
    instance = this;
  }

  static getInstance(): SiteStateSyncManager | null {
    return instance;
  }

  async sync(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;

    try {
      const config = await getConfigIfReady();
      if (!config) return;

      const lastSync = await getLastSyncTime();
      const lastFull = await getLastFullSyncTime();

      if (!lastSync || isFullSyncNeeded(lastFull)) {
        await this.syncFull(config);
      } else {
        await this.syncDelta(config, lastSync);
      }
    } catch {
      // Sync failures are non-critical — badge may be stale until next trigger
    } finally {
      this.syncing = false;
    }
  }

  private async syncFull(config: BackgroundApiConfig): Promise<void> {
    const data = await ApiClient.request<LinkUrlsResponse>(
      config,
      '/api/v1/links/urls',
    );
    await replaceAll(data.response.urls, data.response.serverTime);
    // Full sync: clear stale domain prefs so next visit fetches fresh data
    await clearDomainPrefsCache();
  }

  private async syncDelta(config: BackgroundApiConfig, since: string): Promise<void> {
    const data = await ApiClient.request<LinkUrlsResponse>(
      config,
      `/api/v1/links/urls?since=${encodeURIComponent(since)}`,
    );
    await applyDelta(data.response.urls, data.response.serverTime);
  }

  async clearAndReset(): Promise<void> {
    await clear();
    await clearDomainPrefsCache();
  }
}
