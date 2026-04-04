import { getBrowser, getStorageItem, setStorageItem } from './utils.ts';
import { bookmarkFormValues } from './validators/bookmarkForm.ts';
import { deleteLinkFetch, getLinksFetch, postLinkFetch, updateLinkFetch } from './actions/links.ts';
import BookmarkTreeNode = chrome.bookmarks.BookmarkTreeNode;
import { getConfig } from './config.ts';

const browser = getBrowser();

const BOOKMARKS_METADATA_KEY = 'lw_bookmarks_metadata_cache';
const CACHE_VERSION = 2;

export interface bookmarkMetadata extends bookmarkFormValues {
  id: number;
  collectionId: number;
  bookmarkId?: string;
}

interface BookmarkMetadataCacheStore {
  version: number;
  byId: Record<string, bookmarkMetadata>;
  idsByUrl: Record<string, number>;
  idsByBookmarkId: Record<string, number>;
}

function cloneDefaultStore(): BookmarkMetadataCacheStore {
  return {
    version: CACHE_VERSION,
    byId: {},
    idsByUrl: {},
    idsByBookmarkId: {},
  };
}

function normalizeBookmarkMetadata(entry: bookmarkMetadata): bookmarkMetadata {
  return {
    ...entry,
    bookmarkId: entry.bookmarkId ?? undefined,
  };
}

function buildStore(entries: bookmarkMetadata[]): BookmarkMetadataCacheStore {
  const store = cloneDefaultStore();

  for (const entry of entries) {
    const normalized = normalizeBookmarkMetadata(entry);
    const key = String(normalized.id);
    store.byId[key] = normalized;
    if (normalized.url) {
      store.idsByUrl[normalized.url] = normalized.id;
    }
    if (normalized.bookmarkId) {
      store.idsByBookmarkId[normalized.bookmarkId] = normalized.id;
    }
  }

  return store;
}

function migrateParsedCache(parsed: unknown): BookmarkMetadataCacheStore {
  if (Array.isArray(parsed)) {
    return buildStore(parsed as bookmarkMetadata[]);
  }

  if (parsed && typeof parsed === 'object') {
    const candidate = parsed as Partial<BookmarkMetadataCacheStore>;
    if (candidate.byId && typeof candidate.byId === 'object') {
      const entries = Object.values(candidate.byId).filter(Boolean) as bookmarkMetadata[];
      return buildStore(entries);
    }
  }

  return cloneDefaultStore();
}

async function readBookmarksMetadataStore(): Promise<BookmarkMetadataCacheStore> {
  const raw = await getStorageItem(BOOKMARKS_METADATA_KEY);
  if (!raw) {
    return cloneDefaultStore();
  }

  try {
    const parsed = JSON.parse(raw);
    const migratedStore = migrateParsedCache(parsed);

    if (raw !== JSON.stringify(migratedStore)) {
      await writeBookmarksMetadataStore(migratedStore);
    }

    return migratedStore;
  } catch {
    return cloneDefaultStore();
  }
}

async function writeBookmarksMetadataStore(store: BookmarkMetadataCacheStore): Promise<void> {
  await setStorageItem(BOOKMARKS_METADATA_KEY, JSON.stringify(store));
}

function getEntries(store: BookmarkMetadataCacheStore): bookmarkMetadata[] {
  return Object.values(store.byId);
}

function upsertEntry(store: BookmarkMetadataCacheStore, entry: bookmarkMetadata): void {
  const normalized = normalizeBookmarkMetadata(entry);
  const key = String(normalized.id);
  const previous = store.byId[key];

  if (previous?.url && previous.url !== normalized.url) {
    delete store.idsByUrl[previous.url];
  }
  if (previous?.bookmarkId && previous.bookmarkId !== normalized.bookmarkId) {
    delete store.idsByBookmarkId[previous.bookmarkId];
  }

  store.byId[key] = normalized;

  if (normalized.url) {
    store.idsByUrl[normalized.url] = normalized.id;
  }
  if (normalized.bookmarkId) {
    store.idsByBookmarkId[normalized.bookmarkId] = normalized.id;
  }
}

function removeEntryById(store: BookmarkMetadataCacheStore, id: number): void {
  const key = String(id);
  const existing = store.byId[key];
  if (!existing) return;

  if (existing.url) {
    delete store.idsByUrl[existing.url];
  }
  if (existing.bookmarkId) {
    delete store.idsByBookmarkId[existing.bookmarkId];
  }

  delete store.byId[key];
}

export async function getBookmarksMetadata(): Promise<bookmarkMetadata[]> {
  const store = await readBookmarksMetadataStore();
  return getEntries(store);
}

export async function saveBookmarksMetadata(bookmarksMetadata: bookmarkMetadata[]) {
  const store = buildStore(bookmarksMetadata);
  return await writeBookmarksMetadataStore(store);
}

export async function clearBookmarksMetadata() {
  return await writeBookmarksMetadataStore(cloneDefaultStore());
}

export async function getBookmarkMetadataById(id: number): Promise<bookmarkMetadata | undefined> {
  const store = await readBookmarksMetadataStore();
  return store.byId[String(id)];
}

export async function getBookmarkMetadataByBookmarkId(bookmarkId: string): Promise<bookmarkMetadata | undefined> {
  const store = await readBookmarksMetadataStore();
  const id = store.idsByBookmarkId[bookmarkId];
  return typeof id === 'number' ? store.byId[String(id)] : undefined;
}

export async function getBookmarkMetadataByUrl(url: string): Promise<bookmarkMetadata | undefined> {
  const store = await readBookmarksMetadataStore();
  const id = store.idsByUrl[url];
  return typeof id === 'number' ? store.byId[String(id)] : undefined;
}

export async function saveBookmarkMetadata(bookmarkMetadata: bookmarkMetadata) {
  const store = await readBookmarksMetadataStore();
  upsertEntry(store, bookmarkMetadata);
  return await writeBookmarksMetadataStore(store);
}

export async function deleteBookmarkMetadata(id: string | undefined) {
  if (!id) {
    return;
  }

  const store = await readBookmarksMetadataStore();
  const metadataId = store.idsByBookmarkId[id];
  if (typeof metadataId === 'number') {
    removeEntryById(store, metadataId);
    await writeBookmarksMetadataStore(store);
  }
}

export async function saveLinksInCache(baseUrl: string) {
  try {
    const { apiKey } = await getConfig();
    const links = await getLinksFetch(baseUrl, apiKey);
    const linksResponse = links.response;

    const serverBookmarkMap = new Map<number, bookmarkMetadata>();
    linksResponse.forEach(link => serverBookmarkMap.set(link.id, link));

    const store = await readBookmarksMetadataStore();

    for (let link of linksResponse) {
      const existing = store.byId[String(link.id)];
      if (existing) {
        link = { ...existing, ...link };
        upsertEntry(store, link);
      } else {
        const newLocalBookmark = await createBookmarkInBrowser(link);
        link.bookmarkId = newLocalBookmark.id;
        upsertEntry(store, link);
      }
    }

    const cachedEntries = getEntries(store);
    for (const bookmarkToRemove of cachedEntries) {
      if (serverBookmarkMap.has(bookmarkToRemove.id)) {
        continue;
      }

      removeEntryById(store, bookmarkToRemove.id);
      if (bookmarkToRemove.bookmarkId != null) {
        await browser.bookmarks.remove(bookmarkToRemove.bookmarkId);
      }
    }

    await writeBookmarksMetadataStore(store);

  } catch {
  }
}

export async function createBookmarkInBrowser(bookmark: bookmarkMetadata): Promise<BookmarkTreeNode> {
  const { url, name } = bookmark;
  return await browser.bookmarks.create({ url, title: name });
}

const getCurrentBookmarks = async () => {
  return await browser.bookmarks.getTree();
};

export async function syncLocalBookmarks(baseUrl: string) {
  try {
    const { apiKey } = await getConfig();
    const [root] = await getCurrentBookmarks();
    const localBookmarks: bookmarkMetadata[] = [];
    if (!root.children) return;
    logBookmarks(root.children, localBookmarks);

    const store = await readBookmarksMetadataStore();
    const cachedBookmarksMap = new Map(Object.entries(store.idsByUrl).map(([url, id]) => [url, store.byId[String(id)]]).filter((entry): entry is [string, bookmarkMetadata] => Boolean(entry[1])));

    const createPromises = [];
    const updatePromises = [];
    const deletePromises = [];

    for (const localBookmark of localBookmarks) {
      const cachedBookmark = cachedBookmarksMap.get(localBookmark.url);
      if (!cachedBookmark) {
        createPromises.push(postLinkFetch(baseUrl, localBookmark, apiKey));
      } else if (cachedBookmark.name !== localBookmark.name) {
        updatePromises.push(updateLinkFetch(baseUrl, cachedBookmark.id, localBookmark, apiKey));
      }
      cachedBookmarksMap.delete(localBookmark.url);
    }

    for (const [, cachedBookmark] of cachedBookmarksMap) {
      deletePromises.push(deleteLinkFetch(baseUrl, cachedBookmark.id, apiKey));
    }

    await Promise.all([...createPromises, ...updatePromises, ...deletePromises]);
    await saveBookmarksMetadata(localBookmarks);
  } catch {
  }
}

function logBookmarks(bookmarks: BookmarkTreeNode[], accumulator: bookmarkMetadata[]) {
  for (const bookmark of bookmarks) {
    if (bookmark.url) {
      accumulator.push({
        id: parseInt(bookmark.id),
        collectionId: 0,
        name: bookmark.title,
        url: bookmark.url,
        description: '',
        collection: { id: 0, name: '', ownerId: 0 },
        tags: [],
        bookmarkId: bookmark.id,
      });
    } else if (bookmark.children) {
      logBookmarks(bookmark.children, accumulator);
    }
  }
}



