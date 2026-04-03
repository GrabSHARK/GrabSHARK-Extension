import { loadSaveNotificationToastModule } from '../utils/reactLoader';
import componentStyles from '../components.css?inline';
import type { PreparedToastLink, ToastLinkData } from '../SaveNotificationToast';
import { getThumbnail } from '../../../@/lib/thumbnailCache';
import { formatToastDate, getToastLabels } from '../SaveNotificationToast/toastLocale';

let toastHost: HTMLDivElement | null = null;
let toastShadow: ShadowRoot | null = null;
let toastRoot: any = null;

let linkQueue: PreparedToastLink[] = [];
let queueResetTimer: ReturnType<typeof setTimeout> | null = null;
let renderKey = 0;

function getFaviconUrl(url: string): string {
    return url ? 'https://www.google.com/s2/favicons?sz=64&domain_url=' + url : '';
}

async function prepareToastLink(
    link: ToastLinkData,
    locale: string,
    labels: Awaited<ReturnType<typeof getToastLabels>>['labels']
): Promise<PreparedToastLink> {
    const thumbnailSrc = (await getThumbnail(link.url)) || getFaviconUrl(link.url);

    return {
        ...link,
        collectionLabel: link.collection?.name || labels.unorganized,
        formattedDate: formatToastDate(link.createdAt, locale, labels.justNow),
        thumbnailSrc,
        fallbackIconColor: link.collection?.color,
    };
}

export async function showSaveNotification(newLinks: ToastLinkData[]): Promise<void> {
    if (newLinks.length === 0) {
        return;
    }

    if (queueResetTimer) {
        clearTimeout(queueResetTimer);
        queueResetTimer = null;
    }

    const existingIds = new Set(linkQueue.map((l) => l.id));
    const uniqueNewLinks = newLinks.filter((l) => !existingIds.has(l.id));
    const { locale, labels } = await getToastLabels();
    const preparedUniqueLinks = await Promise.all(uniqueNewLinks.map((link) => prepareToastLink(link, locale, labels)));
    linkQueue = [...linkQueue, ...preparedUniqueLinks];

    const newLinkIds = preparedUniqueLinks.map((l) => l.id);

    const { React, createRoot, SaveNotificationToast } = await loadSaveNotificationToastModule();

    if (!toastHost) {
        toastHost = document.createElement('div');
        toastHost.id = 'ext-lw-toast-notification-host';
        toastHost.style.cssText = 'position: fixed; top: 0; right: 0; z-index: 2147483647; pointer-events: none;';
        document.body.appendChild(toastHost);

        toastShadow = toastHost.attachShadow({ mode: 'open' });

        const animationStyles = document.createElement('style');
        animationStyles.textContent = `
            @keyframes ext-lw-slide-in-right {
                from {
                    transform: translateX(120%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes ext-lw-expand-stack {
                from {
                    opacity: 0;
                    transform: translateY(-8px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @keyframes ext-lw-collapse-stack {
                from {
                    opacity: 1;
                    transform: translateY(0);
                }
                to {
                    opacity: 0;
                    transform: translateY(-8px);
                }
            }
        `;
        toastShadow.appendChild(animationStyles);

        const style = document.createElement('style');
        style.textContent = componentStyles;
        toastShadow.appendChild(style);

        const container = document.createElement('div');
        container.id = 'ext-lw-toast-container';
        container.style.pointerEvents = 'auto';
        toastShadow.appendChild(container);

        toastRoot = createRoot(container);
    }

    if (toastRoot) {
        toastRoot.render(
            React.createElement(SaveNotificationToast, {
                key: renderKey,
                links: linkQueue,
                labels,
                newLinkIds,
                onClose: () => {
                    linkQueue = [];
                    renderKey++;

                    if (toastRoot) {
                        toastRoot.render(null);
                    }
                }
            })
        );
    }
}
