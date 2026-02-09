import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { EmbeddedApp } from '../EmbeddedApp';
import { getStorageItem } from '../../../@/lib/utils';
import embeddedStyles from '../embedded.css?inline';

// Global reference for the embedded root
let embeddedRoot: Root | null = null;
let embeddedHost: HTMLElement | null = null;

export async function toggleEmbeddedMenu() {
    // Only show popup in top frame, not in iframes (video players, game embeds, etc.)
    if (window.self !== window.top) {

        return;
    }

    if (embeddedRoot) {
        // If already open, trigger smooth close animation via event
        // The component will handle the animation and then call the onClose callback to unmount
        window.dispatchEvent(new CustomEvent('spark-toggle-close'));
        return;
    }

    // Create host element
    embeddedHost = document.createElement('div');
    embeddedHost.id = 'spark-embedded-host';
    embeddedHost.style.position = 'absolute';
    embeddedHost.style.top = '0';
    embeddedHost.style.left = '0';
    embeddedHost.style.width = '0';
    embeddedHost.style.height = '0';
    embeddedHost.style.zIndex = '2147483647'; // Max z-index

    // Stop event propagation to prevent Smart Capture overlay from tracking mouse over this menu
    // Also stop keyboard events to prevent host page shortcuts (e.g., YouTube 'c' for captions, 'k' for play/pause)
    ['mousedown', 'mouseup', 'mousemove', 'pointerdown', 'pointerup', 'pointermove', 'keydown', 'keyup', 'keypress'].forEach(eventType => {
        embeddedHost!.addEventListener(eventType, (e) => {
            e.stopPropagation();
        });
    });

    document.body.appendChild(embeddedHost);

    // Create Shadow DOM
    const shadow = embeddedHost.attachShadow({ mode: 'open' });

    // CSS Isolation Reset - MUST be added BEFORE stylesheet to prevent host page style leakage
    // This is inline because Tailwind's purge process strips :host selectors from the build
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

    // Inject styles (Inline) to avoid 404s and race conditions
    const style = document.createElement('style');
    style.textContent = embeddedStyles;
    shadow.appendChild(style);

    // No need to wait for load since it's inline
    const styleLoaded = Promise.resolve();

    // Create mount point
    const mountPoint = document.createElement('div');
    // Set base font-size for rem calculations - rem is always relative to document root (html),
    // so sites like YouTube with 10px root font-size break Tailwind spacing.
    // This doesn't actually fix rem, but establishes a base for em units.
    mountPoint.style.fontSize = '16px';
    shadow.appendChild(mountPoint);

    // Fetch theme AND cached user prefs AND wait for CSS before rendering
    const themePromise = getStorageItem('vite-ui-theme');
    const userPrefsPromise = getStorageItem('cached_user_prefs');

    // Wait for all to be ready
    const [_, storedTheme, cachedUserPrefs] = await Promise.all([styleLoaded, themePromise, userPrefsPromise]);

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
