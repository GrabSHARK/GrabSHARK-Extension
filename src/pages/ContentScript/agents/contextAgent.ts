/**
 * Context Agent
 * 
 * Searches for the highlight text using prefix/suffix context.
 * Most reliable agent - doesn't depend on DOM structure.
 * Returns ALL possible matches for voting.
 */

import { HighlightAnchor } from '../../../@/lib/types/highlight';
import { AgentResult, SCORE_WEIGHTS } from './types';
import { normalizeForComparison } from '../normalizers';

/**
 * Context Agent
 * 
 * Returns multiple candidates when text appears multiple times.
 * Each candidate scored by how well prefix/suffix matches.
 * 
 * Confidence scoring:
 * - Full prefix + suffix match: 100
 * - Partial context match: 10-90 based on matching characters
 * - Text found but no context: 30
 */
export function contextAgent(
    targetText: string,
    anchor: HighlightAnchor,
    container: HTMLElement = document.body
): AgentResult[] {
    const results: AgentResult[] = [];

    if (!targetText || targetText.length === 0) {
        return results;
    }

    const pageText = getFilteredTextContent(container);
    const normalizedPage = normalizeForComparison(pageText);
    const normalizedTarget = normalizeForComparison(targetText);
    const normalizedPrefix = anchor.context ? normalizeForComparison(anchor.context.prefix) : '';
    const normalizedSuffix = anchor.context ? normalizeForComparison(anchor.context.suffix) : '';

    // Find all occurrences of the target text
    let searchIndex = 0;
    while (true) {
        const foundIndex = normalizedPage.indexOf(normalizedTarget, searchIndex);
        if (foundIndex === -1) break;

        // Calculate context match score
        let contextScore = 0;

        // Check prefix
        if (normalizedPrefix.length > 0) {
            const actualPrefix = normalizedPage.substring(
                Math.max(0, foundIndex - normalizedPrefix.length - 5),
                foundIndex
            ).trim();

            if (actualPrefix.endsWith(normalizedPrefix)) {
                contextScore += normalizedPrefix.length;
            } else {
                // Partial match - count matching suffix characters
                for (let i = Math.min(actualPrefix.length, normalizedPrefix.length); i >= 1; i--) {
                    if (normalizedPrefix.endsWith(actualPrefix.slice(-i))) {
                        contextScore += i;
                        break;
                    }
                }
            }
        }

        // Check suffix
        if (normalizedSuffix.length > 0) {
            const actualSuffix = normalizedPage.substring(
                foundIndex + normalizedTarget.length,
                foundIndex + normalizedTarget.length + normalizedSuffix.length + 5
            ).trim();

            if (actualSuffix.startsWith(normalizedSuffix)) {
                contextScore += normalizedSuffix.length;
            } else {
                // Partial match - count matching prefix characters
                for (let i = Math.min(actualSuffix.length, normalizedSuffix.length); i >= 1; i--) {
                    if (normalizedSuffix.startsWith(actualSuffix.slice(0, i))) {
                        contextScore += i;
                        break;
                    }
                }
            }
        }

        // Find the DOM element at this position
        const element = findElementAtTextOffset(container, foundIndex, normalizedPage);

        if (element) {
            // Calculate confidence based on context score
            let confidence: number;
            if (contextScore >= normalizedPrefix.length + normalizedSuffix.length) {
                confidence = SCORE_WEIGHTS.TEXT_EXACT_MATCH;
            } else if (contextScore > 0) {
                // Scale from 30 to 90 based on context match
                const maxContext = normalizedPrefix.length + normalizedSuffix.length;
                const ratio = contextScore / Math.max(maxContext, 1);
                confidence = 30 + Math.floor(ratio * 60);
            } else {
                confidence = 30; // Text found but no context
            }

            results.push({
                element,
                confidence,
                method: 'context',
                debugInfo: `Context score: ${contextScore}, index: ${foundIndex}`
            });
        }

        searchIndex = foundIndex + 1;
    }

    return results;
}

/**
 * Get filtered text content (excluding script, style, etc.)
 */
function getFilteredTextContent(container: HTMLElement): string {
    let text = '';
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

    while (treeWalker.nextNode()) {
        text += treeWalker.currentNode.textContent || '';
    }
    return text;
}

/**
 * Find the DOM element that contains text at a specific normalized offset
 */
function findElementAtTextOffset(
    container: HTMLElement,
    normalizedOffset: number,
    normalizedFullText: string
): HTMLElement | null {
    // Estimate raw offset from normalized offset
    const rawText = getFilteredTextContent(container);
    const ratio = normalizedOffset / normalizedFullText.length;
    const estimatedRawOffset = Math.floor(ratio * rawText.length);

    // Walk through text nodes to find the one at this offset
    let currentOffset = 0;
    const treeWalker = document.createTreeWalker(
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

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const nodeLength = node.textContent?.length || 0;

        if (currentOffset + nodeLength > estimatedRawOffset) {
            return node.parentElement;
        }

        currentOffset += nodeLength;
    }

    return null;
}
