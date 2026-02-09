// import { getBrowser } from '../../../@/lib/utils';
// import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
// import {
//   getBookmarkMetadataByBookmarkId,
//   getBookmarkMetadataByUrl,
//   saveBookmarkMetadata,
//   deleteBookmarkMetadata,
//   bookmarkMetadata
// } from '../../../@/lib/cache';
// import {
//   postLinkFetch,
//   updateLinkFetch,
//   deleteLinkFetch
// } from '../../../@/lib/actions/links';
// import {
//   getSessionFetch,
//   getCsrfTokenFetch,
//   performLoginOrLogoutFetch
// } from '../../../@/lib/auth/auth';

// const browser = getBrowser();

export class BookmarksManager {
    constructor() {
        this.init();
    }

    private init() {
        // Original code had these listeners customized but commented out or active depending on version
        // Preserving the structure for when sync is re-enabled fully.

        // browser.bookmarks.onCreated.addListener(async (_id: string, bookmark: BookmarkTreeNode) => {
        //   // Implementation from index.ts lines 54-107
        // });

        // browser.bookmarks.onChanged.addListener(async (id: string, changeInfo: chrome.bookmarks.BookmarkChangeInfo) => {
        //   // Implementation from index.ts lines 109-163
        // });

        // browser.bookmarks.onRemoved.addListener(async (id: string, removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => {
        //   // Implementation from index.ts lines 165-207
        // });


    }
}
