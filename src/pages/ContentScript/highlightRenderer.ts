/**
 * Highlight Renderer - Applies and removes highlights on the page
 * Implements Weighted Voting System for robust highlight restoration
 * 
 * Re-exports from split modules:
 * - highlighting/highlightDOM: DOM manipulation, wrapping, removal
 * - highlighting/selectionInfo: Selection capture
 */

import { Highlight } from '../../@/lib/types/highlight';
import { normalizeText, findBestMatchWithContext } from './anchorUtils';
import { initializeObserver } from './highlightObserver';
import { AgentResult, cssAgent, xpathAgent, contextAgent, semanticAgent } from './agents';
import { scoreCandidates, selectBestCandidate } from './candidateScorer';
import {
    applyHighlightInContainer,
    applyHighlightInContainerAtIndex,
    applyHighlightAtPosition,
} from './highlighting/highlightDOM';

// Re-exports for backward compatibility
export {
    removeHighlight,
    removeAllHighlights,
    updateHighlightClasses,
    getHighlightIdFromElement,
    wrapTextNodes,
} from './highlighting/highlightDOM';
export { getSelectionInfo } from './highlighting/selectionInfo';

/**
 * Apply all highlights to the page
 */
export function applyHighlights(
    highlights: Highlight[],
    rootContainer: HTMLElement = document.body,
    skipObserver: boolean = false
): void {
    const sortedHighlights = [...highlights].sort(
        (a, b) => b.startOffset - a.startOffset
    );

    const results = new Map<number, boolean>();

    for (const highlight of sortedHighlights) {
        const success = applyHighlight(highlight, rootContainer);
        results.set(highlight.id, success);
    }

    if (!skipObserver) {
        initializeObserver(highlights, results);
    }
}

/**
 * Apply a single highlight using Waterfall Anchoring Strategy
 */
export function applyHighlight(highlight: Highlight, rootContainer: HTMLElement = document.body): boolean {
    if (highlight.ranges && highlight.ranges.length > 0) {
        const sortedRanges = [...highlight.ranges].sort((a, b) => b.startOffset - a.startOffset);
        let anyApplied = false;
        sortedRanges.forEach(range => {
            const subHighlight = { ...highlight, startOffset: range.startOffset, endOffset: range.endOffset };
            if (applyHighlightByOffset(subHighlight)) anyApplied = true;
        });
        return anyApplied;
    }

    const anchor = highlight.anchor;
    const targetText = highlight.text;

    if (!anchor) return false;

    // Readable/Monolith source - simple text + context matching
    if (anchor.source === 'readable' || anchor.source === 'monolith') {
        return applyReadableHighlight(highlight, rootContainer);
    }

    // Live source - Full weighted voting with all agents
    const agentResults: AgentResult[] = [];

    const cssResult = cssAgent(anchor, targetText, rootContainer);
    if (cssResult.element) agentResults.push(cssResult);

    const xpathResult = xpathAgent(anchor, targetText);
    if (xpathResult.element) agentResults.push(xpathResult);

    const contextResults = contextAgent(targetText, anchor, rootContainer);
    for (const result of contextResults) agentResults.push(result);

    const semanticResult = semanticAgent(anchor, targetText, rootContainer);
    if (semanticResult.element) agentResults.push(semanticResult);

    if (agentResults.length === 0) return false;

    const scoredCandidates = scoreCandidates(highlight, agentResults, rootContainer);
    const bestCandidate = selectBestCandidate(scoredCandidates);

    if (!bestCandidate) return false;

    return applyHighlightInContainer(highlight, bestCandidate.element);
}

/**
 * Apply highlight from ReadableView source
 */
function applyReadableHighlight(highlight: Highlight, rootContainer: HTMLElement): boolean {
    const anchor = highlight.anchor;
    const targetText = highlight.text;
    const context = anchor?.context;
    const containingTag = anchor?.containingTag?.toUpperCase() || 'P';

    if (!targetText) return false;

    const candidates = rootContainer.querySelectorAll(containingTag);
    const elements: Element[] = Array.from(candidates);
    if (rootContainer.tagName === containingTag) elements.unshift(rootContainer);

    if (elements.length === 0) {
        return applyHighlightInContainer(highlight, rootContainer);
    }

    for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;

        const elementText = element.textContent || '';
        const normalizedElement = normalizeText(elementText);
        const normalizedTarget = normalizeText(targetText);

        if (!normalizedElement.includes(normalizedTarget)) continue;

        if (context?.prefix || context?.suffix) {
            const match = findBestMatchWithContext(targetText, context, element);
            if (match && match.score > 0) {
                return applyHighlightInContainerAtIndex(highlight, element, match.index);
            }
        } else {
            const index = normalizedElement.indexOf(normalizedTarget);
            if (index !== -1) {
                return applyHighlightInContainerAtIndex(highlight, element, index);
            }
        }
    }

    return applyHighlightInContainer(highlight, rootContainer);
}

/**
 * Fallback: Apply highlight using stored offsets
 */
function applyHighlightByOffset(highlight: Highlight, container: HTMLElement = document.body): boolean {
    return applyHighlightAtPosition(highlight, highlight.startOffset, highlight.endOffset, container);
}
