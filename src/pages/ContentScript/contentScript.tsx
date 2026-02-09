/// <reference types="chrome" />
// Linkwarden Content Script - Main entry point
import './content-armor.css';
import './components.css';

import { HighlightToolbox, showToast } from './HighlightToolbox';
import { SmartCaptureMode } from './SmartCapture';
import { NotePanel } from './NotePanel';

// Managers
import { toggleEmbeddedMenu } from './managers/EmbeddedMenuManager';
import { HighlightManager } from './managers/HighlightManager';
import { SmartCaptureHandlers } from './managers/SmartCaptureHandlers';
import { InteractionManager } from './managers/InteractionManager';

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

// Cleanup registry for memory leak prevention
const cleanupRegistry: (() => void)[] = [];

/**
 * Cleanup all registered listeners (called on page unload)
 */
function cleanup(): void {
    cleanupRegistry.forEach(fn => {
        try { fn(); } catch (e) { /* ignore */ }
    });
    cleanupRegistry.length = 0;

    // Destroy global instances
    if (toolbox) { toolbox.destroy(); toolbox = null; }
    if (notePanel) { notePanel.destroy(); notePanel = null; }
    if (smartCaptureMode) { smartCaptureMode.destroy(); smartCaptureMode = null; }
    if (interactionManager) { interactionManager.destroy(); interactionManager = null; }
}

// Register cleanup on page unload
window.addEventListener('beforeunload', cleanup);

/**
 * Signal extension presence to the page
 */
function signalExtensionPresence(): void {
    if (!document.getElementById('spark-extension-installed')) {
        const marker = document.createElement('div');
        marker.id = 'spark-extension-installed';
        marker.setAttribute('data-version', '1.3.3');
        marker.style.display = 'none';
        document.documentElement.appendChild(marker);
    }

    document.dispatchEvent(new CustomEvent('spark-extension-ready', {
        detail: { version: '1.3.3' }
    }));

    // Named handler for cleanup
    const extensionMessageHandler = (event: MessageEvent) => {
        const isFromSelf = event.source === window;
        const isFromParent = event.source === window.parent;
        if (!isFromSelf && !isFromParent) return;

        if (event.data?.type === 'LW_PING') {
            try {
                chrome.runtime.sendMessage({ type: 'CHECK_CONFIG' }, (response) => {
                    const configured = response?.success && response?.data?.configured;
                    window.postMessage({ type: 'LW_PONG', version: '1.3.3', configured }, '*');
                });
            } catch (e) {
                // Extension context invalidated - ignore
            }
            return;
        }

        if (event.data?.type === 'SPARK_SMART_CAPTURE') {
            if (smartCaptureMode) {
                // Dynamically set container selector (it may have been added after init)
                const lwLinkIdElement = document.querySelector('[data-lw-link-id]');
                if (lwLinkIdElement) {
                    smartCaptureMode.setContainer('[data-lw-link-id]');
                }
                smartCaptureMode.toggle();
            } else {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try { iframe.contentWindow?.postMessage({ type: 'SPARK_SMART_CAPTURE' }, '*'); } catch (e) { }
                });
            }
        }

        if (event.data?.type === 'SPARK_CLIP') {
            if (smartCaptureMode) {
                const selection = event.data.selection;
                if (selection && selection.text && selection.rect) {
                    const rect = new DOMRect(selection.rect.x, selection.rect.y, selection.rect.width, selection.rect.height);
                    SmartCaptureHandlers.handleClip({
                        type: 'TEXT_BLOCK',
                        rect,
                        title: selection.text,
                        extracted: { text: selection.text },
                        pageContext: {
                            pageUrl: window.location.href,
                            pageTitle: document.title,
                            capturedAt: Date.now()
                        }
                    });
                }
            } else {
                const iframes = document.querySelectorAll('iframe');
                iframes.forEach(iframe => {
                    try { iframe.contentWindow?.postMessage({ type: 'SPARK_CLIP', selection: event.data.selection }, '*'); } catch (e) { }
                });
            }
        }

        if (event.data?.type === 'SPARK_DEACTIVATE_SMART_CAPTURE') {
            smartCaptureMode?.deactivate();
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                try { iframe.contentWindow?.postMessage({ type: 'SPARK_DEACTIVATE_SMART_CAPTURE' }, '*'); } catch (e) { }
            });
        }
    };

    window.addEventListener('message', extensionMessageHandler);
    cleanupRegistry.push(() => window.removeEventListener('message', extensionMessageHandler));
}

async function init(): Promise<void> {
    signalExtensionPresence();

    // Initialize extension theme preference FIRST (before any UI creation)
    const { ThemeManager } = await import('./shared/ThemeManager');
    await ThemeManager.initExtensionTheme();

    // Preferences setup - Named handler for cleanup
    const storageChangeHandler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
        if (area === 'local' && (changes.spark_preferences || changes.spark_site_overrides)) {
            const hostname = getHostname(window.location.href);
            getEffectivePreferences(hostname).then(newPrefs => {
                if (typeof newPrefs.enableSelectionMenu !== 'undefined') enableSelectionMenu = newPrefs.enableSelectionMenu;
                if (typeof newPrefs.showHighlights !== 'undefined') {
                    document.body.classList.toggle('ext-spark-highlights-hidden', !newPrefs.showHighlights);
                }
            }).catch(() => { });
        }
    };
    chrome.storage.onChanged.addListener(storageChangeHandler);
    cleanupRegistry.push(() => chrome.storage.onChanged.removeListener(storageChangeHandler));

    const isInIframe = window.self !== window.top;
    const hostname = getHostname(window.location.href);

    // Load initial prefs
    try {
        const resp = await sendMessage<{ configured: boolean; baseUrl?: string; enableSelectionMenu?: boolean }>('GET_DOMAIN_PREFERENCE', { domain: hostname });
        if (resp.success && resp.data) {
            enableSelectionMenu = resp.data.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu;
        } else {
            const prefs = await getEffectivePreferences(hostname);
            enableSelectionMenu = prefs?.enableSelectionMenu ?? DEFAULT_PREFERENCES.enableSelectionMenu;
        }

        const prefs = await getEffectivePreferences(hostname);
        if (!(prefs?.showHighlights ?? true)) document.body.classList.add('ext-spark-highlights-hidden');

        const fullPrefs = await getPreferences();
        defaultHighlightColor = fullPrefs.defaultHighlightColor || 'yellow';
    } catch { }

    if (isInIframe) setupWebViewMessageListener();

    setupGlobalListeners(); // For toggle messages

    const configCheck = await sendMessage<{ configured: boolean; baseUrl?: string }>('CHECK_CONFIG');
    if (!configCheck.success || !configCheck.data?.configured) return;

    // View detection logic
    const sparkBaseUrl = configCheck.data.baseUrl;
    const lwLinkIdElement = document.querySelector('[data-lw-link-id]');
    const dataLwLinkId = lwLinkIdElement?.getAttribute('data-lw-link-id');
    const lwFileIdElement = document.querySelector('[data-ext-lw-file-id]');
    let dataLwFileId = lwFileIdElement?.getAttribute('data-ext-lw-file-id') || null;

    if (!dataLwFileId) {
        const match = window.location.pathname.match(/\/api\/v1\/files\/(\d+)\/(file|content)/);
        if (match) dataLwFileId = match[1];
    }

    // On Linkwarden instance (main page OR iframe): skip extension toolbox
    // Native toolbox handles UI on all Linkwarden pages
    if (sparkBaseUrl && isOnSparkInstance(sparkBaseUrl as string)) {
        console.log('[LW Extension] On Linkwarden instance, skipping extension toolbox');

        // Load highlights only on main page (not iframes)
        if (!isInIframe) {
            if (dataLwLinkId) {
                await HighlightManager.loadHighlightsForLinkId(Number(dataLwLinkId));
            }
            if (dataLwFileId) {
                await HighlightManager.loadHighlightsForFileId(Number(dataLwFileId));
            }
            setupReadableViewObserver(sparkBaseUrl as string);
        }

        // Initialize SmartCaptureMode for BOTH main page and iframes (Clip/SmartCapture buttons)
        const containerSelector = dataLwLinkId ? '[data-lw-link-id]' : undefined;
        smartCaptureMode = new SmartCaptureMode({
            onHighlight: async (target) => {
                if (target.extracted?.text && target.elementRef) {
                    const range = document.createRange();
                    range.selectNodeContents(target.elementRef);
                    const anchor = captureAnchor(range);
                    await HighlightManager.createHighlight({
                        text: target.extracted.text,
                        startOffset: 0,
                        endOffset: target.extracted.text.length,
                        rect: target.rect,
                        anchor: anchor
                    }, defaultHighlightColor);
                }
            },
            onClip: SmartCaptureHandlers.handleClip,
            onSaveLink: SmartCaptureHandlers.handleSaveLink,
            onSaveBatch: async (urls, type) => {
                for (const url of urls) {
                    if (type === 'LINK') await SmartCaptureHandlers.handleSaveLink({ url, type: 'LINK', rect: new DOMRect(), extracted: {} } as any);
                    else if (type === 'IMAGE') await SmartCaptureHandlers.handleSaveImage({ url, type: 'IMAGE', rect: new DOMRect(), extracted: { image: { src: url } } } as any);
                    else if (type === 'VIDEO') await SmartCaptureHandlers.handleSaveImage({ url, type: 'VIDEO', rect: new DOMRect(), extracted: { video: { src: url } } } as any);
                    else if (type === 'FILE') await SmartCaptureHandlers.handleSaveFile({ url, type: 'FILE', rect: new DOMRect(), extracted: {} } as any);
                }
            },
            onSaveImage: SmartCaptureHandlers.handleSaveImage,
            onSaveFile: SmartCaptureHandlers.handleSaveFile,
            onAddNote: async () => { /* Handled by native NotePanel */ },
            onClose: () => { },
            canSelectionChange: () => true,
            onSelectionChange: () => { }
        }, containerSelector);

        return; // Don't initialize extension toolbox (for both main page and iframes)
    }

    // Initialize Global Instances
    const globalIsConfigured = () => true; // We checked config above
    const globalEnableSelectionMenu = () => enableSelectionMenu;

    toolbox = new HighlightToolbox();
    notePanel = new NotePanel();

    // Setup Smart Capture with refs to handlers
    const containerSelector = dataLwLinkId ? '[data-lw-link-id]' : undefined;
    smartCaptureMode = new SmartCaptureMode({
        onHighlight: async (target) => {
            // Smart Capture highlight - need to generate anchor for DOM rendering
            if (target.extracted?.text && target.elementRef) {
                // Create a Range from the elementRef to capture anchor data
                const range = document.createRange();
                range.selectNodeContents(target.elementRef);
                const anchor = captureAnchor(range);

                await HighlightManager.createHighlight({
                    text: target.extracted.text,
                    startOffset: 0,
                    endOffset: target.extracted.text.length,
                    rect: target.rect,
                    anchor: anchor
                }, defaultHighlightColor);
            } else if (target.extracted?.text && target.rect) {
                // Fallback without elementRef - highlight will save but may not render
                console.warn('[ContentScript] onHighlight: No elementRef, highlight may not render visually');
                await HighlightManager.createHighlight({
                    text: target.extracted.text,
                    startOffset: 0,
                    endOffset: target.extracted.text.length,
                    rect: target.rect,
                    anchor: undefined
                }, defaultHighlightColor);
            }
        },
        onClip: SmartCaptureHandlers.handleClip,
        onSaveLink: SmartCaptureHandlers.handleSaveLink,
        onSaveBatch: async (urls, type) => {
            for (const url of urls) {
                if (type === 'LINK') await SmartCaptureHandlers.handleSaveLink({ url, type: 'LINK', rect: new DOMRect(), extracted: {} } as any);
                else if (type === 'IMAGE') await SmartCaptureHandlers.handleSaveImage({ url, type: 'IMAGE', rect: new DOMRect(), extracted: { image: { src: url } } } as any);
                else if (type === 'VIDEO') await SmartCaptureHandlers.handleSaveImage({ url, type: 'VIDEO', rect: new DOMRect(), extracted: { video: { src: url } } } as any);
                else if (type === 'FILE') await SmartCaptureHandlers.handleSaveFile({ url, type: 'FILE', rect: new DOMRect(), extracted: {} } as any);
            }
        },
        onSaveImage: SmartCaptureHandlers.handleSaveImage,
        onSaveFile: SmartCaptureHandlers.handleSaveFile,
        onAddNote: async (target) => {
            if (smartCaptureMode) smartCaptureMode.pauseSelection();
            if (notePanel) {
                notePanel.show(
                    { x: (target.rect?.left || 0) + (target.rect?.width || 0) / 2 + window.scrollX, y: (target.rect?.bottom || 0) + window.scrollY + 10 },
                    {
                        onSave: async (comment, color) => {
                            await SmartCaptureHandlers.handleNoteSave(target, comment, color);
                            if (smartCaptureMode) smartCaptureMode.resumeSelection();
                        },
                        onCancel: () => {
                            if (smartCaptureMode) { smartCaptureMode.resumeSelection(); smartCaptureMode.reshowActionBar(); }
                        },
                        onClose: () => { if (smartCaptureMode) smartCaptureMode.resumeSelection(); }
                    },
                    '',
                    defaultHighlightColor,
                    target.rect
                );
            }
        },
        onClose: () => { },
        canSelectionChange: () => {
            if (toolbox && toolbox.isOpen() && toolbox.isCommentDirty()) {
                showToast('Please save or cancel your note changes first', 'error');
                return false;
            }
            return true;
        },
        onSelectionChange: () => {
            if (toolbox && toolbox.isOpen()) toolbox.close();
        }
    }, containerSelector);

    interactionManager = new InteractionManager(
        toolbox,
        notePanel,
        () => smartCaptureMode,
        globalIsConfigured,
        globalEnableSelectionMenu
    );
    interactionManager.updateDefaultColor(defaultHighlightColor);
    interactionManager.setupGlobalListeners();

    // Load Highlights
    if (dataLwFileId && !isNaN(Number(dataLwFileId))) {
        await HighlightManager.loadHighlightsForFileId(Number(dataLwFileId));
    } else if (lwLinkIdElement && dataLwLinkId && !isNaN(Number(dataLwLinkId))) {
        await HighlightManager.loadHighlightsForLinkId(Number(dataLwLinkId));
    } else {
        // Double check URL param
        const urlParams = new URLSearchParams(window.location.search);
        const lwLinkIdFromUrl = urlParams.get('lwLinkId');
        if (lwLinkIdFromUrl && !isNaN(Number(lwLinkIdFromUrl))) {
            await HighlightManager.loadHighlightsForLinkId(Number(lwLinkIdFromUrl));
        } else {
            await HighlightManager.loadHighlightsForPage();
        }
    }
}

function isOnSparkInstance(baseUrl: string): boolean {
    try {
        return new URL(window.location.href).origin === new URL(baseUrl).origin;
    } catch { return false; }
}

function setupReadableViewObserver(_sparkBaseUrl: string): void {
    let observerInitialized = false;

    // On Linkwarden pages, we only load highlights - native toolbox handles UI
    const loadHighlightsOnly = async (linkId: string | null, fileId: string | null) => {
        if (observerInitialized) return;
        observerInitialized = true;

        console.log('[LW Extension] On Linkwarden page, loading highlights only (native toolbox will be used)', { linkId, fileId });

        // Load highlights for the detected view
        if (linkId) await HighlightManager.loadHighlightsForLinkId(Number(linkId));
        if (fileId) await HighlightManager.loadHighlightsForFileId(Number(fileId));

        console.log('[LW Extension] Highlights loaded');
    };

    // Check if readable view already exists in DOM
    const linkIdElement = document.querySelector('[data-lw-link-id]');
    const linkId = linkIdElement?.getAttribute('data-lw-link-id') || null;
    const fileIdElement = document.querySelector('[data-ext-lw-file-id]');
    const fileId = fileIdElement?.getAttribute('data-ext-lw-file-id') || null;

    if (linkId || fileId) {
        console.log('[LW Extension] Readable view already in DOM');
        loadHighlightsOnly(linkId, fileId);
        return; // No need for observer
    }

    console.log('[LW Extension] Setting up MutationObserver for readable view');

    const observer = new MutationObserver(async () => {
        const linkIdElement = document.querySelector('[data-lw-link-id]');
        const linkId = linkIdElement?.getAttribute('data-lw-link-id') || null;
        const fileIdElement = document.querySelector('[data-ext-lw-file-id]');
        const fileId = fileIdElement?.getAttribute('data-ext-lw-file-id') || null;

        if (linkId || fileId) {
            observer.disconnect();
            await loadHighlightsOnly(linkId, fileId);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function setupWebViewMessageListener(): void {
    const webViewMessageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'LINKWARDEN_WEB_VIEW_CONTEXT') {
            const { linkId } = event.data;
            if (linkId && typeof linkId === 'number') HighlightManager.loadHighlightsForLinkId(linkId);
        }
    };
    window.addEventListener('message', webViewMessageHandler);
    cleanupRegistry.push(() => window.removeEventListener('message', webViewMessageHandler));
}

function setupGlobalListeners(): void {
    try {
        chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
            if (message.type === 'TOGGLE_EMBEDDED_MENU') {
                toggleEmbeddedMenu();
                sendResponse({ success: true });
            } else if (message.type === 'TOGGLE_SMART_CAPTURE') {
                smartCaptureMode?.toggle();
                sendResponse({ success: true });
            } else if (message.type === 'PREFERENCES_UPDATED') {
                const data = message.data;
                if (data.defaultHighlightColor) {
                    defaultHighlightColor = data.defaultHighlightColor;
                    if (interactionManager) interactionManager.updateDefaultColor(defaultHighlightColor);
                }
                sendResponse({ success: true });
            } else if (message.type === 'SHOW_HIGHLIGHT_TOOLBOX') {
                interactionManager?.handleContextMenuHighlight();
                sendResponse({ success: true });
            }
            return true;
        });
    } catch (e) {
        // Extension context invalidated - ignore
    }
}

// Start
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
