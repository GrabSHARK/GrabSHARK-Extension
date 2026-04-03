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

const EXTENSION_MARKER_ID = 'grabshark-extension-installed';

function setDebugState(state: Record<string, string | number | boolean | null | undefined>): void {
    const marker = document.getElementById(EXTENSION_MARKER_ID);
    if (!marker) return;
    Object.entries(state).forEach(([key, value]) => {
        const attr = `data-${key}`;
        if (value === null || typeof value === 'undefined') marker.removeAttribute(attr);
        else marker.setAttribute(attr, String(value));
    });
}

export class InteractionManager {
    private toolbox: HighlightToolbox;
    private notePanel: NotePanel;
    private getSmartCapture: () => SmartCaptureMode | null;
    private isConfigured: () => boolean;
    private isSelectionMenuEnabled: () => boolean;

    private hoverTimeout: ReturnType<typeof setTimeout> | null = null;
    private autoCloseTimeout: ReturnType<typeof setTimeout> | null = null;
    private selectionChangeTimeout: ReturnType<typeof setTimeout> | null = null;
    private defaultHighlightColor: HighlightColor = 'yellow';
    private isPointerSelecting = false;

    private boundMouseDown: ((event: MouseEvent) => void) | null = null;
    private boundMouseUp: ((event: MouseEvent) => void) | null = null;
    private boundKeydown: ((e: KeyboardEvent) => void) | null = null;
    private boundMouseOver: ((event: MouseEvent) => void) | null = null;
    private boundMouseOut: ((event: MouseEvent) => void) | null = null;
    private boundSelectionChange: (() => void) | null = null;

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
        setDebugState({ interactionStage: 'setup-listeners' });
        this.boundMouseDown = this.handleMouseDown.bind(this);
        document.addEventListener('mousedown', this.boundMouseDown);

        this.boundMouseUp = this.handleMouseUp.bind(this);
        document.addEventListener('mouseup', this.boundMouseUp);

        this.boundSelectionChange = this.handleSelectionChange.bind(this);
        document.addEventListener('selectionchange', this.boundSelectionChange);

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

    private shouldIgnoreSelectionTarget(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null;
        if (!element) return false;
        if (document.getElementById('ext-lw-highlight-toolbox-host')?.contains(element)) return true;
        if (document.getElementById('ext-lw-note-panel-host')?.contains(element)) return true;

        const grabsharkFormatArea = document.querySelector('[data-lw-link-id], [data-ext-lw-file-id], #monolith-iframe');
        if (grabsharkFormatArea && grabsharkFormatArea.contains(element)) return true;

        return false;
    }

    private maybeShowSelectionToolbox(): boolean {
        if (!this.toolbox || !this.isConfigured()) {
            setDebugState({ interactionStage: 'blocked-not-configured' });
            return false;
        }
        if (!this.isSelectionMenuEnabled()) {
            setDebugState({ interactionStage: 'blocked-selection-menu-disabled' });
            return false;
        }
        if (this.toolbox.isCommentDirty()) {
            setDebugState({ interactionStage: 'blocked-comment-dirty' });
            return false;
        }
        if (this.notePanel?.isOpen()) {
            setDebugState({ interactionStage: 'blocked-note-panel-open' });
            return false;
        }
        if (this.getSmartCapture()?.isActiveMode()) {
            setDebugState({ interactionStage: 'blocked-smart-capture-active' });
            return false;
        }

        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement && (activeElement.isContentEditable || ['INPUT', 'TEXTAREA'].includes(activeElement.tagName))) {
            setDebugState({ interactionStage: 'blocked-editable-focused', activeTag: activeElement.tagName });
            return false;
        }

        const selectionInfo = getSelectionInfo();
        if (!selectionInfo || selectionInfo.text.length === 0) {
            setDebugState({ interactionStage: 'blocked-no-selection-info' });
            return false;
        }

        setDebugState({ interactionStage: 'showing-selection-toolbox', selectionText: selectionInfo.text.slice(0, 120), selectionWidth: selectionInfo.rect.width, selectionHeight: selectionInfo.rect.height });
        this.callShowForNew(selectionInfo);
        return true;
    }

    private handleSelectionChange() {
        if (this.selectionChangeTimeout) {
            clearTimeout(this.selectionChangeTimeout);
        }

        setDebugState({
            interactionStage: this.isPointerSelecting ? 'selectionchange-pointer-active' : 'selectionchange-fired',
            selectedTextLength: window.getSelection()?.toString().trim().length ?? 0,
        });

        if (this.isPointerSelecting) {
            return;
        }

        this.selectionChangeTimeout = setTimeout(() => {
            this.selectionChangeTimeout = null;
            this.maybeShowSelectionToolbox();
        }, 80);
    }

    private handleMouseDown(event: MouseEvent) {
        if (event.button !== 0) {
            return;
        }

        const target = event.target as HTMLElement | null;
        if (this.shouldIgnoreSelectionTarget(target)) {
            return;
        }

        this.isPointerSelecting = true;
        setDebugState({ interactionStage: 'mousedown-selection-started', mousedownTag: target?.tagName ?? '' });
    }

    private handleMouseUp(event: MouseEvent) {
        this.isPointerSelecting = false;
        setDebugState({ interactionStage: 'mouseup-fired', mouseupTag: (event.target as HTMLElement | null)?.tagName ?? '', mouseupButton: event.button });
        if (!this.toolbox || !this.isConfigured()) return;
        if (this.toolbox.isCommentDirty()) return;
        if (this.notePanel?.isOpen()) return;
        if (this.getSmartCapture()?.isActiveMode()) return;

        const target = event.target as HTMLElement;
        if (this.shouldIgnoreSelectionTarget(target)) return;

        setTimeout(() => {
            if (this.maybeShowSelectionToolbox()) {
                return;
            }

            if (!document.body.classList.contains('ext-grabshark-highlights-hidden')) {
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
            if (document.body.classList.contains('ext-grabshark-highlights-hidden')) return;
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
        if (this.selectionChangeTimeout) { clearTimeout(this.selectionChangeTimeout); this.selectionChangeTimeout = null; }
        if (this.boundMouseDown) { document.removeEventListener('mousedown', this.boundMouseDown); this.boundMouseDown = null; }
        if (this.boundMouseUp) { document.removeEventListener('mouseup', this.boundMouseUp); this.boundMouseUp = null; }
        if (this.boundSelectionChange) { document.removeEventListener('selectionchange', this.boundSelectionChange); this.boundSelectionChange = null; }
        if (this.boundKeydown) { document.removeEventListener('keydown', this.boundKeydown); this.boundKeydown = null; }
        if (this.boundMouseOver) { document.removeEventListener('mouseover', this.boundMouseOver); this.boundMouseOver = null; }
        if (this.boundMouseOut) { document.removeEventListener('mouseout', this.boundMouseOut); this.boundMouseOut = null; }
        this.toolbox?.destroy();
        this.notePanel?.destroy();
    }
}
