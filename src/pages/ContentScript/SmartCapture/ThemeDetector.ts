/**
 * ThemeDetector - Theme detection for Smart Capture components
 *
 * Thin wrapper that delegates to the central ThemeManager. Previously this was a
 * standalone copy of HighlightToolbox.isDarkMode() logic, but it drifted out of sync
 * with ThemeManager — missing the extension-preference priority and the
 * `<meta name="color-scheme">` check that GrabSHARK monoliths rely on, which made
 * Smart Capture open in light mode on dark monolith pages.
 *
 * Keep this class as a thin facade so existing instance-based callers
 * (`new ThemeDetector().isDarkMode()`) continue to work without refactoring.
 */
import { ThemeManager } from '../shared/ThemeManager';

export class ThemeDetector {
    public isDarkMode(): boolean {
        return ThemeManager.isDarkMode();
    }
}
