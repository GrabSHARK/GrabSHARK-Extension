/**
 * NotePanel Renderer - HTML rendering, event attachment, and drag handling
 * Extracted from NotePanel class
 */

import { HighlightColor, HIGHLIGHT_COLORS } from '../../@/lib/types/highlight';
import i18n from '../../@/lib/i18n';

/** Pin icons */
export const PIN_ICONS = {
    pin: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-pin-angle" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146m.122 2.112v-.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a5 5 0 0 0-.288-.076 5 5 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a5 5 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034q.172.002.343-.04L9.927 2.028q-.042.172-.04.343a1.8 1.8 0 0 0 .062.46z"/>
</svg>`,
    pinFill: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-pin-angle-fill" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
</svg>`
};

export interface NotePanelState {
    isOpen: boolean;
    position: { x: number; y: number };
    commentValue: string;
    selectedColor: HighlightColor;
    targetRect: DOMRect | null;
    isPinned: boolean;
}

/**
 * Generate note panel HTML
 */
export function renderNotePanelHTML(state: NotePanelState): string {
    const colorsHtml = HIGHLIGHT_COLORS.map(color => {
        const isActive = color === state.selectedColor;
        return `<button class="ext-lw-color-btn ext-lw-color-btn-${color} ${isActive ? 'ext-lw-color-btn-active' : ''}" data-note-color="${color}"></button>`;
    }).join('');

    return `
        <div class="ext-lw-note-outer">
            <div class="ext-lw-note-inner">
                <textarea class="ext-lw-capture-note-textarea" placeholder="${i18n.t('notePanel.placeholder')}">${state.commentValue}</textarea>
                <div class="ext-lw-capture-note-actions">
                    <div class="ext-lw-note-color-picker">
                        <div class="ext-lw-note-colors-wrapper">
                            ${colorsHtml}
                        </div>
                        <button class="ext-lw-pin-btn ${state.isPinned ? 'ext-lw-pinned' : ''}" data-action="toggle-pin" title="${i18n.t('notePanel.pin')}">
                            ${state.isPinned ? PIN_ICONS.pinFill : PIN_ICONS.pin}
                        </button>
                    </div>
                    <div class="ext-lw-note-buttons">
                        <button class="ext-lw-note-action-btn ext-lw-note-cancel-btn" data-action="cancel" title="${i18n.t('notePanel.cancel')}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
                            </svg>
                        </button>
                        <button class="ext-lw-note-action-btn ext-lw-note-save-btn" data-action="save" title="${i18n.t('notePanel.save')}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

export interface NotePanelActions {
    save: () => void;
    tryClose: () => void;
    cancel: () => void;
}

/**
 * Attach event listeners to the rendered NotePanel
 */
export function attachNotePanelListeners(
    container: HTMLDivElement,
    state: NotePanelState,
    actions: NotePanelActions,
    startDrag: (e: MouseEvent) => void
): void {
    // Color buttons
    container.querySelectorAll('.ext-lw-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = (e.currentTarget as HTMLElement).dataset.noteColor as HighlightColor;
            state.selectedColor = color;
            container.querySelectorAll('.ext-lw-color-btn').forEach(b => b.classList.remove('ext-lw-color-btn-active'));
            btn.classList.add('ext-lw-color-btn-active');
        });
    });

    // Pin button
    container.querySelector('[data-action="toggle-pin"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        state.isPinned = !state.isPinned;
        const btn = e.currentTarget as HTMLElement;
        btn.classList.toggle('ext-lw-pinned', state.isPinned);
        btn.innerHTML = state.isPinned ? PIN_ICONS.pinFill : PIN_ICONS.pin;
    });

    // Textarea
    const textarea = container.querySelector('textarea');
    if (textarea) {
        textarea.addEventListener('input', (e) => { state.commentValue = (e.target as HTMLTextAreaElement).value; });
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); actions.save(); }
            if (e.key === 'Escape') { e.preventDefault(); actions.tryClose(); }
        });
        textarea.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Action buttons
    container.querySelector('[data-action="cancel"]')?.addEventListener('click', (e) => { e.stopPropagation(); actions.cancel(); });
    container.querySelector('[data-action="save"]')?.addEventListener('click', (e) => { e.stopPropagation(); actions.save(); });

    // Propagation stop
    container.addEventListener('click', (e) => e.stopPropagation());
    container.addEventListener('mouseup', (e) => e.stopPropagation());

    // Drag support
    container.addEventListener('mousedown', (e) => startDrag(e));
}

/**
 * Drag handler for NotePanel
 */
export class NotePanelDragHandler {
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private boundDragMove: ((e: MouseEvent) => void) | null = null;
    private boundDragEnd: (() => void) | null = null;

    get dragging(): boolean { return this.isDragging; }

    handleDragStart(e: MouseEvent, container: HTMLDivElement): void {
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('button')) return;

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        const rect = container.getBoundingClientRect();
        this.dragOffsetX = rect.left + rect.width / 2;
        this.dragOffsetY = rect.top;

        this.boundDragMove = (ev: MouseEvent) => this.handleDragMove(ev, container);
        this.boundDragEnd = () => this.handleDragEnd();
        document.addEventListener('mousemove', this.boundDragMove, true);
        document.addEventListener('mouseup', this.boundDragEnd, true);
    }

    private handleDragMove(e: MouseEvent, container: HTMLDivElement): void {
        if (!this.isDragging) return;
        const newX = this.dragOffsetX + (e.clientX - this.dragStartX);
        const newY = this.dragOffsetY + (e.clientY - this.dragStartY);
        container.style.left = `${newX}px`;
        container.style.top = `${newY + window.scrollY}px`;
        container.style.transform = 'translateX(-50%)';
    }

    private handleDragEnd(): void {
        this.isDragging = false;
        if (this.boundDragMove) document.removeEventListener('mousemove', this.boundDragMove, true);
        if (this.boundDragEnd) document.removeEventListener('mouseup', this.boundDragEnd, true);
        this.boundDragMove = null;
        this.boundDragEnd = null;
    }
}
