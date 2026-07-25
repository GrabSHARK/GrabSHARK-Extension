/// <reference types="chrome" />
import './content-armor.css';
import './components.css';

import { sendMessage } from './utils/messaging';

const EXTENSION_MARKER_ID = 'grabshark-extension-installed';
const EXTENSION_VERSION = '1.3.3';
const CONTENT_MAIN_READY_EVENT = 'grabshark-content-main-ready';
const IS_TOP_FRAME = window.self === window.top;

let bootstrapInFlight: Promise<void> | null = null;
let contentMainInitialized = false;

function ensureExtensionMarker(): HTMLElement {
    let marker = document.getElementById(EXTENSION_MARKER_ID);
    if (!marker) {
        marker = document.createElement('div');
        marker.id = EXTENSION_MARKER_ID;
        marker.style.display = 'none';
        document.documentElement.appendChild(marker);
    }

    marker.setAttribute('data-version', EXTENSION_VERSION);
    return marker;
}

function setDebugState(state: Record<string, string | number | boolean | null | undefined>): void {
    const marker = ensureExtensionMarker();
    Object.entries(state).forEach(([key, value]) => {
        const attr = `data-${key}`;
        if (value === null || typeof value === 'undefined') marker.removeAttribute(attr);
        else marker.setAttribute(attr, String(value));
    });
}

function signalExtensionPresence(configured: boolean): void {
    setDebugState({ configured });

    document.dispatchEvent(new CustomEvent('grabshark-extension-ready', {
        detail: {
            version: EXTENSION_VERSION,
            configured,
        },
    }));
}

function isContentMainReady(): boolean {
    return ensureExtensionMarker().getAttribute('data-contentmaininitialized') === 'true';
}

function waitForContentMainReady(timeoutMs = 4000): Promise<boolean> {
    if (isContentMainReady()) {
        return Promise.resolve(true);
    }

    return new Promise((resolve) => {
        let settled = false;

        const finish = (ready: boolean) => {
            if (settled) return;
            settled = true;
            document.removeEventListener(CONTENT_MAIN_READY_EVENT, onReady);
            clearTimeout(timeoutId);
            resolve(ready);
        };

        const onReady = () => finish(true);
        const timeoutId = window.setTimeout(() => finish(isContentMainReady()), timeoutMs);

        document.addEventListener(CONTENT_MAIN_READY_EVENT, onReady, { once: true });
    });
}

function shouldBootstrapContentMain(configured: boolean, baseUrl?: string): boolean {
    if (IS_TOP_FRAME) {
        return true;
    }

    const hasManagedFrameMarkers = Boolean(
        document.querySelector('[data-lw-link-id], [data-ext-lw-file-id]'),
    );

    if (hasManagedFrameMarkers) {
        return true;
    }

    if (!configured || !baseUrl) {
        return false;
    }

    try {
        return new URL(window.location.href).origin === new URL(baseUrl).origin;
    } catch {
        return false;
    }
}

async function runBootstrap(): Promise<void> {
    setDebugState({ stage: 'bootstrap-started', frameScope: IS_TOP_FRAME ? 'top' : 'subframe' });
    const configCheck = await sendMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG');
    const configured = !!(configCheck.success && configCheck.data?.configured);
    const baseUrl = configCheck.success ? configCheck.data?.baseUrl : undefined;
    const shouldLoadContentMain = shouldBootstrapContentMain(configured, baseUrl);

    setDebugState({
        checkConfigSuccess: configCheck.success,
        configured,
        stage: configured ? 'config-ok' : 'config-missing',
        contentMainInitialized,
        frameBootstrap: shouldLoadContentMain,
        baseUrl: baseUrl ?? null,
    });

    signalExtensionPresence(configured);

    if (!shouldLoadContentMain) {
        setDebugState({
            stage: configured ? 'iframe-bootstrap-skipped' : 'config-missing-subframe',
            contentMainInitialized: false,
            lastError: null,
        });
        return;
    }

    if (contentMainInitialized || isContentMainReady()) {
        contentMainInitialized = true;
        setDebugState({ stage: 'content-main-already-initialized', contentMainInitialized: true });
        return;
    }

    setDebugState({
        stage: configured ? 'loading-content-main' : 'loading-content-main-unconfigured',
        contentMainModuleLoaded: false,
    });
    await import(/* @vite-ignore */ chrome.runtime.getURL('contentMain.js'));
    setDebugState({
        stage: configured ? 'content-main-loaded' : 'content-main-loaded-unconfigured',
        contentMainModuleLoaded: true,
    });

    const ready = await waitForContentMainReady();
    contentMainInitialized = ready || isContentMainReady();

    setDebugState({
        stage: contentMainInitialized
            ? 'content-main-initialized'
            : configured
                ? 'content-main-init-timeout'
                : 'content-main-standby-unconfigured',
        contentMainInitialized,
        lastError: contentMainInitialized || !configured ? null : 'Content main initialization timed out',
    });
}

function bootstrapContentScript(): Promise<void> {
    if (bootstrapInFlight) {
        return bootstrapInFlight;
    }

    bootstrapInFlight = runBootstrap().finally(() => {
        bootstrapInFlight = null;
    });

    return bootstrapInFlight;
}

function startBootstrap(): void {
    void bootstrapContentScript().catch((error) => {
        setDebugState({
            stage: 'bootstrap-error',
            lastError: error instanceof Error ? error.message : String(error),
        });
    });
}

function setupConfigRefreshListeners(): void {
    if (!IS_TOP_FRAME) {
        setDebugState({ listenerScope: 'top-frame-only' });
        return;
    }

    try {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            setDebugState({ lastRuntimeMessage: message?.type ?? 'unknown' });
            if (message?.type !== 'EXTENSION_CONFIG_UPDATED') {
                return false;
            }

            void bootstrapContentScript().then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                setDebugState({ stage: 'runtime-bootstrap-error', lastError: error instanceof Error ? error.message : String(error) });
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                });
            });

            return true;
        });
    } catch {
    }

    try {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.grabshark_config) {
                setDebugState({ stage: 'storage-config-changed' });
                startBootstrap();
            }
        });
    } catch {
    }
}

setupConfigRefreshListeners();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        startBootstrap();
    }, { once: true });
} else {
    startBootstrap();
}
