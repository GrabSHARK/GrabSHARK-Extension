/// <reference types="chrome" />
// GrabSHARK Content Script - Main entry point
import './content-armor.css';
import './components.css';

import { HighlightToolbox, showToast } from './HighlightToolbox';
import { SmartCaptureMode } from './SmartCapture';
import { NotePanel } from './NotePanel';

// Managers
import { toggleEmbeddedMenu } from './managers/EmbeddedMenuManager';
import { HighlightManager } from './managers/HighlightManager';
import { InteractionManager } from './managers/InteractionManager';
import { SmartCaptureHandlers } from './managers/SmartCaptureHandlers';

import { DEFAULT_PREFERENCES, getEffectivePreferences, getHostname, getPreferences } from '../../@/lib/settings';
import { sendMessage } from './utils/messaging';
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

function cleanup(): void {
    cleanupRegistry.forEach(fn => { try { fn(); } catch { } });
    cleanupRegistry.length = 0;
    if (toolbox) { toolbox.destroy(); toolbox = null; }
    if (notePanel) { notePanel.destroy(); notePanel = null; }
    if (smartCaptureMode) { smartCaptureMode.destroy(); smartCaptureMode = null; }
    if (interactionManager) { interactionManager.destroy(); interactionManager = null; }
}

window.addEventListener('beforeunload', cleanup);

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

    if (linkId || fileId) { loadHighlightsOnly(linkId, fileId); return; }

    const observer = new MutationObserver(async () => {
        const el = document.querySelector('[data-lw-link-id]');
        const lId = el?.getAttribute('data-lw-link-id') || null;
        const fEl = document.querySelector('[data-ext-lw-file-id]');
        const fId = fEl?.getAttribute('data-ext-lw-file-id') || null;
        if (lId || fId) { observer.disconnect(); await loadHighlightsOnly(lId, fId); }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const observerTimeout = setTimeout(() => observer.disconnect(), 10000);
    cleanupRegistry.push(() => { observer.disconnect(); clearTimeout(observerTimeout); });
}

function setupWebViewMessageListener(): void {
    const handler = (event: MessageEvent) => {
        if (event.data?.type === 'GrabSHARK_WEB_VIEW_CONTEXT') {
            const { linkId } = event.data;
            if (linkId && typeof linkId === 'number') HighlightManager.loadHighlightsForLinkId(linkId);
        }
    };
    window.addEventListener('message', handler);
    cleanupRegistry.push(() => window.removeEventListener('message', handler));
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

function processExtensionMessage(event: MessageEvent): void {
    if (event.data?.type === 'LW_PING') {
        try {
            chrome.runtime.sendMessage({ type: 'CHECK_CONFIG' }, (response) => {
                const configured = response?.success && response?.data?.configured;
                window.postMessage({ type: 'LW_PONG', version: '1.3.3', configured }, '*');
            });
        } catch { }
        return;
    }

    if (event.data?.type === 'GrabSHARK_SMART_CAPTURE') {
        if (smartCaptureMode) {
            const lwEl = document.querySelector('[data-lw-link-id]');
            if (lwEl) smartCaptureMode.setContainer('[data-lw-link-id]');
            smartCaptureMode.toggle();
        } else {
            document.querySelectorAll('iframe').forEach(iframe => { try { iframe.contentWindow?.postMessage({ type: 'GrabSHARK_SMART_CAPTURE' }, '*'); } catch { } });
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
            document.querySelectorAll('iframe').forEach(iframe => { try { iframe.contentWindow?.postMessage({ type: 'GrabSHARK_CLIP', selection: event.data.selection }, '*'); } catch { } });
        }
    }

    if (event.data?.type === 'GrabSHARK_DEACTIVATE_SMART_CAPTURE') {
        smartCaptureMode?.deactivate();
        document.querySelectorAll('iframe').forEach(iframe => { try { iframe.contentWindow?.postMessage({ type: 'GrabSHARK_DEACTIVATE_SMART_CAPTURE' }, '*'); } catch { } });
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
    document.dispatchEvent(new CustomEvent('grabshark-extension-ready', { detail: { version: '1.3.3' } }));

    const extensionMessageHandler = (event: MessageEvent) => {
        const isFromSelf = event.source === window;
        const isFromParent = event.source === window.parent;
        if (!isFromSelf && !isFromParent) return;
        if (isFromSelf && event.origin !== window.location.origin) return;
        if (isFromParent && event.origin !== window.location.origin) {
            try {
                chrome.runtime.sendMessage({ type: 'CHECK_CONFIG' }, (response) => {
                    if (!response?.data?.baseUrl) return;
                    if (event.origin !== new URL(response.data.baseUrl).origin) return;
                    processExtensionMessage(event);
                });
            } catch { }
            return;
        }
        processExtensionMessage(event);
    };
    window.addEventListener('message', extensionMessageHandler);
    cleanupRegistry.push(() => window.removeEventListener('message', extensionMessageHandler));
}

function setupGlobalListeners(): void {
    try {
        const runtimeMessageHandler = (message: any, _sender: any, sendResponse: any) => {
            if (message.type === 'TOGGLE_EMBEDDED_MENU') { toggleEmbeddedMenu(); sendResponse({ success: true }); }
            else if (message.type === 'TOGGLE_SMART_CAPTURE') { smartCaptureMode?.toggle(); sendResponse({ success: true }); }
            else if (message.type === 'PREFERENCES_UPDATED') {
                if (message.data?.defaultHighlightColor) { defaultHighlightColor = message.data.defaultHighlightColor; interactionManager?.updateDefaultColor(defaultHighlightColor); }
                sendResponse({ success: true });
            }
            else if (message.type === 'SHOW_HIGHLIGHT_TOOLBOX') { interactionManager?.handleContextMenuHighlight(); sendResponse({ success: true }); }
            return true;
        };
        chrome.runtime.onMessage.addListener(runtimeMessageHandler);
        cleanupRegistry.push(() => chrome.runtime.onMessage.removeListener(runtimeMessageHandler));
    } catch { }
}

// --- Main Init ---

async function init(): Promise<void> {
    signalExtensionPresence();
    const { ThemeManager } = await import('./shared/ThemeManager');
    await ThemeManager.initExtensionTheme();
    cleanupRegistry.push(() => ThemeManager.cleanup());

    const storageChangeHandler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area === 'local' && (changes.grabshark_preferences || changes.grabshark_site_overrides)) {
            getEffectivePreferences(getHostname(window.location.href)).then(p => {
                if (typeof p.enableSelectionMenu !== 'undefined') enableSelectionMenu = p.enableSelectionMenu;
                if (typeof p.showHighlights !== 'undefined') document.body.classList.toggle('ext-grabshark-highlights-hidden', !p.showHighlights);
            }).catch(() => { });
        }
    };
    chrome.storage.onChanged.addListener(storageChangeHandler);
    cleanupRegistry.push(() => chrome.storage.onChanged.removeListener(storageChangeHandler));

    const isInIframe = window.self !== window.top;
    const hostname = getHostname(window.location.href);

    try {
        const resp = await sendMessage<{ configured: boolean; baseUrl?: string; enableSelectionMenu?: boolean }>('GET_DOMAIN_PREFERENCE', { domain: hostname });
        if (resp.success && resp.data) enableSelectionMenu = resp.data.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu;
        else { const p = await getEffectivePreferences(hostname); enableSelectionMenu = p?.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu; }
        const p = await getEffectivePreferences(hostname);
        if (!(p?.showHighlights ?? true)) document.body.classList.add('ext-grabshark-highlights-hidden');
        defaultHighlightColor = (await getPreferences()).defaultHighlightColor || 'yellow';
    } catch { }

    if (isInIframe) setupWebViewMessageListener();
    setupGlobalListeners();

    const configCheck = await sendMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG');
    if (!configCheck.success || !configCheck.data?.configured) return;

    const grabsharkBaseUrl = configCheck.data.baseUrl;
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
        return;
    }

    toolbox = new HighlightToolbox();
    notePanel = new NotePanel();
    smartCaptureMode = new SmartCaptureMode(createExternalSmartCaptureCallbacks({ defaultHighlightColor, notePanel, toolbox, smartCaptureModeRef }), containerSelector);
    smartCaptureModeRef.current = smartCaptureMode;

    interactionManager = new InteractionManager(toolbox, notePanel, () => smartCaptureMode, () => true, () => enableSelectionMenu);
    interactionManager.updateDefaultColor(defaultHighlightColor);
    interactionManager.setupGlobalListeners();

    if (dataLwFileId && !isNaN(Number(dataLwFileId))) await HighlightManager.loadHighlightsForFileId(Number(dataLwFileId));
    else if (lwLinkIdElement && dataLwLinkId && !isNaN(Number(dataLwLinkId))) await HighlightManager.loadHighlightsForLinkId(Number(dataLwLinkId));
    else {
        const lwId = new URLSearchParams(window.location.search).get('lwLinkId');
        if (lwId && !isNaN(Number(lwId))) await HighlightManager.loadHighlightsForLinkId(Number(lwId));
        else await HighlightManager.loadHighlightsForPage();
    }
}

// Start
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
