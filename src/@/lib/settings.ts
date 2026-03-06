import { getStorageItem, setStorageItem } from './utils';

export interface ShortcutConfig {
    code: string;
    key?: string; // The printable character (e.g. 'c', '=', 'ş') for layout-aware matching
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    isModifierOnly?: boolean; // true if shortcut is a single modifier key (hold)
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
        metaKey: false
    },
    defaultHighlightColor: 'yellow',
    savePageOnHighlight: true
};


const PREFERENCES_KEY = 'spark_preferences';
const SITE_OVERRIDES_KEY = 'spark_site_overrides';


export async function getPreferences(): Promise<ExtensionPreferences> {
    try {
        const stored = await getStorageItem(PREFERENCES_KEY);
        if (!stored) return DEFAULT_PREFERENCES;

        // Parse if it's a JSON string, otherwise assume object if storage API returns it as such (Chrome storage usually returns object if set as object, but our utils wrapper might handle JSON strings)
        // Our setStorageItem stringifies? No, setStorageItem in utils takes string: value. 
        // Wait, utils.ts setStorageItem:
        // export async function setStorageItem(key: string, value: string) { ... }
        // So we must stringify.

        const parsed = JSON.parse(stored) as ExtensionPreferences;
        return { ...DEFAULT_PREFERENCES, ...parsed };
    } catch (e) {

        return DEFAULT_PREFERENCES;
    }
}



export async function savePreferences(prefs: ExtensionPreferences): Promise<void> {
    try {
        await setStorageItem(PREFERENCES_KEY, JSON.stringify(prefs));
    } catch (e) {

    }
}

// ================ SITE-SPECIFIC OVERRIDES ================

export interface SiteOverride {
    enableSmartCapture?: boolean;
    enableSelectionMenu?: boolean;
}

export interface SiteOverrides {
    [hostname: string]: SiteOverride;
}

export async function getSiteOverrides(): Promise<SiteOverrides> {

    try {
        const stored = await getStorageItem(SITE_OVERRIDES_KEY);
        if (!stored) return {};
        return JSON.parse(stored) as SiteOverrides;
    } catch (e) {

        return {};
    }
}

export async function saveSiteOverride(
    hostname: string,
    key: keyof SiteOverride,
    value: boolean
): Promise<void> {
    try {
        const overrides = await getSiteOverrides();
        if (!overrides[hostname]) {
            overrides[hostname] = {};
        }
        overrides[hostname][key] = value;
        await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {

    }
}

export async function clearSiteOverride(
    hostname: string,
    key: keyof SiteOverride
): Promise<void> {
    try {
        const overrides = await getSiteOverrides();
        if (overrides[hostname]) {
            delete overrides[hostname][key];
            // Clean up empty entries
            if (Object.keys(overrides[hostname]).length === 0) {
                delete overrides[hostname];
            }
            await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify(overrides));
        }
    } catch (e) {

    }
}

/**
 * Clear ALL site overrides (used to clean up legacy data)
 */
export async function clearAllSiteOverrides(): Promise<void> {
    try {
        await setStorageItem(SITE_OVERRIDES_KEY, JSON.stringify({}));

    } catch (e) {

    }
}


export async function getEffectivePreferences(hostname?: string): Promise<ExtensionPreferences> {
    const globalPrefs = await getPreferences();

    if (!hostname) return globalPrefs;

    const overrides = await getSiteOverrides();
    const siteOverride = overrides[hostname];



    if (!siteOverride) return globalPrefs;

    const effectivePrefs = {
        ...globalPrefs,
        enableSmartCapture: siteOverride.enableSmartCapture ?? globalPrefs.enableSmartCapture,
        enableSelectionMenu: siteOverride.enableSelectionMenu ?? globalPrefs.enableSelectionMenu,
    };


    return effectivePrefs;
}


export function getHostname(url?: string): string {
    if (!url) return '';
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}
