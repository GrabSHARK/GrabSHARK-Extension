/**
 * Sağ tık (context menu) menajeri.
 *
 * Menü 2026-08-11'de yeniden açıldı. Kapatılmadan önceki hâli 7 bağlam
 * tanımlıyor ama hepsinde `tab.url`'i kaydediyordu — yani bir bağlantıya sağ
 * tıklamak o bağlantıyı değil bulunduğun sayfayı arşivliyordu. Bu sürümün
 * kuralı: **her bağlam kendi payload'ıyla çalışır** (`info.linkUrl`,
 * `info.srcUrl`, `info.selectionText`).
 *
 * Menü öğeleri arka planda kuruluyor, dolayısıyla başlıklar React i18n'inden
 * değil `backgroundI18n`'den geliyor (service worker'a `react-i18next`
 * sokmamak için). Dil değişince menü yeniden kuruluyor.
 */

import { getBrowser } from '../../../@/lib/utils';
import { getConfig, isConfigured } from '../../../@/lib/config';
import { postLinkFetch, readDuplicateConflict } from '../../../@/lib/actions/links';
import { addUrl } from '../../../@/lib/linkUrlIndex';
import { MediaManager } from './MediaManager';
import { PENDING_DUPLICATE_KEY } from '../../../@/lib/runtime/messages';
import { loadBackgroundLocale, readStoredLocale, t } from '../backgroundI18n';

const browser = getBrowser();

const MENU_IDS = {
    savePage: 'grabshark-save-page',
    smartCapture: 'grabshark-smart-capture',
    saveLink: 'grabshark-save-link',
    saveImage: 'grabshark-save-image',
    highlightSelection: 'grabshark-highlight-selection',
} as const;

/**
 * Tıklama künyesinin ve sekmenin bize lazım olan alanları.
 *
 * Vendor tipleri bilerek kullanılmıyor: `chrome.contextMenus.OnClickData` ile
 * `browser.contextMenus.OnClickData` aynı alanları farklı tiplerle veriyor
 * (`mediaType` birinde union, diğerinde düz `string`) ve `getBrowser()`
 * ikisinden birini döndürebildiği için tsc ikisinin kesişimini arıyor —
 * hiçbir vendor tipi bu kesişimi karşılamıyor. Yapısal tip ikisiyle de
 * uyumlu. `linkText` de aynı sebeple yok: Firefox veriyor, Chromium vermiyor.
 * (EXT-4 ailesinden.)
 */
interface ContextClickInfo {
    menuItemId: string | number;
    linkUrl?: string;
    srcUrl?: string;
    selectionText?: string;
}

interface ContextTab {
    id?: number;
    url?: string;
    title?: string;
}

/** `/api/v1/collections` cevabından okuduğumuz alanlar — tamamı değil. */
interface CollectionSummary {
    id: number;
    name: string;
    ownerId: number;
    isDefault?: boolean;
}

/** `bookmarkFormValues.collection` ile aynı şekil. */
type LinkCollection = { id?: number; ownerId?: number; name: string };

export interface ContextManagerDeps {
    /** `index.ts`'teki enjeksiyon/retry mantığını taşıyan Smart Capture tetikleyicisi. */
    toggleSmartCapture: (tabId: number, url?: string) => Promise<void>;
}

export class ContextManager {
    constructor(private readonly deps: ContextManagerDeps) {
        this.init();
    }

    private init() {
        if (!browser.contextMenus) return;

        // Parametreleri `unknown` alıp içeride daraltıyoruz: iki vendor
        // imzasının kesişimine uyan tek yol bu.
        browser.contextMenus.onClicked.addListener((info: unknown, tab?: unknown) => {
            void this.onClicked(info as ContextClickInfo, tab as ContextTab | undefined);
        });

        // Menüler kurulumda bir kez kurulur; MV3'te service worker ölse de
        // kayıtlı kalırlar. `onStartup` da tetikliyoruz çünkü profil açılışında
        // dil değişmiş olabilir ve başlıklar bayat kalır.
        browser.runtime.onInstalled.addListener(() => { void this.rebuildMenus(); });
        browser.runtime.onStartup?.addListener(() => { void this.rebuildMenus(); });

        // Kullanıcı dili değiştirdiğinde başlıklar da değişsin.
        browser.storage.onChanged.addListener((changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && changes.grabshark_locale) {
                void this.rebuildMenus();
            }
        });
    }

    // ---------------------------------------------------------------- menü kurulumu

    /**
     * `removeAll` iki tarayıcıda iki ayrı sözleşmeye sahip: Chromium callback
     * bekler, Firefox promise döner. İkisini de kabul ediyoruz; hiçbiri
     * cevaplamazsa kısa bir zaman aşımıyla devam ediyoruz ki menü hiç
     * kurulmadan takılı kalmasın.
     */
    private removeAllMenus(): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const done = () => { if (!settled) { settled = true; resolve(); } };
            try {
                const removeAll = browser.contextMenus.removeAll as
                    (callback?: () => void) => Promise<void> | void;
                const maybePromise = removeAll(done);
                if (maybePromise && typeof maybePromise.then === 'function') {
                    maybePromise.then(done, done);
                }
            } catch {
                done();
            }
            setTimeout(done, 500);
        });
    }

    private create(id: string, title: string, contexts: chrome.contextMenus.ContextType[]) {
        try {
            browser.contextMenus.create({ id, title, contexts }, () => {
                // Aynı id ile ikinci kez yaratmak hata verir; `removeAll`
                // sonrası olmamalı ama olursa menünün geri kalanını düşürmesin.
                void browser.runtime.lastError;
            });
        } catch {
            /* tek bir öğe kurulamazsa diğerleri yine kurulsun */
        }
    }

    private async rebuildMenus(): Promise<void> {
        if (!browser.contextMenus) return;

        await loadBackgroundLocale(await readStoredLocale());
        await this.removeAllMenus();

        this.create(MENU_IDS.saveLink, t('contextMenu.saveLink', 'Save link to GrabSHARK'), ['link']);
        this.create(MENU_IDS.saveImage, t('contextMenu.saveImage', 'Save image to GrabSHARK'), ['image']);
        this.create(MENU_IDS.highlightSelection, t('contextMenu.highlightSelection', 'Highlight with GrabSHARK'), ['selection']);
        this.create(MENU_IDS.savePage, t('contextMenu.savePage', 'Save this page to GrabSHARK'), ['page']);
        this.create(MENU_IDS.smartCapture, t('contextMenu.smartCapture', 'Smart Capture'), ['page']);
    }

    // ---------------------------------------------------------------- tıklama

    private async onClicked(info: ContextClickInfo, tab?: ContextTab): Promise<void> {
        const menuItemId = String(info.menuItemId);
        if (!(Object.values(MENU_IDS) as string[]).includes(menuItemId)) return;

        if (!(await isConfigured())) {
            await this.toast(tab, t('contextMenu.notConfigured', 'Sign in to GrabSHARK first'), 'error');
            return;
        }

        switch (menuItemId) {
            case MENU_IDS.saveLink:
                // Tıklanan bağlantının kendisi — bulunduğumuz sayfa değil.
                await this.saveUrl(tab, info.linkUrl, info.selectionText || info.linkUrl);
                return;

            case MENU_IDS.saveImage:
                await this.saveImage(tab, info.srcUrl);
                return;

            case MENU_IDS.highlightSelection:
                if (tab?.id) {
                    try {
                        await browser.tabs.sendMessage(tab.id, { type: 'SHOW_HIGHLIGHT_TOOLBOX' });
                    } catch {
                        await this.toast(tab, t('contextMenu.notAvailableHere', 'GrabSHARK cannot run on this page'), 'error');
                    }
                }
                return;

            case MENU_IDS.savePage:
                await this.saveUrl(tab, tab?.url, tab?.title, true);
                return;

            case MENU_IDS.smartCapture:
                if (tab?.id) await this.deps.toggleSmartCapture(tab.id, tab.url);
                return;
        }
    }

    // ---------------------------------------------------------------- aksiyonlar

    private async saveUrl(
        tab: ContextTab | undefined,
        url: string | undefined,
        title: string | undefined,
        isCurrentPage = false
    ): Promise<void> {
        if (!url || !this.isSavableUrl(url)) {
            await this.toast(tab, t('contextMenu.invalidUrl', 'That is not a savable link'), 'error');
            return;
        }

        const config = await getConfig();

        try {
            const response = await postLinkFetch(
                config.baseUrl,
                {
                    url,
                    name: title || url,
                    description: '',
                    collection: await this.resolveDefaultCollection(config),
                    tags: [],
                },
                config.apiKey
            );

            // 409: link oluşmadı, kullanıcı "yeni versiyon mu, mevcudu aç mı"
            // kararını verecek. Panel bu kararı zaten soruyor — ama panel
            // BULUNDUĞUN sayfaya bağlı, o yüzden yalnızca sayfa kaydında
            // devreye sokuyoruz. Başka bir URL için dialog açmak yanlış
            // sayfanın künyesini gösterirdi.
            const duplicate = await readDuplicateConflict(response);
            if (duplicate) {
                if (isCurrentPage) {
                    await this.openDuplicateDialog(tab, url, duplicate.conflict);
                } else {
                    await this.toast(tab, t('contextMenu.alreadySaved', 'Already in your archive'), 'success');
                }
                return;
            }

            if (!response.ok) {
                await this.toast(tab, t('contextMenu.saveFailed', 'Could not save to GrabSHARK'), 'error');
                return;
            }

            const body = await response.json();
            const link = body?.response;
            if (link?.url && link?.id) {
                void addUrl(link.url, link.id).catch(() => { });
            }

            if (isCurrentPage) await this.markTabSaved(tab);
            await this.toast(tab, t('contextMenu.saved', 'Saved to GrabSHARK'), 'success');
        } catch {
            await this.toast(tab, t('contextMenu.saveFailed', 'Could not save to GrabSHARK'), 'error');
        }
    }

    private async saveImage(tab: ContextTab | undefined, srcUrl: string | undefined): Promise<void> {
        if (!srcUrl) {
            await this.toast(tab, t('contextMenu.invalidImage', 'No image to save here'), 'error');
            return;
        }

        const config = await getConfig();
        const result = await MediaManager.saveImage(
            { baseUrl: config.baseUrl, apiKey: config.apiKey },
            { url: srcUrl, title: tab?.title, pageContext: tab?.url, description: '' }
        );

        await this.toast(
            tab,
            result?.success
                ? t('contextMenu.imageSaved', 'Image saved to GrabSHARK')
                : t('contextMenu.saveFailed', 'Could not save to GrabSHARK'),
            result?.success ? 'success' : 'error'
        );
    }

    // ---------------------------------------------------------------- yardımcılar

    /**
     * `javascript:` ve `data:` gibi şemalar arşivlenemez; `chrome://` ve
     * `about:` sayfalarına da erişemeyiz. Sunucu bunları zaten reddediyor
     * (ana repo `isSafeLinkUrl`), burada kullanıcıya anında cevap vermek için
     * eleniyorlar.
     */
    private isSavableUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    }

    private async resolveDefaultCollection(
        config: { baseUrl: string; apiKey: string; defaultCollection: string }
    ): Promise<LinkCollection> {
        try {
            const response = await fetch(`${config.baseUrl}/api/v1/collections`, {
                headers: { Authorization: `Bearer ${config.apiKey}` },
            });
            if (response.ok) {
                const data = await response.json();
                const collections = data.response || [];
                const match = collections.find((c: CollectionSummary) => c.isDefault === true)
                    || collections.find((c: CollectionSummary) => c.name === config.defaultCollection);
                if (match) return { name: match.name, id: match.id, ownerId: match.ownerId };
            }
        } catch {
            /* isimle devam */
        }
        return { name: config.defaultCollection };
    }

    /**
     * 409 künyesini storage'a bırakıp paneli açar. Panel kapalıysa mount
     * anında okuyor, açıksa `storage.onChanged` ile yakalıyor — iki durum da
     * tek mekanizmayla karşılanıyor ve service worker ölse bile kayıt duruyor.
     */
    private async openDuplicateDialog(tab: ContextTab | undefined, url: string, conflict: unknown): Promise<void> {
        try {
            await browser.storage.local.set({ [PENDING_DUPLICATE_KEY]: { url, conflict } });
        } catch {
            /* storage yazılamazsa hiç değilse paneli açalım */
        }

        if (!tab?.id) return;
        try {
            await browser.tabs.sendMessage(tab.id, { type: 'OPEN_EMBEDDED_MENU' });
        } catch {
            await this.toast(tab, t('contextMenu.alreadySaved', 'Already in your archive'), 'success');
        }
    }

    private async markTabSaved(tab: ContextTab | undefined): Promise<void> {
        if (!tab?.id) return;
        const action = browser.action || browser.browserAction;
        if (!action) return;
        try {
            await action.setBadgeText({ tabId: tab.id, text: '✓' });
            await action.setBadgeBackgroundColor({ tabId: tab.id, color: '#2c46f1' });
        } catch {
            /* rozet kozmetik */
        }
    }

    /** Content script'e küçük bir bildirim. Sayfaya erişemiyorsak sessizce geçer. */
    private async toast(tab: ContextTab | undefined, message: string, type: 'success' | 'error'): Promise<void> {
        if (!tab?.id) return;
        try {
            await browser.tabs.sendMessage(tab.id, { type: 'SHOW_TOAST', data: { message, type } });
        } catch {
            /* content script yoksa (chrome://, mağaza sayfaları) bildirim de yok */
        }
    }
}
