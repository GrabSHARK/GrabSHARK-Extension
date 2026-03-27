# GrabSHARK Extension — Project Brief

## Project Overview
**GrabSHARK Extension** is a cross-browser extension (Chromium + Firefox) that serves as the browser-side companion to the [GrabSHARK](../grabshark/) self-hosted knowledge preservation platform. It enables users to save web pages, highlight text, capture elements, and manage their knowledge library directly from the browser without navigating to the web app.

- **License:** MIT
- **Type:** TypeScript + React 18 browser extension
- **Build System:** Vite (3-layer build: popup/options, content script, embedded UI)
- **Platforms:** Chrome, Edge, Brave, Arc (Manifest V3) + Firefox (Manifest V2)

## Core Goals
1. **One-Click Save** — Save the current page to GrabSHARK with a single click or keyboard shortcut (Cmd+Shift+Y / Ctrl+Shift+F).
2. **In-Page Highlighting** — Select text on any web page, highlight it with color-coded markers, and add notes — synced to the backend.
3. **Smart Capture** — Detect and capture specific DOM elements (images, articles, code blocks) with element detection and marquee selection.
4. **Context Menu Integration** — Right-click to save pages, links, images, and selected text.
5. **Browser Bookmarks Sync** — Optionally sync with the browser's native bookmark system.
6. **Real-Time Notifications** — Badge notifications and toast messages for save status.
7. **Customizable Preferences** — Theme (light/dark), keyboard shortcuts, capture defaults, per-domain preferences.
8. **Multi-Language Support** — 15 languages via i18next.
9. **Cross-Browser Compatibility** — Single codebase targeting both Chromium (MV3) and Firefox (MV2).

## Target Users
- GrabSHARK web app users who want seamless browser integration.
- Knowledge workers who need to save and annotate content without leaving the current page.
- Users who prefer keyboard-driven workflows (shortcuts, quick save).
- Multi-browser users (Chrome/Firefox) who need consistent behavior across browsers.

## Key Features

| Feature | Description |
|---|---|
| **Popup UI** | Quick save form with collection picker, tag input, and thumbnail preview |
| **Options Page** | Server URL configuration, keyboard shortcut recorder, extension preferences |
| **Embedded UI** | In-page React app rendered inside Shadow DOM for highlighting and capture controls |
| **Smart Capture** | Element detection with hover highlights, marquee selection, screenshot capture |
| **Highlight System** | Text selection → color picker → note panel → backend sync, with DOM anchor persistence |
| **Context Menus** | Save page, save link, save image, save selected text via right-click |
| **Badge Manager** | Dynamic icon badges for unread notifications and save status |
| **ARMOR Protocol** | CSS isolation system with aggressive reset to prevent host page style conflicts |
| **Duplicate Detection** | Checks if current URL is already saved before showing save form |
| **Thumbnail Generation** | Captures page screenshot as bookmark thumbnail |

## Scope Boundaries
- **In Scope:** Link saving, highlighting, smart capture, context menus, bookmarks sync, notifications, preferences, i18n, cross-browser compatibility.
- **Out of Scope:** Full search (use web app), collection management (use web app), file uploads (use web app), RSS management (use web app), user account creation (use web app).

## Relationship to Main App
The extension is a **client** of the GrabSHARK backend. It:
- Authenticates via API key or username/password against the backend's `/api/v1/` endpoints.
- Saves links by POST to `/api/v1/links`.
- Fetches collections, tags, and user data via GET endpoints.
- Creates/manages highlights via `/api/v1/links/[id]/highlights` endpoints.
- Does NOT have its own database — all data lives on the backend.
