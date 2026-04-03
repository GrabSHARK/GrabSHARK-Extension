import { getConfig, isConfigured } from '../../../@/lib/config';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { LinksManager } from './LinksManager';
import { MediaManager } from './MediaManager';
import { getCollections } from '../../../@/lib/actions/collections';
import { getTags } from '../../../@/lib/actions/tags';
import { MESSAGE_SCHEMAS } from '../../../@/lib/validations/messageSchemas';
import { BootstrapManager } from './BootstrapManager';

export class MessageRouter {

    static async route(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) {
        try {
            if (sender.id && sender.id !== chrome.runtime.id) {
                sendResponse({ success: false, error: 'Unauthorized sender' });
                return;
            }

            const schema = MESSAGE_SCHEMAS[message.type];
            if (schema && typeof message.data !== 'undefined') {
                const result = schema.safeParse(message.data);
                if (!result.success) {
                    sendResponse({ success: false, error: `Invalid payload: ${result.error.issues.map(i => i.message).join(', ')}` });
                    return;
                }
            }

            const configured = await isConfigured();
            const config = await getConfig();

            switch (message.type) {
                case 'CHECK_CONFIG':
                    sendResponse({ success: true, data: { configured, baseUrl: config.baseUrl } });
                    break;

                case 'BOOTSTRAP_EXTENSION_STATE':
                    if (!configured) {
                        sendResponse({ success: true, data: { configured: false, baseUrl: config.baseUrl } });
                        break;
                    }
                    sendResponse(await BootstrapManager.getBootstrapState(config, message.data?.domain));
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

                case 'GET_COLLECTIONS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    try {
                        const result = await getCollections(config.baseUrl, config.apiKey);
                        sendResponse({ success: true, data: result.data });
                    } catch {
                        sendResponse({ success: false, error: 'Failed' });
                    }
                    break;

                case 'GET_TAGS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    try {
                        const result = await getTags(config.baseUrl, config.apiKey);
                        sendResponse({ success: true, data: result.data });
                    } catch {
                        sendResponse({ success: false, error: 'Failed' });
                    }
                    break;

                case 'GET_DOMAIN_PREFERENCE':
                    if (!configured) { sendResponse({ success: true, data: { configured: false, baseUrl: config.baseUrl } }); break; }
                    sendResponse(await BootstrapManager.getDomainPreference(config, message.data.domain));
                    break;

                case 'SET_DOMAIN_PREFERENCE':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await BootstrapManager.setDomainPreference(config, message.data));
                    break;

                case 'SUGGEST_TAGS':
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await BootstrapManager.suggestTags(config, message.data));
                    break;

                case 'OPEN_TAB':
                    try {
                        const tabUrl = new URL(message.data.url);
                        if (tabUrl.protocol !== 'http:' && tabUrl.protocol !== 'https:') {
                            sendResponse({ success: false, error: 'Invalid URL protocol' });
                            break;
                        }
                        chrome.tabs.create({ url: message.data.url });
                        sendResponse({ success: true });
                    } catch {
                        sendResponse({ success: false, error: 'Invalid URL' });
                    }
                    break;

                case 'OPEN_OPTIONS_PAGE':
                    chrome.runtime.openOptionsPage();
                    sendResponse({ success: true });
                    break;

                default:
                    if (message.type === 'BROADCAST_PREFERENCES_UPDATED') {
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