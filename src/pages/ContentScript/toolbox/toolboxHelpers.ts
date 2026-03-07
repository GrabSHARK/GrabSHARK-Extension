/**
 * HighlightToolbox Helpers - Link extraction and viewport positioning
 * Extracted from HighlightToolbox class
 */

/**
 * Extract links from the current text selection
 */
export function extractLinksFromSelection(): Array<{ url: string; label: string }> {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const linksMap = new Map<string, { url: string; label: string }>();

    for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const container = range.commonAncestorContainer;

        const tempDiv = document.createElement('div');
        tempDiv.appendChild(range.cloneContents());

        tempDiv.querySelectorAll('a[href]').forEach((a) => {
            const anchor = a as HTMLAnchorElement;
            const href = anchor.href;
            if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
                const label = anchor.textContent?.trim() || href.split('/').pop() || href;
                linksMap.set(href, { url: href, label });
            }
        });

        let node: Node | null = container;
        while (node && node !== document.body) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'A') {
                const anchor = node as HTMLAnchorElement;
                const href = anchor.href;
                if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
                    const label = anchor.textContent?.trim() || href.split('/').pop() || href;
                    linksMap.set(href, { url: href, label });
                }
            }
            node = node.parentNode;
        }

        const text = range.toString();
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
        const matches = text.match(urlRegex);
        if (matches) {
            matches.forEach((url) => {
                const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
                if (!linksMap.has(cleanUrl)) {
                    linksMap.set(cleanUrl, { url: cleanUrl, label: cleanUrl });
                }
            });
        }
    }

    return Array.from(linksMap.values());
}

/**
 * Position toolbox within viewport boundaries
 */
export function positionWithinViewport(
    container: HTMLDivElement,
    isCommentMode: boolean,
    position: { x: number; y: number },
    targetRect?: DOMRect | null
): void {
    const EDGE_PADDING = 10;
    const GAP = 12;

    const toolboxWidth = container.offsetWidth || 280;
    const toolboxHeight = container.offsetHeight || (isCommentMode ? 160 : 50);

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let rect: DOMRect | null = targetRect || null;

    if (!rect) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
            try {
                rect = selection.getRangeAt(0).getBoundingClientRect();
            } catch (e) { }
        }
    }

    if (!rect) {
        container.style.left = `${position.x}px`;
        container.style.top = `${position.y}px`;
        container.style.transform = 'translate(-50%, 0)';
        return;
    }

    // Horizontal positioning
    let x = rect.left + scrollX + (rect.width / 2);
    container.style.transform = 'translate(-50%, 0)';

    const leftEdge = x - (toolboxWidth / 2);
    const rightEdge = x + (toolboxWidth / 2);

    if (leftEdge < scrollX + EDGE_PADDING) {
        x = scrollX + EDGE_PADDING + (toolboxWidth / 2);
    } else if (rightEdge > scrollX + viewportWidth - EDGE_PADDING) {
        x = scrollX + viewportWidth - EDGE_PADDING - (toolboxWidth / 2);
    }

    // Vertical positioning
    let y: number;
    const spaceAbove = rect.top - EDGE_PADDING;
    const fitsAbove = spaceAbove >= (toolboxHeight + GAP);
    const spaceBelow = viewportHeight - rect.bottom - EDGE_PADDING;
    const fitsBelow = spaceBelow >= (toolboxHeight + GAP);

    if (fitsAbove) {
        y = rect.top + scrollY - toolboxHeight - GAP;
    } else if (fitsBelow) {
        y = rect.bottom + scrollY + GAP;
    } else {
        const selectionCenterY = rect.top + (rect.height / 2);
        y = selectionCenterY + scrollY - (toolboxHeight / 2);
        const minY = scrollY + EDGE_PADDING;
        const maxY = scrollY + viewportHeight - toolboxHeight - EDGE_PADDING;
        y = Math.max(minY, Math.min(maxY, y));
    }

    container.style.left = `${x}px`;
    container.style.top = `${y}px`;
}
