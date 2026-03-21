/**
 * HighlightObserver - SPA Resilience Layer (Phase 4)
 * 
 * Watches for DOM changes and re-applies highlights that were either:
 * 1. Initially pending (content not loaded yet)
 * 2. Removed by SPA re-renders (React, Vue, Next.js)
 * 3. Now available due to infinite scroll / Load More (dormant mode)
 * 
 * Delegates mutation/scroll/retry logic to observerHandlers.ts
 */

import { Highlight } from '../../@/lib/types/highlight';
import {
    ObserverState,
    handleMutations,
    handleScroll,
    retryPendingHighlights,
} from './observerHandlers';

const DEBOUNCE_MS = 1000;
const PENDING_RETRY_INTERVAL_MS = 5000;
const MAX_OBSERVER_LIFETIME_MS = 60000;

class HighlightObserver {
    private observer: MutationObserver | null = null;
    private debounceTimer: number | null = null;
    private isObserving: boolean = false;
    private scrollHandler: (() => void) | null = null;
    private pendingRetryInterval: number | null = null;
    private lifetimeTimer: number | null = null;

    private state: ObserverState = {
        appliedIds: new Set(),
        pendingQueue: new Map(),
        dormantIds: new Set(),
        permanentlyFailed: new Set(),
        allHighlights: new Map(),
        totalRetryCount: new Map(),
        lastDocHeight: 0,
        lastReactivationTime: 0,
        lastScrollTime: 0,
    };

    start(highlights: Highlight[], initialResults: Map<number, boolean>): void {
        // If already observing, ensure we stop previous timers/observers before restarting or merging
        if (this.isObserving) {
            this.stop();
        }

        highlights.forEach(h => this.state.allHighlights.set(h.id, h));
        this.state.lastDocHeight = document.body.scrollHeight;

        for (const [id, success] of initialResults) {
            if (success) {
                this.state.appliedIds.add(id);
            } else {
                const highlight = this.state.allHighlights.get(id);
                if (highlight) this.state.pendingQueue.set(id, { highlight, retryCount: 0 });
            }
        }

        if (this.state.pendingQueue.size > 0 || this.state.appliedIds.size > 0) {
            this.startObserver();
        }
    }

    stop(): void {
        if (this.observer) { this.observer.disconnect(); this.observer = null; }
        if (this.scrollHandler) { window.removeEventListener('scroll', this.scrollHandler); this.scrollHandler = null; }
        if (this.debounceTimer) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
        if (this.pendingRetryInterval) { clearInterval(this.pendingRetryInterval); this.pendingRetryInterval = null; }
        if (this.lifetimeTimer) { clearTimeout(this.lifetimeTimer); this.lifetimeTimer = null; }
        this.isObserving = false;
        this.state.appliedIds.clear();
        this.state.pendingQueue.clear();
        this.state.dormantIds.clear();
        this.state.permanentlyFailed.clear();
        this.state.allHighlights.clear();
        this.state.totalRetryCount.clear();
    }

    private startObserver(): void {
        if (this.isObserving) return;

        this.observer = new MutationObserver((mutations) => {
            handleMutations(mutations, this.state, () => this.scheduleRetry());
        });

        this.observer.observe(document.body, { childList: true, subtree: true });

        this.scrollHandler = () => {
            handleScroll(this.state, () => this.scheduleRetry());
        };
        window.addEventListener('scroll', this.scrollHandler, { passive: true });

        this.startPendingRetryInterval();

        this.lifetimeTimer = window.setTimeout(() => this.stop(), MAX_OBSERVER_LIFETIME_MS);
        this.isObserving = true;
    }

    private startPendingRetryInterval(): void {
        if (this.pendingRetryInterval) clearInterval(this.pendingRetryInterval);

        this.pendingRetryInterval = window.setInterval(() => {
            if (this.state.pendingQueue.size > 0) {
                retryPendingHighlights(this.state);
            } else {
                if (this.pendingRetryInterval) { clearInterval(this.pendingRetryInterval); this.pendingRetryInterval = null; }
                if (this.state.appliedIds.size === 0 && this.state.dormantIds.size === 0) this.stop();
            }
        }, PENDING_RETRY_INTERVAL_MS);
    }

    private scheduleRetry(): void {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(() => {
            retryPendingHighlights(this.state);
            if (this.state.pendingQueue.size === 0 && this.state.appliedIds.size === 0 && this.state.dormantIds.size === 0) {
                this.stop();
            }
        }, DEBOUNCE_MS);
    }

    unregisterHighlight(highlightId: number): void {
        this.state.appliedIds.delete(highlightId);
        this.state.pendingQueue.delete(highlightId);
        this.state.dormantIds.delete(highlightId);
        this.state.allHighlights.delete(highlightId);
        if (this.state.pendingQueue.size === 0 && this.state.appliedIds.size === 0 && this.state.dormantIds.size === 0) this.stop();
    }

    getState(): { applied: number; pending: number; dormant: number; watching: boolean } {
        return {
            applied: this.state.appliedIds.size,
            pending: this.state.pendingQueue.size,
            dormant: this.state.dormantIds.size,
            watching: this.isObserving,
        };
    }
}

// Singleton
let observerInstance: HighlightObserver | null = null;

export function getHighlightObserver(): HighlightObserver {
    if (!observerInstance) observerInstance = new HighlightObserver();
    return observerInstance;
}

export function initializeObserver(highlights: Highlight[], results: Map<number, boolean>): void {
    getHighlightObserver().start(highlights, results);
}

export function unregisterHighlight(highlightId: number): void {
    observerInstance?.unregisterHighlight(highlightId);
}

export function stopObserver(): void {
    if (observerInstance) { observerInstance.stop(); observerInstance = null; }
}

export { HighlightObserver };
