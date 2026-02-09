/**
 * Agent Types for Weighted Voting System
 * 
 * Each agent independently searches for the highlight target
 * and returns a result with confidence score.
 */

/**
 * Result from an agent's search
 */
export interface AgentResult {
    /** The element found by this agent (null if not found) */
    element: HTMLElement | null;

    /** Confidence score 0-100 */
    confidence: number;

    /** Which method produced this result */
    method: 'css' | 'xpath' | 'context' | 'semantic' | 'robust';

    /** Debug info for logging */
    debugInfo?: string;
}

/**
 * Scored candidate after all agents have voted
 */
export interface ScoredCandidate {
    element: HTMLElement;
    totalScore: number;
    breakdown: {
        textMatch: number;
        contextMatch: number;
        anchorMatch: number;
        proximityMatch: number;
        consensus: number;
    };
    supportingAgents: string[];
}

/**
 * Score weights for candidate evaluation
 */
export const SCORE_WEIGHTS = {
    TEXT_EXACT_MATCH: 100,
    TEXT_FUZZY_MATCH: 80,
    CONTEXT_FULL_MATCH: 50,
    CONTEXT_PARTIAL_PER_CHAR: 1,  // Per matching character
    CSS_MATCH: 15,
    XPATH_MATCH: 20,
    SEMANTIC_MATCH: 40,
    ROBUST_MATCH: 35,
    POSITION_MATCH: 10,
    AGENT_CONSENSUS: 30,  // 2+ agents point to same element
} as const;

/**
 * Minimum score required to apply a highlight
 * Below this threshold, we reject (no false positives)
 */
export const MINIMUM_THRESHOLD = 100;
