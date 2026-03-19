// Highlight DOM Operations - Wrapping, removing, and managing highlight elements
import { Highlight, HighlightColor } from '../../../@/lib/types/highlight';
import { normalizeText, mapNormalizedToRawOffset, findBestMatchWithContext } from '../anchorUtils';
import { unregisterHighlight } from '../highlightObserver';

const HIGHLIGHT_DATA_ATTR = 'data-ext-lw-highlight-id';

/** Get CSS classes for a highlight */
export function getHighlightClasses(color: HighlightColor, hasComment: boolean): string {
    const classes = [`ext-lw-highlight-${color}`];
    if (hasComment) classes.push('ext-lw-has-comment');
    return classes.join(' ');
}

/** Update highlight classes (e.g., when comment is added) */
export function updateHighlightClasses(highlightId: number, color: HighlightColor, hasComment: boolean): void {
    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);
    elements.forEach((el) => {
        el.className = getHighlightClasses(color, hasComment);
    });
}

/** Get highlight ID from clicked element */
export function getHighlightIdFromElement(element: HTMLElement): number | null {
    const extId = element.getAttribute(HIGHLIGHT_DATA_ATTR);
    if (extId) return parseInt(extId, 10);

    const appId = element.getAttribute('data-highlight-id');
    if (appId) return parseInt(appId, 10);

    const extParent = element.closest(`[${HIGHLIGHT_DATA_ATTR}]`);
    if (extParent) {
        const parentId = extParent.getAttribute(HIGHLIGHT_DATA_ATTR);
        return parentId ? parseInt(parentId, 10) : null;
    }

    const appParent = element.closest('[data-highlight-id]');
    if (appParent) {
        const parentId = appParent.getAttribute('data-highlight-id');
        return parentId ? parseInt(parentId, 10) : null;
    }

    return null;
}

/** Remove a highlight from the page */
export function removeHighlight(highlightId: number): void {
    unregisterHighlight(highlightId);

    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}="${highlightId}"]`);
    elements.forEach((el) => {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
    });

    document.body.normalize();
}

/** Remove all highlights from the page */
export function removeAllHighlights(): void {
    const elements = document.querySelectorAll(`[${HIGHLIGHT_DATA_ATTR}]`);
    elements.forEach((el) => {
        const parent = el.parentNode;
        while (el.firstChild) parent?.insertBefore(el.firstChild, el);
        parent?.removeChild(el);
    });
    document.body.normalize();
}

/** Wrap text nodes with highlight spans */
export function wrapTextNodes(
    ranges: Array<{ node: Text; start: number; end: number }>,
    highlight: Highlight
): void {
    const reversedRanges = [...ranges].reverse();

    for (const { node, start, end: originalEnd } of reversedRanges) {
        try {
            let currentEnd = originalEnd;

            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            const forbiddenParents = ['TR', 'TBODY', 'THEAD', 'TFOOT', 'TABLE', 'COLGROUP', 'STYLE', 'SCRIPT', 'NOSCRIPT'];
            if (parentTag && forbiddenParents.includes(parentTag)) continue;

            const textContent = node.textContent?.substring(start, currentEnd) || '';
            if (!textContent.trim()) continue;

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
        } catch (e) { }
    }
}

/** Create tree walker for text filtering */
export function createFilteredTreeWalker(container: Node): TreeWalker {
    return document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );
}

/** Build text content map from tree walker */
export function buildTextNodeMap(treeWalker: TreeWalker): { nodes: Array<{ node: Text; start: number; end: number }>; text: string } {
    const nodes: { node: Text; start: number; end: number }[] = [];
    let text = '';

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeText = node.textContent || '';
        nodes.push({ node, start: text.length, end: text.length + nodeText.length });
        text += nodeText;
    }

    return { nodes, text };
}

/** Find overlapping ranges for highlight application */
export function findOverlappingRanges(
    nodes: Array<{ node: Text; start: number; end: number }>,
    rawStart: number,
    rawEnd: number
): Array<{ node: Text; start: number; end: number }> {
    const ranges: Array<{ node: Text; start: number; end: number }> = [];

    for (const { node, start, end } of nodes) {
        if (start < rawEnd && end > rawStart) {
            ranges.push({
                node,
                start: Math.max(0, rawStart - start),
                end: Math.min(end - start, rawEnd - start),
            });
        }
    }

    return ranges;
}

/** Apply highlight within a specific container element */
export function applyHighlightInContainer(highlight: Highlight, container: HTMLElement): boolean {
    const textToFind = highlight.text;
    const normalizedSearch = normalizeText(textToFind);
    const context = highlight.anchor?.context;

    const treeWalker = createFilteredTreeWalker(container);
    const { nodes, text: containerText } = buildTextNodeMap(treeWalker);
    const normalizedContainer = normalizeText(containerText);

    let searchIndex: number = -1;

    if (context?.prefix || context?.suffix) {
        const bestMatch = findBestMatchWithContext(textToFind, context, container);
        if (bestMatch && bestMatch.score > 0) {
            searchIndex = bestMatch.index;
        }
    }

    if (searchIndex === -1) {
        searchIndex = normalizedContainer.indexOf(normalizedSearch);
    }

    if (searchIndex === -1) return false;

    const rawStart = mapNormalizedToRawOffset(containerText, searchIndex);
    const rawEnd = mapNormalizedToRawOffset(containerText, searchIndex + normalizedSearch.length);

    const rangesToWrap = findOverlappingRanges(nodes, rawStart, rawEnd);
    if (rangesToWrap.length === 0) return false;

    wrapTextNodes(rangesToWrap, highlight);
    return true;
}

/** Apply highlight at a known normalized index within a container */
export function applyHighlightInContainerAtIndex(
    highlight: Highlight,
    container: HTMLElement,
    normalizedIndex: number
): boolean {
    const normalizedSearch = normalizeText(highlight.text);

    const treeWalker = createFilteredTreeWalker(container);
    const { nodes, text: containerText } = buildTextNodeMap(treeWalker);

    const rawStart = mapNormalizedToRawOffset(containerText, normalizedIndex);
    const rawEnd = mapNormalizedToRawOffset(containerText, normalizedIndex + normalizedSearch.length);

    const rangesToWrap = findOverlappingRanges(nodes, rawStart, rawEnd);
    if (rangesToWrap.length === 0) return false;

    wrapTextNodes(rangesToWrap, highlight);
    return true;
}

/** Apply highlight at specific offset positions */
export function applyHighlightAtPosition(
    highlight: Highlight,
    startOffset: number,
    endOffset: number,
    container: HTMLElement = document.body
): boolean {
    let currentOffset = 0;

    const treeWalker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tagName = parent.tagName.toLowerCase();
                if (tagName === 'script' || tagName === 'style' || tagName === 'noscript' || parent.classList.contains('ext-lw-toolbox')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            },
        }
    );

    const rangesToWrap: Array<{ node: Text; start: number; end: number }> = [];

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

    rangesToWrap.forEach(({ node, start, end }) => {
        try {
            const parentTag = node.parentNode?.nodeName?.toUpperCase();
            const forbiddenParents = ['TR', 'TBODY', 'THEAD', 'TFOOT', 'TABLE', 'COLGROUP', 'STYLE', 'SCRIPT', 'NOSCRIPT'];
            if (parentTag && forbiddenParents.includes(parentTag)) return;

            const textContent = node.textContent?.substring(start, end) || '';
            if (!textContent.trim()) return;

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
            wrapper.setAttribute('data-ext-lw-highlight-id', highlight.id.toString());
            wrapper.className = getHighlightClasses(highlight.color as HighlightColor, !!highlight.comment);

            targetNode.parentNode?.insertBefore(wrapper, targetNode);
            wrapper.appendChild(targetNode);
        } catch (e) { }
    });

    return true;
}
