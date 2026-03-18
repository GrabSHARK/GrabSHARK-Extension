import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '../locales/en.json';
import tr from '../locales/tr.json';
import de from '../locales/de.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import ptBR from '../locales/pt-BR.json';
import ro from '../locales/ro.json';
import ru from '../locales/ru.json';
import uk from '../locales/uk.json';
import zh from '../locales/zh.json';
import zhTW from '../locales/zh-TW.json';

// Initialize i18next
i18n
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            tr: { translation: tr },
            de: { translation: de },
            es: { translation: es },
            fr: { translation: fr },
            it: { translation: it },
            ja: { translation: ja },
            nl: { translation: nl },
            pl: { translation: pl },
            'pt-BR': { translation: ptBR },
            ro: { translation: ro },
            ru: { translation: ru },
            uk: { translation: uk },
            zh: { translation: zh },
            'zh-TW': { translation: zhTW },
        },
        lng: 'en', // Default language, will be updated from storage
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already safes from xss
        },
    });

// Load language from storage (guarded for page context where chrome.storage is unavailable)
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['grabshark_locale'], (result) => {
        if (result.grabshark_locale) {
            i18n.changeLanguage(result.grabshark_locale);
        }
    });

    // Listen for changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.grabshark_locale) {
            i18n.changeLanguage(changes.grabshark_locale.newValue);
        }
    });
}

export default i18n;
