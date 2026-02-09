/**
 * Candidate Scorer for Weighted Voting System
 * 
 * Collects results from all agents, groups by element,
 * scores each candidate, and selects the best one.
 */

import { Highlight } from '../../@/lib/types/highlight';
import {
    AgentResult,
    ScoredCandidate,
    SCORE_WEIGHTS,
    MINIMUM_THRESHOLD
} from './agents/types';
import { normalizeForComparison, isTextMatch } from './normalizers';

/**
 * Score all candidates from agent results
 * Groups results by element and calculates total scores
 */
export function scoreCandidates(
    highlight: Highlight,
    agentResults: AgentResult[],
    container: HTMLElement = document.body
): ScoredCandidate[] {
    // Group results by element (using element reference as key)
    const elementMap = new Map<HTMLElement, AgentResult[]>();

    for (const result of agentResults) {
        if (result.element) {
            const existing = elementMap.get(result.element) || [];
            existing.push(result);
            elementMap.set(result.element, existing);
        }
    }

    // Score each unique element
    const scoredCandidates: ScoredCandidate[] = [];

    for (const [element, results] of elementMap) {
        const candidate = scoreElement(element, highlight, results, container);
        scoredCandidates.push(candidate);
    }

    // Sort by total score descending
    scoredCandidates.sort((a, b) => b.totalScore - a.totalScore);

    return scoredCandidates;
}

/**
 * Score a single element as a highlight candidate
 */
function scoreElement(
    element: HTMLElement,
    highlight: Highlight,
    supportingResults: AgentResult[],
    container: HTMLElement
): ScoredCandidate {
    const breakdown = {
        textMatch: 0,
        contextMatch: 0,
        anchorMatch: 0,
        proximityMatch: 0,
        consensus: 0
    };

    const supportingAgents: string[] = [];

    // 1. Text Match Score (most important)
    const textMatchResult = scoreTextMatch(element, highlight.text);
    breakdown.textMatch = textMatchResult.score;

    // 2. Context Match Score
    if (highlight.anchor?.context) {
        breakdown.contextMatch = scoreContextMatch(element, highlight, container);
    }

    // 3. Anchor Match Score (from agent confidences)
    for (const result of supportingResults) {
        supportingAgents.push(result.method);

        switch (result.method) {
            case 'css':
                breakdown.anchorMatch += Math.min(result.confidence, SCORE_WEIGHTS.CSS_MATCH);
                break;
            case 'xpath':
                breakdown.anchorMatch += Math.min(result.confidence, SCORE_WEIGHTS.XPATH_MATCH);
                break;
            case 'semantic':
                breakdown.anchorMatch += Math.min(result.confidence, SCORE_WEIGHTS.SEMANTIC_MATCH);
                break;
            case 'robust':
                breakdown.anchorMatch += Math.min(result.confidence, SCORE_WEIGHTS.ROBUST_MATCH);
                break;
            case 'context':
                // Context agent confidence already factored into context score
                break;
        }
    }

    // 4. Proximity Match Score (position ratio)
    if (highlight.anchor?.positionRatio !== undefined) {
        breakdown.proximityMatch = scoreProximityMatch(element, highlight.anchor.positionRatio);
    }

    // 5. Consensus Bonus (multiple agents agree)
    const uniqueAgents = new Set(supportingAgents);
    if (uniqueAgents.size >= 2) {
        breakdown.consensus = SCORE_WEIGHTS.AGENT_CONSENSUS;
    }

    const totalScore =
        breakdown.textMatch +
        breakdown.contextMatch +
        breakdown.anchorMatch +
        breakdown.proximityMatch +
        breakdown.consensus;

    return {
        element,
        totalScore,
        breakdown,
        supportingAgents
    };
}

/**
 * Score how well the element's text matches the target
 */
function scoreTextMatch(
    element: HTMLElement,
    targetText: string
): { score: number; method: 'exact' | 'normalized' | 'fuzzy' | 'none' } {
    const elementText = element.textContent || '';

    // Check if element contains the target text
    const result = isTextMatch(targetText, elementText, { caseSensitive: true, threshold: 0.9 });

    if (result.match) {
        if (result.method === 'exact') {
            return { score: SCORE_WEIGHTS.TEXT_EXACT_MATCH, method: 'exact' };
        } else if (result.method === 'normalized') {
            return { score: SCORE_WEIGHTS.TEXT_EXACT_MATCH - 5, method: 'normalized' };
        } else {
            return { score: SCORE_WEIGHTS.TEXT_FUZZY_MATCH, method: 'fuzzy' };
        }
    }

    // Check containment (element text contains target)
    const normalizedElement = normalizeForComparison(elementText);
    const normalizedTarget = normalizeForComparison(targetText);

    if (normalizedElement.includes(normalizedTarget)) {
        return { score: SCORE_WEIGHTS.TEXT_EXACT_MATCH, method: 'normalized' };
    }

    return { score: 0, method: 'none' };
}

/**
 * Score context match (prefix/suffix)
 */
function scoreContextMatch(
    element: HTMLElement,
    highlight: Highlight,
    _container: HTMLElement
): number {
    if (!highlight.anchor?.context) return 0;

    const elementText = element.textContent || '';
    const normalizedElement = normalizeForComparison(elementText);
    const normalizedTarget = normalizeForComparison(highlight.text);
    const normalizedPrefix = normalizeForComparison(highlight.anchor.context.prefix);
    const normalizedSuffix = normalizeForComparison(highlight.anchor.context.suffix);

    // Find target in element
    const targetIndex = normalizedElement.indexOf(normalizedTarget);
    if (targetIndex === -1) return 0;

    let score = 0;

    // Check prefix
    const actualPrefix = normalizedElement.substring(
        Math.max(0, targetIndex - normalizedPrefix.length - 10),
        targetIndex
    ).trim();

    for (let i = Math.min(actualPrefix.length, normalizedPrefix.length); i >= 1; i--) {
        if (normalizedPrefix.endsWith(actualPrefix.slice(-i))) {
            score += i * SCORE_WEIGHTS.CONTEXT_PARTIAL_PER_CHAR;
            break;
        }
    }

    // Check suffix
    const actualSuffix = normalizedElement.substring(
        targetIndex + normalizedTarget.length,
        targetIndex + normalizedTarget.length + normalizedSuffix.length + 10
    ).trim();

    for (let i = Math.min(actualSuffix.length, normalizedSuffix.length); i >= 1; i--) {
        if (normalizedSuffix.startsWith(actualSuffix.slice(0, i))) {
            score += i * SCORE_WEIGHTS.CONTEXT_PARTIAL_PER_CHAR;
            break;
        }
    }

    return Math.min(score, SCORE_WEIGHTS.CONTEXT_FULL_MATCH);
}

/**
 * Score proximity to expected position
 */
function scoreProximityMatch(element: HTMLElement, expectedRatio: number): number {
    const rect = element.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        1
    );

    const actualRatio = absoluteTop / docHeight;
    const diff = Math.abs(actualRatio - expectedRatio);

    // 10% tolerance = full score, linear decay after
    if (diff <= 0.1) {
        return SCORE_WEIGHTS.POSITION_MATCH;
    } else if (diff <= 0.3) {
        return Math.floor(SCORE_WEIGHTS.POSITION_MATCH * (1 - (diff - 0.1) / 0.2));
    }

    return 0;
}

/**
 * Select the best candidate above threshold
 * Returns null if no candidate meets the minimum score
 */
export function selectBestCandidate(
    candidates: ScoredCandidate[]
): ScoredCandidate | null {
    if (candidates.length === 0) {
        return null;
    }

    const best = candidates[0]; // Already sorted by score

    if (best.totalScore >= MINIMUM_THRESHOLD) {


        return best;
    }



    return null;
}
