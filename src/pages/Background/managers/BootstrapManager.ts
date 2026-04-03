import { getEffectivePreferences } from '../../../@/lib/settings';
import { ApiClient, type BackgroundApiConfig } from './ApiClient';
import { CollectionsManager } from './CollectionsManager';
import { UserManager } from './UserManager';

export class BootstrapManager {
    static async getDomainPreference(config: BackgroundApiConfig, domain: string) {
        const localPrefs = await getEffectivePreferences(domain);

        try {
            const data = await ApiClient.request<{ response?: any }>(config, `/api/v1/domain-preferences/${encodeURIComponent(domain)}`);
            const preference = data?.response || {};
            return {
                success: true,
                data: {
                    configured: true,
                    baseUrl: config.baseUrl,
                    domain,
                    enableSmartCapture: preference.enableSmartCapture ?? localPrefs.enableSmartCapture,
                    enableSelectionMenu: preference.enableSelectionMenu ?? localPrefs.enableSelectionMenu,
                    isModified: preference.isModified ?? false,
                    globalDefaults: preference.globalDefaults ?? null,
                },
            };
        } catch {
            return {
                success: true,
                data: {
                    configured: true,
                    baseUrl: config.baseUrl,
                    domain,
                    enableSmartCapture: localPrefs.enableSmartCapture,
                    enableSelectionMenu: localPrefs.enableSelectionMenu,
                    isModified: false,
                    globalDefaults: null,
                },
            };
        }
    }

    static async setDomainPreference(config: BackgroundApiConfig, payload: { domain: string; enableSmartCapture?: boolean; enableSelectionMenu?: boolean }) {
        try {
            const data = await ApiClient.request<{ response?: any }>(config, `/api/v1/domain-preferences/${encodeURIComponent(payload.domain)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    enableSmartCapture: payload.enableSmartCapture,
                    enableSelectionMenu: payload.enableSelectionMenu,
                }),
            });
            return { success: true, data: data?.response || null };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save domain preference' };
        }
    }

    static async suggestTags(config: BackgroundApiConfig, payload: { url: string; title?: string; description?: string }) {
        try {
            const data = await ApiClient.request<{ tags?: string[] }>(config, '/api/v1/ai/suggest-tags', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            return { success: true, data: { tags: Array.isArray(data?.tags) ? data.tags : [] } };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to generate tag suggestions' };
        }
    }

    static async getBootstrapState(config: { baseUrl: string; apiKey: string; defaultCollection?: string; syncBookmarks?: boolean }, domain?: string) {
        const [userResult, collectionsResult, tagsResult, prefsResult, domainResult] = await Promise.all([
            UserManager.getUser(config),
            CollectionsManager.getCollections(config),
            CollectionsManager.getTags(config),
            chrome.storage.local.get(['cached_user_prefs']),
            domain ? this.getDomainPreference(config, domain) : Promise.resolve(null),
        ]);

        return {
            success: true,
            data: {
                configured: true,
                baseUrl: config.baseUrl,
                config: {
                    baseUrl: config.baseUrl,
                    defaultCollection: config.defaultCollection || '',
                    syncBookmarks: config.syncBookmarks || false,
                },
                user: userResult.success ? userResult.data : null,
                collections: collectionsResult.success ? (collectionsResult.data?.response || []) : [],
                tags: tagsResult.success ? (tagsResult.data?.response || []) : [],
                prefs: prefsResult.cached_user_prefs || null,
                domainPreference: domainResult?.success ? domainResult.data : null,
            },
        };
    }
}

