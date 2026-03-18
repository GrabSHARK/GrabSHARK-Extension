/**
 * Shared React Loader — Central utility for lazy-loading the React ecosystem
 * 
 * All modules that need React (EmbeddedMenuManager, CaptureActionBar, ToastManager)
 * use this loader instead of statically importing React. The actual React code
 * is in embeddedUI.js which is loaded on-demand.
 * 
 * Pattern: First call loads the script, subsequent calls return cached reference.
 */

export interface SparkReactModule {
    createRoot: typeof import('react-dom/client').createRoot;
    React: typeof import('react');
    EmbeddedApp: any;
    CaptureDock: any;
    SaveNotificationToast: any;
}

let loaded = false;
let cachedModule: SparkReactModule | null = null;
let loadPromise: Promise<SparkReactModule> | null = null;

/**
 * Load the React UI module. First call dynamically imports the ES module,
 * subsequent calls return the cached module immediately.
 */
export function loadReactModule(): Promise<SparkReactModule> {
    // Already loaded — return immediately
    if (loaded && cachedModule) {
        return Promise.resolve(cachedModule);
    }

    // Loading in progress — return existing promise
    if (loadPromise) return loadPromise;

    // First load — dynamic import in the content script's isolated world.
    // Unlike <script> tags (main world) or eval (blocked by CSP), import()
    // runs in the isolated world with full chrome.* API access.
    loadPromise = (async () => {
        try {
            const url = chrome.runtime.getURL('embeddedUI.js');
            const module = await import(/* @vite-ignore */ url);
            loaded = true;
            cachedModule = module as SparkReactModule;
            return cachedModule;
        } catch (err) {
            loadPromise = null;
            throw err instanceof Error ? err : new Error('[GrabSHARK] Failed to load embeddedUI.js');
        }
    })();

    return loadPromise;
}
