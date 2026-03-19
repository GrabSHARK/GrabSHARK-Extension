/**
 * Semantic Anchor and Robust Selector Generation
 * Heading-based triangulation and Playwright-style selectors
 */

import { SemanticAnchor } from '../../../@/lib/types/highlight';
import { isUnstableId, generateCSSPath } from './cssSelector';
import { generateXPath } from './xpathGenerator';
import { captureContext, calculatePositionRatio } from './contextCapture';
import type { HighlightAnchor } from '../../../@/lib/types/highlight';

/**
 * Capture all anchor data for a selection range (main entry point)
 */
export function captureAnchor(range: Range): HighlightAnchor {
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE
        ? container.parentElement
        : container as Element;

    if (!element) {
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

/**
 * Capture semantic anchor: nearest H1-H3 heading or element with ID
 */
export function captureSemanticAnchor(element: Element): SemanticAnchor {
    const { heading, relativeIndex } = findNearestHeading(element);
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

    return {
        nearestHeadingText: '',
        headingTag: 'h1',
        headingSelector: '',
        relativeIndex: 0,
        nearestIdElement
    };
}

/**
 * Find the nearest H1-H3 heading before this element
 */
export function findNearestHeading(element: Element): { heading: Element | null; relativeIndex: number } {
    const headingTags = ['H1', 'H2', 'H3'];
    let current: Element | null = element;
    let relativeIndex = 0;

    while (current) {
        let sibling: Element | null = current.previousElementSibling;
        while (sibling) {
            if (headingTags.includes(sibling.tagName)) {
                return { heading: sibling, relativeIndex };
            }
            if (isBlockElement(sibling)) {
                relativeIndex++;
            }
            sibling = sibling.previousElementSibling;
        }

        current = current.parentElement;
        if (current && isBlockElement(current)) {
            relativeIndex++;
        }
    }

    return { heading: null, relativeIndex: 0 };
}

function isBlockElement(element: Element): boolean {
    const blockTags = ['P', 'DIV', 'ARTICLE', 'SECTION', 'BLOCKQUOTE', 'LI', 'TR', 'TD', 'TH'];
    return blockTags.includes(element.tagName);
}

function findNearestIdElement(element: Element): { id: string; tagName: string; relativeIndex: number } | undefined {
    let current: Element | null = element;
    let relativeIndex = 0;

    while (current && current !== document.body) {
        if (current.id && !isUnstableId(current.id)) {
            return { id: current.id, tagName: current.tagName.toLowerCase(), relativeIndex };
        }

        let sibling: Element | null = current.previousElementSibling;
        let siblingOffset = 0;
        while (sibling) {
            siblingOffset++;
            if (sibling.id && !isUnstableId(sibling.id)) {
                return { id: sibling.id, tagName: sibling.tagName.toLowerCase(), relativeIndex: siblingOffset };
            }
            sibling = sibling.previousElementSibling;
        }

        current = current.parentElement;
        relativeIndex++;
    }

    return undefined;
}

function generateHeadingSelector(heading: Element): string {
    const tag = heading.tagName.toLowerCase();
    const text = heading.textContent?.trim().slice(0, 50) || '';

    if (heading.id && !isUnstableId(heading.id)) {
        return `#${CSS.escape(heading.id)}`;
    }

    const textPart = text.length > 0 ? `:has-text("${escapeSelector(text)}")` : '';
    return `${tag}${textPart}`;
}

/**
 * Generate a Playwright-style robust selector
 */
export function generateRobustSelector(element: Element, selectedText: string): string {
    const tag = element.tagName.toLowerCase();
    const shortText = selectedText.slice(0, 50);

    const textPart = shortText.length > 0
        ? `:has-text("${escapeSelector(shortText)}")`
        : '';

    const landmark = findNearestLandmark(element);
    const nearPart = landmark ? `:near(${landmark})` : '';

    return `${tag}${textPart}${nearPart}`;
}

function findNearestLandmark(element: Element): string | null {
    let current: Element | null = element;
    while (current && current !== document.body) {
        if (current.id && !isUnstableId(current.id)) {
            return `#${CSS.escape(current.id)}`;
        }
        current = current.parentElement;
    }

    const { heading } = findNearestHeading(element);
    if (heading) {
        const headingText = heading.textContent?.trim().slice(0, 30) || '';
        if (headingText) {
            return `${heading.tagName.toLowerCase()}:has-text("${escapeSelector(headingText)}")`;
        }
    }

    return null;
}

function escapeSelector(text: string): string {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .trim();
}
