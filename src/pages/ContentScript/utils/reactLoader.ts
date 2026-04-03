/**
 * Shared React Loader — lazily loads only the heavy UI component entrypoints.
 */

import {
    getRegisteredLazyComponent,
    type EmbeddedAppModule,
    type CaptureDockModule,
    type SaveNotificationToastModule,
    type LazyComponentName,
} from './lazyComponentRegistry';

export type EmbeddedAppReactModule = EmbeddedAppModule;
export type CaptureDockReactModule = CaptureDockModule;
export type SaveNotificationToastReactModule = SaveNotificationToastModule;

const moduleCache = new Map<string, unknown>();
const loadPromises = new Map<string, Promise<unknown>>();

function normalizeComponentModule<T extends Record<string, any>, K extends LazyComponentName>(
    module: any,
    exportName: K,
): T {
    const candidate = getRegisteredLazyComponent(exportName)
        ?? module?.[exportName]
        ?? module?.default?.[exportName]
        ?? module?.default;

    if (!candidate) {
        throw new Error(`[GrabSHARK] Missing export "${exportName}" in lazy entry module`);
    }

    return candidate as T;
}

async function loadExtensionModule<K extends LazyComponentName, T extends Record<string, any>>(
    entryFile: string,
    exportName: K,
): Promise<T> {
    const cacheKey = `${entryFile}:${exportName}`;
    const cached = moduleCache.get(cacheKey) as T | undefined;
    if (cached) {
        return cached;
    }

    const existingPromise = loadPromises.get(cacheKey) as Promise<T> | undefined;
    if (existingPromise) {
        return existingPromise;
    }

    const loadPromise = (async () => {
        try {
            const module = await import(/* @vite-ignore */ chrome.runtime.getURL(entryFile));
            const normalized = normalizeComponentModule<T, K>(module, exportName);
            moduleCache.set(cacheKey, normalized);
            return normalized;
        } catch (err) {
            loadPromises.delete(cacheKey);
            throw err instanceof Error ? err : new Error(`[GrabSHARK] Failed to load ${entryFile}`);
        }
    })();

    loadPromises.set(cacheKey, loadPromise);
    return loadPromise;
}

export function loadEmbeddedAppModule(): Promise<EmbeddedAppReactModule> {
    return loadExtensionModule<'EmbeddedApp', EmbeddedAppReactModule>('embeddedUI.js', 'EmbeddedApp');
}

export function loadCaptureDockModule(): Promise<CaptureDockReactModule> {
    return loadExtensionModule<'CaptureDock', CaptureDockReactModule>('captureDock.js', 'CaptureDock');
}

export function loadSaveNotificationToastModule(): Promise<SaveNotificationToastReactModule> {
    return loadExtensionModule<'SaveNotificationToast', SaveNotificationToastReactModule>('saveNotificationToast.js', 'SaveNotificationToast');
}
