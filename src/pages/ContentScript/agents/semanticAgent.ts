/**
 * Semantic Agent
 * 
 * Uses heading-based triangulation to find highlights.
 * Finds the stored heading, then searches for text relative to it.
 * Very robust to DOM changes.
 */

import { HighlightAnchor } from '../../../@/lib/types/highlight';
import { AgentResult, SCORE_WEIGHTS } from './types';
import { normalizeForComparison } from '../normalizers';

/**
 * Semantic Agent
 * 
 * Confidence scoring:
 * - Heading + text found at relative position: 80
 * - Heading found + text found anywhere after: 60
 * - ID element + text found: 70
 * - Neither found: 0
 */
export function semanticAgent(
    anchor: HighlightAnchor,
    targetText: string,
    container: HTMLElement = document.body
): AgentResult {
    const semanticAnchor = anchor.semanticAnchor;

    if (!semanticAnchor) {
        return {
            element: null,
            confidence: 0,
            method: 'semantic',
            debugInfo: 'No semantic anchor in highlight'
        };
    }

    // Strategy 1: Try heading-based lookup
    if (semanticAnchor.nearestHeadingText && semanticAnchor.headingSelector) {
        const result = findByHeading(semanticAnchor, targetText, container);
        if (result.element) {
            return result;
        }
    }

    // Strategy 2: Try ID-based lookup
    if (semanticAnchor.nearestIdElement) {
        const result = findByIdElement(semanticAnchor.nearestIdElement, targetText, container);
        if (result.element) {
            return result;
        }
    }

    return {
        element: null,
        confidence: 0,
        method: 'semantic',
        debugInfo: 'Neither heading nor ID anchor found'
    };
}

/**
 * Find element by heading-based triangulation
 */
function findByHeading(
    semanticAnchor: NonNullable<HighlightAnchor['semanticAnchor']>,
    targetText: string,
    container: HTMLElement
): AgentResult {
    // Find the heading by selector or text content
    let heading: HTMLElement | null = null;

    // Try selector first
    if (semanticAnchor.headingSelector) {
        heading = findHeadingBySelector(semanticAnchor.headingSelector, container);
    }

    // Fallback: search by text content
    if (!heading && semanticAnchor.nearestHeadingText) {
        heading = findHeadingByText(
            semanticAnchor.headingTag,
            semanticAnchor.nearestHeadingText,
            container
        );
    }

    if (!heading) {
        return {
            element: null,
            confidence: 0,
            method: 'semantic',
            debugInfo: `Heading not found: ${semanticAnchor.headingSelector}`
        };
    }

    // Search for target text after the heading
    const element = findTextAfterElement(heading, targetText);

    if (element) {
        return {
            element,
            confidence: SCORE_WEIGHTS.SEMANTIC_MATCH + 40, // 80 total
            method: 'semantic',
            debugInfo: `Found after heading: ${semanticAnchor.nearestHeadingText.slice(0, 30)}`
        };
    }

    return {
        element: null,
        confidence: 0,
        method: 'semantic',
        debugInfo: 'Heading found but target text not found after it'
    };
}

/**
 * Find heading by CSS selector (may include :has-text pseudo)
 */
function findHeadingBySelector(selector: string, container: HTMLElement): HTMLElement | null {
    // Handle :has-text pseudo selector
    const hasTextMatch = selector.match(/:has-text\("([^"]+)"\)/);

    if (hasTextMatch) {
        const textToFind = hasTextMatch[1];
        const baseSelector = selector.replace(/:has-text\("[^"]+"\)/, '');

        // Find all matching tags and filter by text
        const candidates = container.querySelectorAll(baseSelector || 'h1, h2, h3');
        for (const candidate of candidates) {
            const text = candidate.textContent?.trim() || '';
            if (normalizeForComparison(text).includes(normalizeForComparison(textToFind))) {
                return candidate as HTMLElement;
            }
        }
        return null;
    }

    // Standard selector
    try {
        return container.querySelector(selector) as HTMLElement;
    } catch {
        return null;
    }
}

/**
 * Find heading by text content
 */
function findHeadingByText(
    tagName: string,
    text: string,
    container: HTMLElement
): HTMLElement | null {
    const headings = container.querySelectorAll(tagName);
    const normalizedSearch = normalizeForComparison(text);

    for (const heading of headings) {
        const headingText = normalizeForComparison(heading.textContent || '');
        if (headingText.includes(normalizedSearch) || normalizedSearch.includes(headingText)) {
            return heading as HTMLElement;
        }
    }

    return null;
}

/**
 * Find element containing target text after a reference element
 */
function findTextAfterElement(reference: HTMLElement, targetText: string): HTMLElement | null {
    const normalizedTarget = normalizeForComparison(targetText);

    // Walk through all text nodes after the reference
    const treeWalker = document.createTreeWalker(
        document.body,
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
            }
        }
    );

    // Skip to the reference element
    let foundReference = false;
    while (treeWalker.nextNode()) {
        const node = treeWalker.currentNode;
        if (reference.contains(node)) {
            foundReference = true;
            continue;
        }

        if (foundReference) {
            const text = normalizeForComparison(node.textContent || '');
            if (text.includes(normalizedTarget)) {
                return node.parentElement;
            }
        }
    }

    return null;
}

/**
 * Find element by ID-based triangulation
 */
function findByIdElement(
    idAnchor: { id: string; tagName: string; relativeIndex: number },
    targetText: string,
    container: HTMLElement
): AgentResult {
    const idElement = container.querySelector(`#${CSS.escape(idAnchor.id)}`);

    if (!idElement) {
        return {
            element: null,
            confidence: 0,
            method: 'semantic',
            debugInfo: `ID element not found: #${idAnchor.id}`
        };
    }

    // Search for target text after the ID element
    const element = findTextAfterElement(idElement as HTMLElement, targetText);

    if (element) {
        return {
            element,
            confidence: SCORE_WEIGHTS.SEMANTIC_MATCH + 30, // 70 total
            method: 'semantic',
            debugInfo: `Found after ID element: #${idAnchor.id}`
        };
    }

    return {
        element: null,
        confidence: 0,
        method: 'semantic',
        debugInfo: 'ID element found but target text not found after it'
    };
}
