// Highlight Renderer - Applies and removes highlights on the page
// Implements Weighted Voting System for robust highlight restoration

import { Highlight, HighlightColor, HighlightAnchor } from '../../@/lib/types/highlight';
import {
    normalizeText,
    findBestMatchWithContext,
    mapNormalizedToRawOffset,
    captureAnchor
} from './anchorUtils';
import { initializeObserver, unregisterHighlight } from './highlightObserver';
import {
    AgentResult,
    cssAgent,
    xpathAgent,
    contextAgent,
    semanticAgent
} from './agents';
import { scoreCandidates, selectBestCandidate } from './candidateScorer';

const HIGHLIGHT_DATA_ATTR = 'data-ext-lw-highlight-id';

/**
 * Apply all highlights to the page
 * Integrates with HighlightObserver for SPA resilience
 * 
 * @param skipObserver - If true, skip initializing the observer (used on Linkwarden instance
 *                       where the main app already handles highlight rendering)
 */
export function applyHighlights(
    highlights: Highlight[],
    rootContainer: HTMLElement = document.body,
    skipObserver: boolean = false
): void {
    // Sort by startOffset DESCENDING to prevent offset shifting issues
    // Since applying a highlight hides it from the TreeWalker, we must process from end to start
    const sortedHighlights = [...highlights].sort(
        (a, b) => b.startOffset - a.startOffset
    );

    // Track application results for Observer
    const results = new Map<number, boolean>();

    for (const highlight of sortedHighlights) {
        const success = applyHighlight(highlight, rootContainer);
        results.set(highlight.id, success);
    }

    // Initialize the Observer with results (unless on Linkwarden instance)
    // It will watch for DOM changes and retry pending highlights
    if (!skipObserver) {
        initializeObserver(highlights, results);
    } else {

    }
}

/**
 * Apply a single highlight using Waterfall Anchoring Strategy
 * Returns true if highlight was successfully applied, false otherwise
 * 
 * Phase 1: CSS Selector Anchor (fastest, most precise)
 * Phase 2: XPath Anchor (structural fallback)
 * Phase 3: Fuzzy Text + Context (handles DOM changes)
 * Phase 4: Legacy Offset (backward compatibility)
 */
export function applyHighlight(highlight: Highlight, rootContainer: HTMLElement = document.body): boolean {
    // If highlight has multiple ranges, apply each one
    if (highlight.ranges && highlight.ranges.length > 0) {
        const sortedRanges = [...highlight.ranges].sort((a, b) => b.startOffset - a.startOffset);
        let anyApplied = false;
        sortedRanges.forEach(range => {
            const subHighlight = {
                ...highlight,
                startOffset: range.startOffset,
                endOffset: range.endOffset,
            };
            if (applyHighlightByOffset(subHighlight)) {
                anyApplied = true;
            }
        });
        return anyApplied;
    }

    // ========================================================================
    // WEIGHTED VOTING SYSTEM - All agents run in parallel
    // ========================================================================


    const anchor = highlight.anchor;
    const targetText = highlight.text;

    // Skip if no anchor data (legacy highlight without anchor)
    if (!anchor) {

        return false;
    }

    // ========================================================================
    // READABLE SOURCE - Simple text + context matching
    // ReadableView anchors don't have CSS/XPath, just containingTag + context
    // ========================================================================
    if (anchor.source === 'readable') {
        return applyReadableHighlight(highlight, rootContainer);
    }

    // ========================================================================
    // LIVE SOURCE - Full weighted voting with all agents
    // ========================================================================

    // Run all agents and collect results
    const agentResults: AgentResult[] = [];

    // Agent 1: CSS Selector
    const cssResult = cssAgent(anchor, targetText, rootContainer);
    if (cssResult.element) {
        agentResults.push(cssResult);
    }

    // Agent 2: XPath
    const xpathResult = xpathAgent(anchor, targetText);
    if (xpathResult.element) {
        agentResults.push(xpathResult);
    }

    // Agent 3: Context (returns multiple candidates)
    const contextResults = contextAgent(targetText, anchor, rootContainer);
    for (const result of contextResults) {
        agentResults.push(result);
    }

    // Agent 4: Semantic (heading-based triangulation)
    const semanticResult = semanticAgent(anchor, targetText, rootContainer);
    if (semanticResult.element) {
        agentResults.push(semanticResult);
    }

    // No candidates found by any agent
    if (agentResults.length === 0) {

        return false;
    }

    // Score all candidates
    const scoredCandidates = scoreCandidates(highlight, agentResults, rootContainer);


    // Select best candidate above threshold
    const bestCandidate = selectBestCandidate(scoredCandidates);

    if (!bestCandidate) {

        return false;
    }

    // Apply highlight to the winning element

    return applyHighlightInContainer(highlight, bestCandidate.element);
}

/**
 * Apply highlight from ReadableView source
 * Uses simple text + context matching within containingTag elements
 * Ignores CSS/XPath since ReadableView DOM differs from live site
 */
function applyReadableHighlight(highlight: Highlight, rootContainer: HTMLElement): boolean {
    const anchor = highlight.anchor;
    const targetText = highlight.text;
    const context = anchor?.context;
    const containingTag = anchor?.containingTag?.toUpperCase() || 'P';

    if (!targetText) return false;

    // Find all elements matching the containing tag
    const candidates = rootContainer.querySelectorAll(containingTag);

    // Also search in rootContainer itself if it matches
    const elements: Element[] = Array.from(candidates);
    if (rootContainer.tagName === containingTag) {
        elements.unshift(rootContainer);
    }

    // If no matching tags, fallback to searching entire container
    if (elements.length === 0) {
        return applyHighlightInContainer(highlight, rootContainer);
    }

    // Find the best matching element using context
    for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue;

        const elementText = element.textContent || '';
        const normalizedElement = normalizeText(elementText);
        const normalizedTarget = normalizeText(targetText);

        // Check if this element contains our target text
        if (!normalizedElement.includes(normalizedTarget)) continue;

        // If we have context, use it to verify this is the right instance
        if (context?.prefix || context?.suffix) {
            const match = findBestMatchWithContext(targetText, context, element);
            if (match && match.score > 0) {
                // Found a good match with context verification
                return applyHighlightInContainerAtIndex(highlight, element, match.index);
            }
        } else {
            // No context, just find first occurrence
            const index = normalizedElement.indexOf(normalizedTarget);
            if (index !== -1) {
                return applyHighlightInContainerAtIndex(highlight, element, index);
            }
        }
    }

    // Fallback: search entire container if tag-specific search failed
    return applyHighlightInContainer(highlight, rootContainer);
}

/**
 * Apply highlight at a known normalized index within a container
 * Used by applyReadableHighlight when context matching already found the position
 */
function applyHighlightInContainerAtIndex(
    highlight: Highlight,
    container: HTMLElement,
    normalizedIndex: number
): boolean {
    const textToFind = highlight.text;
    const normalizedSearch = normalizeText(textToFind);

    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (
                    tagName === 'script' ||
                    tagName === 'style' ||
                    tagName === 'noscript'
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    // Build text content of container
    let containerText = '';
    const nodes: { node: Text; start: number; end: number }[] = [];

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const text = node.textContent || '';
        nodes.push({
            node,
            start: containerText.length,
            end: containerText.length + text.length,
        });
        containerText += text;
    }

    // Map normalized index back to raw offset
    const rawStart = mapNormalizedToRawOffset(containerText, normalizedIndex);
    const rawEnd = mapNormalizedToRawOffset(containerText, normalizedIndex + normalizedSearch.length);

    // Find nodes that overlap with our range
    const rangesToWrap: Array<{ node: Text; start: number; end: number }> = [];

    for (const { node, start, end } of nodes) {
        if (start < rawEnd && end > rawStart) {
            rangesToWrap.push({
                node,
                start: Math.max(0, rawStart - start),
                end: Math.min(end - start, rawEnd - start),
            });
        }
    }

    if (rangesToWrap.length === 0) return false;

    // Apply wrapping
    wrapTextNodes(rangesToWrap, highlight);
    return true;
}

/**
 * Apply highlight within a specific container element
 * Used by Phase 1 and Phase 2 to scope the search
 * 
 * Now uses Context Disambiguation to find the correct text instance
 * when multiple matches exist within the container.
 */
function applyHighlightInContainer(highlight: Highlight, container: HTMLElement): boolean {
    const textToFind = highlight.text;
    const normalizedSearch = normalizeText(textToFind);
    const context = highlight.anchor?.context;

    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (
                    tagName === 'script' ||
                    tagName === 'style' ||
                    tagName === 'noscript'
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    // Build text content of container
    let containerText = '';
    const nodes: { node: Text; start: number; end: number }[] = [];

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const text = node.textContent || '';
        nodes.push({
            node,
            start: containerText.length,
            end: containerText.length + text.length,
        });
        containerText += text;
    }

    const normalizedContainer = normalizeText(containerText);

    // ==== CONTEXT DISAMBIGUATION ====
    // If we have context, use it to find the correct instance among multiple matches
    let searchIndex: number = -1;

    if (context?.prefix || context?.suffix) {
        // Use the shared, robust matching logic which handles whitespace tolerance
        const bestMatch = findBestMatchWithContext(
            textToFind,
            context,
            container
        );

        if (bestMatch && bestMatch.score > 0) {
            searchIndex = bestMatch.index;

        }
    }

    // ==== FALLBACK: First match (no context or context didn't help) ====
    if (searchIndex === -1) {
        searchIndex = normalizedContainer.indexOf(normalizedSearch);
    }

    if (searchIndex === -1) return false;

    // Map normalized index back to raw offset using character-by-character mapping
    const rawStart = mapNormalizedToRawOffset(containerText, searchIndex);
    const rawEnd = mapNormalizedToRawOffset(containerText, searchIndex + normalizedSearch.length);

    // Find nodes that overlap with our range
    const rangesToWrap: Array<{ node: Text; start: number; end: number }> = [];

    for (const { node, start, end } of nodes) {
        if (start < rawEnd && end > rawStart) {
            rangesToWrap.push({
                node,
                start: Math.max(0, rawStart - start),
                end: Math.min(end - start, rawEnd - start),
            });
        }
    }

    if (rangesToWrap.length === 0) return false;

    // Apply wrapping
    wrapTextNodes(rangesToWrap, highlight);
    return true;
}

/**
 * Wrap text nodes with highlight spans
 * Shared helper for container-scoped and position-based highlighting
 */
function wrapTextNodes(
    ranges: Array<{ node: Text; start: number; end: number }>,
    highlight: Highlight
): void {
    // Process in reverse to avoid offset shifting
    const reversedRanges = [...ranges].reverse();

    for (const { node, start, end: originalEnd } of reversedRanges) {
        try {
            let currentEnd = originalEnd;

            // FILTER: Skip nodes that would cause invalid HTML injection
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            const forbiddenParents = ['TR', 'TBODY', 'THEAD', 'TFOOT', 'TABLE', 'COLGROUP', 'STYLE', 'SCRIPT', 'NOSCRIPT'];

            if (parentTag && forbiddenParents.includes(parentTag)) {
                continue;
            }

            // Check if text is pure whitespace
            const textContent = node.textContent?.substring(start, currentEnd) || '';
            if (!textContent.trim()) {
                continue;
            }

            let targetNode = node;

            if (start > 0) {
                targetNode = node.splitText(start);
                currentEnd -= start;
            }

            if (currentEnd < targetNode.length) {
                targetNode.splitText(currentEnd);
            }

            const wrapper = document.createElement('span');
            wrapper.id = `ext-lw-highlight-${highlight.id}`;
            wrapper.setAttribute(HIGHLIGHT_DATA_ATTR, highlight.id.toString());
            wrapper.className = getHighlightClasses(highlight.color as HighlightColor, !!highlight.comment);

            targetNode.parentNode?.insertBefore(wrapper, targetNode);
            wrapper.appendChild(targetNode);
        } catch (e) {

        }
    }
}


/**
 * Apply highlight at specific offset positions
 */
function applyHighlightAtPosition(highlight: Highlight, startOffset: number, endOffset: number, container: HTMLElement = document.body): boolean {
    let currentOffset = 0;

    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName.toLowerCase();
                if (
                    tagName === 'script' ||
                    tagName === 'style' ||
                    tagName === 'noscript' ||
                    parent.classList.contains('ext-lw-toolbox')
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    const rangesToWrap: Array<{
        node: Text;
        start: number;
        end: number;
    }> = [];

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeLength = node.textContent?.length ?? 0;
        const nodeStart = currentOffset;
        const nodeEnd = nodeStart + nodeLength;

        if (nodeStart < endOffset && nodeEnd > startOffset) {
            rangesToWrap.push({
                node,
                start: Math.max(0, startOffset - nodeStart),
                end: Math.min(nodeLength, endOffset - nodeStart),
            });
        }

        currentOffset += nodeLength;
    }

    if (rangesToWrap.length === 0) return false;

    // Apply wrapping
    rangesToWrap.forEach(({ node, start, end }) => {
        try {
            // FILTER: Skip nodes that would cause invalid HTML injection
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            const forbiddenParents = ['TR', 'TBODY', 'THEAD', 'TFOOT', 'TABLE', 'COLGROUP', 'STYLE', 'SCRIPT', 'NOSCRIPT'];

            // Check if parent is a table structure element (can't contain inline spans)
            if (parentTag && forbiddenParents.includes(parentTag)) {

                return;
            }

            // Check if text is pure whitespace (would create empty/invisible spans)
            const textContent = node.textContent?.substring(start, end) || '';
            if (!textContent.trim()) {

                return;
            }

            let targetNode = node;

            if (start > 0) {
                targetNode = node.splitText(start);
                end -= start;
            }

            if (end < targetNode.length) {
                targetNode.splitText(end);
            }

            const wrapper = document.createElement('span');
            wrapper.id = `ext-lw-highlight-${highlight.id}`;
            wrapper.setAttribute(HIGHLIGHT_DATA_ATTR, highlight.id.toString());
            wrapper.className = getHighlightClasses(highlight.color as HighlightColor, !!highlight.comment);

            targetNode.parentNode?.insertBefore(wrapper, targetNode);
            wrapper.appendChild(targetNode);
        } catch (e) {

        }
    });

    return true;
}

/**
 * Fallback: Apply highlight using stored offsets
 */
function applyHighlightByOffset(highlight: Highlight, container: HTMLElement = document.body): boolean {
    return applyHighlightAtPosition(highlight, highlight.startOffset, highlight.endOffset, container);
}

/**
 * Remove a highlight from the page
 */
export function removeHighlight(highlightId: number): void {
    // First, unregister from observer to prevent re-application
    unregisterHighlight(highlightId);

    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);

    elements.forEach((el) => {
        const parent = el.parentNode;
        while (el.firstChild) {
            parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
    });

    // Normalize text nodes
    document.body.normalize();
}

/**
 * Remove all highlights from the page
 */
export function removeAllHighlights(): void {
    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}]`);

    elements.forEach((el) => {
        const parent = el.parentNode;
        while (el.firstChild) {
            parent?.insertBefore(el.firstChild, el);
        }
        parent?.removeChild(el);
    });

    document.body.normalize();
}

/**
 * Get the selection info for creating a new highlight
 * Now includes anchor data for Weighted Voting System
 */
export function getSelectionInfo(): {
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
    anchor?: HighlightAnchor;
} | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }

    const range = selection.getRangeAt(0);
    // Use selection.toString() to better preserve newlines/formatting compared to range.toString()
    const text = selection.toString().trim();

    if (!text) {
        return null;
    }

    const rect = range.getBoundingClientRect();

    // Calculate global offsets
    let startOffset = -1;
    let endOffset = -1;
    let currentOffset = 0;

    const treeWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;

                const tagName = parent.tagName.toLowerCase();
                if (
                    tagName === 'script' ||
                    tagName === 'style' ||
                    tagName === 'noscript' ||
                    parent.classList.contains('ext-lw-toolbox')
                ) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeLength = node.textContent?.length ?? 0;

        // Check Start
        if (startOffset === -1) {
            // Precise match for Text node
            if (node === range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
                startOffset = currentOffset + range.startOffset;
            }
            // Element-based start or bulk intersection
            else if (range.intersectsNode(node)) {
                startOffset = currentOffset;
            }
        }

        // Check End
        if (startOffset !== -1 && endOffset === -1) {
            // Precise match for Text node
            if (node === range.endContainer && range.endContainer.nodeType === Node.TEXT_NODE) {
                endOffset = currentOffset + range.endOffset;
                break;
            }

            // If we are tracking selection, stop when we stop intersecting
            if (!range.intersectsNode(node)) {
                endOffset = currentOffset;
                break;
            }
        }

        currentOffset += nodeLength;
    }

    if (startOffset !== -1 && endOffset === -1) {
        endOffset = currentOffset;
    }

    if (startOffset === -1 || endOffset === -1) {
        return null;
    }

    // Capture anchor data for Waterfall Anchoring
    const anchor = captureAnchor(range);

    return {
        text,
        startOffset,
        endOffset,
        rect,
        anchor,
    };
}



/**
 * Get CSS classes for a highlight
 */
function getHighlightClasses(color: HighlightColor, hasComment: boolean): string {
    const classes = [`ext-lw-highlight-${color}`];
    if (hasComment) {
        classes.push('ext-lw-has-comment');
    }
    return classes.join(' ');
}

/**
 * Update highlight classes (e.g., when comment is added)
 */
export function updateHighlightClasses(
    highlightId: number,
    color: HighlightColor,
    hasComment: boolean
): void {
    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);
    elements.forEach((el) => {
        el.className = getHighlightClasses(color, hasComment);
    });
}

/**
 * Get highlight ID from clicked element
 * Checks both extension attribute (data-ext-lw-highlight-id) and 
 * main app attribute (data-highlight-id) for Linkwarden instance compatibility
 */
export function getHighlightIdFromElement(element: HTMLElement): number | null {
    // Check extension attribute first
    const extId = element.getAttribute(HIGHLIGHT_DATA_ATTR);
    if (extId) {
        return parseInt(extId, 10);
    }

    // Check main app attribute (for Linkwarden readable view)
    const appId = element.getAttribute('data-highlight-id');
    if (appId) {
        return parseInt(appId, 10);
    }

    // Check parents for extension attribute
    const extParent = element.closest(`[${HIGHLIGHT_DATA_ATTR}]`);
    if (extParent) {
        const parentId = extParent.getAttribute(HIGHLIGHT_DATA_ATTR);
        return parentId ? parseInt(parentId, 10) : null;
    }

    // Check parents for main app attribute
    const appParent = element.closest('[data-highlight-id]');
    if (appParent) {
        const parentId = appParent.getAttribute('data-highlight-id');
        return parentId ? parseInt(parentId, 10) : null;
    }

    return null;
}
