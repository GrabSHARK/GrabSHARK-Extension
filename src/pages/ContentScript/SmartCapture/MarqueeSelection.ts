// MarqueeSelection - Handles drag rectangle drawing and AABB intersection
// For multi-select of elements in Smart Capture

import { SelectableUnit, SelectableUnits } from './SelectableUnits';

/**
 * Selection modifier modes
 */
export type SelectionModifier = 'replace' | 'add' | 'subtract';

/**
 * MarqueeSelection - Draws selection rectangle and computes intersections
 */
export class MarqueeSelection {
    private overlay: HTMLDivElement | null = null;
    private isActive = false;
    private startPoint: { x: number; y: number } | null = null;
    private currentRect: DOMRect | null = null;
    private selectableUnits: SelectableUnits;
    private highlightOverlays: Map<Element, HTMLDivElement> = new Map();

    constructor(selectableUnits: SelectableUnits) {
        this.selectableUnits = selectableUnits;
        this.createOverlay();
    }

    /**
     * Create the marquee overlay element
     */
    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'ext-lw-marquee-overlay ext-lw-marquee-overlay-hidden';
        this.overlay.id = 'ext-lw-marquee-overlay';
        document.body.appendChild(this.overlay);
    }

    /**
     * Start marquee selection
     */
    public start(x: number, y: number): void {
        this.startPoint = { x, y };
        this.isActive = true;
        this.currentRect = new DOMRect(x, y, 0, 0);

        if (this.overlay) {
            this.overlay.classList.remove('ext-lw-marquee-overlay-hidden');
            this.updateOverlayPosition();
        }


    }

    /**
     * Update marquee while dragging
     */
    public update(x: number, y: number): SelectableUnit[] {
        if (!this.isActive || !this.startPoint) return [];

        // Calculate rectangle (handle dragging in any direction)
        const left = Math.min(this.startPoint.x, x);
        const top = Math.min(this.startPoint.y, y);
        const width = Math.abs(x - this.startPoint.x);
        const height = Math.abs(y - this.startPoint.y);

        this.currentRect = new DOMRect(left, top, width, height);
        this.updateOverlayPosition();

        // Find intersecting units
        const intersecting = this.selectableUnits.findUnitsInRect(this.currentRect);

        // Update highlights
        this.updateHighlights(intersecting);

        return intersecting;
    }

    /**
     * Finish marquee selection
     * @returns Array of selected units
     */
    public finish(): SelectableUnit[] {
        if (!this.isActive || !this.currentRect) {
            this.cancel();
            return [];
        }

        const selected = this.selectableUnits.findUnitsInRect(this.currentRect);


        this.cancel();
        return selected;
    }

    /**
     * Cancel marquee selection
     */
    public cancel(): void {
        this.isActive = false;
        this.startPoint = null;
        this.currentRect = null;

        if (this.overlay) {
            this.overlay.classList.add('ext-lw-marquee-overlay-hidden');
            this.overlay.style.width = '0';
            this.overlay.style.height = '0';
        }

        this.clearHighlights();
    }

    /**
     * Check if marquee is currently active
     */
    public isMarqueeActive(): boolean {
        return this.isActive;
    }

    /**
     * Get current marquee rect
     */
    public getCurrentRect(): DOMRect | null {
        return this.currentRect;
    }

    /**
     * Update overlay position and size
     */
    private updateOverlayPosition(): void {
        if (!this.overlay || !this.currentRect) return;

        this.overlay.style.left = `${this.currentRect.left}px`;
        this.overlay.style.top = `${this.currentRect.top}px`;
        this.overlay.style.width = `${this.currentRect.width}px`;
        this.overlay.style.height = `${this.currentRect.height}px`;
    }

    /**
     * Update highlight overlays for intersecting units
     */
    private updateHighlights(units: SelectableUnit[]): void {
        const unitElements = new Set(units.map(u => u.element));

        // Remove highlights for units no longer intersecting
        for (const [element, overlay] of this.highlightOverlays) {
            if (!unitElements.has(element)) {
                overlay.remove();
                this.highlightOverlays.delete(element);
            }
        }

        // Add highlights for new intersecting units
        for (const unit of units) {
            if (!this.highlightOverlays.has(unit.element)) {
                this.createUnitHighlight(unit);
            } else {
                // Update position
                this.updateUnitHighlight(unit);
            }
        }
    }

    /**
     * Create highlight overlay for a unit
     */
    private createUnitHighlight(unit: SelectableUnit): void {
        const highlight = document.createElement('div');
        highlight.className = 'ext-lw-marquee-unit-highlight';

        // Position
        highlight.style.left = `${unit.rect.left}px`;
        highlight.style.top = `${unit.rect.top}px`;
        highlight.style.width = `${unit.rect.width}px`;
        highlight.style.height = `${unit.rect.height}px`;

        document.body.appendChild(highlight);
        this.highlightOverlays.set(unit.element, highlight);
    }

    /**
     * Update position of existing highlight
     */
    private updateUnitHighlight(unit: SelectableUnit): void {
        const highlight = this.highlightOverlays.get(unit.element);
        if (!highlight) return;

        // Refresh rect from DOM
        const rect = unit.element.getBoundingClientRect();
        highlight.style.left = `${rect.left}px`;
        highlight.style.top = `${rect.top}px`;
        highlight.style.width = `${rect.width}px`;
        highlight.style.height = `${rect.height}px`;
    }

    /**
     * Clear all highlight overlays
     */
    private clearHighlights(): void {
        for (const overlay of this.highlightOverlays.values()) {
            overlay.remove();
        }
        this.highlightOverlays.clear();
    }

    /**
     * Destroy the marquee selection
     */
    public destroy(): void {
        this.cancel();
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}
