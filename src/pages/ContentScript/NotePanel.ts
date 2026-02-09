import { HighlightColor, HIGHLIGHT_COLORS } from '../../@/lib/types/highlight';
import i18n from '../../@/lib/i18n';

// Styles are now loaded via <link> from contentScript.css


/** Pin icons */
const PIN_ICONS = {
    pin: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-pin-angle" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146m.122 2.112v-.002zm0-.002v.002a.5.5 0 0 1-.122.51L6.293 6.878a.5.5 0 0 1-.511.12H5.78l-.014-.004a5 5 0 0 0-.288-.076 5 5 0 0 0-.765-.116c-.422-.028-.836.008-1.175.15l5.51 5.509c.141-.34.177-.753.149-1.175a5 5 0 0 0-.192-1.054l-.004-.013v-.001a.5.5 0 0 1 .12-.512l3.536-3.535a.5.5 0 0 1 .532-.115l.096.022c.087.017.208.034.344.034q.172.002.343-.04L9.927 2.028q-.042.172-.04.343a1.8 1.8 0 0 0 .062.46z"/>
</svg>`,
    pinFill: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-pin-angle-fill" viewBox="0 0 16 16">
  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a6 6 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707s.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a6 6 0 0 1 1.013.16l3.134-3.133a3 3 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146"/>
</svg>`
};

export interface NotePanelCallbacks {
    onSave: (comment: string, color: HighlightColor) => Promise<void>;
    onCancel: () => void;
    onClose: () => void;
}

export interface NotePanelState {
    isOpen: boolean;
    position: { x: number; y: number };
    commentValue: string;
    selectedColor: HighlightColor;
    targetRect: DOMRect | null;
    isPinned: boolean;
}

/**
 * NotePanel - Standalone component for capturing notes and colors
 */
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

    // Drag state
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private dragOffsetX = 0;
    private dragOffsetY = 0;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

    constructor() {
        this.handleThemeChange = () => this.updateTheme();
        this.setupThemeListener();
    }

    public isOpen(): boolean {
        return this.state.isOpen;
    }

    /**
     * Show the note panel
     */
    public show(
        position: { x: number; y: number },
        callbacks: NotePanelCallbacks,
        initialValue: string = '',
        initialColor: HighlightColor = 'yellow',
        targetRect: DOMRect | null = null
    ): void {
        this.callbacks = callbacks;
        this.state = {
            isOpen: true,
            position,
            commentValue: initialValue || '',
            selectedColor: initialColor,
            targetRect,
            isPinned: false
        };
        this.originalCommentValue = initialValue || '';

        this.ensureContainer();
        this.render();
        this.updateTheme();
    }

    /**
     * Close the note panel
     */
    public close(): void {
        if (!this.container || !this.state.isOpen) return;

        this.state.isOpen = false;

        // Exit animation - pure reverse of entrance (no slide, just scale + fade)
        // Must preserve translateX(-50%) for centering
        this.container.style.transition = 'opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateX(-50%) scale(0.95)';

        // Remove after animation
        setTimeout(() => {
            if (this.container) {
                this.container.remove();
                this.container = null;
            }
            if (this.callbacks?.onClose) {
                this.callbacks.onClose();
            }
        }, 200);
    }

    /**
     * Check if panel has unsaved changes
     */
    public isDirty(): boolean {
        return this.state.isOpen && this.state.commentValue !== this.originalCommentValue;
    }

    private ensureContainer(): void {
        if (this.container) return;

        // Create Host (if standalone usage, might need its own host or reuse existing?)
        // For simplicity, we create a new host for the note panel
        this.host = document.getElementById('ext-lw-note-panel-host') as HTMLDivElement;

        if (!this.host) {
            this.host = document.createElement('div');
            this.host.id = 'ext-lw-note-panel-host';
            this.host.style.position = 'absolute';
            this.host.style.top = '0';
            this.host.style.left = '0';
            this.host.style.width = '100%';
            this.host.style.height = '100%';
            this.host.style.pointerEvents = 'none'; // Passthrough
            this.host.style.zIndex = '2147483647';

            // Stop keyboard events from bubbling to host page (prevents YouTube shortcuts etc.)
            ['keydown', 'keyup', 'keypress'].forEach(eventType => {
                this.host!.addEventListener(eventType, (e) => {
                    e.stopPropagation();
                });
            });

            document.body.appendChild(this.host);
        }

        // Use existing shadow or create new? 
        // Better to use a clean shadow root
        let shadow = this.host.shadowRoot;
        if (!shadow) {
            shadow = this.host.attachShadow({ mode: 'open' });
        }
        this.shadow = shadow;


        // Add styles if not present (via Link)
        if (!this.shadow.querySelector('link[href*="contentScript.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('contentScript.css');
            this.shadow.appendChild(link);
        }

        this.container = document.createElement('div');
        this.container.className = 'ext-lw-note-panel-container';

        // Initial hidden state for animation (scale + fade, with centering)
        this.container.style.opacity = '0';
        this.container.style.transform = 'translateX(-50%) scale(0.95)';
        this.container.style.transition = 'opacity 0.2s ease-out, transform 0.2s cubic-bezier(0.2, 0, 0.2, 1)';
        this.container.style.pointerEvents = 'auto'; // Capture events
        this.container.style.position = 'absolute';

        this.shadow.appendChild(this.container);

        // Click outside handler
        this.setupClickOutsideHandler();
    }

    private render(): void {
        if (!this.container) return;

        // Position it first
        this.positionPanel();

        // Generate content
        const colorsHtml = HIGHLIGHT_COLORS.map(color => {
            const isActive = color === this.state.selectedColor;
            return `<button class="ext-lw-color-btn ext-lw-color-btn-${color} ${isActive ? 'ext-lw-color-btn-active' : ''}" data-note-color="${color}"></button>`;
        }).join('');

        this.container.innerHTML = `
            <div class="ext-lw-note-outer">
                <div class="ext-lw-note-inner">
                    <textarea class="ext-lw-capture-note-textarea" placeholder="${i18n.t('notePanel.placeholder')}">${this.state.commentValue}</textarea>
                    <div class="ext-lw-capture-note-actions">
                        <div class="ext-lw-note-color-picker">
                            <div class="ext-lw-note-colors-wrapper">
                                ${colorsHtml}
                            </div>
                            <button class="ext-lw-pin-btn ${this.state.isPinned ? 'ext-lw-pinned' : ''}" data-action="toggle-pin" title="${i18n.t('notePanel.pin')}">
                                ${this.state.isPinned ? PIN_ICONS.pinFill : PIN_ICONS.pin}
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

        this.attachListeners();

        // Trigger entrance animation (scale 0.95 → 1 + fade in)
        requestAnimationFrame(() => {
            if (this.container) {
                this.container.style.opacity = '1';
                this.container.style.transform = 'translateX(-50%) scale(1)';
            }
        });

        // Focus textarea
        const textarea = this.container.querySelector('textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }

    private positionPanel(): void {
        if (!this.container) return;

        // Simple positioning logic
        // Use exact coordinates provided
        let top = this.state.position.y;
        let left = this.state.position.x;

        // Adjust for panel size (approximate or measure)
        // Similar logic to HighlightToolbox positioning

        this.container.style.top = `${top}px`;
        this.container.style.left = `${left}px`;

        // Center horizontally - set initial transform with both translateX and scale
        // The scale(0.95) is for entrance animation
        this.container.style.transform = 'translateX(-50%) scale(0.95)';
    }

    private attachListeners(): void {
        if (!this.container) return;

        // Color buttons
        this.container.querySelectorAll('.ext-lw-color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const color = (e.currentTarget as HTMLElement).dataset.noteColor as HighlightColor;
                this.state.selectedColor = color;

                // Update UI active state
                this.container?.querySelectorAll('.ext-lw-color-btn').forEach(b => b.classList.remove('ext-lw-color-btn-active'));
                btn.classList.add('ext-lw-color-btn-active');
            });
        });

        // Pin button
        this.container.querySelector('[data-action="toggle-pin"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.state.isPinned = !this.state.isPinned;
            const btn = e.currentTarget as HTMLElement;
            btn.classList.toggle('ext-lw-pinned', this.state.isPinned);
            btn.innerHTML = this.state.isPinned ? PIN_ICONS.pinFill : PIN_ICONS.pin;
        });

        // Textarea input
        const textarea = this.container.querySelector('textarea');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                this.state.commentValue = (e.target as HTMLTextAreaElement).value;
            });
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.save();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    // ESC only closes if not dirty
                    this.tryClose();
                }
            });
            // Prevent drag when interacting with textarea
            textarea.addEventListener('mousedown', (e) => e.stopPropagation());
        }

        // Actions
        this.container.querySelector('[data-action="cancel"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.cancel();
        });
        this.container.querySelector('[data-action="save"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.save();
        });

        // Stop propagation for general clicks
        this.container.addEventListener('click', (e) => e.stopPropagation());
        this.container.addEventListener('mouseup', (e) => e.stopPropagation());

        // Drag support - container acts as drag handle (except textarea)
        this.container.addEventListener('mousedown', (e) => this.handleDragStart(e));
    }

    private handleDragStart(e: MouseEvent): void {
        if (!this.container) return;

        // Don't start drag from interactive elements
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.closest('button')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // Get current position (need to parse from style since we're using translateX)
        const rect = this.container.getBoundingClientRect();
        this.dragOffsetX = rect.left + rect.width / 2;
        this.dragOffsetY = rect.top;

        // Add listeners to document - use bound methods with capture for Shadow DOM
        this.boundDragMove = this.handleDragMove.bind(this);
        this.boundDragEnd = this.handleDragEnd.bind(this);
        document.addEventListener('mousemove', this.boundDragMove, true);
        document.addEventListener('mouseup', this.boundDragEnd, true);
    }

    private boundDragMove: ((e: MouseEvent) => void) | null = null;
    private boundDragEnd: (() => void) | null = null;

    private handleDragMove(e: MouseEvent): void {
        if (!this.isDragging || !this.container) return;

        const deltaX = e.clientX - this.dragStartX;
        const deltaY = e.clientY - this.dragStartY;

        const newX = this.dragOffsetX + deltaX;
        const newY = this.dragOffsetY + deltaY;

        this.container.style.left = `${newX}px`;
        this.container.style.top = `${newY + window.scrollY}px`;
        this.container.style.transform = 'translateX(-50%)'; // Keep centered
    }

    private handleDragEnd(): void {
        this.isDragging = false;
        if (this.boundDragMove) {
            document.removeEventListener('mousemove', this.boundDragMove, true);
        }
        if (this.boundDragEnd) {
            document.removeEventListener('mouseup', this.boundDragEnd, true);
        }
        this.boundDragMove = null;
        this.boundDragEnd = null;
    }

    private async save(): Promise<void> {
        if (this.callbacks?.onSave) {
            await this.callbacks.onSave(this.state.commentValue, this.state.selectedColor);
        }
        this.close();
    }

    /**
     * Try to close panel based on current state
     * - If pinned: never close
     * - If dirty: don't close (user must use Cancel or Save buttons)
     * - Otherwise: close normally
     */
    private tryClose(): void {
        if (this.state.isPinned) return;
        if (this.isDirty()) return;
        this.forceClose();
    }

    /**
     * Force close (used by Cancel/Save buttons)
     */
    private forceClose(): void {
        if (this.callbacks?.onCancel) {
            this.callbacks.onCancel();
        }
        this.close();
    }

    /**
     * Handle cancel button click
     */
    private cancel(): void {
        // Cancel button always closes (bypasses pin/dirty checks)
        this.forceClose();
    }

    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this.state.isOpen) return;
            if (this.isDragging) return; // Don't trigger while dragging

            const path = e.composedPath();

            // Check if click is inside panel
            if (this.container && path.includes(this.container)) {
                return;
            }

            // Click outside - try to close
            this.tryClose();
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    private setupThemeListener(): void {
        this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (this.themeQuery.addEventListener) {
            this.themeQuery.addEventListener('change', this.handleThemeChange);
        } else {
            this.themeQuery.addListener(this.handleThemeChange);
        }
    }

    private updateTheme(): void {
        if (!this.container) return;

        // Use ThemeManager for consistent theme detection (same as HighlightToolbox)
        import('./shared/ThemeManager').then(({ ThemeManager }) => {
            const isDark = ThemeManager.isDarkMode();
            if (isDark) {
                this.container?.classList.add('ext-lw-dark');
                this.container?.classList.remove('ext-lw-light');
            } else {
                this.container?.classList.add('ext-lw-light');
                this.container?.classList.remove('ext-lw-dark');
            }
        });
    }

    public destroy(): void {
        // Remove click outside handler
        if (this.clickOutsideHandler) {
            document.removeEventListener('mousedown', this.clickOutsideHandler);
            this.clickOutsideHandler = null;
        }

        if (this.themeQuery) {
            if (this.themeQuery.removeEventListener) {
                this.themeQuery.removeEventListener('change', this.handleThemeChange);
            } else {
                this.themeQuery.removeListener(this.handleThemeChange);
            }
            this.themeQuery = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        if (this.host) {
            this.host.remove();
            this.host = null;
        }
    }
}
