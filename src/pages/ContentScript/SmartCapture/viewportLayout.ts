/**
 * Shared Viewport Layout Utilities
 * Used by CaptureActionBar and SelectionManager for positioning and viewport detection
 */

import { CaptureTarget } from './types';

/**
 * Get the navbar/header height for the current context
 * Detects SPARK's modal header to properly clamp overlays and menus
 */
export function getNavbarHeight(): number {
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

/**
 * Get the viewport bottom boundary for the current context
 * Detects SPARK's scroll container bottom to properly clamp overlays and menus
 */
export function getViewportBottom(): number {
    const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
    for (const container of scrollContainers) {
        const rect = container.getBoundingClientRect();
        if (rect.height > 200 && rect.top > 0 && rect.top < 200) return rect.bottom;
    }
    return window.innerHeight;
}

/**
 * Get the live bounding rect for a CaptureTarget, including multi-block selections
 */
export function getTargetRect(target: CaptureTarget): DOMRect {
    if (target.elementRef) {
        return target.elementRef.getBoundingClientRect();
    }

    if (target.selectedTargets && target.selectedTargets.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let hasValidRef = false;

        for (const subTarget of target.selectedTargets) {
            if (subTarget.elementRef) {
                const subRect = subTarget.elementRef.getBoundingClientRect();
                minX = Math.min(minX, subRect.left);
                minY = Math.min(minY, subRect.top);
                maxX = Math.max(maxX, subRect.right);
                maxY = Math.max(maxY, subRect.bottom);
                hasValidRef = true;
            }
        }

        if (hasValidRef) {
            return new DOMRect(minX, minY, maxX - minX, maxY - minY);
        }
    }

    return target.rect;
}

/**
 * Position a floating bar (action bar, menu) relative to a target element
 * Uses viewport-clamped positioning with above/below/centered strategies
 */
export function positionFloatingBar(
    host: HTMLDivElement,
    container: HTMLDivElement,
    target: CaptureTarget
): 'above' | 'below' | 'centered' {
    const rect = getTargetRect(target);
    const navHeight = getNavbarHeight();
    const viewportWidth = window.innerWidth;
    const viewBottom = getViewportBottom();
    const padding = 10;
    const gap = 16;

    const isTargetVisible = rect.bottom > navHeight && rect.top < viewBottom;

    if (!isTargetVisible) {
        host.style.opacity = '0';
        host.style.pointerEvents = 'none';
        return 'below';
    }

    host.style.opacity = '';
    host.style.pointerEvents = '';

    const barRect = container.getBoundingClientRect();
    let left = rect.left + (rect.width / 2) - (barRect.width / 2);
    let top: number;
    let position: 'above' | 'below' | 'centered' = 'below';

    const spaceBelow = viewBottom - rect.bottom - gap - padding;
    const spaceAbove = rect.top - navHeight - gap - padding;

    if (spaceBelow >= barRect.height) {
        top = rect.bottom + gap;
        position = 'below';
    } else if (spaceAbove >= barRect.height) {
        top = rect.top - barRect.height - gap;
        position = 'above';
    } else {
        const visibleTop = Math.max(rect.top, navHeight);
        const visibleBottom = Math.min(rect.bottom, viewBottom);
        top = (visibleTop + visibleBottom) / 2 - (barRect.height / 2);
        position = 'centered';

        if (top < navHeight + padding) top = navHeight + padding;
        if (top + barRect.height > viewBottom - padding) top = viewBottom - barRect.height - padding;
    }

    if (left < padding) left = padding;
    else if (left + barRect.width > viewportWidth - padding) left = viewportWidth - barRect.width - padding;

    host.style.left = `${left}px`;
    host.style.top = `${top}px`;

    return position;
}
