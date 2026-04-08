/**
 * Accent color mapping for the extension.
 * Maps AccentColor enum values to HSL values for --primary CSS variable.
 * These values match the main app's OKLCH-based accent system,
 * converted to HSL for Tailwind's hsl(var(--primary)) usage.
 */

const ACCENT_HSL: Record<string, { light: string; dark: string }> = {
  default:       { light: '221.2 83.2% 53.3%', dark: '221.2 83.2% 53.3%' },
  red:           { light: '0 84.2% 60.2%',     dark: '0 84.2% 60.2%' },
  rose:          { light: '340 82% 52%',        dark: '340 82% 52%' },
  yellow:        { light: '45 93% 47%',         dark: '45 93% 47%' },
  green:         { light: '142 71% 45%',        dark: '142 71% 45%' },
  orange:        { light: '25 95% 53%',         dark: '25 95% 53%' },
  zinc:          { light: '240 5.2% 33.9%',     dark: '240 5.2% 33.9%' },
  'light-default': { light: '199.4 95.5% 73.9%', dark: '199.4 95.5% 73.9%' },
  'light-red':     { light: '0 86.2% 69%',       dark: '0 86.2% 69%' },
  'light-rose':    { light: '317.3 97.1% 72.2%', dark: '317.3 97.1% 72.2%' },
  'light-yellow':  { light: '43.8 87.7% 76.7%',  dark: '43.8 87.7% 76.7%' },
  'light-green':   { light: '107.8 99.1% 64.8%', dark: '107.8 99.1% 64.8%' },
  'light-orange':  { light: '33.6 100% 56.3%',   dark: '33.6 100% 56.3%' },
  'light-zinc':    { light: '194.9 66.2% 82.6%', dark: '194.9 66.2% 82.6%' },
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
