/**
 * HighlightToolbox Comment Mode Listeners
 * Extracted from HighlightToolbox.attachCommentModeListeners()
 */

import { HighlightColor } from '../../../@/lib/types/highlight';
import type { ToolboxCallbacks } from '../HighlightToolbox';
import type { ToolboxState } from '../HighlightToolboxRenderer';
import { ICONS } from '../HighlightToolboxRenderer';

export interface CommentModeContext {
    container: HTMLDivElement;
    state: ToolboxState;
    callbacks: ToolboxCallbacks | null;
    commentValue: string;
    setCommentValue: (val: string) => void;
    isPinned: boolean;
    setIsPinned: (val: boolean) => void;
    isDragging: boolean;
    setIsDragging: (val: boolean) => void;
    hasManualPosition: boolean;
    setHasManualPosition: (val: boolean) => void;
    isCommentDirty: () => boolean;
    setLoading: (loading: boolean) => void;
    setSuccess: () => void;
    setCommentMode: (value: boolean) => void;
    render: () => void;
    renderCommentMode: () => void;
}

export function attachCommentModeListeners(ctx: CommentModeContext): void {
    const { container, state, callbacks } = ctx;

    // Drag functionality
    let initialMouseX = 0;
    let initialMouseY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const startDrag = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.tagName === 'INPUT' ||
            target.closest('button') || target.closest('textarea')) {
            return;
        }

        e.preventDefault();
        ctx.setIsDragging(true);

        initialMouseX = e.clientX;
        initialMouseY = e.clientY;

        const rect = container.getBoundingClientRect();
        const style = getComputedStyle(container);
        initialLeft = parseFloat(style.left) || rect.left;
        initialTop = parseFloat(style.top) || rect.top;

        container.classList.add('ext-lw-dragging');
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('wheel', preventScroll, { passive: false });
    };

    const handleDrag = (e: MouseEvent) => {
        if (!ctx.isDragging) return;
        e.preventDefault();
        const deltaX = e.clientX - initialMouseX;
        const deltaY = e.clientY - initialMouseY;
        container.style.left = `${initialLeft + deltaX}px`;
        container.style.top = `${initialTop + deltaY}px`;
    };

    const preventScroll = (e: WheelEvent) => {
        if (ctx.isDragging) e.preventDefault();
    };

    const stopDrag = () => {
        if (ctx.isDragging) {
            ctx.setIsDragging(false);
            container.classList.remove('ext-lw-dragging');
            document.removeEventListener('mousemove', handleDrag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('wheel', preventScroll);
            ctx.setHasManualPosition(true);
        }
    };

    container.addEventListener('mousedown', startDrag);

    // Color selection in note mode
    container.querySelectorAll('[data-note-color]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = (btn as HTMLElement).dataset.noteColor as HighlightColor;
            if (color) {
                state.selectedColor = color;
                ctx.renderCommentMode();
                const textarea = container.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.value = ctx.commentValue;
                    textarea.focus();
                    textarea.selectionStart = textarea.value.length;
                }
            }
        });
    });

    // Textarea input
    const textarea = container.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;
    textarea?.addEventListener('input', (e) => {
        ctx.setCommentValue((e.target as HTMLTextAreaElement).value);
    });

    // Keyboard shortcuts
    textarea?.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (ctx.isCommentDirty()) return;
            ctx.setCommentMode(false);
            ctx.setCommentValue(state.existingHighlight?.comment || '');
            ctx.render();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.stopPropagation();
            if (callbacks) {
                ctx.setLoading(true);
                try {
                    await callbacks.onCommentSave(ctx.commentValue, state.selectedColor);
                    ctx.setSuccess();
                } catch (error) {
                    ctx.setLoading(false);
                }
            }
        }
    });

    // Pin button
    container.querySelector('[data-action="toggle-pin"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.setIsPinned(!ctx.isPinned);
        const pinBtn = container.querySelector('[data-action="toggle-pin"]') as HTMLButtonElement;
        if (pinBtn) {
            pinBtn.classList.toggle('ext-lw-pinned', ctx.isPinned);
            pinBtn.innerHTML = ctx.isPinned ? ICONS.pinFill : ICONS.pin;
            pinBtn.title = ctx.isPinned ? 'Unpin panel' : 'Pin panel (prevent auto-close)';
        }
    });

    // Cancel button
    container.querySelector('[data-action="cancel-comment"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks?.onCancelComment) {
            callbacks.onCancelComment();
            return;
        }
        ctx.setIsPinned(false);
        ctx.setCommentMode(false);
        ctx.setCommentValue(state.existingHighlight?.comment || '');
        ctx.render();
    });

    // Save button
    container.querySelector('[data-action="save-comment"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (callbacks) {
            ctx.setLoading(true);
            try {
                await callbacks.onCommentSave(ctx.commentValue, state.selectedColor);
                ctx.setSuccess();
            } catch (error) {
                ctx.setLoading(false);
            }
        }
    });
}
