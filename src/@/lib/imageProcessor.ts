/**
 * ImageProcessor - Canvas-based image processing for thumbnail generation
 * 
 * Replicates backend Sharp functionality:
 * - Resize to max 1000px width (maintain aspect ratio)
 * - Convert to JPEG at 20% quality
 */

const MAX_WIDTH = 1000;
const JPEG_QUALITY = 0.2;

/**
 * Process an image URL into a compressed JPEG thumbnail
 * Uses OffscreenCanvas for background-compatible processing
 * 
 * @param imageUrl - URL of the OG image to process
 * @returns Blob of processed JPEG, or null on failure
 */
export async function processOgImage(imageUrl: string): Promise<Blob | null> {
    try {
        // Fetch the image via background script to handle CORS
        const response = await new Promise<{ success: boolean; data?: { base64Data: string } }>((resolve) => {
            chrome.runtime.sendMessage({
                type: 'FETCH_IMAGE_BLOB',
                data: { url: imageUrl }
            }, resolve);
        });

        if (!response?.success || !response?.data?.base64Data) {
            return null;
        }

        // Convert base64 to blob
        const base64Data = response.data.base64Data;
        const fetchResponse = await fetch(base64Data);
        const originalBlob = await fetchResponse.blob();

        // Create an image from the blob
        const imageBitmap = await createImageBitmap(originalBlob);

        // Calculate new dimensions (max width 1000px, maintain aspect ratio)
        let newWidth = imageBitmap.width;
        let newHeight = imageBitmap.height;

        if (newWidth > MAX_WIDTH) {
            const ratio = MAX_WIDTH / newWidth;
            newWidth = MAX_WIDTH;
            newHeight = Math.round(imageBitmap.height * ratio);
        }

        // Use OffscreenCanvas if available (works in service workers), fallback to regular canvas
        let canvas: OffscreenCanvas | HTMLCanvasElement;
        let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;

        if (typeof OffscreenCanvas !== 'undefined') {
            canvas = new OffscreenCanvas(newWidth, newHeight);
            ctx = canvas.getContext('2d');
        } else {
            canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;
            ctx = canvas.getContext('2d');
        }

        if (!ctx) {
            return null;
        }

        // Draw resized image
        ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

        // Export as JPEG with quality 0.2 (20%)
        let resultBlob: Blob;

        if (canvas instanceof OffscreenCanvas) {
            resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
        } else {
            // Fallback for regular canvas
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            const blobResponse = await fetch(dataUrl);
            resultBlob = await blobResponse.blob();
        }

        return resultBlob;
    } catch (error) {

        return null;
    }
}

/**
 * Convert Blob to base64 data URL for display
 */
export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
