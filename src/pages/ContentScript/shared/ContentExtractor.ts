import { CaptureTarget } from '../SmartCapture/types';

// Video extensions to distinguish from images
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', 'mpg', 'ogv', '3gp'];

// File extensions that should be excluded from "Save Link" (belong in "Save File" or "Save Image")
const FILE_EXTENSIONS_REGEX = /\.(pdf|zip|rar|7z|tar|gz|exe|dmg|iso|bin|apk|ipa|csv|xls|xlsx|doc|docx|ppt|pptx|txt|rtf|mp3|wav|mp4|avi|mov|mkv|webm|jpg|jpeg|png|gif|svg|webp|bmp|ico|tiff|tif|jsp|json|xml|yaml|yml|css|js)$/i;

export interface ExtractedContent {
    links: Array<{ url: string; label: string }>;
    images: string[];
    videos: string[];
    files: Array<{ url: string; label: string }>;
}

export class ContentExtractor {
    /** Extract all content from a CaptureTarget */
    public static extractFromTarget(target: CaptureTarget): ExtractedContent {
        return {
            links: ContentExtractor.getLinksWithLabels(target),
            images: ContentExtractor.getImages(target),
            videos: ContentExtractor.getVideos(target),
            files: ContentExtractor.getFiles(target)
        };
    }

    public static hasLink(target: CaptureTarget): boolean {
        // Check if target itself is a link
        if (target.type === 'LINK' || target.secondaryType === 'LINK') return true;
        // Check if target has URL (but not image/file)
        if (target.url && target.type !== 'IMAGE' && target.type !== 'FILE') return true;
        // Check if element contains any links
        return ContentExtractor.getLinks(target).length > 0;
    }

    public static hasImage(target: CaptureTarget): boolean {
        return ContentExtractor.getImages(target).length > 0;
    }

    public static hasVideo(target: CaptureTarget): boolean {
        return ContentExtractor.getVideos(target).length > 0;
    }

    public static hasFile(target: CaptureTarget): boolean {
        return ContentExtractor.getFiles(target).length > 0;
    }

    public static hasTextContent(target: CaptureTarget): boolean {
        return target.type === 'TEXT_BLOCK' ||
            target.type === 'GENERIC_BLOCK' ||
            target.type === 'LINK';
    }

    public static getLinks(target: CaptureTarget): string[] {
        const links: string[] = [];

        const isFile = (url: string) => {
            try {
                const urlObj = new URL(url, window.location.href);
                return FILE_EXTENSIONS_REGEX.test(urlObj.pathname);
            } catch { return false; }
        };

        // Add main URL if it's a link type and NOT a file
        if (target.type === 'LINK' && target.url && !isFile(target.url)) {
            links.push(target.url);
        }

        // Add all extracted links from element
        if (target.extracted?.links) {
            for (const link of target.extracted.links) {
                if (!links.includes(link.url) && !isFile(link.url)) {
                    links.push(link.url);
                }
            }
        }

        return links;
    }

    public static getLinksWithLabels(target: CaptureTarget): Array<{ url: string; label: string }> {
        const linksMap = new Map<string, { url: string; label: string }>();

        // Add main URL if it's a link type
        if (target.type === 'LINK' && target.url) {
            linksMap.set(target.url, { url: target.url, label: target.title || target.url });
        }

        // Add all extracted links from element
        if (target.extracted?.links) {
            for (const link of target.extracted.links) {
                if (!linksMap.has(link.url)) {
                    linksMap.set(link.url, link);
                }
            }
        }

        return Array.from(linksMap.values());
    }

    public static getImages(target: CaptureTarget): string[] {
        const images: string[] = [];

        // Add main image or URL if present
        if (target.type === 'IMAGE') {
            const src = target.url || target.extracted?.image?.src;
            if (src) {
                const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
                if (!VIDEO_EXTENSIONS.includes(ext)) {
                    images.push(src);
                }
            }
        }

        // Add all extracted images
        if (target.extracted?.images) {
            for (const img of target.extracted.images) {
                if (!images.includes(img)) {
                    images.push(img);
                }
            }
        }

        // Aggregate from multi-block selection
        if (target.selectedTargets) {
            for (const subTarget of target.selectedTargets) {
                const subImages = ContentExtractor.getImages(subTarget);
                for (const img of subImages) {
                    if (!images.includes(img)) {
                        images.push(img);
                    }
                }
            }
        }

        return images;
    }

    public static getVideos(target: CaptureTarget): string[] {
        const videos: string[] = [];

        // Check main image if it's actually a video
        if (target.type === 'IMAGE' && target.extracted?.image?.src) {
            const src = target.extracted.image.src;
            const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase() || '';
            if (VIDEO_EXTENSIONS.includes(ext)) {
                videos.push(src);
            }
        }

        // Check explicit video target
        if (target.extracted?.video?.src) {
            const src = target.extracted.video.src;
            if (!videos.includes(src)) {
                videos.push(src);
            }
        }

        // Add all extracted videos
        if (target.extracted?.videos) {
            for (const vid of target.extracted.videos) {
                if (!videos.includes(vid)) {
                    videos.push(vid);
                }
            }
        }

        // Aggregate from multi-block selection
        if (target.selectedTargets) {
            for (const subTarget of target.selectedTargets) {
                const subVideos = ContentExtractor.getVideos(subTarget);
                for (const vid of subVideos) {
                    if (!videos.includes(vid)) {
                        videos.push(vid);
                    }
                }
            }
        }

        return videos;
    }

    public static getFiles(target: CaptureTarget): Array<{ url: string; label: string }> {
        const files: Map<string, string> = new Map();

        // Check if target itself is a file
        if (target.type === 'FILE' && target.url) {
            files.set(target.url, ContentExtractor.getFilenameFromUrl(target.url));
        }

        // Add all extracted files
        if (target.extracted?.files) {
            for (const file of target.extracted.files) {
                if (!files.has(file.url)) {
                    files.set(file.url, ContentExtractor.getFilenameFromUrl(file.url));
                }
            }
        }

        // Aggregate from multi-block selection
        if (target.selectedTargets) {
            for (const subTarget of target.selectedTargets) {
                const subFiles = ContentExtractor.getFiles(subTarget);
                for (const file of subFiles) {
                    if (!files.has(file.url)) {
                        files.set(file.url, file.label);
                    }
                }
            }
        }

        return Array.from(files.entries()).map(([url, label]) => ({ url, label }));
    }

    public static extractLinksFromSelection(): Array<{ url: string; label: string }> {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return [];

        const linksMap = new Map<string, { url: string; label: string }>();

        // Get all ranges
        for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const container = range.commonAncestorContainer;

            // Find anchor tags within the selection
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(range.cloneContents());

            // Get all <a> tags
            tempDiv.querySelectorAll('a[href]').forEach((a) => {
                const anchor = a as HTMLAnchorElement;
                const href = anchor.href;
                if (href && (href.startsWith('http://') || href.startsWith('https://')) && !linksMap.has(href)) {
                    const label = anchor.textContent?.trim() || href.split('/').pop() || href;
                    linksMap.set(href, { url: href, label });
                }
            });

            // Also check if the selection is within an anchor tag
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

            // Extract URLs from plain text using regex
            const text = range.toString();
            const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
            const matches = text.match(urlRegex);
            if (matches) {
                matches.forEach((url) => {
                    // Clean up trailing punctuation
                    const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
                    if (!linksMap.has(cleanUrl)) {
                        linksMap.set(cleanUrl, { url: cleanUrl, label: cleanUrl });
                    }
                });
            }
        }

        return Array.from(linksMap.values());
    }

    public static getFilenameFromUrl(url: string): string {
        try {
            const urlPath = new URL(url).pathname;
            const filename = urlPath.substring(urlPath.lastIndexOf('/') + 1);
            return decodeURIComponent(filename) || url;
        } catch {
            return url;
        }
    }
}
