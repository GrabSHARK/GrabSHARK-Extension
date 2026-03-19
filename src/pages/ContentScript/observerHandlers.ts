/**
 * Observer Handlers - DOM mutation, scroll, and retry logic
 * Extracted from HighlightObserver class
 */

import { Highlight } from '../../@/lib/types/highlight';
import { applyHighlight } from './highlightRenderer';

const HIGHLIGHT_CLASS_PREFIX = 'ext-lw-highlight-';
const HIGHLIGHT_DATA_ATTR = 'data-ext-lw-highlight-id';
const MAX_RETRIES = 5;
const MAX_TOTAL_RETRIES = 10;
const DOM_GROWTH_THRESHOLD = 50;
const REACTIVATION_THROTTLE_MS = 5000;
const SCROLL_THROTTLE_MS = 1000;

export interface ObserverState {
    appliedIds: Set<number>;
    pendingQueue: Map<number, { highlight: Highlight; retryCount: number }>;
    dormantIds: Set<number>;
    permanentlyFailed: Set<number>;
    allHighlights: Map<number, Highlight>;
    totalRetryCount: Map<number, number>;
    lastDocHeight: number;
    lastReactivationTime: number;
    lastScrollTime: number;
}

/**
 * Safe wrapper for applyHighlight that returns boolean
 */
export function applyHighlightSafe(highlight: Highlight): boolean {
    try {
        applyHighlight(highlight);
        return document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlight.id}"]`).length > 0;
    } catch { return false; }
}

/**
 * Check if DOM has grown significantly (infinite scroll detection)
 */
export function checkDOMGrowth(state: ObserverState): boolean {
    const currentHeight = document.body.scrollHeight;
    if (currentHeight > state.lastDocHeight + DOM_GROWTH_THRESHOLD) {
        state.lastDocHeight = currentHeight;
        return true;
    }
    return false;
}

/**
 * Check if a highlight element is visible in viewport
 */
export function isHighlightVisible(highlightId: number): boolean {
    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);
    if (elements.length === 0) return false;
    for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') return true;
        }
    }
    return false;
}

/**
 * Check if a node or its descendants contain our highlight elements
 */
export function containsHighlight(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const element = node as Element;
    if (element.className && typeof element.className === 'string' && element.className.includes(HIGHLIGHT_CLASS_PREFIX)) return true;
    if (element.hasAttribute?.(HIGHLIGHT_DATA_ATTR)) return true;
    return element.querySelector?.(`[${HIGHLIGHT_DATA_ATTR}]`) !== null;
}

/**
 * Handle removed highlight elements - move them back to pending
 */
export function handleRemovedHighlights(node: Node, state: ObserverState): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const highlightElements = element.querySelectorAll?.(`[${HIGHLIGHT_DATA_ATTR}]`) || [];
    const nodesToCheck = element.hasAttribute?.(HIGHLIGHT_DATA_ATTR) ? [element, ...highlightElements] : [...highlightElements];

    for (const el of nodesToCheck) {
        const idStr = el.getAttribute(HIGHLIGHT_DATA_ATTR);
        if (idStr) {
            const id = parseInt(idStr, 10);
            if (state.appliedIds.has(id)) {
                state.appliedIds.delete(id);
                const highlight = state.allHighlights.get(id);
                if (highlight) {
                    const existing = state.pendingQueue.get(id);
                    state.pendingQueue.set(id, { highlight, retryCount: existing?.retryCount ?? 0 });
                }
            }
        }
    }
}

/**
 * Reactivate dormant highlights AND check applied highlights visibility
 */
export function reactivateOnDOMGrowth(state: ObserverState): void {
    const now = Date.now();
    if (now - state.lastReactivationTime < REACTIVATION_THROTTLE_MS) return;
    state.lastReactivationTime = now;

    // Check applied highlights
    const invisibleApplied: number[] = [];
    for (const id of state.appliedIds) {
        if (!isHighlightVisible(id)) invisibleApplied.push(id);
    }

    for (const id of invisibleApplied) {
        const totalRetries = state.totalRetryCount.get(id) || 0;
        if (totalRetries >= MAX_TOTAL_RETRIES) {
            state.appliedIds.delete(id);
            state.permanentlyFailed.add(id);
            continue;
        }
        state.appliedIds.delete(id);
        const highlight = state.allHighlights.get(id);
        if (highlight) state.pendingQueue.set(id, { highlight, retryCount: 0 });
    }

    // Reactivate dormant
    if (state.dormantIds.size > 0) {
        for (const id of state.dormantIds) {
            const totalRetries = state.totalRetryCount.get(id) || 0;
            if (totalRetries >= MAX_TOTAL_RETRIES) { state.permanentlyFailed.add(id); continue; }
            const highlight = state.allHighlights.get(id);
            if (highlight) state.pendingQueue.set(id, { highlight, retryCount: 0 });
        }
        state.dormantIds.clear();
    }
}

/**
 * Retry applying pending highlights
 */
export function retryPendingHighlights(state: ObserverState): void {
    if (state.pendingQueue.size === 0) return;

    const toDormant: number[] = [];
    const successful: number[] = [];

    for (const [id, pending] of state.pendingQueue) {
        if (pending.retryCount >= MAX_RETRIES) {
            toDormant.push(id);
            continue;
        }

        try {
            const success = applyHighlightSafe(pending.highlight);
            if (success) {
                successful.push(id);
                state.appliedIds.add(id);
            } else {
                pending.retryCount++;
                state.totalRetryCount.set(id, (state.totalRetryCount.get(id) || 0) + 1);
            }
        } catch {
            pending.retryCount++;
            state.totalRetryCount.set(id, (state.totalRetryCount.get(id) || 0) + 1);
        }
    }

    for (const id of toDormant) {
        state.pendingQueue.delete(id);
        const totalRetries = state.totalRetryCount.get(id) || 0;
        if (totalRetries >= MAX_TOTAL_RETRIES) state.permanentlyFailed.add(id);
        else state.dormantIds.add(id);
    }
    for (const id of successful) state.pendingQueue.delete(id);
}

/**
 * Handle scroll events - triggers retry for pending/dormant highlights
 */
export function handleScroll(state: ObserverState, scheduleRetry: () => void): void {
    const now = Date.now();
    if (now - state.lastScrollTime < SCROLL_THROTTLE_MS) return;
    if (state.pendingQueue.size === 0 && state.dormantIds.size === 0) return;
    state.lastScrollTime = now;

    if (checkDOMGrowth(state)) {
        reactivateOnDOMGrowth(state);
        scheduleRetry();
    } else if (state.pendingQueue.size > 0) {
        scheduleRetry();
    }
}

/**
 * Handle DOM mutations
 */
export function handleMutations(
    mutations: MutationRecord[],
    state: ObserverState,
    scheduleRetry: () => void
): void {
    let hasRelevantChange = false;

    if ((state.appliedIds.size > 0 || state.dormantIds.size > 0 || state.pendingQueue.size > 0) && checkDOMGrowth(state)) {
        reactivateOnDOMGrowth(state);
        hasRelevantChange = true;
    }

    for (const mutation of mutations) {
        for (const removed of mutation.removedNodes) {
            if (containsHighlight(removed)) {
                handleRemovedHighlights(removed, state);
                hasRelevantChange = true;
            }
        }
        if (state.pendingQueue.size > 0) {
            for (const added of mutation.addedNodes) {
                if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) {
                    hasRelevantChange = true;
                    break;
                }
            }
        }
        if (hasRelevantChange) break;
    }

    if (hasRelevantChange) scheduleRetry();
}
