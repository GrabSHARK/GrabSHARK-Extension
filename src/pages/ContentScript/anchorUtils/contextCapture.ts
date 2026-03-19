/**
 * Context Capture for Highlight Anchoring
 * Captures text before/after selection for disambiguation
 */

import { normalizeText, getFilteredTextContent, getAdaptiveContextLength } from './textUtils';

/**
 * Capture context (prefix/suffix) around a selection range
 * Uses adaptive context length based on how often the selected text appears.
 */
export function captureContext(
    range: Range,
    charCount?: number
): { prefix: string; suffix: string } {
    const selectedText = range.toString();

    if (charCount === undefined) {
        const containerText = getFilteredTextContent(document.body as HTMLElement);
        charCount = getAdaptiveContextLength(selectedText, containerText);
    }

    const isNodeIgnored = (node: Node) => {
        const parent = node.parentElement;
        if (!parent) return true;
        const tagName = parent.tagName.toLowerCase();
        return (
            tagName === 'script' ||
            tagName === 'style' ||
            tagName === 'noscript' ||
            parent.classList.contains('ext-lw-toolbox')
        );
    };

    // --- PREFIX (Backwards traversal) ---
    let prefix = '';
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        prefix = (range.startContainer.textContent || '').substring(0, range.startOffset);
    }

    const prefixWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (isNodeIgnored(node)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    prefixWalker.currentNode = range.startContainer;
    while (normalizeText(prefix).length < charCount && prefixWalker.previousNode()) {
        const text = prefixWalker.currentNode.textContent || '';
        prefix = text + prefix;
    }

    // --- SUFFIX (Forward traversal) ---
    let suffix = '';
    if (range.endContainer.nodeType === Node.TEXT_NODE) {
        suffix = (range.endContainer.textContent || '').substring(range.endOffset);
    }

    const suffixWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                if (isNodeIgnored(node)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    suffixWalker.currentNode = range.endContainer;
    while (normalizeText(suffix).length < charCount && suffixWalker.nextNode()) {
        const text = suffixWalker.currentNode.textContent || '';
        suffix += text;
    }

    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

    return {
        prefix: normalizeWhitespace(prefix).slice(-charCount),
        suffix: normalizeWhitespace(suffix).slice(0, charCount),
    };
}

/**
 * Calculate the relative position (0.0 to 1.0) of a range in the document
 */
export function calculatePositionRatio(range: Range): number {
    const rect = range.getBoundingClientRect();
    const scrollTop = window.scrollY;
    const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    const absoluteTop = rect.top + scrollTop;
    return Math.min(1, Math.max(0, absoluteTop / docHeight));
}
