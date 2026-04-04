/// <reference types="chrome" />
// GrabSHARK Content Script - Main entry point
import { HighlightToolbox, showToast } from './HighlightToolbox';
import { SmartCaptureMode } from './SmartCapture';
import { NotePanel } from './NotePanel';
import { ThemeManager } from './shared/ThemeManager';

// Managers
import { toggleEmbeddedMenu } from './managers/EmbeddedMenuManager';
import { HighlightManager } from './managers/HighlightManager';
import { InteractionManager } from './managers/InteractionManager';
import { SmartCaptureHandlers } from './managers/SmartCaptureHandlers';

import { DEFAULT_PREFERENCES, getEffectivePreferences, getHostname, getPreferences } from '../../@/lib/settings';
import { sendMessage } from './utils/messaging';
import { writeLinkSessionCache } from '../../@/lib/runtime/sessionCache';
import { HighlightColor } from '../../@/lib/types/highlight';
import { captureAnchor } from './anchorUtils';

// Global instances
let toolbox: HighlightToolbox | null = null;
let notePanel: NotePanel | null = null;
let smartCaptureMode: SmartCaptureMode | null = null;
let interactionManager: InteractionManager | null = null;

let enableSelectionMenu = DEFAULT_PREFERENCES.enableSelectionMenu;
let defaultHighlightColor: HighlightColor = DEFAULT_PREFERENCES.defaultHighlightColor;

const cleanupRegistry: (() => void)[] = [];
const EXTENSION_MARKER_ID = 'grabshark-extension-installed';
const CONTENT_MAIN_READY_EVENT = 'grabshark-content-main-ready';
const DEBUG_PREFIX = '[GrabSHARK EXT][contentMain]';

type LifecycleDebugCounterKey =
    | 'cleanupCount'
    | 'windowListenerCount'
    | 'runtimeListenerCount'
    | 'storageListenerCount'
    | 'observerCount'
    | 'timeoutCount';

const lifecycleDebugCounters: Record<LifecycleDebugCounterKey, number> = {
    cleanupCount: 0,
    windowListenerCount: 0,
    runtimeListenerCount: 0,
    storageListenerCount: 0,
    observerCount: 0,
    timeoutCount: 0,
};

declare global {
    interface Window {
        __grabsharkContentMainInitPromise?: Promise<void>;
        __grabsharkContentMainInitialized?: boolean;
    }
}

function setDebugState(state: Record<string, string | number | boolean | null | undefined>): void {
    const marker = document.getElementById(EXTENSION_MARKER_ID);
    if (!marker) return;
    Object.entries(state).forEach(([key, value]) => {
        const attr = `data-${key}`;
        if (value === null || typeof value === 'undefined') marker.removeAttribute(attr);
        else marker.setAttribute(attr, String(value));
    });
}

function debugLog(message: string, meta?: unknown): void {
    if (typeof meta === 'undefined') console.info(DEBUG_PREFIX, message);
    else console.info(DEBUG_PREFIX, message, meta);
}

function syncLifecycleDebugState(): void {
    setDebugState({
        cleanupCount: lifecycleDebugCounters.cleanupCount,
        windowListenerCount: lifecycleDebugCounters.windowListenerCount,
        runtimeListenerCount: lifecycleDebugCounters.runtimeListenerCount,
        storageListenerCount: lifecycleDebugCounters.storageListenerCount,
        observerCount: lifecycleDebugCounters.observerCount,
        timeoutCount: lifecycleDebugCounters.timeoutCount,
    });
}

function updateLifecycleCounter(key: LifecycleDebugCounterKey, delta: number): void {
    lifecycleDebugCounters[key] = Math.max(0, lifecycleDebugCounters[key] + delta);
    syncLifecycleDebugState();
}

function registerCleanup(cleanupFn: () => void): void {
    let settled = false;
    updateLifecycleCounter('cleanupCount', 1);
    cleanupRegistry.push(() => {
        if (settled) return;
        settled = true;
        try {
            cleanupFn();
        } finally {
            updateLifecycleCounter('cleanupCount', -1);
        }
    });
}

function addManagedWindowListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
): void {
    window.addEventListener(type, listener, options);
    updateLifecycleCounter('windowListenerCount', 1);
    registerCleanup(() => {
        window.removeEventListener(type, listener, options);
        updateLifecycleCounter('windowListenerCount', -1);
    });
}

function addManagedRuntimeListener(
    listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0],
): void {
    chrome.runtime.onMessage.addListener(listener);
    updateLifecycleCounter('runtimeListenerCount', 1);
    registerCleanup(() => {
        chrome.runtime.onMessage.removeListener(listener);
        updateLifecycleCounter('runtimeListenerCount', -1);
    });
}

function addManagedStorageListener(
    listener: Parameters<typeof chrome.storage.onChanged.addListener>[0],
): void {
    chrome.storage.onChanged.addListener(listener);
    updateLifecycleCounter('storageListenerCount', 1);
    registerCleanup(() => {
        chrome.storage.onChanged.removeListener(listener);
        updateLifecycleCounter('storageListenerCount', -1);
    });
}

function createManagedObserver(observer: MutationObserver): () => void {
    let active = true;
    updateLifecycleCounter('observerCount', 1);
    return () => {
        if (!active) return;
        active = false;
        observer.disconnect();
        updateLifecycleCounter('observerCount', -1);
    };
}

function createManagedTimeout(callback: () => void, delayMs: number): () => void {
    let active = true;
    updateLifecycleCounter('timeoutCount', 1);

    const timeoutId = window.setTimeout(() => {
        if (!active) return;
        active = false;
        updateLifecycleCounter('timeoutCount', -1);
        callback();
    }, delayMs);

    return () => {
        if (!active) return;
        active = false;
        window.clearTimeout(timeoutId);
        updateLifecycleCounter('timeoutCount', -1);
    };
}

function getRuntimeConfigState(): Promise<{ configured: boolean; baseUrl?: string }> {
    return sendMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG').then((response) => ({
        configured: !!(response.success && response.data?.configured),
        baseUrl: response.success ? response.data?.baseUrl : undefined,
    }));
}

function applyPreferenceState(preferences: Partial<{
    defaultHighlightColor: HighlightColor;
    enableSelectionMenu: boolean;
    enableSmartCapture: boolean;
    showHighlights: boolean;
}>): void {
    debugLog('applyPreferenceState', preferences);
    if (typeof preferences.defaultHighlightColor !== 'undefined') {
        defaultHighlightColor = preferences.defaultHighlightColor;
        interactionManager?.updateDefaultColor(defaultHighlightColor);
    }

    if (typeof preferences.enableSelectionMenu !== 'undefined') {
        enableSelectionMenu = preferences.enableSelectionMenu;
    }

    if (typeof preferences.enableSmartCapture !== 'undefined') {
        smartCaptureMode?.setEnabled(preferences.enableSmartCapture);
    }

    if (typeof preferences.showHighlights !== 'undefined') {
        document.body.classList.toggle('ext-grabshark-highlights-hidden', !preferences.showHighlights);
    }
}

function cleanup(): void {
    debugLog('cleanup start', { ...lifecycleDebugCounters, cleanupRegistrySize: cleanupRegistry.length });
    cleanupRegistry.forEach((fn) => { try { fn(); } catch { } });
    cleanupRegistry.length = 0;
    if (toolbox) { toolbox.destroy(); toolbox = null; }
    if (notePanel) { notePanel.destroy(); notePanel = null; }
    if (smartCaptureMode) { smartCaptureMode.destroy(); smartCaptureMode = null; }
    if (interactionManager) { interactionManager.destroy(); interactionManager = null; }
    setDebugState({ mainStage: 'cleanup-complete' });
    debugLog('cleanup complete', { ...lifecycleDebugCounters });
}

function markContentMainReady(): void {
    window.__grabsharkContentMainInitialized = true;
    setDebugState({ contentmaininitialized: true });
    document.dispatchEvent(new CustomEvent(CONTENT_MAIN_READY_EVENT, { detail: { ready: true } }));
}

addManagedWindowListener('beforeunload', cleanup);

// --- Init Helpers (previously in contentScriptInit.ts) ---

function isOnGrabSHARKInstance(baseUrl: string): boolean {
    try { return new URL(window.location.href).origin === new URL(baseUrl).origin; } catch { return false; }
}

function setupReadableViewObserver(): void {
    let observerInitialized = false;

    const loadHighlightsOnly = async (linkId: string | null, fileId: string | null) => {
        if (observerInitialized) return;
        observerInitialized = true;
        if (linkId) await HighlightManager.loadHighlightsForLinkId(Number(linkId));
        if (fileId) await HighlightManager.loadHighlightsForFileId(Number(fileId));
    };

    const linkIdElement = document.querySelector('[data-lw-link-id]');
    const linkId = linkIdElement?.getAttribute('data-lw-link-id') || null;
    const fileIdElement = document.querySelector('[data-ext-lw-file-id]');
    const fileId = fileIdElement?.getAttribute('data-ext-lw-file-id') || null;

    if (linkId || fileId) {
        void loadHighlightsOnly(linkId, fileId);
        return;
    }

    const observer = new MutationObserver(async () => {
        const el = document.querySelector('[data-lw-link-id]');
        const lId = el?.getAttribute('data-lw-link-id') || null;
        const fEl = document.querySelector('[data-ext-lw-file-id]');
        const fId = fEl?.getAttribute('data-ext-lw-file-id') || null;
        if (lId || fId) {
            disconnectObserver();
            clearObserverTimeout();
            await loadHighlightsOnly(lId, fId);
        }
    });
    const disconnectObserver = createManagedObserver(observer);
    observer.observe(document.body, { childList: true, subtree: true });

    const clearObserverTimeout = createManagedTimeout(() => {
        disconnectObserver();
    }, 10000);

    registerCleanup(() => {
        clearObserverTimeout();
        disconnectObserver();
    });
}

function setupWebViewMessageListener(): void {
    const handler = (event: MessageEvent) => {
        if (event.data?.type === 'GrabSHARK_WEB_VIEW_CONTEXT') {
            const { linkId } = event.data;
            if (linkId && typeof linkId === 'number') HighlightManager.loadHighlightsForLinkId(linkId);
        }
    };
    addManagedWindowListener('message', handler as EventListener);
}

function createBatchHandler() {
    return async (urls: string[], type: string) => {
        for (const url of urls) {
            if (type === 'LINK') await SmartCaptureHandlers.handleSaveLink({ url, type: 'LINK', rect: new DOMRect(), extracted: {} } as any);
            else if (type === 'IMAGE') await SmartCaptureHandlers.handleSaveImage({ url, type: 'IMAGE', rect: new DOMRect(), extracted: { image: { src: url } } } as any);
            else if (type === 'VIDEO') await SmartCaptureHandlers.handleSaveImage({ url, type: 'VIDEO', rect: new DOMRect(), extracted: { video: { src: url } } } as any);
            else if (type === 'FILE') await SmartCaptureHandlers.handleSaveFile({ url, type: 'FILE', rect: new DOMRect(), extracted: {} } as any);
        }
    };
}

interface SmartCaptureInitContext {
    defaultHighlightColor: HighlightColor;
    notePanel: NotePanel | null;
    toolbox: HighlightToolbox | null;
    smartCaptureModeRef: { current: SmartCaptureMode | null };
}

function createGrabSHARKSmartCaptureCallbacks(ctx: SmartCaptureInitContext) {
    return {
        onHighlight: async (target: any) => {
            if (target.extracted?.text && target.elementRef) {
                const range = document.createRange();
                range.selectNodeContents(target.elementRef);
                const anchor = captureAnchor(range);
                await HighlightManager.createHighlight({
                    text: target.extracted.text, startOffset: 0, endOffset: target.extracted.text.length,
                    rect: target.rect, anchor,
                }, ctx.defaultHighlightColor);
            }
        },
        onClip: SmartCaptureHandlers.handleClip,
        onSaveLink: SmartCaptureHandlers.handleSaveLink,
        onSaveBatch: createBatchHandler(),
        onSaveImage: SmartCaptureHandlers.handleSaveImage,
        onSaveFile: SmartCaptureHandlers.handleSaveFile,
        onAddNote: async () => { },
        onClose: () => { },
        canSelectionChange: () => true,
        onSelectionChange: () => { },
    };
}

function createExternalSmartCaptureCallbacks(ctx: SmartCaptureInitContext) {
    return {
        onHighlight: async (target: any) => {
            if (target.extracted?.text && target.elementRef) {
                const range = document.createRange();
                range.selectNodeContents(target.elementRef);
                const anchor = captureAnchor(range);
                await HighlightManager.createHighlight({
                    text: target.extracted.text, startOffset: 0, endOffset: target.extracted.text.length,
                    rect: target.rect, anchor,
                }, ctx.defaultHighlightColor);
            } else if (target.extracted?.text && target.rect) {
                await HighlightManager.createHighlight({
                    text: target.extracted.text, startOffset: 0, endOffset: target.extracted.text.length,
                    rect: target.rect, anchor: undefined,
                }, ctx.defaultHighlightColor);
            }
        },
        onClip: SmartCaptureHandlers.handleClip,
        onSaveLink: SmartCaptureHandlers.handleSaveLink,
        onSaveBatch: createBatchHandler(),
        onSaveImage: SmartCaptureHandlers.handleSaveImage,
        onSaveFile: SmartCaptureHandlers.handleSaveFile,
        onAddNote: async (target: any) => {
            if (ctx.smartCaptureModeRef.current) ctx.smartCaptureModeRef.current.pauseSelection();
            if (ctx.notePanel) {
                ctx.notePanel.show(
                    { x: (target.rect?.left || 0) + (target.rect?.width || 0) / 2 + window.scrollX, y: (target.rect?.bottom || 0) + window.scrollY + 10 },
                    {
                        onSave: async (comment: string, color: HighlightColor) => {
                            await SmartCaptureHandlers.handleNoteSave(target, comment, color);
                            if (ctx.smartCaptureModeRef.current) ctx.smartCaptureModeRef.current.resumeSelection();
                        },
                        onCancel: () => { if (ctx.smartCaptureModeRef.current) { ctx.smartCaptureModeRef.current.resumeSelection(); ctx.smartCaptureModeRef.current.reshowActionBar(); } },
                        onClose: () => { if (ctx.smartCaptureModeRef.current) ctx.smartCaptureModeRef.current.resumeSelection(); },
                    },
                    '', ctx.defaultHighlightColor, target.rect,
                );
            }
        },
        onClose: () => { },
        canSelectionChange: () => {
            if (ctx.toolbox?.isOpen() && ctx.toolbox.isCommentDirty()) { showToast('Please save or cancel your note changes first', 'error'); return false; }
            return true;
        },
        onSelectionChange: () => { if (ctx.toolbox?.isOpen()) ctx.toolbox.close(); },
    };
}

// --- Message Handlers ---

function postMessageToManagedFrames(message: Record<string, unknown>): void {
    document.querySelectorAll('iframe').forEach((iframe) => {
        try {
            const frameUrl = iframe.getAttribute('src');
            if (frameUrl) {
                const origin = new URL(frameUrl, window.location.href).origin;
                if (origin !== window.location.origin) return;
            }
            iframe.contentWindow?.postMessage(message, window.location.origin);
        } catch { }
    });
}

function processExtensionMessage(event: MessageEvent): void {
    if (event.data?.type === 'LW_PING') {
        void getRuntimeConfigState().then(({ configured }) => {
            window.postMessage({ type: 'LW_PONG', version: '1.3.3', configured }, window.location.origin);
        }).catch(() => { });
        return;
    }

    if (event.data?.type === 'GrabSHARK_SMART_CAPTURE') {
        if (smartCaptureMode) {
            const lwEl = document.querySelector('[data-lw-link-id]');
            if (lwEl) smartCaptureMode.setContainer('[data-lw-link-id]');
            smartCaptureMode.toggle();
        } else {
            postMessageToManagedFrames({ type: 'GrabSHARK_SMART_CAPTURE' });
        }
    }

    if (event.data?.type === 'GrabSHARK_CLIP') {
        const { SmartCaptureHandlers } = require('./managers/SmartCaptureHandlers');
        if (smartCaptureMode) {
            const sel = event.data.selection;
            if (sel?.text && sel?.rect) {
                SmartCaptureHandlers.handleClip({
                    type: 'TEXT_BLOCK', rect: new DOMRect(sel.rect.x, sel.rect.y, sel.rect.width, sel.rect.height),
                    title: sel.text, extracted: { text: sel.text },
                    pageContext: { pageUrl: window.location.href, pageTitle: document.title, capturedAt: Date.now() }
                });
            }
        } else {
            postMessageToManagedFrames({ type: 'GrabSHARK_CLIP', selection: event.data.selection });
        }
    }

    if (event.data?.type === 'GrabSHARK_DEACTIVATE_SMART_CAPTURE') {
        smartCaptureMode?.deactivate();
        postMessageToManagedFrames({ type: 'GrabSHARK_DEACTIVATE_SMART_CAPTURE' });
    }
}

function signalExtensionPresence(): void {
    if (!document.getElementById('grabshark-extension-installed')) {
        const marker = document.createElement('div');
        marker.id = 'grabshark-extension-installed';
        marker.setAttribute('data-version', '1.3.3');
        marker.style.display = 'none';
        document.documentElement.appendChild(marker);
    }
    syncLifecycleDebugState();
    document.dispatchEvent(new CustomEvent('grabshark-extension-ready', { detail: { version: '1.3.3' } }));

    const extensionMessageHandler = (event: MessageEvent) => {
        const isFromSelf = event.source === window;
        const isFromParent = event.source === window.parent;
        if (!isFromSelf && !isFromParent) return;
        if (isFromSelf && event.origin !== window.location.origin) return;
        if (isFromParent && event.origin !== window.location.origin) {
            void getRuntimeConfigState().then(({ baseUrl }) => {
                if (!baseUrl) return;
                try {
                    if (event.origin !== new URL(baseUrl).origin) return;
                    processExtensionMessage(event);
                } catch { }
            }).catch(() => { });
            return;
        }
        processExtensionMessage(event);
    };
    addManagedWindowListener('message', extensionMessageHandler as EventListener);
}

function setupGlobalListeners(): void {
    try {
        const applySavedLinkState = (savedLink: any): void => {
            if (!savedLink?.id) return;
            HighlightManager.setLinkId(savedLink.id);
            writeLinkSessionCache(window.location.href, savedLink);
        };

        const runtimeMessageHandler = (message: any, _sender: any, sendResponse: any) => {
            if (message.type === 'TOGGLE_EMBEDDED_MENU') {
                toggleEmbeddedMenu();
                sendResponse({ success: true });
            }
            else if (message.type === 'TOGGLE_SMART_CAPTURE') {
                smartCaptureMode?.toggle();
                sendResponse({ success: true });
            }
            else if (message.type === 'LINK_SAVE_SUCCESS') {
                applySavedLinkState(message.data?.response || message.data);
                sendResponse({ success: true });
            }
            else if (message.type === 'PREFERENCES_UPDATED') {
                applyPreferenceState(message.data ?? {});
                sendResponse({ success: true });
            }
            else if (message.type === 'SHOW_HIGHLIGHT_TOOLBOX') {
                interactionManager?.handleContextMenuHighlight();
                sendResponse({ success: true });
            }
            return true;
        };

        const localLinkSavedHandler = (event: Event) => {
            const customEvent = event as CustomEvent<{ link?: any; url?: string }>;
            if (customEvent.detail?.url === window.location.href) {
                applySavedLinkState(customEvent.detail.link);
            }
        };

        addManagedRuntimeListener(runtimeMessageHandler);
        addManagedWindowListener('grabshark-link-saved', localLinkSavedHandler as EventListener);
    } catch { }
}
// --- Main Init ---

async function init(): Promise<boolean> {
    signalExtensionPresence();
    setDebugState({ mainStage: 'init-started', href: window.location.href.slice(0, 200), contentmaininitialized: false });
    debugLog('init started', { href: window.location.href });
    await ThemeManager.initExtensionTheme();
    registerCleanup(() => ThemeManager.cleanup());

    const storageChangeHandler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        debugLog('storage change', { area, keys: Object.keys(changes) });
        if (area === 'local' && (changes.grabshark_preferences || changes.grabshark_site_overrides)) {
            getEffectivePreferences(getHostname(window.location.href)).then((p) => {
                applyPreferenceState({
                    enableSelectionMenu: p.enableSelectionMenu,
                    enableSmartCapture: p.enableSmartCapture,
                    showHighlights: p.showHighlights,
                });
            }).catch(() => { });
        }
    };
    addManagedStorageListener(storageChangeHandler);

    const isInIframe = window.self !== window.top;
    const hostname = getHostname(window.location.href);

    try {
        debugLog('loading initial preferences', { hostname });
        const resp = await sendMessage<{ configured: boolean; baseUrl?: string; enableSelectionMenu?: boolean }>('GET_DOMAIN_PREFERENCE', { domain: hostname });
        if (resp.success && resp.data) enableSelectionMenu = resp.data.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu;
        else { const p = await getEffectivePreferences(hostname); enableSelectionMenu = p?.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu; }
        const p = await getEffectivePreferences(hostname);
        debugLog('effective preferences resolved', p);
        if (!(p?.showHighlights ?? true)) document.body.classList.add('ext-grabshark-highlights-hidden');
        defaultHighlightColor = (await getPreferences()).defaultHighlightColor || 'yellow';
    } catch { }

    if (isInIframe) setupWebViewMessageListener();
    setupGlobalListeners();
    setDebugState({ mainStage: 'global-listeners-attached' });

    const configCheck = await sendMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG');
    debugLog('config check during init', configCheck);
    if (!configCheck.success || !configCheck.data?.configured) {
        setDebugState({ mainStage: 'config-check-failed', contentmaininitialized: false });
        debugLog('aborting init because extension is not configured');
        return false;
    }

    const grabsharkBaseUrl = configCheck.data.baseUrl;
    setDebugState({ mainStage: 'config-check-passed', baseUrl: grabsharkBaseUrl ?? '' });
    const lwLinkIdElement = document.querySelector('[data-lw-link-id]');
    const dataLwLinkId = lwLinkIdElement?.getAttribute('data-lw-link-id');
    const lwFileIdElement = document.querySelector('[data-ext-lw-file-id]');
    let dataLwFileId = lwFileIdElement?.getAttribute('data-ext-lw-file-id') || null;
    if (!dataLwFileId) { const match = window.location.pathname.match(/\/api\/v1\/files\/(\d+)\/(file|content)/); if (match) dataLwFileId = match[1]; }

    const containerSelector = dataLwLinkId ? '[data-lw-link-id]' : undefined;
    const smartCaptureModeRef = { current: smartCaptureMode };

    if (grabsharkBaseUrl && isOnGrabSHARKInstance(grabsharkBaseUrl as string)) {
        if (!isInIframe) {
            if (dataLwLinkId) await HighlightManager.loadHighlightsForLinkId(Number(dataLwLinkId));
            if (dataLwFileId) await HighlightManager.loadHighlightsForFileId(Number(dataLwFileId));
            setupReadableViewObserver();
        }
        smartCaptureMode = new SmartCaptureMode(createGrabSHARKSmartCaptureCallbacks({ defaultHighlightColor, notePanel, toolbox, smartCaptureModeRef }), containerSelector);
        smartCaptureModeRef.current = smartCaptureMode;
        return true;
    }

    toolbox = new HighlightToolbox();
    notePanel = new NotePanel();
    smartCaptureMode = new SmartCaptureMode(createExternalSmartCaptureCallbacks({ defaultHighlightColor, notePanel, toolbox, smartCaptureModeRef }), containerSelector);
    smartCaptureModeRef.current = smartCaptureMode;

    interactionManager = new InteractionManager(toolbox, notePanel, () => smartCaptureMode, () => true, () => enableSelectionMenu);
    setDebugState({ mainStage: 'interaction-manager-created', enableSelectionMenu, defaultHighlightColor });
    debugLog('interaction manager created', { enableSelectionMenu, defaultHighlightColor });
    interactionManager.updateDefaultColor(defaultHighlightColor);
    interactionManager.setupGlobalListeners();
    setDebugState({ mainStage: 'interaction-listeners-attached' });
    debugLog('interaction listeners attached');

    if (dataLwFileId && !isNaN(Number(dataLwFileId))) await HighlightManager.loadHighlightsForFileId(Number(dataLwFileId));
    else if (lwLinkIdElement && dataLwLinkId && !isNaN(Number(dataLwLinkId))) await HighlightManager.loadHighlightsForLinkId(Number(dataLwLinkId));
    else {
        const lwId = new URLSearchParams(window.location.search).get('lwLinkId');
        if (lwId && !isNaN(Number(lwId))) await HighlightManager.loadHighlightsForLinkId(Number(lwId));
        else await HighlightManager.loadHighlightsForPage();
    }

    return true;
}

async function runContentMainInit(): Promise<void> {
    try {
        if (window.__grabsharkContentMainInitialized) {
            setDebugState({ mainStage: 'already-initialized', contentmaininitialized: true });
            return;
        }

        const initialized = await init();
        if (!initialized) {
            return;
        }

        markContentMainReady();
    } catch (error) {
        setDebugState({
            mainStage: 'init-error',
            contentmaininitialized: false,
            lastError: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}

export async function initContentMain(): Promise<void> {
    if (window.__grabsharkContentMainInitialized) {
        return;
    }

    if (!window.__grabsharkContentMainInitPromise) {
        window.__grabsharkContentMainInitPromise = runContentMainInit().catch((error) => {
            window.__grabsharkContentMainInitPromise = undefined;
            throw error;
        });
    }

    await window.__grabsharkContentMainInitPromise;
}

void initContentMain();


