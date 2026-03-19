/**
 * ClickOutsideHandler - Reusable click outside detection for Shadow DOM components
 * 
 * Features:
 * - Proper Shadow DOM handling using composedPath()
 * - Configurable exclusion selectors
 * - Right-click filtering option
 * - Automatic cleanup
 * 
 * Used by: CaptureActionBar, HighlightToolbox, NotePanel
 */

export interface ClickOutsideOptions {
    /** The Shadow DOM host element */
    host: HTMLElement | null;
    /** The container element inside Shadow DOM */
    container: HTMLElement | null;
    /** Additional selectors to exclude (in Light DOM) */
    excludeSelectors?: string[];
    /** Whether to ignore right-clicks (default: true) */
    ignoreRightClick?: boolean;
    /** Custom check before closing (return false to prevent close) */
    shouldClose?: () => boolean;
}

export class ClickOutsideHandler {
    private host: HTMLElement | null;
    private container: HTMLElement | null;
    private excludeSelectors: string[];
    private ignoreRightClick: boolean;
    private shouldClose: (() => boolean) | undefined;
    private onClickOutside: () => void;
    private boundHandler: (e: MouseEvent) => void;
    private isActive: boolean = false;

    constructor(options: ClickOutsideOptions, onClickOutside: () => void) {
        this.host = options.host;
        this.container = options.container;
        this.excludeSelectors = options.excludeSelectors ?? [];
        this.ignoreRightClick = options.ignoreRightClick ?? true;
        this.shouldClose = options.shouldClose;
        this.onClickOutside = onClickOutside;
        this.boundHandler = this.handleMousedown.bind(this);
    }

    /**
     * Start listening for clicks outside
     */
    public enable(): void {
        if (this.isActive) return;
        document.addEventListener('mousedown', this.boundHandler);
        this.isActive = true;
    }

    /**
     * Stop listening for clicks outside
     */
    public disable(): void {
        if (!this.isActive) return;
        document.removeEventListener('mousedown', this.boundHandler);
        this.isActive = false;
    }

    /**
     * Update options dynamically
     */
    public updateOptions(options: Partial<ClickOutsideOptions>): void {
        if (options.host !== undefined) this.host = options.host;
        if (options.container !== undefined) this.container = options.container;
        if (options.excludeSelectors !== undefined) this.excludeSelectors = options.excludeSelectors;
        if (options.ignoreRightClick !== undefined) this.ignoreRightClick = options.ignoreRightClick;
        if (options.shouldClose !== undefined) this.shouldClose = options.shouldClose;
    }

    /**
     * Cleanup - remove listeners
     */
    public destroy(): void {
        this.disable();
    }

    private handleMousedown(e: MouseEvent): void {
        // Ignore right-click if configured
        if (this.ignoreRightClick && e.button === 2) {
            return;
        }

        const target = e.target as HTMLElement;

        // Check if click is inside Shadow DOM using composedPath
        const path = e.composedPath();
        if (this.host && path.includes(this.host)) {
            return;
        }

        // Legacy fallback: clicks in Shadow DOM are retargeted to host
        if (target === this.host) {
            return;
        }

        // Check if click is inside container (direct check fallback)
        if (this.container && this.container.contains(target)) {
            return;
        }

        // Check excluded selectors (Light DOM elements)
        for (const selector of this.excludeSelectors) {
            if (target.closest(selector)) {
                return;
            }
        }

        // Custom check before closing
        if (this.shouldClose && !this.shouldClose()) {
            return;
        }

        // All checks passed - trigger callback
        this.onClickOutside();
    }
}
