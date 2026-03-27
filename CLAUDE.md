# Global Rules for GrabSHARK Extension Project

You are an expert Frontend Developer specializing in TypeScript, React 18, Vite, Browser Extension APIs (Manifest V3/V2), and Shadow DOM architecture.

> **CRITICAL DIRECTIVE:** This is a pure TypeScript + React browser extension project. It is NOT a Next.js project. It does NOT have a backend. It communicates with the GrabSHARK backend (`grabshark/`) via REST API calls. Generate all code in accordance with TypeScript, React 18, Vite build system, and the Manager-based background architecture.

## Context Loading Rule (MANDATORY)
At the start of EVERY conversation, you MUST read ALL core memory bank files before writing any code or making any changes:
- `memory-bank/projectbrief.md` — Foundation document, extension scope and features
- `memory-bank/productContext.md` — Why the extension exists, user flows
- `memory-bank/activeContext.md` — Current work focus, recent changes
- `memory-bank/systemPatterns.md` — Architecture (3-layer build, Manager pattern, Shadow DOM)
- `memory-bank/techContext.md` — Tech stack (React 18, Vite, Manifest V3), dependencies, setup
- `memory-bank/progress.md` — What works, what's left, known issues

Additionally, check these when relevant:
- `memory-bank/knownBugs.md` — Before debugging any issue (may already be documented).

## Memory Bank Freshness Check (MANDATORY — Session Start)
After reading memory bank files, you MUST run this freshness check before writing any code:

1. **Compare timestamps:** Run `git log --oneline -5 -- src/` and `git log --oneline -1 -- memory-bank/` to see if source code has commits newer than the last memory bank update.
2. **If memory bank is stale** (source has newer commits than memory bank):
   - Warn the user: "Memory bank appears outdated — source code has changed since the last update."
   - Review `git log --oneline` for recent changes and update `activeContext.md` and `progress.md` before proceeding.
3. **Check .txt reference files:** Run `git log --oneline -1 -- "*.txt"` and compare with source changes. If .txt files are older, flag them for review.

This prevents working with outdated context that could lead to incorrect assumptions about the codebase.

## Memory Bank Update Rule
After implementing changes, you MUST update the relevant memory bank files.

> **CRITICAL:** After EVERY feature addition, bug fix, or completed change, you MUST update BOTH `activeContext.md` AND `progress.md`. These two files must always stay in sync.

| File | When to Update |
|---|---|
| `activeContext.md` | After every feature, bug fix, or completed change — update current status, recent changes, next steps |
| `progress.md` | After every feature, bug fix, or completed change — update "What Works", "Current Status", and "Known Issues" sections |
| `systemPatterns.md` | When new architectural patterns, design decisions, or component relationships are introduced |
| `techContext.md` | When new dependencies, tools, or infrastructure changes are made |
| `productContext.md` | When core user flows, modules, or product scope changes |
| `projectbrief.md` | Rarely — only when core project goals or requirements change |
| `knownBugs.md` | When a new bug is discovered or an existing bug is resolved |
| `tasks/todo.md` | After every session — update completed items, add new tasks, reflect current progress |
| `tasks/lessons.md` | After ANY correction from the user — capture the pattern and rule to prevent repeating |

When the user says **"update memory bank"**, you MUST:
1. Review ALL memory bank files AND task files (`tasks/todo.md`, `tasks/lessons.md`)
2. Update each file with the latest information from the current session
3. Ensure consistency across all files

---

## Workflow & Execution Strategy

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions).
- If something goes sideways, **STOP** and re-plan immediately — don't keep pushing.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean.
- Offload research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One task per subagent for focused execution.

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern.
- Write rules for yourself that prevent the same mistake.
- Ruthlessly iterate on these lessons until mistake rate drops.
- Review lessons at session start for relevant project.

### 4. Verification Before Done
- Never mark a task complete without proving it works.
- Test in both Chromium AND Firefox when touching manifest or platform-specific code.
- Ask yourself: **"Would a staff engineer approve this?"**
- Build the extension and verify no console errors.

### 5. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding.
- Point at logs, errors, failing tests — then resolve them.
- Zero context switching required from the user.

---

## Task Management

1. **Plan First:** Write plan to `tasks/todo.md` with checkable items.
2. **Verify Plan:** Check in before starting implementation.
3. **Track Progress:** Mark items complete as you go.
4. **Explain Changes:** High-level summary at each step.
5. **Document Results:** Add review section to `tasks/todo.md`.
6. **Capture Lessons:** Update `tasks/lessons.md` after corrections.

---

## Version Constraints (STRICT)
- **Node.js:** v18+ (build only — not runtime)
- **Package Manager:** npm
- **TypeScript:** ^5.0
- **React:** ^18.2
- **Vite:** ^4.4
- **Tailwind CSS:** ^3.3
- **React Query:** @tanstack/react-query ^4.32 (NOT v5 — extension uses v4)
- **Chromium Manifest:** V3 (Service Worker background)
- **Firefox Manifest:** V2 (Background scripts, `persistent: false`)
- **Firefox Min Version:** 109.0

## Extension Architecture Rules

### 1. Three-Layer Build System (CRITICAL)
The extension uses **3 separate Vite configs** that build sequentially:

| Config | Entry Point | Output | Format | Purpose |
|---|---|---|---|---|
| `vite.config.ts` | `index.html`, `Options/options.html`, `Background/index.ts` | `main.js`, `options.js`, `background.js` | ES modules | Popup UI, Options page, Background service worker |
| `vite.config.content.ts` | `ContentScript/contentScript.tsx` | `contentScript.js` (~200-400KB) | IIFE | Lightweight content script injected into all pages |
| `vite.config.embedded.ts` | `ContentScript/embeddedUI.ts` | `embeddedUI.js` (~6MB) | ES module | Heavy React UI, lazy-loaded only when user opens popup on page |

**Build order:** `tsc && vite build && vite build -c vite.config.content.ts && vite build -c vite.config.embedded.ts`

> **CRITICAL:** `emptyOutDir: false` on content and embedded configs — they must NOT wipe the dist folder. Only the first build clears it.

### 2. Background Manager Pattern
All background logic is organized into independent **Manager** classes in `src/pages/Background/managers/`:

| Manager | Purpose |
|---|---|
| `AuthManager.ts` | Token refresh, session management, credential storage |
| `BadgeManager.ts` | Extension icon badge notifications |
| `BookmarksManager.ts` | Browser bookmarks sync |
| `ContextManager.ts` | Right-click context menu operations |
| `LinksManager.ts` | CORS proxy for link saving to backend |
| `MediaManager.ts` | Screenshot capture handling |
| `MessageRouter.ts` | Cross-script message routing (background <-> content <-> popup) |
| `UserManager.ts` | User settings sync from backend |

**Rule:** Each Manager is self-contained. New background functionality MUST be added as a new Manager or by extending an existing one. Do NOT put logic directly in `Background/index.ts`.

### 3. Content Script Architecture
Content scripts inject into web pages and consist of multiple subsystems:

| Subsystem | Directory/File | Purpose |
|---|---|---|
| **Highlight System** | `highlighting/`, `HighlightToolbox.ts`, `highlightRenderer.ts` | Text selection, highlight rendering, toolbox UI |
| **Smart Capture** | `SmartCapture/` | Element detection, marquee selection, screenshot capture |
| **Data Agents** | `agents/` | DOM data extraction (context, semantic, CSS, XPath) |
| **Anchor Utils** | `anchorUtils/` | Highlight anchor resolution, CSS selectors, XPath generation |
| **Managers** | `managers/` | EmbeddedMenuManager, HighlightManager, ToastManager, InteractionManager |
| **Toast** | `SaveNotificationToast/` | Save success/error notifications |
| **Toolbox** | `toolbox/` | Color mode, comment mode listeners |

### 4. Shadow DOM Isolation (ARMOR Protocol)
The extension's in-page UI (EmbeddedApp) uses **Shadow DOM** to isolate styles from the host page:
- `contentscript.css` (~58KB) — Aggressive CSS reset with `.ext-lw-*` prefixed classes.
- `embedded.css` — Styles for Shadow DOM embedded components.
- All in-page UI is rendered inside Shadow DOM to prevent CSS conflicts with host pages.
- Z-index uses max value `2147483647` for overlays.

### 5. Shared Module Organization (`src/@/`)
Shared code is aliased as `@/*` and organized as:

```
src/@/
├── components/           → Shared React UI components
│   ├── ui/               → Radix UI wrappers (15 primitives)
│   ├── SaveLink/         → Save link flow (form, preview, header, footer)
│   ├── EditLink/         → Edit link flow (form, preview, delete dialog)
│   ├── Bookmark/         → Bookmark picker, options
│   └── Preferences/      → Preference sections (account, appearance, interactions, saving)
├── hooks/                → Custom hooks (useThumbnail)
├── lib/                  → Utilities
│   ├── actions/          → API action wrappers (collections, links, users, highlights, tags)
│   ├── auth/             → Authentication logic
│   ├── validators/       → Zod schemas (bookmarkForm, optionsForm, config)
│   ├── validations/      → Message schema validation
│   ├── types/            → TypeScript types (highlight)
│   ├── api.ts            → Axios instance configuration
│   ├── cache.ts          → React Query cache management
│   ├── config.ts         → Extension configuration
│   ├── i18n.ts           → i18next initialization
│   ├── imageProcessor.ts → Image processing utilities
│   ├── screenshot.ts     → Screenshot capture logic
│   ├── settings.ts       → Extension settings management
│   ├── thumbnailCache.ts → Thumbnail caching
│   └── utils.ts          → General utilities (cn, formatDate, etc.)
└── locales/              → 15 language JSON files
```

### 6. API Communication
The extension communicates with the GrabSHARK backend via:
- **Axios instance** (`@/lib/api.ts`) configured with base URL from extension settings.
- **Action wrappers** (`@/lib/actions/`) for each resource (collections, links, tags, users, highlights).
- **Authentication:** API key or username/password stored in `chrome.storage.local`.
- **CORS:** Background service worker proxies requests to bypass CORS restrictions.

### 7. Multi-Browser Compatibility
| Feature | Chromium (V3) | Firefox (V2) |
|---|---|---|
| Manifest | `chromium/manifest.json` | `firefox/manifest.json` |
| Background | Service Worker | Background scripts (`persistent: false`) |
| Action API | `chrome.action` | `browser.browserAction` |
| Permissions | `host_permissions` separate | `permissions` includes `<all_urls>` |
| Build | `./build.sh` | `./build.sh --firefox` |

**Rule:** Always use `webextension-polyfill` for cross-browser API calls. Never use `chrome.*` APIs directly except in type declarations.

---

## UI Component Rules
- **Radix UI** primitives in `src/@/components/ui/` (15 components): Button, Checkbox, Command, Dialog, DropDownMenu, Form, Input, Label, Popover, Select, Separator, Switch, Textarea, Toast, Toaster.
- **Tailwind CSS** for all styling. Use `cn()` utility from `@/lib/utils` for conditional classes.
- **Lucide React** + **Phosphor Icons** for iconography.
- **React Hook Form** + **Zod** for form validation.
- Reuse existing components before creating new ones.

## Localization (i18n)
- **Framework:** i18next + react-i18next
- **15 languages:** de, en, es, fr, it, ja, nl, pl, pt-BR, ro, ru, tr, uk, zh, zh-TW
- **Translation files:** `src/@/locales/*.json`
- All user-facing strings MUST use `t()` translation function.

## System Context & Environment Rules
- **OS Environment:** macOS or Windows (development). Extension runs in Chromium or Firefox.
- **Build:** `npm run build` compiles all 3 Vite configs sequentially.
- **Dev Mode:** `npm run dev` starts Vite dev server (popup/options only — content scripts need full build).
- **Testing content scripts:** Requires full build + extension reload in browser.

## Dev Commands

| Command | Action |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite dev server (popup/options hot reload) |
| `npm run build` | Full production build (3 Vite passes) |
| `npm run lint` | ESLint check |
| `./build.sh` | Build for Chromium (copies chromium/manifest.json) |
| `./build.sh --firefox` | Build for Firefox (copies firefox/manifest.json) |

## Git Commit Rule
At the end of each conversation (after all code changes are complete), you MUST create an appropriate git commit:
1. **Stage changes:** `git add -A`
2. **Commit format:** Use [Conventional Commits](https://www.conventionalcommits.org/). (e.g., `feat:`, `fix:`, `refactor:`)
3. **Language:** Commit messages MUST be in **English**.
4. **Scope:** Use parentheses for scope, e.g., `feat(content): add smart capture hover`, `fix(background): resolve auth token refresh`.

## Architecture Reference Files (MANDATORY — Single Source of Truth)

> **CRITICAL:** Both project directories (`grabshark/` and `grabshark-extension/`) contain the SAME set of 10 `.txt` reference files that document the COMPLETE architecture, design system, APIs, components, and page structures. These files are the **authoritative source** — always consult them before modifying or creating UI, API, or extension code.

**Browser Extension (grabshark-extension):**
| File | Contents |
|---|---|
| `grabshark-extension_tech_stack.txt` | Extension libraries: Vite, Manifest V3, React Query, etc. |
| `grabshark-extension_pages.txt` | Popup, Options, Background, Content Script page map |
| `grabshark-extension_components.txt` | Extension UI components: BookmarkForm, VOID Dock, Toast, etc. |
| `grabshark-extension_apis.txt` | Background Managers, Content Script agents, message routing |
| `grabshark-extension_design.txt` | Shadow DOM isolation, ARMOR Protocol, VOID tokens, animations |

**Main Application (grabshark):**
| File | Contents |
|---|---|
| `grabshark_tech_stack.txt` | All libraries, frameworks, and internal monorepo packages |
| `grabshark_pages.txt` | Every page route with file paths, categories, and purposes |
| `grabshark_components.txt` | Complete UI component hierarchy (158+ components) |
| `grabshark_apis.txt` | All 65+ API endpoints with HTTP methods and file paths |
| `grabshark_design.txt` | Design system: OKLCH colors, typography, card system, animations |

### .txt Synchronization Rules (NON-NEGOTIABLE)

> **WARNING: KEEPING THESE FILES UP-TO-DATE IS VITALLY IMPORTANT.**

1. **Auto-Update on Change:** If you modify, refactor, or rename ANY code element documented in a `.txt` file, you MUST immediately update the corresponding `.txt` file entry.
2. **Auto-Remove on Deletion:** If a documented element is removed from the codebase, remove its entry from the relevant `.txt` file.
3. **Auto-Add on Creation:** If you create a new element that falls under any `.txt` file category, add its entry using the same format.
4. **Cross-Directory Sync:** All 10 `.txt` files exist in BOTH `grabshark/` and `grabshark-extension/` directories. When you update a `.txt` file in one directory, you MUST immediately copy it to the other directory.
5. **Verification:** After any code change session, verify that affected `.txt` files are still accurate.

## Additional Context Files
@memory-bank/projectbrief.md
@memory-bank/systemPatterns.md
@memory-bank/techContext.md
@tasks/todo.md
@tasks/lessons.md
