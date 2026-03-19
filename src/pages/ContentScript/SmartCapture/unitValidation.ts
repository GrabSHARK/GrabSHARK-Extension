/**
 * Unit Validation - Element checking & type detection for SelectableUnits
 * Extracted from SelectableUnits class
 */

import { CaptureTargetType } from './types';
import { UnitType, SelectableUnit } from './SelectableUnits';

const MIN_UNIT_SIZE = 8;
const MAX_AREA_RATIO = 0.6;
const STRICT_AREA_RATIO = 0.4;

/**
 * Determine the CaptureTargetType for an element
 */
export function getCaptureType(element: Element, type: UnitType): CaptureTargetType {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'a' && element.getAttribute('href')) return 'LINK';
    if (['img', 'picture', 'svg', 'canvas'].includes(tagName)) return 'IMAGE';
    if (tagName === 'video') return 'VIDEO';
    if (hasBackgroundImage(element)) return 'IMAGE';
    if (type === 'TEXT') return 'TEXT_BLOCK';
    return 'GENERIC_BLOCK';
}

/**
 * Check if element has background image
 */
export function hasBackgroundImage(element: Element): boolean {
    try {
        const style = window.getComputedStyle(element);
        return Boolean(style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url('));
    } catch { return false; }
}

/**
 * Check if a unit is valid (passes all filters)
 */
export function isValidUnit(unit: SelectableUnit, viewportArea: number): boolean {
    const rect = unit.rect;
    if (rect.width < MIN_UNIT_SIZE || rect.height < MIN_UNIT_SIZE) {
        if (unit.type !== 'INTERACTIVE') return false;
    }
    const maxRatio = unit.priority <= 2 ? MAX_AREA_RATIO : STRICT_AREA_RATIO;
    if (unit.area / viewportArea > maxRatio) return false;
    if (!isVisible(unit.element)) return false;
    if (rect.right < 0 || rect.left > window.innerWidth) return false;
    return true;
}

/**
 * Check if element is visible
 */
export function isVisible(element: Element): boolean {
    try {
        const style = window.getComputedStyle(element);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
        if (parseFloat(style.opacity) === 0) return false;
        if (style.pointerEvents === 'none') return false;
        return true;
    } catch { return true; }
}

/**
 * Check if element is our extension UI
 */
export function isOurUI(element: Element): boolean {
    if (element.closest('.lw-capture-actionbar') || element.closest('.lw-toolbox') || element.closest('.lw-toast')) return true;
    if (element.id?.startsWith('lw-')) return true;
    return false;
}

/**
 * Check if element has significant text content
 */
export function hasSignificantText(element: Element): boolean {
    return (element.textContent?.trim() || '').length > 5;
}

/**
 * Check if element contains media
 */
export function containsMedia(element: Element): boolean {
    if (['img', 'video', 'svg', 'canvas', 'picture'].includes(element.tagName.toLowerCase())) return true;
    return element.querySelector('img, video, svg, canvas, picture') !== null;
}

/**
 * Check if element contains links
 */
export function containsLinks(element: Element): boolean {
    if (element.tagName.toLowerCase() === 'a' && element.getAttribute('href')) return true;
    return element.querySelector('a[href]') !== null;
}

/**
 * Check if div has meaningful content (not just wrapper)
 */
export function hasMeaningfulContent(element: Element): boolean {
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE && (child.textContent?.trim() || '').length > 20) return true;
    }
    for (const child of element.children) {
        if (['img', 'video', 'canvas', 'svg'].includes(child.tagName.toLowerCase())) return true;
    }
    return false;
}
