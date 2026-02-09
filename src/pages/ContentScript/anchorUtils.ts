/**
 * Anchor Utilities for Waterfall Highlight Anchoring
 * 
 * These utilities generate structural fingerprints for highlight restoration:
 * - CSS Selector: Fast, stable path to container element
 * - XPath: Structural backup when CSS classes change
 * - Context: Text before/after for disambiguation
 * - Position Ratio: Scroll position for reader mode anchoring
 */

import { HighlightAnchor } from '../../@/lib/types/highlight';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default context characters to capture before/after selection */
const DEFAULT_CONTEXT_CHAR_COUNT = 30;

/** Maximum context characters for highly repeated text */
const MAX_CONTEXT_CHAR_COUNT = 120;

// ============================================================================
// ADAPTIVE CONTEXT UTILITIES
// ============================================================================

/**
 * Count occurrences of text in container with early exit for performance.
 * Stops counting after maxCount is reached to avoid unnecessary iterations.
 */
function countOccurrences(searchText: string, fullText: string, maxCount: number = 11): number {
    const normalizedSearch = searchText.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedFull = fullText.toLowerCase().replace(/\s+/g, ' ');

    let count = 0;
    let pos = 0;

    while ((pos = normalizedFull.indexOf(normalizedSearch, pos)) !== -1) {
        count++;
        if (count >= maxCount) return count; // Early exit - no need to count further
        pos++;
    }

    return count;
}

/**
 * Get adaptive context length based on how many times the selected text appears.
 * More occurrences = longer context needed for disambiguation.
 */
function getAdaptiveContextLength(selectedText: string, containerText: string): number {
    const occurrences = countOccurrences(selectedText, containerText);

    if (occurrences > 10) return MAX_CONTEXT_CHAR_COUNT;  // Very frequent text - max context
    if (occurrences > 5) return 90;    // Frequent text
    if (occurrences > 2) return 60;    // Moderate repetition
    return DEFAULT_CONTEXT_CHAR_COUNT; // Unique or rare - default is enough
}

/** 
 * Unstable class patterns to avoid in CSS selectors
 * These classes change frequently (Tailwind, CSS Modules, Emotion, etc.)
 */
const UNSTABLE_CLASS_PATTERNS = [
    /^(hover|focus|active|visited|disabled):/,  // Tailwind states
    /^(sm|md|lg|xl|2xl):/,                       // Tailwind responsive
    /^(group|peer)-/,                             // Tailwind group/peer
    /^text-[a-z]+-\d+$/,                          // Tailwind text colors
    /^bg-[a-z]+-\d+$/,                            // Tailwind bg colors
    /^border-[a-z]+-\d+$/,                        // Tailwind border colors
    /^p[xytblr]?-\d+$/,                           // Tailwind padding
    /^m[xytblr]?-\d+$/,                           // Tailwind margin
    /^w-\d+$/,                                    // Tailwind width
    /^h-\d+$/,                                    // Tailwind height
    /^[a-z]{5,}_[a-zA-Z0-9]{5,}$/,               // CSS Modules hashed classes
    /^css-[a-z0-9]+$/,                           // Emotion/styled-components
    /^sc-[a-zA-Z0-9]+$/,                         // styled-components
    /^_[a-zA-Z0-9]{6,}$/,                        // Next.js CSS Modules
];

/** Stable semantic class patterns to prefer */
const STABLE_CLASS_PATTERNS = [
    /^(article|content|main|post|entry|body)/i,
    /^(header|footer|nav|sidebar|menu)/i,
    /^(title|heading|paragraph|text|description)/i,
    /^(card|item|list|row|cell|container)/i,
];

// ============================================================================
// CSS SELECTOR GENERATION
// ============================================================================

/**
 * Generate a stable CSS selector for an element
 * Avoids unstable utility classes, prefers IDs and semantic classes
 */
export function generateCSSPath(element: Element): string {
    const pathParts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
        const part = getElementSelector(current);
        pathParts.unshift(part);
        current = current.parentElement;
    }

    // Limit path depth to avoid overly specific selectors
    const maxDepth = 5;
    if (pathParts.length > maxDepth) {
        pathParts.splice(0, pathParts.length - maxDepth);
    }

    return pathParts.join(' > ');
}

/**
 * Get a selector part for a single element
 */
function getElementSelector(element: Element): string {
    // 1. Prefer ID (most stable)
    if (element.id && !isUnstableId(element.id)) {
        return `#${CSS.escape(element.id)}`;
    }

    // 2. Find stable classes
    const stableClasses = getStableClasses(element);
    if (stableClasses.length > 0) {
        const classSelector = stableClasses.slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
        return `${element.tagName.toLowerCase()}${classSelector}`;
    }

    // 3. Fall back to tag + nth-child
    const parent = element.parentElement;
    if (parent) {
        const siblings = Array.from(parent.children).filter(
            child => child.tagName === element.tagName
        );
        if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            return `${element.tagName.toLowerCase()}:nth-of-type(${index})`;
        }
    }

    return element.tagName.toLowerCase();
}

/**
 * Check if an ID looks unstable (hashed, generated)
 */
function isUnstableId(id: string): boolean {
    // IDs that look like hashes or generated content
    return /^[a-f0-9]{8,}$/i.test(id) ||
        /^(ember|react|vue|angular|svelte)\d+/i.test(id) ||
        /^:r[0-9a-z]+:$/i.test(id); // React 18 generated IDs
}

/**
 * Get stable classes from an element, filtering out utility classes
 */
function getStableClasses(element: Element): string[] {
    const classes = Array.from(element.classList);

    // Filter out unstable classes
    const stable = classes.filter(cls => {
        // Skip if matches any unstable pattern
        if (UNSTABLE_CLASS_PATTERNS.some(pattern => pattern.test(cls))) {
            return false;
        }
        // Prefer if matches stable pattern
        return true;
    });

    // Sort: stable patterns first, then by length (shorter = more semantic)
    return stable.sort((a, b) => {
        const aStable = STABLE_CLASS_PATTERNS.some(p => p.test(a));
        const bStable = STABLE_CLASS_PATTERNS.some(p => p.test(b));
        if (aStable && !bStable) return -1;
        if (!aStable && bStable) return 1;
        return a.length - b.length;
    });
}

// ============================================================================
// XPATH GENERATION
// ============================================================================

/**
 * Generate an XPath for an element (structural backup)
 */
export function generateXPath(element: Element): string {
    const pathParts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
        let part = current.tagName.toLowerCase();

        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(
                child => child.tagName === current!.tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                part += `[${index}]`;
            }
        }

        pathParts.unshift(part);
        current = current.parentElement;
    }

    return '//' + pathParts.join('/');
}

// ============================================================================
// CONTEXT CAPTURE
// ============================================================================

/**
 * Capture context (prefix/suffix) around a selection range
 * Uses adaptive context length based on how often the selected text appears.
 * 
 * Traverses the DOM backwards/forwards from the selection
 * to capture relevant context regardless of where the text appears.
 */
export function captureContext(
    range: Range,
    charCount?: number // Optional override, otherwise calculated adaptively
): { prefix: string; suffix: string } {
    // Get selected text for adaptive length calculation
    const selectedText = range.toString();

    // Calculate adaptive context length if not provided
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

    // 1. Get initial text from start container (if text node)
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
        prefix = (range.startContainer.textContent || '').substring(0, range.startOffset);
    }

    // 2. Traverse backwards
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

    // Collect enough text for adaptive context
    while (normalizeText(prefix).length < charCount && prefixWalker.previousNode()) {
        const text = prefixWalker.currentNode.textContent || '';
        prefix = text + prefix; // Prepend
    }

    // --- SUFFIX (Forward traversal) ---
    let suffix = '';

    // 1. Get initial text from end container (if text node)
    if (range.endContainer.nodeType === Node.TEXT_NODE) {
        suffix = (range.endContainer.textContent || '').substring(range.endOffset);
    }

    // 2. Traverse forwards
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
        suffix += text; // Append
    }

    // Preserve original case - only collapse whitespace
    const normalizeWhitespace = (text: string) => text.replace(/\s+/g, ' ').trim();

    return {
        prefix: normalizeWhitespace(prefix).slice(-charCount),
        suffix: normalizeWhitespace(suffix).slice(0, charCount),
    };
}

// ============================================================================
// POSITION RATIO
// ============================================================================

/**
 * Calculate the relative position (0.0 to 1.0) of a range in the document
 * Useful for scroll anchoring and reader mode
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

// ============================================================================
// TEXT UTILITIES
// ============================================================================

/**
 * Normalize text for comparison (collapse whitespace, trim)
 * Critical for fuzzy matching across different DOM states
 */
export function normalizeText(text: string): string {
    return text
        .replace(/\s+/g, ' ')  // Collapse all whitespace to single space
        .trim();
}

/**
 * Map a normalized text offset back to the raw text offset
 * 
 * CRITICAL: This does character-by-character mapping, NOT ratio estimation.
 * Ratio estimation fails when text has irregular whitespace (newlines, tabs, multiple spaces)
 * causing "drift" that accumulates over long text passages.
 * 
 * Algorithm:
 * - Iterate through raw text character by character
 * - Track a "normalized counter" that only increments for:
 *   - Non-whitespace characters (always)
 *   - First whitespace in a sequence (since normalization collapses them)
 * - Stop when normalized counter reaches target offset
 * - Account for leading whitespace that gets trimmed
 */
export function mapNormalizedToRawOffset(rawText: string, normalizedOffset: number): number {
    // Handle edge case: empty or offset 0
    if (normalizedOffset <= 0 || !rawText) return 0;

    let normalizedCounter = 0;
    let rawIndex = 0;
    let inWhitespace = false;

    // Skip leading whitespace (trim() removes it in normalized text)
    while (rawIndex < rawText.length && /\s/.test(rawText[rawIndex])) {
        rawIndex++;
    }

    // Now iterate through the rest
    while (rawIndex < rawText.length && normalizedCounter < normalizedOffset) {
        const char = rawText[rawIndex];
        const isWhitespace = /\s/.test(char);

        if (isWhitespace) {
            // Only count first whitespace in a sequence
            if (!inWhitespace) {
                normalizedCounter++;
                inWhitespace = true;
            }
            // Always advance raw index
        } else {
            // Non-whitespace: count it
            normalizedCounter++;
            inWhitespace = false;
        }

        rawIndex++;
    }

    return rawIndex;
}

/**
 * Map a raw text offset to normalized text offset
 * Inverse of mapNormalizedToRawOffset
 */
export function mapRawToNormalizedOffset(rawText: string, rawOffset: number): number {
    if (rawOffset <= 0 || !rawText) return 0;

    let normalizedCounter = 0;
    let rawIndex = 0;
    let inWhitespace = false;

    // Skip leading whitespace
    while (rawIndex < rawText.length && /\s/.test(rawText[rawIndex])) {
        if (rawIndex >= rawOffset) {
            return normalizedCounter;
        }
        rawIndex++;
    }

    // Count characters
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

// ============================================================================
// MAIN CAPTURE FUNCTION
// ============================================================================

/**
 * Capture all anchor data for a selection range
 * This is the main entry point for anchor generation
 * 
 * Now includes semantic anchor and robust selector for Weighted Voting system
 */
export function captureAnchor(range: Range): HighlightAnchor {
    // Get the common ancestor container
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element;

    if (!element) {
        // Return minimal anchor with empty values (required fields)
        return {
            containerSelector: '',
            xpath: '',
            context: { prefix: '', suffix: '' },
            positionRatio: 0,
            semanticAnchor: {
                nearestHeadingText: '',
                headingTag: 'h1',
                headingSelector: '',
                relativeIndex: 0
            },
            robustSelector: ''
        };
    }

    // Get selected text for robust selector
    const selectedText = range.toString().trim();

    return {
        containerSelector: generateCSSPath(element),
        xpath: generateXPath(element),
        context: captureContext(range),
        positionRatio: calculatePositionRatio(range),
        semanticAnchor: captureSemanticAnchor(element),
        robustSelector: generateRobustSelector(element, selectedText)
    };
}

// ============================================================================
// SEMANTIC ANCHOR CAPTURE
// ============================================================================

import { SemanticAnchor } from '../../@/lib/types/highlight';

/**
 * Capture semantic anchor: nearest H1-H3 heading or element with ID
 * Used for heading-based triangulation when CSS/XPath fail
 */
export function captureSemanticAnchor(element: Element): SemanticAnchor {
    // Find nearest heading (H1-H3) by traversing backwards in DOM
    const { heading, relativeIndex } = findNearestHeading(element);

    // Find nearest element with ID as fallback
    const nearestIdElement = findNearestIdElement(element);

    if (heading) {
        const headingTag = heading.tagName.toLowerCase() as 'h1' | 'h2' | 'h3';
        return {
            nearestHeadingText: heading.textContent?.trim().slice(0, 100) || '',
            headingTag,
            headingSelector: generateHeadingSelector(heading),
            relativeIndex,
            nearestIdElement
        };
    }

    // No heading found, use ID element as primary
    return {
        nearestHeadingText: '',
        headingTag: 'h1', // Default, won't be used
        headingSelector: '',
        relativeIndex: 0,
        nearestIdElement
    };
}

/**
 * Find the nearest H1-H3 heading before this element
 * Returns the heading and how many block elements are between them
 */
function findNearestHeading(element: Element): { heading: Element | null; relativeIndex: number } {
    const headingTags = ['H1', 'H2', 'H3'];
    let current: Element | null = element;
    let relativeIndex = 0;

    // Walk backwards through previous siblings and parents
    while (current) {
        // Check previous siblings
        let sibling: Element | null = current.previousElementSibling;
        while (sibling) {
            if (headingTags.includes(sibling.tagName)) {
                return { heading: sibling, relativeIndex };
            }
            // Count block elements
            if (isBlockElement(sibling)) {
                relativeIndex++;
            }
            sibling = sibling.previousElementSibling;
        }

        // Move to parent
        current = current.parentElement;
        if (current && isBlockElement(current)) {
            relativeIndex++;
        }
    }

    return { heading: null, relativeIndex: 0 };
}

/**
 * Check if element is a block-level element
 */
function isBlockElement(element: Element): boolean {
    const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI', 'TR', 'TD', 'TH'];
    return blockTags.includes(element.tagName);
}

/**
 * Find nearest element with an ID attribute
 */
function findNearestIdElement(element: Element): { id: string; tagName: string; relativeIndex: number } | undefined {
    let current: Element | null = element;
    let relativeIndex = 0;

    while (current && current !== document.body) {
        // Check if current element has ID
        if (current.id && !isUnstableId(current.id)) {
            return {
                id: current.id,
                tagName: current.tagName.toLowerCase(),
                relativeIndex
            };
        }

        // Check previous siblings for ID
        let sibling: Element | null = current.previousElementSibling;
        let siblingOffset = 0;
        while (sibling) {
            siblingOffset++;
            if (sibling.id && !isUnstableId(sibling.id)) {
                return {
                    id: sibling.id,
                    tagName: sibling.tagName.toLowerCase(),
                    relativeIndex: siblingOffset
                };
            }
            sibling = sibling.previousElementSibling;
        }

        current = current.parentElement;
        relativeIndex++;
    }

    return undefined;
}

/**
 * Generate a CSS selector specifically for a heading
 * Uses text content for disambiguation
 */
function generateHeadingSelector(heading: Element): string {
    const tag = heading.tagName.toLowerCase();
    const text = heading.textContent?.trim().slice(0, 50) || '';

    // If heading has ID, use it
    if (heading.id && !isUnstableId(heading.id)) {
        return `#${CSS.escape(heading.id)}`;
    }

    // Use tag + text content hash
    const textPart = text.length > 0 ? `:has-text("${escapeSelector(text)}")` : '';
    return `${tag}${textPart}`;
}

// ============================================================================
// ROBUST SELECTOR GENERATION (Playwright-style)
// ============================================================================

/**
 * Generate a Playwright-style robust selector
 * Format: tag:has-text("content"):near(landmark)
 */
export function generateRobustSelector(element: Element, selectedText: string): string {
    const tag = element.tagName.toLowerCase();
    const shortText = selectedText.slice(0, 50);

    // Build the main selector
    const textPart = shortText.length > 0
        ? `:has-text("${escapeSelector(shortText)}")`
        : '';

    // Find nearest landmark for :near() clause
    const landmark = findNearestLandmark(element);
    const nearPart = landmark
        ? `:near(${landmark})`
        : '';

    return `${tag}${textPart}${nearPart}`;
}

/**
 * Find nearest landmark element (heading, id, or semantic element)
 */
function findNearestLandmark(element: Element): string | null {
    // Check for ID on self or ancestors
    let current: Element | null = element;
    while (current && current !== document.body) {
        if (current.id && !isUnstableId(current.id)) {
            return `#${CSS.escape(current.id)}`;
        }
        current = current.parentElement;
    }

    // Check for nearest heading
    const { heading } = findNearestHeading(element);
    if (heading) {
        const headingText = heading.textContent?.trim().slice(0, 30) || '';
        if (headingText) {
            return `${heading.tagName.toLowerCase()}:has-text("${escapeSelector(headingText)}")`;
        }
    }

    return null;
}

/**
 * Escape special characters in selector text
 */
function escapeSelector(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .trim();
}

// ============================================================================
// ANCHOR RESOLUTION (for Waterfall Rendering)
// ============================================================================

/**
 * Find all text matches in the document
 * Returns array of { index, text } for each occurrence
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

    // Build full text first
    const nodes: { node: Text; start: number; end: number }[] = [];
    let fullText = '';

    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode as Text;
        const text = node.textContent || '';
        nodes.push({
            node,
            start: fullText.length,
            end: fullText.length + text.length,
        });
        fullText += text;
    }

    // Normalize and find all matches
    const normalizedFull = normalizeText(fullText);
    let searchIndex = 0;

    while (true) {
        const foundIndex = normalizedFull.indexOf(normalizedSearch, searchIndex);
        if (foundIndex === -1) break;

        // Map back to original text position (approximate)
        // Since we normalized, positions might be slightly off
        // We use the ratio to estimate
        const ratio = foundIndex / normalizedFull.length;
        const estimatedOriginalIndex = Math.floor(ratio * fullText.length);

        // Find which node contains this position
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

        // Calculate context match score
        let score = 0;

        // Check prefix
        // Extract slightly more context (length + 5) to account for whitespace differences/shifts
        const rawPrefix = allText.substring(
            Math.max(0, foundIndex - normalizedPrefix.length - 5),
            foundIndex
        );
        const actualPrefix = rawPrefix.trim();

        if (actualPrefix === normalizedPrefix) {
            score += normalizedPrefix.length;
        } else {
            // Partial match - find longest common suffix (iterate backwards)
            // Use the shorter of the two lengths to avoid out-of-bounds
            const maxCheckLen = Math.min(actualPrefix.length, normalizedPrefix.length);
            for (let i = maxCheckLen; i >= 1; i--) {
                if (normalizedPrefix.endsWith(actualPrefix.slice(-i))) {
                    score += i;
                    break;
                }
            }
        }

        // Check suffix
        // Extract slightly more context (length + 5)
        const rawSuffix = allText.substring(
            foundIndex + normalizedSearch.length,
            foundIndex + normalizedSearch.length + normalizedSuffix.length + 5
        );
        const actualSuffix = rawSuffix.trim();

        if (actualSuffix === normalizedSuffix) {
            score += normalizedSuffix.length;
        } else {
            // Partial match - find longest common prefix (iterate backwards)
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
