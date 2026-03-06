// Capture Overlay - Overlay UI for Smart Capture mode

import { CaptureTarget } from './types';

/**
 * CaptureOverlay - Renders the visual overlay on detected elements
 */
export class CaptureOverlay {
    private overlay: HTMLDivElement | null = null;
    private targetIcon: HTMLDivElement | null = null;
    private cycleLabel: HTMLDivElement | null = null;
    private isVisible = false;
    private isLocked = false;
    private labelTimeout: number | null = null;
    private boundResizeHandler: (() => void) | null = null;
    private boundScrollHandler: (() => void) | null = null;

    constructor() {
        this.createOverlay();
        this.setupResizeHandler();

    }

    /**
     * Create the overlay element
     */
    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'ext-lw-capture-overlay ext-lw-capture-overlay-hidden';
        this.overlay.id = 'lw-capture-overlay';

        // Target icon in center
        this.targetIcon = document.createElement('div');
        this.targetIcon.className = 'ext-lw-capture-target-icon';
        this.targetIcon.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="22" y1="12" x2="18" y2="12"/>
        <line x1="6" y1="12" x2="2" y2="12"/>
        <line x1="12" y1="6" x2="12" y2="2"/>
        <line x1="12" y1="22" x2="12" y2="18"/>
      </svg>
    `;
        this.overlay.appendChild(this.targetIcon);

        // Cycle position label
        this.cycleLabel = document.createElement('div');
        this.cycleLabel.className = 'ext-lw-capture-cycle-label ext-lw-capture-cycle-label-hidden';
        this.overlay.appendChild(this.cycleLabel);

        document.body.appendChild(this.overlay);
    }

    /**
     * Setup resize handler to update overlay position
     */
    private setupResizeHandler(): void {
        let resizeTimeout: number;

        this.boundResizeHandler = () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            resizeTimeout = window.setTimeout(() => {
                if (this.isVisible && this.currentTarget) {
                    this.updatePosition(this.currentTarget);
                }
            }, 100);
        };

        this.boundScrollHandler = () => {
            if (this.isVisible && this.currentTarget) {
                this.updatePosition(this.currentTarget);
            }
        };

        window.addEventListener('resize', this.boundResizeHandler);
        window.addEventListener('scroll', this.boundScrollHandler, { passive: true });
    }

    private currentTarget: CaptureTarget | null = null;

    /**
     * Show overlay for a target
     */
    public show(target: CaptureTarget, locked = false): void {
        if (!this.overlay || target.type === 'NONE') {
            this.hide();
            return;
        }



        this.currentTarget = target;
        this.isVisible = true;
        this.isLocked = locked;

        this.overlay.className = locked
            ? 'ext-lw-capture-overlay ext-lw-capture-overlay-locked'
            : 'ext-lw-capture-overlay';

        this.overlay.style.display = 'block';

        this.updatePosition(target);
    }

    /**
     * Update overlay position based on target rect
     */
    private updatePosition(target: CaptureTarget): void {
        if (!this.overlay) return;

        // Get fresh rect if element available
        let rect = target.rect;
        if (target.elementRef) {
            rect = target.elementRef.getBoundingClientRect();
        }

        this.overlay.style.left = `${rect.left}px`;
        this.overlay.style.top = `${rect.top}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;

        // Also update target rect in case it changed
        if (target.elementRef) {
            target.rect = DOMRect.fromRect(rect);
        }
    }

    /**
     * Hide the overlay
     */
    public hide(): void {
        if (!this.overlay) return;

        this.isVisible = false;
        this.isLocked = false;
        this.currentTarget = null;
        this.overlay.className = 'ext-lw-capture-overlay ext-lw-capture-overlay-hidden';
        this.overlay.style.display = 'none';
    }

    /**
     * Lock the overlay (visual feedback for selection)
     */
    public lock(): void {
        if (!this.overlay) return;

        this.isLocked = true;
        this.overlay.classList.add('ext-lw-capture-overlay-locked');
    }

    /**
     * Unlock the overlay
     */
    public unlock(): void {
        if (!this.overlay) return;

        this.isLocked = false;
        this.overlay.classList.remove('ext-lw-capture-overlay-locked');
    }

    /**
     * Check if overlay is currently visible
     */
    public isShowing(): boolean {
        return this.isVisible;
    }

    /**
     * Check if overlay is locked
     */
    public isLockedState(): boolean {
        return this.isLocked;
    }

    /**
     * Show cycle position label (e.g., "img (2/5)")
     */
    public showLabel(text: string): void {
        if (!this.cycleLabel) return;

        // Clear any existing timeout
        if (this.labelTimeout) {
            clearTimeout(this.labelTimeout);
        }

        // Show label
        this.cycleLabel.textContent = text;
        this.cycleLabel.classList.remove('ext-lw-capture-cycle-label-hidden');

        // Auto-hide after 2 seconds
        this.labelTimeout = window.setTimeout(() => {
            this.hideLabel();
        }, 2000);
    }

    /**
     * Hide the cycle label
     */
    public hideLabel(): void {
        if (!this.cycleLabel) return;
        this.cycleLabel.classList.add('ext-lw-capture-cycle-label-hidden');
    }

    /**
     * Destroy the overlay
     */
    public destroy(): void {
        if (this.labelTimeout) {
            clearTimeout(this.labelTimeout);
        }
        // Remove window event listeners to prevent memory leaks
        if (this.boundResizeHandler) {
            window.removeEventListener('resize', this.boundResizeHandler);
            this.boundResizeHandler = null;
        }
        if (this.boundScrollHandler) {
            window.removeEventListener('scroll', this.boundScrollHandler);
            this.boundScrollHandler = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.targetIcon = null;
            this.cycleLabel = null;
        }
        this.currentTarget = null;
    }
}
