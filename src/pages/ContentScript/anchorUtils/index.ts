/**
 * Anchor Utilities for Waterfall Highlight Anchoring
 * 
 * Barrel re-export for backward compatibility.
 * All submodules are split by responsibility:
 * - cssSelector: Stable CSS selector generation
 * - xpathGenerator: XPath structural selectors
 * - textUtils: Text normalization, offset mapping
 * - contextCapture: Context prefix/suffix capture
 * - semanticAnchor: Heading-based triangulation
 * - anchorResolution: Text match + context scoring
 */

export { generateCSSPath, isUnstableId } from './cssSelector';
export { generateXPath } from './xpathGenerator';
export {
    normalizeText,
    mapNormalizedToRawOffset,
    mapRawToNormalizedOffset,
    getFilteredTextContent,
    countOccurrences,
    getAdaptiveContextLength
} from './textUtils';
export { captureContext, calculatePositionRatio } from './contextCapture';
export { captureAnchor, captureSemanticAnchor, generateRobustSelector, findNearestHeading } from './semanticAnchor';
export { findAllTextMatches, findBestMatchWithContext } from './anchorResolution';
