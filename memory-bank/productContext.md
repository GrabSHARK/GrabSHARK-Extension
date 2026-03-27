# GrabSHARK Extension — Product Context

## Why This Extension Exists
The GrabSHARK web app is powerful but requires users to switch tabs to save content. The extension brings GrabSHARK's core capabilities directly into the browser, enabling frictionless saving, highlighting, and capturing without leaving the current page. It acts as the primary ingestion point for most users' daily workflow.

## Problems Solved
1. **Tab Switching Friction** — Save pages without navigating to the web app.
2. **Context Loss** — Highlight and annotate text in-place while reading, preserving the exact position and context.
3. **Capture Precision** — Smart Capture lets users select specific page elements instead of archiving the entire page.
4. **Cross-Browser Consistency** — Single codebase delivers the same experience on Chrome, Edge, Brave, Arc, and Firefox.
5. **Host Page Interference** — Shadow DOM (ARMOR Protocol) isolates extension UI from host page CSS.

## Core User Flows

### Flow 1: Quick Save (Popup)
1. User clicks the extension icon or presses Cmd+Shift+Y (Mac) / Ctrl+Shift+F (Windows).
2. Popup opens with the current page URL, title, and auto-generated thumbnail.
3. Extension checks if URL is already saved (shows AlreadySavedView if duplicate).
4. User selects a collection, adds tags, and clicks Save.
5. Backend creates the link; worker handles archiving in the background.
6. Toast notification confirms save success/failure.

### Flow 2: Context Menu Save
1. User right-clicks on a page, link, image, or selected text.
2. Context menu shows "Save to GrabSHARK" options.
3. Background ContextManager sends the appropriate data to the backend.
4. Badge briefly shows save status.

### Flow 3: Highlight & Annotate
1. User selects text on any web page.
2. Highlight Toolbox appears near the selection with color options.
3. User picks a color; highlight is rendered as a transparent mark on the page.
4. Optional: user adds a note via the Note Panel.
5. Anchor data (CSS selector, XPath, text context, position ratio) is computed by data agents.
6. Highlight is saved to the backend via the API.
7. On page revisit, existing highlights are fetched and re-rendered via anchor resolution.

### Flow 4: Smart Capture
1. User activates Smart Capture mode (via popup or keyboard shortcut).
2. Extension enters capture mode: hovering over elements shows detection overlay.
3. User can click to capture an element, or use marquee selection to draw a region.
4. Captured content is extracted and sent to the backend.
5. Capture Dock provides cancel/save controls.

### Flow 5: Configure Extension
1. User opens Options page (from popup or browser extension settings).
2. Sets GrabSHARK server URL and authenticates (API key or credentials).
3. Configures preferences: theme, shortcuts, default collection, capture behavior.
4. Settings are stored in `chrome.storage.local` and synced on next popup open.

## Modules

| Module | Description | Key Files |
|---|---|---|
| **Popup** | Quick save form with collection/tag picker | `pages/Popup/App.tsx` |
| **Options** | Extension settings and server configuration | `pages/Options/Options.tsx` |
| **Background** | Service worker with 8 Manager classes | `pages/Background/index.ts` |
| **Content Script** | Lightweight injector for all pages | `pages/ContentScript/contentScript.tsx` |
| **Embedded UI** | Shadow DOM React app for in-page interactions | `pages/ContentScript/EmbeddedApp.tsx` |
| **Highlights** | Text highlighting with anchor persistence | `pages/ContentScript/highlighting/` |
| **Smart Capture** | Element detection and marquee selection | `pages/ContentScript/SmartCapture/` |
| **Data Agents** | DOM data extraction (context, semantic, CSS, XPath) | `pages/ContentScript/agents/` |
| **Toast** | Save success/error notifications | `pages/ContentScript/SaveNotificationToast/` |
| **Preferences** | Account, appearance, interactions, saving config | `@/components/Preferences/` |

## UX Goals
- **Zero Friction:** Save a page in under 2 seconds.
- **Non-Intrusive:** In-page UI must not break host page layout or styles.
- **Keyboard-First:** All core actions accessible via shortcuts.
- **Consistent:** Same behavior across Chromium and Firefox.
- **Localized:** Full i18n support for 15 languages.
