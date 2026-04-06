/**
 * Accent color mapping for the extension.
 * Maps AccentColor enum values to HSL values for --primary CSS variable.
 * These values match the main app's OKLCH-based accent system,
 * converted to HSL for Tailwind's hsl(var(--primary)) usage.
 */

const ACCENT_HSL: Record<string, { light: string; dark: string }> = {
  default: { light: '221.2 83.2% 53.3%', dark: '221.2 83.2% 53.3%' },
  red:     { light: '0 84.2% 60.2%',     dark: '0 84.2% 60.2%' },
  rose:    { light: '340 82% 52%',        dark: '340 82% 52%' },
  yellow:  { light: '45 93% 47%',         dark: '45 93% 47%' },
  green:   { light: '142 71% 45%',        dark: '142 71% 45%' },
  orange:  { light: '25 95% 53%',         dark: '25 95% 53%' },
  zinc:    { light: '240 5.2% 33.9%',     dark: '240 5.2% 33.9%' },
};

export function applyAccentColor(accentColor: string, isDark: boolean, root?: HTMLElement | null): void {
  const colors = ACCENT_HSL[accentColor] || ACCENT_HSL.default;
  const hsl = isDark ? colors.dark : colors.light;
  const target = root || document.documentElement;
  target.style.setProperty('--primary', hsl);
}

export function getAccentColorNames(): string[] {
  return Object.keys(ACCENT_HSL);
}
