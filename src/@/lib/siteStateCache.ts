import { getBrowser } from './utils';

// ─── URL Index ────────────────────────────────────────────────────────────────
// Existing checkmark/badge storage — unchanged behaviour.

const URL_INDEX_KEY = 'grabshark_url_index';

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
  const result = await browser.storage.local.get(URL_INDEX_KEY);
  return (result[URL_INDEX_KEY] as LinkUrlIndex) || { ...EMPTY_INDEX };
}

async function writeIndex(index: LinkUrlIndex): Promise<void> {
  const browser = getBrowser();
  await browser.storage.local.set({ [URL_INDEX_KEY]: index });
}

export async function hasUrl(url: string): Promise<boolean> {
  const index = await readIndex();
  if (url in index.urls) return true;
  const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
  return alt in index.urls;
}

/**
 * Return the linkId for a URL, or `null` if the URL is not in the local index.
 * Pure local lookup — no network request.
 * Tolerates trailing-slash differences (e.g. example.com vs example.com/).
 */
export async function getLinkIdByUrl(url: string): Promise<number | null> {
  const index = await readIndex();
  const exact = index.urls[url];
  if (exact !== undefined) return exact;

  // Fallback: try with/without trailing slash
  const alt = url.endsWith('/') ? url.slice(0, -1) : url + '/';
  return index.urls[alt] ?? null;
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

// ─── Domain Preferences Cache ────────────────────────────────────────────────
// Bulk-populated during full sync, write-through on SET_DOMAIN_PREFERENCE.
// Cache miss = no domain-specific override exists → use globalDefaults.

const DOMAIN_PREFS_KEY = 'grabshark_domain_prefs';

export interface CachedDomainPref {
  enableSmartCapture: boolean;
  enableSelectionMenu: boolean;
  isModified: boolean;
  globalDefaults: { enableSmartCapture: boolean; enableSelectionMenu: boolean } | null;
  cachedAt: number;
}

export interface GlobalDomainDefaults {
  enableSmartCapture: boolean;
  enableSelectionMenu: boolean;
}

interface DomainPrefsStore {
  prefs: Record<string, CachedDomainPref>;
  globalDefaults: GlobalDomainDefaults | null;
}

const EMPTY_PREFS_STORE: DomainPrefsStore = { prefs: {}, globalDefaults: null };

async function readDomainPrefs(): Promise<DomainPrefsStore> {
  const browser = getBrowser();
  const result = await browser.storage.local.get(DOMAIN_PREFS_KEY);
  return (result[DOMAIN_PREFS_KEY] as DomainPrefsStore) || { ...EMPTY_PREFS_STORE };
}

async function writeDomainPrefs(store: DomainPrefsStore): Promise<void> {
  const browser = getBrowser();
  await browser.storage.local.set({ [DOMAIN_PREFS_KEY]: store });
}

/**
 * Read a single domain's cached preference.
 * Returns `null` on cache miss (= no domain-specific override).
 */
export async function getCachedDomainPref(domain: string): Promise<CachedDomainPref | null> {
  const store = await readDomainPrefs();
  return store.prefs[domain] ?? null;
}

/**
 * Write (or overwrite) a domain's preference into the local cache.
 * Automatically stamps `cachedAt` with the current time.
 */
export async function setCachedDomainPref(
  domain: string,
  pref: Omit<CachedDomainPref, 'cachedAt'>,
): Promise<void> {
  const store = await readDomainPrefs();
  store.prefs[domain] = { ...pref, cachedAt: Date.now() };
  await writeDomainPrefs(store);
}

/** Get the cached global domain defaults (set during full sync). */
export async function getGlobalDomainDefaults(): Promise<GlobalDomainDefaults | null> {
  const store = await readDomainPrefs();
  return store.globalDefaults;
}

/** Set the global domain defaults (called during full sync). */
export async function setGlobalDomainDefaults(defaults: GlobalDomainDefaults): Promise<void> {
  const store = await readDomainPrefs();
  store.globalDefaults = defaults;
  await writeDomainPrefs(store);
}

/** Remove a single domain's cached preference (invalidation). */
export async function invalidateDomainPref(domain: string): Promise<void> {
  const store = await readDomainPrefs();
  delete store.prefs[domain];
  await writeDomainPrefs(store);
}

/** Wipe the entire domain preferences cache (used during full sync & config clear). */
export async function clearDomainPrefsCache(): Promise<void> {
  await writeDomainPrefs({ ...EMPTY_PREFS_STORE });
}
