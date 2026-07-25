import { clearConfig, getConfig, isConfigured, saveConfig } from '../../../@/lib/config';
import { clear as clearUrlIndex, clearDomainPrefsCache } from '../../../@/lib/siteStateCache';
import type { configType } from '../../../@/lib/validators/config';

function isInjectableUrl(url?: string): boolean {
    return !!url && /^(https?:|file:)/.test(url);
}

async function notifyConfiguredTabs(): Promise<void> {
    const tabs = (await chrome.tabs.query({})).filter((tab) => tab.id && isInjectableUrl(tab.url));

    await Promise.all(
        tabs.map(async (tab) => {
            try {
                await chrome.tabs.sendMessage(tab.id!, { type: 'EXTENSION_CONFIG_UPDATED' });
            } catch {
                // Content script not loaded in this tab — will pick up config on next navigation
            }
        }),
    );
}

export class ConfigManager {
    static async getConfig() {
        try {
            return { success: true, data: await getConfig() };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to read config' };
        }
    }

    static async saveConfig(config: configType) {
        try {
            await saveConfig(config);
            await notifyConfiguredTabs();
            return { success: true, data: config };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save config' };
        }
    }

    static async clearConfig() {
        try {
            await clearConfig();
            await clearUrlIndex();
            await clearDomainPrefsCache();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to clear config' };
        }
    }

    static async checkConfigured() {
        try {
            const config = await getConfig();
            const configured = await isConfigured();
            return { success: true, data: { configured, baseUrl: config.baseUrl } };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to check config' };
        }
    }
}
