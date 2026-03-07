// Selection Targets - Convert SelectableUnits to CaptureTargets
import { SelectableUnit } from './SelectableUnits';
import { CaptureTarget } from './types';

const FILE_EXTENSIONS = [
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub',
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
    'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus',
    'mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg',
    'txt', 'csv', 'json', 'xml', 'md', 'yaml', 'yml'
];

function isFileUrl(url: string): boolean {
    try {
        const urlObj = new URL(url, window.location.href);
        const cleanPath = urlObj.pathname.split('?')[0].split('#')[0];
        const extension = cleanPath.split('.').pop()?.toLowerCase();
        return extension ? FILE_EXTENSIONS.includes(extension) : false;
    } catch { return false; }
}

function getBackgroundImageUrl(element: Element): string | null {
    try {
        const style = window.getComputedStyle(element);
        const bgImage = style.backgroundImage;
        if (bgImage && bgImage !== 'none') {
            const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
            return match ? match[1] : null;
        }
        return null;
    } catch { return null; }
}

function extractTitle(element: Element): string | undefined {
    const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) return heading.textContent?.trim();
    const text = element.textContent?.trim() || '';
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 100) return firstLine;
    return undefined;
}

export function extractLinksFromElement(element: Element): Array<{ url: string; label: string }> {
    const linksMap = new Map<string, { url: string; label: string }>();
    let anchors = Array.from(element.querySelectorAll('a[href]'));

    if (anchors.length === 0) {
        const allAnchors = element.getElementsByTagName('a');
        if (allAnchors.length > 0) {
            anchors = Array.from(allAnchors).filter(a => a.hasAttribute('href'));
        }
    }

    if (anchors.length === 0 && /<a\b/i.test(element.innerHTML.substring(0, 1000))) {
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

        if (fullHref && (fullHref.startsWith('javascript:') || fullHref.startsWith('mailto:') || fullHref.startsWith('tel:') || fullHref.startsWith('#'))) return;

        let url = '';
        if (fullHref) {
            url = fullHref;
        } else if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:')) {
            try { url = new URL(rawHref, document.baseURI).href; } catch { url = rawHref; }
        }

        if (url && !linksMap.has(url)) {
            const label = anchor.textContent?.trim() || url.split('/').pop() || url;
            linksMap.set(url, { url, label });
        }
    });

    return Array.from(linksMap.values());
}

export function extractImagesFromElement(element: Element): string[] {
    const images: Set<string> = new Set();
    element.querySelectorAll('img, picture source, svg, canvas').forEach((img) => {
        if (img.tagName.toLowerCase() === 'img') {
            const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src;
            if (src && !src.startsWith('data:')) images.add(src);
        } else if (img.tagName.toLowerCase() === 'source') {
            const srcset = (img as HTMLSourceElement).srcset;
            if (srcset) {
                const firstSrc = srcset.split(',')[0].trim().split(' ')[0];
                if (firstSrc && !firstSrc.startsWith('data:')) images.add(firstSrc);
            }
        }
    });
    return Array.from(images);
}

export function extractVideosFromElement(element: Element): string[] {
    const videos: Set<string> = new Set();
    element.querySelectorAll('video, source').forEach((vid) => {
        if (vid.tagName.toLowerCase() === 'video') {
            const v = vid as HTMLVideoElement;
            if (v.currentSrc) videos.add(v.currentSrc);
            else if (v.src) videos.add(v.src);
        } else if (vid.tagName.toLowerCase() === 'source') {
            const src = (vid as HTMLSourceElement).src;
            const type = (vid as HTMLSourceElement).type;
            if (src && type && type.startsWith('video/')) videos.add(src);
        }
    });
    return Array.from(videos);
}

export function extractFilesFromElement(element: Element): Array<{ url: string; label: string }> {
    const files: Array<{ url: string; label: string }> = [];
    Array.from(element.querySelectorAll('a[href]')).forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (isFileUrl(href)) {
            files.push({ url: href, label: (a as HTMLAnchorElement).textContent?.trim() || href.split('/').pop() || 'File' });
        }
    });
    return files;
}

function resolveSvgUseElements(svg: SVGSVGElement): void {
    const useElements = svg.querySelectorAll('use');
    for (const use of Array.from(useElements)) {
        const href = use.getAttribute('href') || use.getAttribute('xlink:href');
        if (!href || !href.startsWith('#')) continue;
        const referencedEl = document.getElementById(href.substring(1));
        if (!referencedEl) continue;
        const refClone = referencedEl.cloneNode(true) as Element;
        if (refClone.tagName.toLowerCase() === 'symbol') {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            const viewBox = refClone.getAttribute('viewBox');
            if (viewBox) group.setAttribute('viewBox', viewBox);
            while (refClone.firstChild) group.appendChild(refClone.firstChild);
            const x = use.getAttribute('x');
            const y = use.getAttribute('y');
            if (x || y) group.setAttribute('transform', `translate(${x || 0}, ${y || 0})`);
            use.replaceWith(group);
        } else {
            use.replaceWith(refClone);
        }
    }
}

function isValidSvgContent(svgString: string): boolean {
    if (svgString.length < 100) return false;
    const drawableElements = ['<path', '<rect', '<circle', '<ellipse', '<polygon', '<polyline', '<line', '<text', '<image', '<g>', '<g '];
    return drawableElements.some(el => svgString.includes(el));
}

function svgToDataUrl(svg: SVGSVGElement): string {
    try {
        const clone = svg.cloneNode(true) as SVGSVGElement;
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        resolveSvgUseElements(clone);
        const svgString = new XMLSerializer().serializeToString(clone);
        if (!isValidSvgContent(svgString)) return '';
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
    } catch { return ''; }
}

/** Convert a single SelectableUnit to CaptureTarget */
export function unitToCaptureTarget(unit: SelectableUnit): CaptureTarget {
    const element = unit.element;
    const rect = element.getBoundingClientRect();
    const padding = 12;

    const target: CaptureTarget = {
        type: unit.captureType,
        rect: new DOMRect(rect.x - padding, rect.y - padding, rect.width + padding * 2, rect.height + padding * 2),
        elementRef: element,
        pageContext: { pageUrl: window.location.href, pageTitle: document.title, capturedAt: Date.now() },
    };

    if (unit.captureType === 'LINK') {
        const linkUrl = (element as HTMLAnchorElement).href;
        target.url = linkUrl;
        target.title = element.textContent?.trim() || undefined;
        if (isFileUrl(linkUrl)) { target.secondaryType = 'FILE'; target.secondaryUrl = linkUrl; }
    } else if (unit.captureType === 'IMAGE') {
        if (element.tagName.toLowerCase() === 'svg') {
            const svgData = svgToDataUrl(element as SVGSVGElement);
            const bbox = (element as SVGSVGElement).getBBox();
            target.extracted = { image: { src: svgData, currentSrc: svgData, width: bbox.width || 0, height: bbox.height || 0 } };
            target.title = (element as SVGSVGElement).getAttribute('aria-label') || 'SVG Image';
        } else {
            const imgEl = element as HTMLImageElement;
            const src = imgEl.src || getBackgroundImageUrl(element);
            target.url = src || undefined;
            target.extracted = {
                image: {
                    src: src || '', currentSrc: imgEl.currentSrc || src || '',
                    width: imgEl.naturalWidth || (element as HTMLElement).offsetWidth,
                    height: imgEl.naturalHeight || (element as HTMLElement).offsetHeight,
                },
            };
            target.title = imgEl.alt || (element as HTMLElement).title || undefined;
        }
        const parentLink = element.closest('a[href]');
        if (parentLink) {
            const href = parentLink.getAttribute('href');
            if (href && isFileUrl(href)) {
                target.secondaryType = 'FILE';
                target.secondaryUrl = (parentLink as HTMLAnchorElement).href;
            }
        }
    } else if (unit.captureType === 'VIDEO') {
        const vidEl = element as HTMLVideoElement;
        let finalSrc = vidEl.currentSrc || vidEl.src;
        if (!finalSrc) {
            const source = vidEl.querySelector('source');
            if (source && source.src) finalSrc = source.src;
        }
        target.url = finalSrc;
        target.extracted = { video: { src: finalSrc, currentSrc: vidEl.currentSrc, duration: vidEl.duration, poster: vidEl.poster } };
        target.title = vidEl.getAttribute('aria-label') || vidEl.title || 'Video';
    } else {
        target.extracted = {
            text: element.textContent?.trim() || undefined,
            links: extractLinksFromElement(element),
            images: extractImagesFromElement(element),
            videos: extractVideosFromElement(element),
            files: extractFilesFromElement(element),
        };
        target.title = extractTitle(element);
    }

    return target;
}

/** Create merged CaptureTarget from multiple SelectableUnits */
export function createMergedTarget(units: SelectableUnit[]): CaptureTarget {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const allText: string[] = [];

    for (const unit of units) {
        const rect = unit.element.getBoundingClientRect();
        minX = Math.min(minX, rect.left);
        minY = Math.min(minY, rect.top);
        maxX = Math.max(maxX, rect.right);
        maxY = Math.max(maxY, rect.bottom);
        const text = unit.element.textContent?.trim();
        if (text) allText.push(text);
    }

    const padding = 12;
    minX -= padding; minY -= padding; maxX += padding; maxY += padding;

    const selectedTargets = units.map(u => unitToCaptureTarget(u));

    const allLinks = new Map<string, { url: string; label: string }>();
    const allImages = new Set<string>();
    const allVideos = new Set<string>();
    const allFiles: Array<{ url: string; label: string }> = [];

    selectedTargets.forEach(target => {
        if (target.extracted) {
            target.extracted.links?.forEach(l => { if (!allLinks.has(l.url)) allLinks.set(l.url, l); });
            target.extracted.images?.forEach(i => allImages.add(i));
            target.extracted.videos?.forEach(v => allVideos.add(v));
            target.extracted.files?.forEach(f => { if (!allFiles.some(e => e.url === f.url)) allFiles.push(f); });
            if (target.type === 'LINK' && target.url && !allLinks.has(target.url)) {
                allLinks.set(target.url, { url: target.url, label: target.title || target.url });
            }
            if (target.type === 'IMAGE' && target.extracted.image?.src) allImages.add(target.extracted.image.src);
            if (target.secondaryType === 'FILE' && target.secondaryUrl) {
                allFiles.push({ url: target.secondaryUrl, label: target.title || 'File' });
            }
        }
    });

    return {
        type: 'GENERIC_BLOCK',
        title: `${units.length} items selected`,
        rect: new DOMRect(minX, minY, maxX - minX, maxY - minY),
        extracted: {
            text: allText.join('\n\n'),
            links: Array.from(allLinks.values()),
            images: Array.from(allImages),
            videos: Array.from(allVideos),
            files: allFiles
        },
        pageContext: { pageUrl: window.location.href, pageTitle: document.title, capturedAt: Date.now() },
        selectedTargets,
    };
}
