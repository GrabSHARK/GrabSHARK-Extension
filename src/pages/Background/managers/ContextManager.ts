import { getBrowser } from '../../../@/lib/utils';
import { getConfig, isConfigured } from '../../../@/lib/config';
// import ContextType = chrome.contextMenus.ContextType;
import OnClickData = chrome.contextMenus.OnClickData;
import { postLinkFetch } from '../../../@/lib/actions/links';
import { bookmarkMetadata, saveBookmarkMetadata } from '../../../@/lib/cache';

const browser = getBrowser();

export class ContextManager {
    constructor() {
        this.init();
    }

    private init() {
        // Re-enable listeners
        if (browser.contextMenus) {
            browser.contextMenus.onClicked.addListener((info, tab) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                this.genericOnClick(info, tab);
            });

            this.setupMenuItems();
        }
    }

    private setupMenuItems() {
        browser.runtime.onInstalled.addListener(() => {
            // TEMPORARILY DISABLED: Context menu items will be re-enabled after improvements are complete
            // Original logic from index.ts preserved here as comments for reference
            /*
            const contexts: ContextType[] = [
              'page',
              'selection',
              'link',
              'editable',
              'image',
              'video',
              'audio',
            ];
            for (const context of contexts) {
              const title: string = 'Add link to Linkwarden';
              browser.contextMenus.create({
                title: title,
                contexts: [context],
                id: context,
              });
            }
            browser.contextMenus.create({
              id: 'save-all-tabs',
              title: 'Save all tabs to Linkwarden',
              contexts: ['page'],
            });
            browser.contextMenus.create({
              id: 'highlight-selection',
              title: 'Highlight with Linkwarden',
              contexts: ['selection'],
            });
            */
        });
    }

    private async genericOnClick(
        info: OnClickData,
        tab: chrome.tabs.Tab | undefined
    ) {
        const { syncBookmarks, baseUrl } = await getConfig();
        const configured = await isConfigured();

        if (!tab?.url || !tab?.title || !configured) {
            return;
        }

        switch (info.menuItemId) {
            case 'save-all-tabs': {
                const tabs = await browser.tabs.query({ currentWindow: true });
                const config = await getConfig();

                for (const t of tabs) {
                    if (
                        t.url &&
                        !t.url.startsWith('chrome://') &&
                        !t.url.startsWith('about:')
                    ) {
                        try {
                            if (new URL(t.url))
                                await postLinkFetch(
                                    config.baseUrl,
                                    {
                                        url: t.url,
                                        name: t.title || '',
                                        description: t.title || '',
                                        collection: {
                                            name: config.defaultCollection,
                                        },
                                        tags: [],
                                    },
                                    config.apiKey
                                );
                        } catch (error) {

                        }
                    }
                }
                break;
            }
            case 'highlight-selection': {
                // Send message to content script to show the highlight toolbox
                if (tab?.id) {
                    browser.tabs.sendMessage(tab.id, { type: 'SHOW_HIGHLIGHT_TOOLBOX' });
                }
                break;
            }
            default:
                // Handle cases where sync is enabled or not
                if (syncBookmarks) {
                    browser.bookmarks.create({
                        parentId: '1',
                        title: tab.title,
                        url: tab.url,
                    });
                } else {
                    const config = await getConfig();

                    try {
                        const newLink = await postLinkFetch(
                            baseUrl,
                            {
                                url: tab.url,
                                collection: {
                                    name: 'Unorganized',
                                },
                                tags: [],
                                name: tab.title,
                                description: tab.title,
                            },
                            config.apiKey
                        );

                        const newLinkJson = await newLink.json();
                        const newLinkUrl: bookmarkMetadata = newLinkJson.response;
                        newLinkUrl.bookmarkId = tab.id?.toString();

                        await saveBookmarkMetadata(newLinkUrl);
                    } catch (error) {

                    }
                }
        }
    }
}
