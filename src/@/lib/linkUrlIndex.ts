import { getBrowser } from './utils';

const STORAGE_KEY = 'grabshark_url_index';

interface LinkUrlIndex {
  version: 1;
  urls: Record<string, number>;
  lastSyncTime: string | null;
  lastFullSyncTime: string | null;
}

const EMPTY_INDEX: LinkUrlIndex = {
  version: 1,
  urls: {},
  lastSyncTime: null,
  lastFullSyncTime: null,
};

async function readIndex(): Promise<LinkUrlIndex> {
  const browser = getBrowser();
  const result = await browser.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as LinkUrlIndex) || { ...EMPTY_INDEX };
}

async function writeIndex(index: LinkUrlIndex): Promise<void> {
  const browser = getBrowser();
  await browser.storage.local.set({ [STORAGE_KEY]: index });
}

export async function hasUrl(url: string): Promise<boolean> {
  const index = await readIndex();
  return url in index.urls;
}

export async function addUrl(url: string, linkId: number): Promise<void> {
  const index = await readIndex();
  index.urls[url] = linkId;
  await writeIndex(index);
}

export async function removeUrl(url: string): Promise<void> {
  const index = await readIndex();
  delete index.urls[url];
  await writeIndex(index);
}

export async function applyDelta(
  urls: Record<string, number>,
  serverTime: string,
): Promise<void> {
  const index = await readIndex();
  for (const [url, id] of Object.entries(urls)) {
    index.urls[url] = id;
  }
  index.lastSyncTime = serverTime;
  await writeIndex(index);
}

export async function replaceAll(
  urls: Record<string, number>,
  serverTime: string,
): Promise<void> {
  const index: LinkUrlIndex = {
    version: 1,
    urls,
    lastSyncTime: serverTime,
    lastFullSyncTime: serverTime,
  };
  await writeIndex(index);
}

export async function getLastSyncTime(): Promise<string | null> {
  const index = await readIndex();
  return index.lastSyncTime;
}

export async function getLastFullSyncTime(): Promise<string | null> {
  const index = await readIndex();
  return index.lastFullSyncTime;
}

export async function removeUrlByLinkId(linkId: number): Promise<void> {
  const index = await readIndex();
  for (const [url, id] of Object.entries(index.urls)) {
    if (id === linkId) {
      delete index.urls[url];
      await writeIndex(index);
      return;
    }
  }
}

export async function clear(): Promise<void> {
  await writeIndex({ ...EMPTY_INDEX });
}
