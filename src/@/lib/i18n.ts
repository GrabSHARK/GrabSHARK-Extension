import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import { localeLoaders, normalizeLocale, type SupportedLocale } from './localeRegistry';

const localeLoadPromises = new Map<SupportedLocale, Promise<void>>();

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
