import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react"
import { getStorageItem, setStorageItem } from "../lib/utils"

type Theme = "dark" | "light" | "system" | "website"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  disableTransitionOnChange = false,
  rootElement,
  defaultToRoot = true,
  resolveTheme,
  onThemeLoaded,
  storageLoaded = false, // New prop
  ...props
}: ThemeProviderProps & {
  disableTransitionOnChange?: boolean;
  rootElement?: HTMLElement | null;
  defaultToRoot?: boolean;
  resolveTheme?: (theme: Theme) => "dark" | "light" | undefined;
  onThemeLoaded?: () => void;
  storageLoaded?: boolean;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [isLoaded, setIsLoaded] = useState(storageLoaded)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await getStorageItem(storageKey)
        if (stored) {
          setThemeState(stored as Theme)
        }
      } catch (e) {

      } finally {
        setIsLoaded(true)
      }
    }
    loadTheme()
  }, [storageKey])

  useLayoutEffect(() => {
    if (!isLoaded) return

    let root = rootElement

    if (!root && defaultToRoot) {
      root = window.document.documentElement
    }

    if (!root) return

    root.classList.remove("light", "dark")

    if (resolveTheme) {
      const resolved = resolveTheme(theme);
      if (resolved) {
        root.classList.add(resolved);
        // Call callback after DOM manipulation
        if (onThemeLoaded) onThemeLoaded();
        return;
      }
    }

    if (theme === "system" || theme === "website") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light"

      root.classList.add(systemTheme)
      // Call callback after DOM manipulation
      if (onThemeLoaded) onThemeLoaded();
      return
    }

    root.classList.add(theme)
    // Call callback after DOM manipulation
    if (onThemeLoaded) onThemeLoaded();
  }, [theme, isLoaded, rootElement, defaultToRoot, resolveTheme]) // Warning: onThemeLoaded might be unstable/cause loops if it changes on re-renders. 
  // Ideally onThemeLoaded should be stable or wrapped in useCallback by parent. 
  // But here we just call it.


  const value = {
    theme,
    setTheme: (theme: Theme) => {
      setStorageItem(storageKey, theme)
      setThemeState(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
