import { clearConfig, getConfig, isConfigured, saveConfig } from '../../../@/lib/config';
import type { configType } from '../../../@/lib/validators/config';

const EXTENSION_MARKER_ID = 'grabshark-extension-installed';
const DEBUG_PREFIX = '[GrabSHARK EXT][ConfigManager]';

function debugLog(message: string, meta?: unknown): void {
    if (typeof meta === 'undefined') console.info(DEBUG_PREFIX, message);
    else console.info(DEBUG_PREFIX, message, meta);
}

function isInjectableUrl(url?: string): boolean {
    return !!url && /^(https?:|file:)/.test(url);
}

async function ensureConfiguredTabsReady(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    debugLog('ensureConfiguredTabsReady start', { tabCount: tabs.length });

    await Promise.all(tabs.map(async (tab) => {
        if (!tab.id || !isInjectableUrl(tab.url)) {
            return;
        }

        try {
            await chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_CONFIG_UPDATED' });
            return;
        } catch {
        }

        try {
            const markerResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (markerId: string) => Boolean(document.getElementById(markerId)),
                args: [EXTENSION_MARKER_ID],
            });

            if (markerResults.some((result) => result.result)) {
                try {
                    await chrome.tabs.sendMessage(tab.id, { type: 'EXTENSION_CONFIG_UPDATED' });
                } catch {
                }
                return;
            }

            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['contentScript.css'],
            });

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['contentScript.js'],
            });
        } catch {
        }
    }));
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
            debugLog('saving config', { baseUrl: config.baseUrl });
            await saveConfig(config);
            await ensureConfiguredTabsReady();
            return { success: true, data: config };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Failed to save config' };
        }
    }

    static async clearConfig() {
        try {
            await clearConfig();
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

