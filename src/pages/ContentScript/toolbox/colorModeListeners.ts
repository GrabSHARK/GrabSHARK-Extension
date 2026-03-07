/**
 * HighlightToolbox Color Mode Listeners
 * Extracted from HighlightToolbox.attachColorModeListeners()
 */

import { HighlightColor } from '../../../@/lib/types/highlight';
import type { ToolboxCallbacks } from '../HighlightToolbox';
import type { ToolboxState } from '../HighlightToolboxRenderer';

export interface ColorModeContext {
    container: HTMLDivElement;
    state: ToolboxState;
    callbacks: ToolboxCallbacks | null;
    setLoading: (loading: boolean) => void;
    setSuccess: () => void;
    close: () => void;
    targetRect: DOMRect | null | undefined;
    onOpenNotePanel?: (targetRect: DOMRect | null, selectedColor: HighlightColor) => void;
    setCommentMode: (value: boolean) => void;
    render: () => void;
}

export function attachColorModeListeners(ctx: ColorModeContext): void {
    const { container, state, callbacks } = ctx;

    // Quick Color trigger
    container.querySelector('[data-action="quick-color"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Dropdown Colors
    container.querySelectorAll('.ext-lw-dock-color-dropdown .ext-lw-color-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const color = (btn as HTMLElement).dataset.color as HighlightColor;
            if (color && callbacks) {
                ctx.setLoading(true);
                try {
                    await callbacks.onColorSelect(color);
                    ctx.setSuccess();
                } catch (error) {
                    ctx.setLoading(false);
                }
            }
        });
    });

    // Comment button
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

    // Highlight Button
    container.querySelector('[data-action="highlight"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const color = state.selectedColor;
        if (callbacks) {
            ctx.setLoading(true);
            try {
                await callbacks.onColorSelect(color);
                ctx.setSuccess();
            } catch (error) {
                ctx.setLoading(false);
            }
        }
    });

    // Delete button
    container.querySelector('[data-action="delete"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (callbacks) {
            ctx.setLoading(true);
            try {
                await callbacks.onDelete();
                ctx.setSuccess();
            } catch (error) {
                ctx.setLoading(false);
            }
        }
    });

    // Clip button
    container.querySelector('[data-action="clip"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onClip) {
            const selection = window.getSelection();
            let selectionRect: DOMRect | null = null;
            let selectionText = '';
            if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                selectionRect = range.getBoundingClientRect();
                selectionText = selection.toString();
            }
            ctx.setLoading(true);
            callbacks.onClip(selectionRect, selectionText);
            ctx.setSuccess();
        }
    });

    // Copy text button
    container.querySelector('[data-action="copy-text"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.existingHighlight?.text) {
            navigator.clipboard.writeText(state.existingHighlight.text).catch(() => { });
        }
    });

    // Smart Capture button
    container.querySelector('[data-action="smart-capture"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onSmartCapture) {
            ctx.close();
            callbacks.onSmartCapture();
        }
    });

    // Link Save button
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

    // Individual link items
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

    // Save all links
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
