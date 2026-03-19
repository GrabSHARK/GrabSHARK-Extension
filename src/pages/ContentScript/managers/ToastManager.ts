import { loadReactModule } from '../utils/reactLoader';
import componentStyles from '../components.css?inline';
import type { ToastLinkData } from '../SaveNotificationToast';

// React types (actual imports are lazy-loaded)
type Root = import('react-dom/client').Root;

// Toast notification state
let toastHost: HTMLDivElement | null = null;
let toastShadow: ShadowRoot | null = null;
let toastRoot: Root | null = null;

// Queue to accumulate links across multiple save operations
let linkQueue: ToastLinkData[] = [];
let queueResetTimer: ReturnType<typeof setTimeout> | null = null;
let renderKey = 0; // Incremented on close to force fresh component instance

/**
 * Show save notification toast for background save operations
 * Accumulates links into a queue so multiple saves show in one toast
 * @param newLinks - Array of newly saved links to add to notification
 */
export async function showSaveNotification(newLinks: ToastLinkData[]): Promise<void> {
    if (newLinks.length === 0) {
        return;
    }

    // Clear any pending reset timer since we have new content
    if (queueResetTimer) {
        clearTimeout(queueResetTimer);
        queueResetTimer = null;
    }

    // Add new links to queue (avoid duplicates by ID)
    const existingIds = new Set(linkQueue.map(l => l.id));
    const uniqueNewLinks = newLinks.filter(l => !existingIds.has(l.id));
    linkQueue = [...linkQueue, ...uniqueNewLinks];

    // Track which links are newly added (for animation)
    const newLinkIds = uniqueNewLinks.map(l => l.id);

    // Lazy-load the React UI module
    const { createRoot, React, SaveNotificationToast } = await loadReactModule();

    // Create Shadow DOM host if not exists
    if (!toastHost) {
        toastHost = document.createElement('div');
        toastHost.id = 'ext-lw-toast-notification-host';
        toastHost.style.cssText = 'position: fixed; top: 0; right: 0; z-index: 2147483647; pointer-events: none;';
        document.body.appendChild(toastHost);

        toastShadow = toastHost.attachShadow({ mode: 'open' });

        // Inject keyframe animations inline (CSS file may not load in Shadow DOM)
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

        // Inject content script styles (Inline)
        const style = document.createElement('style');
        style.textContent = componentStyles;
        toastShadow.appendChild(style);

        // Create container for React
        const container = document.createElement('div');
        container.id = 'ext-lw-toast-container';
        container.style.pointerEvents = 'auto';
        toastShadow.appendChild(container);

        toastRoot = createRoot(container);
    }

    // Render the React component into Shadow DOM with accumulated queue
    // Use key prop to force fresh component instance after close
    if (toastRoot) {
        toastRoot.render(
            React.createElement(SaveNotificationToast, {
                key: renderKey,
                links: linkQueue,
                newLinkIds: newLinkIds,
                onClose: () => {
                    // Clear the queue and increment key for next render
                    linkQueue = [];
                    renderKey++;

                    // Unmount the component to fully reset state
                    if (toastRoot) {
                        toastRoot.render(null);
                    }
                }
            })
        );
    }
}
