# GrabSHARK Extension — Progress

## What Works (Current Codebase)

### Build System
- [x] **4-layer Vite build** (popup/options, content script IIFE, content main ES module, embedded UI multi-entry)
- [x] Chromium Manifest V3 support
- [x] Firefox Manifest V2 support
- [x] Build script (`build.sh`) with `--firefox` flag
- [x] TypeScript strict mode compilation
- [x] Tailwind CSS + PostCSS (rem-to-pixel conversion)
- [x] ESLint configuration
- [x] GitHub Actions release workflow (auto-build + zip for both browsers)
- [x] Bundle size reporting (`scripts/report-bundles.mjs`)
- [x] Smoke test harness (`scripts/smoke-check.mjs`)
- [x] Embedded UI chunk splitting (preferences, edit, saved, save, auth chunks)

### Background Service Worker
- [x] **13 Manager classes:** ApiClient, Auth, Badge, Bookmarks, Bootstrap, Collections, Config, Context, Links, Media, MessageRouter, Preferences, User
- [x] Service worker bootstrap (`Background/index.ts`)
- [x] Message routing between popup, content script, and background
- [x] CORS proxy for backend API calls
- [x] Context menu integration (save page/link/image/text)
- [x] Screenshot capture (`tabs.captureVisibleTab`)
- [x] Browser bookmarks sync
- [x] Badge notification management
- [x] Bootstrap aggregation (user + collections + tags + prefs + domain prefs in single call)
- [x] Config management with tab bootstrapping via marker detection
- [x] Preference CRUD with site overrides and locale settings

### Runtime Messaging Layer (`src/@/lib/runtime/`)
- [x] Typed `sendRuntimeMessage<T>()` base with `RuntimeResponse<T>` envelope
- [x] 30+ typed message functions (bootstrap, collections, tags, links, preferences, domain prefs, AI)
- [x] Session cache with TTL (5 min links, 15 min AI prefs)
- [x] `expectSuccess()` helper for auto error throwing

### Content Script
- [x] Lightweight content script injector (IIFE)
- [x] **contentMain.tsx** — ES module content script entry with full lifecycle management
- [x] Lazy-loaded embedded UI (multi-entry: embeddedUI, captureDock, saveNotificationToast)
- [x] Shadow DOM isolation (ARMOR Protocol)
- [x] **5 Content managers:** EmbeddedMenu, Highlight, Toast, Interaction, SmartCaptureHandlers
- [x] Highlight Toolbox (color picker, note panel)
- [x] **NotePanel.ts** — Standalone highlight note/color picker (vanilla JS, Shadow DOM)
- [x] Highlight renderer (transparent marks on page text)
- [x] Smart Capture mode (element detection, marquee selection) with throttled overlay refresh
- [x] **4 Data extraction agents:** context, semantic, CSS, XPath
- [x] **6 Anchor utilities:** anchor resolution, CSS selector, XPath, semantic, text, context
- [x] Save notification toast system (slimmed bundle)
- [x] Drag handler
- [x] Highlight observer (DOM mutation tracking)
- [x] **Lazy component registry** (`lazyComponentRegistry.ts`) and **React loader** (`reactLoader.ts`)

### Popup UI (Thin Wrapper)
- [x] Quick save form with URL/title auto-fill
- [x] Collection picker (hierarchical dropdown)
- [x] Tag input with autocomplete
- [x] Thumbnail preview with screenshot capture
- [x] Duplicate detection (AlreadySavedView)
- [x] Edit link view (EditLinkView, EditLinkForm)
- [x] Theme toggle (light/dark)
- [x] Lazy-loaded BookmarkForm and PreferencesView

### Embedded Panel (Primary Shell)
- [x] In-page React app rendered inside Shadow DOM
- [x] SaveLinkCard — Save current page with form, preview, collection picker
- [x] AlreadySavedView — Page already saved; edit/delete options
- [x] EditLinkView — Edit existing link (rename, retag, move collection)
- [x] PreferencesView — In-page preferences (theme, capture, per-domain toggles)
- [x] Modal — Authentication dialog
- [x] Session cache integration (prevents re-fetching during same browser session)

### Options Page
- [x] Server URL configuration
- [x] Authentication (API key or credentials)
- [x] Keyboard shortcut recorder
- [x] Extension preferences form

### Shared Components (`src/@/`)
- [x] **15 Radix UI primitives:** Button, Checkbox, Command, Dialog, DropDownMenu, Form, Input, Label, Popover, Select, Separator, Switch, Textarea, Toast, Toaster
- [x] **6 SaveLink components:** Form, Preview, PageInteractions, Header, Footer, CaptureOverlays
- [x] **5 EditLink components:** EditLinkForm, LinkPreviewCard, LinkHeader, LinkFooter, DeleteDialog
- [x] **5 Preference sections:** PreferencesView, AccountSection, AppearanceSection, InteractionsSection, SavingSection, DisconnectDialog
- [x] BookmarkForm, BookmarkCollectionPicker, BookmarkOptions
- [x] CollectionPickerModal, TagInput, ShortcutRecorder
- [x] SaveLinkCard, SavedLinkCard, Modal, ModeToggle
- [x] Container, WholeContainer, Icon, CustomIcons
- [x] ThemeProvider

### Shared Libraries (`src/@/lib/`)
- [x] **5 API action wrappers:** collections, links, tags, users, highlights
- [x] **Bootstrap action** (`actions/bootstrap.ts`) — single-call init aggregation
- [x] **Runtime layer** (`runtime/core.ts`, `runtime/messages.ts`, `runtime/sessionCache.ts`)
- [x] Axios instance configuration (`api.ts`)
- [x] Authorized image URL helper (`authorizedImageUrl.ts`)
- [x] Link pollers (`linkPollers.ts`)
- [x] Authentication logic (`auth/auth.ts`)
- [x] React Query cache management (`cache.ts`)
- [x] Extension configuration (`config.ts`)
- [x] Settings management (`settings.ts`)
- [x] Screenshot capture (`screenshot.ts`)
- [x] Thumbnail caching (`thumbnailCache.ts`)
- [x] Image processing (`imageProcessor.ts`)
- [x] i18next initialization (`i18n.ts`) — lazy-loaded locale bundles
- [x] Utility functions (`utils.ts`)
- [x] **3 Zod validators:** bookmarkForm, optionsForm, config
- [x] Message schema validation (`messageSchemas.ts`)
- [x] Highlight types (`types/highlight.ts`)

### Localization
- [x] 15 languages: de, en, es, fr, it, ja, nl, pl, pt-BR, ro, ru, tr, uk, zh, zh-TW
- [x] i18next + react-i18next integration
- [x] Browser language detection with English fallback
- [x] Lazy-loaded locale bundles

---

## Current Status
| Area | Status |
|---|---|
| Codebase | Complete — optimized and refactored |
| CLAUDE.md | Created |
| Memory Bank | Updated 2026-04-05 |
| Build System | 4-layer Vite config with chunk splitting |
| CI/CD | GitHub Actions release workflow in place |
| Performance | Optimized (lazy-loading, session cache, bundle splitting) |
| Feature Development | Ready to start |

---

## What's Left (Potential Roadmap)

### High Priority
- [ ] Test extension build (`npm run build`) — verify no errors
- [ ] Load and test in Chrome (unpacked extension)
- [ ] Load and test in Firefox (`about:debugging`)
- [ ] Test core flows: quick save, highlighting, smart capture
- [ ] Create `knownBugs.md` once bugs are identified

### Medium Priority
- [ ] GrabSHARK-specific UI customization (branding, colors)
- [ ] Performance profiling (content script load time, memory usage)
- [ ] Accessibility audit for popup and embedded UI
- [ ] Test with various host page CSS frameworks (Bootstrap, Tailwind, etc.)

### Low Priority
- [ ] Additional i18n language packs
- [ ] Keyboard shortcut customization improvements
- [ ] Sidebar panel support (Chrome Side Panel API)
- [ ] Offline mode (queue saves when backend is unreachable)

---

## Architecture Metrics

| Metric | Count |
|---|---|
| Source Files (TS/TSX) | ~100+ |
| Background Managers | 13 |
| Content Script Managers | 6 |
| Data Extraction Agents | 4 |
| Anchor Utilities | 6 |
| Radix UI Primitives | 15 |
| Shared Components | 30+ |
| API Action Wrappers | 5 + bootstrap |
| Runtime Message Functions | 30+ |
| Zod Validators | 3 |
| Supported Languages | 15 |
| Vite Build Configs | 4 |
| Browser Permissions | 8 |
| Embedded Entry Points | 3 (embeddedUI, captureDock, saveNotificationToast) |
| Manual Chunks | 5 (preferences, edit, saved, save, auth) |
