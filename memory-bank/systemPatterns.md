# GrabSHARK Extension — System Patterns

## Four-Layer Build Architecture

The extension uses **4 separate Vite configurations** that build **sequentially** into a single `dist/` folder:

```
Build Pipeline:
tsc → vite build → vite build -c content → vite build -c content-main → vite build -c embedded
       ↓                    ↓                       ↓                          ↓
    main.js           contentScript.js         contentMain.js            embeddedUI.js
    options.js        contentScript.css                                  captureDock.js
    background.js                                                       saveNotificationToast.js
    style.css                                                           assets/embedded-*.js (chunks)
```

### Layer 1: Popup + Options + Background (`vite.config.ts`)
- **Entries:** `index.html` (popup), `Options/options.html`, `Background/index.ts`
- **Output:** ES modules — `main.js`, `options.js`, `background.js`
- **Clears `dist/` first** (`emptyOutDir: true` by default)

### Layer 2: Content Script (`vite.config.content.ts`)
- **Entry:** `ContentScript/contentScript.tsx`
- **Output:** IIFE format — `contentScript.js` (~200-400KB)
- **`emptyOutDir: false`** — must NOT wipe existing build
- Lightweight: no React bundled, just vanilla TS + DOM manipulation

### Layer 3: Content Main (`vite.config.content-main.ts`)
- **Entry:** `ContentScript/contentMain.tsx`
- **Output:** ES module — `contentMain.js`
- **`emptyOutDir: false`** — must NOT wipe existing build
- Main content script logic: manager init, keyboard shortcuts, lifecycle handlers

### Layer 4: Embedded UI (`vite.config.embedded.ts`)
- **3 Entry Points:**
  - `embeddedEntries/embeddedApp.ts` → `embeddedUI.js` (main in-page UI)
  - `embeddedEntries/captureDock.ts` → `captureDock.js` (Smart Capture controls)
  - `embeddedEntries/saveNotificationToast.ts` → `saveNotificationToast.js` (toast notifications)
- **Manual chunk splitting:**
  - `embedded-preferences` — PreferencesView components
  - `embedded-edit` — EditLinkView components
  - `embedded-saved` — AlreadySavedView components
  - `embedded-save` — SaveLinkCard/SaveLink components
  - `embedded-auth` — Modal/OptionsForm components
- **`emptyOutDir: false`** — must NOT wipe existing build
- Heavy: full React + Radix UI + React Query + all shared components
- **Lazy-loaded:** Content script loads these only when user triggers UI

### Manifest Copy (Post-Build)
```
./build.sh          → copies chromium/manifest.json → dist/
./build.sh --firefox → copies firefox/manifest.json → dist/
```

---

## Project Structure

```
grabshark-extension/
├── src/
│   ├── @/                          → Shared modules (aliased as @/*)
│   │   ├── components/             → React UI components
│   │   │   ├── ui/                 → 15 Radix UI primitive wrappers
│   │   │   ├── SaveLink/           → Save link flow (6 files)
│   │   │   ├── EditLink/           → Edit link flow (5 files)
│   │   │   ├── Bookmark/           → Collection picker, options
│   │   │   └── Preferences/        → 4 preference sections + disconnect dialog
│   │   ├── hooks/                  → Custom hooks (useThumbnail)
│   │   ├── lib/                    → Utilities, API, auth, validators
│   │   │   ├── actions/            → API wrappers (collections, links, tags, users, highlights, bootstrap)
│   │   │   ├── auth/               → Authentication logic
│   │   │   ├── runtime/            → Runtime messaging layer (core, messages, sessionCache)
│   │   │   ├── validators/         → Zod schemas
│   │   │   ├── validations/        → Message schema validation
│   │   │   └── types/              → TypeScript types
│   │   └── locales/                → 15 language JSON files
│   └── pages/
│       ├── Background/             → Service worker entry + managers
│       │   ├── index.ts            → Service worker bootstrap
│       │   └── managers/           → 13 Manager classes
│       ├── ContentScript/          → Content script + subsystems
│       │   ├── contentScript.tsx   → IIFE injector entry (lightweight)
│       │   ├── contentMain.tsx     → ES module content script (main logic)
│       │   ├── EmbeddedApp.tsx     → Shadow DOM React app (primary shell)
│       │   ├── NotePanel.ts        → Standalone highlight note/color picker
│       │   ├── embeddedEntries/    → Lazy-load entry points (3 entries)
│       │   ├── highlighting/       → Highlight DOM manipulation
│       │   ├── SmartCapture/       → Element detection + marquee
│       │   ├── agents/             → Data extraction agents
│       │   ├── anchorUtils/        → Anchor resolution utilities
│       │   ├── managers/           → Content-side managers
│       │   ├── toolbox/            → Highlight toolbox listeners
│       │   ├── handlers/           → Drag handler
│       │   ├── shared/             → Shared utilities
│       │   ├── utils/              → Messaging, DOM helpers, lazy registry, React loader
│       │   ├── SaveNotificationToast/ → Toast notification system
│       │   └── components/         → Content script components
│       ├── Options/                → Extension settings page
│       │   ├── App.tsx             → Options root
│       │   ├── Options.tsx         → Options form
│       │   └── options.html        → Options HTML entry
│       └── Popup/                  → Extension popup (thin wrapper)
│           ├── App.tsx             → Popup root
│           └── main.tsx            → Popup entry
├── chromium/                       → Chromium Manifest V3
│   └── manifest.json
├── firefox/                        → Firefox Manifest V2
│   └── manifest.json
├── scripts/                        → Build tooling
│   ├── smoke-check.mjs            → Extension smoke test harness
│   └── report-bundles.mjs         → Bundle size reporting
├── dist/                           → Build output
├── public/                         → Static assets (icons: 16, 32, 48, 128)
├── vite.config.ts                  → Main build config
├── vite.config.content.ts          → Content script build config (IIFE)
├── vite.config.content-main.ts     → Content main build config (ES module)
├── vite.config.embedded.ts         → Embedded UI build config (multi-entry + chunks)
├── tailwind.config.js              → Tailwind CSS configuration
├── build.sh                        → Build + manifest copy script
└── contentscript.css               → Content script styles (58KB, ARMOR Protocol)
```

---

## Background Manager Pattern

All background service worker logic is organized into **self-contained Manager classes** (13 total):

```
Background/
├── index.ts                → Bootstrap: instantiates all managers, registers listeners
└── managers/
    ├── ApiClient.ts        → HTTP client wrapper for authenticated API requests
    ├── AuthManager.ts      → Token refresh, session management, credential storage
    ├── BadgeManager.ts     → Extension icon badge (notifications, save status)
    ├── BookmarksManager.ts → Browser bookmarks sync with GrabSHARK collections
    ├── BootstrapManager.ts → Aggregates init state (user, collections, tags, domain prefs, AI tags)
    ├── CollectionsManager.ts → Collection/tag fetching with full path building
    ├── ConfigManager.ts    → Config save/load/clear, tab bootstrapping via marker detection
    ├── ContextManager.ts   → Right-click context menu (save page/link/image/text)
    ├── LinksManager.ts     → CORS proxy for link CRUD → backend API
    ├── MediaManager.ts     → Screenshot capture (tabs.captureVisibleTab)
    ├── MessageRouter.ts    → Cross-script communication (background ↔ content ↔ popup)
    ├── PreferencesManager.ts → Preference CRUD, site overrides, locale settings
    └── UserManager.ts      → User profile sync from backend
```

**Communication Flow:**
```
Popup ──message──→ Background (MessageRouter) ──HTTP──→ GrabSHARK Backend
                        ↕ message
Content Script ──message──→ Background ──HTTP──→ GrabSHARK Backend
```

---

## Runtime Messaging Layer (`src/@/lib/runtime/`)

Centralized typed API for all extension-to-background communication:

```
runtime/
├── core.ts         → sendRuntimeMessage<T>(type, data?) with RuntimeResponse<T> envelope
├── messages.ts     → 30+ typed functions: bootstrap, collections, tags, links, prefs, AI
└── sessionCache.ts → Browser session storage cache (5 min links, 15 min AI prefs TTL)
```

**Pattern:** Content scripts and popup call `getExtensionBootstrapState()` once on load, then use other message functions as needed. `expectSuccess()` helper auto-throws on `!response.success`.

---

## Content Script Architecture

### Injection Flow
```
1. contentScript.tsx loads on every page (IIFE, lightweight)
2. Loads contentMain.tsx (ES module) which initializes managers and listeners
3. Registers keyboard shortcuts, text selection handlers, context menu
4. When user triggers popup/highlight → lazy-loads embedded UI via reactLoader.ts
5. reactLoader.ts fetches embeddedUI.js/captureDock.js/saveNotificationToast.js
6. EmbeddedApp renders inside Shadow DOM as primary interactive shell
```

### Content Script Managers (`pages/ContentScript/managers/`)
| Manager | Purpose |
|---|---|
| `EmbeddedMenuManager.ts` | Shadow DOM host creation, embedded UI lifecycle |
| `HighlightManager.ts` | Text selection detection, highlight creation trigger |
| `ToastManager.ts` | In-page toast notification rendering |
| `InteractionManager.ts` | User interaction coordination across subsystems |
| `SmartCaptureHandlers.ts` | Smart Capture event handling |
| `toolboxCallbacks.ts` | Highlight toolbox action callbacks |

### Lazy Component Loading
```
utils/
├── lazyComponentRegistry.ts → Global registry (__grabsharkLazyComponents) for loaded modules
└── reactLoader.ts           → Lazy-loader with caching + dedup for:
                                - loadEmbeddedAppModule()     → embeddedUI.js
                                - loadCaptureDockModule()     → captureDock.js
                                - loadSaveNotificationToastModule() → saveNotificationToast.js
```

### Smart Capture System (`pages/ContentScript/SmartCapture/`)
```
SmartCaptureMode.ts        → Main controller (enter/exit capture mode)
SelectionManager.ts        → Tracks hovered/selected elements (throttled overlay refresh)
CaptureOverlay.ts          → Visual overlay on detected elements
MarqueeSelection.ts        → Draw-to-select region capture
CaptureActionBar.ts        → Action bar with save/cancel controls
ElementContentExtractor.ts → Extract content from captured elements
ActionBarPositioner.ts     → Smart positioning near captured element
viewportLayout.ts          → Viewport calculations
unitValidation.ts          → Unit/dimension validation
```

### Data Extraction Agents (`pages/ContentScript/agents/`)
| Agent | Purpose |
|---|---|
| `contextAgent.ts` | Extracts surrounding text context for highlight anchoring |
| `semanticAgent.ts` | Semantic HTML analysis (headings, articles, sections) |
| `cssAgent.ts` | Generates unique CSS selectors for highlight targets |
| `xpathAgent.ts` | Generates XPath expressions for highlight targets |

### Anchor Resolution (`pages/ContentScript/anchorUtils/`)
When re-rendering saved highlights on page revisit:
1. `anchorResolution.ts` — Main resolver: tries CSS → XPath → semantic → text fallback
2. `cssSelector.ts` — CSS selector matching
3. `xpathGenerator.ts` — XPath evaluation
4. `semanticAnchor.ts` — Semantic HTML matching
5. `textUtils.ts` — Text content matching fallback
6. `contextCapture.ts` — Context text extraction for verification

---

## Two-Tier UI Architecture

### Popup (Thin Wrapper)
- 396px fixed width
- Lazy-loads BookmarkForm and PreferencesView
- Calls `getExtensionBootstrapState()` on mount, pre-fills React Query cache
- Secondary access point for quick save

### Embedded Panel (Primary Shell)
- In-page React app rendered inside Shadow DOM
- Launched via keyboard shortcut or selection menu
- Full UI: SaveLinkCard, AlreadySavedView, EditLinkView, PreferencesView, auth Modal
- Session cache (`readLinkSessionCache/writeLinkSessionCache`) prevents re-fetching
- Custom events for inter-component communication (`grabshark-toggle-close`, `grabshark-open-edit`, etc.)

---

## Shadow DOM Isolation (ARMOR Protocol)

```
Host Page DOM
  └── <div id="grabshark-root">
        └── #shadow-root (open)
              ├── <style> content-armor.css (aggressive reset) </style>
              ├── <style> embedded.css (extension styles) </style>
              └── <EmbeddedApp />  ← React app renders here
```

**Key Properties:**
- All extension CSS classes prefixed with `.ext-lw-*`
- Z-index: `2147483647` (max 32-bit integer) for overlays
- `postcss-rem-to-pixel` converts rem → px to prevent host page font-size interference
- Styles are fully scoped — host page cannot affect extension UI

---

## State Management

### Extension Storage (`chrome.storage.local`)
- Server URL, API key, credentials
- Theme preference (light/dark)
- Keyboard shortcut bindings
- Default collection ID
- Smart Capture preferences
- Last used collection/tags

### Session Cache (`runtime/sessionCache.ts`)
- Link data cache (5 min TTL) — prevents repeated backend fetches
- AI tag preference cache (15 min TTL)
- Stored in `sessionStorage`

### React Query (`@tanstack/react-query v4`)
- Collections list query
- Tags list query
- User profile query
- Link check (duplicate detection) query
- Highlight queries for current page
- Pre-filled from bootstrap call

### Form State (React Hook Form + Zod)
- `bookmarkForm` — Save link form validation
- `optionsForm` — Extension settings validation
- `config` — Server configuration validation

---

## Message Passing Protocol

Extension uses typed runtime messaging layer for cross-context communication:

```
Key Message Functions (via runtime/messages.ts):
├── getExtensionBootstrapState(domain?) → Aggregated init state
├── saveLinkFromExtension(data)         → Save link via background
├── updateLinkMessage(data)             → Update existing link
├── checkLinkExistsMessage(url)         → Duplicate detection
├── getCollectionsData()                → Fetch collections
├── getTagsData()                       → Fetch tags
├── getCurrentUserProfile()             → Fetch user
├── getDomainPreference(domain)         → Per-domain settings
├── saveDomainPreference(data)          → Save domain prefs
├── suggestTags(data)                   → AI tag suggestions
├── getExtensionPreferences()           → Get preferences
├── saveExtensionPreferences(data)      → Save preferences
├── getLocaleSettings()                 → Get locale
├── saveLocaleSettings(data)            → Save locale
└── broadcastPreferencesUpdated()       → Notify all contexts
```

---

## CSS Architecture

| File | Size | Purpose |
|---|---|---|
| `contentscript.css` | ~58KB | ARMOR Protocol reset + content script styles |
| `src/@/index.css` | — | Popup/Options Tailwind entry |
| `embedded.css` | — | Shadow DOM embedded component styles |
| `content-armor.css` | — | Aggressive CSS reset for host page isolation |

---

## i18n Pattern

- **Framework:** i18next + react-i18next
- **Initialization:** `@/lib/i18n.ts` — detects browser language, falls back to English
- **15 Languages:** de, en, es, fr, it, ja, nl, pl, pt-BR, ro, ru, tr, uk, zh, zh-TW
- **Translation files:** `src/@/locales/{lang}.json`
- **Lazy-loaded:** Locale bundles loaded on demand, not bundled upfront
- **Usage:** `const { t } = useTranslation()` in React components
