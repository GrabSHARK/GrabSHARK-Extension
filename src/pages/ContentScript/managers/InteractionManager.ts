/**
 * InteractionManager - Orchestrates text selection and highlight interactions
 * Delegates toolbox callback creation to toolboxCallbacks.ts
 */

import { HighlightToolbox } from '../HighlightToolbox';
import { NotePanel } from '../NotePanel';
import { SmartCaptureMode } from '../SmartCapture';
import { HighlightColor } from '../../../@/lib/types/highlight';
import { HighlightManager } from './HighlightManager';
import { getSelectionInfo, getHighlightIdFromElement } from '../highlightRenderer';
import { showToolboxForNewSelection, showToolboxForExistingHighlight } from './toolboxCallbacks';

export class InteractionManager {
    private toolbox: HighlightToolbox;
    private notePanel: NotePanel;
    private getSmartCapture: () => SmartCaptureMode | null;
    private isConfigured: () => boolean;
    private isSelectionMenuEnabled: () => boolean;

    private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    private autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;
    private defaultHighlightColor: HighlightColor = 'yellow';

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

    public updateDefaultColor(color: HighlightColor) { this.defaultHighlightColor = color; }

    public setupGlobalListeners() {
        this.boundMouseUp = this.handleMouseUp.bind(this);
        document.addEventListener('mouseup', this.boundMouseUp);

        this.boundKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.toolbox) {
                if (this.toolbox.isCommentDirty()) return;
                this.toolbox.close();
            }
        };
        document.addEventListener('keydown', this.boundKeydown);

        this.boundMouseOver = this.handleMouseOver.bind(this);
        this.boundMouseOut = this.handleMouseOut.bind(this);
        document.addEventListener('mouseover', this.boundMouseOver);
        document.addEventListener('mouseout', this.boundMouseOut);
    }

    public handleContextMenuHighlight() {
        if (!this.toolbox || !this.isConfigured()) return;
        const selectionInfo = getSelectionInfo();
        if (selectionInfo && selectionInfo.text.length > 0) {
            this.callShowForNew(selectionInfo);
        }
    }

    private get toolboxContext() {
        return {
            toolbox: this.toolbox,
            notePanel: this.notePanel,
            getSmartCapture: this.getSmartCapture,
            defaultHighlightColor: this.defaultHighlightColor,
        };
    }

    private callShowForNew(selectionInfo: NonNullable<ReturnType<typeof getSelectionInfo>>) {
        showToolboxForNewSelection(this.toolboxContext, selectionInfo);
    }

    private handleMouseUp(event: MouseEvent) {
        if (!this.toolbox || !this.isConfigured()) return;
        if (this.toolbox.isCommentDirty()) return;
        if (this.notePanel?.isOpen()) return;
        if (this.getSmartCapture()?.isActiveMode()) return;

        const target = event.target as HTMLElement;
        if (document.getElementById('ext-lw-highlight-toolbox-host')?.contains(target)) return;
        if (document.getElementById('ext-lw-note-panel-host')?.contains(target)) return;

        const sparkFormatArea = document.querySelector('[data-lw-link-id], [data-ext-lw-file-id], #monolith-iframe');
        if (sparkFormatArea && sparkFormatArea.contains(target)) return;

        setTimeout(() => {
            const selectionInfo = getSelectionInfo();
            if (selectionInfo && selectionInfo.text.length > 0) {
                if (this.isSelectionMenuEnabled()) this.callShowForNew(selectionInfo);
                return;
            }

            if (!document.body.classList.contains('ext-spark-highlights-hidden')) {
                const highlightId = getHighlightIdFromElement(target);
                if (highlightId) {
                    if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
                    const existing = HighlightManager.getHighlights().find(h => h.id === highlightId);
                    if (existing) {
                        if (this.toolbox.isOpen() && this.toolbox.getCurrentHighlightId() === highlightId) return;
                        showToolboxForExistingHighlight(this.toolboxContext, existing, event);
                    }
                }
            }
        }, 10);
    }

    private handleMouseOver(event: MouseEvent) {
        const target = event.target as HTMLElement;
        const highlightId = getHighlightIdFromElement(target);

        const isInsideToolboxHost = target.closest('#ext-lw-highlight-toolbox-host');
        const isInsideHighlight = highlightId !== null;

        if (isInsideToolboxHost || isInsideHighlight) {
            if (this.autoCloseTimeout) { clearTimeout(this.autoCloseTimeout); this.autoCloseTimeout = null; }
        } else {
            if (this.toolbox?.isOpen() && !this.toolbox.isCommentMode() && !this.toolbox.isBeingDragged() && this.toolbox.getCurrentHighlightId() !== null) {
                if (!this.autoCloseTimeout) {
                    this.autoCloseTimeout = setTimeout(() => {
                        if (this.toolbox?.isOpen() && !this.toolbox.isCommentMode()) this.toolbox.close();
                        this.autoCloseTimeout = null;
                    }, 1000);
                }
            }
        }

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
                    showToolboxForExistingHighlight(this.toolboxContext, highlight, event);
                }
            }, 1000);
        }
    }

    private handleMouseOut(event: MouseEvent) {
        const highlightId = getHighlightIdFromElement(event.target as HTMLElement);
        if (highlightId && this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
    }

    public destroy(): void {
        if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
        if (this.autoCloseTimeout) { clearTimeout(this.autoCloseTimeout); this.autoCloseTimeout = null; }
        if (this.boundMouseUp) { document.removeEventListener('mouseup', this.boundMouseUp); this.boundMouseUp = null; }
        if (this.boundKeydown) { document.removeEventListener('keydown', this.boundKeydown); this.boundKeydown = null; }
        if (this.boundMouseOver) { document.removeEventListener('mouseover', this.boundMouseOver); this.boundMouseOver = null; }
        if (this.boundMouseOut) { document.removeEventListener('mouseout', this.boundMouseOut); this.boundMouseOut = null; }
        this.toolbox?.destroy();
        this.notePanel?.destroy();
    }
}
