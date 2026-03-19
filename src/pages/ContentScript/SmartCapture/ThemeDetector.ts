/**
 * ThemeDetector - Shared theme detection for Smart Capture components
 * This is an exact copy of HighlightToolbox.isDarkMode() logic to ensure consistency
 */
export class ThemeDetector {
    /**
     * Detect if the page is in dark mode
     * Checks: data-theme attribute, class names, background color analysis, system preference
     */
    public isDarkMode(): boolean {

        // Check data-theme attribute on html or body (common in DaisyUI/Tailwind)
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        const bodyTheme = document.body?.getAttribute('data-theme');

        if (htmlTheme === 'dark' || bodyTheme === 'dark') {
            return true;
        }
        if (htmlTheme === 'light' || bodyTheme === 'light') {
            return false;
        }

        // Check for common dark mode class names
        const darkClasses = ['dark', 'dark-mode', 'theme-dark', 'is-dark', 'night-mode'];
        for (const cls of darkClasses) {
            if (document.body?.classList.contains(cls) ||
                document.documentElement.classList.contains(cls)) {
                return true;
            }
        }

        // Check for light mode class names
        const lightClasses = ['light', 'light-mode', 'theme-light', 'is-light', 'day-mode'];
        for (const cls of lightClasses) {
            if (document.body?.classList.contains(cls) ||
                document.documentElement.classList.contains(cls)) {
                return false;
            }
        }

        // Analyze page background color luminance
        // Check both body and html, skip transparent colors
        try {
            // Try body first
            const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
            let luminance = this.getColorLuminance(bodyBgColor);

            // If body is transparent or black (possibly default), try html
            if (luminance === null || luminance === 0) {
                const htmlBgColor = window.getComputedStyle(document.documentElement).backgroundColor;
                const htmlLuminance = this.getColorLuminance(htmlBgColor);
                if (htmlLuminance !== null && htmlLuminance > 0) {
                    luminance = htmlLuminance;
                }
            }

            if (luminance !== null && luminance > 0) {
                const isDark = luminance < 0.5;
                return isDark;
            } else if (luminance === null) {
                // IMPORTANT: If background is completely transparent, the browser default is WHITE (Light mode).
                // Do NOT fallback to system preference here, because system might be Dark while page is effectively Light (transparent/white).
                return false;
            }
        } catch (e) {

        }

        // Fallback to system preference (only if we failed to analyze or some other edge case)
        const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
        return systemDark;
    }

    /**
     * Calculate relative luminance of a color (0 = black, 1 = white)
     * Uses sRGB formula matching HighlightToolbox exactly
     * Returns null for transparent colors
     */
    private getColorLuminance(color: string): number | null {
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

        // Calculate relative luminance using sRGB formula (same as HighlightToolbox)
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return luminance;
    }
}
