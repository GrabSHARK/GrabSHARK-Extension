export interface MessageResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

/**
 * Send message to background script
 */
export function sendMessage<T>(type: string, data?: unknown): Promise<MessageResponse<T>> {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ type, data }, (response: MessageResponse<T>) => {
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response' });
                }
            });
        } catch (e) {
            // Extension context invalidated
            resolve({ success: false, error: 'Extension context invalidated' });
        }
    });
}
