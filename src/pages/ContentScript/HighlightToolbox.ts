// Floating Highlight Toolbox - Vanilla TS implementation
import { Highlight, HighlightColor } from '../../@/lib/types/highlight';
import { FeedbackIndicator } from './components/FeedbackIndicator';
import { ThemeManager } from './shared/ThemeManager';
import { HighlightToolboxRenderer, SuccessButtonAction, ToolboxState, ICONS } from './HighlightToolboxRenderer';
import { attachColorModeListeners } from './toolbox/colorModeListeners';
import { attachCommentModeListeners } from './toolbox/commentModeListeners';
import { extractLinksFromSelection, positionWithinViewport } from './toolbox/toolboxHelpers';

export interface ToolboxCallbacks {
    onColorSelect: (color: HighlightColor) => Promise<void>;
    onCommentSave: (comment: string, color?: HighlightColor) => Promise<void>;
    onDelete: () => Promise<void>;
    onClip?: (selectionRect: DOMRect | null, selectionText: string) => void;
    onSmartCapture?: () => void;
    onSaveLink?: (url: string) => Promise<void>;
    onSaveAllLinks?: (urls: string[]) => Promise<void>;
    onCancelComment?: () => void;
    onOpenNotePanel?: (targetRect: DOMRect | null, selectedColor: HighlightColor) => void;
    onClose: () => void;
}

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

export class HighlightToolbox {
    private container: HTMLDivElement | null = null;
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private feedbackIndicator: FeedbackIndicator | null = null;
    private renderer: HighlightToolboxRenderer;

    private state: ToolboxState = {
        selectedColor: 'yellow',
        existingHighlight: null,
        detectedLinks: [],
        highlightIdsInSelection: [],
        isLinkMenuOpen: false,
        successButton: null
    };

    private _isOpen = false;
    private _isCommentMode = false;
    private _position: { x: number; y: number } = { x: 0, y: 0 };
    private _targetRect?: DOMRect | null = null;
    private callbacks: ToolboxCallbacks | null = null;
    private commentValue = '';
    private originalCommentValue = '';
    private isPinned = false;
    private isDragging = false;
    private hasManualPosition = false;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
    /** Hover-aware close timer for clip/copy success ticks. */
    private closeTimer: ReturnType<typeof setTimeout> | null = null;
    /** Exit-animation completion timer for close() — must be cancelled on reopen so a stale
     *  fire doesn't slam the freshly reopened toolbox shut. */
    private closeAnimTimer: ReturnType<typeof setTimeout> | null = null;
    private isHovering = false;
    constructor() {
        this.renderer = new HighlightToolboxRenderer();
    }

    private isDarkMode(): boolean { return ThemeManager.isDarkMode(); }

    private ensureContainer(): void {
        if (this.container) return;

        setDebugState({ toolboxStage: 'creating-host' });
        this.host = document.createElement('div');
        this.host.id = 'ext-lw-highlight-toolbox-host';
        Object.assign(this.host.style, { position: 'absolute', top: '0', left: '0', width: '0', height: '0', zIndex: '2147483647', pointerEvents: 'none' });

        ['keydown', 'keyup', 'keypress'].forEach(eventType => {
            this.host!.addEventListener(eventType, (e) => { e.stopPropagation(); });
        });

        document.body.appendChild(this.host);
        this.shadow = this.host.attachShadow({ mode: 'open' });

        try {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('contentScript.css');
            this.shadow.appendChild(link);
        } catch (e) { }

        this.container = document.createElement('div');
        this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
        this.container.id = 'ext-lw-highlight-toolbox';
        this.container.style.pointerEvents = 'auto';

        this.container.addEventListener('mousedown', (e) => {
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
            e.preventDefault();
        });

        // Hover-aware close timer for clip/copy: pause while user lingers, restart on leave.
        this.container.addEventListener('mouseenter', () => {
            this.isHovering = true;
            const success = this.state.successButton;
            if ((success === 'clip' || success === 'copy') && this.closeTimer) {
                clearTimeout(this.closeTimer);
                this.closeTimer = null;
            }
        });
        this.container.addEventListener('mouseleave', () => {
            this.isHovering = false;
            if (!this._isOpen) return;
            const success = this.state.successButton;
            if (success === 'clip' || success === 'copy') {
                this.scheduleSuccessClose(450);
            }
        });

        this.shadow.appendChild(this.container);
        this.feedbackIndicator = new FeedbackIndicator(this.shadow);
        this.setupClickOutsideHandler();
    }
    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this._isOpen || this.isDragging || e.button === 2) return;
            const path = e.composedPath();
            if (this.host && path.includes(this.host)) return;
            if (e.target === this.host) return;
            if (this.container && this.container.contains(e.target as HTMLElement)) return;

            if (this.state.isLinkMenuOpen) {
                this.state.isLinkMenuOpen = false;
                const dropdownOuter = this.container?.querySelector('.ext-lw-link-dropdown-outer');
                if (dropdownOuter) dropdownOuter.classList.add('ext-lw-link-dropdown-hidden');
                return;
            }

            if (this._isCommentMode || this.isCommentDirty()) return;
            this.close();
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    public show(
        position: { x: number; y: number },
        callbacks: ToolboxCallbacks,
        existingHighlight?: Highlight | null,
        initialCommentMode: boolean = false,
        targetRect?: DOMRect,
        providedLinks?: Array<{ url: string; label: string }>,
        highlightIdsInSelection?: number[],
        defaultColor: HighlightColor = 'yellow'
    ): void {
        setDebugState({ toolboxStage: 'show-called', toolboxX: position.x, toolboxY: position.y, hasExistingHighlight: !!existingHighlight, linkCount: providedLinks?.length ?? 0 });
        this.ensureContainer();
        if (!this.container) return;

        const detectedLinks = providedLinks ?? extractLinksFromSelection();

        this._isOpen = true;
        this._isCommentMode = initialCommentMode;
        this._position = position;
        this._targetRect = targetRect || null;

        this.state = {
            existingHighlight: existingHighlight || null,
            detectedLinks,
            isLinkMenuOpen: false,
            selectedColor: existingHighlight?.color || defaultColor,
            highlightIdsInSelection: highlightIdsInSelection || [],
            successButton: null
        };

        this.callbacks = callbacks;
        this.commentValue = existingHighlight?.comment || '';
        this.originalCommentValue = this.commentValue;
        this.isPinned = initialCommentMode ? !!this.commentValue : false;
        this.isHovering = false;
        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
        // Cancel any pending exit-animation timer from a previous close() — without this,
        // a reopen that lands inside the 200ms close window would be slammed shut by the
        // stale timer firing after show() completes.
        if (this.closeAnimTimer) {
            clearTimeout(this.closeAnimTimer);
            this.closeAnimTimer = null;
        }

        this.render();
    }

    public isOpen(): boolean { return this._isOpen; }
    public getCurrentHighlightId(): number | null { return this.state.existingHighlight?.id ?? null; }
    public isCommentMode(): boolean { return this._isCommentMode; }
    public isBeingDragged(): boolean { return this.isDragging; }
    public isCommentDirty(): boolean { return this._isCommentMode && (this.isPinned || this.commentValue !== this.originalCommentValue); }
    public close(): void {
        if (!this.container || !this._isOpen) return;

        if (this.closeTimer) {
            clearTimeout(this.closeTimer);
            this.closeTimer = null;
        }
        if (this.closeAnimTimer) {
            clearTimeout(this.closeAnimTimer);
            this.closeAnimTimer = null;
        }

        if (this._isCommentMode) {
            this.container.classList.add('ext-lw-closing');
        } else {
            const outerDock = this.container.querySelector('.ext-lw-void-dock-outer');
            if (outerDock) outerDock.classList.add('ext-lw-closing');
            else this.container.classList.add('ext-lw-closing');
        }

        this.closeAnimTimer = setTimeout(() => {
            this.closeAnimTimer = null;
            this._isOpen = false;
            this._isCommentMode = false;
            this.hasManualPosition = false;
            this.state.successButton = null;
            this.callbacks?.onClose();
            this.render();
            window.getSelection()?.removeAllRanges();
        }, 200);
    }

    /** Set the per-button success state. Uses a targeted DOM update instead of a
     *  full render() — innerHTML replacement would remount `.ext-lw-void-dock-outer`
     *  and replay the spring entrance keyframes (perceived as a flicker), and would
     *  also re-run positionWithinViewport (perceived as the bar nudging up a few
     *  pixels). Toggling class + swapping the affected button's inner content keeps
     *  the dock identity intact so the natural ext-lw-success-flood + ext-lw-tick-pop
     *  animations on the changed button are the only motion the user sees. */
    public setSuccessButton(action: SuccessButtonAction | null): void {
        this.state.successButton = action;
        if (!this._isOpen || !this.container) return;
        this.applySuccessState();
    }

    private applySuccessState(): void {
        if (!this.container) return;
        const success = this.state.successButton;
        const tickHTML = '<span class="ext-lw-dock-btn-tick">✓</span>';
        const buttonMap: Record<SuccessButtonAction, { selector: string; icon: string }> = {
            highlight: { selector: '[data-action="highlight"]', icon: ICONS.highlighter },
            copy: { selector: '[data-action="copy-text"]', icon: ICONS.copy },
            clip: { selector: '[data-action="clip"]', icon: ICONS.camera },
            erase: { selector: '[data-action="delete"]', icon: ICONS.trash },
        };
        (Object.keys(buttonMap) as SuccessButtonAction[]).forEach(act => {
            const { selector, icon } = buttonMap[act];
            const btn = this.container!.querySelector(selector) as HTMLButtonElement | null;
            if (!btn) return;
            const isSuccess = success === act;
            btn.classList.toggle('ext-lw-dock-btn-success', isSuccess);
            if (isSuccess) {
                btn.setAttribute('disabled', '');
                btn.innerHTML = tickHTML;
            } else {
                btn.removeAttribute('disabled');
                btn.innerHTML = icon;
            }
        });
    }

    /** Schedule a deferred close for hover-aware actions (clip / copy). */
    public scheduleSuccessClose(delay: number): void {
        if (this.closeTimer) clearTimeout(this.closeTimer);
        this.closeTimer = setTimeout(() => {
            this.closeTimer = null;
            this.state.successButton = null;
            this.close();
        }, delay);
    }

    public isHoveringToolbox(): boolean {
        return this.isHovering;
    }

    public setLoading(loading: boolean): void {
        if (loading) {
            if (this.container) this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
            this.feedbackIndicator?.show({ type: 'loading', position: this._position, darkMode: this.isDarkMode() });
        } else {
            this.feedbackIndicator?.hide();
            this.render();
        }
    }

    public setSuccess(): void {
        if (this.container) this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
        this.feedbackIndicator?.show({
            type: 'success', position: this._position, darkMode: this.isDarkMode(),
            autoHideDuration: 800, onComplete: () => this.close()
        });
    }

    private render(): void {
        if (!this.container) return;

        if (!this._isOpen) {
            this.container.className = 'ext-lw-toolbox ext-lw-toolbox-hidden';
            this.container.innerHTML = '';
            return;
        }

        positionWithinViewport(this.container, this._isCommentMode, this._position, this._targetRect);
        setDebugState({ toolboxStage: 'render-positioned', toolboxLeft: this.container.style.left, toolboxTop: this.container.style.top, toolboxTransform: this.container.style.transform, commentMode: this._isCommentMode });

        if (this._isCommentMode) {
            this.renderCommentMode();
        } else {
            this.renderColorMode();
        }
    }

    private renderColorMode(): void {
        if (!this.container) return;
        this.renderer.renderColorMode(this.container, this.state, this.isDarkMode());
        attachColorModeListeners({
            container: this.container,
            state: this.state,
            callbacks: this.callbacks,
            setLoading: (l) => this.setLoading(l),
            setSuccess: () => this.setSuccess(),
            setSuccessButton: (a) => this.setSuccessButton(a),
            scheduleSuccessClose: (d) => this.scheduleSuccessClose(d),
            isHoveringToolbox: () => this.isHoveringToolbox(),
            close: () => this.close(),
            targetRect: this._targetRect,
            setCommentMode: (v) => { this._isCommentMode = v; },
            render: () => this.render(),
        });
    }

    private renderCommentMode(): void {
        if (!this.container) return;

        const isAlreadyOpen = this.container.classList.contains('ext-lw-capture-actionbar-note-mode') && !this.container.classList.contains('ext-lw-note-panel-hidden');

        if (isAlreadyOpen) {
            this.renderer.updateCommentMode(this.container, this.state, this.isPinned, this.isDarkMode());
            return;
        }

        this.renderer.renderCommentMode(this.container, this.state, this.commentValue, this.isPinned, this.isDarkMode(), isAlreadyOpen);

        attachCommentModeListeners({
            container: this.container,
            state: this.state,
            callbacks: this.callbacks,
            commentValue: this.commentValue,
            setCommentValue: (v) => { this.commentValue = v; },
            isPinned: this.isPinned,
            setIsPinned: (v) => { this.isPinned = v; },
            isDragging: this.isDragging,
            setIsDragging: (v) => { this.isDragging = v; },
            hasManualPosition: this.hasManualPosition,
            setHasManualPosition: (v) => { this.hasManualPosition = v; },
            isCommentDirty: () => this.isCommentDirty(),
            setLoading: (l) => this.setLoading(l),
            setSuccess: () => this.setSuccess(),
            setCommentMode: (v) => { this._isCommentMode = v; },
            render: () => this.render(),
            renderCommentMode: () => this.renderCommentMode(),
        });

        requestAnimationFrame(() => {
            if (this.container) {
                if (!this.hasManualPosition) {
                    positionWithinViewport(this.container, this._isCommentMode, this._position, this._targetRect);
        setDebugState({ toolboxStage: 'render-positioned', toolboxLeft: this.container.style.left, toolboxTop: this.container.style.top, toolboxTransform: this.container.style.transform, commentMode: this._isCommentMode });
                }
                setTimeout(() => {
                    if (this.container) {
                        this.container.classList.remove('ext-lw-note-panel-hidden');
                        this.container.style.transition = 'opacity 0.5s ease-out';
                        this.container.style.opacity = '1';
                    }
                }, 50);
            }
        });

        const textarea = this.container.querySelector('.ext-lw-capture-note-textarea') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
            textarea.selectionStart = textarea.value.length;
        }
    }

    public destroy(): void {
        if (this.closeTimer) { clearTimeout(this.closeTimer); this.closeTimer = null; }
        if (this.closeAnimTimer) { clearTimeout(this.closeAnimTimer); this.closeAnimTimer = null; }
        if (this.clickOutsideHandler) { document.removeEventListener('mousedown', this.clickOutsideHandler); this.clickOutsideHandler = null; }
        if (this.feedbackIndicator) { this.feedbackIndicator.hide(); this.feedbackIndicator = null; }
        if (this.container) { this.container.remove(); this.container = null; }
        if (this.host) { this.host.remove(); this.host = null; }
        this.shadow = null;
    }
}

export function showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const existing = document.querySelector('.ext-lw-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `ext-lw-toast ext-lw-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3000);
}






