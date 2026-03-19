/**
 * CSS Selector Agent
 * 
 * Attempts to locate the highlight target using the stored CSS selector.
 * Fast but fragile - class names can change.
 */

import { HighlightAnchor } from '../../../@/lib/types/highlight';
import { AgentResult, SCORE_WEIGHTS } from './types';
import { normalizeForComparison } from '../normalizers';

/**
 * CSS Selector Agent
 * 
 * Confidence scoring:
 * - Element found + text contains target: 50
 * - Element found but no text match: 15
 * - Element not found: 0
 */
export function cssAgent(
    anchor: HighlightAnchor,
    targetText: string,
    container: HTMLElement = document.body
): AgentResult {
    if (!anchor.containerSelector) {
        return {
            element: null,
            confidence: 0,
            method: 'css',
            debugInfo: 'No CSS selector in anchor'
        };
    }

    try {
        const element = container.querySelector(anchor.containerSelector) as HTMLElement;

        if (!element) {
            return {
                element: null,
                confidence: 0,
                method: 'css',
                debugInfo: `Selector not found: ${anchor.containerSelector}`
            };
        }

        // Check if element contains the target text
        const elementText = element.textContent || '';
        const normalizedElement = normalizeForComparison(elementText);
        const normalizedTarget = normalizeForComparison(targetText);

        if (normalizedElement.includes(normalizedTarget)) {
            return {
                element,
                confidence: 50,
                method: 'css',
                debugInfo: 'CSS selector matched with text confirmation'
            };
        }

        // Element found but text doesn't match - lower confidence
        return {
            element,
            confidence: SCORE_WEIGHTS.CSS_MATCH,
            method: 'css',
            debugInfo: 'CSS selector matched but text not found in element'
        };

    } catch (e) {
        return {
            element: null,
            confidence: 0,
            method: 'css',
            debugInfo: `CSS selector error: ${e}`
        };
    }
}
