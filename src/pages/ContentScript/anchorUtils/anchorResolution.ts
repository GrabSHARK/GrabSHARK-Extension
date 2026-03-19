/**
 * Anchor Resolution for Waterfall Rendering
 * Finds text matches and resolves best match using context
 */

import { normalizeText, getFilteredTextContent } from './textUtils';

/**
 * Find all text matches in the document
 */
export function findAllTextMatches(
    searchText: string,
    container: HTMLElement = document.body
): { index: number; node: Text; startInNode: number }[] {
    const normalizedSearch = normalizeText(searchText);
    const matches: { index: number; node: Text; startInNode: number }[] = [];

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

    const nodes: { node: Text; start: number; end: number }[] = [];
    let fullText = '';

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const text = node.textContent || '';
        nodes.push({ node, start: fullText.length, end: fullText.length + text.length });
        fullText += text;
    }

    const normalizedFull = normalizeText(fullText);
    let searchIndex = 0;

    while (true) {
        const foundIndex = normalizedFull.indexOf(normalizedSearch, searchIndex);
        if (foundIndex === -1) break;

        const ratio = foundIndex / normalizedFull.length;
        const estimatedOriginalIndex = Math.floor(ratio * fullText.length);

        for (const { node, start, end } of nodes) {
            if (estimatedOriginalIndex >= start && estimatedOriginalIndex < end) {
                matches.push({
                    index: foundIndex,
                    node,
                    startInNode: estimatedOriginalIndex - start,
                });
                break;
            }
        }

        searchIndex = foundIndex + 1;
    }

    return matches;
}

/**
 * Find the best match using context
 */
export function findBestMatchWithContext(
    searchText: string,
    context: { prefix: string; suffix: string },
    container: HTMLElement = document.body
): { index: number; score: number } | null {
    const allText = normalizeText(getFilteredTextContent(container));
    const normalizedSearch = normalizeText(searchText);
    const normalizedPrefix = normalizeText(context.prefix);
    const normalizedSuffix = normalizeText(context.suffix);

    let bestMatch: { index: number; score: number } | null = null;
    let searchIndex = 0;

    while (true) {
        const foundIndex = allText.indexOf(normalizedSearch, searchIndex);
        if (foundIndex === -1) break;

        let score = 0;

        // Check prefix
        const rawPrefix = allText.substring(
            Math.max(0, foundIndex - normalizedPrefix.length - 5),
            foundIndex
        );
        const actualPrefix = rawPrefix.trim();

        if (actualPrefix === normalizedPrefix) {
            score += normalizedPrefix.length;
        } else {
            const maxCheckLen = Math.min(actualPrefix.length, normalizedPrefix.length);
            for (let i = maxCheckLen; i >= 1; i--) {
                if (normalizedPrefix.endsWith(actualPrefix.slice(-i))) {
                    score += i;
                    break;
                }
            }
        }

        // Check suffix
        const rawSuffix = allText.substring(
            foundIndex + normalizedSearch.length,
            foundIndex + normalizedSearch.length + normalizedSuffix.length + 5
        );
        const actualSuffix = rawSuffix.trim();

        if (actualSuffix === normalizedSuffix) {
            score += normalizedSuffix.length;
        } else {
            const maxCheckLen = Math.min(actualSuffix.length, normalizedSuffix.length);
            for (let i = maxCheckLen; i >= 1; i--) {
                if (normalizedSuffix.startsWith(actualSuffix.slice(0, i))) {
                    score += i;
                    break;
                }
            }
        }

        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { index: foundIndex, score };
        }

        searchIndex = foundIndex + 1;
    }

    return bestMatch;
}
