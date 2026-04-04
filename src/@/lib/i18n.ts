import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';

type TranslationResource = Record<string, unknown>;

type SupportedLocale =
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

const localeLoaders: Partial<Record<SupportedLocale, () => Promise<TranslationResource>>> = {
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

const localeLoadPromises = new Map<SupportedLocale, Promise<void>>();

function normalizeLocale(locale?: string | null): SupportedLocale {
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

async function ensureLocaleLoaded(locale?: string | null): Promise<SupportedLocale> {
    const normalized = normalizeLocale(locale);

    if (normalized === 'en' || i18n.hasResourceBundle(normalized, 'translation')) {
        return normalized;
    }

    let promise = localeLoadPromises.get(normalized);
    if (!promise) {
        const loader = localeLoaders[normalized];
        if (!loader) {
            return 'en';
        }

        promise = loader().then((translation) => {
            i18n.addResourceBundle(normalized, 'translation', translation, true, true);
        }).finally(() => {
            localeLoadPromises.delete(normalized);
        });

        localeLoadPromises.set(normalized, promise);
    }

    await promise;
    return normalized;
}

export async function setExtensionLanguage(locale?: string | null): Promise<SupportedLocale> {
    const normalized = await ensureLocaleLoaded(locale);
    if (i18n.language !== normalized) {
        await i18n.changeLanguage(normalized);
    }
    return normalized;
}

i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
        },
        lng: 'en',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['grabshark_locale'], (result) => {
        void setExtensionLanguage(result.grabshark_locale).catch(() => { });
    });

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.grabshark_locale) {
            void setExtensionLanguage(changes.grabshark_locale.newValue).catch(() => { });
        }
    });
}

export default i18n;
