/**
 * SelectableUnits - Scans DOM for selectable units, caches them, and provides filtering
 * This is the foundation for precision element selection in Smart Capture
 * 
 * Delegates validation/type-detection to unitValidation.ts
 */

import { CaptureTargetType } from './types';
import {
    getCaptureType,
    isValidUnit,
    isOurUI,
    hasSignificantText,
    containsMedia,
    containsLinks,
    hasMeaningfulContent,
} from './unitValidation';

/** Maximum number of units to scan */
const MAX_UNITS = 10000;

/** Selectable unit priority selectors */
export const UNIT_SELECTORS = {
    INTERACTIVE: [
        'a[href]', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]',
        '[onclick]', '[tabindex]:not([tabindex="-1"])',
    ],
    MEDIA: ['img', 'video', 'picture', 'svg', 'canvas', 'audio', 'iframe'],
    TEXT_BLOCKS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote',
        'pre', 'code', 'figcaption', 'caption', 'label', 'span[class]',
    ],
    UI_BLOCKS: [
        'nav', 'header', 'footer', 'aside', 'menu', 'table',
        'tr', 'td', 'th', 'article', 'section', 'figure', 'form',
    ],
    FALLBACK: ['div'],
};

/** Unit type for classification */
export type UnitType = 'INTERACTIVE' | 'MEDIA' | 'TEXT' | 'UI' | 'FALLBACK';

/** A selectable unit with metadata */
export interface SelectableUnit {
    element: Element;
    type: UnitType;
    captureType: CaptureTargetType;
    rect: DOMRect;
    priority: number;
    area: number;
    hasText: boolean;
    hasMedia: boolean;
    hasLinks: boolean;
}

export class SelectableUnits {
    private units: SelectableUnit[] = [];
    private unitMap: WeakMap<Element, SelectableUnit> = new WeakMap();
    private viewportArea: number = 0;
    private lastScanTime: number = 0;
    private scanThrottleMs: number = 500;
    private containerElement: Element | null = null;

    public setContainerSelector(selector: string | null): void {
        this.containerElement = selector ? document.querySelector(selector) : null;
    }

    public scan(forceRescan = false): SelectableUnit[] {
        const now = Date.now();
        if (!forceRescan && now - this.lastScanTime < this.scanThrottleMs && this.units.length > 0) return this.units;

        this.units = [];
        this.unitMap = new WeakMap();
        this.viewportArea = window.innerWidth * window.innerHeight;

        this.scanPriority('INTERACTIVE', UNIT_SELECTORS.INTERACTIVE, 1);
        this.scanPriority('MEDIA', UNIT_SELECTORS.MEDIA, 2);
        this.scanPriority('TEXT', UNIT_SELECTORS.TEXT_BLOCKS, 3);
        this.scanPriority('UI', UNIT_SELECTORS.UI_BLOCKS, 4);
        this.scanFallbackDivs();

        this.units.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : a.area - b.area);
        if (this.units.length > MAX_UNITS) this.units = this.units.slice(0, MAX_UNITS);
        this.lastScanTime = now;
        return this.units;
    }

    private scanPriority(type: UnitType, selectors: string[], priority: number): void {
        const root = this.containerElement || document;
        const elements = root.querySelectorAll(selectors.join(', '));
        for (const element of elements) {
            if (this.unitMap.has(element) || isOurUI(element)) continue;
            const unit = this.createUnit(element, type, priority);
            if (unit && isValidUnit(unit, this.viewportArea)) {
                this.units.push(unit);
                this.unitMap.set(element, unit);
            }
        }
    }

    private scanFallbackDivs(): void {
        const root = this.containerElement || document;
        for (const div of root.querySelectorAll('div')) {
            if (this.unitMap.has(div) || isOurUI(div) || !hasMeaningfulContent(div)) continue;
            const unit = this.createUnit(div, 'FALLBACK', 5);
            if (unit && isValidUnit(unit, this.viewportArea)) {
                if (unit.area / this.viewportArea > 0.4) continue;
                this.units.push(unit);
                this.unitMap.set(div, unit);
            }
        }
    }

    private createUnit(element: Element, type: UnitType, priority: number): SelectableUnit | null {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return {
            element, type, captureType: getCaptureType(element, type),
            rect: DOMRect.fromRect(rect), priority, area: rect.width * rect.height,
            hasText: hasSignificantText(element), hasMedia: containsMedia(element), hasLinks: containsLinks(element),
        };
    }

    public getUnits(): SelectableUnit[] { return this.units; }

    public getUnitForElement(element: Element): SelectableUnit | undefined { return this.unitMap.get(element); }

    public findUnitsInRect(rect: DOMRect): SelectableUnit[] {
        return this.units.filter(unit => !(unit.rect.right < rect.left || unit.rect.left > rect.right || unit.rect.bottom < rect.top || unit.rect.top > rect.bottom));
    }

    public findUnitAtPoint(x: number, y: number): SelectableUnit | null {
        for (const element of document.elementsFromPoint(x, y)) {
            if (isOurUI(element)) return null;
            const unit = this.unitMap.get(element);
            if (unit) return unit;
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 8) {
                const parentUnit = this.unitMap.get(parent);
                if (parentUnit) return parentUnit;
                parent = parent.parentElement;
                depth++;
            }
        }
        return null;
    }

    public refreshRects(): void {
        for (const unit of this.units) {
            unit.rect = unit.element.getBoundingClientRect();
            unit.area = unit.rect.width * unit.rect.height;
        }
        this.viewportArea = window.innerWidth * window.innerHeight;
    }

    public clear(): void {
        this.units = [];
        this.unitMap = new WeakMap();
        this.lastScanTime = 0;
    }
}
