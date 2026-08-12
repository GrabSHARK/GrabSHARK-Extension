/**
 * Background tarafı için minik çevirmen.
 *
 * `src/@/lib/i18n.ts` `react-i18next` çekiyor; onu service worker bundle'ına
 * sokmanın anlamı yok — burada ihtiyaç duyulan tek şey context menü
 * başlıkları için düz bir anahtar→metin araması. Locale listesi paylaşımlı
 * `localeRegistry`'den geliyor, yani yeni bir dil eklerken tek yer güncellenir.
 *
 * `en` statik import: menüler `onInstalled` anında kuruluyor ve o an bir
 * await'e takılmak menünün hiç görünmemesi demek olurdu. Seçili dil yüklenene
 * kadar İngilizce başlıkla açılır, yüklenince menü yeniden kurulur.
 */

import en from '../../@/locales/en.json';
import { getBrowser } from '../../@/lib/utils';
import {
    localeLoaders,
    normalizeLocale,
    type SupportedLocale,
    type TranslationResource,
} from '../../@/lib/localeRegistry';

const browser = getBrowser();

const EN_BUNDLE = en as TranslationResource;

let activeLocale: SupportedLocale = 'en';
let activeBundle: TranslationResource = EN_BUNDLE;

/** "contextMenu.saveLink" → iç içe objede gezinir. Bulamazsa undefined. */
function lookup(bundle: TranslationResource, key: string): string | undefined {
    let node: unknown = bundle;
    for (const part of key.split('.')) {
        if (typeof node !== 'object' || node === null) return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === 'string' ? node : undefined;
}

/**
 * Seçili dilde metni döner; anahtar o dilde yoksa İngilizceye, o da yoksa
 * `fallback`'e düşer. Menü başlığı asla boş kalmaz.
 */
export function t(key: string, fallback: string): string {
    return lookup(activeBundle, key) ?? lookup(EN_BUNDLE, key) ?? fallback;
}

/**
 * Storage'daki `grabshark_locale`'i yükler. Dil gerçekten değiştiyse `true`
 * döner — çağıran buna bakıp menüyü yeniden kurar.
 */
export async function loadBackgroundLocale(locale?: string | null): Promise<boolean> {
    const normalized = normalizeLocale(locale);
    if (normalized === activeLocale) return false;

    if (normalized === 'en') {
        activeLocale = 'en';
        activeBundle = EN_BUNDLE;
        return true;
    }

    const loader = localeLoaders[normalized];
    if (!loader) return false;

    try {
        activeBundle = await loader();
        activeLocale = normalized;
        return true;
    } catch {
        // Yüklenemedi: İngilizce başlıklarla devam, menü yine de çalışır.
        return false;
    }
}

/** Storage'dan mevcut dili okur (i18n.ts ile aynı anahtar). */
export async function readStoredLocale(): Promise<string | null> {
    try {
        const result = await browser.storage.local.get(['grabshark_locale']);
        return result?.grabshark_locale ?? null;
    } catch {
        return null;
    }
}
