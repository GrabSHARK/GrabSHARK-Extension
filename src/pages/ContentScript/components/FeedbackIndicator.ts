// Reusable Feedback Indicator Component
// Provides loading/success/error states for async operations

export type FeedbackType = 'loading' | 'success' | 'error';

export interface FeedbackOptions {
    type: FeedbackType;
    autoHideDuration?: number; // Default: 800ms for success/error
    position?: { x: number; y: number }; // Required for positioning
    darkMode?: boolean; // Auto-detect if not provided
    onComplete?: () => void; // Callback when feedback cycle completes
}

// Inline styles to bypass Shadow DOM CSS isolation issues
const CONTAINER_STYLES = {
    light: `
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        z-index: 2147483647;
        min-width: 2rem;
        min-height: 2rem;
        padding: 0.375rem;
        border-radius: 0.5rem;
        background-color: white;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        border: 1px solid #e5e7eb;
        pointer-events: auto;
    `,
    dark: `
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        z-index: 2147483647;
        min-width: 2rem;
        min-height: 2rem;
        padding: 0.375rem;
        border-radius: 0.5rem;
        background-color: #1f1f1f;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        border: 1px solid #374151;
        pointer-events: auto;
    `
};

const LOADING_STYLES = `
    width: 1rem;
    height: 1rem;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ext-lw-spin 1s linear infinite;
`;

const SUCCESS_STYLES = `
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-size: 1.125rem;
    font-weight: 700;
`;

const ERROR_STYLES = `
    width: 1rem;
    height: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ef4444;
    font-size: 1.125rem;
    font-weight: 700;
`;

export class FeedbackIndicator {
    private container: HTMLDivElement | null = null;
    private styleElement: HTMLStyleElement | null = null;
    private isShowing = false;
    private autoHideTimer: number | null = null;
    private parent: Element | ShadowRoot;

    constructor(parentElement: Element | ShadowRoot) {
        this.parent = parentElement;
        this.ensureContainer();
    }

    private ensureContainer(): void {
        if (this.container) return;

        // Inject keyframes animation
        this.styleElement = document.createElement('style');
        this.styleElement.textContent = `
            @keyframes ext-lw-spin {
                to { transform: rotate(360deg); }
            }
            @keyframes ext-lw-zoom-in {
                from { transform: scale(0.5); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
        `;
        this.parent.appendChild(this.styleElement);

        // Create container
        this.container = document.createElement('div');
        this.container.style.cssText = CONTAINER_STYLES.light + 'display: none;';
        this.parent.appendChild(this.container);
    }

    public show(options: FeedbackOptions): void {
        if (!this.container) {
            return;
        }

        this.isShowing = true;

        // Clear any pending auto-hide
        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }

        // Apply theme via inline styles
        const isDark = options.darkMode ?? false;
        let baseStyles = isDark ? CONTAINER_STYLES.dark : CONTAINER_STYLES.light;

        // Apply position (convert page coords to viewport coords for position: fixed)
        if (options.position) {
            const viewportX = options.position.x - window.scrollX;
            const viewportY = options.position.y - window.scrollY;
            baseStyles += `left: ${viewportX}px; top: ${viewportY}px; transform: translate(-50%, -50%);`;
        }

        this.container.style.cssText = baseStyles;

        // Render content based on type
        const innerDiv = document.createElement('div');
        switch (options.type) {
            case 'loading':
                innerDiv.style.cssText = LOADING_STYLES;
                break;
            case 'success':
                innerDiv.style.cssText = SUCCESS_STYLES + 'animation: ext-lw-zoom-in 0.2s ease-out;';
                innerDiv.textContent = '✓';
                this.scheduleAutoHide(options);
                break;
            case 'error':
                innerDiv.style.cssText = ERROR_STYLES + 'animation: ext-lw-zoom-in 0.2s ease-out;';
                innerDiv.textContent = '✕';
                this.scheduleAutoHide(options);
                break;
        }

        this.container.innerHTML = '';
        this.container.appendChild(innerDiv);
    }

    private scheduleAutoHide(options: FeedbackOptions): void {
        const duration = options.autoHideDuration ?? 800;
        this.autoHideTimer = window.setTimeout(() => {
            this.hide();
            options.onComplete?.();
        }, duration);
    }

    public hide(): void {
        if (!this.container || !this.isShowing) return;

        this.isShowing = false;
        this.container.style.display = 'none';

        if (this.autoHideTimer) {
            clearTimeout(this.autoHideTimer);
            this.autoHideTimer = null;
        }
    }

    public isVisible(): boolean {
        return this.isShowing;
    }

    public destroy(): void {
        this.hide();
        this.container?.remove();
        this.styleElement?.remove();
        this.container = null;
        this.styleElement = null;
    }
}
