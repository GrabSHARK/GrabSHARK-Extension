// SelectionManager - Manages selection state for Smart Capture
// Handles toggle, multi-select, and persistent selection highlighting

import { SelectableUnit } from './SelectableUnits';
import { CaptureTarget } from './types';

/**
 * Selection state including all selected units
 */
export interface SelectionState {
    selectedUnits: SelectableUnit[];
    hoveredUnit: SelectableUnit | null;
}

/**
 * SelectionManager - Handles selection state and highlighting
 */
export class SelectionManager {
    private selectedUnits: Map<Element, SelectableUnit> = new Map();
    private hoveredUnit: SelectableUnit | null = null;
    private selectionOverlays: Map<Element, HTMLDivElement> = new Map();
    private hoverOverlay: HTMLDivElement | null = null;
    private labelElement: HTMLDivElement | null = null;
    private containerElement: Element;

    constructor(containerElement?: Element) {
        this.containerElement = containerElement || document.body;
        this.createHoverOverlay();
        this.createLabelElement();
    }

    /**
     * Create hover overlay element
     */
    private createHoverOverlay(): void {
        this.hoverOverlay = document.createElement('div');
        this.hoverOverlay.className = 'ext-lw-selection-hover ext-lw-selection-hover-hidden';
        this.hoverOverlay.id = 'lw-selection-hover';
        this.containerElement.appendChild(this.hoverOverlay);
    }

    /**
     * Create label element for showing unit type
     */
    private createLabelElement(): void {
        this.labelElement = document.createElement('div');
        this.labelElement.className = 'ext-lw-selection-label ext-lw-selection-label-hidden';
        this.labelElement.id = 'lw-selection-label';
        this.containerElement.appendChild(this.labelElement);
    }

    /**
     * Set hovered unit
     */
    public setHovered(unit: SelectableUnit | null): void {
        this.hoveredUnit = unit;
        this.updateHoverOverlay();
    }

    /**
     * Toggle selection for a unit
     * @returns true if unit was added, false if removed
     */
    public toggleSelection(unit: SelectableUnit): boolean {
        if (this.selectedUnits.has(unit.element)) {
            this.removeFromSelection(unit);
            return false;
        } else {
            this.addToSelection(unit);
            return true;
        }
    }

    /**
     * Add unit to selection
     */
    public addToSelection(unit: SelectableUnit): void {
        if (this.selectedUnits.has(unit.element)) return;

        this.selectedUnits.set(unit.element, unit);
        this.createSelectionOverlay(unit);

    }

    /**
     * Remove unit from selection
     */
    public removeFromSelection(unit: SelectableUnit): void {
        if (!this.selectedUnits.has(unit.element)) return;

        this.selectedUnits.delete(unit.element);
        this.removeSelectionOverlay(unit);

    }

    /**
     * Set selection to multiple units (replace current selection)
     */
    public setSelection(units: SelectableUnit[]): void {
        this.clearSelection();
        for (const unit of units) {
            this.addToSelection(unit);
        }
    }

    /**
     * Add multiple units to selection
     */
    public addMultipleToSelection(units: SelectableUnit[]): void {
        for (const unit of units) {
            this.addToSelection(unit);
        }
    }

    /**
     * Remove multiple units from selection
     */
    public removeMultipleFromSelection(units: SelectableUnit[]): void {
        for (const unit of units) {
            this.removeFromSelection(unit);
        }
    }

    /**
     * Clear all selections
     */
    public clearSelection(): void {
        for (const [_, overlay] of this.selectionOverlays) {
            overlay.remove();
        }
        this.selectionOverlays.clear();
        this.selectedUnits.clear();

    }

    /**
     * Get all selected units
     */
    public getSelectedUnits(): SelectableUnit[] {
        return Array.from(this.selectedUnits.values());
    }

    /**
     * Get selection count
     */
    public getSelectionCount(): number {
        return this.selectedUnits.size;
    }

    /**
     * Check if a unit is selected
     */
    public isSelected(unit: SelectableUnit): boolean {
        return this.selectedUnits.has(unit.element);
    }

    /**
     * Get hovered unit
     */
    public getHoveredUnit(): SelectableUnit | null {
        return this.hoveredUnit;
    }

    /**
     * Create a selection overlay for a unit
     */
    private createSelectionOverlay(unit: SelectableUnit): void {
        const overlay = document.createElement('div');
        overlay.className = 'ext-lw-selection-selected';
        this.updateOverlayPosition(overlay, unit.rect);
        this.containerElement.appendChild(overlay);
        this.selectionOverlays.set(unit.element, overlay);
    }

    /**
     * Remove selection overlay for a unit
     */
    private removeSelectionOverlay(unit: SelectableUnit): void {
        const overlay = this.selectionOverlays.get(unit.element);
        if (overlay) {
            overlay.remove();
            this.selectionOverlays.delete(unit.element);
        }
    }

    /**
     * Update hover overlay position
     */
    private updateHoverOverlay(): void {
        if (!this.hoverOverlay || !this.labelElement) return;

        if (!this.hoveredUnit) {
            this.hoverOverlay.classList.add('ext-lw-selection-hover-hidden');
            this.labelElement.classList.add('ext-lw-selection-label-hidden');
            return;
        }

        // Don't show hover for already selected units (they have their own overlay)
        if (this.selectedUnits.has(this.hoveredUnit.element)) {
            this.hoverOverlay.classList.add('ext-lw-selection-hover-hidden');
            this.labelElement.classList.remove('ext-lw-selection-label-hidden');
            this.updateLabel(this.hoveredUnit);
            return;
        }

        const rect = this.hoveredUnit.element.getBoundingClientRect();
        this.updateOverlayPosition(this.hoverOverlay, rect);
        this.hoverOverlay.classList.remove('ext-lw-selection-hover-hidden');

        // Update label
        this.updateLabel(this.hoveredUnit);
    }

    /**
     * Update label with unit type
     */
    private updateLabel(unit: SelectableUnit): void {
        if (!this.labelElement) return;

        const text = this.getLabelText(unit);

        this.labelElement.textContent = text;
        this.labelElement.classList.remove('ext-lw-selection-label-hidden');

        // Position label near the element (viewport-relative for fixed positioning)
        const rect = unit.element.getBoundingClientRect();
        this.labelElement.style.left = `${rect.left}px`;
        this.labelElement.style.top = `${Math.max(0, rect.top - 20)}px`;
    }

    /**
     * Get label text for a unit
     */
    private getLabelText(unit: SelectableUnit): string {
        const tagName = unit.element.tagName.toLowerCase();
        const isSelected = this.selectedUnits.has(unit.element);
        const prefix = isSelected ? '✓ ' : '';

        // Shorten common tags
        const tagMap: Record<string, string> = {
            'button': 'BTN',
            'a': 'LINK',
            'img': 'IMG',
            'video': 'VID',
            'input': 'INPUT',
            'h1': 'H1', 'h2': 'H2', 'h3': 'H3', 'h4': 'H4',
            'p': 'P',
            'li': 'LI',
            'div': 'DIV',
            'section': 'SEC',
            'article': 'ART',
            'nav': 'NAV',
            'svg': 'SVG',
        };

        const displayTag = tagMap[tagName] || tagName.toUpperCase();
        return prefix + displayTag;
    }

    /**
     * Get the navbar/header height for the current context
     * This detects SPARK's modal header to properly clamp overlays
     */
    private getNavbarHeight(): number {
        // Method 1: Find the readable content container (has data-ext-lw-link-id)
        // Its top position is where content starts (below navbar)
        const contentContainer = document.querySelector('[data-ext-lw-link-id]');
        if (contentContainer) {
            const rect = contentContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) {

                return rect.top;
            }
        }

        // Method 2: Find any element with overflow-auto class that's a scroll container
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) {

                return rect.top;
            }
        }

        // Method 3: Look for bg-base-200 container
        const bgContainer = document.querySelector('[class*="bg-base-200"]');
        if (bgContainer) {
            const rect = bgContainer.getBoundingClientRect();
            if (rect.top > 0 && rect.top < 200) {

                return rect.top;
            }
        }

        // Default fallback

        return 52;
    }

    /**
     * Get the viewport bottom boundary for the current context
     * This detects SPARK's scroll container bottom to properly clamp overlays
     */
    private getViewportBottom(): number {
        // Find the scroll container - its bottom position is where content ends
        const scrollContainers = document.querySelectorAll('[class*="overflow-auto"]');
        for (const container of scrollContainers) {
            const rect = container.getBoundingClientRect();
            if (rect.height > 200 && rect.top > 0 && rect.top < 200) {

                return rect.bottom;
            }
        }

        // Default: use window height
        return window.innerHeight;
    }

    /**
     * Update an overlay's position (viewport-relative for fixed positioning)
     * Hides overlay when element scrolls out of visible viewport
     */
    private updateOverlayPosition(overlay: HTMLDivElement, rect: DOMRect): void {
        const padding = 8; // Expanded visual padding

        // Detect navbar/header height dynamically
        // Look for SPARK's modal header (the bar with X, cloud, pen icons)
        const navbarHeight = this.getNavbarHeight();

        // Viewport bounds (accounting for navbar AND scroll container bottom)
        const minY = navbarHeight; // Don't go above navbar
        const maxY = this.getViewportBottom(); // Don't go below scroll container
        const minX = 0;
        const maxX = window.innerWidth;

        // Check if element is within visible viewport 
        const isVisible = rect.bottom > minY && rect.top < maxY &&
            rect.right > minX && rect.left < maxX;



        if (!isVisible) {
            // Hide overlay when element is completely out of view

            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            return;
        }

        // Element is at least partially visible - show overlay
        overlay.style.opacity = '';
        overlay.style.pointerEvents = '';

        // Calculate clamped position (clamp to viewport edges)
        let top = rect.top - padding;
        let left = rect.left - padding;
        let height = rect.height + (padding * 2);
        let width = rect.width + (padding * 2);



        // Clamp top edge (don't go above viewport)
        if (top < minY) {
            const overflow = minY - top;
            top = minY;
            height = Math.max(0, height - overflow);
        }

        // Clamp bottom edge (don't go below viewport)
        if (top + height > maxY) {
            height = Math.max(0, maxY - top);
        }

        // Clamp left edge
        if (left < minX) {
            const overflow = minX - left;
            left = minX;
            width = Math.max(0, width - overflow);
        }

        // Clamp right edge
        if (left + width > maxX) {
            width = Math.max(0, maxX - left);
        }



        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    /**
     * Refresh all overlay positions (after scroll/resize)
     */
    public refreshOverlays(): void {


        // Refresh selection overlays
        for (const [element, overlay] of this.selectionOverlays) {
            const rect = element.getBoundingClientRect();

            this.updateOverlayPosition(overlay, rect);
        }

        // Refresh hover overlay
        this.updateHoverOverlay();
    }

    /**
     * Create CaptureTarget from selection
     */
    public createCaptureTarget(): CaptureTarget | null {
        const units = this.getSelectedUnits();
        if (units.length === 0) return null;

        if (units.length === 1) {
            return this.unitToCaptureTarget(units[0]);
        }

        // Multiple units - create merged target
        return this.createMergedTarget(units);
    }

    /**
     * Convert a single unit to CaptureTarget
     */
    private unitToCaptureTarget(unit: SelectableUnit): CaptureTarget {
        const element = unit.element;
        const rect = element.getBoundingClientRect();

        // Add padding to capture rect (border + padding)
        const padding = 12;
        const expandedRect = new DOMRect(
            rect.x - padding,
            rect.y - padding,
            rect.width + (padding * 2),
            rect.height + (padding * 2)
        );

        const target: CaptureTarget = {
            type: unit.captureType,
            rect: expandedRect,
            elementRef: element,
            pageContext: {
                pageUrl: window.location.href,
                pageTitle: document.title,
                capturedAt: Date.now(),
            },
        };

        // Add type-specific data
        if (unit.captureType === 'LINK') {
            const linkUrl = (element as HTMLAnchorElement).href;
            target.url = linkUrl;
            target.title = element.textContent?.trim() || undefined;

            // Check if LINK points to a file - create composite target
            if (this.isFileUrl(linkUrl)) {
                target.secondaryType = 'FILE';
                target.secondaryUrl = linkUrl;

            }
        } else if (unit.captureType === 'IMAGE') {
            // Check if it's an SVG element
            if (element.tagName.toLowerCase() === 'svg') {
                const svgDataUrl = this.svgToDataUrl(element as SVGSVGElement);
                const bbox = (element as SVGSVGElement).getBBox();
                target.extracted = {
                    image: {
                        src: svgDataUrl,
                        currentSrc: svgDataUrl,
                        width: bbox.width || 0,
                        height: bbox.height || 0,
                    },
                };
                target.title = (element as SVGSVGElement).getAttribute('aria-label') || 'SVG Image';
            } else {
                // Regular IMG element or background image
                const imgEl = element as HTMLImageElement;
                const src = imgEl.src || this.getBackgroundImageUrl(element);

                target.url = src || undefined;
                target.extracted = {
                    image: {
                        src: src || '',
                        currentSrc: imgEl.currentSrc || src || '',
                        width: imgEl.naturalWidth || (element as HTMLElement).offsetWidth,
                        height: imgEl.naturalHeight || (element as HTMLElement).offsetHeight,
                    },
                };
                target.title = imgEl.alt || (element as HTMLElement).title || undefined;
            }

            // Check if IMAGE is inside a file link - create composite target
            const parentLink = element.closest('a[href]');
            if (parentLink) {
                const href = parentLink.getAttribute('href');

                if (href && this.isFileUrl(href)) {
                    target.secondaryType = 'FILE';
                    target.secondaryUrl = (parentLink as HTMLAnchorElement).href;

                }
            }
        } else if (unit.captureType === 'VIDEO') {
            const vidEl = element as HTMLVideoElement;
            const src = vidEl.currentSrc || vidEl.src;


            // Check for source elements if src is empty
            let finalSrc = src;
            if (!finalSrc) {
                const source = vidEl.querySelector('source');
                if (source && source.src) {
                    finalSrc = source.src;

                }
            }

            target.url = finalSrc;
            target.extracted = {
                video: {
                    src: finalSrc,
                    currentSrc: vidEl.currentSrc,
                    duration: vidEl.duration,
                    poster: vidEl.poster
                }
            };
            target.title = vidEl.getAttribute('aria-label') || vidEl.title || 'Video';
        } else {
            target.extracted = {
                text: element.textContent?.trim() || undefined,
                links: this.extractLinksFromElement(element),
                images: this.extractImagesFromElement(element),
                videos: this.extractVideosFromElement(element),
                files: this.extractFilesFromElement(element),
            };
            target.title = this.extractTitle(element);
        }

        return target;
    }

    /**
     * Get background image URL from element
     */
    private getBackgroundImageUrl(element: Element): string | null {
        try {
            const style = window.getComputedStyle(element);
            const bgImage = style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
                return match ? match[1] : null;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Check if URL points to a downloadable file
     */
    private isFileUrl(url: string): boolean {
        const FILE_EXTENSIONS = [
            // Documents
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub',
            // Archives
            'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
            // Audio
            'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus',
            // Video
            'mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg',
            // Text/Data
            'txt', 'csv', 'json', 'xml', 'md', 'yaml', 'yml'
        ];
        try {
            const urlObj = new URL(url, window.location.href);
            const cleanPath = urlObj.pathname.split('?')[0].split('#')[0];
            const extension = cleanPath.split('.').pop()?.toLowerCase();
            return extension ? FILE_EXTENSIONS.includes(extension) : false;
        } catch {
            return false;
        }
    }

    /**
     * Create merged target from multiple units
     */
    private createMergedTarget(units: SelectableUnit[]): CaptureTarget {
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

        // Add padding to merged rect
        const padding = 12;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Convert units to CaptureTargets for selectedTargets
        const selectedTargets = units.map(u => this.unitToCaptureTarget(u));

        // Aggregate content from all targets
        const allLinks = new Map<string, { url: string; label: string }>();
        const allImages = new Set<string>();
        const allVideos = new Set<string>();
        const allFiles: Array<{ url: string; label: string }> = [];

        selectedTargets.forEach(target => {
            if (target.extracted) {
                target.extracted.links?.forEach(l => {
                    if (!allLinks.has(l.url)) {
                        allLinks.set(l.url, l);
                    }
                });
                target.extracted.images?.forEach(i => allImages.add(i));
                target.extracted.videos?.forEach(v => allVideos.add(v));
                target.extracted.files?.forEach(f => {
                    if (!allFiles.some(existing => existing.url === f.url)) {
                        allFiles.push(f);
                    }
                });

                // Also add primary URL if target is a LINK/IMAGE/FILE
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
            pageContext: {
                pageUrl: window.location.href,
                pageTitle: document.title,
                capturedAt: Date.now(),
            },
            selectedTargets,
        };
    }

    /**
     * Extract title from element
     */
    private extractTitle(element: Element): string | undefined {
        // Check for heading inside
        const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
            return heading.textContent?.trim();
        }

        // Use first line of text
        const text = element.textContent?.trim() || '';
        const firstLine = text.split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 100) {
            return firstLine;
        }

        return undefined;
    }

    /**
     * Extract all links from an element with robust fallback
     */
    private extractLinksFromElement(element: Element): Array<{ url: string; label: string }> {
        const linksMap = new Map<string, { url: string; label: string }>();

        // Strategy 1: Standard querySelectorAll
        let anchors = Array.from(element.querySelectorAll('a[href]'));

        // Strategy 2: Fallback to getElementsByTagName if querySelectorAll yields nothing
        if (anchors.length === 0) {
            const allAnchors = element.getElementsByTagName('a');
            if (allAnchors.length > 0) {

                anchors = Array.from(allAnchors).filter(a => a.hasAttribute('href'));
            }
        }

        // Strategy 3: Manual traversal if HTML evidently contains links
        // This handles cases where Shadow DOM or weird browser quirks hide elements from query selectors
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

            // Skip invalid schemes
            if (fullHref && (fullHref.startsWith('javascript:') || fullHref.startsWith('mailto:') || fullHref.startsWith('tel:') || fullHref.startsWith('#'))) {
                return;
            }

            let url = '';
            if (fullHref) {
                url = fullHref;
            } else if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:')) {
                // Try to resolve relative URLs
                try {
                    url = new URL(rawHref, document.baseURI).href;
                } catch {
                    url = rawHref;
                }
            }

            if (url && !linksMap.has(url)) {
                // Get anchor text - fallback to last part of URL
                const label = anchor.textContent?.trim() || url.split('/').pop() || url;
                linksMap.set(url, { url, label });
            }
        });


        return Array.from(linksMap.values());
    }

    /**
     * Extract all images from an element
     */
    private extractImagesFromElement(element: Element): string[] {
        const images: Set<string> = new Set();
        const imgs = element.querySelectorAll('img, picture source, svg, canvas');

        imgs.forEach((img) => {
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

    /**
     * Extract all videos from an element
     */
    private extractVideosFromElement(element: Element): string[] {
        const videos: Set<string> = new Set();
        const vids = element.querySelectorAll('video, source');

        vids.forEach((vid) => {
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

    /**
     * Extract all files from an element
     */
    private extractFilesFromElement(element: Element): Array<{ url: string; label: string }> {
        const files: Array<{ url: string; label: string }> = [];
        const links = Array.from(element.querySelectorAll('a[href]'));

        links.forEach((a) => {
            const anchor = a as HTMLAnchorElement;
            const href = anchor.href;
            if (this.isFileUrl(href)) {
                files.push({
                    url: href,
                    label: anchor.textContent?.trim() || href.split('/').pop() || 'File'
                });
            }
        });

        return files;
    }

    /**
     * Extract SVG payload with robust handling for sprites, validation, and edge cases
     * Returns null if extraction fails (caller should fall back to PNG screenshot)
     */
    private extractSvgPayload(svg: SVGSVGElement): string | null {
        try {
            // Clone the SVG to avoid modifying the original
            const clone = svg.cloneNode(true) as SVGSVGElement;

            // Ensure namespace is set
            clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

            // Handle SVG sprites: resolve <use> references
            this.resolveSvgUseElements(clone);

            // Serialize to string
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(clone);

            // Validate: Check if SVG has drawable content
            if (!this.isValidSvgContent(svgString)) {

                return null;
            }

            // Convert to base64 data URL
            const base64 = btoa(unescape(encodeURIComponent(svgString)));
            return `data:image/svg+xml;base64,${base64}`;
        } catch (error) {

            return null;
        }
    }

    /**
     * Resolve <use> elements by inlining referenced symbols/defs
     */
    private resolveSvgUseElements(svg: SVGSVGElement): void {
        const useElements = svg.querySelectorAll('use');

        for (const use of Array.from(useElements)) {
            const href = use.getAttribute('href') || use.getAttribute('xlink:href');
            if (!href || !href.startsWith('#')) continue;

            const refId = href.substring(1);

            // Look for referenced element in document (symbols, defs)
            const referencedEl = document.getElementById(refId);
            if (!referencedEl) continue;

            // Clone the referenced content
            const refClone = referencedEl.cloneNode(true) as Element;

            // If it's a symbol, extract its children into a <g>
            if (refClone.tagName.toLowerCase() === 'symbol') {
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

                // Copy viewBox as transform if available
                const viewBox = refClone.getAttribute('viewBox');
                if (viewBox) {
                    group.setAttribute('viewBox', viewBox);
                }

                // Move children to group
                while (refClone.firstChild) {
                    group.appendChild(refClone.firstChild);
                }

                // Copy transform/position from <use>
                const x = use.getAttribute('x');
                const y = use.getAttribute('y');
                if (x || y) {
                    group.setAttribute('transform', `translate(${x || 0}, ${y || 0})`);
                }

                use.replaceWith(group);
            } else {
                // For other elements (g, path, etc.), just replace
                use.replaceWith(refClone);
            }
        }
    }

    /**
     * Validate that SVG string contains drawable content
     */
    private isValidSvgContent(svgString: string): boolean {
        // Minimum byte size threshold (empty SVGs are typically < 100 bytes)
        if (svgString.length < 100) {
            return false;
        }

        // Check for drawable elements
        const drawableElements = [
            '<path',
            '<rect',
            '<circle',
            '<ellipse',
            '<polygon',
            '<polyline',
            '<line',
            '<text',
            '<image',
            '<g>',
            '<g ',
        ];

        return drawableElements.some(el => svgString.includes(el));
    }

    /**
     * Legacy wrapper for compatibility - converts to data URL or returns empty string
     */
    private svgToDataUrl(svg: SVGSVGElement): string {
        return this.extractSvgPayload(svg) || '';
    }

    /**
     * Get selection summary for action bar
     */
    public getSelectionSummary(): {
        count: number;
        hasImages: boolean;
        hasLinks: boolean;
        hasText: boolean;
        imageCount: number;
        linkCount: number;
    } {
        const units = this.getSelectedUnits();
        let imageCount = 0;
        let linkCount = 0;
        let hasText = false;

        for (const unit of units) {
            if (unit.hasMedia || unit.captureType === 'IMAGE') imageCount++;
            if (unit.hasLinks || unit.captureType === 'LINK') linkCount++;
            if (unit.hasText) hasText = true;
        }

        return {
            count: units.length,
            hasImages: imageCount > 0,
            hasLinks: linkCount > 0,
            hasText,
            imageCount,
            linkCount,
        };
    }

    /**
     * Hide hover overlay (but keep selections)
     */
    public hideHover(): void {
        if (this.hoverOverlay) {
            this.hoverOverlay.classList.add('ext-lw-selection-hover-hidden');
        }
        if (this.labelElement) {
            this.labelElement.classList.add('ext-lw-selection-label-hidden');
        }
    }

    /**
     * Destroy the selection manager
     */
    public destroy(): void {
        this.clearSelection();
        this.hoverOverlay?.remove();
        this.labelElement?.remove();
        this.hoverOverlay = null;
        this.labelElement = null;
    }
}
