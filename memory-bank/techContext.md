# GrabSHARK Extension — Tech Context

## Tech Stack (Strict Versions)

| Technology | Version | Purpose |
|---|---|---|
| **TypeScript** | ^5.0 | Language |
| **React** | ^18.2 | UI framework |
| **React DOM** | ^18.2 | React rendering |
| **Vite** | ^4.4 | Build tool (4-layer config) |
| **Tailwind CSS** | ^3.3 | Styling |
| **React Query** | @tanstack/react-query ^4.32 | Server state / data fetching |
| **Axios** | ^1.4 | HTTP client for backend API |
| **React Hook Form** | ^7.45 | Form state management |
| **Zod** | ^3.21 | Schema validation |
| **i18next** | ^25.7 | Internationalization (lazy-loaded bundles) |
| **react-i18next** | ^16.5 | React i18n bindings |
| **webextension-polyfill** | ^0.12 | Cross-browser API compatibility |

## Chromium vs Firefox

| Aspect | Chromium | Firefox |
|---|---|---|
| **Manifest Version** | V3 | V2 |
| **Manifest File** | `chromium/manifest.json` | `firefox/manifest.json` |
| **Background** | Service Worker (`service_worker`) | Background scripts (`scripts`, `persistent: false`) |
| **Action API** | `chrome.action` | `browser.browserAction` |
| **Permissions** | `permissions` + `host_permissions` separate | `permissions` includes URLs |
| **Content Security** | Object-based (`extension_pages`) | String-based |
| **Web Resources** | Object array with `matches` | String array |
| **Min Browser Version** | N/A | Firefox 109.0 |
| **Extension ID** | Auto-assigned | `support@grabshark.app` (gecko) |
| **Keyboard Shortcut** | Cmd+Shift+Y (Mac) / Ctrl+Shift+F | Cmd+Shift+K (Mac) / Ctrl+Shift+F |

## Extension Permissions

| Permission | Purpose |
|---|---|
| `storage` | Store settings, auth tokens, cache |
| `scripting` | Inject content scripts (Chromium only) |
| `activeTab` | Access current tab URL/title |
| `tabs` | Tab management, capture visible tab |
| `bookmarks` | Browser bookmarks sync |
| `commands` | Keyboard shortcut registration |
| `contextMenus` | Right-click menu items |
| `downloads` | File download support |
| `<all_urls>` | Content script injection on all pages |

## Key Dependencies

### UI & Styling
- **Radix UI** — 11 primitives: checkbox, dialog, dropdown-menu, icons, label, popover, select, separator, slot, switch, toast
- **Lucide React** (^0.562) — Icon set
- **Phosphor Icons** (^2.1.10) — Additional icon set
- **class-variance-authority** (^0.7) — Component variant management
- **clsx** (^2.0) + **tailwind-merge** (^1.14) — Conditional class composition
- **tailwindcss-animate** (^1.0.6) — Animation utilities
- **cmdk** (^0.2) — Command palette component

### Data & Forms
- **@tanstack/react-query** (^4.32.6) — Server state management (v4, NOT v5)
- **axios** (^1.4) — HTTP client
- **react-hook-form** (^7.45.4) — Form management
- **@hookform/resolvers** (^3.2) — Zod integration for react-hook-form
- **zod** (^3.21.4) — Schema validation
- **query-string** (^8.1) — URL query parsing

### Utilities
- **date-fns** (^4.1) — Date formatting
- **i18next** (^25.7.3) + **react-i18next** (^16.5.1) — Internationalization

### Dev Dependencies
- **@vitejs/plugin-react** (^4.0.3) — Vite React plugin
- **@types/chrome** (^0.0.243) — Chrome API types
- **@types/firefox-webext-browser** (^120.0) — Firefox API types
- **@types/webextension-polyfill** (^0.12.1) — Polyfill types
- **autoprefixer** (^10.4.14) — CSS autoprefixer
- **postcss** (^8.4.27) — CSS processing
- **postcss-rem-to-pixel** (^4.1.2) — Convert rem to px for Shadow DOM isolation
- **eslint** (^8.45) + TypeScript ESLint plugins — Linting

---

## Build System

### Four Vite Configs

| Config | Entry | Output | Format |
|---|---|---|---|
| `vite.config.ts` | `index.html`, `Options/options.html`, `Background/index.ts` | `main.js`, `options.js`, `background.js` | ES modules |
| `vite.config.content.ts` | `ContentScript/contentScript.tsx` | `contentScript.js` | IIFE |
| `vite.config.content-main.ts` | `ContentScript/contentMain.tsx` | `contentMain.js` | ES module |
| `vite.config.embedded.ts` | 3 entries: `embeddedApp.ts`, `captureDock.ts`, `saveNotificationToast.ts` | `embeddedUI.js`, `captureDock.js`, `saveNotificationToast.js` + chunks | ES module |

### Build Command
```bash
tsc && vite build && vite build -c vite.config.content.ts && vite build -c vite.config.content-main.ts && vite build -c vite.config.embedded.ts
```

### Embedded UI Chunks (Manual Splitting)
| Chunk | Contents |
|---|---|
| `embedded-preferences` | PreferencesView components |
| `embedded-edit` | EditLinkView components |
| `embedded-saved` | AlreadySavedView components |
| `embedded-save` | SaveLinkCard/SaveLink components |
| `embedded-auth` | Modal/OptionsForm components |

### Build Flags
- **Production:** `console` and `debugger` statements are dropped via esbuild
- **Development:** `minify: false`, console/debugger preserved
- **Content Script:** IIFE format, single file, no imports
- **Content Main:** ES module format
- **Embedded UI:** ES module, multi-entry with manual chunk splitting

### Build Script (`build.sh`)
```bash
npm install
npm run build
# Then copies platform-specific manifest:
./build.sh           # → Chromium (chromium/manifest.json → dist/)
./build.sh --firefox # → Firefox (firefox/manifest.json → dist/)
```

### Build Tooling
- **scripts/report-bundles.mjs** — Bundle size reporting and guardrails
- **scripts/smoke-check.mjs** — Extension smoke test harness

---

## CI/CD

### GitHub Actions (`.github/workflows/release-extension.yml`)
- **Trigger:** Git tags matching `v*`
- **Node.js:** v20
- **Steps:** Install (`npm ci`) → Build → Copy Chromium manifest → Zip → Copy Firefox manifest → Zip → Create GitHub Release with both ZIPs
- **Artifacts:** `grabshark-extension-chromium-{tag}.zip`, `grabshark-extension-firefox-{tag}.zip`

---

## Development Commands

| Command | Action |
|---|---|
| `npm install` | Install all dependencies |
| `npm run dev` | Start Vite dev server (popup/options hot reload only) |
| `npm run build` | Full production build (4 Vite passes) |
| `npm run lint` | ESLint check |
| `npm run preview` | Preview production build |
| `./build.sh` | Build + copy Chromium manifest to dist |
| `./build.sh --firefox` | Build + copy Firefox manifest to dist |

### Development Workflow
1. **Popup/Options changes:** `npm run dev` → hot reload in browser
2. **Content script changes:** `npm run build` → reload extension in browser
3. **Testing:** Load `dist/` as unpacked extension in `chrome://extensions/` or `about:debugging`

---

## Path Aliases

| Alias | Resolves To |
|---|---|
| `@/*` | `./src/*` |

Configured in both `tsconfig.json` (`paths`) and all Vite configs (`resolve.alias`).

---

## TypeScript Configuration

- **Target:** ES2020
- **Module:** ESNext (bundler resolution)
- **Strict mode:** Enabled
- **JSX:** `react-jsx`
- **Lint rules:** `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- **Lib:** ES2020, DOM, DOM.Iterable

---

## Localization

- **Framework:** i18next + react-i18next
- **15 Languages:** de, en, es, fr, it, ja, nl, pl, pt-BR, ro, ru, tr, uk, zh, zh-TW
- **Files:** `src/@/locales/{lang}.json`
- **Detection:** Browser language → fallback to English
- **Initialization:** `@/lib/i18n.ts`
- **Loading:** Lazy-loaded locale bundles (not bundled upfront)
