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

function uniqueTabsById(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
    const seen = new Set<number>();
    return tabs.filter((tab) => {
        if (!tab.id || seen.has(tab.id)) return false;
        seen.add(tab.id);
        return true;
    });
}

async function getFallbackBootstrapTabs(): Promise<chrome.tabs.Tab[]> {
    const [activeTabs, highlightedTabs] = await Promise.all([
        chrome.tabs.query({ active: true }),
        chrome.tabs.query({ highlighted: true }),
    ]);

    return uniqueTabsById([...activeTabs, ...highlightedTabs]).filter((tab) => isInjectableUrl(tab.url));
}

async function tryNotifyConfiguredTab(tabId: number): Promise<boolean> {
    try {
        await chrome.tabs.sendMessage(tabId, { type: 'EXTENSION_CONFIG_UPDATED' });
        return true;
    } catch {
        return false;
    }
}

async function tryBootstrapFocusedTab(tab: chrome.tabs.Tab): Promise<boolean> {
    if (!tab.id || !isInjectableUrl(tab.url)) {
        return false;
    }

    const tabId = tab.id;

    try {
        const markerResults = await chrome.scripting.executeScript({
            target: { tabId },
            func: (markerId: string) => Boolean(document.getElementById(markerId)),
            args: [EXTENSION_MARKER_ID],
        });

        if (markerResults.some((result) => result.result)) {
            return await tryNotifyConfiguredTab(tabId);
        }

        await chrome.scripting.insertCSS({
            target: { tabId },
            files: ['contentScript.css'],
        });

        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['contentScript.js'],
        });

        return await tryNotifyConfiguredTab(tabId);
    } catch {
        return false;
    }
}

async function ensureConfiguredTabsReady(): Promise<void> {
    const tabs = (await chrome.tabs.query({})).filter((tab) => tab.id && isInjectableUrl(tab.url));
    debugLog('ensureConfiguredTabsReady start', { tabCount: tabs.length });

    const notificationResults = await Promise.all(
        tabs.map(async (tab) => ({
            tabId: tab.id!,
            notified: await tryNotifyConfiguredTab(tab.id!),
        })),
    );

    const notifiedTabIds = new Set(notificationResults.filter((result) => result.notified).map((result) => result.tabId));
    const fallbackTabs = (await getFallbackBootstrapTabs()).filter((tab) => !notifiedTabIds.has(tab.id!));

    debugLog('ensureConfiguredTabsReady notification summary', {
        notifiedCount: notifiedTabIds.size,
        fallbackTabCount: fallbackTabs.length,
    });

    const fallbackResults = await Promise.all(
        fallbackTabs.map(async (tab) => ({
            tabId: tab.id!,
            bootstrapped: await tryBootstrapFocusedTab(tab),
        })),
    );

    debugLog('ensureConfiguredTabsReady completed', {
        notifiedCount: notifiedTabIds.size,
        bootstrappedCount: fallbackResults.filter((result) => result.bootstrapped).length,
    });
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
