// Capture Action Bar - Unified action menu for Smart Capture

import { CaptureTarget, SmartCaptureCallbacks } from './types';
import { ThemeDetector } from './ThemeDetector';

// React imports for mounting CaptureDock
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { CaptureDock } from './components/CaptureDock';



/**
 * CaptureActionBar - Floating action menu for Smart Capture
 */
export class CaptureActionBar {
    private container: HTMLDivElement | null = null;
    private host: HTMLDivElement | null = null;
    private shadow: ShadowRoot | null = null;
    private isVisible = false;
    private currentTarget: CaptureTarget | null = null;
    private callbacks: SmartCaptureCallbacks | null = null;
    private themeQuery: MediaQueryList | null = null;
    private handleThemeChange: (e: MediaQueryListEvent) => void;
    private themeDetector: ThemeDetector;
    private containerElement: Element;
    private resizeObserver: ResizeObserver | null = null;
    private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
    private reactRoot: Root | null = null;



    constructor(containerElement?: Element) {
        this.containerElement = containerElement || document.body;
        this.themeDetector = new ThemeDetector();

        // Bind theme handler
        this.handleThemeChange = () => this.updateTheme();

        // Lazy init: Container is created on first show()
        // this.createContainer();
        // this.setupClickOutsideHandler();
        // this.setupThemeListener();
    }

    /**
     * Create the container element if it doesn't exist
     */
    private ensureContainer(): void {
        if (this.container) return;

        // 1. Create Shadow Host
        this.host = document.createElement('div');
        this.host.id = 'ext-lw-capture-actionbar-host';
        // Use fixed positioning for proper scroll handling in modal context
        this.host.style.position = 'fixed';
        this.host.style.top = '0';
        this.host.style.left = '0';
        this.host.style.width = 'max-content'; // Ensure it wraps content
        this.host.style.height = 'max-content'; // Ensure it wraps content
        this.host.style.display = 'block'; // Ensure it's a block-level container
        this.host.style.zIndex = '2147483647'; // Max z-index
        this.host.style.pointerEvents = 'auto'; // Host must capture events

        // STOP PROPAGATION AT HOST LEVEL (Capture Phase)
        // This ensures meaningful clicks on the menu never reach the page
        const host = this.host;
        ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu', 'wheel'].forEach(eventType => {
            host.addEventListener(eventType, (e) => {
                // If the target is within our shadow root, stop it from bubbling to the page
                e.stopPropagation();
            });
        });

        this.containerElement.appendChild(this.host);

        // 2. Attach Shadow DOM
        this.shadow = this.host.attachShadow({ mode: 'open' });

        // 3. Inject Styles
        const styleLink = document.createElement('link');
        styleLink.rel = 'stylesheet';
        styleLink.href = chrome.runtime.getURL('contentScript.css');
        this.shadow.appendChild(styleLink);

        // 4. Create Container (inside Shadow) - This is the VOID Outer Container
        this.container = document.createElement('div');
        this.container.className = 'ext-lw-capture-actionbar-outer ext-lw-capture-actionbar-hidden';
        this.container.style.pointerEvents = 'auto';
        this.container.style.setProperty('position', 'relative', 'important');
        this.shadow.appendChild(this.container);

        // Reposition when styles load to fix first-render positioning issues
        styleLink.onload = () => {

            if (this.isVisible && this.currentTarget) {
                this.positionBar(this.currentTarget);
            }
        };

        // Stop all propagation from container to prevent click-through to underlying page
        ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup', 'contextmenu', 'wheel'].forEach(eventType => {
            this.container?.addEventListener(eventType, (e) => {
                e.stopPropagation();
            });
        });

        this.setupClickOutsideHandler();
        this.setupThemeListener();
        this.setupResizeObserver();
    }

    /**
     * Setup ResizeObserver to handle dynamic content size changes
     */
    private setupResizeObserver(): void {
        if (this.resizeObserver || !this.container) return;

        this.resizeObserver = new ResizeObserver(() => {
            if (this.isVisible && this.currentTarget) {
                // Auto-reposition when content size changes (e.g., after React render or dropdown open)
                this.positionBar(this.currentTarget);
            }
        });

        this.resizeObserver.observe(this.container);
    }

    /**
     * Setup click outside handler
     */
    private setupClickOutsideHandler(): void {
        this.clickOutsideHandler = (e: MouseEvent) => {
            if (!this.isVisible) return;

            const target = e.target as HTMLElement;

            // In Shadow DOM, clicks inside the shadow root are retargeted to the host.
            // So if target === this.host, the click was inside the menu.
            if (target === this.host) {
                return;
            }

            // Also check if we clicked on the container directly (fallback)
            if (this.container && this.container.contains(target)) {
                return;
            }

            // Don't close if clicking on overlay (which is in Light DOM)
            if (target.closest('.ext-lw-capture-overlay')) {
                return;
            }

            // Call onClose to properly deactivate mode and clean up overlays
            if (this.callbacks?.onClose) {
                // onClose usually leads to hide(), so let's trigger animation here if possible,
                // or just let hide() handle it. 
                this.callbacks.onClose();
            } else {
                this.hide();
            }
        };
        document.addEventListener('mousedown', this.clickOutsideHandler);
    }

    /**
     * Setup theme listener
     */
    private setupThemeListener(): void {
        this.themeQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // Initial set - updateTheme will use detector
        this.updateTheme();

        // Listen for changes
        // Use addEventListener if available, otherwise addListener (for older browsers)
        if (this.themeQuery.addEventListener) {
            this.themeQuery.addEventListener('change', this.handleThemeChange);
        } else {
            // Fallback
            this.themeQuery.addListener(this.handleThemeChange);
        }
    }

    /**
     * Update theme classes
     */
    private updateTheme(): void {
        if (!this.container) return;

        const isDark = this.themeDetector.isDarkMode();


        if (isDark) {
            this.container.classList.add('ext-lw-dark');
            this.container.classList.remove('ext-lw-light');
        } else {
            this.container.classList.add('ext-lw-light');
            this.container.classList.remove('ext-lw-dark');
        }
    }

    /**
     * Show action bar for a target
     */
    public show(target: CaptureTarget, callbacks: SmartCaptureCallbacks): void {

        if (target.type === 'NONE') return;
        this.ensureContainer();
        if (!this.container) return;



        // Check if already visible to decide on animation type
        const wasVisible = this.isVisible;

        this.currentTarget = target;
        this.callbacks = callbacks;
        this.isVisible = true;

        // Render directly into container to avoid nesting
        if (!this.reactRoot && this.container) {
            this.reactRoot = createRoot(this.container);
        }

        // Fresh open or update: always trigger render
        this.render();

        if (wasVisible) {
            // SLIDING TRANSITION (target change)
            if (this.host) {
                this.host.style.setProperty('transition', 'top 0.2s cubic-bezier(0.2, 0, 0.2, 1), left 0.2s cubic-bezier(0.2, 0, 0.2, 1)', 'important');
            }
            this.positionBar(target);
            this.updateTheme();
        } else {
            // FRESH OPEN - CSS animation handles entrance
            if (this.host) {
                this.host.style.setProperty('transition', 'none', 'important');
            }
            this.container.classList.remove('ext-lw-capture-actionbar-hidden');
            this.container.classList.remove('ext-lw-closing');
            this.container.style.setProperty('display', 'flex', 'important');
            this.container.style.setProperty('visibility', 'visible', 'important');
            // Clear any inline animation-related styles to let CSS animation work
            this.container.style.opacity = '';
            this.container.style.transform = '';
            this.container.style.transition = '';
            this.container.style.animation = '';

            this.positionBar(target);
            this.updateTheme();
        }
    }

    /**
     * Hide the action bar with animation
     */
    public hide(): void {
        if (!this.container || !this.isVisible) return;

        this.isVisible = false;
        this.currentTarget = null;

        // Clear inline styles and trigger CSS exit animation
        this.container.style.opacity = '';
        this.container.style.transform = '';
        this.container.style.transition = '';
        this.container.classList.add('ext-lw-closing');

        setTimeout(() => {
            if (!this.container) return;

            // IMPORTANT: DO NOT clear innerHTML or unmount here.
            // Let React handle its own cleanup. Just hide it from view.
            this.container.classList.add('ext-lw-capture-actionbar-hidden');
            this.container.classList.remove('ext-lw-closing');
            this.container.style.setProperty('display', 'none', 'important');
            this.container.style.setProperty('visibility', 'hidden', 'important');
        }, 200); // Match CSS exit animation duration
    }

    /**
     * Check if action bar is visible
     */
    public isShowing(): boolean {
        return this.isVisible;
    }

    /**
     * Render the action bar content using React
     */
    private render(): void {
        if (!this.container || !this.currentTarget || !this.callbacks) return;

        // Render directly into container to avoid nesting
        if (!this.reactRoot && this.container) {
            this.reactRoot = createRoot(this.container);
        }

        // Render directly into container to avoid nesting
        if (!this.reactRoot && this.container) {
            this.reactRoot = createRoot(this.container);
        }

        // Get favicon URL
        const faviconUrl = chrome.runtime.getURL('16.png');

        // Render React component
        if (this.reactRoot) {
            this.reactRoot.render(
                React.createElement(CaptureDock, {
                    target: this.currentTarget,
                    isDark: this.themeDetector.isDarkMode(),
                    callbacks: this.callbacks,
                    faviconUrl: faviconUrl,
                })
            );
        }
    }






    /**
     * Get human-readable type label (icons only, with separator for composite)
     */
    /**
     * Get the navbar/header height for the current context
     * This detects Linkwarden's modal header to properly clamp the action bar
     */
    private getNavbarHeight(): number {
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

        return 52;
    }

    /**
     * Get the viewport bottom boundary for the current context
     * This detects Linkwarden's scroll container bottom to properly clamp the action bar
     */
    private getViewportBottom(): number {
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
     * Position the action bar relative to target
     * @returns 'above' if menu is positioned above target, 'below' if below, 'centered' if centered on overlay
     */
    private positionBar(target: CaptureTarget): 'above' | 'below' | 'centered' {

        if (!this.container || !this.host) return 'below';

        // Get current viewport-relative rect (updates on scroll)
        let rect: DOMRect;

        if (target.elementRef) {
            // Single element - use live getBoundingClientRect
            rect = target.elementRef.getBoundingClientRect();
        } else if (target.selectedTargets && target.selectedTargets.length > 0) {
            // Multi-block selection - calculate live bounding box from all elementRefs
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
                rect = new DOMRect(minX, minY, maxX - minX, maxY - minY);
            } else {
                // Fallback to static rect if no elementRefs available
                rect = target.rect;
            }
        } else {
            // Fallback to static rect
            rect = target.rect;
        }

        // Calculate navbar height to account for modal header
        const navbarHeight = this.getNavbarHeight();

        // Viewport boundaries (using scroll container bounds, not window)
        const viewportWidth = window.innerWidth;
        const viewportBottom = this.getViewportBottom(); // Bottom of scroll container
        const padding = 10;
        const gap = 16; // Gap between target and menu

        // Check if target element is visible in viewport (accounting for navbar and bottom)
        const isTargetVisible = rect.bottom > navbarHeight && rect.top < viewportBottom;



        if (!isTargetVisible) {
            // Hide action bar when target is completely out of view

            this.host.style.opacity = '0';
            this.host.style.pointerEvents = 'none';
            return 'below';
        }

        // Target is visible - show action bar
        this.host.style.opacity = '';
        this.host.style.pointerEvents = '';

        // Use container dimensions (host wraps it)
        const barRect = this.container.getBoundingClientRect();

        // For fixed positioning, use viewport-relative coordinates directly
        let left = rect.left + (rect.width / 2) - (barRect.width / 2);
        let top: number;
        let position: 'above' | 'below' | 'centered' = 'below';

        // Calculate available space above and below the target
        const spaceBelow = viewportBottom - rect.bottom - gap - padding;
        const spaceAbove = rect.top - navbarHeight - gap - padding;



        // Determine best position
        if (spaceBelow >= barRect.height) {
            // Enough space below - position below target
            top = rect.bottom + gap;
            position = 'below';
        } else if (spaceAbove >= barRect.height) {
            // Enough space above - position above target
            top = rect.top - barRect.height - gap;
            position = 'above';
        } else {
            // Not enough space above or below - center on the target/overlay
            // Calculate the visible portion of the target within viewport
            const visibleTop = Math.max(rect.top, navbarHeight);
            const visibleBottom = Math.min(rect.bottom, viewportBottom);
            const visibleCenter = (visibleTop + visibleBottom) / 2;

            top = visibleCenter - (barRect.height / 2);
            position = 'centered';

            // Clamp to viewport bounds
            if (top < navbarHeight + padding) {
                top = navbarHeight + padding;
            }
            if (top + barRect.height > viewportBottom - padding) {
                top = viewportBottom - barRect.height - padding;
            }
        }

        // Horizontal clamping
        if (left < padding) {
            left = padding;
        } else if (left + barRect.width > viewportWidth - padding) {
            left = viewportWidth - barRect.width - padding;
        }



        // Apply position to HOST (fixed positioning)
        this.host.style.left = `${left}px`;
        this.host.style.top = `${top}px`;

        return position;
    }



    // Legacy event handling removed - now handled by React CaptureDock component
    // See: src/pages/ContentScript/SmartCapture/components/CaptureDock.tsx

    /**
     * Destroy the action bar
     */
    public destroy(): void {
        // Remove click outside handler
        if (this.clickOutsideHandler) {
            document.removeEventListener('mousedown', this.clickOutsideHandler);
            this.clickOutsideHandler = null;
        }

        if (this.themeQuery) {
            if (this.themeQuery.removeEventListener) {
                this.themeQuery.removeEventListener('change', this.handleThemeChange);
            } else {
                this.themeQuery.removeListener(this.handleThemeChange);
            }
            this.themeQuery = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.host) {
            this.host.remove();
            this.host = null;
        }

        if (this.container) {
            // Only unmount on total destruction
            if (this.reactRoot) {
                this.reactRoot.unmount();
                this.reactRoot = null;
            }
            this.container.remove();
            this.container = null;
        }
    }



    /**
     * Check if action bar is currently visible
     */
    public isCurrentlyVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Update position based on current target (for scroll updates)
     */
    public updatePosition(): void {
        if (!this.isVisible || !this.currentTarget) return;
        this.positionBar(this.currentTarget);
    }
}
