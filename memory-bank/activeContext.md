# GrabSHARK Extension — Active Context

## Current State
- **Date:** 2026-03-27
- **Phase:** Memory Bank initialization & documentation

## Recent Changes
1. Extension codebase initialized from Linkwarden browser extension fork with GrabSHARK branding.
2. `CLAUDE.md` created with comprehensive project rules and architecture documentation.
3. Memory Bank system (`memory-bank/`) created with 6 core files based on full codebase analysis.
4. Task tracking system (`tasks/`) initialized.
5. Architecture reference `.txt` files (5 extension + 5 main app) synchronized in project root.

## Active Decisions
- Memory Bank structure follows the 6-file core model defined in CLAUDE.md.
- Extension communicates with GrabSHARK backend via REST API (no direct DB access).
- Three-layer Vite build system (popup/options, content script, embedded UI) is the established pattern.
- Shadow DOM (ARMOR Protocol) is mandatory for all in-page UI to prevent host page style conflicts.
- `webextension-polyfill` must be used for all browser API calls (cross-browser compatibility).

## Current Focus
- Memory Bank and architecture documentation fully created.
- Ready for first feature development or bug fix sprint.

## Next Steps
1. **Test extension build** — Verify `npm run build` completes without errors.
2. **Load in browser** — Test extension in Chrome and Firefox.
3. **Test core flows** — Quick save, highlighting, smart capture.
4. **Identify first feature/bug** — Start development sprint.
5. **Create `knownBugs.md`** — Once bugs are identified.

## Blockers
- None currently identified.
