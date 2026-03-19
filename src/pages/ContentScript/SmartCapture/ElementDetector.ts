/**
 * Element Detector - Detects and scores page elements for Smart Capture
 * Features: candidate chain for parent/child cycling, position caching
 * 
 * Delegates to:
 * - ElementScoring: scoring, type detection, selectors
 * - ElementContentExtractor: links, images, videos, files extraction
 */

import { CaptureTarget, CaptureTargetType } from './types';
import {
    isOurUI,
    getElementType,
    scoreElement,
    getBackgroundImage,
    isFileUrl,
    getCssPath,
    getXPath,
    getPageContext,
} from './ElementScoring';
import {
    extractLinksFromElement,
    extractImagesFromElement,
    extractVideosFromElement,
    extractFilesFromElement,
    sanitizeHtml,
    extractImageInfo,
    extractBlockTitle,
} from './ElementContentExtractor';

const MAX_TRAVERSE_LEVELS = 10;
const UI_CLASS_PREFIX = 'lw-';

interface ScoredCandidate {
    element: Element;
    type: CaptureTargetType;
    score: number;
    depth: number;
}

export class ElementDetector {
    private lastTarget: CaptureTarget | null = null;
    private candidateChain: ScoredCandidate[] = [];
    private currentCandidateIndex = 0;
    private lastPositionRect: DOMRect | null = null;

    public detect(x: number, y: number): CaptureTarget {
        if (this.isWithinLastRect(x, y) && this.candidateChain.length > 0) {
            return this.getCandidateTarget(this.currentCandidateIndex);
        }

        const element = document.elementFromPoint(x, y);
        if (!element) { this.clearCache(); return this.createNoneTarget(); }
        if (isOurUI(element)) return this.createNoneTarget();

        this.buildCandidateChain(element);
        this.currentCandidateIndex = this.findBestCandidateIndex();
        this.updatePositionCache();

        return this.getCandidateTarget(this.currentCandidateIndex);
    }

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

    public getDeepestTarget(): CaptureTarget | null {
        if (this.candidateChain.length === 0) return null;
        this.currentCandidateIndex = 0;
        const target = this.getCandidateTarget(0);
        this.lastTarget = target;
        return target;
    }

    public getCycleLabel(): string {
        if (this.candidateChain.length === 0) return '';
        const current = this.candidateChain[this.currentCandidateIndex];
        const total = this.candidateChain.length;
        const tagName = current.element.tagName.toLowerCase();
        const className = current.element.className && typeof current.element.className === 'string'
            ? current.element.className.split(' ').filter(c => c && !c.startsWith(UI_CLASS_PREFIX))[0]
            : '';
        const elementLabel = className ? `${tagName}.${className}` : tagName;
        return `${elementLabel} (${this.currentCandidateIndex + 1}/${total})`;
    }

    public getLastTarget(): CaptureTarget | null { return this.lastTarget; }
    public getCandidateCount(): number { return this.candidateChain.length; }

    public clearCache(): void {
        this.candidateChain = [];
        this.currentCandidateIndex = 0;
        this.lastPositionRect = null;
        this.lastTarget = null;
    }

    private isWithinLastRect(x: number, y: number): boolean {
        if (!this.lastPositionRect) return false;
        return x >= this.lastPositionRect.left && x <= this.lastPositionRect.right &&
            y >= this.lastPositionRect.top && y <= this.lastPositionRect.bottom;
    }

    private updatePositionCache(): void {
        if (this.candidateChain.length > 0) {
            const current = this.candidateChain[this.currentCandidateIndex];
            this.lastPositionRect = current.element.getBoundingClientRect();
        }
    }

    private buildCandidateChain(startElement: Element): void {
        this.candidateChain = [];
        let current: Element | null = startElement;
        let depth = 0;

        while (current && current !== document.body && current !== document.documentElement && depth < MAX_TRAVERSE_LEVELS) {
            const candidateType = getElementType(current);
            const score = scoreElement(current, candidateType);

            if (candidateType !== 'NONE' && score >= 0) {
                this.candidateChain.push({ element: current, type: candidateType, score, depth });
            }
            current = current.parentElement;
            depth++;
        }
    }

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

    private getCandidateTarget(index: number): CaptureTarget {
        if (index < 0 || index >= this.candidateChain.length) return this.createNoneTarget();
        const candidate = this.candidateChain[index];
        const target = this.createTarget(candidate.element, candidate.type);
        this.lastTarget = target;
        return target;
    }

    private createTarget(element: Element, type: CaptureTargetType): CaptureTarget {
        const rect = element.getBoundingClientRect();
        const pageContext = getPageContext();

        const target: CaptureTarget = {
            type, rect: DOMRect.fromRect(rect), elementRef: element, pageContext,
        };

        switch (type) {
            case 'LINK':
            case 'FILE':
                target.url = (element as HTMLAnchorElement).href;
                target.title = element.textContent?.trim() || undefined;
                break;
            case 'IMAGE':
                target.extracted = { image: extractImageInfo(element, getBackgroundImage) };
                target.title = (element as HTMLImageElement).alt || element.getAttribute('aria-label') || undefined;
                const parentLink = element.closest('a[href]');
                if (parentLink) {
                    const href = parentLink.getAttribute('href');
                    if (href && (isFileUrl(href) || parentLink.hasAttribute('download'))) {
                        target.secondaryType = 'FILE';
                        target.secondaryUrl = (parentLink as HTMLAnchorElement).href;
                    }
                }
                break;
            case 'TEXT_BLOCK':
            case 'GENERIC_BLOCK':
                target.extracted = {
                    text: element.textContent?.trim() || undefined,
                    html: sanitizeHtml(element.innerHTML),
                    links: extractLinksFromElement(element),
                    images: extractImagesFromElement(element, getBackgroundImage),
                    videos: extractVideosFromElement(element),
                    files: extractFilesFromElement(element),
                };
                target.title = extractBlockTitle(element);
                break;
        }

        if (type === 'LINK') {
            const links = extractLinksFromElement(element);
            const images = extractImagesFromElement(element, getBackgroundImage);
            if (links.length > 0 || images.length > 0) {
                target.extracted = {
                    ...target.extracted,
                    links: links.length > 0 ? links : undefined,
                    images: images.length > 0 ? images : undefined,
                };
            }
        }

        target.selectors = { cssPath: getCssPath(element), xpath: getXPath(element) };
        return target;
    }

    private createNoneTarget(): CaptureTarget {
        return { type: 'NONE', rect: new DOMRect(), pageContext: getPageContext() };
    }
}
