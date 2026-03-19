/**
 * NotePanel - Standalone component for capturing notes and colors
 * Delegates rendering, listeners, and drag to notePanelRenderer.ts
 */

import { HighlightColor } from '../../@/lib/types/highlight';
import {
    NotePanelState,
    renderNotePanelHTML,
    attachNotePanelListeners,
    NotePanelDragHandler,
} from './notePanelRenderer';

export type { NotePanelState } from './notePanelRenderer';

export interface NotePanelCallbacks {
    onSave: (comment: string, color: HighlightColor) => Promise<void>;
    onCancel: () => void;
    onClose: () => void;
}

export class NotePanel {
    private container: HTMLDivElement | null = null;
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private state: NotePanelState = {
        isOpen: false,
        position: { x: 0, y: 0 },
        commentValue: '',
        selectedColor: 'yellow',
        targetRect: null,
        isPinned: false
    };
    private callbacks: NotePanelCallbacks | null = null;
    private originalCommentValue: string = '';
    private themeQuery: MediaQueryList | null = null;
    private handleThemeChange: (e: MediaQueryListEvent) => void;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
    private dragHandler = new NotePanelDragHandler();

    constructor() {
        this.handleThemeChange = () => this.updateTheme();
        this.setupThemeListener();
    }

    public isOpen(): boolean { return this.state.isOpen; }

    public show(
        position: { x: number; y: number },
        callbacks: NotePanelCallbacks,
        initialValue: string = '',
        initialColor: HighlightColor = 'yellow',
        targetRect: DOMRect | null = null
    ): void {
        this.callbacks = callbacks;
        this.state = { isOpen: true, position, commentValue: initialValue || '', selectedColor: initialColor, targetRect, isPinned: false };
        this.originalCommentValue = initialValue || '';
        this.ensureContainer();
        this.render();
        this.updateTheme();
    }

    public close(): void {
        if (!this.container || !this.state.isOpen) return;
        this.state.isOpen = false;
        this.container.style.transition = 'opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateX(-50%) scale(0.95)';
        setTimeout(() => {
            if (this.container) { this.container.remove(); this.container = null; }
            this.callbacks?.onClose?.();
        }, 200);
    }

    public isDirty(): boolean {
        return this.state.isOpen && this.state.commentValue !== this.originalCommentValue;
    }

    private ensureContainer(): void {
        if (this.container) return;
        this.host = document.getElementById('ext-lw-note-panel-host') as HTMLDivElement;

        if (!this.host) {
            this.host = document.createElement('div');
            this.host.id = 'ext-lw-note-panel-host';
            this.host.style.position = 'absolute';
            this.host.style.top = '0';
            this.host.style.left = '0';
            this.host.style.width = '100%';
            this.host.style.height = '100%';
            this.host.style.pointerEvents = 'none';
            this.host.style.zIndex = '2147483647';

            ['keydown', 'keyup', 'keypress'].forEach(evt => {
                this.host!.addEventListener(evt, (e) => e.stopPropagation());
            });
            document.body.appendChild(this.host);
        }

        let shadow = this.host.shadowRoot;
        if (!shadow) shadow = this.host.attachShadow({ mode: 'open' });
        this.shadow = shadow;

        if (!this.shadow.querySelector('link[href*="contentScript.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('contentScript.css');
            this.shadow.appendChild(link);
        }

        this.container = document.createElement('div');
        this.container.className = 'ext-lw-note-panel-container';
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateX(-50%) scale(0.95)';
        this.container.style.transition = 'opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
        this.container.style.pointerEvents = 'auto';
        this.container.style.position = 'absolute';
        this.shadow.appendChild(this.container);
        this.setupClickOutsideHandler();
    }

    private render(): void {
        if (!this.container) return;
        this.positionPanel();
        this.container.innerHTML = renderNotePanelHTML(this.state);

        const actions = {
            save: () => this.save(),
            tryClose: () => this.tryClose(),
            cancel: () => this.cancel(),
        };
        attachNotePanelListeners(this.container, this.state, actions, (e) => this.dragHandler.handleDragStart(e, this.container!));

        requestAnimationFrame(() => {
            if (this.container) {
                this.container.style.opacity = '1';
                this.container.style.transform = 'translateX(-50%) scale(1)';
            }
        });

        const textarea = this.container.querySelector('textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }

    private positionPanel(): void {
        if (!this.container) return;
        this.container.style.top = `${this.state.position.y}px`;
        this.container.style.left = `${this.state.position.x}px`;
        this.container.style.transform = 'translateX(-50%) scale(0.95)';
    }

    private async save(): Promise<void> {
        if (this.callbacks?.onSave) await this.callbacks.onSave(this.state.commentValue, this.state.selectedColor);
        this.close();
    }

    private tryClose(): void {
        if (this.state.isPinned || this.isDirty()) return;
        this.forceClose();
    }

    private forceClose(): void {
        this.callbacks?.onCancel?.();
        this.close();
    }

    private cancel(): void { this.forceClose(); }

    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this.state.isOpen || this.dragHandler.dragging) return;
            if (this.container && e.composedPath().includes(this.container)) return;
            this.tryClose();
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    private setupThemeListener(): void {
        this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (this.themeQuery.addEventListener) this.themeQuery.addEventListener('change', this.handleThemeChange);
        else this.themeQuery.addListener(this.handleThemeChange);
    }

    private updateTheme(): void {
        if (!this.container) return;
        import('./shared/ThemeManager').then(({ ThemeManager }) => {
            const isDark = ThemeManager.isDarkMode();
            this.container?.classList.toggle('ext-lw-dark', isDark);
            this.container?.classList.toggle('ext-lw-light', !isDark);
        });
    }

    public destroy(): void {
        if (this.clickOutsideHandler) { document.removeEventListener('mousedown', this.clickOutsideHandler); this.clickOutsideHandler = null; }
        if (this.themeQuery) {
            if (this.themeQuery.removeEventListener) this.themeQuery.removeEventListener('change', this.handleThemeChange);
            else this.themeQuery.removeListener(this.handleThemeChange);
            this.themeQuery = null;
        }
        if (this.container) { this.container.remove(); this.container = null; }
        if (this.host) { this.host.remove(); this.host = null; }
    }
}
