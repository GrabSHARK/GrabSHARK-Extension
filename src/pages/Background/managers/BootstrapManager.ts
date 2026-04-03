import { getCollections } from '../../../@/lib/actions/collections';
import { getTags } from '../../../@/lib/actions/tags';
import { UserManager } from './UserManager';
import { getEffectivePreferences } from '../../../@/lib/settings';

function normalizeCollections(data: any) {
    const raw = Array.isArray(data) ? data : data?.response || [];
    return raw.slice().sort((a: any, b: any) => (a.pathname || a.name || '').localeCompare(b.pathname || b.name || ''));
}

function normalizeTags(data: any) {
    const raw = Array.isArray(data) ? data : data?.response || [];
    return raw.slice().sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
}

async function parseJson(response: Response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

export class BootstrapManager {
    static async getDomainPreference(config: { baseUrl: string; apiKey: string }, domain: string) {
        const localPrefs = await getEffectivePreferences(domain);

        try {
            const response = await fetch(`${config.baseUrl}/api/v1/domain-preferences/${encodeURIComponent(domain)}`, {
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            const data = await parseJson(response);

            if (response.ok) {
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
            }
        } catch {
        }

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

    static async setDomainPreference(
        config: { baseUrl: string; apiKey: string },
        payload: { domain: string; enableSmartCapture?: boolean; enableSelectionMenu?: boolean },
    ) {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/domain-preferences/${encodeURIComponent(payload.domain)}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    enableSmartCapture: payload.enableSmartCapture,
                    enableSelectionMenu: payload.enableSelectionMenu,
                }),
            });
            const data = await parseJson(response);

            if (!response.ok) {
                return { success: false, error: data?.response || 'Failed to save domain preference' };
            }

            return { success: true, data: data?.response || null };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save domain preference' };
        }
    }

    static async suggestTags(
        config: { baseUrl: string; apiKey: string },
        payload: { url: string; title?: string; description?: string },
    ) {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/ai/suggest-tags`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const data = await parseJson(response);

            if (!response.ok) {
                return { success: false, error: data?.response || 'Failed to generate tag suggestions' };
            }

            return {
                success: true,
                data: {
                    tags: Array.isArray(data?.tags) ? data.tags : [],
                },
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to generate tag suggestions' };
        }
    }

    static async getBootstrapState(
        config: { baseUrl: string; apiKey: string; defaultCollection?: string; syncBookmarks?: boolean },
        domain?: string,
    ) {
        const [userResult, collectionsResult, tagsResult, prefsResult, domainResult] = await Promise.all([
            UserManager.getUser(config),
            getCollections(config.baseUrl, config.apiKey).catch(() => ({ data: { response: [] } })),
            getTags(config.baseUrl, config.apiKey).catch(() => ({ data: { response: [] } })),
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
                collections: normalizeCollections(collectionsResult.data),
                tags: normalizeTags(tagsResult.data),
                prefs: prefsResult.cached_user_prefs || null,
                domainPreference: domainResult?.success ? domainResult.data : null,
            },
        };
    }
}