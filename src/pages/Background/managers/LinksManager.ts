import {
    postLink,
    checkLinkExists,
    // getLinksFetch
} from '../../../@/lib/actions/links';
import {
    getLinkByUrl,
    getLinkHighlights,
    postHighlight,
    deleteHighlight,
    createLinkForHighlight,
} from '../../../@/lib/actions/highlights';
import { bookmarkFormValues } from '../../../@/lib/validators/bookmarkForm';
import { HighlightCreateData } from '../../../@/lib/types/highlight';
import { getBrowser } from '../../../@/lib/utils';

const browser = getBrowser();

export class LinksManager {

    static async createLink(config: { baseUrl: string; apiKey: string }, data: bookmarkFormValues & { uploadImage?: boolean; aiTagged?: boolean }, sender: any) {
        try {
            const result = await postLink(
                config.baseUrl,
                data.uploadImage || false,
                data,
                (state) => {
                    if (sender?.tab?.id && state === 'uploading') {
                        browser.tabs.sendMessage(sender.tab.id, {
                            type: 'LINK_SAVE_PROGRESS',
                            status: 'uploading'
                        }).catch(() => { });
                    }
                },
                config.apiKey,
                data.aiTagged || false
            );

            if (sender?.tab?.id && result?.data?.response) {
                const tabId = sender.tab.id;
                const action = browser.action || browser.browserAction;
                if (action) {
                    action.setBadgeText({ tabId, text: '✓' });
                    action.setBadgeBackgroundColor({ tabId, color: '#2c46f1' });
                }

                browser.tabs.sendMessage(tabId, {
                    type: 'LINK_SAVE_SUCCESS',
                    data: result.data
                }).catch(() => { });
            }

            if (result && result.data && result.data.response) {
                return { success: true, data: { link: result.data.response } };
            } else {
                return { success: false, error: 'Failed to create link' };
            }
        } catch (error) {

            return { success: false, error: 'Failed to create link' };
        }
    }

    static async updateLink(config: { baseUrl: string; apiKey: string }, id: number, payload: any) {
        try {

            const response = await fetch(`${config.baseUrl}/api/v1/links/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to update link: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            return { success: true, data };
        } catch (error) {

            return { success: false, error: String(error) };
        }
    }

    static async deleteLink(config: { baseUrl: string; apiKey: string }, id: number, sender?: any) {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/links/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${config.apiKey}` },
            });

            if (!response.ok) {
                throw new Error('Failed to delete link');
            }

            if (sender?.tab?.id) {
                const tabId = sender.tab.id;
                const action = browser.action || browser.browserAction;
                if (action) {
                    action.setBadgeText({ tabId, text: '' });
                }
            }

            return { success: true };
        } catch (error) {

            return { success: false, error: 'Failed to delete link' };
        }
    }

    static async archiveLink(config: { baseUrl: string; apiKey: string }, id: number, action: 'archive' | 'unarchive') {
        try {
            const url = `${config.baseUrl}/api/v1/links/${id}/toggle-archive`;
            const isArchived = action === 'archive';

            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isArchived })
            });

            if (!response.ok) {
                throw new Error(`Failed to ${action} link`);
            }
            return { success: true };
        } catch (error) {

            return { success: false, error: 'Failed to update archive status' };
        }
    }

    static async getHighlights(config: { baseUrl: string; apiKey: string }, url: string) {
        const link = await getLinkByUrl(config.baseUrl, url, config.apiKey);
        if (link) {
            const highlights = await getLinkHighlights(config.baseUrl, link.id, config.apiKey);
            return { success: true, data: { link, highlights } };
        } else {
            return { success: true, data: { link: null, highlights: [] } };
        }
    }

    static async createHighlight(config: { baseUrl: string; apiKey: string }, data: HighlightCreateData) {
        const highlight = await postHighlight(config.baseUrl, data, config.apiKey);
        if (highlight) {
            return { success: true, data: { highlight } };
        } else {
            return { success: false, error: 'Failed to create highlight' };
        }
    }

    static async deleteHighlight(config: { baseUrl: string; apiKey: string }, highlightId: number, linkId?: number) {
        const success = await deleteHighlight(config.baseUrl, highlightId, config.apiKey);
        return { success, linkId };
    }

    static async createFileHighlight(config: { baseUrl: string; apiKey: string }, data: any) {
        try {
            const { fileId, startOffset, endOffset, color, text, comment } = data;
            const response = await fetch(`${config.baseUrl}/api/v1/files/${fileId}/highlights`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startOffset, endOffset, color, text, comment }),
            });
            const resData = await response.json();

            if (response.ok) {
                return { success: true, data: { highlight: resData.response } };
            } else {
                return { success: false, error: resData.response || 'Failed to create file highlight' };
            }
        } catch (error) {

            return { success: false, error: 'Failed to create file highlight' };
        }
    }

    static async checkLinkExists(config: { baseUrl: string; apiKey: string }, url: string) {
        try {
            const response = await checkLinkExists(config.baseUrl, config.apiKey, url);
            return { success: true, data: response };
        } catch {
            return { success: false, error: 'Network error' };
        }
    }

    static async createLinkQuick(config: { baseUrl: string; apiKey: string }, url: string, title: string) {
        try {
            const link = await createLinkForHighlight(config.baseUrl, url, title, config.apiKey);
            if (link) {
                return { success: true, data: { link } };
            } else {
                return { success: false, error: 'Failed to save link' };
            }
        } catch (error) {

            return { success: false, error: String(error) };
        }
    }

    static async getRecentLinks(config: { baseUrl: string; apiKey: string }) {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/links?cursor=0&sort=0&limit=5`, {
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data.response || [] };
            } else {
                return { success: false, error: 'Failed to fetch recent links' };
            }
        } catch (error) {

            return { success: false, error: 'Failed to get recent links' };
        }
    }
}
