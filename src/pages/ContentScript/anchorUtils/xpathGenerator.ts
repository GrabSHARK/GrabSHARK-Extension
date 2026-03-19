/**
 * XPath Generation for Highlight Anchoring
 * Structural backup when CSS classes change
 */

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
