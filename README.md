<div align="center">
  <img src="./chromium/128.png" width="80px" />
  <h1>SPARK Browser Extension</h1>
  <h3>Your gateway to SPARK — right from your browser</h3>
</div>

<div align="center">

[SPARK Website](https://sparkapp.tr) · [Documentation](https://docs.sparkapp.tr) · [Main Repository](https://github.com/spark-archive/spark)

</div>

---

## Introduction

The SPARK browser extension brings the full power of SPARK into your browser. Save pages instantly, highlight text on live websites, take smart captures, and manage your knowledge library — all without leaving the page you're on.

Available for **Chromium** (Chrome, Edge, Brave, Arc) and **Firefox**.

---

## Features

### 💾 Save & Organize
- **One-Click Save** — Save the current page to your SPARK library with a single click
- **Embedded In-Page UI** — Click the extension icon to open the SPARK panel directly within any webpage — no popup needed
- **Duplicate Detection** — Automatically checks if a link already exists before saving
- **Collection & Tag Picker** — Assign collections and tags right from the save panel
- **Bulk Save** — Save all tabs in the current window at once

### 🖍️ Live Highlighting & Notes
- **Persistent Highlights** — Select text on any live website and highlight it with colors — highlights sync to your SPARK library and reappear when you revisit the page
- **Notes on Live Sites** — Attach notes to any highlight directly on the page via the Note Panel
- **Highlight Toolbox** — A contextual toolbar appears on text selection for quick highlight/note actions

### 📸 Smart Capture
- **Element Detection** — Intelligently detects page elements (articles, images, sections) for precise capture
- **Marquee Selection** — Draw a selection box to capture any specific area of a page
- **Capture Action Bar** — Contextual toolbar with capture options after selection

### 🖱️ Context Menus
- Right-click on any **page**, **link**, **image**, or **text selection** to save directly to SPARK
- Quick access to common actions without opening the extension panel

### 🔔 Badge Notifications
- Real-time badge count on the extension icon
- Visual indicator when the current page is already saved in your library

### ⚙️ Preferences
- **Auth** — Sign in with API key or Username/Password
- **Archive Format Sync** — Your archive format preferences (Screenshot, PDF, Readable, Monolith) sync from your SPARK account
- **Custom Shortcuts** — Fully configurable keyboard shortcut (default: `Cmd+Shift+Y` on Mac, `Ctrl+Shift+F` on Windows/Linux)
- **Preferences Sync** — Extension theme and language matches your SPARK preference
- **Bookmark Integration** — Works with your browser's native bookmarks

### 🌐 Multi-Language Support

15 languages supported:

English, Türkçe, Deutsch, Español, Français, Italiano, 日本語, Nederlands, Polski, Português (BR), Română, Русский, Українська, 中文, 中文 (繁體)

---

## Installation

### From Store

- **Chrome / Edge / Brave:** [Chrome Web Store](https://sparkapp.tr/extension)
- **Firefox:** [Firefox Add-ons](https://sparkapp.tr/extension)

### Build From Source

#### Requirements

- Node.js 18+ (LTS)
- npm 9+
- Git

#### Steps

```bash
# 1. Clone
git clone https://github.com/spark-archive/spark-extension.git
cd spark-extension

# 2. Install dependencies
npm install

# 3. Build
chmod +x ./build.sh && ./build.sh
```

The built extension will be in the `/dist` folder. Load it as an unpacked extension in your browser:

- **Chrome:** `chrome://extensions` → Enable "Developer mode" → "Load unpacked" → Select `/dist/chromium`
- **Firefox:** `about:debugging` → "This Firefox" → "Load Temporary Add-on" → Select any file in `/dist/firefox`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Manifest V3 (Chromium), Manifest V2 (Firefox) |
| **UI** | React 18, TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS, Radix UI |
| **State** | React Query |
| **i18n** | Custom locale system (15 languages) |
| **Communication** | Chrome Message Passing API |

---

## Architecture

```
src/
├── @/                    # Shared modules
│   ├── components/       # Reusable UI components (SaveLink, EditLink, Preferences, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities, config, actions, cache
│   └── locales/          # 15 language files
├── pages/
│   ├── Background/       # Service worker & managers
│   │   └── managers/     # Auth, Badge, Bookmarks, Context, Links, Media, Message routing
│   ├── ContentScript/    # Content scripts injected into web pages
│   │   ├── SmartCapture/ # Element detection, marquee selection, capture UI
│   │   ├── HighlightToolbox/  # Live highlight creation
│   │   ├── NotePanel/    # Inline note editing
│   │   └── EmbeddedApp/  # In-page SPARK panel
│   ├── Popup/            # Extension popup (if icon clicked)
│   └── Options/          # Extension settings page
```

---

## License

This extension is part of the [SPARK](https://github.com/spark-archive/spark) project, licensed under the [MIT License](./LICENSE).
