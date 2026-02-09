# VOID Design Modernization (V2: React + Tailwind)

This plan details a radical technical overhaul of the browser extension's content script UI to achieve absolute visual parity with the SPARK web app.

## The Strategy
Instead of pure CSS and string templates, we will:
1.  **Inject Tailwind CSS** into the Shadow DOM.
2.  **Mount React Components** (via `createRoot`) for the Highlight Toolbox, Smart Actions, and Note Panel.
3.  **Centralize VOID Tokens** and Fonts within the Shadow DOM `:host`.
4.  **[NEW]** Bundle [components.css](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components.css) in the main entry point to include Tailwind utilities.
5.  **[NEW]** Use `.ext-lw-dark` as the dark mode selector for Tailwind compatibility.
- **[FIX]** Re-add `contentScript.css` to [manifest.json](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/chromium/manifest.json) to restore highlight visibility.
- **[FIX]** Remove `@tailwind base;` from [components.css](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components.css) to prevent Preflight leakage into host pages.
- **[REVERT]** Restore standard `darkMode: ["class"]` in [tailwind.config.js](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/tailwind.config.js) to fix extension pages.
- **[NEW]** Add a "Solid Under-Dock" container (#09090b) to [ToolboxDock](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/ToolboxDock.tsx#30-163), [NoteDock](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/NoteDock.tsx#21-109), and [CaptureDock](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/CaptureDock.tsx#81-201).

## Proposed Changes

### [CSS Infrastructure]
- Add `@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`.
- Define VOID variables and SPARK font-faces (`Hanken Grotesk`, `Sora`).
- **[NEW]** Purge legacy manual CSS overrides and unify with Tailwind.

### [React Integration]
#### [NEW] [ToolboxDock.tsx](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/ToolboxDock.tsx)
- Unified React component for the Highlight Menu and Action Dock.
- Uses Framer Motion for smooth VOID transitions.
- Fully styled with Tailwind utility classes.

### [Target Components]
#### [MODIFY] [HighlightToolbox.ts](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/HighlightToolbox.ts)
- Refactor to mount [ToolboxDock.tsx](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/ToolboxDock.tsx) using `createRoot`.
- Pass state and callbacks as props to the React tree.

#### [MODIFY] [NotePanel.ts](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/NotePanel.ts)
- Refactor to mount a React-based [NoteDock.tsx](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/NoteDock.tsx).

#### [MODIFY] [CaptureActionBar.ts](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/SmartCapture/CaptureActionBar.ts)
- Refactor to mount a React-based [CaptureDock.tsx](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components/CaptureDock.tsx).

### [Legacy Cleanup]
#### [DELETE] [HighlightToolboxRenderer.ts](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/HighlightToolboxRenderer.ts)
#### [DELETE] [CaptureActionBarRenderer.ts](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/SmartCapture/CaptureActionBarRenderer.ts)

### [Note & Page Highlights]
#### [MODIFY] [content-armor.css](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/content-armor.css)
- Modernize text highlight colors and hover effects.
- Align with VOID design language.
#### [MODIFY] [contentScript.tsx](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/contentScript.tsx)
- Import [components.css](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/src/pages/ContentScript/components.css) to include Tailwind styles in the final bundle.

#### [MODIFY] [manifest.json](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/chromium/manifest.json)
- Restore `css: ["./contentScript.css"]` in the content script definition.

#### [MODIFY] [tailwind.config.js](file:///Users/fatih/Antigravity/Linkwarden/browser-extension/tailwind.config.js)
- Revert `darkMode: ["class"]`.
- Remove `corePlugins: { preflight: false }`.

## Verification Plan

### Automated Tests
- `npm run build`: Ensure no regressions in the build process.

### Manual Verification
- **Highlight Selection**: Select text on a page and verify the new unified VOID dock appears.
- **Smart Actions**: Hover over elements and verify the Smart Actions menu matches the VOID aesthetic.
- **Note Panel**: Add/edit a note and verify the panel's glassmorphism and layout.
- **Dark/Light Mode**: Verify all components look premium in both modes.
