/**
 * SelectionManager - Manages selection state for Smart Capture
 * Handles toggle, multi-select, and persistent selection highlighting
 * 
 * Delegates target creation to selectionTargets.ts
 */

import { SelectableUnit } from './SelectableUnits';
import { CaptureTarget } from './types';
import { unitToCaptureTarget, createMergedTarget } from './selectionTargets';

export interface SelectionState {
    selectedUnits: SelectableUnit[];
    hoveredUnit: SelectableUnit | null;
}

export class SelectionManager {
    private selectedUnits: Map<Element, SelectableUnit> = new Map();
    private hoveredUnit: SelectableUnit | null = null;
    private selectionOverlays: Map<Element, HTMLDivElement> = new Map();
    private hoverOverlay: HTMLDivElement | null = null;
    private labelElement: HTMLDivElement | null = null;
    private containerElement: Element;

    constructor(containerElement?: Element) {
        this.containerElement = containerElement || document.body;
        this.createHoverOverlay();
        this.createLabelElement();
    }

    private createHoverOverlay(): void {
        this.hoverOverlay = document.createElement('div');
        this.hoverOverlay.className = 'ext-lw-selection-hover ext-lw-selection-hover-hidden';
        this.hoverOverlay.id = 'lw-selection-hover';
        this.containerElement.appendChild(this.hoverOverlay);
    }

    private createLabelElement(): void {
        this.labelElement = document.createElement('div');
        this.labelElement.className = 'ext-lw-selection-label ext-lw-selection-label-hidden';
        this.labelElement.id = 'lw-selection-label';
        this.containerElement.appendChild(this.labelElement);
    }

    public setHovered(unit: SelectableUnit | null): void {
        this.hoveredUnit = unit;
        this.updateHoverOverlay();
    }

    public toggleSelection(unit: SelectableUnit): boolean {
        if (this.selectedUnits.has(unit.element)) {
            this.removeFromSelection(unit);
            return false;
        } else {
            this.addToSelection(unit);
            return true;
        }
    }

    public addToSelection(unit: SelectableUnit): void {
        if (this.selectedUnits.has(unit.element)) return;
        this.selectedUnits.set(unit.element, unit);
        this.createSelectionOverlay(unit);
    }

    public removeFromSelection(unit: SelectableUnit): void {
        if (!this.selectedUnits.has(unit.element)) return;
        this.selectedUnits.delete(unit.element);
        this.removeSelectionOverlay(unit);
    }

    public setSelection(units: SelectableUnit[]): void {
        this.clearSelection();
        for (const unit of units) this.addToSelection(unit);
    }

    public addMultipleToSelection(units: SelectableUnit[]): void {
        for (const unit of units) this.addToSelection(unit);
    }

    public removeMultipleFromSelection(units: SelectableUnit[]): void {
        for (const unit of units) this.removeFromSelection(unit);
    }

    public clearSelection(): void {
        for (const [_, overlay] of this.selectionOverlays) overlay.remove();
        this.selectionOverlays.clear();
        this.selectedUnits.clear();
    }

    public getSelectedUnits(): SelectableUnit[] { return Array.from(this.selectedUnits.values()); }
    public getSelectionCount(): number { return this.selectedUnits.size; }
    public isSelected(unit: SelectableUnit): boolean { return this.selectedUnits.has(unit.element); }
    public getHoveredUnit(): SelectableUnit | null { return this.hoveredUnit; }

    private createSelectionOverlay(unit: SelectableUnit): void {
        const overlay = document.createElement('div');
        overlay.className = 'ext-lw-selection-selected';
        this.updateOverlayPosition(overlay, unit.rect);
        this.containerElement.appendChild(overlay);
        this.selectionOverlays.set(unit.element, overlay);
    }

    private removeSelectionOverlay(unit: SelectableUnit): void {
        const overlay = this.selectionOverlays.get(unit.element);
        if (overlay) { overlay.remove(); this.selectionOverlays.delete(unit.element); }
    }

    private updateHoverOverlay(): void {
        if (!this.hoverOverlay || !this.labelElement) return;

        if (!this.hoveredUnit) {
            this.hoverOverlay.classList.add('ext-lw-selection-hover-hidden');
            this.labelElement.classList.add('ext-lw-selection-label-hidden');
            return;
        }

        if (this.selectedUnits.has(this.hoveredUnit.element)) {
            this.hoverOverlay.classList.add('ext-lw-selection-hover-hidden');
            this.labelElement.classList.remove('ext-lw-selection-label-hidden');
            this.updateLabel(this.hoveredUnit);
            return;
        }

        const rect = this.hoveredUnit.element.getBoundingClientRect();
        this.updateOverlayPosition(this.hoverOverlay, rect);
        this.hoverOverlay.classList.remove('ext-lw-selection-hover-hidden');
        this.updateLabel(this.hoveredUnit);
    }

    private updateLabel(unit: SelectableUnit): void {
        if (!this.labelElement) return;
        this.labelElement.textContent = this.getLabelText(unit);
        this.labelElement.classList.remove('ext-lw-selection-label-hidden');
        const rect = unit.element.getBoundingClientRect();
        this.labelElement.style.left = `${rect.left}px`;
        this.labelElement.style.top = `${Math.max(0, rect.top - 20)}px`;
    }

    private getLabelText(unit: SelectableUnit): string {
        const tagName = unit.element.tagName.toLowerCase();
        const isSelected = this.selectedUnits.has(unit.element);
        const prefix = isSelected ? '✓ ' : '';
        const tagMap: Record<string, string> = {
            'button': 'BTN', 'a': 'LINK', 'img': 'IMG', 'video': 'VID', 'input': 'INPUT',
            'h1': 'H1', 'h2': 'H2', 'h3': 'H3', 'h4': 'H4', 'p': 'P', 'li': 'LI',
            'div': 'DIV', 'section': 'SEC', 'article': 'ART', 'nav': 'NAV', 'svg': 'SVG',
        };
        return prefix + (tagMap[tagName] || tagName.toUpperCase());
    }

    private getNavbarHeight(): number {
        const contentContainer = document.querySelector('[data-ext-lw-link-id]');
        if (contentContainer) {
            const rect = contentContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) return rect.top;
        }
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) return rect.top;
        }
        const bgContainer = document.querySelector('[class*="bg-base-200"]');
        if (bgContainer) {
            const rect = bgContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) return rect.top;
        }
        return 52;
    }

    private getViewportBottom(): number {
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) return rect.bottom;
        }
        return window.innerHeight;
    }

    private updateOverlayPosition(overlay: HTMLDivElement, rect: DOMRect): void {
        const padding = 8;
        const navbarHeight = this.getNavbarHeight();
        const minY = navbarHeight;
        const maxY = this.getViewportBottom();
        const minX = 0;
        const maxX = window.innerWidth;

        const isVisible = rect.bottom > minY && rect.top < maxY && rect.right > minX && rect.left < maxX;

        if (!isVisible) {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            return;
        }

        overlay.style.opacity = '';
        overlay.style.pointerEvents = '';

        let top = rect.top - padding;
        let left = rect.left - padding;
        let height = rect.height + (padding * 2);
        let width = rect.width + (padding * 2);

        if (top < minY) { const overflow = minY - top; top = minY; height = Math.max(0, height - overflow); }
        if (top + height > maxY) { height = Math.max(0, maxY - top); }
        if (left < minX) { const overflow = minX - left; left = minX; width = Math.max(0, width - overflow); }
        if (left + width > maxX) { width = Math.max(0, maxX - left); }

        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    public refreshOverlays(): void {
        for (const [element, overlay] of this.selectionOverlays) {
            this.updateOverlayPosition(overlay, element.getBoundingClientRect());
        }
        this.updateHoverOverlay();
    }

    public createCaptureTarget(): CaptureTarget | null {
        const units = this.getSelectedUnits();
        if (units.length === 0) return null;
        if (units.length === 1) return unitToCaptureTarget(units[0]);
        return createMergedTarget(units);
    }

    public getSelectionSummary(): {
        count: number; hasImages: boolean; hasLinks: boolean; hasText: boolean; imageCount: number; linkCount: number;
    } {
        const units = this.getSelectedUnits();
        let imageCount = 0, linkCount = 0, hasText = false;
        for (const unit of units) {
            if (unit.hasMedia || unit.captureType === 'IMAGE') imageCount++;
            if (unit.hasLinks || unit.captureType === 'LINK') linkCount++;
            if (unit.hasText) hasText = true;
        }
        return { count: units.length, hasImages: imageCount > 0, hasLinks: linkCount > 0, hasText, imageCount, linkCount };
    }

    public hideHover(): void {
        this.hoverOverlay?.classList.add('ext-lw-selection-hover-hidden');
        this.labelElement?.classList.add('ext-lw-selection-label-hidden');
    }

    public destroy(): void {
        this.clearSelection();
        this.hoverOverlay?.remove();
        this.labelElement?.remove();
        this.hoverOverlay = null;
        this.labelElement = null;
    }
}
