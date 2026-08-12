import { getStorageItem } from '../../../@/lib/utils';
import embeddedStyles from '../embedded.css?inline';
import { loadEmbeddedAppModule } from '../utils/reactLoader';

let embeddedRoot: any = null;
let embeddedHost: HTMLElement | null = null;

export async function toggleEmbeddedMenu() {
    if (window.self !== window.top) {
        return;
    }

    if (embeddedRoot) {
        window.dispatchEvent(new CustomEvent('grabshark-toggle-close'));
        return;
    }

    await mountEmbeddedMenu();
}

/**
 * Paneli açar ve açık olanı açık bırakır — `toggleEmbeddedMenu`'nun aksine
 * kapatmaz. Context menü'den gelen "bu sayfa zaten arşivde" akışı bunu
 * kullanıyor: orada niyet "aç", "aç/kapa" değil.
 */
export async function openEmbeddedMenu() {
    if (window.self !== window.top || embeddedRoot) {
        return;
    }

    await mountEmbeddedMenu();
}

async function mountEmbeddedMenu() {
    const { React, createRoot, EmbeddedApp } = await loadEmbeddedAppModule();

    embeddedHost = document.createElement('div');
    embeddedHost.id = 'grabshark-embedded-host';
    embeddedHost.style.position = 'absolute';
    embeddedHost.style.top = '0';
    embeddedHost.style.left = '0';
    embeddedHost.style.width = '0';
    embeddedHost.style.height = '0';
    embeddedHost.style.zIndex = '2147483647';

    ['mousedown', 'mouseup', 'mousemove', 'pointerdown', 'pointerup', 'pointermove', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
        embeddedHost!.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });

    document.body.appendChild(embeddedHost);

    const shadow = embeddedHost.attachShadow({ mode: 'open' });

    const resetStyle = document.createElement('style');
    resetStyle.textContent = `
      :host {
        all: initial !important;
        display: block !important;
        font-size: 16px !important;
        line-height: 1.5 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      }
      :host *, :host *::before, :host *::after {
        box-sizing: border-box !important;
      }
    `;
    shadow.appendChild(resetStyle);

    const style = document.createElement('style');
    style.textContent = embeddedStyles;
    shadow.appendChild(style);

    const mountPoint = document.createElement('div');
    mountPoint.style.fontSize = '16px';
    shadow.appendChild(mountPoint);

    const themePromise = getStorageItem('vite-ui-theme');
    const userPrefsPromise = getStorageItem('cached_user_prefs');

    const [storedTheme, cachedUserPrefs] = await Promise.all([themePromise, userPrefsPromise]);

    embeddedRoot = createRoot(mountPoint);
    embeddedRoot.render(
        React.createElement(React.StrictMode, null,
            React.createElement(EmbeddedApp, {
                initialTheme: storedTheme,
                cachedUserTheme: cachedUserPrefs?.theme,
                onClose: () => {
                    if (embeddedRoot) {
                        embeddedRoot.unmount();
                        embeddedRoot = null;
                    }
                    if (embeddedHost) {
                        embeddedHost.remove();
                        embeddedHost = null;
                    }
                }
            })
        )
    );
}
