/**
 * Element Content Extraction - Extract links, images, videos, files from DOM elements
 * Used by ElementDetector to populate CaptureTarget.extracted
 */

import { FILE_EXTENSIONS } from './types';

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg'];

/**
 * Extract all links from an element
 */
export function extractLinksFromElement(element: Element): Array<{ url: string; label: string }> {
    const linksMap = new Map<string, { url: string; label: string }>();

    let anchors = Array.from(element.querySelectorAll('a[href]'));
    const htmlSnapshot = element.innerHTML.substring(0, 500);

    if (anchors.length === 0) {
        const allAnchors = element.getElementsByTagName('a');
        if (allAnchors.length > 0) {
            anchors = Array.from(allAnchors).filter(a => a.hasAttribute('href'));
        }
    }

    if (anchors.length === 0 && htmlSnapshot.includes('<a')) {
        const allElements = element.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
            if (allElements[i].tagName.toLowerCase() === 'a' && allElements[i].hasAttribute('href')) {
                anchors.push(allElements[i] as HTMLAnchorElement);
            }
        }
    }

    anchors.forEach((a) => {
        const anchor = a as HTMLAnchorElement;
        const fullHref = anchor.href;
        const rawHref = anchor.getAttribute('href');

        let url = '';
        if (fullHref) {
            if (fullHref.startsWith('javascript:') || fullHref.startsWith('mailto:') || fullHref.startsWith('tel:') || fullHref.startsWith('#')) {
                return;
            }
            url = fullHref;
        } else if (rawHref && !rawHref.startsWith('javascript:') && !rawHref.startsWith('#')) {
            try {
                url = new URL(rawHref, document.baseURI).href;
            } catch (e) {
                url = rawHref;
            }
        }

        if (url && !linksMap.has(url)) {
            const label = anchor.textContent?.trim() || url.split('/').pop() || url;
            linksMap.set(url, { url, label });
        }
    });

    // Check if element itself is a link
    if (element.tagName.toLowerCase() === 'a') {
        const anchor = element as HTMLAnchorElement;
        const href = anchor.href;
        if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
            const label = anchor.textContent?.trim() || href.split('/').pop() || href;
            linksMap.set(href, { url: href, label });
        }
    }

    // Check parent link
    const parentLink = element.closest('a[href]');
    if (parentLink) {
        const anchor = parentLink as HTMLAnchorElement;
        const href = anchor.href;
        if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
            const label = anchor.textContent?.trim() || href.split('/').pop() || href;
            linksMap.set(href, { url: href, label });
        }
    }

    return Array.from(linksMap.values());
}

/**
 * Extract all images from an element
 */
export function extractImagesFromElement(element: Element, getBackgroundImage: (el: Element) => string | null): string[] {
    const images: Set<string> = new Set();

    element.querySelectorAll('img[src]').forEach((img) => {
        const src = (img as HTMLImageElement).src || (img as HTMLImageElement).currentSrc;
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
            const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
            if (!VIDEO_EXTENSIONS.includes(ext)) {
                images.add(src);
            }
        }
    });

    element.querySelectorAll('*').forEach((el) => {
        const bgImage = getBackgroundImage(el);
        if (bgImage && (bgImage.startsWith('http://') || bgImage.startsWith('https://'))) {
            images.add(bgImage);
        }
    });

    if (element.tagName.toLowerCase() === 'img') {
        const src = (element as HTMLImageElement).src || (element as HTMLImageElement).currentSrc;
        if (src) images.add(src);
    }

    return Array.from(images);
}

/**
 * Extract all videos from an element
 */
export function extractVideosFromElement(element: Element): string[] {
    const videos: Set<string> = new Set();

    element.querySelectorAll('video[src], video source[src]').forEach((video) => {
        const src = (video as HTMLVideoElement | HTMLSourceElement).src;
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
            videos.add(src);
        }
    });

    element.querySelectorAll('img[src]').forEach((img) => {
        const src = (img as HTMLImageElement).src;
        if (src) {
            const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
            if (VIDEO_EXTENSIONS.includes(ext)) {
                videos.add(src);
            }
        }
    });

    return Array.from(videos);
}

/**
 * Extract all downloadable files from an element
 */
export function extractFilesFromElement(element: Element): Array<{ url: string; label: string }> {
    const files: Map<string, string> = new Map();

    element.querySelectorAll('a[href]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
            const ext = href.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
            if (FILE_EXTENSIONS.includes(ext) && !VIDEO_EXTENSIONS.includes(ext)) {
                const label = (a as HTMLAnchorElement).textContent?.trim() || href.split('/').pop() || 'File';
                files.set(href, label);
            }
        }
    });

    element.querySelectorAll('a[download]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (href && !files.has(href)) {
            const label = (a as HTMLAnchorElement).textContent?.trim() || 'Download';
            files.set(href, label);
        }
    });

    return Array.from(files.entries()).map(([url, label]) => ({ url, label }));
}

/**
 * Sanitize HTML content
 */
export function sanitizeHtml(html: string): string {
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
    if (sanitized.length > 5000) {
        sanitized = sanitized.substring(0, 5000) + '...';
    }
    return sanitized;
}

/**
 * Extract image information from an element
 */
export function extractImageInfo(
    element: Element,
    getBackgroundImage: (el: Element) => string | null
): { src: string; currentSrc?: string; width?: number; height?: number } {
    if (element.tagName.toLowerCase() === 'img') {
        const img = element as HTMLImageElement;
        return {
            src: img.src,
            currentSrc: img.currentSrc || img.src,
            width: img.naturalWidth,
            height: img.naturalHeight,
        };
    }

    const bgImage = getBackgroundImage(element);
    if (bgImage) return { src: bgImage };

    if (element.tagName.toLowerCase() === 'video') {
        return { src: (element as HTMLVideoElement).poster };
    }

    return { src: '' };
}

/**
 * Extract a title from a block element
 */
export function extractBlockTitle(element: Element): string | undefined {
    const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.textContent?.trim();

    const text = element.textContent?.trim() || '';
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) return firstLine;

    return undefined;
}
