# GrabSHARK Extension — Active Context

## Current State
- **Date:** 2026-04-05
- **Phase:** Post-optimization, ready for feature development

## Recent Changes (Since 2026-03-27)

### Architecture Shift: Embedded Panel as Primary Shell
- Popup is now a thin wrapper; the **embedded in-page panel** (Shadow DOM) is the primary interactive UI.
- Both popup and embedded panel share the same components (SaveLinkCard, EditLinkView, PreferencesView).
- Lazy-loaded via `EmbeddedMenuManager.toggleEmbeddedMenu()`.

### New Runtime Messaging Layer (`src/@/lib/runtime/`)
- **core.ts** — Base `sendRuntimeMessage<T>()` wrapper with `RuntimeResponse<T>` envelope.
- **messages.ts** — 30+ typed message functions (bootstrap, collections, tags, links, preferences, domain prefs, AI tag suggestions).
- **sessionCache.ts** — Browser session storage cache with TTL (5 min links, 15 min AI prefs).

### 5 New Background Managers (13 total now)
- **ApiClient.ts** — HTTP client wrapper for authenticated API requests.
- **BootstrapManager.ts** — Aggregates init state (user, collections, tags, domain prefs, AI tags).
- **CollectionsManager.ts** — Collection/tag fetching with full path building.
- **ConfigManager.ts** — Config save/load/clear, tab bootstrapping via marker detection.
- **PreferencesManager.ts** — Preference CRUD, site overrides, locale settings.

### Build System: 4-Layer (was 3)
- New **vite.config.content-main.ts** — Builds `contentMain.js` (ES module, main content script logic).
- **vite.config.embedded.ts** now has **3 entry points**: embeddedUI.js, captureDock.js, saveNotificationToast.js.
- Manual chunk splitting: embedded-preferences, embedded-edit, embedded-saved, embedded-save, embedded-auth.

### Performance Optimizations
- Lazy-load locale bundles (i18n).
- Preview caching & polling optimization.
- Toast notification bundle slimmed.
- Embedded panel split into route chunks.
- Smart Capture overlay throttling.
- Shared session cache for link data.
- Bootstrap dedup loading for save/edit flows.

### New Content Script Files
- **contentMain.tsx** — Main content script entry (ES module), replaces some logic from contentScript.tsx.
- **NotePanel.ts** — Standalone highlight note/color picker (vanilla JS, Shadow DOM).
- **utils/lazyComponentRegistry.ts** — Global registry for lazy-loaded modules.
- **utils/reactLoader.ts** — Lazy-loader for heavy UI (EmbeddedApp, CaptureDock, SaveNotificationToast).

### Tooling
- **scripts/smoke-check.mjs** — Extension smoke test harness.
- **scripts/report-bundles.mjs** — Bundle size reporting.
- Manifest alignment between Chromium and Firefox.

## Active Decisions
- Embedded panel is the primary UI shell; popup is secondary.
- Runtime messaging layer centralizes all cross-context communication.
- 4-layer Vite build with chunk splitting for lazy loading.
- Session cache prevents repeated backend fetches.
- Bootstrap pattern aggregates all init data in a single call.

## Next Steps
1. **First feature/bug sprint** — Pick a task and start development.
2. **Test all flows** — Quick save, highlighting, smart capture in both browsers.
3. **Create `knownBugs.md`** — Once bugs are identified during testing.

## Blockers
- None currently identified.
