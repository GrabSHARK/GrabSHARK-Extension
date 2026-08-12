/**
 * Locale kayıt defteri — TEK kaynak.
 *
 * Hem React tarafı (`i18n.ts`, i18next üzerinden) hem de background service
 * worker (`backgroundI18n.ts`, i18next'siz) buradan okur. Ayrı ayrı liste
 * tutsalardı yeni bir locale eklerken birini güncelleyip diğerini unutmak
 * kaçınılmazdı — EXT-7'nin tam olarak uyardığı tuzak.
 *
 * **Yeni locale eklerken:** JSON'u `src/@/locales/` altına koy, aşağıdaki
 * `localeLoaders`'a bir satır ekle, `grabshark-extension_i18n.txt`'yi
 * güncelle. Klasöre dosya bırakmak tek başına yetmez.
 */

export type SupportedLocale =
    | 'en'
    | 'tr'
    | 'de'
    | 'es'
    | 'fr'
    | 'it'
    | 'ja'
    | 'nl'
    | 'pl'
    | 'pt-BR'
    | 'ro'
    | 'ru'
    | 'uk'
    | 'zh'
    | 'zh-TW';

export type TranslationResource = Record<string, unknown>;

/** `en` burada yok: statik import ediliyor, lazy-load edilmiyor. */
export const localeLoaders: Partial<Record<SupportedLocale, () => Promise<TranslationResource>>> = {
    tr: async () => (await import('../locales/tr.json')).default,
    de: async () => (await import('../locales/de.json')).default,
    es: async () => (await import('../locales/es.json')).default,
    fr: async () => (await import('../locales/fr.json')).default,
    it: async () => (await import('../locales/it.json')).default,
    ja: async () => (await import('../locales/ja.json')).default,
    nl: async () => (await import('../locales/nl.json')).default,
    pl: async () => (await import('../locales/pl.json')).default,
    'pt-BR': async () => (await import('../locales/pt-BR.json')).default,
    ro: async () => (await import('../locales/ro.json')).default,
    ru: async () => (await import('../locales/ru.json')).default,
    uk: async () => (await import('../locales/uk.json')).default,
    zh: async () => (await import('../locales/zh.json')).default,
    'zh-TW': async () => (await import('../locales/zh-TW.json')).default,
};

/** Tarayıcıdan/storage'dan gelen serbest biçimli etiketi desteklenen bir locale'e indirger. */
export function normalizeLocale(locale?: string | null): SupportedLocale {
    if (!locale) return 'en';

    if (locale === 'pt-BR') return 'pt-BR';
    if (locale === 'zh-TW') return 'zh-TW';

    const lower = locale.toLowerCase();
    if (lower === 'pt-br' || lower.startsWith('pt-br-')) return 'pt-BR';
    if (lower === 'zh-tw' || lower.startsWith('zh-tw-')) return 'zh-TW';

    const base = lower.split('-')[0] as SupportedLocale;
    if (base in localeLoaders || base === 'en') return base;

    return 'en';
}
