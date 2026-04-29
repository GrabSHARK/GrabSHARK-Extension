/**
 * HighlightToolbox Color Mode Listeners
 * Extracted from HighlightToolbox.attachColorModeListeners()
 */

import { HighlightColor } from '../../../@/lib/types/highlight';
import type { ToolboxCallbacks } from '../HighlightToolbox';
import type { SuccessButtonAction, ToolboxState } from '../HighlightToolboxRenderer';

export interface ColorModeContext {
    container: HTMLDivElement;
    state: ToolboxState;
    callbacks: ToolboxCallbacks | null;
    /** Legacy global feedback — kept for save-link / save-all (no per-button tick yet). */
    setLoading: (loading: boolean) => void;
    setSuccess: () => void;
    /** Inline-tick success state for clip / copy / highlight / erase. */
    setSuccessButton: (action: SuccessButtonAction | null) => void;
    /** Hover-aware deferred close for clip / copy. */
    scheduleSuccessClose: (delay: number) => void;
    isHoveringToolbox: () => boolean;
    close: () => void;
    targetRect: DOMRect | null | undefined;
    onOpenNotePanel?: (targetRect: DOMRect | null, selectedColor: HighlightColor) => void;
    setCommentMode: (value: boolean) => void;
    render: () => void;
}

const HOVER_AWARE_HOLD_MS = 950;

export function attachColorModeListeners(ctx: ColorModeContext): void {
    const { container, state, callbacks } = ctx;
    const success = state.successButton;

    // Quick Color trigger
    container.querySelector('[data-action="quick-color"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown Colors — no feedback, fire mutation + close immediately. Optimistic UI in parent
    // handles the visual update; a fresh toolbox reopens with the new highlight (eraser slot).
    container.querySelectorAll('.ext-lw-dock-color-dropdown .ext-lw-color-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = (btn as HTMLElement).dataset.color as HighlightColor;
            if (color && callbacks) {
                Promise.resolve(callbacks.onColorSelect(color)).catch(() => { });
                ctx.close();
            }
        });
    });

    // Comment button — opens NotePanel via callback or toggles inline comment mode.
    // Stays open in either case; not a success-tick action.
    container.querySelector('[data-action="comment"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onOpenNotePanel) {
            callbacks.onOpenNotePanel(
                ctx.targetRect || container.getBoundingClientRect() || null,
                state.selectedColor
            );
            ctx.close();
        } else {
            ctx.setCommentMode(true);
            ctx.render();
        }
    });

    // Highlight Button — inline tick + immediate close. Parent reopens with eraser via the
    // new highlight; tick stays visible during the exit animation.
    container.querySelector('[data-action="highlight"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (success === 'highlight') return;
        const color = state.selectedColor;
        if (callbacks) {
            ctx.setSuccessButton('highlight');
            Promise.resolve(callbacks.onColorSelect(color)).catch(() => { });
            ctx.close();
        }
    });

    // Delete button — inline tick + immediate close. No reopen expected (highlight is gone).
    container.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (success === 'erase') return;
        if (callbacks) {
            ctx.setSuccessButton('erase');
            Promise.resolve(callbacks.onDelete()).catch(() => { });
            ctx.close();
        }
    });

    // Clip button — inline tick + hover-aware close. Tick lingers while user hovers.
    container.querySelector('[data-action="clip"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (success === 'clip') return;
        if (callbacks?.onClip) {
            const selection = window.getSelection();
            let selectionRect: DOMRect | null = null;
            let selectionText = '';
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                selectionRect = range.getBoundingClientRect();
                selectionText = selection.toString();
            }
            callbacks.onClip(selectionRect, selectionText);
            ctx.setSuccessButton('clip');
            if (!ctx.isHoveringToolbox()) {
                ctx.scheduleSuccessClose(HOVER_AWARE_HOLD_MS);
            }
        }
    });

    // Copy text button — inline tick + hover-aware close.
    container.querySelector('[data-action="copy-text"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (success === 'copy') return;
        const text = state.existingHighlight?.text;
        if (text) {
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(text).catch(() => { });
            } else {
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-9999px';
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                } catch {
                    // best-effort copy
                }
            }
        }
        // Hover-aware close to match clip + web-app HighlightToolbox parity.
        // Tick lingers while user hovers; auto-closes 950ms after they leave.
        ctx.setSuccessButton('copy');
        if (!ctx.isHoveringToolbox()) {
            ctx.scheduleSuccessClose(HOVER_AWARE_HOLD_MS);
        }
    });

    // Smart Capture button — close + delegate (legacy pattern, no tick)
    container.querySelector('[data-action="smart-capture"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onSmartCapture) {
            ctx.close();
            callbacks.onSmartCapture();
        }
    });

    // Link Save button — keeps legacy global feedback (setLoading + setSuccess) for now.
    container.querySelector('[data-action="save-link"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (state.detectedLinks.length === 1) {
            if (callbacks?.onSaveLink) {
                ctx.setLoading(true);
                try {
                    await callbacks.onSaveLink(state.detectedLinks[0].url);
                    ctx.setSuccess();
                } catch (error) {
                    ctx.setLoading(false);
                }
            }
        } else {
            state.isLinkMenuOpen = !state.isLinkMenuOpen;
            const dropdownOuter = container.querySelector('.ext-lw-link-dropdown-outer') as HTMLElement;
            if (dropdownOuter) {
                dropdownOuter.classList.toggle('ext-lw-link-dropdown-hidden', !state.isLinkMenuOpen);
                dropdownOuter.style.display = state.isLinkMenuOpen ? 'flex' : 'none';
            }
            container.classList.toggle('ext-lw-link-menu-open', state.isLinkMenuOpen);
        }
    });

    // Individual link items — legacy
    container.querySelectorAll('.ext-lw-link-item').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const url = (btn as HTMLElement).dataset.url;
            if (url && callbacks?.onSaveLink) {
                ctx.setLoading(true);
                try {
                    await callbacks.onSaveLink(url);
                    ctx.setSuccess();
                } catch (error) {
                    ctx.setLoading(false);
                }
            }
        });
    });

    // Save all links — legacy
    container.querySelector('[data-action="save-all-links"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (callbacks?.onSaveAllLinks && state.detectedLinks.length > 0) {
            ctx.setLoading(true);
            try {
                await callbacks.onSaveAllLinks(state.detectedLinks.map(l => l.url));
                ctx.setSuccess();
            } catch (error) {
                ctx.setLoading(false);
            }
        }
    });
}
