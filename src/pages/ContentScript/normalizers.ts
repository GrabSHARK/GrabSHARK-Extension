/**
 * Normalization Layer for Fuzzy Text Matching
 * 
 * Handles:
 * - Unicode normalization (smart quotes, etc.)
 * - Whitespace normalization (nbsp, tabs, newlines)
 * - Optional punctuation normalization
 * 
 * Critical for matching text across different DOM states,
 * archived HTML, and live pages.
 */

// ============================================================================
// WHITESPACE NORMALIZATION
// ============================================================================

/**
 * Normalize all whitespace to single spaces and trim
 * Handles: spaces, tabs, newlines, \r, non-breaking spaces (nbsp)
 */
export function normalizeWhitespace(text: string): string {
    return text
        .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ') // Non-breaking spaces and other Unicode spaces
        .replace(/\s+/g, ' ')  // Collapse all whitespace to single space
        .trim();
}

// ============================================================================
// UNICODE NORMALIZATION
// ============================================================================

/**
 * Unicode character mappings for normalization
 * Smart quotes, dashes, and common typographic replacements
 */
const UNICODE_REPLACEMENTS: [RegExp, string][] = [
    // Smart quotes → straight quotes
    [/[\u2018\u2019\u201A\u201B]/g, "'"],  // Single quotes: ' ' ‚ ‛
    [/[\u201C\u201D\u201E\u201F]/g, '"'],  // Double quotes: " " „ ‟

    // Dashes → hyphen
    [/[\u2010-\u2015\u2212]/g, '-'],  // Various dashes: ‐ ‑ ‒ – — ― −

    // Ellipsis
    [/\u2026/g, '...'],  // … → ...

    // Apostrophes
    [/[\u02BC\u02BB]/g, "'"],  // ʼ ʻ

    // Spaces (additional)
    [/\u00A0/g, ' '],  // Non-breaking space
    [/\u200B/g, ''],   // Zero-width space (remove)
    [/\u200C/g, ''],   // Zero-width non-joiner (remove)
    [/\u200D/g, ''],   // Zero-width joiner (remove)
    [/\uFEFF/g, ''],   // BOM (remove)
];

/**
 * Normalize Unicode characters to their ASCII equivalents
 */
export function normalizeUnicode(text: string): string {
    let result = text;
    for (const [pattern, replacement] of UNICODE_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

// ============================================================================
// PUNCTUATION NORMALIZATION (Optional)
// ============================================================================

/**
 * Remove or normalize punctuation for looser matching
 * Use with caution - can cause false positives
 */
export function normalizePunctuation(text: string, mode: 'remove' | 'simplify' = 'simplify'): string {
    if (mode === 'remove') {
        // Remove all punctuation
        return text.replace(/[^\w\s]/g, '');
    }

    // Simplify: Keep basic punctuation, normalize variants
    return text
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/[–—]/g, '-');
}

// ============================================================================
// CASE NORMALIZATION
// ============================================================================

/**
 * Normalize case for case-insensitive matching
 */
export function normalizeCase(text: string): string {
    return text.toLowerCase();
}

// ============================================================================
// MAIN COMPARISON FUNCTIONS
// ============================================================================

/**
 * Full normalization for text comparison (case-sensitive)
 * Use this for most matching operations
 */
export function normalizeForComparison(text: string): string {
    return normalizeWhitespace(normalizeUnicode(text));
}

/**
 * Full normalization for text comparison (case-insensitive)
 * Use for fuzzy matching when case doesn't matter
 */
export function normalizeForFuzzyComparison(text: string): string {
    return normalizeCase(normalizeForComparison(text));
}

/**
 * Strict normalization - only whitespace, preserves case and unicode
 * Use for exact matching with whitespace tolerance
 */
export function normalizeStrict(text: string): string {
    return normalizeWhitespace(text);
}

// ============================================================================
// SIMILARITY SCORING
// ============================================================================

/**
 * Calculate similarity ratio between two normalized strings
 * Returns value between 0 (no match) and 1 (exact match)
 */
export function calculateSimilarity(text1: string, text2: string): number {
    const norm1 = normalizeForFuzzyComparison(text1);
    const norm2 = normalizeForFuzzyComparison(text2);

    if (norm1 === norm2) return 1;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Simple containment check
    if (norm1.includes(norm2)) return norm2.length / norm1.length;
    if (norm2.includes(norm1)) return norm1.length / norm2.length;

    // Levenshtein distance for fuzzy matching
    const distance = levenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);

    return 1 - (distance / maxLength);
}

/**
 * Levenshtein distance calculation
 * Optimized for short-to-medium strings (typical highlight text)
 */
function levenshteinDistance(s1: string, s2: string): number {
    // Early exit for identical strings
    if (s1 === s2) return 0;

    const len1 = s1.length;
    const len2 = s2.length;

    // Early exit for empty strings
    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    // Use single array optimization
    let prev = new Array(len2 + 1);
    let curr = new Array(len2 + 1);

    // Initialize first row
    for (let j = 0; j <= len2; j++) {
        prev[j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        curr[0] = i;

        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                prev[j] + 1,      // deletion
                curr[j - 1] + 1,  // insertion
                prev[j - 1] + cost // substitution
            );
        }

        // Swap arrays
        [prev, curr] = [curr, prev];
    }

    return prev[len2];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if two texts are "close enough" to be considered a match
 * Uses multiple strategies for robustness
 */
export function isTextMatch(
    expected: string,
    actual: string,
    options: {
        caseSensitive?: boolean;
        threshold?: number;  // 0-1, default 0.95
    } = {}
): { match: boolean; score: number; method: 'exact' | 'normalized' | 'fuzzy' } {
    const { caseSensitive = true, threshold = 0.95 } = options;

    // Strategy 1: Exact match
    if (expected === actual) {
        return { match: true, score: 1, method: 'exact' };
    }

    // Strategy 2: Normalized match (whitespace + unicode)
    const normExpected = normalizeForComparison(expected);
    const normActual = normalizeForComparison(actual);

    if (caseSensitive) {
        if (normExpected === normActual) {
            return { match: true, score: 0.99, method: 'normalized' };
        }
    } else {
        if (normExpected.toLowerCase() === normActual.toLowerCase()) {
            return { match: true, score: 0.98, method: 'normalized' };
        }
    }

    // Strategy 3: Fuzzy match (similarity score)
    const similarity = calculateSimilarity(expected, actual);
    if (similarity >= threshold) {
        return { match: true, score: similarity, method: 'fuzzy' };
    }

    return { match: false, score: similarity, method: 'fuzzy' };
}
