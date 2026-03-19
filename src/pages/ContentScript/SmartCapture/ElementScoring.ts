/**
 * Element Scoring - Scoring and detection helpers for ElementDetector
 * Pure functions extracted from ElementDetector class
 */

import { CaptureTargetType, FILE_EXTENSIONS, TEXT_BLOCK_TAGS, NAV_PENALTY_TAGS } from './types';

const MIN_ELEMENT_SIZE = 16;
const MAX_SIZE_RATIO = 0.85;
const INTERACTIVE_TAGS = ['img', 'video', 'canvas', 'svg', 'a', 'button', 'input', 'textarea', 'article', 'section', 'figure'];
const LAYOUT_WRAPPER_TAGS = ['div', 'span'];
const UI_CLASS_PREFIX = 'lw-';

/**
 * Check if element is part of our UI
 */
export function isOurUI(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
        if (current.id === 'lw-capture-overlay' || current.id === 'lw-capture-actionbar') return true;
        if (current !== document.body && current.className && typeof current.className === 'string') {
            if (current.className.includes('lw-capture-overlay') ||
                current.className.includes('lw-capture-actionbar') ||
                current.className.includes('lw-toolbox')) {
                return true;
            }
        }
        current = current.parentElement;
    }
    return false;
}

/**
 * Get background image URL if present
 */
export function getBackgroundImage(element: Element): string | null {
    try {
        const style = window.getComputedStyle(element);
        const bgImage = style.backgroundImage;

        if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
            const match = bgImage.match(/url\s*\(\s*(?:(['"])(.*?)\1|([^)]+))\s*\)/);
            if (match) {
                const url = match[2] || match[3];
                if (url) return url.trim();
            }

            if (!bgImage.includes(',')) {
                let url = bgImage.slice(bgImage.indexOf('url(') + 4).trim();
                if (url.endsWith(')')) url = url.slice(0, -1).trim();
                if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
                    url = url.slice(1, -1);
                }
                return url;
            }
        }
    } catch (e) { }
    return null;
}

/**
 * Check if element is a pseudo-image (icon or image container)
 */
export function isPseudoImageElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    if (!['i', 'span', 'div', 'svg'].includes(tagName)) return false;

    const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';

    const iconPatterns = ['icon', 'fa-', 'fas', 'far', 'fab', 'mdi-', 'glyph', 'symbol', 'ico-'];
    const imagePatterns = ['img', 'image', 'thumbnail', 'cover', 'hero', 'bg-img', 'poster'];

    if (imagePatterns.some(pattern => className.includes(pattern))) return true;

    if (iconPatterns.some(pattern => className.includes(pattern))) {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 100 && rect.height > 0 && rect.height < 100) return true;
    }

    return false;
}

/**
 * Check if URL points to a downloadable file
 */
export function isFileUrl(url: string): boolean {
    try {
        const urlObj = new URL(url, window.location.href);
        const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
        return extension ? FILE_EXTENSIONS.includes(extension) : false;
    } catch {
        return false;
    }
}

/**
 * Determine the type of an element
 */
export function getElementType(element: Element): CaptureTargetType {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'img' || tagName === 'picture' || tagName === 'svg' || tagName === 'canvas') return 'IMAGE';
    if (getBackgroundImage(element)) return 'IMAGE';
    if (isPseudoImageElement(element)) return 'IMAGE';
    if (tagName === 'video' && (element as HTMLVideoElement).poster) return 'IMAGE';

    if (tagName === 'a' || element.getAttribute('role') === 'link') {
        const href = element.getAttribute('href');
        if (href) {
            if (isFileUrl(href) || element.hasAttribute('download')) return 'FILE';
            return 'LINK';
        }
    }

    if (TEXT_BLOCK_TAGS.includes(tagName)) return 'TEXT_BLOCK';
    if (isBlockElement(element) && hasSignificantContent(element)) return 'GENERIC_BLOCK';

    return 'NONE';
}

/**
 * Check if element is a block element
 */
export function isBlockElement(element: Element): boolean {
    const blockTags = ['div', 'section', 'article', 'aside', 'main', 'figure', 'li', 'ul', 'ol', 'span'];
    return blockTags.includes(element.tagName.toLowerCase());
}

/**
 * Check if element has significant content
 */
export function hasSignificantContent(element: Element): boolean {
    const text = element.textContent?.trim() || '';
    if (text.length > 10) return true;

    for (const child of element.children) {
        const tagName = child.tagName.toLowerCase();
        if (['img', 'video', 'canvas', 'svg', 'picture'].includes(tagName)) return true;
    }

    return false;
}

/**
 * Check if element has direct meaningful content
 */
export function hasDirectMeaningfulContent(element: Element): boolean {
    for (const child of element.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim() || '';
            if (text.length > 10) return true;
        }
    }

    for (const child of element.children) {
        const tagName = child.tagName.toLowerCase();
        if (['img', 'video', 'canvas', 'svg', 'picture'].includes(tagName)) return true;
    }

    return false;
}

/**
 * Check if element is inside navigation/header/footer
 */
export function isInNavigation(element: Element): boolean {
    let current: Element | null = element;
    while (current) {
        const tagName = current.tagName.toLowerCase();
        const role = current.getAttribute('role');
        if (NAV_PENALTY_TAGS.includes(tagName) || role === 'navigation' || role === 'banner' || role === 'contentinfo') {
            return true;
        }
        current = current.parentElement;
    }
    return false;
}

/**
 * Score an element based on heuristics
 */
export function scoreElement(element: Element, type: CaptureTargetType): number {
    let score = 100;

    if (type === 'IMAGE') {
        if (isPseudoImageElement(element)) score += 50;
        if (getBackgroundImage(element)) score += 40;
    }

    const rect = element.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const elementArea = rect.width * rect.height;
    const sizeRatio = elementArea / viewportArea;

    if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) return -1;
    if (sizeRatio > MAX_SIZE_RATIO) return -1;

    score += (1 - sizeRatio) * 150;

    if (type === 'IMAGE') score += 80;
    else if (type === 'LINK') score += 60;
    else if (type === 'FILE') score += 70;

    const tagName = element.tagName.toLowerCase();
    if (INTERACTIVE_TAGS.includes(tagName)) score += 50;

    if (LAYOUT_WRAPPER_TAGS.includes(tagName) && type !== 'IMAGE') {
        const style = window.getComputedStyle(element);
        if (style.display === 'flex' || style.display === 'grid') score -= 40;
        if (!hasDirectMeaningfulContent(element)) score -= 30;
    }

    if (type === 'TEXT_BLOCK' || type === 'GENERIC_BLOCK') {
        const text = element.textContent?.trim() || '';
        score += Math.min(text.length / 5, 80);
        if (['article', 'blockquote', 'pre', 'code'].includes(tagName)) score += 40;
        if (['h1', 'h2', 'h3'].includes(tagName)) score += 30;
    }

    if (isInNavigation(element)) score -= 100;

    const style = window.getComputedStyle(element);
    if (style.opacity === '0' || style.visibility === 'hidden' || style.pointerEvents === 'none') return -1;
    if (style.position === 'fixed' || style.position === 'sticky') score -= 50;

    return Math.max(0, score);
}

/**
 * Generate CSS path selector
 */
export function getCssPath(element: Element): string {
    const path: string[] = [];
    let current: Element | null = element;

    while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        if (current.id) {
            selector = `#${current.id}`;
            path.unshift(selector);
            break;
        }
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.split(' ')
                .filter(c => c && !c.startsWith(UI_CLASS_PREFIX))
                .slice(0, 2).join('.');
            if (classes) selector += `.${classes}`;
        }
        path.unshift(selector);
        current = current.parentElement;
    }

    return path.join(' > ');
}

/**
 * Generate XPath selector
 */
export function getXPath(element: Element): string {
    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === current.tagName) index++;
            sibling = sibling.previousElementSibling;
        }
        parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
        current = current.parentElement;
    }

    return '/' + parts.join('/');
}

/**
 * Get page context information
 */
export function getPageContext() {
    const faviconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement | null;
    return {
        pageUrl: window.location.href,
        pageTitle: document.title,
        faviconUrl: faviconLink?.href,
        capturedAt: Date.now(),
    };
}
