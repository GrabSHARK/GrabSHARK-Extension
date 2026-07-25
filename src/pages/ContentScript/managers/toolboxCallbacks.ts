/**
 * Toolbox Callbacks - Callback factory functions for InteractionManager
 * Creates toolbox callbacks for new selections and existing highlights
 */

import { HighlightToolbox, showToast } from '../HighlightToolbox';
import { NotePanel } from '../NotePanel';
import { SmartCaptureMode } from '../SmartCapture';
import { Highlight, HighlightColor } from '../../../@/lib/types/highlight';
import { HighlightManager } from './HighlightManager';
import { SmartCaptureHandlers } from './SmartCaptureHandlers';
import { getSelectionInfo } from '../highlightRenderer';
import { sendMessage } from '../utils/messaging';
import { showSaveNotification } from './ToastManager';
import { ToastLinkData } from '../SaveNotificationToast';

/**
 * Save one or more URLs and show toast notification
 */
export async function saveLinksWithNotification(urls: string[]): Promise<void> {
    if (urls.length === 0) return;
    const savedLinks: ToastLinkData[] = [];

    for (const url of urls) {
        try {
            const response = await sendMessage<{
                link: { id: number; url: string; name: string; createdAt?: string; collection?: { name: string; color?: string; icon?: string } };
            }>('CREATE_LINK', { url, title: '' });

            if (response.success && response.data?.link) {
                savedLinks.push({
                    id: response.data.link.id,
                    url: response.data.link.url,
                    name: response.data.link.name || url,
                    createdAt: response.data.link.createdAt,
                    collection: response.data.link.collection,
                });
            } else {
                showToast(`Failed to save: ${url.substring(0, 30)}...`, 'error');
            }
        } catch { }
    }

    if (savedLinks.length > 0) showSaveNotification(savedLinks);
}

/**
 * Get highlight IDs from the current text selection
 */
export function getHighlightsInSelection(): number[] {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const highlightIds = new Set<number>();

    document.querySelectorAll('[data-ext-lw-highlight-id]').forEach(span => {
        if (range.intersectsNode(span)) {
            const idStr = (span as HTMLElement).dataset.extLwHighlightId;
            if (idStr) highlightIds.add(parseInt(idStr));
        }
    });

    document.querySelectorAll('[data-highlight-id]').forEach(span => {
        if (range.intersectsNode(span)) {
            const idStr = (span as HTMLElement).dataset.highlightId;
            if (idStr) highlightIds.add(parseInt(idStr));
        }
    });

    return Array.from(highlightIds);
}

/**
 * Extract links from highlight spans
 */
export function extractLinksFromHighlight(highlightId: number): Array<{ url: string; label: string }> {
    const linksMap = new Map<string, { url: string; label: string }>();
    const extSpans = document.querySelectorAll(`[data-ext-lw-highlight-id="${highlightId}"]`);
    const appSpans = document.querySelectorAll(`[data-highlight-id="${highlightId}"]`);
    const allSpans = [...Array.from(extSpans), ...Array.from(appSpans)];

    allSpans.forEach(span => {
        const parentAnchor = span.closest('a[href]');
        if (parentAnchor) {
            const a = parentAnchor as HTMLAnchorElement;
            if (a.href?.startsWith('http') && !linksMap.has(a.href)) linksMap.set(a.href, { url: a.href, label: a.textContent?.trim() || a.href });
        }
        span.querySelectorAll('a[href]').forEach(a => {
            const anchor = a as HTMLAnchorElement;
            if (anchor.href?.startsWith('http') && !linksMap.has(anchor.href)) linksMap.set(anchor.href, { url: anchor.href, label: anchor.textContent?.trim() || anchor.href });
        });
    });
    return Array.from(linksMap.values());
}

interface ToolboxContext {
    toolbox: HighlightToolbox;
    notePanel: NotePanel;
    getSmartCapture: () => SmartCaptureMode | null;
    defaultHighlightColor: HighlightColor;
}

/**
 * Show toolbox for a new text selection
 */
export function showToolboxForNewSelection(
    ctx: ToolboxContext,
    selectionInfo: NonNullable<ReturnType<typeof getSelectionInfo>>
): void {
    const position = {
        x: selectionInfo.rect.left + window.scrollX + selectionInfo.rect.width / 2,
        y: selectionInfo.rect.top + window.scrollY,
    };

    const highlightsInSelection = getHighlightsInSelection();

    // After creating a highlight from a new selection, the auto-reopen mechanism (selection
    // change / mutation observer) re-shows the toolbox in new-selection mode again — so
    // subsequent dropdown clicks still hit createHighlight (with all its side-effects)
    // instead of updateHighlight, and our existing-highlight reopen path never fires.
    // Fix: after createHighlight resolves, find the just-created highlight in the cache and
    // explicitly reopen the toolbox in existing-highlight mode (eraser visible, updateHighlight
    // path used for subsequent color changes).
    const reopenAsExistingAfterCreate = () => {
        setTimeout(() => {
            const newHl = HighlightManager.getHighlights().find(h =>
                h.text === selectionInfo.text &&
                h.startOffset === selectionInfo.startOffset &&
                h.endOffset === selectionInfo.endOffset
            );
            if (!newHl) return;
            const span = document.querySelector(`[data-ext-lw-highlight-id="${newHl.id}"]`) as HTMLElement | null;
            if (!span) return;
            const rect = span.getBoundingClientRect();
            const fakeEvent = new MouseEvent('mouseover', {
                bubbles: true,
                composed: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
            });
            showToolboxForExistingHighlight(ctx, newHl, fakeEvent);
        }, 250);
    };

    ctx.toolbox.show(position, {
        onColorSelect: async (color: HighlightColor) => {
            // Clear selection BEFORE the backend call. Otherwise InteractionManager's
            // 80ms selectionchange debounce sees the still-active selection and re-opens
            // the toolbox in new-selection mode (showing the highlight icon) right before
            // our 250ms reopenAsExistingAfterCreate kicks in — that's the flash the user
            // reported. With selection cleared, maybeShowSelectionToolbox short-circuits.
            window.getSelection()?.removeAllRanges();
            await HighlightManager.createHighlight(selectionInfo, color);
            reopenAsExistingAfterCreate();
        },
        onCommentSave: async (comment: string, color?: HighlightColor) => {
            window.getSelection()?.removeAllRanges();
            await HighlightManager.createHighlight(selectionInfo, color || ctx.defaultHighlightColor, comment);
            reopenAsExistingAfterCreate();
        },
        onDelete: async () => {
            if (highlightsInSelection.length > 0 && confirm(`Delete ${highlightsInSelection.length} highlight${highlightsInSelection.length > 1 ? 's' : ''}?`)) {
                for (const id of highlightsInSelection) await HighlightManager.deleteHighlight(id);
            }
        },
        onClip: () => {
            if (selectionInfo.rect && selectionInfo.text) {
                SmartCaptureHandlers.handleClip({
                    type: 'TEXT_BLOCK', rect: selectionInfo.rect, title: selectionInfo.text,
                    extracted: { text: selectionInfo.text },
                    pageContext: { pageUrl: window.location.href, pageTitle: document.title, capturedAt: Date.now() }
                });
            }
        },
        onSmartCapture: () => ctx.getSmartCapture()?.activate(),
        onSaveLink: async (url: string) => saveLinksWithNotification([url]),
        onSaveAllLinks: async (urls: string[]) => saveLinksWithNotification(urls),
        onOpenNotePanel: (targetRect, selectedColor) => {
            ctx.notePanel.show(
                { x: (targetRect?.left || position.x) + (targetRect?.width || 0) / 2 + window.scrollX, y: (targetRect?.bottom || position.y) + window.scrollY + 10 },
                {
                    onSave: async (comment: string, color: HighlightColor) => HighlightManager.createHighlight(selectionInfo, color, comment),
                    onCancel: () => { }, onClose: () => { }
                },
                '', selectedColor, targetRect
            );
        },
        onClose: () => { window.getSelection()?.removeAllRanges(); },
    }, null, false, selectionInfo.rect, undefined, highlightsInSelection, ctx.defaultHighlightColor);
}

/**
 * Show toolbox for an existing highlight
 */
export function showToolboxForExistingHighlight(
    ctx: ToolboxContext,
    highlight: Highlight,
    event: MouseEvent
): void {
    const extSpans = document.querySelectorAll(`[data-ext-lw-highlight-id="${highlight.id}"]`);
    const appSpans = document.querySelectorAll(`[data-highlight-id="${highlight.id}"]`);
    const allSpans = [...Array.from(extSpans), ...Array.from(appSpans)];

    let highlightRect: DOMRect | null = null;
    if (allSpans.length > 0) {
        let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
        for (const span of allSpans) {
            const rect = span.getBoundingClientRect();
            minLeft = Math.min(minLeft, rect.left); minTop = Math.min(minTop, rect.top);
            maxRight = Math.max(maxRight, rect.right); maxBottom = Math.max(maxBottom, rect.bottom);
        }
        highlightRect = new DOMRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
    }

    const position = highlightRect
        ? { x: highlightRect.left + window.scrollX + highlightRect.width / 2, y: highlightRect.top + window.scrollY }
        : { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };

    const highlightLinks = extractLinksFromHighlight(highlight.id);

    // After a color/comment update, the highlight stays in DOM (only CSS classes change),
    // so the "applyHighlight → mouseover → InteractionManager.handleMouseOver → reopen" path
    // that triggers automatically for createHighlight does NOT fire for updates.
    // Use direct show() — most explicit, doesn't rely on event propagation through document.
    const reopenAfterUpdate = (newColor: HighlightColor) => {
        // 250ms = close anim (200ms) + small grace so close anim is visible before reopen.
        setTimeout(() => {
            // Re-query highlight span position from current DOM (may have reflowed)
            const span = document.querySelector(`[data-ext-lw-highlight-id="${highlight.id}"]`) as HTMLElement | null;
            if (!span) {
                console.warn('[GrabSHARK] reopenAfterUpdate: highlight span not found in DOM', highlight.id);
                return;
            }
            const rect = span.getBoundingClientRect();
            const fakeEvent = new MouseEvent('mouseover', {
                bubbles: true,
                composed: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
            });
            const updated: Highlight = { ...highlight, color: newColor };
            // Direct call — bypasses event dispatch entirely.
            showToolboxForExistingHighlight(ctx, updated, fakeEvent);
        }, 250);
    };

    ctx.toolbox.show(position, {
        onColorSelect: async (color) => {
            await HighlightManager.updateHighlight(highlight, color);
            reopenAfterUpdate(color);
        },
        onCommentSave: async (comment, color) => {
            const finalColor = color || highlight.color as HighlightColor;
            await HighlightManager.updateHighlight(highlight, finalColor, comment);
            reopenAfterUpdate(finalColor);
        },
        onDelete: async () => HighlightManager.deleteHighlight(highlight.id),
        onClip: () => {
            SmartCaptureHandlers.handleClip({
                type: 'TEXT_BLOCK', rect: (event.target as HTMLElement).getBoundingClientRect(),
                title: highlight.text || '', extracted: { text: highlight.text || '' },
                pageContext: { pageUrl: window.location.href, pageTitle: document.title, capturedAt: Date.now() }
            });
        },
        onSmartCapture: () => ctx.getSmartCapture()?.activate(),
        onSaveLink: async (url: string) => saveLinksWithNotification([url]),
        onSaveAllLinks: async (urls: string[]) => saveLinksWithNotification(urls),
        onOpenNotePanel: (targetRect, selectedColor) => {
            ctx.notePanel.show(
                { x: (targetRect?.left || position.x) + (targetRect?.width || 0) / 2 + window.scrollX, y: (targetRect?.bottom || position.y) + window.scrollY + 10 },
                {
                    onSave: async (c, color) => HighlightManager.updateHighlight(highlight, color, c),
                    onCancel: () => { }, onClose: () => { }
                },
                highlight.comment || '', selectedColor, targetRect
            );
        },
        onClose: () => { },
    }, highlight, false, highlightRect || undefined, highlightLinks, undefined, ctx.defaultHighlightColor);
}
