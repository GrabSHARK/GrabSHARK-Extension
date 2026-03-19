/**
 * Text Utilities for Highlight Anchoring
 * Text normalization, offset mapping, and content filtering
 */

/**
 * Normalize text for comparison (collapse whitespace, trim)
 */
export function normalizeText(text: string): string {
    return text
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Map a normalized text offset back to the raw text offset
 * Uses character-by-character mapping, NOT ratio estimation.
 */
export function mapNormalizedToRawOffset(rawText: string, normalizedOffset: number): number {
    if (normalizedOffset <= 0 || !rawText) return 0;

    let normalizedCounter = 0;
    let rawIndex = 0;
    let inWhitespace = false;

    // Skip leading whitespace (trim() removes it in normalized text)
    while (rawIndex < rawText.length && /\s/.test(rawText[rawIndex])) {
        rawIndex++;
    }

    while (rawIndex < rawText.length && normalizedCounter < normalizedOffset) {
        const char = rawText[rawIndex];
        const isWhitespace = /\s/.test(char);

        if (isWhitespace) {
            if (!inWhitespace) {
                normalizedCounter++;
                inWhitespace = true;
            }
        } else {
            normalizedCounter++;
            inWhitespace = false;
        }

        rawIndex++;
    }

    return rawIndex;
}

/**
 * Map a raw text offset to normalized text offset
 */
export function mapRawToNormalizedOffset(rawText: string, rawOffset: number): number {
    if (rawOffset <= 0 || !rawText) return 0;

    let normalizedCounter = 0;
    let rawIndex = 0;
    let inWhitespace = false;

    while (rawIndex < rawText.length && /\s/.test(rawText[rawIndex])) {
        if (rawIndex >= rawOffset) {
            return normalizedCounter;
        }
        rawIndex++;
    }

    while (rawIndex < rawText.length && rawIndex < rawOffset) {
        const char = rawText[rawIndex];
        const isWhitespace = /\s/.test(char);

        if (isWhitespace) {
            if (!inWhitespace) {
                normalizedCounter++;
                inWhitespace = true;
            }
        } else {
            normalizedCounter++;
            inWhitespace = false;
        }

        rawIndex++;
    }

    return normalizedCounter;
}

/**
 * Get filtered text content (excluding script, style, etc.)
 */
export function getFilteredTextContent(container: HTMLElement): string {
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

/** Default context characters to capture before/after selection */
export const DEFAULT_CONTEXT_CHAR_COUNT = 30;

/** Maximum context characters for highly repeated text */
export const MAX_CONTEXT_CHAR_COUNT = 120;

/**
 * Count occurrences of text in container with early exit for performance.
 */
export function countOccurrences(searchText: string, fullText: string, maxCount: number = 11): number {
    const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedFull = fullText.toLowerCase().replace(/\s+/g, ' ');

    let count = 0;
    let pos = 0;

    while ((pos = normalizedFull.indexOf(normalizedSearch, pos)) !== -1) {
        count++;
        if (count >= maxCount) return count;
        pos++;
    }

    return count;
}

/**
 * Get adaptive context length based on how many times the selected text appears.
 */
export function getAdaptiveContextLength(selectedText: string, containerText: string): number {
    const occurrences = countOccurrences(selectedText, containerText);

    if (occurrences > 10) return MAX_CONTEXT_CHAR_COUNT;
    if (occurrences > 5) return 90;
    if (occurrences > 2) return 60;
    return DEFAULT_CONTEXT_CHAR_COUNT;
}
