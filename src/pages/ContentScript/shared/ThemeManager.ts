/**
 * ThemeManager - Centralized theme detection & management for all UI components
 * 
 * Provides:
 * - Extension theme preference reading (vite-ui-theme storage)
 * - Dark mode detection (data-theme, classes, background color, system preference)
 * - Color luminance calculation
 * - Theme change listeners
 * 
 * Used by: CaptureActionBar, HighlightToolbox, NotePanel, FeedbackIndicator
 */

type ThemeChangeCallback = (isDark: boolean) => void;

export class ThemeManager {
    private static listeners: Set<ThemeChangeCallback> = new Set();
    private static mediaQuery: MediaQueryList | null = null;
    private static observer: MutationObserver | null = null;
    private static lastKnownTheme: boolean | null = null;
    private static cachedExtensionTheme: 'dark' | 'light' | 'system' | 'website' | null = null;

    /**
     * Initialize extension theme preference from storage
     * Should be called once at startup
     */
    public static async initExtensionTheme(): Promise<void> {
        try {
            const result = await chrome.storage.local.get('vite-ui-theme');
            const stored = result['vite-ui-theme'];
            if (stored && ['dark', 'light', 'system', 'website'].includes(stored)) {
                ThemeManager.cachedExtensionTheme = stored as 'dark' | 'light' | 'system' | 'website';
            }
        } catch (e) {
            // Ignore errors - fallback to page detection
        }

        // Listen for storage changes
        try {
            chrome.storage.onChanged.addListener(ThemeManager.storageChangeHandler);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Named handler for storage changes (allows cleanup)
     */
    private static storageChangeHandler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string): void => {
        if (area === 'local' && changes['vite-ui-theme']) {
            const newValue = changes['vite-ui-theme'].newValue;
            if (newValue && ['dark', 'light', 'system', 'website'].includes(newValue)) {
                ThemeManager.cachedExtensionTheme = newValue;
                ThemeManager.handleThemeChange();
            }
        }
    };

    /**
     * Cleanup storage listener (call on page unload)
     */
    public static cleanup(): void {
        try {
            chrome.storage.onChanged.removeListener(ThemeManager.storageChangeHandler);
        } catch (e) {
            // Ignore
        }
    }

    /**
     * Get extension theme preference synchronously (from cache)
     */
    public static getExtensionTheme(): 'dark' | 'light' | 'system' | 'website' | null {
        return ThemeManager.cachedExtensionTheme;
    }

    /**
     * Detect if the page is in dark mode
     * Priority: Extension preference > data-theme > class names > background color > system preference
     */
    public static isDarkMode(): boolean {
        // 1. Check extension preference FIRST
        const extTheme = ThemeManager.cachedExtensionTheme;
        if (extTheme === 'dark') {
            return true;
        }
        if (extTheme === 'light') {
            return false;
        }
        // 'system' or 'website' or null - fall through to page/system detection

        // 2. Check data-theme attribute on html or body (common in DaisyUI/Tailwind)
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        const bodyTheme = document.body?.getAttribute('data-theme');

        if (htmlTheme === 'dark' || bodyTheme === 'dark') {
            return true;
        }
        if (htmlTheme === 'light' || bodyTheme === 'light') {
            return false;
        }

        // 2.5. Check meta color-scheme (used by SPARK Monoliths)
        const metaTheme = document.querySelector('meta[name="color-scheme"]')?.getAttribute('content');
        if (metaTheme === 'dark') {
            return true;
        }
        if (metaTheme === 'light') {
            return false;
        }

        // 3. Check for common dark mode class names
        const darkClasses = ['dark', 'dark-mode', 'theme-dark', 'is-dark', 'night-mode'];
        for (const cls of darkClasses) {
            if (document.body?.classList.contains(cls) ||
                document.documentElement.classList.contains(cls)) {
                return true;
            }
        }

        // 4. Check for light mode class names
        const lightClasses = ['light', 'light-mode', 'theme-light', 'is-light', 'day-mode'];
        for (const cls of lightClasses) {
            if (document.body?.classList.contains(cls) ||
                document.documentElement.classList.contains(cls)) {
                return false;
            }
        }

        // 5. Analyze page background color luminance
        try {
            const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
            let luminance = ThemeManager.getColorLuminance(bodyBgColor);

            if (luminance === null || luminance === 0) {
                const htmlBgColor = window.getComputedStyle(document.documentElement).backgroundColor;
                const htmlLuminance = ThemeManager.getColorLuminance(htmlBgColor);
                if (htmlLuminance !== null && htmlLuminance > 0) {
                    luminance = htmlLuminance;
                }
            }

            if (luminance !== null && luminance > 0) {
                return luminance < 0.5;
            } else if (luminance === null) {
                return false;
            }
        } catch (e) {
            // Ignore errors
        }

        // 6. Fallback to system preference
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }

    /**
     * Calculate relative luminance of a color (0 = black, 1 = white)
     * Uses sRGB formula
     * Returns null for transparent colors
     */
    public static getColorLuminance(color: string): number | null {
        // Check for transparent
        if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return null;

        // Parse rgb/rgba color
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return null;

        // Check alpha - if fully transparent, return null
        const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
        if (alpha === 0) return null;

        const r = parseInt(match[1]) / 255;
        const g = parseInt(match[2]) / 255;
        const b = parseInt(match[3]) / 255;

        // Calculate relative luminance using sRGB formula
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /**
     * Subscribe to theme changes
     * @returns Unsubscribe function
     */
    public static onThemeChange(callback: ThemeChangeCallback): () => void {
        ThemeManager.listeners.add(callback);
        ThemeManager.ensureListenersSetup();

        return () => {
            ThemeManager.listeners.delete(callback);
            if (ThemeManager.listeners.size === 0) {
                ThemeManager.cleanupListeners();
            }
        };
    }

    /**
     * Setup theme change listeners (system preference + DOM mutations)
     */
    private static ensureListenersSetup(): void {
        if (ThemeManager.mediaQuery || ThemeManager.observer) return;

        // Store initial theme
        ThemeManager.lastKnownTheme = ThemeManager.isDarkMode();

        // Listen to system preference changes
        ThemeManager.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        ThemeManager.mediaQuery.addEventListener('change', ThemeManager.handleThemeChange);

        // Observe DOM for class/attribute changes
        ThemeManager.observer = new MutationObserver(ThemeManager.handleThemeChange);
        ThemeManager.observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class', 'data-theme']
        });
        if (document.body) {
            ThemeManager.observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'data-theme']
            });
        }
    }

    /**
     * Handle theme change (debounced check)
     */
    private static handleThemeChange = (): void => {
        const currentTheme = ThemeManager.isDarkMode();
        if (currentTheme !== ThemeManager.lastKnownTheme) {
            ThemeManager.lastKnownTheme = currentTheme;
            ThemeManager.listeners.forEach(callback => {
                try {
                    callback(currentTheme);
                } catch (e) {
                    console.error('[ThemeManager] Callback error:', e);
                }
            });
        }
    };

    /**
     * Cleanup listeners when no subscribers
     */
    private static cleanupListeners(): void {
        if (ThemeManager.mediaQuery) {
            ThemeManager.mediaQuery.removeEventListener('change', ThemeManager.handleThemeChange);
            ThemeManager.mediaQuery = null;
        }
        if (ThemeManager.observer) {
            ThemeManager.observer.disconnect();
            ThemeManager.observer = null;
        }
        ThemeManager.lastKnownTheme = null;
    }
}
