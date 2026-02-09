/**
 * HighlightObserver - SPA Resilience Layer (Phase 4)
 * 
 * Watches for DOM changes and re-applies highlights that were either:
 * 1. Initially pending (content not loaded yet)
 * 2. Removed by SPA re-renders (React, Vue, Next.js)
 * 3. Now available due to infinite scroll / Load More (dormant mode)
 * 
 * Architecture: State-Aware Observer with Pending Queue + Dormant Pool
 * - appliedIds: Highlights successfully anchored in DOM
 * - pendingIds: Highlights waiting for their content to appear
 * - dormantIds: Highlights that exceeded retries but may appear later (infinite scroll)
 * - Uses debounced DOM settle detection (1000ms) to batch re-tries
 * - DOM growth detection reactivates dormant highlights
 */

import { Highlight } from '../../@/lib/types/highlight';
import { applyHighlight } from './highlightRenderer';

const HIGHLIGHT_CLASS_PREFIX = 'ext-lw-highlight-';
const HIGHLIGHT_DATA_ATTR = 'data-ext-lw-highlight-id';
const DEBOUNCE_MS = 1000; // Wait for DOM to settle
const MAX_RETRIES = 5;    // Stop trying after 5 failed attempts
const DOM_GROWTH_THRESHOLD = 50; // Pixels of height increase to trigger reactivation
const REACTIVATION_THROTTLE_MS = 5000; // Max once per 5 seconds
const SCROLL_THROTTLE_MS = 1000; // Scroll event throttle
const PENDING_RETRY_INTERVAL_MS = 5000; // Periodic retry for pending highlights

interface PendingHighlight {
    highlight: Highlight;
    retryCount: number;
}

class HighlightObserver {
    private observer: MutationObserver | null = null;
    private appliedIds: Set<number> = new Set();
    private pendingQueue: Map<number, PendingHighlight> = new Map();
    private dormantIds: Set<number> = new Set(); // NEW: Highlights waiting for DOM expansion
    private allHighlights: Map<number, Highlight> = new Map();
    private debounceTimer: number | null = null;
    private isObserving: boolean = false;

    // DOM growth detection
    private lastDocHeight: number = 0;
    private lastReactivationTime: number = 0;
    private lastScrollTime: number = 0;
    private scrollHandler: (() => void) | null = null;
    private pendingRetryInterval: number | null = null;

    /**
     * Start observing the DOM for changes
     * Called after initial highlight application
     */
    start(highlights: Highlight[], initialResults: Map<number, boolean>): void {
        // Store all highlights for potential re-application
        highlights.forEach(h => this.allHighlights.set(h.id, h));

        // Initialize DOM height tracking
        this.lastDocHeight = document.body.scrollHeight;

        // Categorize based on initial application results
        for (const [id, success] of initialResults) {
            if (success) {
                this.appliedIds.add(id);
            } else {
                const highlight = this.allHighlights.get(id);
                if (highlight) {
                    this.pendingQueue.set(id, {
                        highlight,
                        retryCount: 0,
                    });
                }
            }
        }

        // Only start observing if we have pending highlights OR applied highlights to watch
        if (this.pendingQueue.size > 0 || this.appliedIds.size > 0) {
            this.startObserver();
        }

        // Log initial state

    }

    /**
     * Stop observing and cleanup
     */
    stop(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler);
            this.scrollHandler = null;
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        if (this.pendingRetryInterval) {
            clearInterval(this.pendingRetryInterval);
            this.pendingRetryInterval = null;
        }
        this.isObserving = false;
        this.appliedIds.clear();
        this.pendingQueue.clear();
        this.dormantIds.clear();
        this.allHighlights.clear();
    }

    /**
     * Start the MutationObserver
     */
    private startObserver(): void {
        if (this.isObserving) return;

        this.observer = new MutationObserver(this.handleMutations.bind(this));

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Add scroll event listener for lazy-loaded content detection
        this.scrollHandler = this.handleScroll.bind(this);
        window.addEventListener('scroll', this.scrollHandler, { passive: true });

        // Start periodic retry interval for pending highlights
        this.startPendingRetryInterval();

        this.isObserving = true;
    }

    /**
     * Start periodic retry interval for pending highlights
     * Catches lazy-loaded content that doesn't trigger DOM mutations
     */
    private startPendingRetryInterval(): void {
        // Clear any existing interval
        if (this.pendingRetryInterval) {
            clearInterval(this.pendingRetryInterval);
        }

        this.pendingRetryInterval = window.setInterval(() => {
            if (this.pendingQueue.size > 0 || this.dormantIds.size > 0) {


                // Reactivate dormant highlights
                if (this.dormantIds.size > 0) {
                    for (const id of this.dormantIds) {
                        const highlight = this.allHighlights.get(id);
                        if (highlight) {
                            this.pendingQueue.set(id, {
                                highlight,
                                retryCount: 0,
                            });
                        }
                    }
                    this.dormantIds.clear();
                }

                // Retry pending
                this.retryPendingHighlights();
            } else {
                // No pending or dormant, stop the interval
                if (this.pendingRetryInterval) {
                    clearInterval(this.pendingRetryInterval);
                    this.pendingRetryInterval = null;

                }
            }
        }, PENDING_RETRY_INTERVAL_MS);
    }

    /**
     * Check if DOM has grown significantly (infinite scroll detection)
     */
    private checkDOMGrowth(): boolean {
        const currentHeight = document.body.scrollHeight;
        if (currentHeight > this.lastDocHeight + DOM_GROWTH_THRESHOLD) {
            this.lastDocHeight = currentHeight;
            return true;
        }
        return false;
    }

    /**
     * Handle scroll events - triggers retry for pending/dormant highlights
     * Throttled to prevent performance issues
     */
    private handleScroll(): void {
        const now = Date.now();
        if (now - this.lastScrollTime < SCROLL_THROTTLE_MS) {
            return; // Throttled
        }

        // Only trigger if we have pending or dormant highlights
        if (this.pendingQueue.size === 0 && this.dormantIds.size === 0) {
            return;
        }

        this.lastScrollTime = now;

        // Check for DOM growth and trigger retry
        if (this.checkDOMGrowth()) {

            this.reactivateOnDOMGrowth();
        } else if (this.pendingQueue.size > 0) {
            // Even without DOM growth, schedule a retry for pending highlights
            // This catches lazy-loaded content that doesn't increase page height
            this.scheduleRetry();
        }
    }

    /**
     * Check if a highlight element is visible in viewport
     */
    private isHighlightVisible(highlightId: number): boolean {
        const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);
        if (elements.length === 0) return false;

        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            // Check if element has any dimensions and is potentially visible
            if (rect.width > 0 && rect.height > 0) {
                // Check if not hidden by CSS
                const style = window.getComputedStyle(el);
                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Reactivate dormant highlights AND check applied highlights visibility
     * Throttled to prevent performance issues
     */
    private reactivateOnDOMGrowth(): void {
        const now = Date.now();
        if (now - this.lastReactivationTime < REACTIVATION_THROTTLE_MS) {
            return; // Throttled
        }
        this.lastReactivationTime = now;



        // 1. Check if applied highlights are still visible
        const invisibleApplied: number[] = [];
        for (const id of this.appliedIds) {
            if (!this.isHighlightVisible(id)) {
                invisibleApplied.push(id);
            }
        }

        // Move invisible applied highlights back to pending for re-application
        for (const id of invisibleApplied) {
            this.appliedIds.delete(id);
            const highlight = this.allHighlights.get(id);
            if (highlight) {
                this.pendingQueue.set(id, {
                    highlight,
                    retryCount: 0, // Reset for fresh attempts
                });

            }
        }

        // 2. Reactivate dormant highlights
        if (this.dormantIds.size > 0) {

            for (const id of this.dormantIds) {
                const highlight = this.allHighlights.get(id);
                if (highlight) {
                    this.pendingQueue.set(id, {
                        highlight,
                        retryCount: 0,
                    });
                }
            }
            this.dormantIds.clear();
        }

        // Schedule retry if we have pending items now
        if (this.pendingQueue.size > 0) {
            this.scheduleRetry();
        }
    }

    /**
     * Handle DOM mutations
     * Uses early-exit optimization and debouncing
     */
    private handleMutations(mutations: MutationRecord[]): void {
        let hasRelevantChange = false;

        // NEW: Check for DOM growth (infinite scroll)
        // Trigger when we have applied highlights (may become invisible) OR dormant highlights
        if ((this.appliedIds.size > 0 || this.dormantIds.size > 0 || this.pendingQueue.size > 0) && this.checkDOMGrowth()) {
            this.reactivateOnDOMGrowth();
            hasRelevantChange = true;
        }

        // EARLY EXIT OPTIMIZATION: Only process if there are pending highlights
        // OR if we see our highlight elements being removed
        for (const mutation of mutations) {
            // Check removed nodes for our highlight elements
            for (const removed of mutation.removedNodes) {
                if (this.containsHighlight(removed)) {
                    // Move affected highlights back to pending
                    this.handleRemovedHighlights(removed);
                    hasRelevantChange = true;
                }
            }

            // If we have pending items, any DOM addition is relevant
            if (this.pendingQueue.size > 0) {
                for (const added of mutation.addedNodes) {
                    if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
                        hasRelevantChange = true;
                        break;
                    }
                }
            }

            if (hasRelevantChange) break;
        }

        // If no relevant changes, skip debounce scheduling
        if (!hasRelevantChange) return;

        // Debounce: Wait for DOM to settle before re-trying
        this.scheduleRetry();
    }

    /**
     * Check if a node or its descendants contain our highlight elements
     */
    private containsHighlight(node: Node): boolean {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;

        const element = node as Element;

        // Quick class check
        if (element.className &&
            typeof element.className === 'string' &&
            element.className.includes(HIGHLIGHT_CLASS_PREFIX)) {
            return true;
        }

        // Check for data attribute
        if (element.hasAttribute?.(HIGHLIGHT_DATA_ATTR)) {
            return true;
        }

        // Check descendants
        return element.querySelector?.(`[${HIGHLIGHT_DATA_ATTR}]`) !== null;
    }

    /**
     * Handle removed highlight elements - move them back to pending
     */
    private handleRemovedHighlights(node: Node): void {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = node as Element;
        const highlightElements = element.querySelectorAll?.(`[${HIGHLIGHT_DATA_ATTR}]`) || [];

        // Also check if the node itself is a highlight
        const nodesToCheck = element.hasAttribute?.(HIGHLIGHT_DATA_ATTR)
            ? [element, ...highlightElements]
            : [...highlightElements];

        for (const el of nodesToCheck) {
            const idStr = el.getAttribute(HIGHLIGHT_DATA_ATTR);
            if (idStr) {
                const id = parseInt(idStr, 10);
                if (this.appliedIds.has(id)) {
                    // Move from applied to pending
                    this.appliedIds.delete(id);
                    const highlight = this.allHighlights.get(id);
                    if (highlight) {
                        const existing = this.pendingQueue.get(id);
                        this.pendingQueue.set(id, {
                            highlight,
                            retryCount: existing?.retryCount ?? 0, // Preserve retry count
                        });

                    }
                }
            }
        }
    }

    /**
     * Schedule a retry attempt with debouncing
     */
    private scheduleRetry(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = window.setTimeout(() => {
            this.retryPendingHighlights();
        }, DEBOUNCE_MS);
    }

    /**
     * Retry applying pending highlights
     */
    private retryPendingHighlights(): void {
        if (this.pendingQueue.size === 0) return;



        const toDormant: number[] = [];
        const successful: number[] = [];

        for (const [id, pending] of this.pendingQueue) {
            // Check retry limit - move to dormant instead of deleting
            if (pending.retryCount >= MAX_RETRIES) {

                toDormant.push(id);
                continue;
            }

            // Try to apply
            try {
                const success = applyHighlightSafe(pending.highlight);

                if (success) {
                    successful.push(id);
                    this.appliedIds.add(id);

                } else {
                    // Increment retry count
                    pending.retryCount++;
                }
            } catch (e) {

                pending.retryCount++;
            }
        }

        // Move to dormant instead of deleting
        for (const id of toDormant) {
            this.pendingQueue.delete(id);
            this.dormantIds.add(id); // Keep watching for DOM expansion
        }
        for (const id of successful) {
            this.pendingQueue.delete(id);
        }

        // Log state
        if (this.dormantIds.size > 0) {

        }

        // Don't stop observing if we have dormant highlights - they may appear later
        if (this.pendingQueue.size === 0 && this.appliedIds.size === 0 && this.dormantIds.size === 0) {

            this.stop();
        }
    }

    /**
     * Unregister a highlight that was intentionally deleted
     * Prevents the observer from re-applying it on DOM changes
     */
    unregisterHighlight(highlightId: number): void {
        this.appliedIds.delete(highlightId);
        this.pendingQueue.delete(highlightId);
        this.dormantIds.delete(highlightId);
        this.allHighlights.delete(highlightId);


        // Stop observing if nothing left to watch
        if (this.pendingQueue.size === 0 && this.appliedIds.size === 0 && this.dormantIds.size === 0) {

            this.stop();
        }
    }

    /**
     * Get current state for debugging
     */
    getState(): { applied: number; pending: number; dormant: number; watching: boolean } {
        return {
            applied: this.appliedIds.size,
            pending: this.pendingQueue.size,
            dormant: this.dormantIds.size,
            watching: this.isObserving,
        };
    }
}

/**
 * Safe wrapper for applyHighlight that returns boolean
 */
function applyHighlightSafe(highlight: Highlight): boolean {
    try {
        // applyHighlight is void, we need to check if elements were created
        applyHighlight(highlight);

        // Verify the highlight was actually applied
        const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlight.id}"]`);
        return elements.length > 0;
    } catch (e) {

        return false;
    }
}

// Singleton instance
let observerInstance: HighlightObserver | null = null;

/**
 * Get or create the HighlightObserver instance
 */
export function getHighlightObserver(): HighlightObserver {
    if (!observerInstance) {
        observerInstance = new HighlightObserver();
    }
    return observerInstance;
}

/**
 * Initialize the observer with highlights and their initial application results
 */
export function initializeObserver(
    highlights: Highlight[],
    results: Map<number, boolean>
): void {
    const observer = getHighlightObserver();
    observer.start(highlights, results);
}

/**
 * Unregister a highlight from the observer (called when deleted)
 */
export function unregisterHighlight(highlightId: number): void {
    if (observerInstance) {
        observerInstance.unregisterHighlight(highlightId);
    }
}

/**
 * Stop and cleanup the observer
 */
export function stopObserver(): void {
    if (observerInstance) {
        observerInstance.stop();
        observerInstance = null;
    }
}

export { HighlightObserver };
