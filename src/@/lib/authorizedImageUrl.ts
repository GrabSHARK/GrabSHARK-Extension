import { getConfig } from './config.ts';

const MAX_CACHE_ENTRIES = 32;

interface AuthorizedImageCacheEntry {
  objectUrl: string;
  lastAccessedAt: number;
}

const objectUrlCache = new Map<string, AuthorizedImageCacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();
let cleanupBound = false;

function bindCleanup() {
  if (cleanupBound || typeof window === 'undefined') {
    return;
  }

  cleanupBound = true;
  window.addEventListener('beforeunload', () => {
    clearAuthorizedImageUrlCache();
  }, { once: true });
}

function touchEntry(url: string): string | null {
  const entry = objectUrlCache.get(url);
  if (!entry) {
    return null;
  }

  entry.lastAccessedAt = Date.now();
  return entry.objectUrl;
}

function evictOldestEntries() {
  while (objectUrlCache.size > MAX_CACHE_ENTRIES) {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [key, entry] of objectUrlCache.entries()) {
      if (entry.lastAccessedAt < oldestAccess) {
        oldestAccess = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (!oldestKey) {
      return;
    }

    const oldestEntry = objectUrlCache.get(oldestKey);
    if (oldestEntry) {
      URL.revokeObjectURL(oldestEntry.objectUrl);
    }
    objectUrlCache.delete(oldestKey);
  }
}

export async function fetchAuthorizedImageUrl(url: string): Promise<string> {
  bindCleanup();

  const cached = touchEntry(url);
  if (cached) {
    return cached;
  }

  const existingRequest = inFlightRequests.get(url);
  if (existingRequest) {
    return existingRequest;
  }

  const requestPromise = (async () => {
    const config = await getConfig();
    const headers: HeadersInit = {};

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(url, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    objectUrlCache.set(url, {
      objectUrl,
      lastAccessedAt: Date.now(),
    });
    evictOldestEntries();

    return objectUrl;
  })();

  inFlightRequests.set(url, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(url);
  }
}

export function clearAuthorizedImageUrlCache(): void {
  for (const entry of objectUrlCache.values()) {
    URL.revokeObjectURL(entry.objectUrl);
  }
  objectUrlCache.clear();
  inFlightRequests.clear();
}
