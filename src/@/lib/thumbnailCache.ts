/**
 * ThumbnailCache - IndexedDB wrapper for caching processed thumbnails
 * 
 * Features:
 * - LRU eviction with 200 item limit
 * - 7-day expiration policy
 * - Blob storage for efficient memory usage
 */

const DB_NAME = 'SPARKThumbnailCache';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';
const MAX_ITEMS = 200;
const EXPIRY_DAYS = 7;

interface ThumbnailEntry {
    url: string;           // Primary key
    thumbnailBlob: Blob;   // Processed image
    timestamp: number;     // For LRU + expiration
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB connection (singleton)
 */
function initDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {

            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });

    return dbPromise;
}

/**
 * Save thumbnail to cache with LRU eviction
 */
export async function saveThumbnail(url: string, blob: Blob): Promise<void> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        const entry: ThumbnailEntry = {
            url,
            thumbnailBlob: blob,
            timestamp: Date.now(),
        };

        store.put(entry);

        // Check count and evict if needed
        const countRequest = store.count();
        countRequest.onsuccess = () => {
            if (countRequest.result > MAX_ITEMS) {
                evictOldest(store, countRequest.result - MAX_ITEMS);
            }
        };

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (error) {

    }
}

/**
 * Get thumbnail from cache, updating LRU timestamp
 */
export async function getThumbnail(url: string): Promise<string | null> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.get(url);

            request.onsuccess = () => {
                const entry = request.result as ThumbnailEntry | undefined;

                if (!entry) {
                    resolve(null);
                    return;
                }

                // Check expiration
                const ageMs = Date.now() - entry.timestamp;
                const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

                if (ageMs > expiryMs) {
                    store.delete(url);
                    resolve(null);
                    return;
                }

                // Update timestamp for LRU
                entry.timestamp = Date.now();
                store.put(entry);

                // Convert blob to base64 for display
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result as string);
                };
                reader.onerror = () => {
                    resolve(null);
                };
                reader.readAsDataURL(entry.thumbnailBlob);
            };

            request.onerror = () => {
                resolve(null);
            };
        });
    } catch (error) {

        return null;
    }
}

/**
 * Evict oldest entries (LRU)
 */
function evictOldest(store: IDBObjectStore, count: number): void {
    const index = store.index('timestamp');
    const request = index.openCursor();
    let evicted = 0;

    request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && evicted < count) {
            cursor.delete();
            evicted++;
            cursor.continue();
        }
    };
}

/**
 * Clear all expired thumbnails (maintenance)
 */
export async function clearExpiredThumbnails(): Promise<void> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('timestamp');

        const expiryTime = Date.now() - (EXPIRY_DAYS * 24 * 60 * 60 * 1000);
        const range = IDBKeyRange.upperBound(expiryTime);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                cursor.delete();
                cursor.continue();
            }
        };
    } catch (error) {

    }
}

/**
 * Check if thumbnail exists in cache (without updating LRU)
 */
export async function hasThumbnail(url: string): Promise<boolean> {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);

        return new Promise((resolve) => {
            const request = store.get(url);
            request.onsuccess = () => {
                const entry = request.result as ThumbnailEntry | undefined;
                if (!entry) {
                    resolve(false);
                    return;
                }
                // Check expiration
                const ageMs = Date.now() - entry.timestamp;
                const expiryMs = EXPIRY_DAYS * 24 * 60 * 60 * 1000;
                resolve(ageMs <= expiryMs);
            };
            request.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}
