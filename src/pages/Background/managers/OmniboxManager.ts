import { getBrowser, getCurrentTabInfo } from '../../../@/lib/utils';
import { isConfigured } from '../../../@/lib/config';
import OnInputEnteredDisposition = chrome.omnibox.OnInputEnteredDisposition;
import { getBookmarksMetadata } from '../../../@/lib/cache';

const browser = getBrowser();

export class OmniboxManager {
    constructor() {
        this.init();
    }

    private init() {
        // Set default suggestion on start
        browser.omnibox.onInputStarted.addListener(async () => {
            const configured = await isConfigured();
            const description = configured
                ? 'Search links in Spark'
                : 'Please configure the extension first';

            browser.omnibox.setDefaultSuggestion({
                description: description,
            });
        });

        // Handle input changes
        browser.omnibox.onInputChanged.addListener(
            async (
                text: string,
                suggest: (arg0: { content: string; description: string }[]) => void
            ) => {
                const configured = await isConfigured();

                if (!configured) {
                    return;
                }

                const currentBookmarks = await getBookmarksMetadata();

                const searchedBookmarks = currentBookmarks.filter((bookmark) => {
                    return bookmark.name?.includes(text) || bookmark.url.includes(text);
                });

                const bookmarkSuggestions = searchedBookmarks.map((bookmark) => {
                    return {
                        content: bookmark.url,
                        description: bookmark.name || bookmark.url,
                    };
                });
                suggest(bookmarkSuggestions);
            }
        );

        // Handle selection/enter
        browser.omnibox.onInputEntered.addListener(
            async (content: string, disposition: OnInputEnteredDisposition) => {
                if (!(await isConfigured()) || !content) {
                    return;
                }

                const isUrl = /^http(s)?:\/\//.test(content);
                const url = isUrl ? content : `lk`;

                // Edge browser workaround for NTP
                if (disposition === 'currentTab') {
                    const tabInfo = await getCurrentTabInfo();
                    if (tabInfo.url === 'edge://newtab/') {
                        disposition = 'newForegroundTab';
                    }
                }

                switch (disposition) {
                    case 'currentTab':
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore
                        await browser.tabs.update({ url });
                        break;
                    case 'newForegroundTab':
                        await browser.tabs.create({ url });
                        break;
                    case 'newBackgroundTab':
                        await browser.tabs.create({ url, active: false });
                        break;
                }
            }
        );
    }
}
