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

    /**
     * Load highlights for the current page by URL
     */
    async loadHighlightsForPage(): Promise<void> {
        const pageUrl = window.location.href;

        const response = await sendMessage<{ link: LinkData | null; highlights: Highlight[] }>(
            'GET_LINK_WITH_HIGHLIGHTS',
            { url: pageUrl }
        );

        if (response.success && response.data) {
            // Cache the result for Optimistic UI in EmbeddedApp
            try {
                const cacheKey = `lw_cache_${pageUrl}`;
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    link: response.data.link
                }));
            } catch (e) {
                // Ignore storage errors
            }

            if (response.data.link) {
                currentPageLinkId = response.data.link.id;
                currentHighlights = response.data.highlights || [];

                if (currentHighlights.length > 0) {

                    applyHighlights(currentHighlights);
                }
            }
        }
    },

    /**
     * Load highlights for a specific link ID (used in Web View context)
     */
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

    /**
     * Load highlights for a specific file ID (used in file view context)
     */
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

    /**
     * Create a new highlight (and auto-save link if needed)
     */
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

        // If page not saved yet, save it first
        if (!currentPageLinkId) {

            // Check if user wants to save the full page or just create a lightweight anchor
            let shouldSavePage = true;
            try {
                const prefs = await getPreferences();
                shouldSavePage = prefs.savePageOnHighlight ?? true;
            } catch (e) {
                // Fallback to default (save page)
            }

            showToast('Saving page to SPARK...', 'success');

            const linkPayload: Record<string, any> = {
                url: window.location.href,
                title: document.title,
            };

            // If user disabled page saving, create a hidden "highlight" type link with no archiving
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
                showToast('Failed to save page', 'error');
                return;
            }

            currentPageLinkId = linkResponse.data.link.id;
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

    /**
     * Update an existing highlight (color or comment)
     */
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

    /**
     * Delete a highlight
     */
    async deleteHighlight(highlightId: number): Promise<void> {
        const response = await sendMessage<{ linkId?: number }>('DELETE_HIGHLIGHT', { highlightId, linkId: currentPageLinkId });

        if (response.success) {
            // Remove from local state
            currentHighlights = currentHighlights.filter(h => h.id !== highlightId);

            // Remove from DOM
            removeHighlight(highlightId);


            // Notify web app to invalidate cache
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
