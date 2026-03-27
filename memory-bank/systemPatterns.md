# GrabSHARK Extension — System Patterns

## Three-Layer Build Architecture

The extension uses 3 separate Vite configurations that build **sequentially** into a single `dist/` folder:

```
Build Pipeline:
tsc → vite build → vite build -c content → vite build -c embedded
       ↓                    ↓                        ↓
    main.js              contentScript.js         embeddedUI.js
    options.js           contentScript.css
    background.js
    style.css
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

### Layer 3: Embedded UI (`vite.config.embedded.ts`)
- **Entry:** `ContentScript/embeddedUI.ts`
- **Output:** ES module — `embeddedUI.js` (~6MB)
- **`emptyOutDir: false`** — must NOT wipe existing build
- Heavy: full React + Radix UI + React Query + all shared components
- **Lazy-loaded:** Content script loads this only when user opens in-page popup

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
│   │   │   ├── actions/            → API wrappers (collections, links, tags, users, highlights)
│   │   │   ├── auth/               → Authentication logic
│   │   │   ├── validators/         → Zod schemas
│   │   │   ├── validations/        → Message schema validation
│   │   │   └── types/              → TypeScript types
│   │   └── locales/                → 15 language JSON files
│   └── pages/
│       ├── Background/             → Service worker entry + managers
│       │   ├── index.ts            → Service worker bootstrap
│       │   └── managers/           → 8 Manager classes
│       ├── ContentScript/          → Content script + subsystems
│       │   ├── contentScript.tsx   → Main injector entry
│       │   ├── EmbeddedApp.tsx     → Shadow DOM React app
│       │   ├── embeddedUI.ts       → Lazy-load entry for embedded React
│       │   ├── highlighting/       → Highlight DOM manipulation
│       │   ├── SmartCapture/       → Element detection + marquee
│       │   ├── agents/             → Data extraction agents
│       │   ├── anchorUtils/        → Anchor resolution utilities
│       │   ├── managers/           → Content-side managers
│       │   ├── toolbox/            → Highlight toolbox listeners
│       │   ├── handlers/           → Drag handler
│       │   ├── shared/             → Shared utilities
│       │   ├── utils/              → Messaging, DOM helpers, image helpers
│       │   ├── SaveNotificationToast/ → Toast notification system
│       │   └── components/         → Content script components
│       ├── Options/                → Extension settings page
│       │   ├── App.tsx             → Options root
│       │   ├── Options.tsx         → Options form
│       │   └── options.html        → Options HTML entry
│       └── Popup/                  → Extension popup
│           ├── App.tsx             → Popup root
│           └── main.tsx            → Popup entry
├── chromium/                       → Chromium Manifest V3
│   └── manifest.json
├── firefox/                        → Firefox Manifest V2
│   └── manifest.json
├── dist/                           → Build output
├── public/                         → Static assets (icons: 16, 32, 48, 128)
├── vite.config.ts                  → Main build config
├── vite.config.content.ts          → Content script build config
├── vite.config.embedded.ts         → Embedded UI build config
├── tailwind.config.js              → Tailwind CSS configuration
├── build.sh                        → Build + manifest copy script
└── contentscript.css               → Content script styles (58KB, ARMOR Protocol)
```

---

## Background Manager Pattern

All background service worker logic is organized into **self-contained Manager classes**:

```
Background/
├── index.ts              → Bootstrap: instantiates all managers, registers listeners
└── managers/
    ├── AuthManager.ts    → Token refresh, session management, credential storage
    ├── BadgeManager.ts   → Extension icon badge (notifications, save status)
    ├── BookmarksManager.ts → Browser bookmarks sync with GrabSHARK collections
    ├── ContextManager.ts → Right-click context menu (save page/link/image/text)
    ├── LinksManager.ts   → CORS proxy for link CRUD → backend API
    ├── MediaManager.ts   → Screenshot capture (tabs.captureVisibleTab)
    ├── MessageRouter.ts  → Cross-script communication (background ↔ content ↔ popup)
    └── UserManager.ts    → User profile/settings sync from backend
```

**Communication Flow:**
```
Popup ──message──→ Background (MessageRouter) ──HTTP──→ GrabSHARK Backend
                        ↕ message
Content Script ──message──→ Background ──HTTP──→ GrabSHARK Backend
```

---

## Content Script Architecture

### Injection Flow
```
1. contentScript.tsx loads on every page (IIFE, lightweight)
2. Initializes managers: HighlightManager, InteractionManager, ToastManager, etc.
3. When user triggers popup/highlight → lazy-loads embeddedUI.js
4. embeddedUI.ts creates Shadow DOM host → renders EmbeddedApp (React)
5. EmbeddedApp receives messages from contentScript via CustomEvents
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

### Smart Capture System (`pages/ContentScript/SmartCapture/`)
```
SmartCaptureMode.ts        → Main controller (enter/exit capture mode)
SelectionManager.ts        → Tracks hovered/selected elements
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

### React Query (`@tanstack/react-query v4`)
- Collections list query
- Tags list query
- User profile query
- Link check (duplicate detection) query
- Highlight queries for current page

### Form State (React Hook Form + Zod)
- `bookmarkForm` — Save link form validation
- `optionsForm` — Extension settings validation
- `config` — Server configuration validation

---

## Message Passing Protocol

Extension uses Chrome/Firefox messaging API for cross-context communication:

```
Message Types (validated via messageSchemas.ts):
├── SAVE_LINK        → Content/Popup → Background → Backend
├── CHECK_LINK       → Popup → Background → Backend (duplicate check)
├── GET_COLLECTIONS  → Popup → Background → Backend
├── GET_TAGS         → Popup → Background → Backend
├── CAPTURE_TAB      → Content → Background (screenshot)
├── HIGHLIGHT_SAVE   → Content → Background → Backend
├── HIGHLIGHT_DELETE  → Content → Background → Backend
├── HIGHLIGHT_LOAD   → Content → Background → Backend
├── SETTINGS_CHANGED → Options → Background → Content (broadcast)
└── AUTH_STATUS      → Background → Popup/Content (auth state)
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
- **Usage:** `const { t } = useTranslation()` in React components
