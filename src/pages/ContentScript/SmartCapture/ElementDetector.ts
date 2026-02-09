// Element Detector - Improved targeting algorithm with granular selection
// Supports parent/child cycling and smaller-is-better scoring

import {
    CaptureTarget,
    CaptureTargetType,
    FILE_EXTENSIONS,
    TEXT_BLOCK_TAGS,
    NAV_PENALTY_TAGS
} from './types';

/** Minimum element size in pixels - reduced for more granular selection */
const MIN_ELEMENT_SIZE = 16;

/** Maximum element size ratio relative to viewport */
const MAX_SIZE_RATIO = 0.85;

/** Maximum levels to traverse up the DOM tree */
const MAX_TRAVERSE_LEVELS = 10;

/** Class prefix to identify our UI elements */
const UI_CLASS_PREFIX = 'lw-';

/** Interactive/semantic element tags that get bonus scoring */
const INTERACTIVE_TAGS = ['img', 'video', 'canvas', 'svg', 'a', 'button', 'input', 'textarea', 'article', 'section', 'figure'];

/** Layout wrapper tags that get penalty */
const LAYOUT_WRAPPER_TAGS = ['div', 'span'];

/**
 * Candidate element with scoring metadata
 */
interface ScoredCandidate {
    element: Element;
    type: CaptureTargetType;
    score: number;
    depth: number; // 0 = deepest (under cursor), higher = closer to body
}

/**
 * Element Detector - Detects and scores page elements for Smart Capture
 * Features:
 * - Improved scoring algorithm preferring smaller, meaningful elements
 * - Candidate chain for parent/child cycling
 * - Position caching to avoid recalculating when mouse stays in same area
 */
export class ElementDetector {
    private lastTarget: CaptureTarget | null = null;

    // Candidate chain for cycling
    private candidateChain: ScoredCandidate[] = [];
    private currentCandidateIndex = 0;

    // Position cache to avoid recalculating
    private lastPositionRect: DOMRect | null = null;

    /**
     * Detect the best target element at the given coordinates
     */
    public detect(x: number, y: number): CaptureTarget {
        // Check if mouse is still within last element's rect (use cache)
        if (this.isWithinLastRect(x, y) && this.candidateChain.length > 0) {
            // Return current candidate without recalculating
            return this.getCandidateTarget(this.currentCandidateIndex);
        }

        const element = document.elementFromPoint(x, y);

        if (!element) {
            this.clearCache();
            return this.createNoneTarget();
        }

        if (this.isOurUI(element)) {
            return this.createNoneTarget();
        }

        // Build candidate chain from deepest to shallowest
        this.buildCandidateChain(element);

        // Reset cycle index to best candidate
        this.currentCandidateIndex = this.findBestCandidateIndex();

        // Update position cache
        this.updatePositionCache(x, y);

        return this.getCandidateTarget(this.currentCandidateIndex);
    }

    /**
     * Cycle to parent element in the chain
     * @returns The new target, or null if at top
     */
    public cycleParent(): CaptureTarget | null {
        if (this.candidateChain.length === 0) return null;

        if (this.currentCandidateIndex < this.candidateChain.length - 1) {
            this.currentCandidateIndex++;
            const target = this.getCandidateTarget(this.currentCandidateIndex);
            this.lastTarget = target;
            return target;
        }
        return this.lastTarget;
    }

    /**
     * Cycle to child element in the chain
     * @returns The new target, or null if at bottom
     */
    public cycleChild(): CaptureTarget | null {
        if (this.candidateChain.length === 0) return null;

        if (this.currentCandidateIndex > 0) {
            this.currentCandidateIndex--;
            const target = this.getCandidateTarget(this.currentCandidateIndex);
            this.lastTarget = target;
            return target;
        }
        return this.lastTarget;
    }

    /**
     * Get the deepest (smallest) candidate
     */
    public getDeepestTarget(): CaptureTarget | null {
        if (this.candidateChain.length === 0) return null;
        this.currentCandidateIndex = 0;
        const target = this.getCandidateTarget(0);
        this.lastTarget = target;
        return target;
    }

    /**
     * Get the current candidate index label for UI feedback
     * e.g., "DIV.card > IMG" or "2/5"
     */
    public getCycleLabel(): string {
        if (this.candidateChain.length === 0) return '';

        const current = this.candidateChain[this.currentCandidateIndex];
        const total = this.candidateChain.length;

        // Show element path
        const tagName = current.element.tagName.toLowerCase();
        const className = current.element.className && typeof current.element.className === 'string'
            ? current.element.className.split(' ').filter(c => c && !c.startsWith(UI_CLASS_PREFIX))[0]
            : '';

        const elementLabel = className ? `${tagName}.${className}` : tagName;
        return `${elementLabel} (${this.currentCandidateIndex + 1}/${total})`;
    }

    /**
     * Get the last detected target
     */
    public getLastTarget(): CaptureTarget | null {
        return this.lastTarget;
    }

    /**
     * Get the candidate chain length
     */
    public getCandidateCount(): number {
        return this.candidateChain.length;
    }

    /**
     * Clear the detection cache
     */
    public clearCache(): void {
        this.candidateChain = [];
        this.currentCandidateIndex = 0;
        this.lastPositionRect = null;
        this.lastTarget = null;
    }

    /**
     * Check if coordinates are within last detected element's rect
     */
    private isWithinLastRect(x: number, y: number): boolean {
        if (!this.lastPositionRect) return false;

        return x >= this.lastPositionRect.left &&
            x <= this.lastPositionRect.right &&
            y >= this.lastPositionRect.top &&
            y <= this.lastPositionRect.bottom;
    }

    /**
     * Update position cache
     */
    private updatePositionCache(_x: number, _y: number): void {
        if (this.candidateChain.length > 0) {
            const current = this.candidateChain[this.currentCandidateIndex];
            this.lastPositionRect = current.element.getBoundingClientRect();
        }
    }

    /**
     * Build candidate chain from element up to body
     */
    private buildCandidateChain(startElement: Element): void {
        this.candidateChain = [];

        let current: Element | null = startElement;
        let depth = 0;

        while (current && current !== document.body && current !== document.documentElement && depth < MAX_TRAVERSE_LEVELS) {
            const candidateType = this.getElementType(current);
            const score = this.scoreElement(current, candidateType);

            // Only include elements with valid type and positive score
            if (candidateType !== 'NONE' && score >= 0) {
                this.candidateChain.push({
                    element: current,
                    type: candidateType,
                    score,
                    depth
                });
            }

            current = current.parentElement;
            depth++;
        }
    }

    /**
     * Find the index of the best candidate based on scoring
     */
    private findBestCandidateIndex(): number {
        if (this.candidateChain.length === 0) return 0;

        let bestIndex = 0;
        let bestScore = this.candidateChain[0].score;

        for (let i = 1; i < this.candidateChain.length; i++) {
            if (this.candidateChain[i].score > bestScore) {
                bestScore = this.candidateChain[i].score;
                bestIndex = i;
            }
        }

        return bestIndex;
    }

    /**
     * Get CaptureTarget for a candidate index
     */
    private getCandidateTarget(index: number): CaptureTarget {
        if (index < 0 || index >= this.candidateChain.length) {
            return this.createNoneTarget();
        }

        const candidate = this.candidateChain[index];
        const target = this.createTarget(candidate.element, candidate.type);
        this.lastTarget = target;
        return target;
    }

    /**
     * Check if element is part of our UI (overlay or action bar)
     */
    private isOurUI(element: Element): boolean {
        let current: Element | null = element;
        while (current) {
            if (current.id === 'lw-capture-overlay' || current.id === 'lw-capture-actionbar') {
                return true;
            }
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
     * Determine the type of an element
     */
    private getElementType(element: Element): CaptureTargetType {
        const tagName = element.tagName.toLowerCase();

        // Check for IMAGE first (most specific for granular selection)
        if (tagName === 'img' || tagName === 'picture' || tagName === 'svg' || tagName === 'canvas') {
            return 'IMAGE';
        }

        // Check for background image (priority over generic block)
        const bgImage = this.getBackgroundImage(element);
        if (bgImage) {
            return 'IMAGE';
        }

        // Check for ICON elements (treat as IMAGE for capture purposes)
        if (this.isPseudoImageElement(element)) {
            return 'IMAGE';
        }

        // Check for VIDEO poster (treat as image)
        if (tagName === 'video' && (element as HTMLVideoElement).poster) {
            return 'IMAGE';
        }

        // Check for LINK
        if (tagName === 'a' || element.getAttribute('role') === 'link') {
            const href = element.getAttribute('href');
            if (href) {
                if (this.isFileUrl(href) || element.hasAttribute('download')) {
                    return 'FILE';
                }
                return 'LINK';
            }
        }

        // Check for TEXT_BLOCK
        if (TEXT_BLOCK_TAGS.includes(tagName)) {
            return 'TEXT_BLOCK';
        }

        // Check for GENERIC_BLOCK
        if (this.isBlockElement(element) && this.hasSignificantContent(element)) {
            return 'GENERIC_BLOCK';
        }

        return 'NONE';
    }

    /**
     * Check if URL points to a downloadable file
     */
    private isFileUrl(url: string): boolean {
        try {
            const urlObj = new URL(url, window.location.href);
            const extension = urlObj.pathname.split('.').pop()?.toLowerCase();
            return extension ? FILE_EXTENSIONS.includes(extension) : false;
        } catch {
            return false;
        }
    }

    /**
     * Get background image URL if present
     */
    private getBackgroundImage(element: Element): string | null {
        try {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;

            if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
                // Method 1: Robust Regex
                const match = bgImage.match(/url\s*\(\s*(?:(['"])(.*?)\1|([^)]+))\s*\)/);
                if (match) {
                    const url = match[2] || match[3];
                    if (url) return url.trim();
                }

                // Method 2: Simple Strip Fallback (in case regex failed on complex nested chars)
                // This handles the simple "one background" case well
                if (!bgImage.includes(',')) {
                    // Remove 'url(' and last ')'
                    let url = bgImage.slice(bgImage.indexOf('url(') + 4).trim();
                    if (url.endsWith(')')) url = url.slice(0, -1).trim();
                    // Remove surrounding quotes if present
                    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
                        url = url.slice(1, -1);
                    }
                    return url;
                }
            }
        } catch (e) {

        }
        return null;
    }

    /**
     * Check if element is a block element
     */
    private isBlockElement(element: Element): boolean {
        const blockTags = ['div', 'section', 'article', 'aside', 'main', 'figure', 'li', 'ul', 'ol', 'span']; // Added span
        return blockTags.includes(element.tagName.toLowerCase());
    }

    /**
     * Check if element has significant content
     */
    private hasSignificantContent(element: Element): boolean {
        const text = element.textContent?.trim() || '';
        if (text.length > 10) return true;

        // Check for direct media children
        for (const child of element.children) {
            const tagName = child.tagName.toLowerCase();
            if (['img', 'video', 'canvas', 'svg', 'picture'].includes(tagName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Score an element based on improved heuristics
     * LOWER depth + SMALLER size + MEANINGFUL content = HIGHER score
     */
    private scoreElement(element: Element, type: CaptureTargetType): number {
        let score = 100; // Base score

        // Boost score for specific visual elements (icons, bg-images)
        if (type === 'IMAGE') {
            const isIcon = this.isPseudoImageElement(element);
            const hasBgInfo = this.getBackgroundImage(element);

            if (isIcon) score += 50; // Bonus for icons
            if (hasBgInfo) score += 40; // Bonus for background images
        }

        const rect = element.getBoundingClientRect();
        const viewportArea = window.innerWidth * window.innerHeight;
        const elementArea = rect.width * rect.height;
        const sizeRatio = elementArea / viewportArea;

        // Size checks - reject too small or too large
        if (rect.width < MIN_ELEMENT_SIZE || rect.height < MIN_ELEMENT_SIZE) {
            return -1;
        }

        if (sizeRatio > MAX_SIZE_RATIO) {
            return -1; // Too large (probably wrapper)
        }

        // ** SMALLER IS BETTER ** - Key improvement
        // Elements covering less area get higher scores
        // Invert size ratio: smaller elements = higher bonus
        const smallnessBonus = (1 - sizeRatio) * 150;
        score += smallnessBonus;

        // ** TYPE BONUSES **
        if (type === 'IMAGE') {
            score += 80; // Images are high-value targets
        } else if (type === 'LINK') {
            score += 60;
        } else if (type === 'FILE') {
            score += 70;
        }

        // ** SEMANTIC TAG BONUSES **
        const tagName = element.tagName.toLowerCase();
        if (INTERACTIVE_TAGS.includes(tagName)) {
            score += 50;
        }

        // ** LAYOUT WRAPPER PENALTY **
        if (LAYOUT_WRAPPER_TAGS.includes(tagName)) {
            // SKIP penalty if it's an identified IMAGE (bg-image or icon)
            if (type !== 'IMAGE') {
                const style = window.getComputedStyle(element);
                const display = style.display;
                // Penalize flex/grid containers
                if (display === 'flex' || display === 'grid') {
                    score -= 40;
                }
                // Penalize divs with no direct text/media
                if (!this.hasDirectMeaningfulContent(element)) {
                    score -= 30;
                }
            }
        }

        // ** TEXT CONTENT BONUS **
        if (type === 'TEXT_BLOCK' || type === 'GENERIC_BLOCK') {
            const text = element.textContent?.trim() || '';
            score += Math.min(text.length / 5, 80);

            // Semantic tag bonus
            if (['article', 'blockquote', 'pre', 'code'].includes(tagName)) {
                score += 40;
            }
            if (['h1', 'h2', 'h3'].includes(tagName)) {
                score += 30;
            }
        }

        // ** NAVIGATION PENALTY **
        if (this.isInNavigation(element)) {
            score -= 100;
        }

        // ** VISIBILITY CHECKS **
        const style = window.getComputedStyle(element);
        if (style.opacity === '0' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
            return -1;
        }

        // ** FIXED/STICKY PENALTY ** (overlays)
        if (style.position === 'fixed' || style.position === 'sticky') {
            score -= 50;
        }

        return Math.max(0, score);
    }

    /**
     * Check if element has direct meaningful content (not just nested)
     */
    private hasDirectMeaningfulContent(element: Element): boolean {
        // Check for direct text nodes
        for (const child of element.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent?.trim() || '';
                if (text.length > 10) return true;
            }
        }

        // Check for direct media children
        for (const child of element.children) {
            const tagName = child.tagName.toLowerCase();
            if (['img', 'video', 'canvas', 'svg', 'picture'].includes(tagName)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if element is likely an icon or image container based on class names
     */
    private isPseudoImageElement(element: Element): boolean {
        const tagName = element.tagName.toLowerCase();

        // Only check likely candidates
        if (!['i', 'span', 'div', 'svg'].includes(tagName)) return false;

        // Check class names
        const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';

        const iconPatterns = ['icon', 'fa-', 'fas', 'far', 'fab', 'mdi-', 'glyph', 'symbol', 'ico-'];
        const imagePatterns = ['img', 'image', 'thumbnail', 'cover', 'hero', 'bg-img', 'poster'];

        const hasIconClass = iconPatterns.some(pattern => className.includes(pattern));
        const hasImageClass = imagePatterns.some(pattern => className.includes(pattern));

        if (hasImageClass) {
            // Strong signal for image container - accept it regardless of size
            // (e.g. hero banner, post thumbnail div)
            return true;
        }

        if (hasIconClass) {
            const rect = element.getBoundingClientRect();
            // Icons typically rarely exceed 100x100
            if (rect.width > 0 && rect.width < 100 && rect.height > 0 && rect.height < 100) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if element is inside navigation/header/footer
     */
    private isInNavigation(element: Element): boolean {
        let current: Element | null = element;
        while (current) {
            const tagName = current.tagName.toLowerCase();
            const role = current.getAttribute('role');

            if (NAV_PENALTY_TAGS.includes(tagName) ||
                role === 'navigation' ||
                role === 'banner' ||
                role === 'contentinfo') {
                return true;
            }
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Create a CaptureTarget from an element
     */
    private createTarget(element: Element, type: CaptureTargetType): CaptureTarget {
        const rect = element.getBoundingClientRect();
        const pageContext = this.getPageContext();

        const target: CaptureTarget = {
            type,
            rect: DOMRect.fromRect(rect),
            elementRef: element,
            pageContext,
        };

        // Extract type-specific information
        switch (type) {
            case 'LINK':
            case 'FILE':
                target.url = (element as HTMLAnchorElement).href;
                target.title = element.textContent?.trim() || undefined;
                break;

            case 'IMAGE':
                target.extracted = {
                    image: this.extractImageInfo(element),
                };
                target.title = (element as HTMLImageElement).alt ||
                    element.getAttribute('aria-label') ||
                    undefined;

                // Check if IMAGE is inside a file link - create composite target
                const parentLink = element.closest('a[href]');
                if (parentLink) {
                    const href = parentLink.getAttribute('href');

                    if (href && (this.isFileUrl(href) || parentLink.hasAttribute('download'))) {
                        target.secondaryType = 'FILE';
                        target.secondaryUrl = (parentLink as HTMLAnchorElement).href;

                    }
                }
                break;

            case 'TEXT_BLOCK':
            case 'GENERIC_BLOCK':
                const links = this.extractLinksFromElement(element);
                const images = this.extractImagesFromElement(element);
                const videos = this.extractVideosFromElement(element);
                const files = this.extractFilesFromElement(element);



                target.extracted = {
                    text: element.textContent?.trim() || undefined,
                    html: this.sanitizeHtml(element.innerHTML),
                    links,
                    images,
                    videos,
                    files,
                };
                target.title = this.extractBlockTitle(element);
                break;
        }

        // Also extract all content for LINK type
        if (type === 'LINK') {
            const links = this.extractLinksFromElement(element);
            const images = this.extractImagesFromElement(element);
            if (links.length > 0 || images.length > 0) {
                target.extracted = {
                    ...target.extracted,
                    links: links.length > 0 ? links : undefined,
                    images: images.length > 0 ? images : undefined,
                };
            }
        }

        // Generate selectors
        target.selectors = {
            cssPath: this.getCssPath(element),
            xpath: this.getXPath(element),
        };

        return target;
    }

    /**
     * Extract image information
     */
    private extractImageInfo(element: Element): { src: string; currentSrc?: string; width?: number; height?: number } {
        if (element.tagName.toLowerCase() === 'img') {
            const img = element as HTMLImageElement;
            return {
                src: img.src,
                currentSrc: img.currentSrc || img.src,
                width: img.naturalWidth,
                height: img.naturalHeight,
            };
        }

        const bgImage = this.getBackgroundImage(element);
        if (bgImage) {
            return { src: bgImage };
        }

        if (element.tagName.toLowerCase() === 'video') {
            return { src: (element as HTMLVideoElement).poster };
        }

        return { src: '' };
    }

    /**
     * Extract a title from a block element
     */
    private extractBlockTitle(element: Element): string | undefined {
        const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
            return heading.textContent?.trim();
        }

        const text = element.textContent?.trim() || '';
        const firstLine = text.split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 100) {
            return firstLine;
        }

        return undefined;
    }

    /**
     * Extract all links from an element
     */
    private extractLinksFromElement(element: Element): Array<{ url: string; label: string }> {
        const linksMap = new Map<string, { url: string; label: string }>();

        // Get all <a> tags within the element
        let anchors = Array.from(element.querySelectorAll('a[href]'));



        // Log HTML snapshot to verify if links actually exist in the element we are holding
        const htmlSnapshot = element.innerHTML.substring(0, 500);

        // Fallback: try getElementsByTagName if querySelectorAll yields nothing
        if (anchors.length === 0) {
            const allAnchors = element.getElementsByTagName('a');
            if (allAnchors.length > 0) {

                anchors = Array.from(allAnchors).filter(a => a.hasAttribute('href'));
            }
        }

        // CRITICAL FALLBACK: If we still have 0 anchors but HTML has <a, try manual traversal
        if (anchors.length === 0 && htmlSnapshot.includes('<a')) {

            const allElements = element.getElementsByTagName('*');
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i].tagName.toLowerCase() === 'a' && allElements[i].hasAttribute('href')) {
                    anchors.push(allElements[i] as HTMLAnchorElement);
                }
            }
            if (anchors.length > 0) { }
        }

        anchors.forEach((a) => {
            const anchor = a as HTMLAnchorElement;
            const fullHref = anchor.href; // Absolute URL from DOM property (can be empty string if not connected properly)
            const rawHref = anchor.getAttribute('href'); // Raw attribute value



            let url = '';
            // Use fullHref if available and valid
            if (fullHref) {
                if (fullHref.startsWith('javascript:') || fullHref.startsWith('mailto:') || fullHref.startsWith('tel:') || fullHref.startsWith('#')) {
                    return;
                }
                url = fullHref;
            }
            // Fallback to rawHref if fullHref is missing or weird, but rawHref looks like a path
            else if (rawHref && !rawHref.startsWith('javascript:') && !rawHref.startsWith('#')) {
                // Try to resolve it relative to document base if needed, or just add it
                try {
                    url = new URL(rawHref, document.baseURI).href;
                } catch (e) {
                    url = rawHref;
                }
            }

            if (url && !linksMap.has(url)) {
                // Get anchor text - fallback to last part of URL
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

        // Check parent link if element is inside one
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
     * Video file extensions
     */
    private readonly videoExtensions = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg'];

    /**
     * Extract all images from an element
     */
    private extractImagesFromElement(element: Element): string[] {
        const images: Set<string> = new Set();

        // Get all <img> tags
        element.querySelectorAll('img[src]').forEach((img) => {
            const src = (img as HTMLImageElement).src || (img as HTMLImageElement).currentSrc;
            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                // Skip if it's a video by extension
                const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
                if (!this.videoExtensions.includes(ext)) {
                    images.add(src);
                }
            }
        });

        // Check background images
        element.querySelectorAll('*').forEach((el) => {
            const bgImage = this.getBackgroundImage(el);
            if (bgImage && (bgImage.startsWith('http://') || bgImage.startsWith('https://'))) {
                images.add(bgImage);
            }
        });

        // Check if element itself is an image
        if (element.tagName.toLowerCase() === 'img') {
            const src = (element as HTMLImageElement).src || (element as HTMLImageElement).currentSrc;
            if (src) images.add(src);
        }

        return Array.from(images);
    }

    /**
     * Extract all videos from an element
     */
    private extractVideosFromElement(element: Element): string[] {
        const videos: Set<string> = new Set();

        // Get all <video> tags
        element.querySelectorAll('video[src], video source[src]').forEach((video) => {
            const src = (video as HTMLVideoElement | HTMLSourceElement).src;
            if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
                videos.add(src);
            }
        });

        // Check images that are actually videos (by extension)
        element.querySelectorAll('img[src]').forEach((img) => {
            const src = (img as HTMLImageElement).src;
            if (src) {
                const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
                if (this.videoExtensions.includes(ext)) {
                    videos.add(src);
                }
            }
        });

        return Array.from(videos);
    }

    /**
     * Extract all downloadable files from an element
     */
    private extractFilesFromElement(element: Element): Array<{ url: string; label: string }> {
        const files: Map<string, string> = new Map();

        // Get all links with file extensions
        element.querySelectorAll('a[href]').forEach((a) => {
            const href = (a as HTMLAnchorElement).href;
            if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
                const ext = href.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
                if (FILE_EXTENSIONS.includes(ext) && !this.videoExtensions.includes(ext)) {
                    const label = (a as HTMLAnchorElement).textContent?.trim() || href.split('/').pop() || 'File';
                    files.set(href, label);
                }
            }
        });

        // Check download attributes
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
     * Sanitize HTML
     */
    private sanitizeHtml(html: string): string {
        let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        sanitized = sanitized.replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
        if (sanitized.length > 5000) {
            sanitized = sanitized.substring(0, 5000) + '...';
        }
        return sanitized;
    }

    /**
     * Generate CSS path selector
     */
    private getCssPath(element: Element): string {
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
                    .slice(0, 2)
                    .join('.');
                if (classes) {
                    selector += `.${classes}`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(' > ');
    }

    /**
     * Generate XPath selector
     */
    private getXPath(element: Element): string {
        const parts: string[] = [];
        let current: Element | null = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousElementSibling;

            while (sibling) {
                if (sibling.tagName === current.tagName) {
                    index++;
                }
                sibling = sibling.previousElementSibling;
            }

            const tagName = current.tagName.toLowerCase();
            parts.unshift(`${tagName}[${index}]`);
            current = current.parentElement;
        }

        return '/' + parts.join('/');
    }

    /**
     * Get page context information
     */
    private getPageContext(): CaptureTarget['pageContext'] {
        const faviconLink = document.querySelector('link[rel*="icon"]') as HTMLLinkElement | null;

        return {
            pageUrl: window.location.href,
            pageTitle: document.title,
            faviconUrl: faviconLink?.href,
            capturedAt: Date.now(),
        };
    }

    /**
     * Create a NONE target
     */
    private createNoneTarget(): CaptureTarget {
        return {
            type: 'NONE',
            rect: new DOMRect(),
            pageContext: this.getPageContext(),
        };
    }
}
