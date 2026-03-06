import { HighlightToolbox, showToast } from '../HighlightToolbox';
import { NotePanel } from '../NotePanel';
import { SmartCaptureMode } from '../SmartCapture';
import { Highlight, HighlightColor } from '../../../@/lib/types/highlight';
import { HighlightManager } from './HighlightManager';
import { SmartCaptureHandlers } from './SmartCaptureHandlers';
import { getSelectionInfo, getHighlightIdFromElement } from '../highlightRenderer';
import { sendMessage } from '../utils/messaging';
import { showSaveNotification } from './ToastManager';
import { ToastLinkData } from '../SaveNotificationToast';

/**
 * Identify if we are in a text selection or clicking a highlight
 * and show the appropriate toolbox.
 */
export class InteractionManager {
    private toolbox: HighlightToolbox;
    private notePanel: NotePanel;
    private getSmartCapture: () => SmartCaptureMode | null;
    private isConfigured: () => boolean;
    private isSelectionMenuEnabled: () => boolean;

    private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    private autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;
    private defaultHighlightColor: HighlightColor = 'yellow'; // Default, should be updated from prefs

    // Bound handlers for cleanup
    private boundMouseUp: ((event: MouseEvent) => void) | null = null;
    private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
    private boundMouseOver: ((event: MouseEvent) => void) | null = null;
    private boundMouseOut: ((event: MouseEvent) => void) | null = null;

    constructor(
        toolbox: HighlightToolbox,
        notePanel: NotePanel,
        getSmartCapture: () => SmartCaptureMode | null,
        isConfigured: () => boolean,
        isSelectionMenuEnabled: () => boolean
    ) {
        this.toolbox = toolbox;
        this.notePanel = notePanel;
        this.getSmartCapture = getSmartCapture;
        this.isConfigured = isConfigured;
        this.isSelectionMenuEnabled = isSelectionMenuEnabled;
    }

    public updateDefaultColor(color: HighlightColor) {
        this.defaultHighlightColor = color;
    }

    public setupGlobalListeners() {
        // Text selection (mouseup)
        this.boundMouseUp = this.handleMouseUp.bind(this);
        document.addEventListener('mouseup', this.boundMouseUp);

        // Keyboard escape
        this.boundKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.toolbox) {
                if (this.toolbox.isCommentDirty()) return;
                this.toolbox.close();
            }
        };
        document.addEventListener('keydown', this.boundKeydown);

        // Hover events
        this.boundMouseOver = this.handleMouseOver.bind(this);
        this.boundMouseOut = this.handleMouseOut.bind(this);
        document.addEventListener('mouseover', this.boundMouseOver);
        document.addEventListener('mouseout', this.boundMouseOut);
    }

    public handleContextMenuHighlight() {
        if (!this.toolbox || !this.isConfigured()) return;

        const selectionInfo = getSelectionInfo();
        if (selectionInfo && selectionInfo.text.length > 0) {
            this.showToolboxForNewSelection(selectionInfo);
        }
    }

    private handleMouseUp(event: MouseEvent) {
        if (!this.toolbox || !this.isConfigured()) return;

        // Don't show new toolbox if note panel has unsaved changes or is open
        if (this.toolbox.isCommentDirty()) return;
        if (this.notePanel && this.notePanel.isOpen()) return;

        // Skip if Smart Capture mode is active
        const sm = this.getSmartCapture();
        if (sm?.isActiveMode()) return;

        const target = event.target as HTMLElement;

        // Ignore clicks on toolbox/note panel hosts
        if (document.getElementById('ext-lw-highlight-toolbox-host')?.contains(target)) return;
        if (document.getElementById('ext-lw-note-panel-host')?.contains(target)) return;

        // Skip if inside Linkwarden format areas - native toolbox handles these
        const sparkFormatArea = document.querySelector('[data-lw-link-id], [data-ext-lw-file-id], #monolith-iframe');
        if (sparkFormatArea && sparkFormatArea.contains(target)) return;

        setTimeout(() => {
            // Check for new text selection FIRST
            const selectionInfo = getSelectionInfo();
            if (selectionInfo && selectionInfo.text.length > 0) {
                if (this.isSelectionMenuEnabled()) {
                    this.showToolboxForNewSelection(selectionInfo);
                }
                return;
            }

            // Check existing highlight (only if highlights are visible)
            if (!document.body.classList.contains('ext-spark-highlights-hidden')) {
                const highlightId = getHighlightIdFromElement(target);
                if (highlightId) {
                    if (this.hoverTimeout) {
                        clearTimeout(this.hoverTimeout);
                        this.hoverTimeout = null;
                    }

                    const existingHighlight = HighlightManager.getHighlights().find(h => h.id === highlightId);
                    if (existingHighlight) {
                        if (this.toolbox.isOpen() && this.toolbox.getCurrentHighlightId() === highlightId) return;
                        this.showToolboxForExistingHighlight(existingHighlight, event);
                    }
                }
            }
        }, 10);
    }

    private handleMouseOver(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const highlightId = getHighlightIdFromElement(target);

        // Auto-close logic
        const isInsideToolboxHost = target.closest('#ext-lw-highlight-toolbox-host');
        const isInsideHighlight = highlightId !== null;

        if (isInsideToolboxHost || isInsideHighlight) {
            if (this.autoCloseTimeout) {
                clearTimeout(this.autoCloseTimeout);
                this.autoCloseTimeout = null;
            }
        } else {
            if (this.toolbox?.isOpen() && !this.toolbox.isCommentMode() && !this.toolbox.isBeingDragged() && this.toolbox.getCurrentHighlightId() !== null) {
                if (!this.autoCloseTimeout) {
                    this.autoCloseTimeout = setTimeout(() => {
                        if (this.toolbox?.isOpen() && !this.toolbox.isCommentMode()) {
                            this.toolbox.close();
                        }
                        this.autoCloseTimeout = null;
                    }, 1000);
                }
            }
        }

        // Hover highlight logic
        if (highlightId && this.isConfigured()) {
            if (document.body.classList.contains('ext-spark-highlights-hidden')) return;
            if (this.getSmartCapture()?.isActiveMode()) return;
            if (this.toolbox.isCommentDirty()) return;
            if (this.toolbox.isOpen() && this.toolbox.getCurrentHighlightId() === highlightId) return;

            if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
            this.hoverTimeout = setTimeout(() => {
                const highlight = HighlightManager.getHighlights().find(h => h.id === highlightId);
                if (highlight) {
                    if (this.toolbox.isOpen() && this.toolbox.getCurrentHighlightId() === highlightId) return;
                    this.showToolboxForExistingHighlight(highlight, event);
                }
            }, 1000);
        }
    }

    private handleMouseOut(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const highlightId = getHighlightIdFromElement(target);
        if (highlightId && this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
    }

    private showToolboxForNewSelection(selectionInfo: NonNullable<ReturnType<typeof getSelectionInfo>>) {
        if (!this.toolbox) return;

        const position = {
            x: selectionInfo.rect.left + window.scrollX + selectionInfo.rect.width / 2,
            y: selectionInfo.rect.top + window.scrollY,
        };

        const highlightsInSelection = this.getHighlightsInSelection();

        this.toolbox.show(position, {
            onColorSelect: async (color: HighlightColor) => {
                await HighlightManager.createHighlight(selectionInfo, color);
            },
            onCommentSave: async (comment: string, color?: HighlightColor) => {

                await HighlightManager.createHighlight(selectionInfo, color || this.defaultHighlightColor, comment);
            },
            onDelete: async () => {
                if (highlightsInSelection.length > 0) {
                    if (confirm(`Delete ${highlightsInSelection.length} highlight${highlightsInSelection.length > 1 ? 's' : ''}?`)) {
                        for (const id of highlightsInSelection) {
                            await HighlightManager.deleteHighlight(id);
                        }
                    }
                }
            },
            onClip: (_selectionRect, _selectionText) => {

                if (selectionInfo.rect && selectionInfo.text) {
                    SmartCaptureHandlers.handleClip({
                        type: 'TEXT_BLOCK',
                        rect: selectionInfo.rect,
                        title: selectionInfo.text,
                        extracted: { text: selectionInfo.text },
                        pageContext: {
                            pageUrl: window.location.href,
                            pageTitle: document.title,
                            capturedAt: Date.now()
                        }
                    });
                }
            },
            onSmartCapture: () => {
                this.getSmartCapture()?.activate();
            },
            onSaveLink: async (url: string) => {
                await this.saveLinksWithNotification([url]);
            },
            onSaveAllLinks: async (urls: string[]) => {
                await this.saveLinksWithNotification(urls);
            },
            onOpenNotePanel: (targetRect, selectedColor) => {
                if (this.notePanel) {
                    this.notePanel.show(
                        {
                            x: (targetRect?.left || position.x) + (targetRect?.width || 0) / 2 + window.scrollX,
                            y: (targetRect?.bottom || position.y) + window.scrollY + 10
                        },
                        {
                            onSave: async (comment: string, color: HighlightColor) => {
                                await HighlightManager.createHighlight(selectionInfo, color, comment);
                            },
                            onCancel: () => { },
                            onClose: () => { }
                        },
                        '',
                        selectedColor,
                        targetRect
                    );
                }
            },
            onClose: () => { window.getSelection()?.removeAllRanges(); },
        }, null, false, selectionInfo.rect, undefined, highlightsInSelection, this.defaultHighlightColor);
    }

    private showToolboxForExistingHighlight(highlight: Highlight, event: MouseEvent) {
        if (!this.toolbox) return;

        // Get all highlight spans for this highlight ID
        const extSpans = document.querySelectorAll(`[data-ext-lw-highlight-id="${highlight.id}"]`);
        const appSpans = document.querySelectorAll(`[data-highlight-id="${highlight.id}"]`);
        const allSpans = [...Array.from(extSpans), ...Array.from(appSpans)];

        // Calculate combined bounding rect of all spans
        let highlightRect: DOMRect | null = null;

        if (allSpans.length > 0) {
            let minLeft = Infinity, minTop = Infinity;
            let maxRight = -Infinity, maxBottom = -Infinity;

            for (const span of allSpans) {
                const rect = span.getBoundingClientRect();
                minLeft = Math.min(minLeft, rect.left);
                minTop = Math.min(minTop, rect.top);
                maxRight = Math.max(maxRight, rect.right);
                maxBottom = Math.max(maxBottom, rect.bottom);
            }

            highlightRect = new DOMRect(minLeft, minTop, maxRight - minLeft, maxBottom - minTop);
        }

        // Use highlight center if we have a rect, otherwise fallback to cursor
        const position = highlightRect
            ? {
                x: highlightRect.left + window.scrollX + highlightRect.width / 2,
                y: highlightRect.top + window.scrollY
            }
            : { x: event.clientX + window.scrollX, y: event.clientY + window.scrollY };

        const highlightLinks = this.extractLinksFromHighlight(highlight.id);

        this.toolbox.show(position, {
            onColorSelect: async (color) => HighlightManager.updateHighlight(highlight, color),
            onCommentSave: async (comment, color) => {

                await HighlightManager.updateHighlight(highlight, color || highlight.color as HighlightColor, comment);
            },
            onDelete: async () => HighlightManager.deleteHighlight(highlight.id),
            onClip: () => {

                SmartCaptureHandlers.handleClip({
                    type: 'TEXT_BLOCK',
                    rect: (event.target as HTMLElement).getBoundingClientRect(),
                    title: highlight.text || '',
                    extracted: { text: highlight.text || '' },
                    pageContext: {
                        pageUrl: window.location.href,
                        pageTitle: document.title,
                        capturedAt: Date.now()
                    }
                });
            },
            onSmartCapture: () => this.getSmartCapture()?.activate(),
            onSaveLink: async (url: string) => {
                await this.saveLinksWithNotification([url]);
            },
            onSaveAllLinks: async (urls: string[]) => {
                await this.saveLinksWithNotification(urls);
            },
            onOpenNotePanel: (targetRect, selectedColor) => {
                if (this.notePanel) {
                    this.notePanel.show(
                        { x: (targetRect?.left || position.x) + (targetRect?.width || 0) / 2 + window.scrollX, y: (targetRect?.bottom || position.y) + window.scrollY + 10 },
                        {
                            onSave: async (c, color) => HighlightManager.updateHighlight(highlight, color, c),
                            onCancel: () => { },
                            onClose: () => { }
                        },
                        highlight.comment || '',
                        selectedColor,
                        targetRect
                    );
                }
            },
            onClose: () => { },
        }, highlight, false, highlightRect || undefined, highlightLinks, undefined, this.defaultHighlightColor);
    }

    private getHighlightsInSelection(): number[] {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return [];
        const range = selection.getRangeAt(0);
        const highlightIds = new Set<number>();

        // Check extension highlights
        document.querySelectorAll('[data-ext-lw-highlight-id]').forEach(span => {
            if (range.intersectsNode(span)) {
                const idStr = (span as HTMLElement).dataset.extLwHighlightId;
                if (idStr) highlightIds.add(parseInt(idStr));
            }
        });

        // Check main app highlights (for Linkwarden readable view)
        document.querySelectorAll('[data-highlight-id]').forEach(span => {
            if (range.intersectsNode(span)) {
                const idStr = (span as HTMLElement).dataset.highlightId;
                if (idStr) highlightIds.add(parseInt(idStr));
            }
        });

        return Array.from(highlightIds);
    }

    private extractLinksFromHighlight(highlightId: number) {
        // Logic from original contentScript
        const linksMap = new Map<string, { url: string; label: string }>();

        // Check extension highlights
        const extSpans = document.querySelectorAll(`[data-ext-lw-highlight-id="${highlightId}"]`);
        // Check main app highlights
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

    /**
     * Save one or more URLs and show toast notification
     */
    private async saveLinksWithNotification(urls: string[]): Promise<void> {
        if (urls.length === 0) return;

        const savedLinks: ToastLinkData[] = [];

        for (const url of urls) {
            try {
                const response = await sendMessage<{
                    link: {
                        id: number;
                        url: string;
                        name: string;
                        createdAt?: string;
                        collection?: { name: string; color?: string; icon?: string };
                    };
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
            } catch (error) {

            }
        }

        // Show notification for all successfully saved links
        if (savedLinks.length > 0) {
            showSaveNotification(savedLinks);
        }
    }

    /**
     * Cleanup all listeners and timers
     */
    public destroy(): void {
        // Clear timeouts
        if (this.hoverTimeout) {
            clearTimeout(this.hoverTimeout);
            this.hoverTimeout = null;
        }
        if (this.autoCloseTimeout) {
            clearTimeout(this.autoCloseTimeout);
            this.autoCloseTimeout = null;
        }

        // Remove event listeners
        if (this.boundMouseUp) {
            document.removeEventListener('mouseup', this.boundMouseUp);
            this.boundMouseUp = null;
        }
        if (this.boundKeydown) {
            document.removeEventListener('keydown', this.boundKeydown);
            this.boundKeydown = null;
        }
        if (this.boundMouseOver) {
            document.removeEventListener('mouseover', this.boundMouseOver);
            this.boundMouseOver = null;
        }
        if (this.boundMouseOut) {
            document.removeEventListener('mouseout', this.boundMouseOut);
            this.boundMouseOut = null;
        }

        // Destroy child components
        if (this.toolbox) {
            this.toolbox.destroy();
        }
        if (this.notePanel) {
            this.notePanel.destroy();
        }
    }
}
