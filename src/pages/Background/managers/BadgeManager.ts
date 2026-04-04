import { getBrowser } from '../../../@/lib/utils';
import { getConfig } from '../../../@/lib/config';
import { getPreferences } from '../../../@/lib/settings';
import { checkLinkExists } from '../../../@/lib/actions/links';

const browser = getBrowser();
const BADGE_CACHE_TTL_MS = 30_000;

interface BadgeCacheEntry {
    exists: boolean;
    expiresAt: number;
}

export class BadgeManager {
    private existenceCache = new Map<string, BadgeCacheEntry>();
    private inFlightChecks = new Map<string, Promise<boolean>>();
    constructor() {
        this.init();
    }

    private init() {
        // Listen for tab activation
        browser.tabs.onActivated.addListener(async ({ tabId }) => {
            await this.updateIconBadge(tabId);
        });

        // Listen for tab updates
        browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                await this.updateIconBadge(tabId, tab.url);
            }
        });

        // Listen for preference changes
        browser.storage.onChanged.addListener(async (changes, area) => {
            if (area === 'local' && changes.grabshark_preferences) {

                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                for (const tab of tabs) {
                    if (tab.id && tab.url) {
                        await this.updateIconBadge(tab.id, tab.url);
                    }
                }
            }
        });
    }

    public async updateIconBadge(tabId: number, url?: string) {
        if (!url) {
            try {
                const tab = await browser.tabs.get(tabId);
                url = tab.url;
            } catch (e) {
                return;
            }
        }

        if (!url) return;

        // Skip internal pages
        if (url.startsWith('chrome://') || url.startsWith('about:')) {
            this.clearBadge(tabId);
            return;
        }

        const prefs = await getPreferences();

        if (!prefs.showSavedMark) {
            this.clearBadge(tabId);
            return;
        }

        const cachedConfig = await getConfig();
        if (!cachedConfig.baseUrl || !cachedConfig.apiKey) {
            this.clearBadge(tabId);
            return;
        }

        const linkExists = await this.getLinkExists(cachedConfig.baseUrl, cachedConfig.apiKey, url);

        if (linkExists) {
            this.setBadge(tabId, '✓', '#2c46f1', '#FFFFFF');
        } else {
            this.clearBadge(tabId);
        }
    }


    private buildCacheKey(baseUrl: string, url: string): string {
        return `${baseUrl}::${url}`;
    }

    private getCachedResult(cacheKey: string): boolean | null {
        const entry = this.existenceCache.get(cacheKey);
        if (!entry) {
            return null;
        }

        if (entry.expiresAt <= Date.now()) {
            this.existenceCache.delete(cacheKey);
            return null;
        }

        return entry.exists;
    }

    private setCachedResult(cacheKey: string, exists: boolean): void {
        this.existenceCache.set(cacheKey, {
            exists,
            expiresAt: Date.now() + BADGE_CACHE_TTL_MS,
        });
    }

    private async getLinkExists(baseUrl: string, apiKey: string, url: string): Promise<boolean> {
        const cacheKey = this.buildCacheKey(baseUrl, url);
        const cached = this.getCachedResult(cacheKey);
        if (cached !== null) {
            return cached;
        }

        const existingPromise = this.inFlightChecks.get(cacheKey);
        if (existingPromise) {
            return existingPromise;
        }

        const requestPromise = (async () => {
            try {
                const exists = await checkLinkExists(baseUrl, apiKey, url);
                this.setCachedResult(cacheKey, exists);
                return exists;
            } finally {
                this.inFlightChecks.delete(cacheKey);
            }
        })();

        this.inFlightChecks.set(cacheKey, requestPromise);
        return requestPromise;
    }

    private setBadge(tabId: number, text: string, bgColor: string, _textColor: string) {
        if (browser.action) {
            browser.action.setBadgeText({ tabId, text });
            browser.action.setBadgeBackgroundColor({ tabId, color: bgColor });
            if (browser.action.setBadgeTextColor) {
                browser.action.setBadgeTextColor({ tabId, color: _textColor });
            }
        } else {
            browser.browserAction.setBadgeText({ tabId, text });
            browser.browserAction.setBadgeBackgroundColor({ tabId, color: bgColor });
        }
    }

    private clearBadge(tabId: number) {
        if (browser.action) {
            browser.action.setBadgeText({ tabId, text: '' });
        } else {
            browser.browserAction.setBadgeText({ tabId, text: '' });
        }
    }
}



