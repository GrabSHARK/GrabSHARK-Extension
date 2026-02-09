import { CaptureTarget } from '../SmartCapture';

/**
 * Filter out nested targets to ensuring lastRef is the true container
 */
export function filterNestedTargets(targets: CaptureTarget[]): CaptureTarget[] {
    if (targets.length <= 1) return targets;

    return targets.filter(target => {
        if (!target.elementRef) return false;
        // Check if this target is contained within any other target in the list
        return !targets.some(parent =>
            parent !== target &&
            parent.elementRef &&
            parent.elementRef.contains(target.elementRef as Node)
        );
    });
}

/**
 * Helper to find first and last text nodes in an element
 */
export function getFirstAndLastTextNode(element: Element): { first: Node | null, last: Node | null } {
    try {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        const first = walker.nextNode();
        let last = first;
        while (walker.nextNode()) {
            last = walker.currentNode;
        }
        return { first, last };
    } catch (e) {
        return { first: null, last: null };
    }
}

/**
 * Hide all Smart Capture overlays for clean screenshot
 * Returns array of hidden elements for later restoration
 */
export function hideAllSmartCaptureOverlays(): HTMLElement[] {
    const hiddenClass = 'ext-lw-hidden-for-screenshot';
    const hiddenElements: HTMLElement[] = [];

    // All overlay selectors to hide
    const selectors = [
        '#ext-lw-capture-overlay',           // Old capture overlay
        '#ext-lw-capture-actionbar',         // Action bar (container inside shadow)
        '#ext-lw-capture-actionbar-host',    // Action bar host (shadow DOM host element)
        '#ext-lw-selection-hover',           // Hover overlay
        '#ext-lw-selection-label',           // Type label
        '.ext-lw-selection-selected',        // Selected unit overlays (multiple)
        '.ext-lw-marquee-overlay',           // Marquee rectangle
        '.ext-lw-marquee-unit-highlight',    // Marquee unit highlights (multiple)
        '.ext-lw-hint-toast',                // Hint toast
        '.ext-lw-toast',                     // Regular toasts
    ];

    for (const selector of selectors) {
        const elements = document.querySelectorAll<HTMLElement>(selector);
        elements.forEach(el => {
            if (el && !el.classList.contains(hiddenClass)) {
                el.classList.add(hiddenClass);
                hiddenElements.push(el);
            }
        });
    }


    return hiddenElements;
}

/**
 * Restore previously hidden overlays
 */
export function showAllSmartCaptureOverlays(elements: HTMLElement[]): void {
    const hiddenClass = 'ext-lw-hidden-for-screenshot';

    for (const el of elements) {
        if (el && el.isConnected) {
            el.classList.remove(hiddenClass);
        }
    }


}

/**
 * Wait for browser to complete a repaint cycle
 * Uses double rAF + microtask to ensure DOM changes are rendered
 */
export function waitForRepaint(): Promise<void> {
    return new Promise(resolve => {
        // Force style recalculation
        document.body.offsetHeight;

        // Double requestAnimationFrame ensures paint completion
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Use queueMicrotask for extra safety
                queueMicrotask(() => {
                    resolve();
                });
            });
        });
    });
}
