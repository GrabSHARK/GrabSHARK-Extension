import { getConfig, isConfigured } from '../../../@/lib/config';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { LinksManager } from './LinksManager';
import { MediaManager } from './MediaManager';
import { getCollections } from '../../../@/lib/actions/collections';
import { getTags } from '../../../@/lib/actions/tags';

export class MessageRouter {

    static async route(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
        try {
            const configured = await isConfigured();
            const config = await getConfig();

            // Pass-through validation for certain types if needed, or handle in managers

            switch (message.type) {
                case 'CHECK_CONFIG':
                    sendResponse({ success: true, data: { configured, baseUrl: config.baseUrl } });
                    break;

                case 'VERIFY_SESSION':
                    sendResponse(await AuthManager.verifySession(message.data));
                    break;

                case 'GET_USER':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await UserManager.getUser(config));
                    break;

                case 'UPDATE_USER':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await UserManager.updateUser(config, message.data.userId, message.data.data));
                    break;

                case 'SYNC_USER_LOCALE':
                    sendResponse(await UserManager.syncLocale(configured, config));
                    break;

                // --- LINKS ---
                case 'GET_LINK_WITH_HIGHLIGHTS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getHighlights(config, message.data.url));
                    break;

                case 'CREATE_LINK':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createLink(config, message.data, sender));
                    break;

                case 'UPDATE_LINK':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.updateLink(config, message.data.id, message.data.payload));
                    break;

                case 'DELETE_LINK':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.deleteLink(config, message.data.id, sender));
                    break;

                case 'ARCHIVE_LINK':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.archiveLink(config, message.data.id, message.data.action));
                    break;

                case 'CHECK_LINK_EXISTS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.checkLinkExists(config, message.data.url));
                    break;

                case 'SAVE_LINK_QUICK':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createLinkQuick(config, message.data.url, message.data.title));
                    break;

                case 'GET_RECENT_LINKS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getRecentLinks(config));
                    break;

                case 'SAVE_LINK_FROM_EXTENSION':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    const payload = { ...message.data.values, aiTagged: message.data.aiTagged };
                    sendResponse(await LinksManager.createLink(config, payload, sender));
                    break;

                // --- HIGHLIGHTS ---
                case 'CREATE_HIGHLIGHT':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createHighlight(config, message.data));
                    break;

                case 'DELETE_HIGHLIGHT':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.deleteHighlight(config, message.data.highlightId, message.data.linkId));
                    break;

                case 'CREATE_FILE_HIGHLIGHT':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createFileHighlight(config, message.data));
                    break;

                // --- MEDIA ---
                case 'FETCH_IMAGE_BLOB':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    const blobRes = await MediaManager.fetchImageBlob(config, message.data.url);
                    sendResponse(blobRes);
                    break;

                case 'SAVE_IMAGE':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await MediaManager.saveImage(config, message.data));
                    break;

                case 'UPLOAD_CLIP':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await MediaManager.uploadClip(config, message.data));
                    break;

                case 'CAPTURE_VISIBLE_TAB':
                    try {
                        const windowId = sender.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT;
                        const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 92 });
                        sendResponse({ success: true, data: { dataUrl } });
                    } catch (error) {
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                case 'DOWNLOAD_DATA_URL':
                    try {
                        await chrome.downloads.download({
                            url: message.data.dataUrl,
                            filename: message.data.filename,
                            saveAs: message.data.saveAs ?? true,
                        });
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: String(error) });
                    }
                    break;

                // --- COLLECTIONS / TAGS ---
                case 'GET_COLLECTIONS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    try {
                        const result = await getCollections(config.baseUrl, config.apiKey);
                        sendResponse({ success: true, data: result.data });
                    } catch (e) { sendResponse({ success: false, error: 'Failed' }); }
                    break;

                case 'GET_TAGS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    try {
                        const result = await getTags(config.baseUrl, config.apiKey);
                        sendResponse({ success: true, data: result.data });
                    } catch (e) { sendResponse({ success: false, error: 'Failed' }); }
                    break;

                case 'OPEN_TAB':
                    chrome.tabs.create({ url: message.data.url });
                    sendResponse({ success: true });
                    break;

                case 'OPEN_OPTIONS_PAGE':
                    chrome.runtime.openOptionsPage();
                    sendResponse({ success: true });
                    break;

                // For now, keep un-refactored simple cases here or move them later

                default:
                    if (message.type === 'BROADCAST_PREFERENCES_UPDATED') {
                        // Logic for broadcast
                        const tabs = await chrome.tabs.query({});
                        for (const tab of tabs) {
                            if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'PREFERENCES_UPDATED', data: message.data }).catch(() => { });
                        }
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'Unknown message type' });
                    }
            }

        } catch (e) {

            sendResponse({ success: false, error: String(e) });
        }
    }
}
