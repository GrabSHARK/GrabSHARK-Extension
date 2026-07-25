import {
    clearSiteOverrideMessage,
    getEffectivePreferencesData,
    getExtensionPreferences,
    getSiteOverridesData,
    saveExtensionPreferences,
    saveSiteOverrideMessage,
} from './runtime/messages.ts';
import { getStorageItem, setStorageItem } from './utils';

export interface ShortcutConfig {
    code: string;
    key?: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    isModifierOnly?: boolean;
}

export interface ExtensionPreferences {
    enableSmartCapture: boolean;
    enableSelectionMenu: boolean;
    showSavedMark: boolean;
    showHighlights: boolean;
    smartCaptureShortcut: ShortcutConfig;
    defaultHighlightColor: 'yellow' | 'red' | 'blue' | 'green';
    savePageOnHighlight: boolean;
}

export const DEFAULT_PREFERENCES: ExtensionPreferences = {
    enableSmartCapture: true,
    enableSelectionMenu: true,
    showSavedMark: true,
    showHighlights: true,
    smartCaptureShortcut: {
        code: 'KeyC',
        key: 'c',
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
    },
    defaultHighlightColor: 'yellow',
    savePageOnHighlight: true,
};

const PREFERENCES_KEY = 'grabshark_preferences';
const SITE_OVERRIDES_KEY = 'grabshark_site_overrides';

export interface SiteOverride {
    enableSmartCapture?: boolean;
    enableSelectionMenu?: boolean;
}

export interface SiteOverrides {
    [hostname: string]: SiteOverride;
}

function canUseRuntime() {
    return typeof window !== 'undefined' && typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

export async function getPreferences(): Promise<ExtensionPreferences> {
    if (canUseRuntime()) {
        try {
            return await getExtensionPreferences();
        } catch {
            return DEFAULT_PREFERENCES;
        }
    }

    try {
        const stored = await getStorageItem(PREFERENCES_KEY);
        if (!stored) return DEFAULT_PREFERENCES;
        const parsed = JSON.parse(stored) as ExtensionPreferences;
        return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

export async function savePreferences(prefs: ExtensionPreferences): Promise<void> {
    if (canUseRuntime()) {
        await saveExtensionPreferences(prefs);
        return;
    }

    await setStorageItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

export async function getSiteOverrides(): Promise<SiteOverrides> {
    if (canUseRuntime()) {
        try {
            return await getSiteOverridesData();
        } catch {
            return {};
        }
    }

    try {
        const stored = await getStorageItem(SITE_OVERRIDES_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as SiteOverrides;
    } catch {
        return {};
    }
}

export async function saveSiteOverride(hostname: string, key: keyof SiteOverride, value: boolean): Promise<void> {
    if (canUseRuntime()) {
        await saveSiteOverrideMessage(hostname, key, value);
        return;
    }

    const overrides = await getSiteOverrides();
    if (!overrides[hostname]) {
        overrides[hostname] = {};
    }
    overrides[hostname][key] = value;
    await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify(overrides));
}

export async function clearSiteOverride(hostname: string, key: keyof SiteOverride): Promise<void> {
    if (canUseRuntime()) {
        await clearSiteOverrideMessage(hostname, key);
        return;
    }

    const overrides = await getSiteOverrides();
    if (overrides[hostname]) {
        delete overrides[hostname][key];
        if (Object.keys(overrides[hostname]).length === 0) {
            delete overrides[hostname];
        }
        await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify(overrides));
    }
}

export async function clearAllSiteOverrides(): Promise<void> {
    if (canUseRuntime()) {
        const overrides = await getSiteOverrides();
        await Promise.all(
            Object.entries(overrides).flatMap(([hostname, value]) =>
                Object.keys(value).map((key) => clearSiteOverrideMessage(hostname, key as keyof SiteOverride)),
            ),
        );
        return;
    }

    await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify({}));
}

export async function getEffectivePreferences(hostname?: string): Promise<ExtensionPreferences> {
    if (canUseRuntime()) {
        try {
            return await getEffectivePreferencesData(hostname);
        } catch {
            return DEFAULT_PREFERENCES;
        }
    }

    const globalPrefs = await getPreferences();
    if (!hostname) return globalPrefs;

    const overrides = await getSiteOverrides();
    const siteOverride = overrides[hostname];
    if (!siteOverride) return globalPrefs;

    return {
        ...globalPrefs,
        enableSmartCapture: siteOverride.enableSmartCapture ?? globalPrefs.enableSmartCapture,
        enableSelectionMenu: siteOverride.enableSelectionMenu ?? globalPrefs.enableSelectionMenu,
    };
}

export function getHostname(url?: string): string {
    if (!url) return '';
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}
