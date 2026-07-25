const LINK_CACHE_PREFIX = 'lw_cache_';
const LINK_CACHE_TTL_MS = 1000 * 60 * 5;
const AI_TAG_PREF_PREFIX = 'link_ai_pref_';
const AI_TAG_PREF_TTL_MS = 1000 * 60 * 15;

interface LinkSessionEntry<T> {
  timestamp: number;
  link: T | null;
}

interface AiTagPreferenceEntry {
  timestamp: number;
  expectAi: boolean;
}

function readSessionEntry<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { timestamp?: number } & T;
    if (!parsed || typeof parsed.timestamp !== 'number') {
      sessionStorage.removeItem(key);
      return null;
    }

    if (Date.now() - parsed.timestamp > ttlMs) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // noop
    }
    return null;
  }
}

function writeSessionEntry<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // noop
  }
}

export function readLinkSessionCache<T>(url: string): T | null {
  const entry = readSessionEntry<LinkSessionEntry<T>>(LINK_CACHE_PREFIX + url, LINK_CACHE_TTL_MS);
  return entry?.link ?? null;
}

export function writeLinkSessionCache<T>(url: string, link: T | null): void {
  if (!link) {
    clearLinkSessionCache(url);
    return;
  }

  writeSessionEntry<LinkSessionEntry<T>>(LINK_CACHE_PREFIX + url, {
    timestamp: Date.now(),
    link,
  });
}

export function clearLinkSessionCache(url: string): void {
  try {
    sessionStorage.removeItem(LINK_CACHE_PREFIX + url);
  } catch {
    // noop
  }
}

export function readAiTagExpectation(linkId: number): boolean | null {
  const entry = readSessionEntry<AiTagPreferenceEntry>(AI_TAG_PREF_PREFIX + linkId, AI_TAG_PREF_TTL_MS);
  return typeof entry?.expectAi === 'boolean' ? entry.expectAi : null;
}

export function writeAiTagExpectation(linkId: number, expectAi: boolean): void {
  writeSessionEntry<AiTagPreferenceEntry>(AI_TAG_PREF_PREFIX + linkId, {
    timestamp: Date.now(),
    expectAi,
  });
}
