import type { ToastLabels } from './types';

const DEFAULT_LABELS: ToastLabels = {
    edit: 'Edit',
    show: 'Open in GrabSHARK',
    justNow: 'Just now',
    unorganized: 'Unorganized',
    more: 'more',
};

const TOAST_LABELS_BY_LOCALE: Record<string, ToastLabels> = {
    en: DEFAULT_LABELS,
    tr: {
        edit: 'Düzenle',
        show: "GrabSHARK'ta Aç",
        justNow: 'Az önce',
        unorganized: 'Düzenlenmemiş',
        more: 'daha fazla',
    },
    de: {
        edit: 'Bearbeiten',
        show: 'In GrabSHARK öffnen',
        justNow: 'Gerade eben',
        unorganized: 'Unorganisiert',
        more: 'mehr',
    },
    es: {
        edit: 'Editar',
        show: 'Abrir en GrabSHARK',
        justNow: 'Ahora mismo',
        unorganized: 'Sin organizar',
        more: 'más',
    },
    fr: {
        edit: 'Modifier',
        show: 'Ouvrir dans GrabSHARK',
        justNow: "À l'instant",
        unorganized: 'Non classé',
        more: 'plus',
    },
    it: {
        edit: 'Modifica',
        show: 'Apri in GrabSHARK',
        justNow: 'Proprio ora',
        unorganized: 'Non organizzato',
        more: 'altro',
    },
    ja: {
        edit: '編集',
        show: 'GrabSHARKで開く',
        justNow: 'たった今',
        unorganized: '未整理',
        more: 'さらに表示',
    },
    nl: {
        edit: 'Bewerken',
        show: 'Openen in GrabSHARK',
        justNow: 'Zojuist',
        unorganized: 'Niet georganiseerd',
        more: 'meer',
    },
    pl: {
        edit: 'Edytuj',
        show: 'Otwórz w GrabSHARK',
        justNow: 'Przed chwilą',
        unorganized: 'Nieuporządkowane',
        more: 'więcej',
    },
    'pt-BR': {
        edit: 'Editar',
        show: 'Abrir no GrabSHARK',
        justNow: 'Agora mesmo',
        unorganized: 'Não organizado',
        more: 'mais',
    },
    ro: {
        edit: 'Editează',
        show: 'Deschide în GrabSHARK',
        justNow: 'Chiar acum',
        unorganized: 'Neorganizat',
        more: 'mai mult',
    },
    ru: {
        edit: 'Редактировать',
        show: 'Открыть в GrabSHARK',
        justNow: 'Только что',
        unorganized: 'Неорганизовано',
        more: 'ещё',
    },
    uk: {
        edit: 'Редагувати',
        show: 'Відкрити в GrabSHARK',
        justNow: 'Щойно',
        unorganized: 'Неорганізовано',
        more: 'ще',
    },
    zh: {
        edit: '编辑',
        show: '在 GrabSHARK 中打开',
        justNow: '刚刚',
        unorganized: '未分类',
        more: '更多',
    },
    'zh-TW': {
        edit: '編輯',
        show: '在 GrabSHARK 中開啟',
        justNow: '剛剛',
        unorganized: '未分類',
        more: '更多',
    },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function normalizeLocale(locale?: string): string {
    if (!locale) return 'en';

    const lowered = locale.toLowerCase();

    if (lowered === 'pt-br') return 'pt-BR';
    if (lowered === 'zh-tw') return 'zh-TW';

    if (TOAST_LABELS_BY_LOCALE[locale]) return locale;

    const base = locale.split('-')[0];
    if (TOAST_LABELS_BY_LOCALE[base]) return base;

    return 'en';
}

async function getStoredLocale(): Promise<string> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return normalizeLocale(navigator.language);
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['grabshark_locale'], (result) => {
            const stored = typeof result.grabshark_locale === 'string' ? result.grabshark_locale : navigator.language;
            resolve(normalizeLocale(stored));
        });
    });
}

export async function getToastLabels(): Promise<{ locale: string; labels: ToastLabels }> {
    const locale = await getStoredLocale();

    return {
        locale,
        labels: TOAST_LABELS_BY_LOCALE[locale] ?? DEFAULT_LABELS,
    };
}

export function formatToastDate(value: string | undefined, locale: string, justNowLabel: string): string {
    if (!value) {
        return justNowLabel;
    }

    const formatterKey = normalizeLocale(locale);
    if (!formatterCache.has(formatterKey)) {
        formatterCache.set(
            formatterKey,
            new Intl.DateTimeFormat(formatterKey, {
                month: 'short',
                day: 'numeric',
            })
        );
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return justNowLabel;
    }

    return formatterCache.get(formatterKey)!.format(date);
}
