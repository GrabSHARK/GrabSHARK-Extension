/**
 * Crop a screenshot data URL to given coordinates
 */
export async function cropScreenshot(
    dataUrl: string,
    x: number,
    y: number,
    width: number,
    height: number
): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(null);
                return;
            }

            // Draw cropped portion of the screenshot
            ctx.drawImage(
                img,
                x, y, width, height,  // source rect (from full screenshot)
                0, 0, width, height   // destination rect (canvas)
            );

            resolve(canvas.toDataURL('image/jpeg', 0.92));
        };
        img.onerror = () => {

            resolve(null);
        };
        img.src = dataUrl;
    });
}

/**
 * Check if SVG data URL is empty/invalid (contains no drawable content)
 */
export function isEmptySvgDataUrl(dataUrl: string): boolean {
    try {
        // Decode the base64 content
        const base64Match = dataUrl.match(/base64,(.+)/);
        if (!base64Match) return true;

        const svgString = decodeURIComponent(escape(atob(base64Match[1])));

        // Check minimum size
        if (svgString.length < 100) return true;

        // Check for drawable elements
        const drawableElements = ['<path', '<rect', '<circle', '<ellipse', '<polygon', '<polyline', '<line', '<text', '<image'];
        return !drawableElements.some(el => svgString.includes(el));
    } catch (error) {

        return true; // Assume invalid if we can't parse
    }
}
