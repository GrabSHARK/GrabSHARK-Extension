import {
    clearSiteOverride,
    getEffectivePreferences,
    getPreferences,
    getSiteOverrides,
    savePreferences,
    saveSiteOverride,
    type ExtensionPreferences,
    type SiteOverride,
} from '../../../@/lib/settings';

export class PreferencesManager {
    static async getPreferences() {
        try {
            return { success: true, data: await getPreferences() };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to read preferences' };
        }
    }

    static async savePreferences(preferences: ExtensionPreferences) {
        try {
            await savePreferences(preferences);
            return { success: true, data: preferences };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save preferences' };
        }
    }

    static async getSiteOverrides() {
        try {
            return { success: true, data: await getSiteOverrides() };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to read site overrides' };
        }
    }

    static async saveSiteOverride(payload: { hostname: string; key: keyof SiteOverride; value: boolean }) {
        try {
            await saveSiteOverride(payload.hostname, payload.key, payload.value);
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save site override' };
        }
    }

    static async clearSiteOverride(payload: { hostname: string; key: keyof SiteOverride }) {
        try {
            await clearSiteOverride(payload.hostname, payload.key);
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to clear site override' };
        }
    }

    static async getEffectivePreferences(hostname?: string) {
        try {
            return { success: true, data: await getEffectivePreferences(hostname) };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to resolve effective preferences' };
        }
    }

    static async getLocaleSettings() {
        try {
            const result = await chrome.storage.local.get(['grabshark_locale', 'grabshark_locale_setting']);
            return {
                success: true,
                data: {
                    locale: result.grabshark_locale || 'en',
                    localeSetting: result.grabshark_locale_setting || result.grabshark_locale || 'en',
                },
            };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to read locale settings' };
        }
    }

    static async saveLocaleSettings(payload: { localeSetting: 'en' | 'tr' | 'system'; locale?: string }) {
        try {
            if (payload.localeSetting === 'system') {
                await chrome.storage.local.set({ grabshark_locale_setting: 'system' });
            } else {
                await chrome.storage.local.set({
                    grabshark_locale_setting: payload.localeSetting,
                    grabshark_locale: payload.locale || payload.localeSetting,
                });
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save locale settings' };
        }
    }
}
