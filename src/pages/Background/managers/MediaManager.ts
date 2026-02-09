
export class MediaManager {

    static async fetchImageBlob(config: { baseUrl: string; apiKey: string }, url: string) {
        try {
            // Fetch the image with Authorization header
            const response = await fetch(url, {
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            if (!response.ok) throw new Error('Failed to fetch image');

            // Convert to blob then base64
            const blob = await response.blob();
            // We return the blob directly for the router to handle conversion if needed, 
            // but the original code handled it with FileReader.
            // Function returning promise of base64:
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({ success: true, data: { base64Data: reader.result } });
                };
                reader.onerror = () => {
                    resolve({ success: false, error: 'Failed to read blob' });
                };
                reader.readAsDataURL(blob);
            });

        } catch (error) {

            return { success: false, error: 'Failed to fetch image' };
        }
    }

    static async saveImage(config: { baseUrl: string; apiKey: string }, data: any) {
        const { url, title, pageContext, description } = data;

        // Helper functions (extracted from original file)
        const getFilenameFromUrl = (fileUrl: string): string | null => {
            try {
                if (fileUrl.startsWith('data:')) return null;
                const urlObj = new URL(fileUrl);
                const pathname = urlObj.pathname;
                const parts = pathname.split('/');
                const lastPart = parts[parts.length - 1];
                if (!lastPart) return null;
                const decoded = decodeURIComponent(lastPart);
                const cleanName = decoded.split('?')[0].split('#')[0];
                if (!cleanName) return null;
                const hasExtension = cleanName.includes('.') && cleanName.lastIndexOf('.') !== 0 && cleanName.lastIndexOf('.') !== cleanName.length - 1;
                const nameWithoutExt = cleanName.replace(/\.[^/.]+$/, '');
                const seemsMeaningless = /^[0-9a-f]{8,}$/i.test(nameWithoutExt) || /^[0-9]+$/.test(nameWithoutExt) || nameWithoutExt.length < 3;

                if (hasExtension && !seemsMeaningless) return cleanName;
                if (hasExtension) return cleanName;
                return null;
            } catch { return null; }
        };

        const getExtFromUrl = (fileUrl: string): string => {
            try {
                if (fileUrl.startsWith('data:')) {
                    const mimeMatch = fileUrl.match(/data:([^;,]+)/);
                    const mime = mimeMatch?.[1]?.toLowerCase() || '';
                    if (mime.includes('png')) return 'png';
                    if (mime.includes('jpeg')) return 'jpg';
                    // ... simple fallback
                    return 'bin';
                }
                const urlObj = new URL(fileUrl);
                const cleanPath = urlObj.pathname.split('?')[0].split('#')[0];
                const ext = cleanPath.split('.').pop()?.toLowerCase();
                return ext || 'bin';
            } catch { return 'bin'; }
        };

        const urlFilename = getFilenameFromUrl(url);
        const originalExt = getExtFromUrl(url);
        let filename: string;
        let fileTitle: string;

        if (urlFilename) {
            filename = urlFilename;
            fileTitle = urlFilename.replace(/\.[^/.]+$/, '');
        } else {
            // const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const safeTitle = (title || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 50);
            filename = originalExt !== 'bin' ? `${safeTitle}.${originalExt}` : `${safeTitle}.bin`;
            fileTitle = safeTitle;
        }

        // Upload Logic
        if (config.baseUrl && config.apiKey) {
            try {
                const imageResponse = await fetch(url);
                if (!imageResponse.ok) throw new Error('Failed to fetch image');
                const blob = await imageResponse.blob();

                const formData = new FormData();
                formData.append('file', blob, filename);
                formData.append('type', 'IMAGE');
                formData.append('source', 'EXTENSION_CAPTURE');
                formData.append('title', fileTitle);
                formData.append('description', description || '');
                formData.append('sourceUrl', pageContext?.pageUrl || '');
                formData.append('sourceTitle', pageContext?.pageTitle || '');

                const uploadResponse = await fetch(`${config.baseUrl}/api/v1/files/upload`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${config.apiKey}` },
                    body: formData,
                });

                if (uploadResponse.ok) {
                    const file = await uploadResponse.json();
                    return { success: true, data: { file: file.response, uploaded: true } };
                }
            } catch (e) {

            }
        }

        // Fallback Download
        await chrome.downloads.download({
            url: url,
            filename: `Linkwarden/${filename}`,
            saveAs: true,
        });
        return { success: true, data: { fallback: true } };
    }

    static async uploadClip(config: { baseUrl: string; apiKey: string }, data: any) {
        const { dataUrl, filename, type, sourceUrl, sourceTitle } = data;
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('type', type);
            formData.append('source', 'EXTENSION_CAPTURE');
            formData.append('title', sourceTitle || filename);
            formData.append('sourceUrl', sourceUrl);
            formData.append('sourceTitle', sourceTitle);

            const uploadResponse = await fetch(`${config.baseUrl}/api/v1/files/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
                body: formData,
            });

            if (!uploadResponse.ok) throw new Error('Upload failed');

            const file = await uploadResponse.json();
            return { success: true, data: { file: file.response } };
        } catch (error: any) {
            // Fallback
            await chrome.downloads.download({
                url: dataUrl,
                filename: `Linkwarden/Clips/${filename}`,
                saveAs: true,
            });
            return { success: true, data: { fallback: true, error: error.message } };
        }
    }
}
