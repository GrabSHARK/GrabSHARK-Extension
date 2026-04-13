import { getConfig } from '../../../@/lib/config';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { LinksManager } from './LinksManager';
import { MediaManager } from './MediaManager';
import { MESSAGE_SCHEMAS } from '../../../@/lib/validations/messageSchemas';
import { BootstrapManager } from './BootstrapManager';
import { ConfigManager } from './ConfigManager';
import { CollectionsManager } from './CollectionsManager';
import { PreferencesManager } from './PreferencesManager';
import { LinkUrlSyncManager } from './LinkUrlSyncManager';
import { getLinkIdByUrl } from '../../../@/lib/siteStateCache';

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

            let configPromise: Promise<Awaited<ReturnType<typeof getConfig>>> | null = null;

            const loadConfig = async () => {
                if (!configPromise) {
                    configPromise = getConfig();
                }
                return await configPromise;
            };

            const getConfiguredConfig = async () => {
                const config = await loadConfig();
                const configured = !!config.baseUrl && !!config.apiKey;
                return { config, configured };
            };

            switch (message.type) {
                case 'CHECK_CONFIG':
                    sendResponse(await ConfigManager.checkConfigured());
                    break;

                case 'GET_EXTENSION_CONFIG':
                    sendResponse(await ConfigManager.getConfig());
                    break;

                case 'SAVE_EXTENSION_CONFIG':
                    sendResponse(await ConfigManager.saveConfig(message.data));
                    break;

                case 'CLEAR_EXTENSION_CONFIG':
                    sendResponse(await ConfigManager.clearConfig());
                    break;

                case 'BOOTSTRAP_EXTENSION_STATE': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) {
                        sendResponse({ success: true, data: { configured: false, baseUrl: config.baseUrl } });
                        break;
                    }
                    sendResponse(await BootstrapManager.getBootstrapState(config, message.data?.domain));
                    break;
                }

                case 'VERIFY_SESSION':
                    sendResponse(await AuthManager.verifySession(message.data));
                    break;

                case 'GET_USER': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await UserManager.getUser(config));
                    break;
                }

                case 'UPDATE_USER': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await UserManager.updateUser(config, message.data.userId, message.data.data));
                    break;
                }

                case 'SYNC_USER_LOCALE': {
                    const { config, configured } = await getConfiguredConfig();
                    sendResponse(await UserManager.syncLocale(configured, config));
                    break;
                }

                case 'GET_EXTENSION_PREFERENCES':
                    sendResponse(await PreferencesManager.getPreferences());
                    break;

                case 'SAVE_EXTENSION_PREFERENCES':
                    sendResponse(await PreferencesManager.savePreferences(message.data));
                    break;

                case 'GET_SITE_OVERRIDES':
                    sendResponse(await PreferencesManager.getSiteOverrides());
                    break;

                case 'SAVE_SITE_OVERRIDE':
                    sendResponse(await PreferencesManager.saveSiteOverride(message.data));
                    break;

                case 'CLEAR_SITE_OVERRIDE':
                    sendResponse(await PreferencesManager.clearSiteOverride(message.data));
                    break;

                case 'GET_EFFECTIVE_PREFERENCES':
                    sendResponse(await PreferencesManager.getEffectivePreferences(message.data?.hostname));
                    break;

                case 'GET_LOCALE_SETTINGS':
                    sendResponse(await PreferencesManager.getLocaleSettings());
                    break;

                case 'SAVE_LOCALE_SETTINGS':
                    sendResponse(await PreferencesManager.saveLocaleSettings(message.data));
                    break;

                case 'GET_COLLECTIONS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await CollectionsManager.getCollections(config));
                    break;
                }

                case 'GET_TAGS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await CollectionsManager.getTags(config));
                    break;
                }

                case 'CREATE_LINK': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createLegacyLink(config, message.data, sender));
                    break;
                }

                case 'GET_HIGHLIGHTS_BY_LINK_ID': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getHighlightsByLinkId(config, message.data.linkId));
                    break;
                }

                case 'GET_FILE_HIGHLIGHTS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getFileHighlights(config, message.data.fileId));
                    break;
                }

                case 'GET_LINK_WITH_HIGHLIGHTS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getHighlights(config, message.data.url));
                    break;
                }

                case 'UPDATE_LINK': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.updateLink(config, message.data.id, message.data.payload));
                    break;
                }

                case 'DELETE_LINK': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.deleteLink(config, message.data.id, sender));
                    break;
                }

                case 'ARCHIVE_LINK': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.archiveLink(config, message.data.id, message.data.action));
                    break;
                }

                case 'CHECK_LINK_EXISTS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.checkLinkExists(config, message.data.url));
                    break;
                }

                case 'LOOKUP_LINK_ID': {
                    // 1. Fire delta sync if cooldown elapsed (fire-and-forget)
                    LinkUrlSyncManager.getInstance()?.sync();

                    // 2. Check local cache
                    let linkId = await getLinkIdByUrl(message.data.url);

                    // 3. If locally "saved", verify the link still exists on the server
                    if (linkId !== null) {
                        const syncManager = LinkUrlSyncManager.getInstance();
                        if (syncManager) {
                            linkId = await syncManager.verifyLink(message.data.url, linkId);
                        }
                    }

                    console.log('[LOOKUP_LINK_ID] url:', message.data.url, 'linkId:', linkId);
                    sendResponse({ success: true, data: { linkId } });
                    break;
                }

                case 'SYNC_LINK_URLS': {
                    const syncManager = LinkUrlSyncManager.getInstance();
                    if (syncManager) {
                        syncManager.sync().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false, error: 'Sync failed' }));
                    } else {
                        sendResponse({ success: false, error: 'Sync manager not initialized' });
                    }
                    break;
                }

                case 'SAVE_LINK_QUICK': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createLinkQuick(config, message.data.url, message.data.title));
                    break;
                }

                case 'GET_RECENT_LINKS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.getRecentLinks(config));
                    break;
                }

                case 'SAVE_LINK_FROM_EXTENSION': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createLink(config, { ...message.data.values, aiTagged: message.data.aiTagged }, sender));
                    break;
                }

                case 'CREATE_HIGHLIGHT': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createHighlight(config, message.data));
                    break;
                }

                case 'DELETE_HIGHLIGHT': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.deleteHighlight(config, message.data.highlightId, message.data.linkId));
                    break;
                }

                case 'CREATE_FILE_HIGHLIGHT': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await LinksManager.createFileHighlight(config, message.data));
                    break;
                }

                case 'FETCH_IMAGE_BLOB': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await MediaManager.fetchImageBlob(config, message.data.url));
                    break;
                }

                case 'SAVE_IMAGE': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await MediaManager.saveImage(config, message.data));
                    break;
                }

                case 'UPLOAD_CLIP': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await MediaManager.uploadClip(config, message.data));
                    break;
                }

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

                case 'GET_DOMAIN_PREFERENCE': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: true, data: { configured: false, baseUrl: config.baseUrl } }); break; }
                    sendResponse(await BootstrapManager.getDomainPreference(config, message.data.domain));
                    break;
                }

                case 'SET_DOMAIN_PREFERENCE': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await BootstrapManager.setDomainPreference(config, message.data));
                    break;
                }

                case 'SUGGEST_TAGS': {
                    const { config, configured } = await getConfiguredConfig();
                    if (!configured) { sendResponse({ success: false, error: 'Not configured' }); break; }
                    sendResponse(await BootstrapManager.suggestTags(config, message.data));
                    break;
                }

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

                case 'BROADCAST_PREFERENCES_UPDATED': {
                    const tabs = await chrome.tabs.query({});
                    for (const tab of tabs) {
                        if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'PREFERENCES_UPDATED', data: message.data }).catch(() => { });
                    }
                    sendResponse({ success: true });
                    break;
                }

                default:
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (e) {
            sendResponse({ success: false, error: String(e) });
        }
    }
}
