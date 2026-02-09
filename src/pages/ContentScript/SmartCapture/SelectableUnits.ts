// SelectableUnits - Scans DOM for selectable units, caches them, and provides filtering
// This is the foundation for precision element selection in Smart Capture

import { CaptureTargetType } from './types';

/** Minimum unit size in pixels */
const MIN_UNIT_SIZE = 8;

/** Maximum area ratio relative to viewport (60%) */
const MAX_AREA_RATIO = 0.6;
/** Stricter ratio for Fallback/UI/Text containers to avoid page wrappers (40%) */
const STRICT_AREA_RATIO = 0.4;

/** Maximum number of units to scan */
const MAX_UNITS = 10000;

/** Selectable unit priority selectors - higher priority = more specific */
export const UNIT_SELECTORS = {
    // Priority 1: Interactive elements
    INTERACTIVE: [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[role="tab"]',
        '[onclick]',
        '[tabindex]:not([tabindex="-1"])',
    ],
    // Priority 2: Media elements
    MEDIA: [
        'img',
        'video',
        'picture',
        'svg',
        'canvas',
        'audio',
        'iframe',
    ],
    // Priority 3: Text blocks
    TEXT_BLOCKS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p',
        'li',
        'blockquote',
        'pre',
        'code',
        'figcaption',
        'caption',
        'label',
        'span[class]', // Styled spans often contain meaningful text
    ],
    // Priority 4: UI structural blocks
    UI_BLOCKS: [
        'nav',
        'header',
        'footer',
        'aside',
        'menu',
        'table',
        'tr',
        'td',
        'th',
        'article',
        'section',
        'figure',
        'form',
    ],
    // Priority 5: Fallback containers (with content check)
    FALLBACK: [
        'div',
    ],
};

/** Unit type for classification */
export type UnitType = 'INTERACTIVE' | 'MEDIA' | 'TEXT' | 'UI' | 'FALLBACK';

/** A selectable unit with metadata */
export interface SelectableUnit {
    element: Element;
    type: UnitType;
    captureType: CaptureTargetType;
    rect: DOMRect;
    priority: number; // Lower = higher priority (1 = interactive)
    area: number;
    hasText: boolean;
    hasMedia: boolean;
    hasLinks: boolean;
}

/**
 * SelectableUnits - Scans and caches DOM elements that can be selected
 */
export class SelectableUnits {
    private units: SelectableUnit[] = [];
    private unitMap: WeakMap<Element, SelectableUnit> = new WeakMap();
    private viewportArea: number = 0;
    private lastScanTime: number = 0;
    private scanThrottleMs: number = 500;
    private containerElement: Element | null = null;

    /**
     * Set a container selector to scope scanning
     * Only elements within this container will be scanned
     */
    public setContainerSelector(selector: string | null): void {
        this.containerElement = selector ? document.querySelector(selector) : null;
    }

    /**
     * Scan the DOM for selectable units
     * @param forceRescan Force a new scan even if recently scanned
     */
    public scan(forceRescan = false): SelectableUnit[] {
        const now = Date.now();
        if (!forceRescan && now - this.lastScanTime < this.scanThrottleMs && this.units.length > 0) {
            return this.units;
        }




        this.units = [];
        this.unitMap = new WeakMap();
        this.viewportArea = window.innerWidth * window.innerHeight;

        // Scan each priority level
        this.scanPriority('INTERACTIVE', UNIT_SELECTORS.INTERACTIVE, 1);
        this.scanPriority('MEDIA', UNIT_SELECTORS.MEDIA, 2);
        this.scanPriority('TEXT', UNIT_SELECTORS.TEXT_BLOCKS, 3);
        this.scanPriority('UI', UNIT_SELECTORS.UI_BLOCKS, 4);
        this.scanFallbackDivs();

        // Sort by priority, then by area (smaller first)
        this.units.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.area - b.area;
        });

        // Limit total units
        if (this.units.length > MAX_UNITS) {
            this.units = this.units.slice(0, MAX_UNITS);
        }

        this.lastScanTime = now;


        return this.units;
    }

    /**
     * Scan a specific priority level
     */
    private scanPriority(type: UnitType, selectors: string[], priority: number): void {
        const selector = selectors.join(', ');
        const root = this.containerElement || document;
        const elements = root.querySelectorAll(selector);

        for (const element of elements) {
            if (this.unitMap.has(element)) continue; // Already added at higher priority
            if (this.isOurUI(element)) continue;

            const unit = this.createUnit(element, type, priority);
            if (unit && this.isValidUnit(unit)) {
                this.units.push(unit);
                this.unitMap.set(element, unit);
            }
        }
    }

    /**
     * Scan fallback divs that have meaningful content
     */
    private scanFallbackDivs(): void {
        // Only scan divs that are likely to be content containers
        const root = this.containerElement || document;
        const divs = root.querySelectorAll('div');

        for (const div of divs) {
            if (this.unitMap.has(div)) continue;
            if (this.isOurUI(div)) continue;

            // Check if div has meaningful content
            if (!this.hasMeaningfulContent(div)) continue;

            const unit = this.createUnit(div, 'FALLBACK', 5);
            if (unit && this.isValidUnit(unit)) {
                // Extra filter for fallback: must not be too big
                if (unit.area / this.viewportArea > 0.4) continue; // 40% for fallback

                this.units.push(unit);
                this.unitMap.set(div, unit);
            }
        }
    }

    /**
     * Create a SelectableUnit from an element
     */
    private createUnit(element: Element, type: UnitType, priority: number): SelectableUnit | null {
        const rect = element.getBoundingClientRect();

        // Basic visibility check
        if (rect.width === 0 || rect.height === 0) return null;

        const area = rect.width * rect.height;

        return {
            element,
            type,
            captureType: this.getCaptureType(element, type),
            rect: DOMRect.fromRect(rect),
            priority,
            area,
            hasText: this.hasSignificantText(element),
            hasMedia: this.containsMedia(element),
            hasLinks: this.containsLinks(element),
        };
    }

    /**
     * Determine the CaptureTargetType for an element
     */
    private getCaptureType(element: Element, type: UnitType): CaptureTargetType {
        const tagName = element.tagName.toLowerCase();

        if (tagName === 'a' && element.getAttribute('href')) {
            return 'LINK';
        }
        if (tagName === 'img' || tagName === 'picture' || tagName === 'svg' || tagName === 'canvas') {
            return 'IMAGE';
        }
        if (tagName === 'video') {
            return 'VIDEO';
        }
        if (this.hasBackgroundImage(element)) {
            return 'IMAGE';
        }
        if (type === 'TEXT') {
            return 'TEXT_BLOCK';
        }
        return 'GENERIC_BLOCK';
    }

    /**
     * Check if element has background image
     */
    private hasBackgroundImage(element: Element): boolean {
        try {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            return Boolean(bgImage && bgImage !== 'none' && bgImage.includes('url('));
        } catch {
            return false;
        }
    }

    /**
     * Check if a unit is valid (passes all filters)
     */
    private isValidUnit(unit: SelectableUnit): boolean {
        const rect = unit.rect;

        // Too small (unless it's an interactive element)
        if (rect.width < MIN_UNIT_SIZE || rect.height < MIN_UNIT_SIZE) {
            if (unit.type !== 'INTERACTIVE') return false;
        }

        // Too big (unless high priority)
        // High priority (1=Interactive, 2=Media) can be large (e.g. big image/video)
        // Low priority (3=Text, 4=UI, 5=Fallback) should not cover the whole screen
        const maxRatio = unit.priority <= 2 ? MAX_AREA_RATIO : STRICT_AREA_RATIO;

        if (unit.area / this.viewportArea > maxRatio) {
            return false;
        }

        // Visibility checks
        if (!this.isVisible(unit.element)) return false;

        // Out of viewport (horizontally)
        if (rect.right < 0 || rect.left > window.innerWidth) return false;

        return true;
    }

    /**
     * Check if element is visible
     */
    private isVisible(element: Element): boolean {
        try {
            const style = window.getComputedStyle(element);
            if (style.display === 'none') return false;
            if (style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) === 0) return false;
            if (style.pointerEvents === 'none') return false;
            return true;
        } catch {
            return true; // Assume visible if we can't check
        }
    }

    /**
     * Check if element is our UI
     */
    private isOurUI(element: Element): boolean {
        // Use closest to check if element is inside any of our UI containers
        if (element.closest('.lw-capture-actionbar') ||
            element.closest('.lw-toolbox') ||
            element.closest('.lw-toast')) {
            return true;
        }

        // Legacy checks for safety (e.g. if element is detached or specific IDs)
        if (element.id?.startsWith('lw-')) return true;

        return false;
    }

    /**
     * Check if element has significant text content
     */
    private hasSignificantText(element: Element): boolean {
        const text = element.textContent?.trim() || '';
        return text.length > 5; // More than 5 chars
    }

    /**
     * Check if element contains media
     */
    private containsMedia(element: Element): boolean {
        if (['img', 'video', 'svg', 'canvas', 'picture'].includes(element.tagName.toLowerCase())) {
            return true;
        }
        return element.querySelector('img, video, svg, canvas, picture') !== null;
    }

    /**
     * Check if element contains links
     */
    private containsLinks(element: Element): boolean {
        if (element.tagName.toLowerCase() === 'a' && element.getAttribute('href')) {
            return true;
        }
        return element.querySelector('a[href]') !== null;
    }

    /**
     * Check if div has meaningful content (not just wrapper)
     */
    private hasMeaningfulContent(element: Element): boolean {
        // Check for direct text content (not just nested)
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim() || '';
                if (text.length > 20) return true;
            }
        }
        // Check for direct media children
        for (const child of element.children) {
            if (['img', 'video', 'canvas', 'svg'].includes(child.tagName.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all cached units
     */
    public getUnits(): SelectableUnit[] {
        return this.units;
    }

    /**
     * Get unit for a specific element
     */
    public getUnitForElement(element: Element): SelectableUnit | undefined {
        return this.unitMap.get(element);
    }

    /**
     * Find units that intersect with a rectangle (for marquee selection)
     */
    public findUnitsInRect(rect: DOMRect): SelectableUnit[] {
        return this.units.filter(unit => this.rectsIntersect(unit.rect, rect));
    }

    /**
     * Check if two rects intersect (AABB)
     */
    private rectsIntersect(a: DOMRect, b: DOMRect): boolean {
        return !(
            a.right < b.left ||
            a.left > b.right ||
            a.bottom < b.top ||
            a.top > b.bottom
        );
    }

    /**
     * Find the best unit at a specific point
     */
    public findUnitAtPoint(x: number, y: number): SelectableUnit | null {
        // Use elementsFromPoint for precision
        const elements = document.elementsFromPoint(x, y);

        for (const element of elements) {
            // If we hit our own UI (toolbox, action bar, etc.), stop looking.
            // This prevents selecting things "behind" our UI.
            if (this.isOurUI(element)) return null;

            // Check if this element is a unit
            const unit = this.unitMap.get(element);
            if (unit) return unit;

            // Walk up to find a unit (max 8 levels)
            let parent = element.parentElement;
            let depth = 0;
            while (parent && depth < 8) {
                // If finding parent hits our UI (unlikely for nested, but possible if shadow/slot), break?
                // Actually isOurUI check above handles the direct hit.

                const parentUnit = this.unitMap.get(parent);
                if (parentUnit) return parentUnit;
                parent = parent.parentElement;
                depth++;
            }
        }

        return null;
    }

    /**
     * Refresh rects for all units (after scroll/resize)
     */
    public refreshRects(): void {
        for (const unit of this.units) {
            unit.rect = unit.element.getBoundingClientRect();
            unit.area = unit.rect.width * unit.rect.height;
        }
        this.viewportArea = window.innerWidth * window.innerHeight;
    }

    /**
     * Clear cache
     */
    public clear(): void {
        this.units = [];
        this.unitMap = new WeakMap();
        this.lastScanTime = 0;
    }
}
