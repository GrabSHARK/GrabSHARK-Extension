/**
 * CSS Selector Generation for Highlight Anchoring
 * Generates stable CSS selectors avoiding utility classes
 */

/** Unstable class patterns to avoid in CSS selectors */
const UNSTABLE_CLASS_PATTERNS = [
    /^(hover|focus|active|visited|disabled):/,
    /^(sm|md|lg|xl|2xl):/,
    /^(group|peer)-/,
    /^text-[a-z]+-\d+$/,
    /^bg-[a-z]+-\d+$/,
    /^border-[a-z]+-\d+$/,
    /^p[xytblr]?-\d+$/,
    /^m[xytblr]?-\d+$/,
    /^w-\d+$/,
    /^h-\d+$/,
    /^[a-z]{5,}_[a-zA-Z0-9]{5,}$/,
    /^css-[a-z0-9]+$/,
    /^sc-[a-zA-Z0-9]+$/,
    /^_[a-zA-Z0-9]{6,}$/,
];

/** Stable semantic class patterns to prefer */
const STABLE_CLASS_PATTERNS = [
    /^(article|content|main|post|entry|body)/i,
    /^(header|footer|nav|sidebar|menu)/i,
    /^(title|heading|paragraph|text|description)/i,
    /^(card|item|list|row|cell|container)/i,
];

/**
 * Generate a stable CSS selector for an element
 */
export function generateCSSPath(element: Element): string {
    const pathParts: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body && current !== document.documentElement) {
        const part = getElementSelector(current);
        pathParts.unshift(part);
        current = current.parentElement;
    }

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
    if (element.id && !isUnstableId(element.id)) {
        return `#${CSS.escape(element.id)}`;
    }

    const stableClasses = getStableClasses(element);
    if (stableClasses.length > 0) {
        const classSelector = stableClasses.slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
        return `${element.tagName.toLowerCase()}${classSelector}`;
    }

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
export function isUnstableId(id: string): boolean {
    return /^[a-f0-9]{8,}$/i.test(id) ||
        /^(ember|react|vue|angular|svelte)\d+/i.test(id) ||
        /^:r[0-9a-z]+:$/i.test(id);
}

/**
 * Get stable classes from an element, filtering out utility classes
 */
function getStableClasses(element: Element): string[] {
    const classes = Array.from(element.classList);

    const stable = classes.filter(cls => {
        if (UNSTABLE_CLASS_PATTERNS.some(pattern => pattern.test(cls))) {
            return false;
        }
        return true;
    });

    return stable.sort((a, b) => {
        const aStable = STABLE_CLASS_PATTERNS.some(p => p.test(a));
        const bStable = STABLE_CLASS_PATTERNS.some(p => p.test(b));
        if (aStable && !bStable) return -1;
        if (!aStable && bStable) return 1;
        return a.length - b.length;
    });
}
