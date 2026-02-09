import { CaptureTarget } from '../SmartCapture';
import { HighlightColor } from '../../../@/lib/types/highlight';
import { showToast } from '../HighlightToolbox';
import { sendMessage } from '../utils/messaging';
import { showSaveNotification } from './ToastManager';
import { hideAllSmartCaptureOverlays, showAllSmartCaptureOverlays, waitForRepaint } from '../utils/domHelpers';
import { cropScreenshot, isEmptySvgDataUrl } from '../utils/imageHelpers';
import { HighlightManager } from './HighlightManager';
import { captureAnchor } from '../anchorUtils';


export const SmartCaptureHandlers = {
    /**
     * Handle Smart Capture save link action
     */
    async handleSaveLink(target: CaptureTarget): Promise<void> {


        const url = target.url ||
            target.secondaryUrl ||
            target.extracted?.links?.[0]?.url;

        if (!url) {
            showToast('No URL to save', 'error');
            return;
        }

        const title = target.title ||
            target.extracted?.links?.[0]?.label ||
            '';

        const response = await sendMessage<{ link: { id: number; url: string; name: string; createdAt?: string; collection?: { name: string; color?: string; icon?: string } } }>('CREATE_LINK', {
            url: url,
            title: title,
        });

        if (response.success && response.data?.link) {
            showSaveNotification([{
                id: response.data.link.id,
                url: response.data.link.url,
                name: response.data.link.name || url,
                createdAt: response.data.link.createdAt,
                collection: response.data.link.collection
            }]);
        } else {
            showToast(response.error || 'Failed to save link', 'error');
        }
    },

    /**
     * Handle Smart Capture save image action
     */
    async handleSaveImage(target: CaptureTarget): Promise<void> {
        const imageSrc = target.url ||
            target.extracted?.image?.currentSrc ||
            target.extracted?.image?.src ||
            target.extracted?.images?.[0] ||
            target.extracted?.video?.src ||
            target.extracted?.video?.currentSrc ||
            target.extracted?.videos?.[0];

        if (!imageSrc) {
            showToast('No image or video to save', 'error');
            return;
        }

        if (imageSrc.startsWith('data:image/svg+xml') && isEmptySvgDataUrl(imageSrc)) {
            await SmartCaptureHandlers.handleClip(target);
            return;
        }

        let imageTitle = target.title;
        const genericTitles = ['', 'image', 'img', 'svg', 'icon', 'logo', undefined];
        if (!imageTitle || genericTitles.includes(imageTitle.toLowerCase().trim())) {
            imageTitle = target.pageContext?.pageTitle || document.title || imageSrc?.split('/').pop()?.split('#')[0]?.split('?')[0] || undefined;
        }

        const response = await sendMessage<{ uploaded?: boolean; fallback?: boolean }>('SAVE_IMAGE', {
            url: imageSrc,
            title: imageTitle,
            pageContext: target.pageContext,
        });

        if (response.success) {
            if (response.data?.uploaded) {
                // Image saved
            } else if (response.data?.fallback) {
                // Image download started
            } else {
                // Image saved
            }
        } else {
            showToast(response.error || 'Failed to save image', 'error');
        }
    },

    /**
     * Handle Smart Capture save file action
     */
    async handleSaveFile(target: CaptureTarget): Promise<void> {
        const fileUrl = target.secondaryUrl || target.url;
        if (!fileUrl) {
            showToast('No file URL to save', 'error');
            return;
        }

        const response = await sendMessage<{ uploaded?: boolean; fallback?: boolean }>('SAVE_IMAGE', {
            url: fileUrl,
            title: target.title || 'Saved File',
            pageContext: target.pageContext,
        });

        if (response.success) {
            if (response.data?.uploaded) {
                // File saved
            } else if (response.data?.fallback) {
                // File download started
            } else {
                // File saved
            }
        } else {
            showToast(response.error || 'Failed to save file', 'error');
        }
    },

    /**
     * Handle Smart Capture clip action
     */
    async handleClip(target: CaptureTarget): Promise<void> {


        const overlaysHidden = hideAllSmartCaptureOverlays();
        await waitForRepaint();

        try {
            let captureRect: DOMRect | undefined;

            if (target.elementRef) {
                captureRect = target.elementRef.getBoundingClientRect();
                const padding = 12;
                captureRect = new DOMRect(
                    captureRect.x - padding,
                    captureRect.y - padding,
                    captureRect.width + (padding * 2),
                    captureRect.height + (padding * 2)
                );
            } else if (target.selectedTargets && target.selectedTargets.length > 0) {
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                let hasValidRef = false;

                for (const subTarget of target.selectedTargets) {
                    if (subTarget.elementRef) {
                        const rect = subTarget.elementRef.getBoundingClientRect();
                        minX = Math.min(minX, rect.left);
                        minY = Math.min(minY, rect.top);
                        maxX = Math.max(maxX, rect.right);
                        maxY = Math.max(maxY, rect.bottom);
                        hasValidRef = true;
                    }
                }

                if (hasValidRef) {
                    const padding = 12;
                    captureRect = new DOMRect(
                        minX - padding,
                        minY - padding,
                        (maxX - minX) + (padding * 2),
                        (maxY - minY) + (padding * 2)
                    );
                } else {
                    captureRect = target.rect;
                }
            } else {
                captureRect = target.rect;
            }

            if (!captureRect) {
                showToast('Invalid capture area', 'error');
                return;
            }

            // Add iframe offset if running inside an iframe
            const isInIframe = window !== window.top;
            let iframeOffsetX = 0;
            let iframeOffsetY = 0;

            if (isInIframe) {
                try {
                    // Try to get iframe position from parent (same-origin only)
                    const frameElement = window.frameElement as HTMLIFrameElement | null;
                    if (frameElement) {
                        const frameRect = frameElement.getBoundingClientRect();
                        iframeOffsetX = frameRect.left;
                        iframeOffsetY = frameRect.top;
                    }
                } catch (e) {
                    // Cross-origin - can't access frameElement, try postMessage
                    console.warn('[SmartCaptureHandlers] Cannot get iframe offset (cross-origin)');
                }
            }

            const dpr = window.devicePixelRatio || 1;
            const response = await sendMessage<{ dataUrl: string }>('CAPTURE_VISIBLE_TAB', {});

            if (!response.success || !response.data?.dataUrl) {
                showToast(response.error || 'Failed to capture screenshot', 'error');
                return;
            }

            const croppedDataUrl = await cropScreenshot(
                response.data.dataUrl,
                (captureRect.x + iframeOffsetX) * dpr,
                (captureRect.y + iframeOffsetY) * dpr,
                captureRect.width * dpr,
                captureRect.height * dpr
            );

            if (!croppedDataUrl) {
                showToast('Failed to crop screenshot', 'error');
                return;
            }

            const filename = `clip_${target.title?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) || 'capture'}_${Date.now()}.jpg`;

            const uploadResponse = await sendMessage<{ clip?: any; fallback?: boolean; error?: string }>('UPLOAD_CLIP', {
                dataUrl: croppedDataUrl,
                filename: filename,
                type: 'SCREENSHOT',
                sourceUrl: window.location.href,
                sourceTitle: document.title,
            });

            if (uploadResponse.success) {
                if (uploadResponse.data?.fallback) {
                    showToast(`Saved locally (${uploadResponse.data?.error || 'server unavailable'})`, 'success');
                } else {
                    showToast('Clipped and saved to Linkwarden!', 'success');
                }
            } else {
                showToast(uploadResponse.error || 'Failed to save clip', 'error');
            }
        } catch (error) {

            showToast('Failed to clip: ' + String(error), 'error');
        } finally {
            showAllSmartCaptureOverlays(overlaysHidden);
        }
    },
    /**
     * Handle saving a note
     */
    async handleNoteSave(target: CaptureTarget, note: string, color?: HighlightColor): Promise<void> {

        if (!target.extracted?.text) {
            showToast('No text to attach note to', 'error');
            return;
        }

        // console.log('[SmartCaptureHandlers] handleNoteSave called');

        try {
            // Generate anchor from elementRef for DOM rendering
            let anchor = undefined;
            if (target.elementRef) {
                const range = document.createRange();
                range.selectNodeContents(target.elementRef);
                anchor = captureAnchor(range);
            }

            // Create highlight with note via HighlightManager
            await HighlightManager.createHighlight({
                text: target.extracted.text,
                startOffset: 0,
                endOffset: target.extracted.text.length,
                rect: target.rect,
                anchor: anchor
            }, color || 'yellow', note);

        } catch (e) {

            showToast('Failed to save note', 'error');
        }
    }
};
