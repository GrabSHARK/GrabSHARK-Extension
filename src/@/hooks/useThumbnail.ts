/**
 * useThumbnail - Custom hook for priority-based thumbnail resolution
 * 
 * Priority order:
 * 1. IndexedDB cache (instant)
 * 2. API preview (if link.preview exists)
 * 3. Wait for backend (show skeleton)
 */

import { useState, useEffect, useCallback } from 'react';
import { getThumbnail, saveThumbnail, hasThumbnail } from '../lib/thumbnailCache';
import { processOgImage, blobToBase64 } from '../lib/imageProcessor';

interface UseThumbnailOptions {
    linkId?: number;
    linkUrl: string;
    linkPreviewPath?: string | null;
    ogImageUrl?: string | null;
    baseUrl?: string | null;
}

interface UseThumbnailResult {
    imgSrc: string | null;
    isLoading: boolean;
    isCached: boolean;
    processOgImageNow: () => Promise<void>;
}

export function useThumbnail({
    linkId,
    linkUrl,
    linkPreviewPath,
    ogImageUrl,
    baseUrl,
}: UseThumbnailOptions): UseThumbnailResult {
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCached, setIsCached] = useState(false);

    // Fetch from API preview endpoint
    const fetchFromApi = useCallback(async () => {
        if (!linkPreviewPath || !baseUrl || !linkId) return null;

        try {
            const url = `${baseUrl.replace(/\/$/, '')}/api/v1/archives/${linkId}?format=1&preview=true`;

            const response = await new Promise<{ success: boolean; data?: { base64Data: string } }>((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'FETCH_IMAGE_BLOB',
                    data: { url }
                }, resolve);
            });

            if (response?.success && response?.data?.base64Data) {
                return response.data.base64Data;
            }
        } catch (error) {

        }
        return null;
    }, [linkPreviewPath, baseUrl, linkId]);

    // Process OG image and cache it
    const processOgImageNow = useCallback(async () => {
        if (!ogImageUrl || !linkUrl) return;

        try {
            const blob = await processOgImage(ogImageUrl);
            if (blob) {
                const base64 = await blobToBase64(blob);
                await saveThumbnail(linkUrl, blob);
                setImgSrc(base64);
                setIsCached(true);
                setIsLoading(false);
            }
        } catch (error) {

        }
    }, [ogImageUrl, linkUrl]);

    useEffect(() => {
        let cancelled = false;

        const loadThumbnail = async () => {
            setIsLoading(true);

            // Priority 1: Check IndexedDB cache
            const cached = await getThumbnail(linkUrl);
            if (cached && !cancelled) {
                setImgSrc(cached);
                setIsCached(true);
                setIsLoading(false);
                return;
            }

            // Priority 2: Try API preview if available
            if (linkPreviewPath) {
                const apiImage = await fetchFromApi();
                if (apiImage && !cancelled) {
                    setImgSrc(apiImage);
                    setIsCached(false);
                    setIsLoading(false);
                    return;
                }
            }

            // Priority 3: If OG image exists and no cache, process it
            if (ogImageUrl) {
                const blob = await processOgImage(ogImageUrl);
                if (blob && !cancelled) {
                    const base64 = await blobToBase64(blob);
                    await saveThumbnail(linkUrl, blob);
                    setImgSrc(base64);
                    setIsCached(true);
                    setIsLoading(false);
                    return;
                }
            }

            // No cache, no API preview, no OG image -> wait for backend
            // Keep loading state, skeleton will be shown
            if (!cancelled) {
                setIsLoading(true);
            }
        };

        loadThumbnail();

        return () => {
            cancelled = true;
        };
    }, [linkUrl, linkPreviewPath, ogImageUrl, fetchFromApi]);

    // Poll for backend preview if still loading
    useEffect(() => {
        if (!isLoading || imgSrc || !linkId || !baseUrl) return;

        let cancelled = false;

        const pollInterval = setInterval(async () => {
            const apiImage = await fetchFromApi();
            if (!cancelled && apiImage) {
                setImgSrc(apiImage);
                setIsLoading(false);
                clearInterval(pollInterval);
            }
        }, 3000);

        return () => {
            cancelled = true;
            clearInterval(pollInterval);
        };
    }, [isLoading, imgSrc, linkId, baseUrl, fetchFromApi]);

    return {
        imgSrc,
        isLoading,
        isCached,
        processOgImageNow,
    };
}

/**
 * Pre-check if thumbnail is cached (for optimistic UI decisions)
 */
export async function isThumbnailCached(url: string): Promise<boolean> {
    return hasThumbnail(url);
}
