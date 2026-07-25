import { Highlight, HighlightColor, HighlightCreateData } from '../../../@/lib/types/highlight';
import {
    applyHighlights,
    applyHighlight,
    removeHighlight,
    updateHighlightClasses,
    getSelectionInfo
} from '../highlightRenderer';
import { showToast } from '../HighlightToolbox';
import { sendMessage } from '../utils/messaging';
import { getPreferences } from '../../../@/lib/settings';
import { readLinkSessionCache, writeLinkSessionCache } from '../../../@/lib/runtime/sessionCache';

interface LinkData {
    id: number;
    url: string;
    name: string;
}

// Global state managed by this module
let currentHighlights: Highlight[] = [];
let currentPageLinkId: number | null = null;
let currentPageFileId: number | null = null; // For file highlights

export const HighlightManager = {
    // State Getters
    getHighlights: () => currentHighlights,
    getCurrentLinkId: () => currentPageLinkId,
    getCurrentFileId: () => currentPageFileId,

    // State Setters (if needed strictly, otherwise internal logic handles it)
    setLinkId: (id: number | null) => { currentPageLinkId = id; },
    setFileId: (id: number | null) => { currentPageFileId = id; },

    /** Load highlights for the current page by URL (cache-first) */
    async loadHighlightsForPage(): Promise<void> {
        const pageUrl = window.location.href;

        // 1. Local-only lookup — no network request
        const lookupResponse = await sendMessage<{ linkId: number | null }>(
            'LOOKUP_LINK_ID',
            { url: pageUrl }
        );

        const linkId = lookupResponse.success ? lookupResponse.data?.linkId ?? null : null;

        if (!linkId) {
            // Page is not in the system — nothing to load, zero API calls
            return;
        }

        // 2. Page is known — set linkId and fetch highlights (single API call)
        currentPageLinkId = linkId;
        writeLinkSessionCache(pageUrl, { id: linkId, url: pageUrl, name: '' });

        const response = await sendMessage<{ highlights: Highlight[] }>(
            'GET_HIGHLIGHTS_BY_LINK_ID',
            { linkId }
        );

        if (response.success && response.data) {
            currentHighlights = response.data.highlights || [];

            if (currentHighlights.length > 0) {
                applyHighlights(currentHighlights);
            }
        }
    },

    /** Load highlights for a specific link ID (used in Web View context) */
    async loadHighlightsForLinkId(linkId: number): Promise<void> {
        currentPageLinkId = linkId;

        const response = await sendMessage<{ highlights: Highlight[] }>(
            'GET_HIGHLIGHTS_BY_LINK_ID',
            { linkId }
        );

        if (response.success && response.data) {
            currentHighlights = response.data.highlights || [];

            if (currentHighlights.length > 0) {
                // Checks for scoped container first (Readable View)
                const readableContainer = document.querySelector('[data-lw-link-id]') as HTMLElement;
                if (readableContainer) {
                    applyHighlights(currentHighlights, readableContainer, true);
                } else {
                    applyHighlights(currentHighlights, document.body, true);
                }
            }
        }
    },

    /** Load highlights for a specific file ID (used in file view context) */
    async loadHighlightsForFileId(fileId: number): Promise<void> {
        currentPageFileId = fileId;
        currentPageLinkId = null; // Clear link ID since we're in file context

        const response = await sendMessage<{ highlights: Highlight[] }>(
            'GET_FILE_HIGHLIGHTS',
            { fileId }
        );

        if (response.success && response.data) {
            currentHighlights = response.data.highlights || [];

            if (currentHighlights.length > 0) {
                // Checks for scoped container first (File View)
                const fileContainer = document.querySelector('[data-ext-lw-file-id]') as HTMLElement;
                if (fileContainer) {
                    applyHighlights(currentHighlights, fileContainer, true);
                } else {
                    applyHighlights(currentHighlights, document.body, true);
                }
            }
        }
    },

        /** Create a new highlight (and auto-save link if needed) */
    async createHighlight(
        selectionInfo: NonNullable<ReturnType<typeof getSelectionInfo>>,
        color: HighlightColor,
        comment?: string,
        ranges?: { startOffset: number; endOffset: number }[]
    ): Promise<void> {
        // If we're in file context, use file highlight API directly (no link creation)
        if (currentPageFileId) {

            const response = await sendMessage<{ highlight: Highlight }>('CREATE_FILE_HIGHLIGHT', {
                fileId: currentPageFileId,
                color,
                comment: comment || undefined,
                text: selectionInfo.text,
                startOffset: selectionInfo.startOffset,
                endOffset: selectionInfo.endOffset,
                ranges: ranges,
                anchor: selectionInfo.anchor  // Waterfall Anchoring data
            });

            if (response.success && response.data?.highlight) {
                const newHighlight = response.data.highlight;
                currentHighlights.push(newHighlight);
                applyHighlight(newHighlight);
                // Notify web app to invalidate cache
                const message = {
                    type: 'LW_FILE_HIGHLIGHT_CREATED',
                    payload: { highlight: newHighlight, fileId: currentPageFileId }
                };
                if (window.parent !== window) window.parent.postMessage(message, '*');
                window.postMessage(message, '*');
            } else {
                showToast(response.error || 'Failed to create highlight', 'error');
            }
            return;
        }

        if (!currentPageLinkId) {
            const cachedLink = readLinkSessionCache<LinkData>(window.location.href);
            const cachedLinkId = cachedLink?.id;
            if (typeof cachedLinkId === 'number' && cachedLinkId > 0) {
                currentPageLinkId = cachedLinkId;
            }
        }

        // If page not saved yet, save it first
        if (!currentPageLinkId) {
            let shouldSavePage = true;
            try {
                const prefs = await getPreferences();
                shouldSavePage = prefs.savePageOnHighlight ?? true;
            } catch {
                // Fallback to default (save page)
            }

            showToast(
                shouldSavePage ? 'Saving page to GrabSHARK...' : 'Saving highlight...',
                'success',
            );

            const linkPayload: Record<string, any> = {
                url: window.location.href,
                title: document.title,
            };

            if (!shouldSavePage) {
                linkPayload.type = 'highlight';
                linkPayload.preservationConfig = {
                    archiveAsScreenshot: false,
                    archiveAsMonolith: false,
                    archiveAsPDF: false,
                    archiveAsReadable: false,
                    archiveAsWaybackMachine: false,
                    aiTag: false,
                };
            }

            const linkResponse = await sendMessage<{ link: LinkData }>('CREATE_LINK', linkPayload);

            if (!linkResponse.success || !linkResponse.data?.link) {
                // Fallback: check if the link already exists via local cache
                const lookupResp = await sendMessage<{ linkId: number | null }>(
                    'LOOKUP_LINK_ID',
                    { url: window.location.href }
                );

                if (!lookupResp.success || !lookupResp.data?.linkId) {
                    showToast('Failed to save page', 'error');
                    return;
                }

                currentPageLinkId = lookupResp.data.linkId;
                writeLinkSessionCache(window.location.href, { id: currentPageLinkId, url: window.location.href, name: '' });

                // Fetch existing highlights for this link
                const hlResp = await sendMessage<{ highlights: Highlight[] }>(
                    'GET_HIGHLIGHTS_BY_LINK_ID',
                    { linkId: currentPageLinkId }
                );
                if (hlResp.success && hlResp.data) {
                    currentHighlights = hlResp.data.highlights || currentHighlights;
                }
            } else {
                currentPageLinkId = linkResponse.data.link.id;
                writeLinkSessionCache(window.location.href, linkResponse.data.link);
            }
        }

        const highlightData: HighlightCreateData = {
            linkId: currentPageLinkId,
            color,
            comment: comment || undefined,
            text: selectionInfo.text,
            startOffset: selectionInfo.startOffset,
            endOffset: selectionInfo.endOffset,
            ranges: ranges,
            anchor: selectionInfo.anchor  // Waterfall Anchoring data
        };

        const response = await sendMessage<{ highlight: Highlight }>('CREATE_HIGHLIGHT', highlightData);

        if (response.success && response.data?.highlight) {
            const newHighlight = response.data.highlight;
            currentHighlights.push(newHighlight);
            applyHighlight(newHighlight);

            // Notify web app to invalidate cache
            const message = {
                type: 'LW_HIGHLIGHT_CREATED',
                payload: { highlight: newHighlight, linkId: currentPageLinkId }
            };
            if (window.parent !== window) window.parent.postMessage(message, '*');
            window.postMessage(message, '*');
        } else {
            showToast(response.error || 'Failed to create highlight', 'error');
        }
    },
    /** Update an existing highlight (color or comment) */
    async updateHighlight(
        highlight: Highlight,
        color: HighlightColor,
        comment?: string
    ): Promise<void> {
        const updatedData: HighlightCreateData = {
            linkId: highlight.linkId,
            color,
            comment: comment !== undefined ? comment : highlight.comment || undefined,
            text: highlight.text,
            startOffset: highlight.startOffset,
            endOffset: highlight.endOffset,
        };

        const response = await sendMessage<{ highlight: Highlight }>('CREATE_HIGHLIGHT', updatedData);

        if (response.success && response.data?.highlight) {
            const updatedHighlight = response.data.highlight;

            // Update local state
            const index = currentHighlights.findIndex(h => h.id === highlight.id);
            if (index !== -1) {
                currentHighlights[index] = updatedHighlight;
            }

            // Update DOM
            updateHighlightClasses(highlight.id, color, !!updatedHighlight.comment);

            showToast('Highlight updated!', 'success');

            // Notify web app to invalidate cache
            const message = currentPageFileId
                ? {
                    type: 'LW_FILE_HIGHLIGHT_UPDATED',
                    payload: { highlight: updatedHighlight, fileId: currentPageFileId }
                }
                : {
                    type: 'LW_HIGHLIGHT_UPDATED',
                    payload: { highlight: updatedHighlight, linkId: highlight.linkId || currentPageLinkId }
                };
            if (window.parent !== window) window.parent.postMessage(message, '*');
            window.postMessage(message, '*');
        } else {
            showToast(response.error || 'Failed to update highlight', 'error');
        }
    },

    /** Delete a highlight */
    async deleteHighlight(highlightId: number): Promise<void> {
        const response = await sendMessage<{ linkId?: number }>('DELETE_HIGHLIGHT', { highlightId, linkId: currentPageLinkId });

        // Always clean up local state + DOM, regardless of backend outcome.
        // Rationale: a failed DELETE here shouldn't strand a visible-but-stale highlight
        // span in the page (the prior bug: 500 from backend → response.success=false →
        // span never unwrapped → silik tint kalıyordu). Treating delete as idempotent on
        // the client matches REST best practice; if DB and client drift, next reload
        // re-applies any surviving highlights.
        currentHighlights = currentHighlights.filter(h => h.id !== highlightId);
        removeHighlight(highlightId);

        if (response.success) {
            const message = currentPageFileId
                ? {
                    type: 'LW_FILE_HIGHLIGHT_DELETED',
                    payload: { highlightId, fileId: currentPageFileId }
                }
                : {
                    type: 'LW_HIGHLIGHT_DELETED',
                    payload: { highlightId, linkId: response.data?.linkId || currentPageLinkId }
                };
            if (window.parent !== window) window.parent.postMessage(message, '*');
            window.postMessage(message, '*');
        } else {
            showToast(response.error || 'Failed to delete highlight', 'error');
        }
    }
};



