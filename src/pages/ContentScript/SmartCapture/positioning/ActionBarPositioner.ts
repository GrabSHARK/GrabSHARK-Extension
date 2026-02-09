/**
 * ActionBarPositioner - Position calculation for CaptureActionBar
 * 
 * Features:
 * - Detect navbar/header height (Linkwarden modal headers)
 * - Detect viewport boundaries (scroll containers)
 * - Calculate optimal position (above/below/centered)
 * - Clamp to visible area
 * - Handle scroll offsets
 * 
 * Used by: CaptureActionBar
 */

import { CaptureTarget } from '../types';

export type PositionPlacement = 'above' | 'below' | 'centered';

export interface PositionResult {
    left: number;
    top: number;
    placement: PositionPlacement;
    isVisible: boolean;
}

export interface PositionerOptions {
    /** Gap between target and menu */
    gap?: number;
    /** Padding from viewport edges */
    padding?: number;
}

export class ActionBarPositioner {
    private static readonly DEFAULT_GAP = 16;
    private static readonly DEFAULT_PADDING = 10;
    private static readonly DEFAULT_NAVBAR_HEIGHT = 52;

    /**
     * Get the navbar/header height for the current context
     * Detects Linkwarden's modal header to properly clamp the action bar
     */
    public static getNavbarHeight(): number {
        // Method 1: Find the readable content container (has data-ext-lw-link-id)
        // Its top position is where content starts (below navbar)
        const contentContainer = document.querySelector('[data-ext-lw-link-id]');
        if (contentContainer) {
            const rect = contentContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) {
                return rect.top;
            }
        }

        // Method 2: Find any element with overflow-auto class that's a scroll container
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) {
                return rect.top;
            }
        }

        // Method 3: Look for bg-base-200 container
        const bgContainer = document.querySelector('[class*="bg-base-200"]');
        if (bgContainer) {
            const rect = bgContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) {
                return rect.top;
            }
        }

        // Default fallback
        return ActionBarPositioner.DEFAULT_NAVBAR_HEIGHT;
    }

    /**
     * Get the viewport bottom boundary for the current context
     * Detects Linkwarden's scroll container bottom to properly clamp the action bar
     */
    public static getViewportBottom(): number {
        // Find the scroll container - its bottom position is where content ends
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) {
                return rect.bottom;
            }
        }

        // Default: use window height
        return window.innerHeight;
    }

    /**
     * Calculate optimal position for action bar relative to target
     */
    public static calculatePosition(
        target: CaptureTarget,
        containerWidth: number,
        containerHeight: number,
        options?: PositionerOptions
    ): PositionResult {
        const gap = options?.gap ?? ActionBarPositioner.DEFAULT_GAP;
        const padding = options?.padding ?? ActionBarPositioner.DEFAULT_PADDING;

        // Get current viewport-relative rect (updates on scroll)
        const rect = target.elementRef?.getBoundingClientRect() || target.rect;

        // Calculate navbar height to account for modal header
        const navbarHeight = ActionBarPositioner.getNavbarHeight();

        // Viewport boundaries (using scroll container bounds, not window)
        const viewportWidth = window.innerWidth;
        const viewportBottom = ActionBarPositioner.getViewportBottom();

        // Check if target element is visible in viewport (accounting for navbar and bottom)
        const isTargetVisible = rect.bottom > navbarHeight && rect.top < viewportBottom;

        if (!isTargetVisible) {
            // Return hidden state when target is completely out of view
            return {
                left: 0,
                top: 0,
                placement: 'below',
                isVisible: false
            };
        }

        // Calculate horizontal position (centered on target)
        let left = rect.left + (rect.width / 2) - (containerWidth / 2);

        // Calculate available space above and below the target
        const spaceBelow = viewportBottom - rect.bottom - gap - padding;
        const spaceAbove = rect.top - navbarHeight - gap - padding;

        let top: number;
        let placement: PositionPlacement;

        // Determine best position
        if (spaceBelow >= containerHeight) {
            // Enough space below - position below target
            top = rect.bottom + gap;
            placement = 'below';
        } else if (spaceAbove >= containerHeight) {
            // Enough space above - position above target
            top = rect.top - containerHeight - gap;
            placement = 'above';
        } else {
            // Not enough space above or below - center on the target/overlay
            // Calculate the visible portion of the target within viewport
            const visibleTop = Math.max(rect.top, navbarHeight);
            const visibleBottom = Math.min(rect.bottom, viewportBottom);
            const visibleCenter = (visibleTop + visibleBottom) / 2;

            top = visibleCenter - (containerHeight / 2);
            placement = 'centered';

            // Clamp to viewport bounds
            if (top < navbarHeight + padding) {
                top = navbarHeight + padding;
            }
            if (top + containerHeight > viewportBottom - padding) {
                top = viewportBottom - containerHeight - padding;
            }
        }

        // Horizontal clamping
        if (left < padding) {
            left = padding;
        } else if (left + containerWidth > viewportWidth - padding) {
            left = viewportWidth - containerWidth - padding;
        }

        return {
            left,
            top,
            placement,
            isVisible: true
        };
    }
}
