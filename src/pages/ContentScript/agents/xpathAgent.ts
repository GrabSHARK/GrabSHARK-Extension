/**
 * XPath Agent
 * 
 * Attempts to locate the highlight target using the stored XPath.
 * More structural than CSS but still fragile to DOM changes.
 */

import { HighlightAnchor } from '../../../@/lib/types/highlight';
import { AgentResult, SCORE_WEIGHTS } from './types';
import { normalizeForComparison } from '../normalizers';

/**
 * XPath Agent
 * 
 * Confidence scoring:
 * - Element found + text contains target: 50
 * - Element found but no text match: 20
 * - Element not found: 0
 */
export function xpathAgent(
    anchor: HighlightAnchor,
    targetText: string
): AgentResult {
    if (!anchor.xpath) {
        return {
            element: null,
            confidence: 0,
            method: 'xpath',
            debugInfo: 'No XPath in anchor'
        };
    }

    try {
        const result = document.evaluate(
            anchor.xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        );

        const element = result.singleNodeValue as HTMLElement;

        if (!element) {
            return {
                element: null,
                confidence: 0,
                method: 'xpath',
                debugInfo: `XPath not found: ${anchor.xpath}`
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
                method: 'xpath',
                debugInfo: 'XPath matched with text confirmation'
            };
        }

        // Element found but text doesn't match - lower confidence
        return {
            element,
            confidence: SCORE_WEIGHTS.XPATH_MATCH,
            method: 'xpath',
            debugInfo: 'XPath matched but text not found in element'
        };

    } catch (e) {
        return {
            element: null,
            confidence: 0,
            method: 'xpath',
            debugInfo: `XPath error: ${e}`
        };
    }
}
